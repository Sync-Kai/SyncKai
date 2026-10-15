// Activité › « Écarts AniList ↔ MAL » : dernière analyse et tâche d'alignement (lues du stockage, suivies par
// storage.onChanged), demandes au service worker et compte à rebours d'une pause d'alignement.
import { COMPARE_STORAGE_KEY, isComparisonResult, type ApplyResult, type CompareResult, type DiffFilter, type ListDiff } from '../../shared/compare';
import { COMPARE_JOB_KEY, isCompareJob, type CompareJob } from '../../shared/compare-job';
import { createLogger } from '../../browser/logger';
import { withStorageLock } from '../../browser/storage/lock';
import type { TrackerId } from '../../shared/tracker.types';
import { createStore, patchStore, type Store } from '../../ui/state';
import { callWorker, networkFailure } from '../../ui/worker-call';
import { COMPARE_PAGE_SIZE } from '../components/compare-section';
import type { CompareState } from '../state';

const log = createLogger('popup');
const PAUSE_TICK_MS = 1_000;

export interface CompareControllerDeps {
  /** Alignement terminé avec au moins une série mise à jour : « En cours » est à relire */
  onApplied(): void;
  /** Pause d'alignement en cours (limite de requêtes, service lent) : compte à rebours mis à jour chaque seconde */
  onPauseTick(job: CompareJob, now: number): void;
}

export interface CompareController {
  readonly store: Store<CompareState>;
  /** Dernière analyse et dernière tâche (stockage) : affichées à la réouverture du popup */
  load(): Promise<void>;
  analyze(): Promise<void>;
  /** Lance l'alignement (une série ou un lot) : traité en arrière-plan, la progression arrive par le stockage */
  apply(diffs: readonly ListDiff[], source: TrackerId): Promise<void>;
  /** Confirmation « Tout aligner sur … » affichée (null : masquée) */
  setConfirm(source: TrackerId | null): void;
  setFilter(filter: DiffFilter): void;
  showMore(): void;
  cancel(): Promise<void>;
  /** « OK » sur le bilan : la tâche terminée est retirée du stockage (jamais une tâche en cours) */
  dismissJob(): Promise<void>;
  dispose(): void;
}

/** Pause dont le compte à rebours avance (une reprise après redémarrage n'en a pas) */
function isCountingDown(job: CompareJob | null): job is CompareJob {
  return job?.status === 'running' && job.pausedUntil !== null && job.pauseReason !== 'resume';
}

export function createCompareController(deps: CompareControllerDeps): CompareController {
  const store = createStore<CompareState>({ result: null, job: null, requesting: null, error: null, confirm: null, filter: 'all', shown: COMPARE_PAGE_SIZE });
  const patch = (next: Partial<CompareState>): void => patchStore(store, next);

  function setComparison(value: unknown): void {
    patch({ result: isComparisonResult(value) ? value : null });
  }

  /** Tâche en cours (progression) ou bilan du dernier alignement ; un alignement qui se termine relit « En cours » */
  function setJob(value: unknown): void {
    const previous = store.get().job;
    const job = isCompareJob(value) ? value : null;
    patch({ job });
    const finished = previous?.status === 'running' && job !== null && job.kind === 'apply' && job.status !== 'running';
    if (finished && job.updated > 0) deps.onApplied();
  }

  // Compte à rebours : seul le texte change chaque seconde (sans nouveau rendu), minuterie active pendant la pause seulement
  let pauseTimer: ReturnType<typeof setInterval> | undefined;
  const unsubscribePause = store.subscribe(({ job }) => {
    if (!isCountingDown(job)) {
      clearInterval(pauseTimer);
      pauseTimer = undefined;
    } else if (pauseTimer === undefined) {
      pauseTimer = setInterval(() => {
        const current = store.get().job;
        if (isCountingDown(current)) deps.onPauseTick(current, Date.now());
      }, PAUSE_TICK_MS);
    }
  });

  const onStorageChanged = (changes: Record<string, chrome.storage.StorageChange>, areaName: string): void => {
    if (areaName !== 'local') return;
    const compareChange = changes[COMPARE_STORAGE_KEY];
    if (compareChange) setComparison(compareChange.newValue);
    const jobChange = changes[COMPARE_JOB_KEY];
    if (jobChange) setJob(jobChange.newValue);
  };
  chrome.storage.onChanged.addListener(onStorageChanged);

  return {
    store,

    async load() {
      try {
        const stored = await chrome.storage.local.get([COMPARE_STORAGE_KEY, COMPARE_JOB_KEY]);
        setComparison(stored[COMPARE_STORAGE_KEY]);
        setJob(stored[COMPARE_JOB_KEY]);
      } catch (error: unknown) {
        log.warn('Lecture de la dernière comparaison impossible :', error);
      }
    },

    async analyze() {
      if (store.get().requesting !== null) return;
      patch({ requesting: 'analyze', error: null, confirm: null });
      const result: CompareResult = await callWorker('COMPARE_LISTS', null, networkFailure);
      if (result.ok) patch({ requesting: null, result: result.data, shown: COMPARE_PAGE_SIZE });
      else patch({ requesting: null, error: result.message });
    },

    async apply(diffs, source) {
      if (diffs.length === 0 || store.get().requesting !== null) return;
      patch({ requesting: 'apply', confirm: null, error: null });
      const result: ApplyResult = await callWorker('APPLY_DIFFS', { items: diffs.map((d) => ({ mediaId: d.mediaId, malId: d.malId })), source }, networkFailure);
      // Tâche acceptée : affichée tout de suite (le changement du stockage suit)
      if (result.ok) patch({ requesting: null, job: result.data });
      else patch({ requesting: null, error: result.message });
    },

    setConfirm(source) {
      patch({ confirm: source });
    },

    setFilter(filter) {
      patch({ filter, shown: COMPARE_PAGE_SIZE, confirm: null });
    },

    showMore() {
      patch({ shown: store.get().shown + COMPARE_PAGE_SIZE });
    },

    async cancel() {
      const job = store.get().job;
      if (job) patch({ job: { ...job, cancelled: true } });
      // Seul l'échec d'envoi est affiché (l'arrêt lui-même est déjà reflété dans la tâche, une réponse « rien à arrêter » est ignorée)
      await callWorker('CANCEL_COMPARE_JOB', null, (message) => {
        patch({ error: message });
        return { ok: false, code: 'NOT_FOUND', message };
      });
    },

    async dismissJob() {
      try {
        await withStorageLock(async () => {
          const stored = await chrome.storage.local.get(COMPARE_JOB_KEY);
          const job: unknown = stored[COMPARE_JOB_KEY];
          if (!isCompareJob(job) || job.status !== 'running') await chrome.storage.local.remove(COMPARE_JOB_KEY);
        });
      } catch (error: unknown) {
        log.warn('Suppression du bilan d’alignement impossible :', error);
      }
    },

    dispose() {
      chrome.storage.onChanged.removeListener(onStorageChanged);
      unsubscribePause();
      clearInterval(pauseTimer);
    },
  };
}
