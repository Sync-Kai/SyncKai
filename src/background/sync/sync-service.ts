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
import { sessionsOf, type SessionEpochs } from '../../shared/session-epochs';
import {
  addRecentSync,
  deleteMediaMapping,
  deletePendingReview,
  getOpenSessions,
  getPendingReviews,
  getRecentSyncs,
  isSessionOpen,
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
import { mappingFromManualChoice, mappingKey, seasonLabel, type ResolveResult, type SyncTarget } from './matching';
import { findReviewCandidates, resolveEpisode, toCandidateSummary } from './resolver';
import { withEntryLock } from './entry-lock';
import { decideListUpdate, type ListEntryState } from './rules';
import { createLogger } from '../../shared/logger';

const log = createLogger('sync');
const MAX_SEARCH_RESULTS = 10;

const SKIP_REASONS = {
  'already-completed': 'sync.alreadyCompleted',
} as const satisfies Record<string, MessageKey>;

/** Erreur d'API sous forme de résultat (statut HTTP compris : il décide de la relance, voir queue-policy) */
function apiErrorOutcome(error: ApiError): { status: 'error'; message: string; code: AniListErrorCode; httpStatus?: number } {
  return { status: 'error', message: error.message, code: error.code, ...(error.httpStatus !== null ? { httpStatus: error.httpStatus } : {}) };
}

/** Fiche introuvable (404) : supprimée ou fusionnée sur AniList, identifiant erroné sur MAL */
function isNotFound(error: unknown): boolean {
  return error instanceof ApiError && error.httpStatus === 404;
}

/** Convertit une erreur en résultat affichable (les handlers de messages ne lèvent jamais). */
function toErrorOutcome(error: unknown): SyncOutcome {
  if (error instanceof ApiError) {
    log.error(error.code, error.message);
    return apiErrorOutcome(error);
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

/** Résultat d'écriture sur un service et état de l'entrée lue avant l'écriture */
export interface ServiceWrite {
  result: ServiceResult;
  /** Fiche déjà terminée (déclenche la proposition de revisionnage) */
  alreadyCompleted: boolean;
  /** L'entrée portait déjà une note : aucune demande de note */
  scored: boolean;
  /** L'entrée était en revisionnage : sa fin ne redemande pas de note */
  wasRepeating: boolean;
}

function serviceWrite(result: ServiceResult, entry: ListEntryState | null = null, alreadyCompleted = false): ServiceWrite {
  return { result, alreadyCompleted, scored: entry?.score !== undefined, wasRepeating: entry?.status === 'REPEATING' };
}

/** Écriture refusée : la donnée appartient à une session fermée depuis (autre compte, ou compte reconnecté) */
function sessionClosed(service: TrackerId): ServiceWrite {
  return serviceWrite({ service, outcome: { status: 'skipped', reason: t('sync.sessionClosed') } });
}

/**
 * Applique les règles métier et écrit sur UN service. Ne lève jamais : l'échec est un résultat.
 * `correctionFrom` : progression écrite par la synchro corrigée (« Corriger »), null hors correction.
 * `epoch` : session du service à laquelle appartient l'écriture (rien n'est écrit si elle est fermée depuis).
 */
async function writeToService(
  tracker: TrackerService,
  catalog: CatalogMedia,
  progress: number,
  correctionFrom: number | null,
  epoch: number | undefined,
): Promise<ServiceWrite> {
  const label = TRACKER_LABELS[tracker.id];
  const id = tracker.resolveId(catalog);
  if (id === null) return serviceWrite({ service: tracker.id, outcome: { status: 'skipped', reason: t('sync.noEquivalent') } });
  if (!(await isSessionOpen(tracker.id, epoch))) return sessionClosed(tracker.id);

  try {
    // Lecture, décision et écriture sous le verrou de la fiche : une relance de la file ou un +1 concurrent ne peut
    // ni faire reculer la progression ni perdre une écriture (voir entry-lock.ts)
    return await withEntryLock(tracker.id, id, () => writeEntry(tracker, id, catalog, progress, correctionFrom, epoch));
  } catch (error: unknown) {
    log.error(`${label} : échec`, error);
    return serviceWrite({
      service: tracker.id,
      outcome: error instanceof ApiError ? apiErrorOutcome(error) : { status: 'error', message: t('error.unexpected') },
    });
  }
}

/** Relecture, règles métier puis écriture sur la fiche `id` (appelé sous son verrou). Lève les erreurs d'API. */
async function writeEntry(
  tracker: TrackerService,
  id: number,
  catalog: CatalogMedia,
  progress: number,
  correctionFrom: number | null,
  epoch: number | undefined,
): Promise<ServiceWrite> {
  const label = TRACKER_LABELS[tracker.id];
  // Lecture fraîche juste avant l'écriture (la liste a pu changer depuis un autre appareil)
  const current = await tracker.getEntry(id);
  // Découpage différent entre services : on n'écrit pas au-delà de la fiche de ce service
  if (current.episodes !== null && progress > current.episodes) {
    return serviceWrite({ service: tracker.id, outcome: { status: 'skipped', reason: t('sync.beyondEntry', { progress, total: current.episodes }) } }, current.entry);
  }

  // Une correction (écriture vers le bas permise) ne vaut que sur la valeur écrite par la synchro corrigée : si la
  // progression a changé depuis (autre épisode, autre appareil, carte importée d'une sauvegarde), règles normales,
  // qui ne font jamais reculer la liste
  const isCorrection = correctionFrom !== null && current.entry?.progress === correctionFrom;
  const outdatedCorrection = correctionFrom !== null && !isCorrection;
  const decision = decideListUpdate(current.entry, progress, current.episodes ?? catalog.episodes, isCorrection);
  if (decision.action === 'skip') {
    log.info(`${label} : pas de mise à jour (${decision.reason})`, current);
    if (outdatedCorrection && current.entry !== null && current.entry.progress !== progress) {
      return serviceWrite({ service: tracker.id, outcome: { status: 'skipped', reason: t('sync.correctionOutdated', { progress: current.entry.progress }) } }, current.entry);
    }
    return serviceWrite(
      {
        service: tracker.id,
        outcome:
          decision.reason === 'up-to-date'
            ? { status: 'up-to-date', progress: current.entry?.progress ?? progress }
            : { status: 'skipped', reason: t(SKIP_REASONS[decision.reason]) },
      },
      current.entry,
      decision.reason === 'already-completed',
    );
  }

  // Déconnexion (puis autre compte) pendant la lecture ou l'attente du verrou : la décision vaut pour l'ancienne session
  if (!(await isSessionOpen(tracker.id, epoch))) return sessionClosed(tracker.id);
  const saved = await tracker.saveProgress(id, decision.progress, decision.status, decision.repeat);
  log.info(`✔ ${label} : ${current.title} → épisode ${saved.progress} (${saved.status})`);
  return serviceWrite({ service: tracker.id, outcome: { status: 'updated', progress: saved.progress, completed: saved.status === 'COMPLETED' } }, current.entry);
}

/**
 * Demande de note après la synchro (pur, testable) : la série vient de passer en Terminé sur un service, aucune
 * entrée n'est déjà notée ni n'était en revisionnage, et la fiche AniList est terminée (une fiche MAL découpée
 * plus court qui se termine seule ne termine pas la série).
 */
export function shouldPromptRating(catalog: Pick<CatalogMedia, 'episodes'>, progress: number, writes: readonly ServiceWrite[]): boolean {
  const justCompleted = writes.some(({ result }) => result.outcome.status === 'updated' && result.outcome.completed);
  if (!justCompleted || writes.some((w) => w.scored || w.wasRepeating)) return false;
  return catalog.episodes === null || progress >= catalog.episodes;
}

/**
 * Demandes à afficher après l'écriture : note (série passée en Terminé, si activée) et
 * revisionnage (épisode vu sur une fiche déjà terminée, sauf refus récent). Ne lève jamais.
 */
async function buildPrompts(catalog: CatalogMedia, progress: number, writes: readonly ServiceWrite[]): Promise<SyncPrompts | undefined> {
  try {
    const ref: MediaRef = { mediaId: catalog.mediaId, malId: catalog.idMal, title: catalog.title };
    const prompts: SyncPrompts = {};
    if (shouldPromptRating(catalog, progress, writes) && (await getSettings()).ratingPrompt) prompts.rate = ref;
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
  /** Sessions auxquelles appartient l'écriture : un service dont la session a changé depuis n'est pas écrit */
  epochs: SessionEpochs;
  /** Correction : progression écrite par la synchro corrigée (voir writeEntry) */
  correctionFrom?: number | null;
  /** Restreint l'écriture à ces services (nouvelle tentative après un échec partiel) */
  only?: readonly TrackerId[] | null;
  /** Carte de vérification confirmée par l'utilisateur (voir settleReviewCard) */
  confirmed?: PendingReview;
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
  options: WriteOptions,
): Promise<SyncOutcome> {
  const trackers = await getConnectedTrackers(options.only ?? null);
  if (trackers.length === 0) return { status: 'not-connected' };

  const writes = await Promise.all(trackers.map((tr) => writeToService(tr, catalog, progress, options.correctionFrom ?? null, options.epochs[tr.id])));
  const results = writes.map((w) => w.result);

  if (results.some((r) => r.outcome.status === 'updated')) {
    await addRecentSync({ key, episode, mediaId: catalog.mediaId, mediaTitle: catalog.title, progress, syncedAt: Date.now(), epochs: options.epochs });
    // Synchro réussie (correspondance sûre ou confirmée) : page de la série mémorisée au-delà des 5 synchros de l'historique
    const seriesUrl = platformSeriesUrl(episode.platform, episode.seriesId, episode.seriesSlug);
    if (seriesUrl) await learnPlatformLink(catalog.mediaId, { platform: episode.platform, url: seriesUrl });
    // Coche sur l'icône (visible en plein écran) : décorative, ne bloque ni ne fait échouer la synchro
    void flashSyncBadge();
  }
  await settleReviewCard(key, results, options.confirmed ?? null);
  const prompts = await buildPrompts(catalog, progress, writes);
  return { status: 'synced', mediaTitle: catalog.title, results, ...(prompts ? { prompts } : {}) };
}

/**
 * Carte de vérification de la saison après une écriture :
 * - synchro automatique : une vérification simple est caduque (correspondance appliquée) ; une correction
 *   ouverte par l'utilisateur (« Corriger ») reste, elle seule décide de la fiche
 * - carte confirmée : supprimée si un service a été écrit ; une correction reste tant qu'un service est en
 *   erreur (un nouvel essai la rejoue : le service déjà corrigé est alors à jour)
 */
async function settleReviewCard(key: string, results: readonly ServiceResult[], confirmed: PendingReview | null): Promise<void> {
  const card = (await getPendingReviews()).find((r) => r.key === key);
  if (!card) return;
  const failed = results.some((r) => r.outcome.status === 'error');
  const applied = results.some((r) => r.outcome.status !== 'error');
  const obsolete = confirmed === null ? card.previous === null && applied : confirmed.previous === null ? applied : !failed;
  if (!obsolete) return;
  await deletePendingReview(key);
  await refreshReviewBadge();
}

interface SyncResolution {
  result: ResolveResult;
  candidates: CandidateSummary[];
  /** Fiche du catalogue de la cible fiable, null si une vérification est nécessaire */
  catalog: CatalogMedia | null;
}

function reliableTarget(result: ResolveResult): SyncTarget | null {
  return result.ok && result.target.confidence === 'high' ? result.target : null;
}

/**
 * Correspondance en cache confrontée au catalogue AniList : null (correspondance oubliée) si la fiche n'existe plus
 * (404 : supprimée ou fusionnée) ou s'arrête avant l'épisode (total publié après la mise en cache, suite créée en
 * fiche séparée « Part 2 »). Un total inconnu à la mise en cache (fiche en diffusion) est complété.
 */
async function revalidateCachedTarget(key: string, target: SyncTarget): Promise<CatalogMedia | null> {
  let catalog: CatalogMedia;
  try {
    catalog = await getCatalogMedia(target.mediaId);
  } catch (error: unknown) {
    if (!isNotFound(error)) throw error;
    log.warn(`Fiche ${target.mediaId} introuvable sur AniList : correspondance ${key} oubliée`);
    await deleteMediaMapping(key);
    return null;
  }
  if (catalog.episodes !== null && target.progress > catalog.episodes) {
    log.warn(`Épisode ${target.progress} au-delà des ${catalog.episodes} épisodes de la fiche ${target.mediaId} : correspondance ${key} oubliée`);
    await deleteMediaMapping(key);
    return null;
  }
  if (target.episodes === null && catalog.episodes !== null) {
    const { mediaId, numbering, offset, seriesLabel, mediaTitle } = target;
    await saveMediaMapping(key, {
      mediaId,
      numbering,
      offset,
      episodes: catalog.episodes,
      ...(seriesLabel !== undefined ? { seriesLabel } : {}),
      ...(mediaTitle !== undefined ? { mediaTitle } : {}),
    });
  }
  return catalog;
}

/** Résolution de la fiche, puis catalogue de la cible fiable ; une correspondance en cache caduque est résolue à nouveau (une fois). */
async function resolveForSync(episode: EpisodeInfo, key: string): Promise<SyncResolution> {
  const first = await resolveEpisode(episode);
  const target = reliableTarget(first.result);
  if (target === null) return { result: first.result, candidates: first.candidates, catalog: null };
  if (!target.fromCache) return { result: first.result, candidates: first.candidates, catalog: await getCatalogMedia(target.mediaId) };

  const catalog = await revalidateCachedTarget(key, target);
  if (catalog !== null) return { result: first.result, candidates: first.candidates, catalog };
  const second = await resolveEpisode(episode);
  const fresh = reliableTarget(second.result);
  return { result: second.result, candidates: second.candidates, catalog: fresh ? await getCatalogMedia(fresh.mediaId) : null };
}

/**
 * Synchronise un épisode terminé avec les services connectés (tous, ou `only` après un échec partiel).
 * La correspondance passe toujours par le catalogue AniList, même sans compte AniList. Ne lève jamais.
 * `epochs` : sessions de l'épisode (relance de la file), sinon celles ouvertes maintenant.
 */
export async function syncEpisode(episode: EpisodeInfo, only: readonly TrackerId[] | null = null, epochs?: SessionEpochs): Promise<SyncOutcome> {
  try {
    const sessions = epochs ?? (await getOpenSessions());
    if ((await getConnectedTrackers(only)).length === 0) return { status: 'not-connected' };
    // Série exclue côté plateforme (filet de sécurité : le content script vérifie déjà avant l'envoi)
    if (await isExcluded({ platformKey: platformSeriesKey(episode) })) {
      log.info('Série exclue (plateforme) : rien n’est écrit', episode);
      return { status: 'excluded', mediaTitle: episode.animeTitle };
    }
    const key = mappingKey(episode);
    const { result, candidates, catalog } = await resolveForSync(episode, key);

    // Plateforme généraliste (Netflix) : série sans fiche AniList liée ni au même titre, probablement pas un anime.
    // Ni carte de vérification ni entrée au journal (info, pas warn) : le content script n'affiche rien.
    if (!result.ok && result.ignored) {
      log.info('Série ignorée (aucune fiche AniList liée) :', episode.animeTitle);
      return { status: 'ignored' };
    }

    // Correction (« Corriger ») en attente pour la saison : rien n'est écrit sur la fiche contestée, et la carte
    // n'est pas remplacée par une vérification simple ; l'utilisateur valide ou ignore d'abord la correction
    const correction = (await getPendingReviews()).find((r) => r.key === key && r.previous !== null);
    if (correction?.previous && (catalog === null || catalog.mediaId === correction.previous.mediaId)) {
      log.info(`Correction en attente pour ${key} : épisode non écrit`, episode);
      return { status: 'needs-review', reason: t('sync.correctionPending') };
    }

    if (!result.ok || catalog === null) {
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
    if (await isExcluded({ mediaId: target.mediaId })) {
      log.info(`Fiche ${target.mediaId} exclue : rien n’est écrit`);
      return { status: 'excluded', mediaTitle: catalog.title };
    }
    return await writeToServices(key, episode, catalog, target.progress, { only, epochs: sessions });
  } catch (error: unknown) {
    return toErrorOutcome(error);
  }
}

/** Résultat d'une vérification confirmée */
export interface ReviewResolution {
  outcome: SyncOutcome;
  /**
   * Épisode à confier à la file de relance (recordSyncOutcome), comme une synchro en direct : vérification simple
   * écrite (au moins en partie). null sinon : erreur globale (la carte reste) ou correction (la carte reste tant
   * qu'un service est en erreur ; une relance automatique n'appliquerait que les règles normales).
   */
  episode: EpisodeInfo | null;
  /** Sessions de l'écriture (mise en file de l'épisode) */
  epochs: SessionEpochs;
}

/** Choix manuel depuis le popup : mémorise la correspondance pour la saison puis synchronise. */
export async function resolveReview({ key, mediaId, progress }: ResolveReviewPayload): Promise<ReviewResolution> {
  let epochs: SessionEpochs = {};
  try {
    const current = await getOpenSessions();
    epochs = current;
    const review = (await getPendingReviews()).find((r) => r.key === key);
    if (!review) return { outcome: { status: 'error', message: t('sync.reviewGone') }, episode: null, epochs };
    // Correction : seulement sur les sessions de la synchro corrigée (la valeur à corriger n'existe que là)
    if (review.previous !== null) epochs = sessionsOf(review.epochs, current);

    const catalog = await getCatalogMedia(mediaId);
    const mapping = mappingFromManualChoice(review.episode, mediaId, progress, catalog.episodes);
    if (!mapping) {
      return { outcome: { status: 'error', message: t('sync.invalidEpisode', { progress, title: catalog.title, total: catalog.episodes ?? '?' }) }, episode: null, epochs };
    }

    await saveMediaMapping(key, { ...mapping, seriesLabel: seasonLabel(review.episode), mediaTitle: catalog.title });
    log.info(`Correspondance manuelle enregistrée pour ${key} :`, mapping);
    // Correction sur la fiche déjà utilisée : la valeur choisie remplace celle écrite (même plus basse), seulement
    // sur un service resté à la progression écrite par la synchro corrigée (voir writeEntry)
    const correctionFrom = review.previous !== null && review.previous.mediaId === mediaId ? review.previous.progress : null;
    const outcome = await writeToServices(key, review.episode, catalog, progress, { correctionFrom, confirmed: review, epochs });
    return { outcome, episode: outcome.status === 'synced' && review.previous === null ? review.episode : null, epochs };
  } catch (error: unknown) {
    return { outcome: toErrorOutcome(error), episode: null, epochs };
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
      // La correction ne vaut que sur les sessions où la synchro a écrit
      epochs: sessionsOf(recent.epochs, await getOpenSessions()),
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
