import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { isRecord } from '../shared/guards';
import { saveMediaMapping } from '../shared/storage';
import { PENDING_RATINGS_KEY, STORAGE_KEYS, SYNC_QUEUE_KEY } from '../shared/storage-keys';
import { STORAGE_LOCK } from '../shared/storage-lock-core';
import type { PendingRating } from '../shared/engagement.types';
import type { EpisodeInfo } from '../shared/episode.types';
import type { SyncQueueItem } from '../shared/queue.types';
import type { PendingReview, RecentSync } from '../shared/review.types';
import type { MediaMapping } from '../shared/sync.types';
import { compareVersions, runUpdateMigrations } from './update-migrations';

// chrome.storage.local minimal et verrou Web Locks en file (comme navigator.locks : une tâche à la fois)
let store: Record<string, unknown> = {};
vi.stubGlobal('chrome', {
  storage: {
    local: {
      get: async (keys: string | string[]) => Object.fromEntries((Array.isArray(keys) ? keys : [keys]).map((key) => [key, store[key]])),
      set: async (items: Record<string, unknown>) => {
        store = { ...store, ...items };
      },
    },
  },
});
let queue: Promise<unknown> = Promise.resolve();
const request = vi.fn(<T>(_name: string, task: () => Promise<T>): Promise<T> => {
  const run = queue.then(task);
  queue = run.catch(() => undefined);
  return run;
});
vi.stubGlobal('navigator', { locks: { request } });

const mapping = (mediaId: number): MediaMapping => ({ mediaId, numbering: 'season', offset: 0, episodes: 12 });
const mappingKeys = (): string[] => {
  const mappings = store[STORAGE_KEYS.mediaMappings];
  return isRecord(mappings) ? Object.keys(mappings).sort() : [];
};

beforeEach(() => {
  request.mockClear();
  store = {
    [STORAGE_KEYS.mediaMappings]: {
      'netflix:80987039:s1': mapping(1),
      'netflix:81000001:s0': mapping(2),
      'crunchyroll:GRMG8ZQZR:s24': mapping(21),
      'adn:1311:s1': mapping(3),
    },
  };
});

describe('compareVersions', () => {
  it('compare numériquement chaque composante', () => {
    expect(compareVersions('2.1.0', '2.1.1')).toBeLessThan(0);
    expect(compareVersions('2.10.0', '2.9.9')).toBeGreaterThan(0);
    expect(compareVersions('2.1', '2.1.0')).toBe(0);
    expect(compareVersions('abc', '2.1.1')).toBeNaN();
  });
});

describe('runUpdateMigrations', () => {
  it('depuis la 2.1.0 : oublie toutes les correspondances Netflix sous le verrou, garde les autres', async () => {
    await runUpdateMigrations('2.1.0');
    expect(mappingKeys()).toEqual(['adn:1311:s1', 'crunchyroll:GRMG8ZQZR:s24']);
    expect(request).toHaveBeenCalledWith(STORAGE_LOCK, expect.any(Function));
  });

  it('une écriture concurrente pendant la purge n’est pas perdue (lecture-écriture sous verrou)', async () => {
    await Promise.all([runUpdateMigrations('2.1.0'), saveMediaMapping('crunchyroll:GY9VWW3XY:s1', mapping(20))]);
    expect(mappingKeys()).toEqual(['adn:1311:s1', 'crunchyroll:GRMG8ZQZR:s24', 'crunchyroll:GY9VWW3XY:s1']);
  });

  it('depuis la 2.1.1 : correspondances Netflix conservées', async () => {
    await runUpdateMigrations('2.1.1');
    expect(mappingKeys()).toHaveLength(4);
  });

  it('depuis la 2.2.0 ou plus, ou version inconnue : aucune migration', async () => {
    for (const version of ['2.2.0', '10.0.0', 'inconnue', undefined]) {
      await runUpdateMigrations(version);
    }
    expect(mappingKeys()).toHaveLength(4);
    expect(request).not.toHaveBeenCalled();
  });

  it('aucune correspondance Netflix ni donnée à rattacher : stockage non réécrit', async () => {
    store = { [STORAGE_KEYS.mediaMappings]: { 'adn:1311:s1': mapping(3) } };
    const before = store;
    await runUpdateMigrations('2.0.0');
    expect(store).toBe(before);
  });
});

describe('runUpdateMigrations : liaison au compte (DATA-01)', () => {
  const episode: EpisodeInfo = {
    platform: 'crunchyroll',
    episodeId: 'GE001',
    seriesId: 'GR001',
    seriesSlug: 'frieren',
    animeTitle: 'Frieren',
    seasonNumber: 1,
    seasonTitle: null,
    seasonEpisodeNumber: 5,
    displayedEpisodeNumber: 5,
    episodeTitle: null,
    url: 'https://www.crunchyroll.com/watch/GE001',
  };
  const queued: SyncQueueItem = { id: 'crunchyroll:GE001', episode, services: null, attempts: 1, status: 'pending', nextAttemptAt: 1, firstFailedAt: 1, lastError: 'Hors ligne' };
  const rating: PendingRating = { id: 'anilist:1', mediaId: 1, malId: 2, title: 'Frieren', coverUrl: null, completedAt: 1 };
  const recent: RecentSync = { key: 'crunchyroll:GR001:s1', episode, mediaId: 1, mediaTitle: 'Frieren', progress: 5, syncedAt: 1 };
  const review: PendingReview = { key: 'crunchyroll:GR001:s1', episode, reason: 'À vérifier', suggestion: null, candidates: [], previous: null, createdAt: 1 };
  const correction: PendingReview = { ...review, key: 'crunchyroll:GR002:s1', previous: { mediaId: 1, title: 'Frieren', progress: 5 } };
  // AniList connecté (génération 3, après des déconnexions passées), MAL jamais connecté
  const SESSIONS = { anilist: 3 };

  beforeEach(() => {
    store = {
      anilistToken: { accessToken: 'a', expiresAt: 1 },
      sessionEpoch: { anilist: 3, mal: 1 },
      [SYNC_QUEUE_KEY]: [queued],
      [PENDING_RATINGS_KEY]: [rating, { ...rating, id: 'anilist:9', mediaId: 9, epochs: { anilist: 2 } }],
      [STORAGE_KEYS.recentSyncs]: [recent],
      [STORAGE_KEYS.pendingReviews]: [review, correction],
    };
  });

  it('depuis la 2.1.x : file, notes, synchros récentes et corrections rattachées aux sessions ouvertes', async () => {
    await runUpdateMigrations('2.1.1');
    expect(store[SYNC_QUEUE_KEY]).toEqual([{ ...queued, epochs: SESSIONS }]);
    // Déjà rattachée : inchangée
    expect(store[PENDING_RATINGS_KEY]).toEqual([{ ...rating, epochs: SESSIONS }, { ...rating, id: 'anilist:9', mediaId: 9, epochs: { anilist: 2 } }]);
    expect(store[STORAGE_KEYS.recentSyncs]).toEqual([{ ...recent, epochs: SESSIONS }]);
    // Vérification simple : non liée au compte
    expect(store[STORAGE_KEYS.pendingReviews]).toEqual([review, { ...correction, epochs: SESSIONS }]);
  });

  it('depuis la 2.2.0 : rien n’est rattaché', async () => {
    await runUpdateMigrations('2.2.0');
    expect(store[SYNC_QUEUE_KEY]).toEqual([queued]);
    expect(store[STORAGE_KEYS.recentSyncs]).toEqual([recent]);
  });
});

describe('runUpdateMigrations : délais par série datés (DATA-03)', () => {
  const NOW = 1_800_000_000_000;
  const legacy = Object.fromEntries(Array.from({ length: 200 }, (_, i) => [String(200 - i), i - 100]));

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
    store = { settings: { autoSync: false, seriesOffsets: legacy } };
  });
  afterEach(() => vi.useRealTimers());

  it('depuis la 2.1.x : chaque délai en minutes devient { minutes, at = mise à jour }, tous conservés, autres réglages intacts', async () => {
    await runUpdateMigrations('2.1.1');
    const settings = store.settings;
    if (!isRecord(settings) || !isRecord(settings.seriesOffsets)) throw new Error('réglages absents');
    expect(settings.autoSync).toBe(false);
    expect(Object.keys(settings.seriesOffsets)).toHaveLength(200);
    expect(settings.seriesOffsets['200']).toEqual({ minutes: -100, at: NOW });
    expect(settings.seriesOffsets['1']).toEqual({ minutes: 99, at: NOW });
  });

  it('depuis la 2.2.0 : rien n’est réécrit', async () => {
    const before = store;
    await runUpdateMigrations('2.2.0');
    expect(store).toBe(before);
  });
});
