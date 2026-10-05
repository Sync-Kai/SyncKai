import { t } from '../i18n';
import {
  compareLists,
  COMPARE_STORAGE_KEY,
  findDiff,
  isComparisonResult,
  planApply,
  skipReasonText,
  withDiffError,
  withoutDiff,
  type ApplyDiffItem,
  type ApplyDiffsPayload,
  type ApplyResult,
  type CancelJobResult,
  type CompareResult,
  type ComparisonResult,
  type MalListEntry,
} from '../shared/compare';
import {
  COMPARE_JOB_ALARM,
  COMPARE_JOB_KEY,
  isCompareJob,
  isJobActive,
  isJobStale,
  JOB_STALE_MS,
  reduceJob,
  startAnalyzeJob,
  startApplyJob,
  type CompareJob,
  type JobEvent,
} from '../shared/compare-job';
import { isRecord } from '../shared/guards';
import { getCachedViewer, STORAGE_KEYS, withStorageLock } from '../shared/storage';
import { TRACKER_LABELS, type TrackerId } from '../shared/tracker.types';
import { anilistPublicQuery, anilistQuery } from './api/client';
import { ApiError, type ApiErrorCode } from './api/errors';
import { getScoreFormat } from './api/list';
import { malRequest } from './api/mal';
import { sleep } from './api/rate-limit';
import { getViewer } from './api/viewer';
import { parseAniListCollection, parseMalListPage } from './compare-parse';
import { getConnectedTrackers } from './trackers';
import { createLogger } from '../shared/logger';

// Comparaison AniList ↔ MyAnimeList (Activité › Écarts) : lecture des deux listes complètes,
// puis alignement manuel, série par série ou en lot. Rien n'est corrigé automatiquement.

const log = createLogger('compare');

// ─── Lecture des listes complètes ─────────────────────────────────────────

/** 500 = maximum de `perChunk` ; chunk + hasNextChunk : listes de plus de 500 entrées */
const ANILIST_CHUNK = 500;
const MAX_ANILIST_CHUNKS = 40;

const ANILIST_FULL_LIST_QUERY = /* GraphQL */ `
  query FullList($userId: Int, $chunk: Int, $perChunk: Int) {
    MediaListCollection(userId: $userId, type: ANIME, chunk: $chunk, perChunk: $perChunk) {
      hasNextChunk
      lists {
        entries {
          status
          progress
          score
          repeat
          media {
            id
            idMal
            title { userPreferred romaji english }
            coverImage { medium }
          }
        }
      }
    }
  }
`;

const isCollectionData = (data: unknown): data is { MediaListCollection: Record<string, unknown> } =>
  isRecord(data) && isRecord(data.MediaListCollection);

async function getAniListUserId(): Promise<number> {
  const cached = await getCachedViewer();
  if (cached) return cached.id;
  const result = await getViewer();
  if (!result.ok) throw new ApiError(result.code, result.message);
  return result.data.id;
}

async function fetchAniListFullList(): Promise<ReturnType<typeof parseAniListCollection>> {
  const userId = await getAniListUserId();
  const entries: ReturnType<typeof parseAniListCollection> = [];
  for (let chunk = 1; chunk <= MAX_ANILIST_CHUNKS; chunk++) {
    const { MediaListCollection } = await anilistQuery(ANILIST_FULL_LIST_QUERY, isCollectionData, { userId, chunk, perChunk: ANILIST_CHUNK });
    entries.push(...parseAniListCollection(MediaListCollection));
    if (MediaListCollection.hasNextChunk !== true) break;
  }
  return entries;
}

/** limit=1000 = maximum de l'endpoint ; nsfw=true : sinon MAL omet les fiches NSFW */
const MAL_PAGE = 1000;
const MAX_MAL_PAGES = 20;
const MAL_FULL_LIST_PATH =
  '/users/@me/animelist?nsfw=true&fields=list_status{status,score,num_episodes_watched,is_rewatching,num_times_rewatched,updated_at},num_episodes,main_picture';

const isMalListData = (data: unknown): data is { data: unknown[]; paging?: unknown } => isRecord(data) && Array.isArray(data.data);

async function fetchMalFullList(): Promise<MalListEntry[]> {
  const entries: MalListEntry[] = [];
  for (let page = 0; page < MAX_MAL_PAGES; page++) {
    const result = await malRequest(`${MAL_FULL_LIST_PATH}&limit=${MAL_PAGE}&offset=${page * MAL_PAGE}`, isMalListData);
    entries.push(...parseMalListPage(result.data));
    const hasNext = isRecord(result.paging) && typeof result.paging.next === 'string';
    if (!hasNext || result.data.length < MAL_PAGE) break;
  }
  return entries;
}

const CATALOG_BY_MAL_QUERY = /* GraphQL */ `
  query CompareCatalog($ids: [Int]) {
    Page(perPage: 50) {
      media(idMal_in: $ids, type: ANIME) { id idMal }
    }
  }
`;
const CATALOG_CHUNK = 50;

const isPageData = (data: unknown): data is { Page: { media: unknown[] } } =>
  isRecord(data) && isRecord(data.Page) && Array.isArray(data.Page.media);

/** Fiche AniList des séries MAL absentes de la liste AniList (pour pouvoir les y recopier) */
async function resolveMalOnly(mal: readonly MalListEntry[], knownMalIds: ReadonlySet<number>): Promise<MalListEntry[]> {
  const missing = [...new Set(mal.filter((e) => !knownMalIds.has(e.malId)).map((e) => e.malId))];
  const byMal = new Map<number, number>();
  for (let i = 0; i < missing.length; i += CATALOG_CHUNK) {
    const { Page } = await anilistPublicQuery(CATALOG_BY_MAL_QUERY, isPageData, { ids: missing.slice(i, i + CATALOG_CHUNK) });
    for (const media of Page.media) {
      if (isRecord(media) && typeof media.id === 'number' && typeof media.idMal === 'number' && !byMal.has(media.idMal)) byMal.set(media.idMal, media.id);
    }
  }
  return mal.map((e) => (knownMalIds.has(e.malId) ? e : { ...e, mediaId: byMal.get(e.malId) ?? null }));
}

// ─── Stockage : dernière comparaison et tâche en cours ───────────────────

async function readComparison(): Promise<ComparisonResult | null> {
  const stored = await chrome.storage.local.get(COMPARE_STORAGE_KEY);
  const value: unknown = stored[COMPARE_STORAGE_KEY];
  return isComparisonResult(value) ? value : null;
}

/** Les deux comptes sont-ils toujours connectés ? (rien à écrire pour un compte déconnecté entre-temps) */
async function hasBothTokens(): Promise<boolean> {
  const stored = await chrome.storage.local.get([STORAGE_KEYS.anilistToken, STORAGE_KEYS.malToken]);
  return stored[STORAGE_KEYS.anilistToken] !== undefined && stored[STORAGE_KEYS.malToken] !== undefined;
}

async function writeComparison(result: ComparisonResult): Promise<void> {
  if (await hasBothTokens()) await chrome.storage.local.set({ [COMPARE_STORAGE_KEY]: result });
}

async function readJob(): Promise<CompareJob | null> {
  const stored = await chrome.storage.local.get(COMPARE_JOB_KEY);
  const value: unknown = stored[COMPARE_JOB_KEY];
  return isCompareJob(value) ? value : null;
}

/**
 * Lecture-modification-écriture de la tâche sous verrou : le popup (« Arrêter ») et la boucle
 * d'alignement l'écrivent tous deux. `update` renvoie null pour supprimer la tâche.
 */
function updateJob(update: (job: CompareJob | null) => CompareJob | null): Promise<CompareJob | null> {
  return withStorageLock(async () => {
    const next = update(await readJob());
    if (next === null) await chrome.storage.local.remove(COMPARE_JOB_KEY);
    else await chrome.storage.local.set({ [COMPARE_JOB_KEY]: next });
    return next;
  });
}

// ─── Analyse ──────────────────────────────────────────────────────────────

const notConnected = (): { ok: false; code: 'NOT_CONNECTED'; message: string } => ({ ok: false, code: 'NOT_CONNECTED', message: t('compare.error.notConnected') });
const isBusy = (): { ok: false; code: 'BUSY'; message: string } => ({ ok: false, code: 'BUSY', message: t('compare.error.busy') });

async function bothConnected(): Promise<boolean> {
  return (await getConnectedTrackers()).length === 2;
}

/** Signe de vie de l'analyse (plusieurs requêtes) : évite qu'elle passe pour interrompue */
const touchJob = (): Promise<CompareJob | null> => updateJob((job) => job && reduceJob(job, { type: 'touch', at: Date.now() }));

/** COMPARE_LISTS : lit les deux listes complètes et calcule les écarts. Ne lève jamais. */
export async function compareServiceLists(): Promise<CompareResult> {
  if (!(await bothConnected())) return notConnected();
  // Réservation de la tâche sous verrou : une seule analyse ou un seul alignement à la fois (filet de sécurité, le popup désactive les boutons)
  let started: CompareJob | null = null;
  await updateJob((job) => {
    if (isJobActive(job, Date.now())) return job;
    started = startAnalyzeJob(Date.now());
    return started;
  });
  if (started === null) return isBusy();
  const startedAt = (started as CompareJob).startedAt;

  try {
    const [anilist, malRaw, scoreFormat] = await Promise.all([fetchAniListFullList(), fetchMalFullList(), getScoreFormat()]);
    await touchJob();
    const knownMalIds = new Set(anilist.flatMap((e) => (e.malId !== null ? [e.malId] : [])));
    const mal = await resolveMalOnly(malRaw, knownMalIds);
    const result = compareLists({ anilist, mal, scoreFormat }, Date.now());
    log.info(`Comparaison : ${result.counts.compared} séries, ${result.counts.different} écarts, ${result.counts.notComparable} non comparables`);
    await writeComparison(result);
    return { ok: true, data: result };
  } catch (error: unknown) {
    if (error instanceof ApiError) return { ok: false, code: error.code, message: error.message };
    log.error('Erreur inattendue (comparaison) :', error);
    return { ok: false, code: 'API_ERROR', message: t('compare.error.unexpected') };
  } finally {
    // Retire seulement NOTRE analyse (une tâche plus récente a pu la remplacer si celle-ci a été jugée interrompue)
    await updateJob((job) => (job?.kind === 'analyze' && job.startedAt === startedAt ? null : job));
  }
}

// ─── Alignement (tâche reprenable) ────────────────────────────────────────

/** Espacement minimal entre deux écritures MyAnimeList (pas de limite publiée : ~60 écritures/min) */
export const MAL_WRITE_GAP_MS = 1_000;
/** Espacement minimal entre deux écritures AniList (limite ~90 requêtes/min) */
export const ANILIST_WRITE_GAP_MS = 750;
const WRITE_GAP_MS: Record<TrackerId, number> = { anilist: ANILIST_WRITE_GAP_MS, mal: MAL_WRITE_GAP_MS };

/** Signe de vie pendant une requête ou une pause : la tâche ne passe jamais pour interrompue */
const HEARTBEAT_MS = 10_000;

/**
 * Attentes avant de retenter la MÊME série, par type d'erreur passagère (la longueur fixe le nombre d'essais) :
 * - rate-limit : 429 persistant (le client a déjà attendu Retry-After une fois) ;
 * - server : 502 / 503 / 504 ou délai dépassé (MAL surchargé répond 504 après une longue attente) ;
 * - network : connexion perdue.
 */
export const RETRY_DELAYS_MS: Record<'rate-limit' | 'server' | 'network', readonly number[]> = {
  'rate-limit': [60_000, 120_000, 240_000],
  server: [5_000, 15_000],
  network: [30_000, 60_000],
};

/** Erreurs qui feraient échouer toutes les séries suivantes : la tâche s'arrête */
const FATAL_CODES: ReadonlySet<ApiErrorCode> = new Set(['NOT_AUTHENTICATED', 'TOKEN_INVALID', 'RATE_LIMITED', 'NETWORK']);

export type TransientKind = 'rate-limit' | 'server' | 'network';

/** Erreur passagère qui mérite une nouvelle tentative de la même série (pur, testé) */
export function transientKind(error: unknown): TransientKind | null {
  if (!(error instanceof ApiError)) return null;
  if (error.code === 'RATE_LIMITED') return 'rate-limit';
  if (error.timedOut || (error.httpStatus !== null && [500, 502, 503, 504].includes(error.httpStatus))) return 'server';
  if (error.code === 'NETWORK') return 'network';
  return null;
}

type StepResult =
  | { kind: 'event'; event: JobEvent; stop: string | null }
  /** Erreur passagère : attendre puis retenter la même série */
  | { kind: 'retry'; reason: TransientKind; service: TrackerId; error: string };

/** Exécute `task` en entretenant le signe de vie (mémoire + tâche stockée) toutes les 10 s */
async function withHeartbeat<T>(task: () => Promise<T>): Promise<T> {
  const timer = setInterval(() => {
    loopBeat = Date.now();
    void updateJob((job) => job && reduceJob(job, { type: 'touch', at: Date.now() }));
  }, HEARTBEAT_MS);
  try {
    return await task();
  } finally {
    clearInterval(timer);
  }
}

/** Traite UNE série de la tâche : écrit les valeurs de `source` sur l'autre service. Ne lève jamais. */
async function processItem(item: ApplyDiffItem, source: TrackerId, isLastAttempt: (reason: TransientKind) => boolean): Promise<StepResult> {
  const at = (): number => Date.now();
  const stop = (message: string): StepResult => ({ kind: 'event', event: { type: 'stop', message, at: at() }, stop: message });
  const comparison = await readComparison();
  if (!comparison) return stop(t('compare.error.noComparison'));
  const diff = findDiff(comparison, item);
  // Déjà alignée (autre action, analyse relancée) : rien à faire
  if (!diff) return { kind: 'event', event: { type: 'item', outcome: 'skipped', message: t('compare.skip.nothing'), at: at() }, stop: null };

  const plan = planApply(diff, source);
  if (plan.action === 'skip') {
    const message = skipReasonText(plan.reason, source);
    log.info(`Alignement ignoré : ${diff.title} (${message})`);
    return { kind: 'event', event: { type: 'item', outcome: 'skipped', message, at: at() }, stop: null };
  }
  const tracker = (await getConnectedTrackers()).find((tr) => tr.id === plan.target);
  if (!tracker) return stop(t('compare.error.notConnected'));

  await sleep(Math.max(0, lastWriteAt + WRITE_GAP_MS[plan.target] - Date.now()));
  lastWriteAt = Date.now();
  const label = TRACKER_LABELS[plan.target];
  try {
    await tracker.saveEntry(plan.id, plan.write);
    log.info(`${label} : ${diff.title} aligné sur ${TRACKER_LABELS[source]}${plan.create ? ' (ajout)' : ''}`, plan.write);
    await writeComparison(withoutDiff((await readComparison()) ?? comparison, diff.key));
    return { kind: 'event', event: { type: 'item', outcome: 'updated', at: at() }, stop: null };
  } catch (error: unknown) {
    const message = error instanceof ApiError ? error.message : t('error.unexpected');
    const transient = transientKind(error);
    if (transient !== null && !isLastAttempt(transient)) {
      log.warn(`${label} : erreur passagère pour ${diff.title} (${message}), nouvelle tentative`);
      return { kind: 'retry', reason: transient, service: plan.target, error: message };
    }
    // Journal local : chaque échec est consigné (rapport de diagnostic) ; la série reste listée avec son erreur
    log.warn(`${label} : échec de l’alignement de ${diff.title} :`, message);
    await writeComparison(withDiffError((await readComparison()) ?? comparison, diff.key, message));
    // Service surchargé : la série échoue mais la tâche continue ; session expirée, réseau, limite persistante : arrêt
    const fatal = error instanceof ApiError && transient !== 'server' && FATAL_CODES.has(error.code);
    return { kind: 'event', event: { type: 'item', outcome: 'failed', message, at: at() }, stop: fatal ? message : null };
  }
}

/** Attend la fin de la pause par tranches (signe de vie entretenu) ; s'interrompt sur « Arrêter » */
async function waitPause(until: number, generation: number): Promise<void> {
  while (Date.now() < until && generation === loopGeneration) {
    loopBeat = Date.now();
    await sleep(Math.min(5_000, until - Date.now()));
    const job = await updateJob((j) => j && reduceJob(j, { type: 'touch', at: Date.now() }));
    if (!job || job.status !== 'running' || job.cancelled) return;
  }
}

let lastWriteAt = 0;
/** Génération de la boucle : une boucle plus récente (reprise après blocage) fait sortir l'ancienne */
let loopGeneration = 0;
let loopRunning = false;
let loopBeat = 0;

/** Démarre la boucle d'alignement si aucune boucle vivante ne tourne dans ce service worker */
export function ensureApplyLoop(): void {
  const now = Date.now();
  // Le signe de vie est entretenu pendant les requêtes et les pauses : une boucle muette depuis 60 s est
  // réellement bloquée ; elle est remplacée, le drapeau ne peut pas bloquer indéfiniment
  if (loopRunning && now - loopBeat < JOB_STALE_MS) return;
  if (loopRunning) log.warn('Boucle d’alignement sans signe de vie : relance');
  const generation = ++loopGeneration;
  loopRunning = true;
  loopBeat = now;
  void runApplyLoop(generation)
    .catch((error: unknown) => log.error('Boucle d’alignement interrompue :', error))
    .finally(() => {
      if (generation === loopGeneration) loopRunning = false;
    });
}

/**
 * Traite les séries de la tâche une par une, jusqu'à la fin, un « Arrêter » ou une erreur bloquante.
 * Erreur passagère : pause visible (compte à rebours dans le popup) puis nouvelle tentative de la même série.
 * Chaque appel au stockage prolonge la vie du service worker ; s'il est quand même arrêté,
 * l'alarme de reprise relance la boucle sur les séries restantes (stockées dans la tâche).
 */
async function runApplyLoop(generation: number): Promise<void> {
  // Tâche sans signe de vie depuis 60 s : service worker arrêté puis relancé → « Reprise… » affiché
  const initial = await readJob();
  if (isJobStale(initial, Date.now())) {
    log.info('Reprise d’un alignement interrompu');
    await updateJob((j) => j && reduceJob(j, { type: 'pause', until: Date.now(), reason: 'resume', service: null, at: Date.now() }));
  }

  /** Essais déjà faits pour la série en tête de file, par type d'erreur passagère */
  let attempts: Record<TransientKind, number> = { 'rate-limit': 0, server: 0, network: 0 };
  let currentKey: string | null = null;

  while (generation === loopGeneration) {
    loopBeat = Date.now();
    const job = await readJob();
    if (!job || job.kind !== 'apply' || job.status !== 'running' || job.source === null) break;
    const item = job.pending[0];
    if (job.cancelled || !item) {
      await updateJob((j) => j && reduceJob(j, { type: 'finish', at: Date.now() }));
      break;
    }
    const key = `${item.mediaId ?? ''}:${item.malId ?? ''}`;
    if (key !== currentKey) {
      currentKey = key;
      attempts = { 'rate-limit': 0, server: 0, network: 0 };
    }

    await updateJob((j) => j && reduceJob(j, { type: 'item-start', at: Date.now() }));
    const source = job.source;
    const step = await withHeartbeat(() => processItem(item, source, (reason) => attempts[reason] >= RETRY_DELAYS_MS[reason].length));
    if (generation !== loopGeneration) break;

    if (step.kind === 'retry') {
      const delay = RETRY_DELAYS_MS[step.reason][attempts[step.reason]] ?? 0;
      attempts[step.reason]++;
      const until = Date.now() + delay;
      await updateJob((j) => j && reduceJob(j, { type: 'pause', until, reason: step.reason, service: step.service, at: Date.now() }));
      await waitPause(until, generation);
      continue;
    }

    await updateJob((j) => {
      if (!j || j.status !== 'running') return j;
      const next = step.event.type === 'item' ? reduceJob(j, step.event) : j;
      return step.stop === null ? next : reduceJob(next, { type: 'stop', message: step.stop, at: Date.now() });
    });
  }
  const job = await readJob();
  if (!job || job.status !== 'running') {
    await chrome.alarms.clear(COMPARE_JOB_ALARM);
    if (job) log.info(`Alignement ${job.status} : ${job.updated} écrites, ${job.skipped} ignorées, ${job.failed} échecs`);
  }
}

/** APPLY_DIFFS : crée la tâche d'alignement et la lance en arrière-plan ; la progression est dans `compare:job`. */
export async function applyDiffs({ items, source }: ApplyDiffsPayload): Promise<ApplyResult> {
  try {
    if (!(await bothConnected())) return notConnected();
    if (!(await readComparison())) return { ok: false, code: 'NO_COMPARISON', message: t('compare.error.noComparison') };
    let started: CompareJob | null = null;
    await updateJob((job) => {
      if (isJobActive(job, Date.now())) return job;
      started = startApplyJob(items, source, Date.now());
      return started;
    });
    if (started === null) return isBusy();
    await chrome.alarms.create(COMPARE_JOB_ALARM, { periodInMinutes: 0.5 });
    log.info(`Alignement sur ${TRACKER_LABELS[source]} : ${items.length} séries`);
    ensureApplyLoop();
    return { ok: true, data: started };
  } catch (error: unknown) {
    log.error('Erreur inattendue (alignement) :', error);
    return { ok: false, code: 'API_ERROR', message: t('compare.error.unexpected') };
  }
}

/** CANCEL_COMPARE_JOB : « Arrêter » ; la série en cours se termine, les suivantes ne sont pas traitées */
export async function cancelCompareJob(): Promise<CancelJobResult> {
  const job = await updateJob((j) => j && reduceJob(j, { type: 'cancel', at: Date.now() }));
  if (!job || job.kind !== 'apply') return { ok: false, code: 'NOT_FOUND', message: t('compare.skip.nothing') };
  // Service worker redémarré : la boucle relancée constate l'arrêt et clôt la tâche
  ensureApplyLoop();
  return { ok: true, data: null };
}

/**
 * Alarme de reprise (et démarrage du navigateur) : relance un alignement interrompu,
 * abandonne une analyse interrompue (l'utilisateur la relance), puis retire l'alarme si plus rien ne tourne.
 */
export async function resumeCompareJob(): Promise<void> {
  const job = await readJob();
  if (job?.kind === 'apply' && job.status === 'running') {
    ensureApplyLoop();
    return;
  }
  if (job?.kind === 'analyze' && isJobStale(job, Date.now())) await updateJob((j) => (j?.kind === 'analyze' && isJobStale(j, Date.now()) ? null : j));
  await chrome.alarms.clear(COMPARE_JOB_ALARM);
}
