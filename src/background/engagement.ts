import { t } from '../i18n';
import type { AniListErrorCode } from '../shared/anilist.types';
import { refreshReviewBadge } from '../browser/badge';
import { addPendingRating, getPendingRatings, isRatingSettled, recordRewatchDecline, removePendingRating } from '../browser/storage/engagement-store';
import { toSafeImageUrl } from '../shared/url';
import { mediaRefId, type MediaRef, type Score10 } from '../shared/engagement.types';
import type { Result } from '../shared/result';
import { sessionsOf, type SessionEpochs } from '../shared/session-epochs';
import { dropCachedWatchingEntry } from '../browser/storage/watching-cache';
import { getOpenSessions } from '../browser/storage/sessions';
import { getMediaMappings } from '../browser/storage/mappings';
import { deletePendingReviewsWhere } from '../browser/storage/reviews';
import { removeQueueItemsWhere } from '../browser/storage/sync-queue-store';
import { normalizeListNotes, type ListNotesResult } from '../shared/list-notes';
import { forgetCachedPageMedia } from '../browser/storage/page-media-cache';
import type { EpisodeInfo } from '../shared/episode.types';
import { mappingKey } from '../platforms/series-identity';
import type { ServiceOutcome, ServiceResult, SyncOutcome } from '../shared/sync.types';
import type { WatchingEntry } from '../shared/watching.types';
import { TRACKER_LABELS } from '../shared/tracker.types';
import { ApiError } from './errors';
import { entryTargets, runOnServices, type EntryCommand, type EntryTarget } from './entry-commands';
import { getCatalogMedia } from './sync/sync-service';
import { getConnectedTrackers } from './trackers';
import type { CatalogMedia, TrackerService } from './ports/tracker';
import { createLogger } from '../browser/logger';

// Engagement (service worker) : note de fin de série, revisionnage, commentaire et retrait de la liste, sur tous les
// services connectés.

const log = createLogger('engagement');

/**
 * idMal manquant sur l'écran alors que MAL est connecté : celui du catalogue AniList (audit 6-D9, même résolution que
 * +1 / −1 et le statut). Catalogue illisible : la référence de l'écran seule (AniList reste écrit).
 */
async function catalogFor(media: MediaRef, trackers: readonly TrackerService[]): Promise<CatalogMedia | null> {
  if (media.mediaId === null || media.malId !== null || !trackers.some((tracker) => tracker.id === 'mal')) return null;
  try {
    return await getCatalogMedia(media.mediaId);
  } catch (error: unknown) {
    log.warn('Fiche du catalogue illisible, MyAnimeList ignoré :', error);
    return null;
  }
}

/** Services connectés où la série a un identifiant (null : aucun service connecté) */
async function resolveTargets(media: MediaRef): Promise<EntryTarget[] | null> {
  const trackers = await getConnectedTrackers();
  if (trackers.length === 0) return null;
  return entryTargets(trackers, media, await catalogFor(media, trackers));
}

type SkippedOutcome = Extract<ServiceOutcome, { status: 'skipped' }>;

/** Série absente de la liste de ce service : rien n'y est écrit (code reconnu par les écrans) */
const notInList = (): SkippedOutcome => ({ status: 'skipped', reason: t('engagement.notInList'), code: 'not-in-list' });

const skipped = (reason: string): SkippedOutcome => ({ status: 'skipped', reason });

function toSyncError(error: unknown, fallback: string): SyncOutcome {
  if (error instanceof ApiError) return { status: 'error', message: error.message, code: error.code };
  log.error('Erreur inattendue :', error);
  return { status: 'error', message: fallback };
}

/**
 * Action sur chaque service (voir entry-commands.ts : verrou, lecture fraîche, session revérifiée avant l'écriture).
 * `epochs` : sessions auxquelles appartient l'action (carte « À noter », sinon sessions relevées avant toute requête) ;
 * rien n'est écrit sur une session fermée ou rouverte depuis.
 */
async function onServices(targets: readonly EntryTarget[], name: string, decide: EntryCommand['decide'], epochs: SessionEpochs): Promise<ServiceResult[]> {
  return (await runOnServices(targets, { name, decide }, epochs)).map((run) => run.result);
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
    const open = await getOpenSessions();
    const epochs = card ? sessionsOf(card.epochs, open) : open;
    const targets = await resolveTargets(media);
    if (targets === null) return { status: 'not-connected' };
    if (targets.length === 0) return { status: 'error', message: t('sync.noServiceFollows') };

    const results = await onServices(targets, 'note', (current, { tracker, id }) => {
      // Noter une série absente de la liste l'y ajouterait sans statut : on s'abstient
      if (current.entry === null) return skipped(t('engagement.notInList'));
      return async () => {
        const saved = await tracker.saveScore(id, score);
        log.info(`✔ ${TRACKER_LABELS[tracker.id]} : ${current.title} noté ${score}/10`);
        return { status: 'updated', progress: saved.progress, completed: saved.status === 'COMPLETED' };
      };
    }, epochs);
    // Fiches des onglets oubliées : une note donnée hors de l'écran (bulle du lecteur) y apparaît à la prochaine lecture
    if (results.some((r) => r.outcome.status === 'updated')) {
      await forgetCachedPageMedia(media).catch((error: unknown) => log.warn('Fiches des onglets non oubliées :', error));
    }

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
    const epochs = await getOpenSessions();
    const targets = await resolveTargets(media);
    if (targets === null) return { status: 'not-connected' };
    if (targets.length === 0) return { status: 'error', message: t('sync.noServiceFollows') };

    const results = await onServices(targets, 'revisionnage', (current, { tracker, id }) => {
      if (current.entry?.status !== 'COMPLETED') return skipped(t('engagement.notCompleted'));
      if (current.episodes !== null && progress >= current.episodes) return skipped(t('engagement.lastEpisode', { progress }));
      return async () => {
        const saved = await tracker.startRewatch(id, progress);
        log.info(`✔ ${TRACKER_LABELS[tracker.id]} : revisionnage de ${current.title}, épisode ${saved.progress}`);
        return { status: 'updated', progress: saved.progress, completed: false };
      };
    }, epochs);
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
 * Synchros en file et cartes « À vérifier » simples de la série, créées AVANT le retrait (décision 18, audit B7) :
 * retirées, sinon leur relance ou leur validation rajouterait la série. La série d'un élément en file est celle de la
 * correspondance de sa saison ; une carte simple propose la série retirée. Une correction (« Corriger ») est gardée :
 * elle peut déplacer la synchro vers une autre fiche. Un épisode vu après le retrait la rajoute (comportement voulu).
 * Retourne true si une carte ou un élément a été retiré.
 */
async function dropQueuedSeries(mediaId: number, before: number): Promise<boolean> {
  const mappings = await getMediaMappings();
  const ofSeries = (episode: EpisodeInfo): boolean => mappings[mappingKey(episode)]?.mediaId === mediaId;
  const queued = await removeQueueItemsWhere((item) => item.firstFailedAt < before && ofSeries(item.episode));
  const cards = await deletePendingReviewsWhere((review) => review.previous === null && review.createdAt < before && review.suggestion?.mediaId === mediaId);
  return queued + cards > 0;
}

/**
 * Après un retrait : fiches des onglets (états des listes) oubliées, série retirée de la liste « En cours » en cache
 * des services où elle a été retirée ; si plus aucun service n'est en erreur, carte « À noter » retirée (il n'y a plus
 * rien à noter), ainsi que les synchros en file et les cartes « À vérifier » de la série (dropQueuedSeries). Les
 * correspondances (plateforme → fiche) sont gardées : une synchro ultérieure retrouve la bonne fiche.
 * Ne lève jamais : le retrait est fait, seul l'affichage peut rester en retard jusqu'à la prochaine relecture.
 */
async function afterRemoval(media: MediaRef, results: readonly ServiceResult[], epochs: SessionEpochs, startedAt: number): Promise<void> {
  const removed = results.filter((r) => r.outcome.status === 'updated').map((r) => r.service);
  if (removed.length === 0) return;
  try {
    await forgetCachedPageMedia(media);
    for (const service of removed) {
      const epoch = epochs[service];
      if (epoch !== undefined) await dropCachedWatchingEntry(service, epoch, isSameSeries(media));
    }
    if (results.some((r) => r.outcome.status === 'error')) return;
    const ratings = await removeRatingCards(media);
    const queued = media.mediaId !== null && (await dropQueuedSeries(media.mediaId, startedAt));
    if (ratings || queued) await refreshReviewBadge();
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
    const startedAt = Date.now();
    const epochs = await getOpenSessions();
    const targets = await resolveTargets(media);
    if (targets === null) return { status: 'not-connected' };
    if (targets.length === 0) return { status: 'error', message: t('sync.noServiceFollows') };

    const results = await onServices(targets, 'retrait de la liste', (current, { tracker, id }) => {
      if (current.entry === null) return notInList();
      return async () => {
        await tracker.deleteEntry(id);
        log.info(`✔ ${TRACKER_LABELS[tracker.id]} : ${current.title} retiré de la liste`);
        return { status: 'updated', progress: 0, completed: false };
      };
    }, epochs);
    await afterRemoval(media, results, epochs, startedAt);
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

    const results = await onServices(targets, 'commentaire', (current, { tracker, id }) => {
      if (current.entry === null) return notInList();
      if ((current.notes ?? '') === notes) return { status: 'up-to-date', progress: current.entry.progress };
      return async () => {
        const saved = await tracker.saveNotes(id, notes);
        log.info(`✔ ${TRACKER_LABELS[tracker.id]} : commentaire de ${current.title} ${notes ? 'enregistré' : 'effacé'}`);
        return { status: 'updated', progress: saved.progress, completed: saved.status === 'COMPLETED' };
      };
    }, epochs);
    if (results.some((r) => r.outcome.status === 'updated')) {
      await forgetCachedPageMedia(media).catch((error: unknown) => log.warn('Fiches des onglets non oubliées :', error));
    }
    return { status: 'synced', mediaTitle: media.title, results };
  } catch (error: unknown) {
    return toSyncError(error, t('error.unexpectedNotes'));
  }
}
