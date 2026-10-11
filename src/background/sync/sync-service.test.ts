import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setLocale } from '../../i18n';
import type { EpisodeInfo } from '../../shared/episode.types';
import type { PendingReview } from '../../shared/review.types';
import type { MediaMapping, SyncOutcome } from '../../shared/sync.types';
import type { TrackerId } from '../../shared/tracker.types';
import type { AniListMedia } from '../api/media';
import { ApiError } from '../api/errors';
import type { CatalogMedia, TrackerEntry, TrackerService } from '../trackers/tracker';
import type { SyncTarget } from './matching';
import type { EpisodeResolution } from './resolver';
import type { ListEntryState, WriteStatus } from './rules';

// Cartes « À vérifier » / « Corriger », demande de note et correspondances en cache (lot 5 de l'audit) :
// vrais syncEpisode / resolveReview / recordSyncOutcome sur des services en mémoire, stockage chrome simulé.

const PART1 = 1001;
const PART2 = 1002;
const MAL_PART1 = 2001;
const MAL_PART2 = 2002;

const fakes = vi.hoisted(() => ({
  trackers: [] as TrackerService[],
  /** Résolutions successives renvoyées par resolveEpisode (la dernière se répète) */
  resolutions: [] as EpisodeResolution[],
  resolveCalls: 0,
  getAnimeById: async (_id: number): Promise<AniListMedia> => Promise.reject(new Error('non configuré')),
}));

vi.mock('../trackers', () => ({
  getConnectedTrackers: async (only: readonly TrackerId[] | null = null): Promise<TrackerService[]> =>
    only ? fakes.trackers.filter((tracker) => only.includes(tracker.id)) : fakes.trackers,
}));
vi.mock('./resolver', () => ({
  resolveEpisode: async (): Promise<EpisodeResolution> => {
    const resolution = fakes.resolutions[Math.min(fakes.resolveCalls, fakes.resolutions.length - 1)];
    fakes.resolveCalls++;
    if (!resolution) throw new Error('résolution non configurée');
    return resolution;
  },
  findReviewCandidates: async () => [],
  toCandidateSummary: () => null,
}));
vi.mock('../api/media', () => ({
  getAnimeById: (id: number) => fakes.getAnimeById(id),
  searchAnime: async () => [],
}));
vi.mock('../../shared/badge', () => ({ flashSyncBadge: async () => undefined, refreshReviewBadge: async () => undefined }));
vi.mock('../../shared/exclusions', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../shared/exclusions')>()),
  isExcluded: async () => false,
}));

// ─── Stockage, verrous et alarmes simulés ─────────────────────────────────

let store: Record<string, unknown> = {};

function fakeLocks(): LockManager['request'] {
  const tails = new Map<string, Promise<unknown>>();
  const request = <T>(name: string, task: () => Promise<T>): Promise<T> => {
    const run = (tails.get(name) ?? Promise.resolve()).then(task);
    tails.set(name, run.catch(() => undefined));
    return run;
  };
  return request as LockManager['request'];
}

function stubGlobals(): void {
  store = {};
  vi.stubGlobal('chrome', {
    runtime: { id: 'synckai-test' },
    alarms: { create: async () => undefined, clear: async () => true },
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

stubGlobals();
const { resolveReview, shouldPromptRating, syncEpisode } = await import('./sync-service');
const { recordSyncOutcome } = await import('./queue');
const { mappingKey } = await import('./matching');
const { getMediaMapping, getPendingReviews, saveMediaMapping, savePendingReview } = await import('../../shared/storage');
const { getSyncQueue } = await import('../../shared/sync-queue-store');

setLocale('fr');

// ─── Services en mémoire ──────────────────────────────────────────────────

interface FakeTracker extends TrackerService {
  entries: Map<number, ListEntryState>;
  /** Nombre d'épisodes de chaque fiche sur ce service */
  totals: Map<number, number | null>;
  writes: { id: number; progress: number; status: WriteStatus; repeat?: number }[];
  /** Erreur levée à la prochaine écriture */
  failWith: ApiError | null;
}

function fakeTracker(id: TrackerId): FakeTracker {
  const tracker: FakeTracker = {
    id,
    entries: new Map(),
    totals: new Map(),
    writes: [],
    failWith: null,
    isConnected: async () => true,
    resolveId: (media: CatalogMedia) => (id === 'anilist' ? media.mediaId : media.idMal),
    getEntry: async (entryId: number): Promise<TrackerEntry> => {
      const entry = tracker.entries.get(entryId);
      return { title: `#${entryId}`, episodes: tracker.totals.get(entryId) ?? null, entry: entry ? { ...entry } : null };
    },
    saveProgress: async (entryId, progress, status, repeat) => {
      if (tracker.failWith) throw tracker.failWith;
      tracker.writes.push({ id: entryId, progress, status, ...(repeat !== undefined ? { repeat } : {}) });
      const saved: ListEntryState = { ...tracker.entries.get(entryId), status, progress, ...(repeat !== undefined ? { repeat } : {}) };
      tracker.entries.set(entryId, saved);
      return saved;
    },
    saveStatus: () => Promise.reject(new Error('hors test')),
    saveScore: () => Promise.reject(new Error('hors test')),
    startRewatch: () => Promise.reject(new Error('hors test')),
    saveEntry: () => Promise.reject(new Error('hors test')),
  };
  return tracker;
}

/** Fiches du catalogue AniList : identifiant → [idMal, nombre d'épisodes] */
let catalog: Map<number, [number, number | null]>;

function media(id: number): AniListMedia {
  const known = catalog.get(id);
  if (!known) throw new ApiError('API_ERROR', 'AniList : erreur 404', { httpStatus: 404 });
  return {
    id,
    idMal: known[0],
    displayTitle: `Fiche ${id}`,
    episodes: known[1],
    titles: [],
    format: 'TV',
    startDate: null,
    year: null,
    coverUrl: null,
    externalLinkUrls: [],
    relations: [],
  };
}

const episode = (n: number): EpisodeInfo => ({
  platform: 'crunchyroll',
  episodeId: `EP${n}`,
  seriesId: 'GSERIES',
  seriesSlug: 'serie',
  animeTitle: 'Série',
  seasonNumber: 2,
  seasonTitle: null,
  seasonEpisodeNumber: n,
  displayedEpisodeNumber: n,
  episodeTitle: null,
  url: `https://www.crunchyroll.com/watch/EP${n}`,
});
const KEY = mappingKey(episode(1));

function resolved(mediaId: number, progress: number, extra: Partial<SyncTarget> = {}): EpisodeResolution {
  return {
    result: { ok: true, target: { mediaId, numbering: 'season', offset: 0, episodes: catalog.get(mediaId)?.[1] ?? null, progress, confidence: 'high', reason: 'test', ...extra } },
    candidates: [],
    seasons: [],
    seasonGroups: [],
  };
}

const review = (overrides: Partial<PendingReview> = {}): PendingReview => ({
  key: KEY,
  episode: episode(12),
  reason: 'À vérifier',
  suggestion: { mediaId: PART1, progress: 12 },
  candidates: [],
  previous: null,
  createdAt: 1,
  ...overrides,
});

let anilist: FakeTracker;
let mal: FakeTracker;

/** Les deux services connectés, la fiche PART1 dans la liste de chacun */
function connect(entry: ListEntryState | null, malEntry: ListEntryState | null = entry): void {
  anilist = fakeTracker('anilist');
  mal = fakeTracker('mal');
  for (const [id, [malId, total]] of catalog) {
    anilist.totals.set(id, total);
    mal.totals.set(malId, total);
  }
  if (entry) anilist.entries.set(PART1, entry);
  if (malEntry) mal.entries.set(MAL_PART1, malEntry);
  fakes.trackers = [anilist, mal];
}

function resultOf(outcome: SyncOutcome, service: TrackerId): unknown {
  return outcome.status === 'synced' ? outcome.results.find((r) => r.service === service)?.outcome : undefined;
}

beforeEach(() => {
  stubGlobals();
  catalog = new Map([
    [PART1, [MAL_PART1, 12]],
    [PART2, [MAL_PART2, 12]],
  ]);
  fakes.resolutions = [];
  fakes.resolveCalls = 0;
  fakes.getAnimeById = async (id) => media(id);
  vi.spyOn(console, 'info').mockImplementation(() => {});
  vi.spyOn(console, 'debug').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => vi.restoreAllMocks());

describe('resolveReview : échec passager d’un service (SYNC-03)', () => {
  it('MAL en 504 : AniList écrit, MAL mis en file via recordSyncOutcome, carte retirée', async () => {
    connect({ status: 'CURRENT', progress: 11 });
    mal.failWith = new ApiError('API_ERROR', 'MyAnimeList : erreur 504', { httpStatus: 504 });
    await savePendingReview(review());

    const { outcome, episode: toQueue } = await resolveReview({ key: KEY, mediaId: PART1, progress: 12 });
    expect(resultOf(outcome, 'mal')).toMatchObject({ status: 'error', code: 'API_ERROR', httpStatus: 504 });
    expect(anilist.entries.get(PART1)).toMatchObject({ status: 'COMPLETED', progress: 12 });
    expect(toQueue).toEqual(episode(12));

    // Composition du handler RESOLVE_REVIEW (background.ts)
    const recorded = await recordSyncOutcome(episode(12), null, outcome);
    expect(recorded).toMatchObject({ status: 'synced', queued: true });
    expect(await getSyncQueue()).toMatchObject([{ status: 'pending', services: ['mal'], episode: episode(12) }]);
    expect(await getPendingReviews()).toEqual([]);
  });

  it('MAL en 404 : erreur définitive, rien en file', async () => {
    connect({ status: 'CURRENT', progress: 11 });
    mal.failWith = new ApiError('API_ERROR', 'Fiche introuvable sur MyAnimeList.', { httpStatus: 404 });
    await savePendingReview(review());

    const { outcome, episode: toQueue } = await resolveReview({ key: KEY, mediaId: PART1, progress: 12 });
    expect(toQueue).not.toBeNull();
    const recorded = await recordSyncOutcome(episode(12), null, outcome);
    expect(recorded).not.toHaveProperty('queued');
    expect(await getSyncQueue()).toEqual([]);
  });
});

describe('correction (« Corriger ») : jamais sur une valeur périmée (BAK-01)', () => {
  const correction = review({ episode: episode(5), suggestion: { mediaId: PART1, progress: 5 }, previous: { mediaId: PART1, title: 'Fiche 1001', progress: 5 } });

  it('progression actuelle = valeur écrite par la synchro : correction appliquée, même vers le bas', async () => {
    connect({ status: 'CURRENT', progress: 5 });
    await savePendingReview(correction);
    const { outcome, episode: toQueue } = await resolveReview({ key: KEY, mediaId: PART1, progress: 3 });
    expect(resultOf(outcome, 'anilist')).toEqual({ status: 'updated', progress: 3, completed: false });
    expect(anilist.entries.get(PART1)?.progress).toBe(3);
    expect(mal.entries.get(MAL_PART1)?.progress).toBe(3);
    // Correction : pas de relance automatique (règles normales), la carte suffit
    expect(toQueue).toBeNull();
    expect(await getPendingReviews()).toEqual([]);
  });

  it('progression changée depuis (7) : refusée avec un message, aucune écriture vers le bas', async () => {
    connect({ status: 'CURRENT', progress: 7 });
    await savePendingReview(correction);
    const { outcome } = await resolveReview({ key: KEY, mediaId: PART1, progress: 3 });
    expect(resultOf(outcome, 'anilist')).toEqual({ status: 'skipped', reason: expect.stringContaining('épisode 7') });
    expect(anilist.writes).toEqual([]);
    expect(mal.writes).toEqual([]);
  });

  it('série terminée depuis : reste terminée', async () => {
    connect({ status: 'COMPLETED', progress: 12 });
    await savePendingReview(correction);
    await resolveReview({ key: KEY, mediaId: PART1, progress: 3 });
    expect(anilist.entries.get(PART1)).toEqual({ status: 'COMPLETED', progress: 12 });
  });

  it('un service en erreur : la carte de correction reste pour un nouvel essai', async () => {
    connect({ status: 'CURRENT', progress: 5 });
    mal.failWith = new ApiError('NETWORK', 'Connexion impossible.');
    await savePendingReview(correction);
    await resolveReview({ key: KEY, mediaId: PART1, progress: 3 });
    expect(await getPendingReviews()).toHaveLength(1);

    // Nouvel essai : AniList déjà corrigé (à jour), MAL enfin corrigé
    mal.failWith = null;
    const { outcome } = await resolveReview({ key: KEY, mediaId: PART1, progress: 3 });
    expect(resultOf(outcome, 'anilist')).toEqual({ status: 'up-to-date', progress: 3 });
    expect(mal.entries.get(MAL_PART1)?.progress).toBe(3);
    expect(await getPendingReviews()).toEqual([]);
  });
});

describe('synchro suivante pendant une carte « Corriger » (SYNC-07)', () => {
  it('la carte reste et rien n’est écrit sur la fiche contestée', async () => {
    connect({ status: 'CURRENT', progress: 5 });
    const card = review({ episode: episode(5), previous: { mediaId: PART1, title: 'Fiche 1001', progress: 5 } });
    await savePendingReview(card);
    fakes.resolutions = [resolved(PART1, 6, { fromCache: true })];

    const outcome = await syncEpisode(episode(6));
    expect(outcome).toEqual({ status: 'needs-review', reason: expect.stringContaining('Correction en attente') });
    expect(anilist.writes).toEqual([]);
    expect(mal.writes).toEqual([]);
    expect(await getPendingReviews()).toEqual([card]);
  });

  it('une vérification incertaine ne remplace pas la carte de correction', async () => {
    connect({ status: 'CURRENT', progress: 5 });
    const card = review({ episode: episode(5), previous: { mediaId: PART1, title: 'Fiche 1001', progress: 5 } });
    await savePendingReview(card);
    fakes.resolutions = [{ ...resolved(PART2, 6), result: { ok: false, reason: 'Aucune fiche' } }];
    await syncEpisode(episode(6));
    expect(await getPendingReviews()).toEqual([card]);
  });

  it('une vérification simple reste caduque après une synchro réussie', async () => {
    connect({ status: 'CURRENT', progress: 5 });
    await savePendingReview(review({ episode: episode(5) }));
    fakes.resolutions = [resolved(PART1, 6)];
    expect(await syncEpisode(episode(6))).toMatchObject({ status: 'synced' });
    expect(anilist.entries.get(PART1)?.progress).toBe(6);
    expect(await getPendingReviews()).toEqual([]);
  });
});

describe('demande de note en fin de série (SYNC-04)', () => {
  const finale = async (): Promise<SyncOutcome> => {
    fakes.resolutions = [resolved(PART1, 12)];
    return syncEpisode(episode(12));
  };

  it('série non notée : note proposée', async () => {
    connect({ status: 'CURRENT', progress: 11 });
    expect(await finale()).toMatchObject({ status: 'synced', prompts: { rate: { mediaId: PART1 } } });
  });

  it('série déjà notée sur un service : aucune demande', async () => {
    connect({ status: 'CURRENT', progress: 11 }, { status: 'CURRENT', progress: 11, score: 9 });
    const outcome = await finale();
    expect(anilist.entries.get(PART1)?.status).toBe('COMPLETED');
    expect(outcome).not.toHaveProperty('prompts');
  });

  it('fin de revisionnage : terminée (revisionnage + 1) sans demande de note', async () => {
    connect({ status: 'REPEATING', progress: 11, repeat: 1 });
    const outcome = await finale();
    expect(anilist.entries.get(PART1)).toMatchObject({ status: 'COMPLETED', progress: 12, repeat: 2 });
    expect(outcome).not.toHaveProperty('prompts');
  });

  it('fiche MAL découpée plus court terminée seule : pas de note (fiche AniList en cours)', () => {
    const malDone = { result: { service: 'mal' as const, outcome: { status: 'updated' as const, progress: 12, completed: true } }, alreadyCompleted: false, scored: false, wasRepeating: false };
    expect(shouldPromptRating({ episodes: 24 }, 12, [malDone])).toBe(false);
    expect(shouldPromptRating({ episodes: 12 }, 12, [malDone])).toBe(true);
  });
});

describe('correspondance en cache revalidée avec le catalogue (SYNC-05, SYNC-06)', () => {
  const cachedMapping: MediaMapping = { mediaId: PART1, numbering: 'season', offset: 0, episodes: null, seriesLabel: 'Série S2', mediaTitle: 'Fiche 1001' };

  it('episodes:null puis « Part 2 » publiée : correspondance oubliée et épisode écrit sur la Part 2', async () => {
    connect({ status: 'COMPLETED', progress: 12 });
    anilist.entries.set(PART2, { status: 'CURRENT', progress: 0 });
    await saveMediaMapping(KEY, cachedMapping);
    // Cache (fiche Part 1, épisode 13), puis nouvelle résolution : Part 2, épisode 1
    fakes.resolutions = [resolved(PART1, 13, { episodes: null, fromCache: true }), resolved(PART2, 1)];

    const outcome = await syncEpisode(episode(13));
    expect(fakes.resolveCalls).toBe(2);
    expect(await getMediaMapping(KEY)).toBeNull();
    expect(outcome).toMatchObject({ status: 'synced', mediaTitle: 'Fiche 1002' });
    expect(anilist.writes).toEqual([{ id: PART2, progress: 1, status: 'CURRENT' }]);
  });

  it('episodes:null et épisode dans la fiche : total complété dans la correspondance', async () => {
    connect({ status: 'CURRENT', progress: 4 });
    await saveMediaMapping(KEY, cachedMapping);
    fakes.resolutions = [resolved(PART1, 5, { ...cachedMapping, fromCache: true })];

    await syncEpisode(episode(5));
    expect(fakes.resolveCalls).toBe(1);
    expect(await getMediaMapping(KEY)).toEqual({ ...cachedMapping, episodes: 12 });
    expect(anilist.entries.get(PART1)?.progress).toBe(5);
  });

  it('fiche en cache supprimée sur AniList (404) : correspondance oubliée puis nouvelle résolution', async () => {
    connect({ status: 'CURRENT', progress: 4 });
    anilist.entries.set(PART2, { status: 'CURRENT', progress: 4 });
    catalog.delete(PART1);
    await saveMediaMapping(KEY, { ...cachedMapping, episodes: 12 });
    fakes.resolutions = [resolved(PART1, 5, { episodes: 12, fromCache: true }), resolved(PART2, 5)];

    const outcome = await syncEpisode(episode(5));
    expect(await getMediaMapping(KEY)).toBeNull();
    expect(outcome).toMatchObject({ status: 'synced', mediaTitle: 'Fiche 1002' });
  });

  it('fiche introuvable hors cache (404) : erreur définitive, statut HTTP transmis', async () => {
    connect({ status: 'CURRENT', progress: 4 });
    catalog.delete(PART1);
    fakes.resolutions = [resolved(PART1, 5)];
    const outcome = await syncEpisode(episode(5));
    expect(outcome).toMatchObject({ status: 'error', code: 'API_ERROR', httpStatus: 404 });
    expect(await recordSyncOutcome(episode(5), null, outcome)).not.toHaveProperty('queued');
    expect(await getSyncQueue()).toEqual([]);
  });
});
