// Données de la barre d'état (popup et panneau latéral), lues par la page dans le stockage puis suivies par
// storage.onChanged (aucun message ni écouteur du service worker) : cartes « À vérifier », file de synchro, notes
// reportées, dernières synchros, marques « vu », tâches d'import et d'alignement (curseur de background/jobs/runner.ts),
// signal « Synchro… » (storage.session). Seule écriture : la marque « vu » (×, clic sur le message).
import { isImportPlatform, isCrImportJob, type CrImportJob, type ImportPlatform } from '../shared/cr-import';
import { isCompareJob } from '../shared/compare-job';
import { isRecord } from '../shared/guards';
import type { RecentSync } from '../shared/review.types';
import { PENDING_RATINGS_KEY, STORAGE_KEYS, SYNC_ACTIVITY_KEY, SYNC_QUEUE_KEY } from '../protocol/storage-keys';
import { getPendingRatings } from '../browser/storage/engagement-store';
import { getPendingReviews, getRecentSyncs } from '../browser/storage/reviews';
import { getSyncQueue } from '../browser/storage/sync-queue-store';
import { isSyncActivity, syncStartedAt } from '../browser/storage/sync-activity';
import { createLogger } from '../browser/logger';
import { createStore, patchStore, type ReadonlyStore } from './state';
import type { AlignJobView, ImportJobView } from './status-bar-model';

const log = createLogger('status-bar');

export interface StatusBarData {
  reviews: number;
  queue: { failed: number; pending: number };
  toRate: number;
  recentSyncs: RecentSync[];
  syncsSeenAt: number | null;
  importSeenAt: number | null;
  importJob: ImportJobView | null;
  alignJob: AlignJobView | null;
  syncStartedAt: number | null;
}

export type SeenKind = 'syncs' | 'import';

export interface StatusBarSource {
  readonly store: ReadonlyStore<StatusBarData>;
  /** Première lecture (toutes les données) */
  load(): Promise<void>;
  /** « J'ai vu » : marque écrite dans storage.local, relue par les autres pages ouvertes */
  markSeen(kind: SeenKind, at: number): Promise<void>;
  /** Écouteur du stockage retiré */
  dispose(): void;
}

export const EMPTY_STATUS_BAR_DATA: StatusBarData = {
  reviews: 0,
  queue: { failed: 0, pending: 0 },
  toRate: 0,
  recentSyncs: [],
  syncsSeenAt: null,
  importSeenAt: null,
  importJob: null,
  alignJob: null,
  syncStartedAt: null,
};

const SEEN_KEYS: Readonly<Record<SeenKind, string>> = { syncs: STORAGE_KEYS.syncsSeenAt, import: STORAGE_KEYS.importSeenAt };

const asTime = (value: unknown): number | null => (typeof value === 'number' && Number.isFinite(value) ? value : null);

async function readKey(key: string): Promise<unknown> {
  return (await chrome.storage.local.get(key))[key];
}

/** Plateforme d'un historique en attente ou d'un aperçu (absente avant l'import ADN : Crunchyroll), sans valider le reste */
function platformOf(value: unknown): ImportPlatform {
  return isRecord(value) && isImportPlatform(value.platform) ? value.platform : 'crunchyroll';
}

/**
 * Détails d'une tâche d'import lus hors de la tâche : plateforme (historique pendant l'analyse, aperçu ensuite) et
 * séries de l'aperçu à valider. Lus une fois par tâche (`startedAt`) : la tâche est réécrite à chaque élément, ces clés
 * pèsent jusqu'à quelques centaines de Ko
 */
interface ImportDetails {
  startedAt: number;
  phase: ImportJobView['phase'];
  done: boolean;
  platform: ImportPlatform;
  planItems: number | null;
}

async function readImportDetails(job: CrImportJob): Promise<ImportDetails> {
  const phase = job.kind === 'cr-analyze' ? 'analyze' : 'apply';
  const done = job.status === 'done';
  if (phase === 'analyze' && !done) return { startedAt: job.startedAt, phase, done, platform: platformOf(await readKey(STORAGE_KEYS.crImportInput)), planItems: null };
  const plan = await readKey(STORAGE_KEYS.crImportPlan);
  const planItems = isRecord(plan) && Array.isArray(plan.items) ? plan.items.length : null;
  return { startedAt: job.startedAt, phase, done, platform: platformOf(plan), planItems: phase === 'analyze' ? planItems : null };
}

export function createStatusBarSource(): StatusBarSource {
  const store = createStore<StatusBarData>(EMPTY_STATUS_BAR_DATA);
  let details: ImportDetails | null = null;
  let disposed = false;
  const patch = (next: Partial<StatusBarData>): void => {
    if (!disposed) patchStore(store, next);
  };

  /** Lecture d'une partie : une erreur laisse la valeur précédente (barre d'état indicative) */
  const part = async (name: string, read: () => Promise<Partial<StatusBarData>>): Promise<void> => {
    try {
      patch(await read());
    } catch (error: unknown) {
      log.warn(`Barre d'état : lecture impossible (${name}) :`, error);
    }
  };

  const readers = {
    reviews: () => part('reviews', async () => ({ reviews: (await getPendingReviews()).length })),
    recent: () => part('recent', async () => ({ recentSyncs: await getRecentSyncs() })),
    queue: () =>
      part('queue', async () => {
        const items = await getSyncQueue();
        const failed = items.filter((item) => item.status === 'failed').length;
        return { queue: { failed, pending: items.length - failed } };
      }),
    ratings: () => part('ratings', async () => ({ toRate: (await getPendingRatings()).length })),
    seen: () =>
      part('seen', async () => {
        const stored = await chrome.storage.local.get([STORAGE_KEYS.syncsSeenAt, STORAGE_KEYS.importSeenAt]);
        return { syncsSeenAt: asTime(stored[STORAGE_KEYS.syncsSeenAt]), importSeenAt: asTime(stored[STORAGE_KEYS.importSeenAt]) };
      }),
    importJob: () =>
      part('import', async () => {
        const job: unknown = await readKey(STORAGE_KEYS.crImportJob);
        if (!isCrImportJob(job)) return { importJob: null };
        const phase = job.kind === 'cr-analyze' ? 'analyze' : 'apply';
        // Nouvelle tâche, autre phase ou analyse qui vient de finir : détails relus
        if (details?.startedAt !== job.startedAt || details.phase !== phase || details.done !== (job.status === 'done')) details = await readImportDetails(job);
        const { platform, planItems } = details;
        return { importJob: { phase, status: job.status, done: job.done, total: job.total, updated: job.updated, updatedAt: job.updatedAt, platform, planItems } };
      }),
    plan: async () => {
      // Aperçu écrit à la fin de l'analyse (éventuellement après la tâche) ou cartes créées : séries à valider relues.
      // Pendant l'application, l'aperçu est réécrit à chaque série : jamais relu (la plateforme ne change pas)
      if (details?.phase !== 'analyze') return;
      details = null;
      await readers.importJob();
    },
    alignJob: () =>
      part('align', async () => {
        const job: unknown = await readKey(STORAGE_KEYS.compareJob);
        // Analyse des écarts : rapide et suivie par Activité ; seul l'alignement est affiché
        if (!isCompareJob(job) || job.kind !== 'apply') return { alignJob: null };
        return { alignJob: { status: job.status, done: job.done, total: job.total, updatedAt: job.updatedAt } };
      }),
    syncing: () => part('syncing', async () => ({ syncStartedAt: await syncStartedAt() })),
  };

  const LOCAL_READERS: Readonly<Record<string, () => Promise<void>>> = {
    [STORAGE_KEYS.pendingReviews]: readers.reviews,
    [STORAGE_KEYS.recentSyncs]: readers.recent,
    [SYNC_QUEUE_KEY]: readers.queue,
    [PENDING_RATINGS_KEY]: readers.ratings,
    [STORAGE_KEYS.syncsSeenAt]: readers.seen,
    [STORAGE_KEYS.importSeenAt]: readers.seen,
    [STORAGE_KEYS.crImportJob]: readers.importJob,
    [STORAGE_KEYS.crImportPlan]: readers.plan,
    [STORAGE_KEYS.compareJob]: readers.alignJob,
  };

  const onStorageChanged = (changes: Record<string, chrome.storage.StorageChange>, areaName: string): void => {
    if (areaName === 'session') {
      const change = changes[SYNC_ACTIVITY_KEY];
      if (change) patch({ syncStartedAt: isSyncActivity(change.newValue) ? change.newValue.startedAt : null });
      return;
    }
    if (areaName !== 'local') return;
    // Une seule relecture par lecteur, même si plusieurs de ses clés changent ensemble
    const due = new Set(Object.keys(changes).flatMap((key) => LOCAL_READERS[key] ?? []));
    for (const read of due) void read();
  };
  chrome.storage.onChanged.addListener(onStorageChanged);

  return {
    store,
    load: async () => {
      await Promise.all(Object.values(readers).filter((read) => read !== readers.plan).map((read) => read()));
    },
    markSeen: async (kind, at) => {
      patch(kind === 'syncs' ? { syncsSeenAt: at } : { importSeenAt: at });
      try {
        await chrome.storage.local.set({ [SEEN_KEYS[kind]]: at });
      } catch (error: unknown) {
        log.warn('Barre d’état : marque « vu » non enregistrée :', error);
      }
    },
    dispose: () => {
      disposed = true;
      chrome.storage.onChanged.removeListener(onStorageChanged);
    },
  };
}
