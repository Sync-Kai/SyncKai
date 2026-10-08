import { t } from '../i18n';
import { refreshReviewBadge } from '../shared/badge';
import {
  buildCrImportPlan,
  CR_IMPORT_ALARM,
  CR_IMPORT_KEYS,
  decideImport,
  FINALIZE_ITEM,
  isCrImportInput,
  isCrImportJob,
  isCrImportPlan,
  readResolutions,
  seasonIndexOf,
  startAnalyzeJob,
  startApplyJob,
  toEpisodeInfo,
  withItemResult,
  withReviewsCreated,
  type CrCatalogEntry,
  type CrImportAnalyzePayload,
  type CrImportApplyPayload,
  type CrImportErrorCode,
  type CrImportInput,
  type CrImportJob,
  type CrImportJobResult,
  type CrImportPlan,
  type CrImportReviewsPayload,
  type CrImportReviewsResult,
  type CrItemResult,
  type CrListState,
  type CrPlanItem,
  type SeasonResolution,
} from '../shared/cr-import';
import type { HistorySeason } from '../shared/cr-history';
import { getExcludedSeries, isExcluded, platformSeriesKey } from '../shared/exclusions';
import { isJobActive, reduceJob } from '../shared/job';
import { createLogger } from '../shared/logger';
import type { Result } from '../shared/result';
import { getMediaMapping, getPendingReviews, MAX_PENDING_REVIEWS, saveMediaMapping, savePendingReview, withStorageLock } from '../shared/storage';
import { TRACKER_LABELS, type TrackerId } from '../shared/tracker.types';
import { ApiError } from './api/errors';
import { getAnimeByIds } from './api/media';
import { fetchAniListFullList, fetchMalFullList } from './compare';
import { createJobLoop, createJobStore, isFatalError, transientKind, waitReadSlot, waitWriteSlot, type StepResult, type TransientKind } from './jobs/runner';
import { mappingKey, seasonLabel } from './sync/matching';
import { resolveEpisode } from './sync/resolver';
import { getConnectedTrackers } from './trackers';

// Import de l'historique Crunchyroll : analyse (correspondance de chaque saison, sans rien écrire) puis
// application des éléments choisis dans l'aperçu. Deux tâches reprenables (src/background/jobs/runner.ts).
// L'historique lui-même est lu par le script de contenu de l'onglet Crunchyroll : aucun jeton Crunchyroll ici.

const log = createLogger('cr-import');

const jobStore = createJobStore(CR_IMPORT_KEYS.job, isCrImportJob);

// ─── Stockage ─────────────────────────────────────────────────────────────

async function readKey(key: string): Promise<unknown> {
  return (await chrome.storage.local.get(key))[key];
}

async function readInput(): Promise<CrImportInput | null> {
  const value = await readKey(CR_IMPORT_KEYS.input);
  return isCrImportInput(value) ? value : null;
}

async function readPlan(): Promise<CrImportPlan | null> {
  const value = await readKey(CR_IMPORT_KEYS.plan);
  return isCrImportPlan(value) ? value : null;
}

function updatePlan(update: (plan: CrImportPlan) => CrImportPlan): Promise<void> {
  return withStorageLock(async () => {
    const plan = await readPlan();
    if (plan) await chrome.storage.local.set({ [CR_IMPORT_KEYS.plan]: update(plan) });
  });
}

function writeResolution(index: number, resolution: SeasonResolution): Promise<void> {
  return withStorageLock(async () => {
    const resolutions = readResolutions(await readKey(CR_IMPORT_KEYS.resolutions));
    await chrome.storage.local.set({ [CR_IMPORT_KEYS.resolutions]: { ...resolutions, [String(index)]: resolution } });
  });
}

// ─── Analyse : correspondance d'une saison ────────────────────────────────

/**
 * Correspondance d'une saison, sans rien écrire (cache des correspondances lu, jamais modifié).
 * Même résolveur que la synchro en direct : une saison sûre ici l'aurait été sur la page de lecture.
 */
async function resolveSeason(season: HistorySeason): Promise<SeasonResolution> {
  const episode = toEpisodeInfo(season);
  const key = mappingKey(episode);
  if (await isExcluded({ platformKey: platformSeriesKey(episode) })) return { kind: 'excluded', key };

  const cached = await getMediaMapping(key);
  // Requêtes de fond : budget AniList partagé (popup et synchro en direct prioritaires, voir api/rate-limit.ts)
  const { result, candidates } = await resolveEpisode(episode, { persist: false, lane: 'background' });
  if (result.ok && (await isExcluded({ mediaId: result.target.mediaId }))) return { kind: 'excluded', key };

  // Position dans la saison inconnue (saison retirée du catalogue) : seul un numéro affiché déjà appris est fiable
  const numbersKnown = season.seasonEpisodeNumber !== null || cached?.numbering === 'displayed';
  if (!result.ok || result.target.confidence === 'low' || !numbersKnown) {
    const reason = !result.ok ? result.reason : numbersKnown ? result.target.reason : t('crImport.reason.numbering');
    return { kind: 'review', key, reason, suggestion: result.ok ? { mediaId: result.target.mediaId, progress: result.target.progress } : null, candidates };
  }
  const { mediaId, numbering, offset, episodes, progress } = result.target;
  return { kind: 'certain', key, mediaId, progress, mapping: { mediaId, numbering, offset, episodes, seriesLabel: seasonLabel(episode) } };
}

const itemEvent = (outcome: 'updated' | 'skipped' | 'failed', message?: string): StepResult => ({
  kind: 'event',
  event: { type: 'item', outcome, ...(message ? { message } : {}), at: Date.now() },
  stop: null,
});
const stopStep = (message: string): StepResult => ({ kind: 'event', event: { type: 'stop', message, at: Date.now() }, stop: message });

/** Erreur → nouvelle tentative (passagère) ou message définitif */
function errorStep(error: unknown, service: TrackerId | null, isLastAttempt: (reason: TransientKind) => boolean): { retry: StepResult } | { message: string; fatal: boolean } {
  const message = error instanceof ApiError ? error.message : t('error.unexpected');
  const transient = transientKind(error);
  if (transient !== null && !isLastAttempt(transient)) return { retry: { kind: 'retry', reason: transient, service, error: message } };
  if (!(error instanceof ApiError)) log.error('Erreur inattendue (import Crunchyroll) :', error);
  return { message, fatal: isFatalError(error) };
}

async function analyzeSeason(index: number, isLastAttempt: (reason: TransientKind) => boolean): Promise<StepResult> {
  const input = await readInput();
  if (!input) return stopStep(t('crImport.error.noHistory'));
  const season = input.seasons[index];
  if (!season) return itemEvent('skipped');
  try {
    const resolution = await resolveSeason(season);
    await writeResolution(index, resolution);
    return itemEvent(resolution.kind === 'certain' ? 'updated' : 'skipped');
  } catch (error: unknown) {
    const step = errorStep(error, 'anilist', isLastAttempt);
    if ('retry' in step) return step.retry;
    log.warn(`Recherche impossible pour ${season.seriesTitle} :`, step.message);
    await writeResolution(index, { kind: 'failed', key: mappingKey(toEpisodeInfo(season)), message: step.message });
    return { kind: 'event', event: { type: 'item', outcome: 'failed', message: step.message, at: Date.now() }, stop: step.fatal ? step.message : null };
  }
}

// ─── Analyse : aperçu (catalogue + listes lues en bloc) ───────────────────

const CATALOG_CHUNK = 50;

async function readCatalog(mediaIds: readonly number[]): Promise<Map<number, CrCatalogEntry>> {
  const catalog = new Map<number, CrCatalogEntry>();
  for (let i = 0; i < mediaIds.length; i += CATALOG_CHUNK) {
    for (const media of await getAnimeByIds(mediaIds.slice(i, i + CATALOG_CHUNK), 'background')) {
      catalog.set(media.id, { mediaId: media.id, idMal: media.idMal, title: media.displayTitle, coverUrl: media.coverUrl, episodes: media.episodes });
    }
  }
  return catalog;
}

/** Liste complète d'un service → état par identifiant (première occurrence : listes personnalisées en double) */
async function readList(service: TrackerId): Promise<Map<number, CrListState>> {
  const entries = service === 'anilist' ? (await fetchAniListFullList()).map((e) => ({ id: e.mediaId, status: e.status, progress: e.progress })) : (await fetchMalFullList()).map((e) => ({ id: e.malId, status: e.status, progress: e.progress }));
  const list = new Map<number, CrListState>();
  for (const { id, status, progress } of entries) if (!list.has(id)) list.set(id, { status, progress });
  return list;
}

async function finalize(isLastAttempt: (reason: TransientKind) => boolean): Promise<StepResult> {
  const input = await readInput();
  if (!input) return stopStep(t('crImport.error.noHistory'));
  const services = (await getConnectedTrackers()).map((tr) => tr.id);
  if (services.length === 0) return stopStep(t('crImport.error.notConnected'));
  try {
    const resolutions = readResolutions(await readKey(CR_IMPORT_KEYS.resolutions));
    const mediaIds = [...new Set(Object.values(resolutions).flatMap((r) => (r.kind === 'certain' ? [r.mediaId] : [])))];
    const catalog = await readCatalog(mediaIds);
    const lists: Partial<Record<TrackerId, Map<number, CrListState>>> = {};
    for (const service of services) lists[service] = await readList(service);
    const excludedMediaIds = new Set((await getExcludedSeries()).flatMap((e) => (e.mediaId !== null ? [e.mediaId] : [])));
    const plan = buildCrImportPlan({ seasons: input.seasons, resolutions, catalog, lists, services, excludedMediaIds, stats: input.stats }, Date.now());
    await chrome.storage.local.set({ [CR_IMPORT_KEYS.plan]: plan });
    // L'aperçu contient tout le nécessaire : historique et correspondances intermédiaires effacés
    await chrome.storage.local.remove([CR_IMPORT_KEYS.input, CR_IMPORT_KEYS.resolutions]);
    log.info(`Aperçu de l’import : ${plan.items.length} séries, ${plan.review.length} à vérifier, ${plan.excluded} exclues, ${plan.failed} en échec`);
    return itemEvent('updated');
  } catch (error: unknown) {
    const step = errorStep(error, null, isLastAttempt);
    if ('retry' in step) return step.retry;
    return stopStep(step.message);
  }
}

const analyzeLoop = createJobLoop<CrImportJob>({
  label: 'analyse de l’historique Crunchyroll',
  log,
  store: jobStore,
  alarm: CR_IMPORT_ALARM,
  accepts: (job) => job.kind === 'cr-analyze',
  itemKey: (item) => item,
  process: (_job, item, isLastAttempt) => {
    if (item === FINALIZE_ITEM) return finalize(isLastAttempt);
    const index = seasonIndexOf(item);
    return index === null ? Promise.resolve(itemEvent('skipped')) : analyzeSeason(index, isLastAttempt);
  },
  onEnd: (job) => log.info(`Analyse ${job.status} : ${job.done}/${job.total}`),
});

// ─── Application ──────────────────────────────────────────────────────────

/** Écrit UN élément du plan sur chaque service prévu (état relu juste avant : jamais de recul). Ne lève jamais. */
async function applyItem(id: string, isLastAttempt: (reason: TransientKind) => boolean): Promise<StepResult> {
  const plan = await readPlan();
  if (!plan) return stopStep(t('crImport.error.noPlan'));
  const item = plan.items.find((i) => i.id === id);
  if (!item) return itemEvent('skipped');

  const trackers = await getConnectedTrackers();
  const outcomes: { service: TrackerId; result: 'updated' | 'skipped' | 'failed'; message: string | null }[] = [];
  let fatal: string | null = null;
  for (const planned of item.services) {
    if (planned.action !== 'update') continue;
    const label = TRACKER_LABELS[planned.service];
    const tracker = trackers.find((tr) => tr.id === planned.service);
    const targetId = planned.service === 'anilist' ? item.mediaId : item.malId;
    if (!tracker || targetId === null) {
      outcomes.push({ service: planned.service, result: 'skipped', message: t('crImport.skip.notConnected', { service: label }) });
      continue;
    }
    try {
      // Lecture fraîche : la liste a pu changer depuis l'aperçu (autre appareil, synchro en direct)
      await waitReadSlot(planned.service);
      const current = await tracker.getEntry(targetId);
      const decision = decideImport(current.entry, item.progress, current.episodes ?? item.episodes);
      if (decision.action === 'skip') {
        outcomes.push({ service: planned.service, result: 'skipped', message: `${label} : ${t(`crImport.skipReason.${decision.reason}`)}` });
        continue;
      }
      await waitWriteSlot(planned.service);
      await tracker.saveProgress(targetId, decision.progress, decision.status);
      log.info(`${label} : ${item.title} → épisode ${decision.progress} (${decision.status}, import Crunchyroll)`);
      outcomes.push({ service: planned.service, result: 'updated', message: null });
    } catch (error: unknown) {
      const step = errorStep(error, planned.service, isLastAttempt);
      // Nouvelle tentative de l'élément entier : un service déjà écrit sera relu et ignoré (à jour)
      if ('retry' in step) return step.retry;
      log.warn(`${label} : échec de l’import de ${item.title} :`, step.message);
      outcomes.push({ service: planned.service, result: 'failed', message: `${label} : ${step.message}` });
      if (step.fatal) {
        fatal = step.message;
        break;
      }
    }
  }

  const updated = outcomes.some((o) => o.result === 'updated');
  const failed = outcomes.find((o) => o.result === 'failed');
  const result: CrItemResult = {
    outcome: updated ? 'updated' : failed ? 'failed' : 'skipped',
    message: failed?.message ?? outcomes.find((o) => o.message !== null)?.message ?? null,
  };
  if (updated) await rememberMappings(item);
  await updatePlan((p) => withItemResult(p, id, result));
  return { kind: 'event', event: { type: 'item', outcome: result.outcome, ...(result.message ? { message: result.message } : {}), at: Date.now() }, stop: fatal };
}

/** Correspondances sûres de l'élément mémorisées si la saison n'en a pas encore (la synchro en direct s'en sert) */
async function rememberMappings(item: CrPlanItem): Promise<void> {
  for (const { key, mapping } of item.mappings) {
    if ((await getMediaMapping(key)) === null) await saveMediaMapping(key, { ...mapping, mediaTitle: item.title });
  }
}

const applyLoop = createJobLoop<CrImportJob>({
  label: 'import Crunchyroll',
  log,
  store: jobStore,
  alarm: CR_IMPORT_ALARM,
  accepts: (job) => job.kind === 'cr-apply',
  itemKey: (item) => item,
  process: (_job, item, isLastAttempt) => applyItem(item, isLastAttempt),
  onEnd: (job) => log.info(`Import ${job.status} : ${job.updated} mises à jour, ${job.skipped} ignorées, ${job.failed} échecs`),
});

function ensureLoop(job: CrImportJob | null): void {
  if (job?.kind === 'cr-analyze') analyzeLoop.ensure();
  else if (job?.kind === 'cr-apply') applyLoop.ensure();
}

// ─── Messages de la page d'import ─────────────────────────────────────────

const failure = (code: CrImportErrorCode, key: Parameters<typeof t>[0]): { ok: false; code: CrImportErrorCode; message: string } => ({ ok: false, code, message: t(key) });

/** Réserve la tâche sous verrou : une seule analyse ou application à la fois */
async function reserveJob(start: () => CrImportJob): Promise<CrImportJob | null> {
  let started: CrImportJob | null = null;
  await jobStore.update((job) => {
    if (isJobActive(job, Date.now())) return job;
    started = start();
    return started;
  });
  return started;
}

/** CR_IMPORT_ANALYZE : historique lu dans l'onglet Crunchyroll → tâche d'analyse en arrière-plan */
export async function startCrAnalyze({ history }: CrImportAnalyzePayload): Promise<CrImportJobResult> {
  try {
    if ((await getConnectedTrackers()).length === 0) return failure('NOT_CONNECTED', 'crImport.error.notConnected');
    if (history.seasons.length === 0) return failure('EMPTY', 'crImport.error.empty');
    const job = await reserveJob(() => startAnalyzeJob(history.seasons.length, Date.now()));
    if (job === null) return failure('BUSY', 'crImport.error.busy');
    const input: CrImportInput = { ...history, createdAt: Date.now() };
    await chrome.storage.local.set({ [CR_IMPORT_KEYS.input]: input, [CR_IMPORT_KEYS.resolutions]: {} });
    await chrome.storage.local.remove(CR_IMPORT_KEYS.plan);
    await chrome.alarms.create(CR_IMPORT_ALARM, { periodInMinutes: 0.5 });
    log.info(`Analyse de l’historique Crunchyroll : ${history.seasons.length} saisons (${history.stats.items} éléments lus)`);
    analyzeLoop.ensure();
    return { ok: true, data: job };
  } catch (error: unknown) {
    log.error('Erreur inattendue (analyse de l’historique) :', error);
    return failure('API_ERROR', 'crImport.error.unexpected');
  }
}

/** CR_IMPORT_APPLY : éléments cochés dans l'aperçu → tâche d'application en arrière-plan */
export async function startCrApply({ ids }: CrImportApplyPayload): Promise<CrImportJobResult> {
  try {
    if ((await getConnectedTrackers()).length === 0) return failure('NOT_CONNECTED', 'crImport.error.notConnected');
    const plan = await readPlan();
    if (!plan) return failure('NO_PLAN', 'crImport.error.noPlan');
    const known = new Set(plan.items.map((i) => i.id));
    const selected = [...new Set(ids)].filter((id) => known.has(id));
    if (selected.length === 0) return failure('EMPTY', 'crImport.error.nothingSelected');
    const job = await reserveJob(() => startApplyJob(selected, Date.now()));
    if (job === null) return failure('BUSY', 'crImport.error.busy');
    await chrome.alarms.create(CR_IMPORT_ALARM, { periodInMinutes: 0.5 });
    log.info(`Import Crunchyroll : ${selected.length} séries`);
    applyLoop.ensure();
    return { ok: true, data: job };
  } catch (error: unknown) {
    log.error('Erreur inattendue (import) :', error);
    return failure('API_ERROR', 'crImport.error.unexpected');
  }
}

/** CR_IMPORT_CANCEL : « Arrêter » ; l'élément en cours se termine */
export async function cancelCrImport(): Promise<Result<null, 'NOT_FOUND'>> {
  const job = await jobStore.update((j) => j && reduceJob(j, { type: 'cancel', at: Date.now() }));
  if (!job || job.status !== 'running') return { ok: false, code: 'NOT_FOUND', message: t('crImport.error.noJob') };
  // Service worker redémarré : la boucle relancée constate l'arrêt et clôt la tâche
  ensureLoop(job);
  return { ok: true, data: null };
}

/**
 * CR_IMPORT_REVIEWS : crée les cartes « À vérifier » (même flux que la synchro en direct) des saisons choisies.
 * Dans la limite des places libres (MAX_PENDING_REVIEWS) : les vérifications existantes ne sont jamais évincées.
 */
export async function createCrReviews({ keys }: CrImportReviewsPayload): Promise<CrImportReviewsResult> {
  try {
    const plan = await readPlan();
    if (!plan) return failure('NO_PLAN', 'crImport.error.noPlan');
    const wanted = new Set(keys);
    const pending = await getPendingReviews();
    const pendingKeys = new Set(pending.map((r) => r.key));
    const items = plan.review.filter((r) => wanted.has(r.key) && !r.created);
    // Carte existante pour la même saison : remplacée (aucune place consommée)
    let free = MAX_PENDING_REVIEWS - pending.length;
    const created = new Set<string>();
    const now = Date.now();
    for (const [i, item] of items.entries()) {
      if (!pendingKeys.has(item.key)) {
        if (free <= 0) continue;
        free--;
      }
      await savePendingReview({ key: item.key, episode: item.episode, reason: item.reason, suggestion: item.suggestion, candidates: item.candidates, previous: null, createdAt: now - i });
      created.add(item.key);
    }
    if (created.size > 0) {
      await updatePlan((p) => withReviewsCreated(p, created));
      await refreshReviewBadge();
    }
    return { ok: true, data: { created: created.size, limited: created.size < items.length } };
  } catch (error: unknown) {
    log.error('Erreur inattendue (vérifications de l’import) :', error);
    return failure('API_ERROR', 'crImport.error.unexpected');
  }
}

/** Alarme de reprise (et démarrage du navigateur) : relance la tâche interrompue, sinon retire l'alarme */
export async function resumeCrImport(): Promise<void> {
  const job = await jobStore.read();
  if (job?.status === 'running') {
    ensureLoop(job);
    return;
  }
  await chrome.alarms.clear(CR_IMPORT_ALARM);
}
