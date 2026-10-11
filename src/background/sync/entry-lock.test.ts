import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setLocale } from '../../i18n';
import type { EpisodeInfo } from '../../shared/episode.types';
import type { TrackerId } from '../../shared/tracker.types';
import type { CatalogMedia, TrackerEntry, TrackerService } from '../trackers/tracker';
import type { ListEntryState } from './rules';

// Verrou par fiche : courses entre synchro en direct, relance de la file, +1 et import Crunchyroll sur la même fiche.
// Les vrais chemins (syncEpisode, adjustProgress, importOnService) tournent sur des services simulés en mémoire.

const MEDIA_ID = 154587;
const MAL_ID = 52991;

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

const fakes = vi.hoisted(() => ({
  trackers: [] as TrackerService[],
  /** Nombre d'épisodes de la fiche (catalogue et services) */
  episodes: 28,
}));

vi.mock('../trackers', () => ({
  getConnectedTrackers: async (only: readonly TrackerId[] | null = null): Promise<TrackerService[]> =>
    only ? fakes.trackers.filter((tracker) => only.includes(tracker.id)) : fakes.trackers,
}));
// Correspondance sûre : la progression est le numéro affiché
vi.mock('./resolver', () => ({
  resolveEpisode: async (episode: EpisodeInfo) => ({
    result: {
      ok: true,
      target: { mediaId: MEDIA_ID, numbering: 'displayed', offset: 0, episodes: fakes.episodes, progress: episode.displayedEpisodeNumber ?? 0, confidence: 'high', reason: 'test' },
    },
    candidates: [],
    seasons: [],
  }),
  findReviewCandidates: async () => [],
  toCandidateSummary: () => null,
}));
vi.mock('../api/media', () => ({
  getAnimeById: async (id: number) => ({ id, idMal: MAL_ID, displayTitle: 'Frieren', episodes: fakes.episodes }),
  searchAnime: async () => [],
}));
vi.mock('../../shared/badge', () => ({ flashSyncBadge: async () => undefined, refreshReviewBadge: async () => undefined }));
vi.mock('../../shared/exclusions', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../shared/exclusions')>()),
  isExcluded: async () => false,
}));
// Créneaux d'écriture et de lecture des tâches de fond, ordre relevé dans `calls`
const slots = vi.hoisted(() => ({ calls: [] as string[], writeDelayMs: 0 }));
vi.mock('../jobs/runner', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../jobs/runner')>()),
  waitWriteSlot: async (service: TrackerId): Promise<void> => {
    slots.calls.push(`writeSlot:${service}`);
    await sleep(slots.writeDelayMs);
  },
  waitReadSlot: async (service: TrackerId): Promise<void> => void slots.calls.push(`readSlot:${service}`),
}));

// ─── Web Locks simulés ───────────────────────────────────────────────────

/**
 * navigator.locks simulé avec la sémantique de Web Locks : une file FIFO par nom, noms indépendants, non réentrant.
 * Une prise imbriquée du même verrou ou un ordre de prise inversé bloquerait : le test échouerait par dépassement de délai.
 */
function fakeLocks(): LockManager['request'] {
  const tails = new Map<string, Promise<unknown>>();
  const request = <T>(name: string, task: () => Promise<T>): Promise<T> => {
    const run = (tails.get(name) ?? Promise.resolve()).then(task);
    tails.set(name, run.catch(() => undefined));
    return run;
  };
  return request as LockManager['request'];
}

// ─── Stockage et services simulés ─────────────────────────────────────────

let store: Record<string, unknown> = {};

/** Sessions AniList et MAL ouvertes (génération 0) : les écritures leur appartiennent */
const OPEN_SESSIONS = {
  anilistToken: { accessToken: 'anilist', expiresAt: Number.MAX_SAFE_INTEGER },
  malToken: { accessToken: 'mal', refreshToken: 'refresh', expiresAt: Number.MAX_SAFE_INTEGER },
};

function stubGlobals(): void {
  store = { ...OPEN_SESSIONS };
  vi.stubGlobal('chrome', {
    runtime: { id: 'synckai-test' },
    storage: {
      local: {
        get: async (keys: string | string[] | Record<string, unknown> | null): Promise<Record<string, unknown>> => {
          if (keys === null) return { ...store };
          if (typeof keys === 'object' && !Array.isArray(keys)) return Object.fromEntries(Object.entries(keys).map(([k, d]) => [k, k in store ? store[k] : d]));
          return Object.fromEntries((Array.isArray(keys) ? keys : [keys]).filter((k) => k in store).map((k) => [k, store[k]]));
        },
        set: async (items: Record<string, unknown>): Promise<void> => void Object.assign(store, items),
        remove: async (keys: string | string[]): Promise<void> => {
          for (const k of Array.isArray(keys) ? keys : [keys]) delete store[k];
        },
      },
    },
  });
  vi.stubGlobal('navigator', { language: 'fr', locks: { request: fakeLocks() } });
}

interface FakeTracker extends TrackerService {
  entries: Map<number, ListEntryState>;
  /** Progressions écrites, dans l'ordre */
  writes: number[];
}

/** Service en mémoire : lecture après 1 ms, écriture après `writeDelay(progress)` ms puis verrou du stockage (comme markSeriesStale) */
function fakeTracker(id: TrackerId, writeDelay: (progress: number) => number = () => 1): FakeTracker {
  const entries = new Map<number, ListEntryState>();
  const writes: number[] = [];
  const { withStorageLock } = storageLock;
  const save = async (entryId: number, progress: number, status: ListEntryState['status']): Promise<ListEntryState> => {
    slots.calls.push(`save:${id}`);
    await sleep(writeDelay(progress));
    const saved: ListEntryState = { status, progress };
    entries.set(entryId, saved);
    writes.push(progress);
    await withStorageLock(async () => undefined);
    return saved;
  };
  const unused = (): Promise<ListEntryState> => Promise.reject(new Error('hors test'));
  return {
    id,
    entries,
    writes,
    isConnected: async () => true,
    resolveId: (media: CatalogMedia) => (id === 'anilist' ? media.mediaId : media.idMal),
    getEntry: async (entryId: number): Promise<TrackerEntry> => {
      slots.calls.push(`read:${id}`);
      await sleep(1);
      const entry = entries.get(entryId);
      return { title: 'Frieren', episodes: fakes.episodes, entry: entry ? { ...entry } : null };
    },
    saveProgress: (entryId, progress, status) => save(entryId, progress, status),
    saveStatus: (entryId, status, progress) => save(entryId, progress, status),
    saveScore: unused,
    startRewatch: unused,
    saveEntry: unused,
  };
}

const episode = (n: number): EpisodeInfo => ({
  platform: 'crunchyroll',
  episodeId: `EP${n}`,
  seriesId: 'GG5H5XQX4',
  seriesSlug: 'frieren',
  animeTitle: 'Frieren',
  seasonNumber: 1,
  seasonTitle: null,
  seasonEpisodeNumber: n,
  displayedEpisodeNumber: n,
  episodeTitle: null,
  url: `https://www.crunchyroll.com/watch/EP${n}`,
});

stubGlobals();
const storageLock = await import('../../shared/storage-lock');
const { withEntryLock } = await import('./entry-lock');
const { syncEpisode } = await import('./sync-service');
const { adjustProgress } = await import('../controls');
const { importOnService } = await import('../cr-import');

setLocale('fr');

let anilist: FakeTracker;
let mal: FakeTracker;

/** Les deux services connectés, la fiche à `progress` (En cours) sur chacun */
function connect(progress: number, writeDelay?: (progress: number) => number): void {
  anilist = fakeTracker('anilist', writeDelay);
  mal = fakeTracker('mal', writeDelay);
  anilist.entries.set(MEDIA_ID, { status: 'CURRENT', progress });
  mal.entries.set(MAL_ID, { status: 'CURRENT', progress });
  fakes.trackers = [anilist, mal];
}

beforeEach(() => {
  stubGlobals();
  fakes.episodes = 28;
  slots.calls = [];
  slots.writeDelayMs = 0;
  vi.spyOn(console, 'info').mockImplementation(() => {});
  vi.spyOn(console, 'debug').mockImplementation(() => {});
});

afterEach(() => vi.restoreAllMocks());

describe('syncEpisode concurrents sur la même fiche', () => {
  // E5 relancé par la file (AniList seul, en échec plus tôt) et E7 en direct : l'écriture de 5, plus lente, finirait après celle de 7
  const slowFive = (progress: number): number => (progress === 5 ? 30 : 5);

  it.each([
    ['file (E5) puis direct (E7)', [5, 7]],
    ['direct (E7) puis file (E5)', [7, 5]],
  ])('%s → progression finale 7, jamais de recul', async (_label, order) => {
    connect(4, slowFive);
    const outcomes = await Promise.all(order.map((n) => syncEpisode(episode(n), n === 5 ? ['anilist'] : null)));
    expect(outcomes.every((o) => o.status === 'synced')).toBe(true);
    expect(anilist.entries.get(MEDIA_ID)).toEqual({ status: 'CURRENT', progress: 7 });
    expect(mal.entries.get(MAL_ID)).toEqual({ status: 'CURRENT', progress: 7 });
    // Écritures croissantes : E5 après E7 est relu à 7 et ignoré (à jour)
    expect(anilist.writes).toEqual([...anilist.writes].sort((a, b) => a - b));
  });
});

describe('+1 concurrents (ADJUST_PROGRESS)', () => {
  it('deux +1 simultanés (panneau et popup) → +2 sur chaque service', async () => {
    connect(5);
    const payload = { mediaId: MEDIA_ID, malId: MAL_ID, delta: 1 } as const;
    const [first, second] = await Promise.all([adjustProgress(payload), adjustProgress(payload)]);
    expect(anilist.entries.get(MEDIA_ID)?.progress).toBe(7);
    expect(mal.entries.get(MAL_ID)?.progress).toBe(7);
    const progresses = [first, second].flatMap((o) => (o.status === 'synced' ? o.results.map((r) => (r.outcome.status === 'updated' ? r.outcome.progress : null)) : []));
    expect(progresses.sort()).toEqual([6, 6, 7, 7]);
  });

  it('−1 pendant une synchro en direct : la synchro n’est pas effacée', async () => {
    connect(5);
    await Promise.all([syncEpisode(episode(6)), adjustProgress({ mediaId: MEDIA_ID, malId: MAL_ID, delta: -1 })]);
    // E6 puis −1 → 5, ou −1 puis E6 → 6 : jamais 4 (−1 appliqué sur la valeur lue avant la synchro)
    expect([5, 6]).toContain(anilist.entries.get(MEDIA_ID)?.progress);
    expect(anilist.writes).toHaveLength(2);
  });
});

describe('withEntryLock', () => {
  it('fiches différentes (autre identifiant, autre service) : aucune attente', async () => {
    let release: () => void = () => undefined;
    const holding = withEntryLock('anilist', 1, () => new Promise<void>((resolve) => (release = resolve)));
    const order: string[] = [];
    const sameEntry = withEntryLock('anilist', 1, async () => void order.push('anilist:1'));
    await Promise.all([withEntryLock('anilist', 2, async () => void order.push('anilist:2')), withEntryLock('mal', 1, async () => void order.push('mal:1'))]);
    expect(order).toEqual(['anilist:2', 'mal:1']);
    release();
    await Promise.all([holding, sameEntry]);
    expect(order).toEqual(['anilist:2', 'mal:1', 'anilist:1']);
  });

  it('verrou du stockage pris sous le verrou de la fiche : tous les chemins se terminent', async () => {
    connect(3);
    const { withStorageLock } = storageLock;
    const results = await Promise.all([
      syncEpisode(episode(4)),
      adjustProgress({ mediaId: MEDIA_ID, malId: MAL_ID, delta: 1 }),
      withStorageLock(async () => 'stockage'),
      syncEpisode(episode(6), ['mal']),
      withEntryLock('anilist', MEDIA_ID, () => withStorageLock(async () => 'fiche → stockage')),
    ]);
    expect(results[2]).toBe('stockage');
    expect(results[4]).toBe('fiche → stockage');
    // Aucune erreur (verrou réentrant ou ordre inversé) dans les résultats par service
    for (const outcome of [results[0], results[1], results[3]]) {
      expect(outcome.status).toBe('synced');
      if (outcome.status === 'synced') expect(outcome.results.every((r) => r.outcome.status !== 'error')).toBe(true);
    }
  });
});

describe('import Crunchyroll : importOnService', () => {
  const item = { progress: 11, episodes: 12 };

  it('créneaux d’écriture et de lecture pris avant la relecture ; aucune attente entre relecture et écriture', async () => {
    fakes.episodes = 12;
    connect(5);
    await expect(importOnService(anilist, MEDIA_ID, item, 0)).resolves.toEqual({ action: 'update', progress: 11, status: 'CURRENT' });
    expect(slots.calls).toEqual(['writeSlot:anilist', 'readSlot:anilist', 'read:anilist', 'save:anilist']);
  });

  it('synchro en direct (12/12 Terminé) pendant l’attente du créneau : l’import relit et n’écrit pas 11', async () => {
    fakes.episodes = 12;
    connect(5);
    slots.writeDelayMs = 20;
    const [decision] = await Promise.all([importOnService(anilist, MEDIA_ID, item, 0), syncEpisode(episode(12), ['anilist'])]);
    expect(decision).toEqual({ action: 'skip', reason: 'completed' });
    expect(anilist.entries.get(MEDIA_ID)).toEqual({ status: 'COMPLETED', progress: 12 });
  });

  it('compte déconnecté puis autre compte entre la relecture et l’écriture : élément abandonné, rien n’est écrit (CRI-03)', async () => {
    fakes.episodes = 12;
    connect(5);
    const read = anilist.getEntry;
    anilist.getEntry = async (id) => {
      const entry = await read(id);
      // Déconnexion du compte A (nouvelle génération) et connexion du compte B pendant l'attente de la réponse
      store.sessionEpoch = { anilist: 1 };
      return entry;
    };
    await expect(importOnService(anilist, MEDIA_ID, item, 0)).resolves.toEqual({ action: 'session-closed' });
    expect(anilist.writes).toEqual([]);
  });

  it('session fermée pendant l’attente du créneau : ni relecture ni écriture', async () => {
    fakes.episodes = 12;
    connect(5);
    delete store.anilistToken;
    await expect(importOnService(anilist, MEDIA_ID, item, 0)).resolves.toEqual({ action: 'session-closed' });
    expect(slots.calls).toEqual(['writeSlot:anilist', 'readSlot:anilist']);
  });
});
