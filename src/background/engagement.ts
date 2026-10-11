import { t } from '../i18n';
import type { AniListErrorCode } from '../shared/anilist.types';
import { refreshReviewBadge } from '../shared/badge';
import { addPendingRating, getPendingRatings, isRatingSettled, isSafeCoverUrl, recordRewatchDecline, removePendingRating } from '../shared/engagement-store';
import { mediaRefId, type MediaRef, type Score10 } from '../shared/engagement.types';
import type { Result } from '../shared/result';
import { sessionsOf, type SessionEpochs } from '../shared/session-epochs';
import { getOpenSessions, isSessionOpen } from '../shared/storage';
import type { ServiceOutcome, ServiceResult, SyncOutcome } from '../shared/sync.types';
import { TRACKER_LABELS } from '../shared/tracker.types';
import { ApiError } from './api/errors';
import { withEntryLock } from './sync/entry-lock';
import { getConnectedTrackers } from './trackers';
import type { TrackerEntry, TrackerService } from './trackers/tracker';
import { createLogger } from '../shared/logger';

// Engagement (service worker) : note de fin de série et revisionnage, sur tous les services connectés.

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

function toErrorOutcome(error: unknown): ServiceOutcome {
  return error instanceof ApiError ? { status: 'error', message: error.message, code: error.code } : { status: 'error', message: t('error.unexpected') };
}

function toSyncError(error: unknown, fallback: string): SyncOutcome {
  if (error instanceof ApiError) return { status: 'error', message: error.message, code: error.code };
  log.error('Erreur inattendue :', error);
  return { status: 'error', message: fallback };
}

/**
 * Lecture fraîche puis action sur UN service ; `act` renvoie un saut (raison) ou l'écriture. Lecture et écriture
 * sous le verrou de la fiche : le revisionnage décidé sur « Terminé » n'écrase pas une synchro concurrente. Ne lève jamais.
 * `epochs` : sessions auxquelles appartient l'action (carte « À noter ») ; rien n'est écrit sur une session fermée.
 */
async function onService(
  { tracker, id }: Target,
  act: (current: TrackerEntry) => string | (() => Promise<ServiceOutcome>),
  epochs: SessionEpochs | null = null,
): Promise<ServiceResult> {
  const sessionClosed: ServiceResult = { service: tracker.id, outcome: { status: 'skipped', reason: t('sync.sessionClosed') } };
  const open = async (): Promise<boolean> => epochs === null || (await isSessionOpen(tracker.id, epochs[tracker.id]));
  try {
    if (!(await open())) return sessionClosed;
    return await withEntryLock(tracker.id, id, async (): Promise<ServiceResult> => {
      const step = act(await tracker.getEntry(id));
      if (typeof step === 'string') return { service: tracker.id, outcome: { status: 'skipped', reason: step } };
      // Déconnexion (puis autre compte) pendant la lecture : rien n'est écrit
      if (!(await open())) return sessionClosed;
      return { service: tracker.id, outcome: await step() };
    });
  } catch (error: unknown) {
    log.error(`${TRACKER_LABELS[tracker.id]} : échec`, error);
    return { service: tracker.id, outcome: toErrorOutcome(error) };
  }
}

/**
 * Écrit la note sur chaque service où la série est dans la liste, puis retire la carte « À noter ». Depuis la carte
 * (`fromCard`) : seulement sur les sessions où elle a été créée, jamais sur un compte connecté depuis.
 */
export async function rateMedia(media: MediaRef, score: Score10, fromCard = false): Promise<SyncOutcome> {
  try {
    const card = fromCard ? (await getPendingRatings()).find((r) => r.id === mediaRefId(media)) : undefined;
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
    if (isRatingSettled(results) && (await removePendingRating(mediaRefId(media)))) {
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
    const cover = isSafeCoverUrl(coverUrl) ? coverUrl : null;
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
          if (current.episodes !== null && progress > current.episodes) return t('sync.beyondEntry', { progress, total: current.episodes });
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
