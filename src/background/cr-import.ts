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
  withItemResults,
  withItemWritten,
  withReviewsCreated,
  type CrCatalogEntry,
  type CrImportAnalyzePayload,
  type CrImportApplyPayload,
  type CrImportDecision,
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
import { sameSessions, type SessionEpochs } from '../shared/session-epochs';
import {
  getMediaMapping,
  getOpenSessions,
  getPendingReviews,
  isSessionOpen,
  MAX_PENDING_REVIEWS,
  saveMediaMappingsIfAbsent,
  savePendingReview,
  withStorageLock,
} from '../shared/storage';
import type { MediaMapping } from '../shared/sync.types';
import { TRACKER_LABELS, type TrackerId } from '../shared/tracker.types';
import { ApiError } from './api/errors';
import { getAnimeByIds } from './api/media';
import { fetchAniListFullList, fetchMalFullList } from './compare';
import {
  createJobLoop,
  createJobStore,
  ensureResumeAlarm,
  isFatalError,
  RESUME_ALARM_PERIOD_MIN,
  transientKind,
  waitReadSlot,
  waitWriteSlot,
  type StepResult,
  type TransientKind,
} from './jobs/runner';
import { mappingKey, seasonLabel } from './sync/matching';
import { resolveEpisode } from './sync/resolver';
import { withEntryLock } from './sync/entry-lock';
import { getConnectedTrackers } from './trackers';
import type { TrackerService } from './trackers/tracker';

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

/**
 * Historique réduit et correspondances intermédiaires sans analyse en cours (arrêt, échec, déconnexion d'une version
 * précédente) : effacés, comme le promet PRIVACY.md (CRI-04). Tâche relue sous verrou : une nouvelle analyse lancée
 * entre-temps garde les siens. Sans lecture préalable des clés (jusqu'à quelques centaines de Ko).
 */
export function purgeOrphanImportData(): Promise<void> {
  return withStorageLock(async () => {
    const job = await jobStore.read();
    if (job?.kind === 'cr-analyze' && job.status === 'running') return;
    await chrome.storage.local.remove([CR_IMPORT_KEYS.input, CR_IMPORT_KEYS.resolutions]);
  });
}

// ─── Écritures par lots (PERF-02) ─────────────────────────────────────────
// L'historique (analyse) et l'aperçu (application) sont lus une fois par tâche, puis relus seulement après un réveil
// du service worker. Les correspondances de saison, les résultats et les correspondances apprises sont écrits par lots :
// le volume écrit ne croît plus avec le carré du nombre de saisons, et la page d'import ne redessine qu'à chaque lot.

/** Éléments au plus par lot */
export const WRITE_BATCH_SIZE = 20;
/** Délai au plus entre deux lots : la page d'import suit la progression */
export const WRITE_BATCH_MS = 10_000;

interface AnalyzeMemory {
  /** Tâche d'analyse (startedAt) : la mémoire d'une autre tâche n'est jamais écrite */
  jobId: number;
  input: CrImportInput | null;
  /** Correspondances pas encore écrites (index de saison → résultat) */
  pending: Record<string, SeasonResolution>;
  since: number;
}

interface ApplyMemory {
  /** Tâche d'application (startedAt) */
  jobId: number;
  plan: CrImportPlan | null;
  /** Résultats pas encore inscrits dans l'aperçu */
  results: Map<string, CrItemResult>;
  /** Correspondances sûres à mémoriser (si la saison n'en a pas encore) */
  mappings: { key: string; mapping: MediaMapping }[];
  since: number;
}

let analyzeMemory: AnalyzeMemory | null = null;
let applyMemory: ApplyMemory | null = null;

function analyzeMemoryFor(job: CrImportJob): AnalyzeMemory {
  if (analyzeMemory?.jobId !== job.startedAt) analyzeMemory = { jobId: job.startedAt, input: null, pending: {}, since: Date.now() };
  return analyzeMemory;
}

function applyMemoryFor(job: CrImportJob): ApplyMemory {
  if (applyMemory?.jobId !== job.startedAt) applyMemory = { jobId: job.startedAt, plan: null, results: new Map(), mappings: [], since: Date.now() };
  return applyMemory;
}

const batchFull = (count: number, since: number): boolean => count >= WRITE_BATCH_SIZE || Date.now() - since >= WRITE_BATCH_MS;

/**
 * Écrit les correspondances en attente si l'analyse est toujours en cours : une analyse arrêtée, effacée (déconnexion,
 * « Recommencer ») ou remplacée n'est jamais recréée. Une correspondance perdue (service worker arrêté avant le lot)
 * est recalculée par finalize.
 */
async function flushResolutions(memory: AnalyzeMemory): Promise<void> {
  const entries = memory.pending;
  memory.pending = {};
  memory.since = Date.now();
  if (Object.keys(entries).length === 0) return;
  await withStorageLock(async () => {
    const job = await jobStore.read();
    if (job?.kind !== 'cr-analyze' || job.startedAt !== memory.jobId || job.status !== 'running') return;
    const stored = readResolutions(await readKey(CR_IMPORT_KEYS.resolutions));
    await chrome.storage.local.set({ [CR_IMPORT_KEYS.resolutions]: { ...stored, ...entries } });
  });
}

async function keepResolution(memory: AnalyzeMemory, index: number, resolution: SeasonResolution): Promise<void> {
  memory.pending[String(index)] = resolution;
  if (batchFull(Object.keys(memory.pending).length, memory.since)) await flushResolutions(memory);
}

/**
 * Inscrit les résultats en attente dans l'aperçu relu sous verrou (cartes « À vérifier » créées entre-temps conservées),
 * s'il est toujours celui de la tâche, puis mémorise les correspondances apprises en une seule écriture.
 */
async function flushApply(memory: ApplyMemory): Promise<void> {
  const { results, mappings } = memory;
  memory.results = new Map();
  memory.mappings = [];
  memory.since = Date.now();
  const builtAt = memory.plan?.builtAt;
  if (results.size > 0) {
    await withStorageLock(async () => {
      const plan = await readPlan();
      if (plan && plan.builtAt === builtAt) await chrome.storage.local.set({ [CR_IMPORT_KEYS.plan]: withItemResults(plan, results) });
    });
  }
  await saveMediaMappingsIfAbsent(mappings);
}

/** Correspondances sûres de l'élément, avec le titre de la fiche (Réglages › Correspondances) */
const itemMappings = (item: CrPlanItem): { key: string; mapping: MediaMapping }[] => item.mappings.map(({ key, mapping }) => ({ key, mapping: { ...mapping, mediaTitle: item.title } }));

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

/** Historique de l'analyse : lu une fois par tâche (relu après un réveil du service worker) */
async function inputFor(memory: AnalyzeMemory): Promise<CrImportInput | null> {
  memory.input ??= await readInput();
  return memory.input;
}

async function analyzeSeason(job: CrImportJob, index: number, isLastAttempt: (reason: TransientKind) => boolean): Promise<StepResult> {
  const memory = analyzeMemoryFor(job);
  const input = await inputFor(memory);
  if (!input) return stopStep(t('crImport.error.noHistory'));
  const season = input.seasons[index];
  if (!season) return itemEvent('skipped');
  try {
    const resolution = await resolveSeason(season);
    await keepResolution(memory, index, resolution);
    return itemEvent(resolution.kind === 'certain' ? 'updated' : 'skipped');
  } catch (error: unknown) {
    const step = errorStep(error, 'anilist', isLastAttempt);
    if ('retry' in step) return step.retry;
    log.warn(`Recherche impossible pour ${season.seriesTitle} :`, step.message);
    await keepResolution(memory, index, { kind: 'failed', key: mappingKey(toEpisodeInfo(season)), message: step.message });
    return { kind: 'event', event: { type: 'item', outcome: 'failed', message: step.message, at: Date.now() }, stop: step.fatal ? step.message : null };
  }
}

/**
 * Correspondances de toutes les saisons : celles écrites, plus celles perdues avec un lot non écrit (service worker
 * arrêté entre deux lots), recalculées ici. Erreur passagère ou bloquante : levée (finalize la traite), les saisons
 * déjà recalculées restent en attente d'écriture pour la nouvelle tentative.
 */
async function allResolutions(memory: AnalyzeMemory, input: CrImportInput): Promise<Record<string, SeasonResolution>> {
  await flushResolutions(memory);
  const resolutions = readResolutions(await readKey(CR_IMPORT_KEYS.resolutions));
  for (const [index, season] of input.seasons.entries()) {
    const key = String(index);
    if (resolutions[key]) continue;
    let resolution: SeasonResolution;
    try {
      resolution = await resolveSeason(season);
    } catch (error: unknown) {
      if (transientKind(error) !== null || isFatalError(error) || !(error instanceof ApiError)) throw error;
      resolution = { kind: 'failed', key: mappingKey(toEpisodeInfo(season)), message: error.message };
    }
    resolutions[key] = resolution;
    memory.pending[key] = resolution;
  }
  return resolutions;
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

/**
 * Enregistre l'aperçu si les sessions n'ont pas changé depuis la lecture des listes. Vérification et écriture sous le
 * même verrou que la déconnexion (qui efface `crImport:*`) : l'aperçu de l'ancien compte n'est jamais recréé.
 */
function savePlanIfSession(plan: CrImportPlan, epochs: SessionEpochs): Promise<boolean> {
  return withStorageLock(async () => {
    if (!sameSessions(await getOpenSessions(), epochs)) return false;
    await chrome.storage.local.set({ [CR_IMPORT_KEYS.plan]: plan });
    // L'aperçu contient tout le nécessaire : historique et correspondances intermédiaires effacés
    await chrome.storage.local.remove([CR_IMPORT_KEYS.input, CR_IMPORT_KEYS.resolutions]);
    return true;
  });
}

async function finalize(job: CrImportJob, isLastAttempt: (reason: TransientKind) => boolean): Promise<StepResult> {
  // Sessions relevées avant la lecture des listes : l'aperçu décrit les listes de ces comptes
  const epochs = await getOpenSessions();
  const memory = analyzeMemoryFor(job);
  const input = await inputFor(memory);
  if (!input) return stopStep(t('crImport.error.noHistory'));
  const services = (await getConnectedTrackers()).map((tr) => tr.id);
  if (services.length === 0) return stopStep(t('crImport.error.notConnected'));
  try {
    const resolutions = await allResolutions(memory, input);
    const mediaIds = [...new Set(Object.values(resolutions).flatMap((r) => (r.kind === 'certain' ? [r.mediaId] : [])))];
    const catalog = await readCatalog(mediaIds);
    const lists: Partial<Record<TrackerId, Map<number, CrListState>>> = {};
    for (const service of services) lists[service] = await readList(service);
    const excludedMediaIds = new Set((await getExcludedSeries()).flatMap((e) => (e.mediaId !== null ? [e.mediaId] : [])));
    const plan = buildCrImportPlan({ seasons: input.seasons, resolutions, catalog, lists, services, excludedMediaIds, stats: input.stats }, Date.now());
    if (!(await savePlanIfSession(plan, epochs))) {
      log.warn('Compte déconnecté ou changé pendant l’analyse : aperçu abandonné');
      return stopStep(t('crImport.error.sessionClosed'));
    }
    log.info(`Aperçu de l’import : ${plan.items.length} séries, ${plan.review.length} à vérifier, ${plan.excluded} exclues, ${plan.failed} en échec`);
    return itemEvent('updated');
  } catch (error: unknown) {
    const step = errorStep(error, null, isLastAttempt);
    if ('retry' in step) {
      // Saisons recalculées avant l'erreur : écrites, la nouvelle tentative ne les refait pas
      await flushResolutions(memory);
      return step.retry;
    }
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
  process: (job, item, isLastAttempt) => {
    if (item === FINALIZE_ITEM) return finalize(job, isLastAttempt);
    const index = seasonIndexOf(item);
    return index === null ? Promise.resolve(itemEvent('skipped')) : analyzeSeason(job, index, isLastAttempt);
  },
  onEnd: async (job) => {
    log.info(`Analyse ${job.status} : ${job.done}/${job.total}`);
    if (analyzeMemory?.jobId === job.startedAt) analyzeMemory = null;
    // Arrêt, échec ou fin : l'historique réduit n'est pas conservé (après un aperçu, il est déjà effacé)
    await purgeOrphanImportData();
  },
});

// ─── Application ──────────────────────────────────────────────────────────

/** Élément abandonné : la session du service a été fermée (déconnexion, autre compte) depuis le début de l'élément */
export type ImportOnServiceResult = CrImportDecision | { action: 'session-closed' };

/**
 * Écrit l'élément sur UN service ; lève les erreurs d'API. Créneaux (espacement, budget AniList de fond) pris AVANT
 * la relecture : aucune attente ne sépare la lecture de l'écriture, et la fiche n'est jamais verrouillée pendant une
 * attente de quota. Relecture, décision et écriture sous le verrou de la fiche : une synchro en direct concurrente
 * (12/12 Terminé) n'est jamais remplacée par la valeur décidée sur l'état d'avant (11 En cours).
 * `epoch` : session du service au début de l'élément, revérifiée juste avant l'écriture (une attente de quota peut
 * durer : un autre compte connecté entre-temps ne reçoit jamais la valeur décidée sur la liste de l'ancien).
 */
export async function importOnService(
  tracker: TrackerService,
  targetId: number,
  item: Pick<CrPlanItem, 'progress' | 'episodes'>,
  epoch: number | undefined,
): Promise<ImportOnServiceResult> {
  await waitWriteSlot(tracker.id);
  await waitReadSlot(tracker.id);
  if (!(await isSessionOpen(tracker.id, epoch))) return { action: 'session-closed' };
  return withEntryLock(tracker.id, targetId, async (): Promise<ImportOnServiceResult> => {
    // Lecture fraîche : la liste a pu changer depuis l'aperçu (autre appareil, synchro en direct)
    const current = await tracker.getEntry(targetId);
    const decision = decideImport(current.entry, item.progress, current.episodes ?? item.episodes);
    if (decision.action !== 'update') return decision;
    if (!(await isSessionOpen(tracker.id, epoch))) return { action: 'session-closed' };
    await tracker.saveProgress(targetId, decision.progress, decision.status);
    return decision;
  });
}

/**
 * Nouvelle tentative de l'élément après un échec passager : les services déjà écrits sont inscrits dans l'aperçu (seul
 * le service en échec sera retenté, même après un réveil du service worker) et ses correspondances apprises (CRI-05).
 */
async function keepWritten(memory: ApplyMemory, item: CrPlanItem, written: ReadonlySet<TrackerId>): Promise<void> {
  if (written.size === (item.written?.length ?? 0)) return;
  const services = [...written];
  const builtAt = memory.plan?.builtAt;
  if (memory.plan) memory.plan = withItemWritten(memory.plan, item.id, services);
  await updatePlan((plan) => (plan.builtAt === builtAt ? withItemWritten(plan, item.id, services) : plan));
  await saveMediaMappingsIfAbsent(itemMappings(item));
}

/** Écrit UN élément du plan sur chaque service prévu (état relu juste avant : jamais de recul). Ne lève jamais. */
async function applyItem(job: CrImportJob, id: string, isLastAttempt: (reason: TransientKind) => boolean): Promise<StepResult> {
  // Sessions relevées AVANT l'aperçu : une déconnexion ensuite efface l'aperçu ou rend la session caduque (CRI-03)
  const epochs = await getOpenSessions();
  const memory = applyMemoryFor(job);
  // Aperçu lu une fois par tâche (relu après un réveil du service worker) ; seuls ses éléments servent ici
  memory.plan ??= await readPlan();
  const plan = memory.plan;
  if (!plan) return stopStep(t('crImport.error.noPlan'));
  const item = plan.items.find((i) => i.id === id);
  if (!item) return itemEvent('skipped');

  const trackers = await getConnectedTrackers();
  const outcomes: { service: TrackerId; result: 'updated' | 'skipped' | 'failed'; message: string | null }[] = [];
  /** Services écrits pour cet élément, y compris par un essai précédent */
  const written = new Set<TrackerId>(item.written ?? []);
  let fatal: string | null = null;
  for (const planned of item.services) {
    if (planned.action !== 'update') continue;
    if (written.has(planned.service)) {
      // Écrit par un essai précédent (l'autre service avait échoué) : compté, jamais relu ni réécrit
      outcomes.push({ service: planned.service, result: 'updated', message: null });
      continue;
    }
    const label = TRACKER_LABELS[planned.service];
    const tracker = trackers.find((tr) => tr.id === planned.service);
    const targetId = planned.service === 'anilist' ? item.mediaId : item.malId;
    if (!tracker || targetId === null) {
      outcomes.push({ service: planned.service, result: 'skipped', message: t('crImport.skip.notConnected', { service: label }) });
      continue;
    }
    try {
      const decision = await importOnService(tracker, targetId, item, epochs[planned.service]);
      if (decision.action === 'session-closed') {
        // Compte déconnecté ou changé pendant l'élément : rien n'est écrit, et l'import s'arrête (aperçu de l'ancien compte)
        const message = t('crImport.skip.sessionClosed', { service: label });
        log.warn(message, item.title);
        outcomes.push({ service: planned.service, result: 'skipped', message });
        fatal = message;
        break;
      }
      if (decision.action === 'skip') {
        outcomes.push({ service: planned.service, result: 'skipped', message: `${label} : ${t(`crImport.skipReason.${decision.reason}`)}` });
        continue;
      }
      log.info(`${label} : ${item.title} → épisode ${decision.progress} (${decision.status}, import Crunchyroll)`);
      outcomes.push({ service: planned.service, result: 'updated', message: null });
      written.add(planned.service);
    } catch (error: unknown) {
      const step = errorStep(error, planned.service, isLastAttempt);
      if ('retry' in step) {
        // Nouvelle tentative : seuls les services pas encore écrits (CRI-05)
        await keepWritten(memory, item, written);
        return step.retry;
      }
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
  // Correspondances sûres mémorisées si la saison n'en a pas encore (la synchro en direct s'en sert)
  if (updated) memory.mappings.push(...itemMappings(item));
  memory.results.set(id, result);
  // Dernier élément ou arrêt : résultat publié tout de suite (bilan complet dans la page)
  if (job.pending.length <= 1 || fatal !== null || batchFull(memory.results.size, memory.since)) await flushApply(memory);
  return { kind: 'event', event: { type: 'item', outcome: result.outcome, ...(result.message ? { message: result.message } : {}), at: Date.now() }, stop: fatal };
}

const applyLoop = createJobLoop<CrImportJob>({
  label: 'import Crunchyroll',
  log,
  store: jobStore,
  alarm: CR_IMPORT_ALARM,
  accepts: (job) => job.kind === 'cr-apply',
  itemKey: (item) => item,
  process: (job, item, isLastAttempt) => applyItem(job, item, isLastAttempt),
  onEnd: async (job) => {
    log.info(`Import ${job.status} : ${job.updated} mises à jour, ${job.skipped} ignorées, ${job.failed} échecs`);
    // « Arrêter » : résultats encore en attente publiés
    if (applyMemory?.jobId === job.startedAt) {
      const memory = applyMemory;
      applyMemory = null;
      await flushApply(memory);
    }
  },
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
    analyzeMemory = { jobId: job.startedAt, input, pending: {}, since: Date.now() };
    applyMemory = null;
    await chrome.alarms.create(CR_IMPORT_ALARM, { periodInMinutes: RESUME_ALARM_PERIOD_MIN });
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
    applyMemory = { jobId: job.startedAt, plan, results: new Map(), mappings: [], since: Date.now() };
    await chrome.alarms.create(CR_IMPORT_ALARM, { periodInMinutes: RESUME_ALARM_PERIOD_MIN });
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

/**
 * Alarme de reprise, démarrage du navigateur et mise à jour de l'extension : relance la tâche interrompue (alarme
 * recréée si elle a disparu), sinon retire l'alarme. Hors analyse en cours, l'historique réduit laissé par un arrêt,
 * un échec ou une version précédente est effacé (CRI-04).
 */
export async function resumeCrImport(): Promise<void> {
  const job = await jobStore.read();
  if (job?.status === 'running') {
    await ensureResumeAlarm(CR_IMPORT_ALARM);
    ensureLoop(job);
  } else {
    await chrome.alarms.clear(CR_IMPORT_ALARM);
  }
  if (job?.kind !== 'cr-analyze' || job.status !== 'running') await purgeOrphanImportData();
}
