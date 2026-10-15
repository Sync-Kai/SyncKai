import { t } from '../../i18n';
import type { AniListErrorCode } from '../../shared/anilist.types';
import { createLogger } from '../../browser/logger';
import type { ResolveReviewPayload } from '../../protocol/messages';
import type { Result } from '../../shared/result';
import type { DeferredEpisode } from '../../shared/review.types';
import { liveServices, pickSessions } from '../../shared/session-epochs';
import { getOpenSessions } from '../../browser/storage/sessions';
import type { SyncOutcome } from '../../shared/sync.types';
import { recordSyncOutcome } from './queue';
import { dismissReview, resolveReview, syncEpisode } from './sync-service';

// Décision sur une carte « À vérifier » (validée ou ignorée), puis épisode mis de côté pendant une correction
// rejoué par la synchro normale (SYNC-07).

const log = createLogger('sync');

/**
 * Rejoue l'épisode mis de côté pendant une correction, une fois la décision écrite et la carte retirée : synchro
 * normale (jamais de recul), seulement sur les sessions de sa synchro encore ouvertes ; un échec passager part en
 * file de relance. Appelé hors de tout verrou (chaque écriture prend celui de sa fiche). Ne lève jamais.
 */
export async function replayDeferredEpisode(deferred: DeferredEpisode | null): Promise<SyncOutcome | null> {
  if (deferred === null) return null;
  try {
    const services = liveServices(deferred.epochs, await getOpenSessions());
    if (services.length === 0) {
      log.info('Épisode mis de côté : sessions fermées depuis, rien n’est rejoué', deferred.episode);
      return null;
    }
    const epochs = pickSessions(deferred.epochs, services);
    const outcome = await syncEpisode(deferred.episode, services, epochs);
    return await recordSyncOutcome(deferred.episode, services, outcome, epochs);
  } catch (error: unknown) {
    log.warn('Épisode mis de côté non rejoué :', error);
    return null;
  }
}

/** « Valider » : choix écrit (échec passager d'une vérification simple mis en file), puis épisode mis de côté rejoué */
export async function confirmReview(payload: ResolveReviewPayload): Promise<SyncOutcome> {
  const { outcome, episode, epochs, deferred } = await resolveReview(payload);
  const recorded = episode !== null ? await recordSyncOutcome(episode, null, outcome, epochs) : outcome;
  await replayDeferredEpisode(deferred);
  return recorded;
}

/** « Ignorer » : carte retirée, puis épisode mis de côté pendant une correction rejoué avec les règles normales */
export async function ignoreReview(key: string): Promise<Result<null, AniListErrorCode>> {
  let deferred: DeferredEpisode | null;
  try {
    deferred = await dismissReview(key);
  } catch (error: unknown) {
    log.error('Vérification non retirée :', error);
    return { ok: false, code: 'API_ERROR', message: t('error.unexpected') };
  }
  await replayDeferredEpisode(deferred);
  return { ok: true, data: null };
}
