import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { EpisodeInfo } from '../shared/episode.types';
import { startJob } from '../shared/job';
import { PENDING_RATINGS_KEY, STORAGE_KEYS, SYNC_ACTIVITY_KEY, SYNC_QUEUE_KEY } from '../protocol/storage-keys';
import { installFakeChrome } from '../test/fake-chrome';
import { createStatusBarSource, type StatusBarSource } from './status-bar-source';

// Données de la barre d'état lues par la page (popup, panneau) dans le stockage et suivies par storage.onChanged :
// compteurs, synchros récentes et marques « vu », tâches d'import et d'alignement, signal « Synchro… »

const fake = installFakeChrome();

const episode = (n: number): EpisodeInfo => ({
  platform: 'crunchyroll',
  episodeId: `EP${n}`,
  seriesId: `G${n}`,
  seriesSlug: 'serie',
  animeTitle: 'Série',
  seasonNumber: 1,
  seasonTitle: null,
  seasonEpisodeNumber: n,
  displayedEpisodeNumber: n,
  episodeTitle: null,
  url: `https://www.crunchyroll.com/watch/EP${n}`,
});
const review = (n: number) => ({ key: `crunchyroll:G${n}:s1`, episode: episode(n), reason: 'À vérifier', suggestion: null, candidates: [], previous: null, createdAt: n });
const queued = (n: number, status: 'pending' | 'failed') => ({ id: `crunchyroll:EP${n}`, episode: episode(n), services: null, attempts: 1, status, nextAttemptAt: 1, firstFailedAt: 1, lastError: 'Hors ligne' });
const rating = (n: number) => ({ id: `anilist:${n}`, mediaId: n, malId: null, title: `Série ${n}`, coverUrl: null, completedAt: n });
const recent = (n: number, syncedAt: number) => ({ key: `crunchyroll:G${n}:s1`, episode: episode(n), mediaId: n, mediaTitle: `Fiche ${n}`, progress: n, syncedAt });

/** Tâche d'import ou d'alignement au format stocké (curseur, PERF-16) */
function crJob(kind: 'cr-analyze' | 'cr-apply', patch: Record<string, unknown> = {}) {
  return { ...startJob(kind, ['s:0', 's:1', 's:2'], 100).job, ...patch };
}
function compareJob(kind: 'analyze' | 'apply', patch: Record<string, unknown> = {}) {
  return { ...startJob(kind, kind === 'apply' ? [{ mediaId: 1, malId: 2 }] : [], 100).job, source: kind === 'apply' ? 'anilist' : null, ...patch };
}

let source: StatusBarSource | null = null;
/** Changements de stockage livrés (évènements en microtâche) puis relectures terminées */
const settle = async (): Promise<void> => {
  for (let i = 0; i < 5; i++) await new Promise((resolve) => setTimeout(resolve, 0));
};

beforeEach(() => {
  fake.reset();
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  source?.dispose();
  source = null;
  vi.restoreAllMocks();
});

async function start(): Promise<StatusBarSource> {
  source = createStatusBarSource();
  await source.load();
  return source;
}

describe('createStatusBarSource : lecture', () => {
  it('compteurs, synchros récentes, marques « vu » et signal « Synchro… »', async () => {
    fake.local.seed({
      [STORAGE_KEYS.pendingReviews]: [review(1), review(2)],
      [SYNC_QUEUE_KEY]: [queued(1, 'failed'), queued(2, 'pending'), queued(3, 'pending')],
      [PENDING_RATINGS_KEY]: [rating(1)],
      [STORAGE_KEYS.recentSyncs]: [recent(1, 10), recent(2, 20)],
      [STORAGE_KEYS.syncsSeenAt]: 15,
      [STORAGE_KEYS.importSeenAt]: 5,
    });
    await fake.session.set({ [SYNC_ACTIVITY_KEY]: { startedAt: 30 } });
    const { store } = await start();
    expect(store.get()).toMatchObject({
      reviews: 2,
      queue: { failed: 1, pending: 2 },
      toRate: 1,
      syncsSeenAt: 15,
      importSeenAt: 5,
      syncStartedAt: 30,
      importJob: null,
      alignJob: null,
    });
    expect(store.get().recentSyncs.map((s) => s.syncedAt)).toEqual([20, 10]);
  });

  it('valeurs illisibles : comptes à zéro, marques nulles', async () => {
    fake.local.seed({ [STORAGE_KEYS.syncsSeenAt]: 'hier', [STORAGE_KEYS.crImportJob]: { kind: 'cr-analyze' } });
    const { store } = await start();
    expect(store.get()).toMatchObject({ reviews: 0, queue: { failed: 0, pending: 0 }, toRate: 0, recentSyncs: [], syncsSeenAt: null, importJob: null, syncStartedAt: null });
  });
});

describe('createStatusBarSource : tâches', () => {
  it('analyse en cours : plateforme lue dans l’historique en attente (une fois par tâche)', async () => {
    fake.local.seed({ [STORAGE_KEYS.crImportJob]: crJob('cr-analyze', { done: 1 }), [STORAGE_KEYS.crImportInput]: { platform: 'adn', seasons: [] } });
    const { store } = await start();
    expect(store.get().importJob).toEqual({ phase: 'analyze', status: 'running', done: 1, total: 3, updated: 0, updatedAt: 100, platform: 'adn', planItems: null });
    // Signe de vie : la tâche seule est relue, pas l'historique (jusqu'à quelques centaines de Ko)
    const get = vi.spyOn(fake.local, 'get');
    await fake.local.set({ [STORAGE_KEYS.crImportJob]: crJob('cr-analyze', { done: 2, cursor: 2, updatedAt: 200 }) });
    await settle();
    expect(store.get().importJob).toMatchObject({ done: 2, updatedAt: 200, platform: 'adn' });
    expect(get.mock.calls.flat().flat()).not.toContain(STORAGE_KEYS.crImportInput);
  });

  it('historique sans plateforme (avant l’import ADN) : Crunchyroll', async () => {
    fake.local.seed({ [STORAGE_KEYS.crImportJob]: crJob('cr-analyze'), [STORAGE_KEYS.crImportInput]: { seasons: [] } });
    expect((await start()).store.get().importJob?.platform).toBe('crunchyroll');
  });

  it('analyse terminée : séries de l’aperçu à valider ; application : plateforme de l’aperçu', async () => {
    fake.local.seed({
      [STORAGE_KEYS.crImportJob]: crJob('cr-analyze', { status: 'done', done: 3, cursor: 3 }),
      [STORAGE_KEYS.crImportPlan]: { platform: 'netflix', items: [{}, {}], review: [] },
    });
    const { store } = await start();
    expect(store.get().importJob).toMatchObject({ phase: 'analyze', status: 'done', platform: 'netflix', planItems: 2 });
    await fake.local.set({ [STORAGE_KEYS.crImportJob]: crJob('cr-apply', { startedAt: 300, updated: 1 }) });
    await settle();
    expect(store.get().importJob).toMatchObject({ phase: 'apply', status: 'running', platform: 'netflix', updated: 1 });
  });

  it('alignement des listes en cours ; analyse des écarts : rien (rapide, affichée par Activité)', async () => {
    fake.local.seed({ [STORAGE_KEYS.compareJob]: compareJob('apply') });
    const { store } = await start();
    expect(store.get().alignJob).toEqual({ status: 'running', done: 0, total: 1, updatedAt: 100 });
    await fake.local.set({ [STORAGE_KEYS.compareJob]: compareJob('analyze') });
    await settle();
    expect(store.get().alignJob).toBeNull();
    await fake.local.remove(STORAGE_KEYS.compareJob);
    await settle();
    expect(store.get().alignJob).toBeNull();
  });

  it('tâche d’une version précédente (file `pending`, sans curseur) : ignorée', async () => {
    const { cursor: _cursor, itemCount: _count, ...legacy } = crJob('cr-apply');
    fake.local.seed({ [STORAGE_KEYS.crImportJob]: { ...legacy, pending: ['s:0'] } });
    expect((await start()).store.get().importJob).toBeNull();
  });
});

describe('createStatusBarSource : suivi du stockage', () => {
  it('nouvelle vérification, nouvelle synchro, file et notes suivies ; « Synchro… » suivi dans storage.session', async () => {
    const { store } = await start();
    await fake.local.set({ [STORAGE_KEYS.pendingReviews]: [review(1)], [STORAGE_KEYS.recentSyncs]: [recent(1, 10)], [SYNC_QUEUE_KEY]: [queued(1, 'failed')], [PENDING_RATINGS_KEY]: [rating(1), rating(2)] });
    await fake.session.set({ [SYNC_ACTIVITY_KEY]: { startedAt: 30 } });
    await settle();
    expect(store.get()).toMatchObject({ reviews: 1, queue: { failed: 1, pending: 0 }, toRate: 2, syncStartedAt: 30 });
    expect(store.get().recentSyncs).toHaveLength(1);
    await fake.session.remove(SYNC_ACTIVITY_KEY);
    await settle();
    expect(store.get().syncStartedAt).toBeNull();
  });

  it('marque « vu » écrite dans storage.local (survit à la fermeture du popup), relue par les autres pages', async () => {
    const first = await start();
    const other = createStatusBarSource();
    await other.load();
    await first.markSeen('syncs', 1234);
    await first.markSeen('import', 5678);
    await settle();
    expect(fake.local.peek(STORAGE_KEYS.syncsSeenAt)).toBe(1234);
    expect(fake.local.peek(STORAGE_KEYS.importSeenAt)).toBe(5678);
    expect(first.store.get()).toMatchObject({ syncsSeenAt: 1234, importSeenAt: 5678 });
    expect(other.store.get()).toMatchObject({ syncsSeenAt: 1234, importSeenAt: 5678 });
    other.dispose();
  });

  it('dispose : écouteur du stockage retiré', async () => {
    const { store } = await start();
    source?.dispose();
    source = null;
    await fake.local.set({ [STORAGE_KEYS.pendingReviews]: [review(1)] });
    await settle();
    expect(store.get().reviews).toBe(0);
  });
});
