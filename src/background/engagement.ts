import { t } from '../i18n';
import type { AniListErrorCode } from '../shared/anilist.types';
import { refreshReviewBadge } from '../shared/badge';
import { addPendingRating, getPendingRatings, isRatingSettled, recordRewatchDecline, removePendingRating } from '../shared/engagement-store';
import { toSafeImageUrl } from '../shared/url';
import { mediaRefId, type MediaRef, type Score10 } from '../shared/engagement.types';
import type { Result } from '../shared/result';
import { sessionsOf, type SessionEpochs } from '../shared/session-epochs';
import { dropCachedWatchingEntry, getOpenSessions, isSessionOpen } from '../shared/storage';
import { normalizeListNotes, type ListNotesResult } from '../shared/list-notes';
import { forgetCachedPageMedia } from '../shared/page-media-cache';
import type { ServiceOutcome, ServiceResult, SyncOutcome } from '../shared/sync.types';
import type { WatchingEntry } from '../shared/watching.types';
import { TRACKER_LABELS } from '../shared/tracker.types';
import { ApiError } from './api/errors';
import { withEntryLock } from './sync/entry-lock';
import { getConnectedTrackers } from './trackers';
import type { TrackerEntry, TrackerService } from './trackers/tracker';
import { createLogger } from '../shared/logger';

// Engagement (service worker) : note de fin de série, revisionnage, commentaire et retrait de la liste, sur tous les
// services connectés.

const log = createLogger('engagement');

interface Target {
  tracker: TrackerService;
  id: number;
}

/** Services connectés où la série a un identifiant (AniList : mediaId ; MAL : malId) */
async function resolveTargets(media: MediaRef): Promise<Target[] | null> {
  const trackers = await getConnectedTrackers();
  if (trackers.length === 0) return null;
  return trackers.flatMap((tracker) => {
    const id = tracker.id === 'anilist' ? media.mediaId : media.malId;
    return id !== null ? [{ tracker, id }] : [];
  });
}

type SkippedOutcome = Extract<ServiceOutcome, { status: 'skipped' }>;

/** Série absente de la liste de ce service : rien n'y est écrit (code reconnu par les écrans) */
const notInList = (): SkippedOutcome => ({ status: 'skipped', reason: t('engagement.notInList'), code: 'not-in-list' });

function toErrorOutcome(error: unknown): ServiceOutcome {
  return error instanceof ApiError ? { status: 'error', message: error.message, code: error.code } : { status: 'error', message: t('error.unexpected') };
}

function toSyncError(error: unknown, fallback: string): SyncOutcome {
  if (error instanceof ApiError) return { status: 'error', message: error.message, code: error.code };
  log.error('Erreur inattendue :', error);
  return { status: 'error', message: fallback };
}

/**
 * Lecture fraîche puis action sur UN service ; `act` renvoie un saut (raison), un résultat sans écriture ou l'écriture.
 * Lecture et écriture sous le verrou de la fiche : le revisionnage décidé sur « Terminé » n'écrase pas une synchro
 * concurrente. Ne lève jamais. `epochs` : sessions auxquelles appartient l'action (carte « À noter », sessions relevées
 * avant un retrait ou un commentaire) ; rien n'est écrit sur une session fermée ou rouverte depuis.
 */
async function onService(
  { tracker, id }: Target,
  act: (current: TrackerEntry) => string | ServiceOutcome | (() => Promise<ServiceOutcome>),
  epochs: SessionEpochs | null = null,
): Promise<ServiceResult> {
  const sessionClosed: ServiceResult = { service: tracker.id, outcome: { status: 'skipped', reason: t('sync.sessionClosed') } };
  const open = async (): Promise<boolean> => epochs === null || (await isSessionOpen(tracker.id, epochs[tracker.id]));
  try {
    if (!(await open())) return sessionClosed;
    return await withEntryLock(tracker.id, id, async (): Promise<ServiceResult> => {
      const step = act(await tracker.getEntry(id));
      if (typeof step === 'string') return { service: tracker.id, outcome: { status: 'skipped', reason: step } };
      if (typeof step === 'object') return { service: tracker.id, outcome: step };
      // Déconnexion (puis autre compte) pendant la lecture : rien n'est écrit
      if (!(await open())) return sessionClosed;
      return { service: tracker.id, outcome: await step() };
    });
  } catch (error: unknown) {
    log.error(`${TRACKER_LABELS[tracker.id]} : échec`, error);
    return { service: tracker.id, outcome: toErrorOutcome(error) };
  }
}

/** Identifiants possibles de la carte « À noter » : créée depuis l'une ou l'autre fiche (liste MAL : fiche AniList inconnue) */
function ratingCardIds(media: MediaRef): string[] {
  return [...new Set([mediaRefId(media), ...(media.malId !== null ? [mediaRefId({ mediaId: null, malId: media.malId })] : [])])];
}

/** Retire la carte « À noter » sous chacun de ses identifiants ; true si une carte a été retirée */
async function removeRatingCards(media: MediaRef): Promise<boolean> {
  let removed = false;
  for (const id of ratingCardIds(media)) removed = (await removePendingRating(id)) || removed;
  return removed;
}

/**
 * Écrit la note sur chaque service où la série est dans la liste, puis retire la carte « À noter ». Depuis la carte
 * (`fromCard`) : seulement sur les sessions où elle a été créée, jamais sur un compte connecté depuis.
 */
export async function rateMedia(media: MediaRef, score: Score10, fromCard = false): Promise<SyncOutcome> {
  try {
    const ids = ratingCardIds(media);
    const card = fromCard ? (await getPendingRatings()).filter((r) => ids.includes(r.id)).sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id))[0] : undefined;
    const epochs = card ? sessionsOf(card.epochs, await getOpenSessions()) : null;
    const targets = await resolveTargets(media);
    if (targets === null) return { status: 'not-connected' };
    if (targets.length === 0) return { status: 'error', message: t('sync.noServiceFollows') };

    const results = await Promise.all(
      targets.map((target) =>
        onService(target, (current) => {
          // Noter une série absente de la liste l'y ajouterait sans statut : on s'abstient
          if (current.entry === null) return t('engagement.notInList');
          return async () => {
            const saved = await target.tracker.saveScore(target.id, score);
            log.info(`✔ ${TRACKER_LABELS[target.tracker.id]} : ${current.title} noté ${score}/10`);
            return { status: 'updated', progress: saved.progress, completed: saved.status === 'COMPLETED' };
          };
        }, epochs),
      ),
    );

    // Carte « À noter » conservée tant qu'un service est en erreur ou que personne n'a enregistré la note (nouvel essai possible)
    if (isRatingSettled(results) && (await removeRatingCards(media))) {
      await refreshReviewBadge();
    }
    return { status: 'synced', mediaTitle: media.title, results };
  } catch (error: unknown) {
    return toSyncError(error, t('error.unexpectedRating'));
  }
}

/** « Plus tard » : carte « À noter » dans Activité */
export async function deferRating(media: MediaRef, coverUrl: string | null): Promise<Result<null, AniListErrorCode>> {
  try {
    const epochs = await getOpenSessions();
    // Affiche hors https : carte sans image plutôt qu'illisible (isPendingRating)
    const cover = toSafeImageUrl(coverUrl);
    await addPendingRating({ mediaId: media.mediaId, malId: media.malId, title: media.title, id: mediaRefId(media), coverUrl: cover, completedAt: Date.now(), epochs });
    await refreshReviewBadge();
    return { ok: true, data: null };
  } catch (error: unknown) {
    log.error('Note en attente non enregistrée :', error);
    return { ok: false, code: 'API_ERROR', message: t('engagement.deferFailed') };
  }
}

/** « Oui » au revisionnage : REPEATING + progression, uniquement sur les fiches terminées. */
export async function startRewatch(media: MediaRef, progress: number): Promise<SyncOutcome> {
  try {
    const targets = await resolveTargets(media);
    if (targets === null) return { status: 'not-connected' };
    if (targets.length === 0) return { status: 'error', message: t('sync.noServiceFollows') };

    const results = await Promise.all(
      targets.map((target) =>
        onService(target, (current) => {
          if (current.entry?.status !== 'COMPLETED') return t('engagement.notCompleted');
          if (current.episodes !== null && progress >= current.episodes) return t('engagement.lastEpisode', { progress });
          return async () => {
            const saved = await target.tracker.startRewatch(target.id, progress);
            log.info(`✔ ${TRACKER_LABELS[target.tracker.id]} : revisionnage de ${current.title}, épisode ${saved.progress}`);
            return { status: 'updated', progress: saved.progress, completed: false };
          };
        }),
      ),
    );
    return { status: 'synced', mediaTitle: media.title, results };
  } catch (error: unknown) {
    return toSyncError(error, t('error.unexpectedRewatch'));
  }
}

/** « Non » au revisionnage : plus de proposition pendant 30 jours */
export async function declineRewatch(media: MediaRef): Promise<Result<null, AniListErrorCode>> {
  try {
    await recordRewatchDecline(media);
    return { ok: true, data: null };
  } catch (error: unknown) {
    log.error('Refus de revisionnage non enregistré :', error);
    return { ok: false, code: 'API_ERROR', message: t('engagement.declineFailed') };
  }
}

// ─── Retrait de la liste ──────────────────────────────────────────────────

/** Entrée « En cours » de cette série (fiche AniList, ou fiche MAL sans équivalent AniList) */
function isSameSeries(media: MediaRef): (entry: WatchingEntry) => boolean {
  return (entry) => (media.mediaId !== null && entry.mediaId === media.mediaId) || (media.malId !== null && entry.malId === media.malId);
}

/**
 * Après un retrait : fiches des onglets (états des listes) oubliées, série retirée de la liste « En cours » en cache
 * des services où elle a été retirée, et carte « À noter » retirée si plus aucun service n'est en erreur (il n'y a plus
 * rien à noter). Les correspondances (plateforme → fiche) sont gardées : une synchro ultérieure retrouve la bonne fiche.
 * Ne lève jamais : le retrait est fait, seul l'affichage peut rester en retard jusqu'à la prochaine relecture.
 */
async function afterRemoval(media: MediaRef, results: readonly ServiceResult[], epochs: SessionEpochs): Promise<void> {
  const removed = results.filter((r) => r.outcome.status === 'updated').map((r) => r.service);
  if (removed.length === 0) return;
  try {
    await forgetCachedPageMedia(media);
    for (const service of removed) {
      const epoch = epochs[service];
      if (epoch !== undefined) await dropCachedWatchingEntry(service, epoch, isSameSeries(media));
    }
    if (results.some((r) => r.outcome.status === 'error')) return;
    if (await removeRatingCards(media)) await refreshReviewBadge();
  } catch (error: unknown) {
    log.warn('Affichage non mis à jour après le retrait de la liste :', error);
  }
}

/**
 * « Retirer de la liste » : retire la série de la liste de chaque service connecté où elle est (absente : sautée).
 * Sessions relevées avant toute requête : rien n'est retiré d'un compte connecté entre-temps. Un retrait réussi est
 * rendu comme `updated` (progression 0) ; un épisode vu plus tard l'y rajoute (synchro automatique, comportement voulu).
 */
export async function removeFromList(media: MediaRef): Promise<SyncOutcome> {
  try {
    const epochs = await getOpenSessions();
    const targets = await resolveTargets(media);
    if (targets === null) return { status: 'not-connected' };
    if (targets.length === 0) return { status: 'error', message: t('sync.noServiceFollows') };

    const results = await Promise.all(
      targets.map((target) =>
        onService(target, (current) => {
          if (current.entry === null) return notInList();
          return async () => {
            await target.tracker.deleteEntry(target.id);
            log.info(`✔ ${TRACKER_LABELS[target.tracker.id]} : ${current.title} retiré de la liste`);
            return { status: 'updated', progress: 0, completed: false };
          };
        }, epochs),
      ),
    );
    await afterRemoval(media, results, epochs);
    return { status: 'synced', mediaTitle: media.title, results };
  } catch (error: unknown) {
    return toSyncError(error, t('error.unexpectedRemove'));
  }
}

// ─── Commentaire de l'entrée ──────────────────────────────────────────────

/**
 * Commentaire affiché : celui d'AniList si la série y est, sinon celui de MyAnimeList. Lecture seule ; un service en
 * erreur est passé (l'autre peut répondre), l'erreur n'est rendue que si aucun service n'a pu dire où est la série.
 */
export async function getListNotes(media: MediaRef): Promise<ListNotesResult> {
  try {
    const targets = await resolveTargets(media);
    if (targets === null) return { ok: false, code: 'NOT_AUTHENTICATED', message: t('feedback.notConnected.title') };
    let failure: { code: AniListErrorCode; message: string } | null = null;
    for (const { tracker, id } of targets) {
      try {
        const current = await tracker.getEntry(id);
        if (current.entry !== null) return { ok: true, data: { inList: true, notes: current.notes } };
      } catch (error: unknown) {
        log.warn(`${TRACKER_LABELS[tracker.id]} : commentaire illisible`, error);
        failure ??= error instanceof ApiError ? { code: error.code, message: error.message } : { code: 'API_ERROR', message: t('error.unexpected') };
      }
    }
    return failure ? { ok: false, ...failure } : { ok: true, data: { inList: false, notes: null } };
  } catch (error: unknown) {
    log.error('Erreur inattendue (commentaire) :', error);
    return { ok: false, code: 'API_ERROR', message: t('error.unexpected') };
  }
}

/**
 * Enregistre le commentaire sur chaque service connecté où la série est dans la liste ("" l'efface). Absente : sautée,
 * jamais ajoutée (comme la note). Même texte déjà enregistré : `up-to-date`, rien n'est écrit.
 */
export async function setListNotes(media: MediaRef, text: string): Promise<SyncOutcome> {
  const notes = normalizeListNotes(text);
  try {
    const epochs = await getOpenSessions();
    const targets = await resolveTargets(media);
    if (targets === null) return { status: 'not-connected' };
    if (targets.length === 0) return { status: 'error', message: t('sync.noServiceFollows') };

    const results = await Promise.all(
      targets.map((target) =>
        onService(target, (current) => {
          if (current.entry === null) return notInList();
          if ((current.notes ?? '') === notes) return { status: 'up-to-date', progress: current.entry.progress };
          return async () => {
            const saved = await target.tracker.saveNotes(target.id, notes);
            log.info(`✔ ${TRACKER_LABELS[target.tracker.id]} : commentaire de ${current.title} ${notes ? 'enregistré' : 'effacé'}`);
            return { status: 'updated', progress: saved.progress, completed: saved.status === 'COMPLETED' };
          };
        }, epochs),
      ),
    );
    if (results.some((r) => r.outcome.status === 'updated')) {
      await forgetCachedPageMedia(media).catch((error: unknown) => log.warn('Fiches des onglets non oubliées :', error));
    }
    return { status: 'synced', mediaTitle: media.title, results };
  } catch (error: unknown) {
    return toSyncError(error, t('error.unexpectedNotes'));
  }
}
