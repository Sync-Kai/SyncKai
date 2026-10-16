import { t } from '../../i18n';
import {
  buildCrImportPlan,
  CR_IMPORT_ALARM,
  CR_IMPORT_KEYS,
  FINALIZE_ITEM,
  importPlatformOf,
  readResolutions,
  seasonIndexOf,
  toEpisodeInfo,
  type CrCatalogEntry,
  type CrImportInput,
  type CrImportJob,
  type CrImportPlan,
  type CrListState,
  type ImportPlatform,
  type SeasonResolution,
} from '../../shared/cr-import';
import type { HistorySeason } from '../../platforms/crunchyroll/history';
import type { EpisodeInfo } from '../../shared/episode.types';
import { seasonPosition } from '../../shared/episode-position';
import { getExcludedSeries, isExcluded } from '../../shared/exclusions';
import { exclusionKey, mappingKey } from '../../platforms/series-identity';
import { createLogger } from '../../browser/logger';
import { sameSessions, type SessionEpochs } from '../../shared/session-epochs';
import { getMediaMapping } from '../../browser/storage/mappings';
import { mappingOrigin, withOrigin, type MappingOrigin } from '../../shared/sync.types';
import { getOpenSessions } from '../../browser/storage/sessions';
import { withStorageLock } from '../../browser/storage/lock';
import type { TrackerId } from '../../shared/tracker.types';
import { ApiError } from '../errors';
import { getAnimeByIds } from '../anilist/media';
import { createJobLoop, isFatalError, transientKind, type StepResult, type TransientKind } from '../jobs/runner';
import { seasonLabel } from '../sync/matching/matching';
import { IMPORT_RESOLVE_OPTIONS, prefetchCandidates, resolveEpisode } from '../sync/resolver';
import { getConnectedTrackers } from '../trackers';
import type { TrackerService } from '../ports/tracker';
import { batchFull, errorStep, itemEvent, jobStore, purgeOrphanImportData, readInput, readKey, stopStep } from './import-job';

// Import de l'historique, analyse : correspondance de chaque saison (sans rien écrire sur les services), puis aperçu.

const log = createLogger('cr-import');

interface AnalyzeMemory {
  /** Tâche d'analyse (startedAt) : la mémoire d'une autre tâche n'est jamais écrite */
  jobId: number;
  input: CrImportInput | null;
  /** Correspondances pas encore écrites (index de saison → résultat) */
  pending: Record<string, SeasonResolution>;
  since: number;
  /** Saisons dont les recherches ont déjà été pré-chargées (PERF-10) ; vide après un réveil : reprise pré-chargée aussi */
  prefetched: Set<number>;
}

let analyzeMemory: AnalyzeMemory | null = null;

function analyzeMemoryFor(job: CrImportJob): AnalyzeMemory {
  if (analyzeMemory?.jobId !== job.startedAt) analyzeMemory = { jobId: job.startedAt, input: null, pending: {}, since: Date.now(), prefetched: new Set() };
  return analyzeMemory;
}

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

// ─── Analyse : correspondance d'une saison ────────────────────────────────

/**
 * Correspondance d'une saison, sans rien écrire (cache des correspondances lu, jamais modifié).
 * Même résolveur que la synchro en direct : une saison sûre ici l'aurait été sur la page de lecture. Une correspondance en cache
 * y est en plus confrontée à une nouvelle résolution (IMPORT_RESOLVE_OPTIONS, audit 1-D10) : apprise et contredite, elle est
 * remplacée à l'application (`replaces`) ; d'origine inconnue, la saison est « À vérifier » ; choisie, elle reste.
 */
async function resolveSeason(season: HistorySeason, platform: ImportPlatform): Promise<SeasonResolution> {
  const episode = toEpisodeInfo(season, platform);
  const key = mappingKey(episode);
  if (await isExcluded({ platformKey: exclusionKey(episode) })) return { kind: 'excluded', key };

  const cached = await getMediaMapping(key);
  // Requêtes de fond : budget AniList partagé (popup et synchro en direct prioritaires, voir rate-limit.ts)
  const { result, candidates } = await resolveEpisode(episode, IMPORT_RESOLVE_OPTIONS);
  if (result.ok && (await isExcluded({ mediaId: result.target.mediaId }))) return { kind: 'excluded', key };
  // Netflix : pas un anime (ni fiche liée à la série, ni fiche au même titre), comme en lecture : écarté en silence
  if (!result.ok && result.ignored === true) return { kind: 'ignored', key };

  // Position dans la saison inconnue (saison retirée du catalogue) : seul un numéro affiché déjà appris est fiable
  const numbersKnown = seasonPosition(episode, cached?.numbering === 'displayed' ? 'displayed' : 'season') !== null;
  // Saison nommée placée par son seul rang (voir SyncTarget.byRank) : la plateforme peut compter un spécial comme saison
  // (Dr. STONE « RYUSUI » en saison 3) ; la synchro en direct l'applique, l'import jamais sans vérification
  if (!result.ok || result.target.confidence === 'low' || result.target.byRank === true || !numbersKnown) {
    const reason = !result.ok ? result.reason : numbersKnown ? result.target.reason : t('crImport.reason.numbering');
    return { kind: 'review', key, reason, suggestion: result.ok ? { mediaId: result.target.mediaId, progress: result.target.progress } : null, candidates };
  }
  const { mediaId, numbering, offset, episodes, progress } = result.target;
  // Correspondance en cache : son origine reste (jamais écrasée, voir saveMediaMappingsIfAbsent) ; sinon apprise
  const origin: MappingOrigin = result.target.fromCache ? (cached ? mappingOrigin(cached) : 'unmarked') : 'learned';
  // Correspondance apprise écartée par la résolution (contredite, ou qui ne s'applique plus) : remplacée à l'application
  const replaces = !result.target.fromCache && cached !== null && mappingOrigin(cached) === 'learned' ? { replaces: cached } : {};
  return { kind: 'certain', key, mediaId, progress, mapping: withOrigin({ mediaId, numbering, offset, episodes, seriesLabel: seasonLabel(episode) }, origin), ...replaces };
}

// ─── Analyse : recherches pré-chargées par lots (PERF-10) ─────────────────
// Sans pré-chargement, chaque série coûte 1 à 4 recherches AniList unitaires (titre, « série + saison », titre sans
// accents, slug), plus les suites manquantes. Les saisons à venir sont pré-chargées par tranches : leurs recherches partent
// réunies (10 par requête, voir resolver.ts › prefetchCandidates), puis chaque saison est résolue depuis le cache du
// catalogue. Par tranches et pas tout l'historique d'avance : le cache de fond ne garde les résultats que 10 min.

/** Saisons pré-chargées ensemble : assez pour bien remplir les lots, assez peu pour être résolues bien avant 10 min */
export const PREFETCH_SEASONS = 30;

/** Pré-charge les recherches de ces saisons (exclusions écartées) ; un échec est sans conséquence : chaque saison refait les siennes */
async function prefetchSeasons(input: CrImportInput, indexes: readonly number[]): Promise<void> {
  const platform = importPlatformOf(input);
  const episodes: EpisodeInfo[] = [];
  for (const index of indexes) {
    const season = input.seasons[index];
    if (!season) continue;
    const episode = toEpisodeInfo(season, platform);
    if (!(await isExcluded({ platformKey: exclusionKey(episode) }))) episodes.push(episode);
  }
  try {
    await prefetchCandidates(episodes, 'background');
  } catch (error: unknown) {
    log.info('Pré-chargement des recherches interrompu (chaque saison cherchera seule) :', error instanceof ApiError ? error.message : error);
  }
}

/** Avant la saison `index` : pré-charge la tranche des saisons restantes de la tâche qui commence par elle (sauf déjà fait) */
async function prefetchAhead(memory: AnalyzeMemory, job: CrImportJob, input: CrImportInput, index: number): Promise<void> {
  if (memory.prefetched.has(index)) return;
  // Liste lue à chaque tranche seulement (déjà pré-chargée sinon) : éléments à partir du curseur
  const upcoming = (await jobStore.readItems()).slice(job.cursor).flatMap((item) => {
    const next = seasonIndexOf(item);
    return next !== null && next !== index && !memory.prefetched.has(next) ? [next] : [];
  });
  const indexes = [index, ...upcoming].slice(0, PREFETCH_SEASONS);
  for (const next of indexes) memory.prefetched.add(next);
  await prefetchSeasons(input, indexes);
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
  await prefetchAhead(memory, job, input, index);
  try {
    const resolution = await resolveSeason(season, importPlatformOf(input));
    await keepResolution(memory, index, resolution);
    return itemEvent(resolution.kind === 'certain' ? 'updated' : 'skipped');
  } catch (error: unknown) {
    const step = errorStep(error, 'anilist', isLastAttempt);
    if ('retry' in step) return step.retry;
    log.warn(`Recherche impossible pour ${season.seriesTitle} :`, step.message);
    await keepResolution(memory, index, { kind: 'failed', key: mappingKey(toEpisodeInfo(season, importPlatformOf(input))), message: step.message });
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
  const missing = [...input.seasons.keys()].filter((index) => !resolutions[String(index)]);
  for (const [rank, index] of missing.entries()) {
    const season = input.seasons[index];
    if (!season) continue;
    const key = String(index);
    // Saisons perdues recalculées par tranches pré-chargées, comme pendant l'analyse
    if (rank % PREFETCH_SEASONS === 0) await prefetchSeasons(input, missing.slice(rank, rank + PREFETCH_SEASONS));
    let resolution: SeasonResolution;
    try {
      resolution = await resolveSeason(season, importPlatformOf(input));
    } catch (error: unknown) {
      if (transientKind(error) !== null || isFatalError(error) || !(error instanceof ApiError)) throw error;
      resolution = { kind: 'failed', key: mappingKey(toEpisodeInfo(season, importPlatformOf(input))), message: error.message };
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
async function readList(tracker: TrackerService): Promise<Map<number, CrListState>> {
  const list = new Map<number, CrListState>();
  for (const { id, status, progress } of await tracker.fullList()) if (!list.has(id)) list.set(id, { status, progress });
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
  const trackers = await getConnectedTrackers();
  const services = trackers.map((tr) => tr.id);
  if (services.length === 0) return stopStep(t('crImport.error.notConnected'));
  try {
    const resolutions = await allResolutions(memory, input);
    const mediaIds = [...new Set(Object.values(resolutions).flatMap((r) => (r.kind === 'certain' ? [r.mediaId] : [])))];
    const catalog = await readCatalog(mediaIds);
    const lists: Partial<Record<TrackerId, Map<number, CrListState>>> = {};
    for (const tracker of trackers) lists[tracker.id] = await readList(tracker);
    const excludedMediaIds = new Set((await getExcludedSeries()).flatMap((e) => (e.mediaId !== null ? [e.mediaId] : [])));
    const plan = buildCrImportPlan({ platform: importPlatformOf(input), seasons: input.seasons, resolutions, catalog, lists, services, excludedMediaIds, stats: input.stats }, Date.now());
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
  label: 'analyse de l’historique',
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

/** Nouvelle analyse : son historique gardé en mémoire (il vient d'être enregistré), sans relecture */
export function startAnalyzeMemory(job: CrImportJob, input: CrImportInput): void {
  analyzeMemory = { jobId: job.startedAt, input, pending: {}, since: Date.now(), prefetched: new Set() };
}

/** Démarre la boucle d'analyse si aucune boucle vivante ne tourne dans ce service worker */
export function ensureAnalyzeLoop(): void {
  analyzeLoop.ensure();
}
