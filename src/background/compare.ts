import { t } from '../i18n';
import {
  compareLists,
  COMPARE_STORAGE_KEY,
  findDiff,
  isAlignedNow,
  planApply,
  sideMatches,
  skipReasonText,
  withDiffError,
  withoutDiff,
  withStaleDiffs,
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
  reduceJob,
  startAnalyzeJob,
  startApplyJob,
  type CompareJob,
} from '../shared/compare-job';
import { isRecord } from '../shared/guards';
import { getCachedViewer, STORAGE_KEYS, withStorageLock } from '../shared/storage';
import { TRACKER_LABELS, type TrackerId } from '../shared/tracker.types';
import { anilistPublicQuery, anilistQuery } from './api/client';
import { ApiError } from './api/errors';
import { getScoreFormat } from './api/list';
import { malRequest } from './api/mal';
import { getViewer } from './api/viewer';
import { parseAniListCollection, parseMalListPage } from './compare-parse';
import { readComparison, updateComparison } from './compare-snapshot';
import {
  createJobLoop,
  createJobStore,
  isFatalError,
  trackBudgetWaits,
  transientKind,
  waitReadSlot,
  waitWriteSlot,
  type StepResult,
  type TransientKind,
} from './jobs/runner';
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

/** Liste complète : requêtes de fond (comparaison, import Crunchyroll), budget limité */
export async function fetchAniListFullList(): Promise<ReturnType<typeof parseAniListCollection>> {
  const userId = await getAniListUserId();
  const entries: ReturnType<typeof parseAniListCollection> = [];
  for (let chunk = 1; chunk <= MAX_ANILIST_CHUNKS; chunk++) {
    const { MediaListCollection } = await anilistQuery(ANILIST_FULL_LIST_QUERY, isCollectionData, { userId, chunk, perChunk: ANILIST_CHUNK }, 'background');
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

export async function fetchMalFullList(): Promise<MalListEntry[]> {
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
    const { Page } = await anilistPublicQuery(CATALOG_BY_MAL_QUERY, isPageData, { ids: missing.slice(i, i + CATALOG_CHUNK) }, 'background');
    for (const media of Page.media) {
      if (isRecord(media) && typeof media.id === 'number' && typeof media.idMal === 'number' && !byMal.has(media.idMal)) byMal.set(media.idMal, media.id);
    }
  }
  return mal.map((e) => (knownMalIds.has(e.malId) ? e : { ...e, mediaId: byMal.get(e.malId) ?? null }));
}

// ─── Stockage : dernière comparaison et tâche en cours ───────────────────

/** Les deux comptes sont-ils toujours connectés ? (rien à écrire pour un compte déconnecté entre-temps) */
async function hasBothTokens(): Promise<boolean> {
  const stored = await chrome.storage.local.get([STORAGE_KEYS.anilistToken, STORAGE_KEYS.malToken]);
  return stored[STORAGE_KEYS.anilistToken] !== undefined && stored[STORAGE_KEYS.malToken] !== undefined;
}

/** Nouvelle analyse : remplace la comparaison, sous verrou (une invalidation en cours ne la réécrase pas) */
function writeComparison(result: ComparisonResult): Promise<void> {
  return withStorageLock(async () => {
    if (await hasBothTokens()) await chrome.storage.local.set({ [COMPARE_STORAGE_KEY]: result });
  });
}

/** Tâche d'analyse ou d'alignement (`compare:job`), écrite sous verrou par le popup (« Arrêter ») et la boucle */
const jobStore = createJobStore(COMPARE_JOB_KEY, isCompareJob);
const readJob = (): Promise<CompareJob | null> => jobStore.read();
const updateJob = (update: (job: CompareJob | null) => CompareJob | null): Promise<CompareJob | null> => jobStore.update(update);

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
  // Attente du quota AniList (requêtes de fond) affichée sous le bouton d'analyse ; elle entretient aussi la tâche
  const stopTracking = trackBudgetWaits(jobStore);

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
    await stopTracking();
    // Retire seulement NOTRE analyse (une tâche plus récente a pu la remplacer si celle-ci a été jugée interrompue)
    await updateJob((job) => (job?.kind === 'analyze' && job.startedAt === startedAt ? null : job));
  }
}

// ─── Alignement (tâche reprenable) ────────────────────────────────────────

// Espacement des écritures, erreurs passagères et boucle reprenable : src/background/jobs/runner.ts
export { ANILIST_WRITE_GAP_MS, MAL_WRITE_GAP_MS, RETRY_DELAYS_MS, transientKind, type TransientKind } from './jobs/runner';

/**
 * Traite UNE série de la tâche : écrit les valeurs de `source` sur l'autre service. Ne lève jamais.
 * Les deux entrées sont relues juste avant l'écriture : si l'une a changé depuis l'analyse (synchro en direct,
 * contrôle, autre appareil), la série est ignorée et marquée « à réanalyser » ; l'instantané n'est jamais réécrit.
 */
async function processItem(item: ApplyDiffItem, source: TrackerId, isLastAttempt: (reason: TransientKind) => boolean): Promise<StepResult> {
  const at = (): number => Date.now();
  const stop = (message: string): StepResult => ({ kind: 'event', event: { type: 'stop', message, at: at() }, stop: message });
  const skipped = (message: string): StepResult => ({ kind: 'event', event: { type: 'item', outcome: 'skipped', message, at: at() }, stop: null });
  const comparison = await readComparison();
  if (!comparison) return stop(t('compare.error.noComparison'));
  const diff = findDiff(comparison, item);
  // Déjà alignée (autre action, analyse relancée) : rien à faire
  if (!diff) return skipped(t('compare.skip.nothing'));

  const plan = planApply(diff, source);
  if (plan.action === 'skip') {
    const message = skipReasonText(plan.reason, source);
    log.info(`Alignement ignoré : ${diff.title} (${message})`);
    return skipped(message);
  }
  const trackers = await getConnectedTrackers();
  const tracker = trackers.find((tr) => tr.id === plan.target);
  const origin = trackers.find((tr) => tr.id === source);
  // Source présente dans l'instantané : son identifiant est connu (fiche AniList ou id MAL)
  const sourceId = source === 'mal' ? diff.malId : diff.mediaId;
  if (!tracker || !origin) return stop(t('compare.error.notConnected'));
  if (sourceId === null) return skipped(skipReasonText('no-equivalent', source));

  // Créneau d'écriture pris avant les relectures : aucune attente entre la relecture de la cible et l'écriture
  await waitWriteSlot(plan.target);
  const label = TRACKER_LABELS[plan.target];
  try {
    // Verrou par fiche (withEntryLock, pas encore disponible) : il envelopperait les relectures et l'écriture ci-dessous
    await waitReadSlot(source);
    const from = (await origin.getEntry(sourceId)).entry;
    await waitReadSlot(plan.target);
    const to = (await tracker.getEntry(plan.id)).entry;
    const { scoreFormat } = comparison;

    if (isAlignedNow(source === 'anilist' ? from : to, source === 'mal' ? from : to, scoreFormat)) {
      log.info(`Alignement inutile : ${diff.title} est déjà alignée`);
      await updateComparison((result) => withoutDiff(result, diff.key));
      return skipped(t('compare.skip.nothing'));
    }
    if (!sideMatches(diff[source], from, source, scoreFormat) || !sideMatches(diff[plan.target], to, plan.target, scoreFormat)) {
      const message = skipReasonText('changed', source);
      log.info(`Alignement ignoré : ${diff.title} modifiée depuis l'analyse`, { analyse: { [source]: diff[source], [plan.target]: diff[plan.target] }, relu: { [source]: from, [plan.target]: to } });
      await updateComparison((result) => withStaleDiffs(result, (d) => d.key === diff.key));
      return skipped(message);
    }

    await tracker.saveEntry(plan.id, plan.write);
    log.info(`${label} : ${diff.title} aligné sur ${TRACKER_LABELS[source]}${plan.create ? ' (ajout)' : ''}`, plan.write);
    await updateComparison((result) => withoutDiff(result, diff.key));
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
    await updateComparison((result) => withDiffError(result, diff.key, message));
    // Service surchargé : la série échoue mais la tâche continue ; session expirée, réseau, limite persistante : arrêt
    return { kind: 'event', event: { type: 'item', outcome: 'failed', message, at: at() }, stop: isFatalError(error) ? message : null };
  }
}

/** Boucle d'alignement (une par service worker) : séries traitées une par une, reprise par l'alarme */
const applyLoop = createJobLoop<CompareJob>({
  label: 'alignement',
  log,
  store: jobStore,
  alarm: COMPARE_JOB_ALARM,
  accepts: (job) => job.kind === 'apply' && job.source !== null,
  itemKey: (item) => `${item.mediaId ?? ''}:${item.malId ?? ''}`,
  process: async (job, item, isLastAttempt) =>
    job.source === null ? { kind: 'event', event: { type: 'finish', at: Date.now() }, stop: null } : processItem(item, job.source, isLastAttempt),
  onEnd: (job) => log.info(`Alignement ${job.status} : ${job.updated} écrites, ${job.skipped} ignorées, ${job.failed} échecs`),
});

/** Démarre la boucle d'alignement si aucune boucle vivante ne tourne dans ce service worker */
export function ensureApplyLoop(): void {
  applyLoop.ensure();
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
