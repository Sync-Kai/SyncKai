import { t, type MessageKey } from '../../i18n';
import type { AniListErrorCode } from '../../shared/anilist.types';
import { flashSyncBadge, refreshReviewBadge } from '../../shared/badge';
import type { EpisodeInfo } from '../../shared/episode.types';
import { isExcluded, platformSeriesKey } from '../../shared/exclusions';
import type { ResolveReviewPayload } from '../../shared/messages';
import { platformSeriesUrl } from '../../shared/platform-links';
import { learnPlatformLink } from '../../shared/platform-links-store';
import type { Result } from '../../shared/result';
import type { CandidateSummary, PendingReview } from '../../shared/review.types';
import {
  addRecentSync,
  deletePendingReview,
  getPendingReviews,
  getRecentSyncs,
  saveMediaMapping,
  savePendingReview,
} from '../../shared/storage';
import { isRewatchDeclined } from '../../shared/engagement-store';
import type { MediaRef, SyncPrompts } from '../../shared/engagement.types';
import { getSettings } from '../../shared/settings';
import type { ServiceResult, SyncOutcome } from '../../shared/sync.types';
import { TRACKER_LABELS, type TrackerId } from '../../shared/tracker.types';
import { ApiError } from '../api/errors';
import { getAnimeById, searchAnime } from '../api/media';
import { getConnectedTrackers } from '../trackers';
import type { CatalogMedia, TrackerService } from '../trackers/tracker';
import { mappingFromManualChoice, mappingKey, seasonLabel } from './matching';
import { findReviewCandidates, resolveEpisode, toCandidateSummary } from './resolver';
import { decideListUpdate } from './rules';
import { createLogger } from '../../shared/logger';

const log = createLogger('sync');
const MAX_SEARCH_RESULTS = 10;

const SKIP_REASONS = {
  'already-completed': 'sync.alreadyCompleted',
} as const satisfies Record<string, MessageKey>;

/** Convertit une erreur en résultat affichable (les handlers de messages ne lèvent jamais). */
function toErrorOutcome(error: unknown): SyncOutcome {
  if (error instanceof ApiError) {
    log.error(error.code, error.message);
    return { status: 'error', message: error.message, code: error.code };
  }
  log.error('Erreur inattendue :', error);
  return { status: 'error', message: t('error.unexpectedSync') };
}

function toErrorResult(error: unknown): { ok: false; code: AniListErrorCode; message: string } {
  if (error instanceof ApiError) return { ok: false, code: error.code, message: error.message };
  log.error('Erreur inattendue :', error);
  return { ok: false, code: 'API_ERROR', message: t('error.unexpected') };
}

async function queueReview(review: PendingReview): Promise<void> {
  await savePendingReview(review);
  await refreshReviewBadge();
}

/** Fiche du catalogue AniList (titre, nombre d'épisodes, identifiant MAL) : aucun compte requis. */
export async function getCatalogMedia(mediaId: number): Promise<CatalogMedia> {
  const media = await getAnimeById(mediaId);
  return { mediaId, idMal: media.idMal, title: media.displayTitle, episodes: media.episodes };
}

/** Résultat d'écriture sur un service + fiche déjà terminée (déclenche la proposition de revisionnage) */
interface ServiceWrite {
  result: ServiceResult;
  alreadyCompleted: boolean;
}

/** Applique les règles métier et écrit sur UN service. Ne lève jamais : l'échec est un résultat. */
async function writeToService(
  tracker: TrackerService,
  catalog: CatalogMedia,
  progress: number,
  isCorrection: boolean,
): Promise<ServiceWrite> {
  const label = TRACKER_LABELS[tracker.id];
  const id = tracker.resolveId(catalog);
  if (id === null) return { result: { service: tracker.id, outcome: { status: 'skipped', reason: t('sync.noEquivalent') } }, alreadyCompleted: false };

  try {
    // Lecture fraîche juste avant l'écriture (la liste a pu changer depuis un autre appareil)
    const current = await tracker.getEntry(id);
    // Découpage différent entre services : on n'écrit pas au-delà de la fiche de ce service
    if (current.episodes !== null && progress > current.episodes) {
      return {
        result: {
          service: tracker.id,
          outcome: { status: 'skipped', reason: t('sync.beyondEntry', { progress, total: current.episodes }) },
        },
        alreadyCompleted: false,
      };
    }

    const decision = decideListUpdate(current.entry, progress, current.episodes ?? catalog.episodes, isCorrection);
    if (decision.action === 'skip') {
      log.info(`${label} : pas de mise à jour (${decision.reason})`, current);
      return {
        result: {
          service: tracker.id,
          outcome:
            decision.reason === 'up-to-date'
              ? { status: 'up-to-date', progress: current.entry?.progress ?? progress }
              : { status: 'skipped', reason: t(SKIP_REASONS[decision.reason]) },
        },
        alreadyCompleted: decision.reason === 'already-completed',
      };
    }

    const saved = await tracker.saveProgress(id, decision.progress, decision.status, decision.repeat);
    log.info(`✔ ${label} : ${current.title} → épisode ${saved.progress} (${saved.status})`);
    return {
      result: { service: tracker.id, outcome: { status: 'updated', progress: saved.progress, completed: saved.status === 'COMPLETED' } },
      alreadyCompleted: false,
    };
  } catch (error: unknown) {
    log.error(`${label} : échec`, error);
    return {
      result: {
        service: tracker.id,
        outcome: error instanceof ApiError ? { status: 'error', message: error.message, code: error.code } : { status: 'error', message: t('error.unexpected') },
      },
      alreadyCompleted: false,
    };
  }
}

/**
 * Demandes à afficher après l'écriture : note (série passée en Terminé, si activée) et
 * revisionnage (épisode vu sur une fiche déjà terminée, sauf refus récent). Ne lève jamais.
 */
async function buildPrompts(catalog: CatalogMedia, progress: number, writes: readonly ServiceWrite[]): Promise<SyncPrompts | undefined> {
  try {
    const ref: MediaRef = { mediaId: catalog.mediaId, malId: catalog.idMal, title: catalog.title };
    const prompts: SyncPrompts = {};
    const justCompleted = writes.some(({ result }) => result.outcome.status === 'updated' && result.outcome.completed);
    if (justCompleted && (await getSettings()).ratingPrompt) prompts.rate = ref;
    // Revoir le dernier épisode seul n'est pas un revisionnage : il ne pourrait jamais se terminer
    const isFinale = catalog.episodes !== null && progress >= catalog.episodes;
    if (!isFinale && writes.some((w) => w.alreadyCompleted) && !(await isRewatchDeclined(ref))) prompts.rewatch = { ...ref, progress };
    return prompts.rate || prompts.rewatch ? prompts : undefined;
  } catch (error: unknown) {
    // Demandes facultatives : un échec de lecture du stockage n'affecte pas la synchro
    log.warn('Demandes après synchro indisponibles :', error);
    return undefined;
  }
}

interface WriteOptions {
  isCorrection?: boolean;
  /** Restreint l'écriture à ces services (nouvelle tentative après un échec partiel) */
  only?: readonly TrackerId[] | null;
}

/**
 * Écrit la progression sur chaque service connecté. Commun à la synchro automatique, au choix
 * manuel et à la correction. Seules les écritures réelles alimentent les "dernières synchros".
 */
async function writeToServices(
  key: string,
  episode: EpisodeInfo,
  catalog: CatalogMedia,
  progress: number,
  options: WriteOptions = {},
): Promise<SyncOutcome> {
  const trackers = await getConnectedTrackers(options.only ?? null);
  if (trackers.length === 0) return { status: 'not-connected' };

  const writes = await Promise.all(trackers.map((t) => writeToService(t, catalog, progress, options.isCorrection ?? false)));
  const results = writes.map((w) => w.result);

  if (results.some((r) => r.outcome.status === 'updated')) {
    await addRecentSync({ key, episode, mediaId: catalog.mediaId, mediaTitle: catalog.title, progress, syncedAt: Date.now() });
    // Synchro réussie (correspondance sûre ou confirmée) : page de la série mémorisée au-delà des 5 synchros de l'historique
    const seriesUrl = platformSeriesUrl(episode.platform, episode.seriesId, episode.seriesSlug);
    if (seriesUrl) await learnPlatformLink(catalog.mediaId, { platform: episode.platform, url: seriesUrl });
    // Coche sur l'icône (visible en plein écran) : décorative, ne bloque ni ne fait échouer la synchro
    void flashSyncBadge();
  }
  // Correspondance appliquée pour cette saison : une éventuelle vérification en attente est caduque
  if (results.some((r) => r.outcome.status !== 'error') && (await getPendingReviews()).some((r) => r.key === key)) {
    await deletePendingReview(key);
    await refreshReviewBadge();
  }
  const prompts = await buildPrompts(catalog, progress, writes);
  return { status: 'synced', mediaTitle: catalog.title, results, ...(prompts ? { prompts } : {}) };
}

/**
 * Synchronise un épisode terminé avec les services connectés (tous, ou `only` après un échec partiel).
 * La correspondance passe toujours par le catalogue AniList, même sans compte AniList. Ne lève jamais.
 */
export async function syncEpisode(episode: EpisodeInfo, only: readonly TrackerId[] | null = null): Promise<SyncOutcome> {
  try {
    if ((await getConnectedTrackers(only)).length === 0) return { status: 'not-connected' };
    // Série exclue côté plateforme (filet de sécurité : le content script vérifie déjà avant l'envoi)
    if (await isExcluded({ platformKey: platformSeriesKey(episode) })) {
      log.info('Série exclue (plateforme) : rien n’est écrit', episode);
      return { status: 'excluded', mediaTitle: episode.animeTitle };
    }
    const key = mappingKey(episode);
    const { result, candidates } = await resolveEpisode(episode);

    // Plateforme généraliste (Netflix) : série sans fiche AniList liée ni au même titre, probablement pas un anime.
    // Ni carte de vérification ni entrée au journal (info, pas warn) : le content script n'affiche rien.
    if (!result.ok && result.ignored) {
      log.info('Série ignorée (aucune fiche AniList liée) :', episode.animeTitle);
      return { status: 'ignored' };
    }

    if (!result.ok ||result.target.confidence === 'low') {
      // Fiche suggérée exclue : pas de carte de vérification pour une série que l'utilisateur ignore
      if (result.ok && (await isExcluded({ mediaId: result.target.mediaId }))) {
        log.info(`Fiche suggérée ${result.target.mediaId} exclue : aucune vérification créée`);
        return { status: 'excluded', mediaTitle: episode.animeTitle };
      }
      const reason = result.ok ? result.target.reason : result.reason;
      log.warn('Correspondance incertaine :', reason, episode);
      await queueReview({
        key,
        episode,
        reason,
        suggestion: result.ok ? { mediaId: result.target.mediaId, progress: result.target.progress } : null,
        candidates,
        previous: null,
        createdAt: Date.now(),
      });
      return { status: 'needs-review', reason };
    }

    const { target } = result;
    log.info(`Fiche ${target.mediaId}, progression ${target.progress} : ${target.reason}`);
    const catalog = await getCatalogMedia(target.mediaId);
    if (await isExcluded({ mediaId: target.mediaId })) {
      log.info(`Fiche ${target.mediaId} exclue : rien n’est écrit`);
      return { status: 'excluded', mediaTitle: catalog.title };
    }
    return await writeToServices(key, episode, catalog, target.progress, { only });
  } catch (error: unknown) {
    return toErrorOutcome(error);
  }
}

/** Choix manuel depuis le popup : mémorise la correspondance pour la saison puis synchronise. */
export async function resolveReview({ key, mediaId, progress }: ResolveReviewPayload): Promise<SyncOutcome> {
  try {
    const review = (await getPendingReviews()).find((r) => r.key === key);
    if (!review) return { status: 'error', message: t('sync.reviewGone') };

    const catalog = await getCatalogMedia(mediaId);
    const mapping = mappingFromManualChoice(review.episode, mediaId, progress, catalog.episodes);
    if (!mapping) {
      return { status: 'error', message: t('sync.invalidEpisode', { progress, title: catalog.title, total: catalog.episodes ?? '?' }) };
    }

    await saveMediaMapping(key, { ...mapping, seriesLabel: seasonLabel(review.episode), mediaTitle: catalog.title });
    log.info(`Correspondance manuelle enregistrée pour ${key} :`, mapping);
    // Correction sur la fiche déjà utilisée : la valeur choisie remplace celle écrite (même plus basse)
    const isCorrection = review.previous?.mediaId === mediaId;
    return await writeToServices(key, review.episode, catalog, progress, { isCorrection });
  } catch (error: unknown) {
    return toErrorOutcome(error);
  }
}

/** "Corriger" une synchro passée : rouvre une carte de vérification avec les fiches candidates. */
export async function reopenReview(key: string): Promise<Result<null, AniListErrorCode | 'NOT_FOUND'>> {
  try {
    const recent = (await getRecentSyncs()).find((s) => s.key === key);
    if (!recent) return { ok: false, code: 'NOT_FOUND', message: t('sync.recentNotFound') };

    let candidates: CandidateSummary[] = await findReviewCandidates(recent.episode, recent.mediaId);
    // La fiche actuelle doit rester sélectionnable, même si la recherche ne la renvoie plus
    if (!candidates.some((c) => c.id === recent.mediaId)) {
      candidates = [{ id: recent.mediaId, title: recent.mediaTitle, format: null, episodes: null, year: null, coverUrl: null }, ...candidates];
    }

    await queueReview({
      key,
      episode: recent.episode,
      reason: t('sync.correctionReason', { title: recent.mediaTitle }),
      suggestion: { mediaId: recent.mediaId, progress: recent.progress },
      candidates,
      previous: { mediaId: recent.mediaId, title: recent.mediaTitle, progress: recent.progress },
      createdAt: Date.now(),
    });
    return { ok: true, data: null };
  } catch (error: unknown) {
    return toErrorResult(error);
  }
}

/** Recherche libre depuis une carte de vérification. */
export async function searchCandidates(query: string): Promise<Result<CandidateSummary[], AniListErrorCode>> {
  try {
    const media = await searchAnime(query.trim());
    return { ok: true, data: media.filter((m) => m.format !== 'MUSIC').slice(0, MAX_SEARCH_RESULTS).map(toCandidateSummary) };
  } catch (error: unknown) {
    return toErrorResult(error);
  }
}
