import { beforeEach, describe, expect, it, vi } from 'vitest';
import { setLocale } from '../i18n';
import type { MediaRef } from '../shared/engagement.types';
import type { EpisodeInfo } from '../shared/episode.types';
import type { SyncQueueItem } from '../shared/queue.types';
import type { PendingReview } from '../shared/review.types';
import { SYNC_QUEUE_KEY } from '../protocol/storage-keys';
import type { TrackerId } from '../shared/tracker.types';
import type { WatchingEntry, WatchingList } from '../shared/watching.types';
import { ApiError } from './errors';
import type { ListEntryState } from './sync/rules';
import type { TrackerEntry, TrackerService } from './ports/tracker';

// Cartes « À noter » liées au compte (DATA-01), retrait de la liste et commentaire : vrai engagement.ts, services et
// stockage simulés.

const fakes = vi.hoisted(() => ({
  trackers: [] as TrackerService[],
  /** idMal du catalogue AniList simulé (null : fiche sans équivalent MAL) */
  idMal: null as number | null,
  catalogReads: 0,
}));
vi.mock('./trackers', () => ({ getConnectedTrackers: async (): Promise<TrackerService[]> => fakes.trackers }));
vi.mock('./sync/sync-service', () => ({
  getCatalogMedia: async (mediaId: number) => {
    fakes.catalogReads++;
    return { mediaId, idMal: fakes.idMal, title: 'Frieren', episodes: 28 };
  },
}));
vi.mock('../browser/badge', () => ({ refreshReviewBadge: async () => undefined }));

let store: Record<string, unknown> = {};
let session: Record<string, unknown> = {};

/** Zone de stockage en mémoire (`get(null)` : tout le contenu) */
function area(items: () => Record<string, unknown>): Pick<chrome.storage.StorageArea, 'get' | 'set' | 'remove'> {
  return {
    get: async (keys?: string | string[] | null): Promise<Record<string, unknown>> => {
      const all = items();
      if (keys === null || keys === undefined) return { ...all };
      return Object.fromEntries((Array.isArray(keys) ? keys : [keys]).filter((k) => k in all).map((k) => [k, all[k]]));
    },
    set: async (values: Record<string, unknown>): Promise<void> => void Object.assign(items(), values),
    remove: async (keys: string | string[]): Promise<void> => {
      const all = items();
      for (const k of Array.isArray(keys) ? keys : [keys]) delete all[k];
    },
  } as Pick<chrome.storage.StorageArea, 'get' | 'set' | 'remove'>;
}
vi.stubGlobal('chrome', { storage: { local: area(() => store), session: area(() => session) } });
vi.stubGlobal('navigator', { language: 'fr', locks: { request: <T>(_name: string, task: () => Promise<T>): Promise<T> => task() } });

const { deferRating, getListNotes, rateMedia, removeFromList, setListNotes, startRewatch } = await import('./engagement');
const { getSyncQueue } = await import('../browser/storage/sync-queue-store');
const { getPendingReviews } = await import('../browser/storage/reviews');
const { mappingKey } = await import('../platforms/series-identity');
const { getPendingRatings } = await import('../browser/storage/engagement-store');
const { STORAGE_KEYS } = await import('../protocol/storage-keys');
const { bindBackupToSession } = await import('../shared/backup');
const { DEFAULT_SETTINGS } = await import('../shared/settings');

setLocale('fr');

const MEDIA: MediaRef = { mediaId: 1001, malId: 2001, title: 'Frieren' };

interface FakeTracker extends TrackerService {
  scores: number[];
  /** Progressions de revisionnage écrites (startRewatch) */
  rewatches: number[];
  deleted: number[];
  notesWritten: string[];
  /** Entrée de la liste (null : série absente) */
  entry: ListEntryState | null;
  notes: string | null;
  /** Erreur levée par les écritures (retrait, commentaire) */
  failWrite: ApiError | null;
  /** Appelé pendant la lecture (déconnexion simulée entre la lecture et l'écriture) */
  onRead: (() => void) | null;
}

/** Service en mémoire : la série est dans la liste, les écritures sont relevées */
function fakeTracker(id: TrackerId): FakeTracker {
  const unused = (): Promise<ListEntryState> => Promise.reject(new Error('hors test'));
  const tracker: FakeTracker = {
    id,
    scores: [],
    rewatches: [],
    deleted: [],
    notesWritten: [],
    entry: { status: 'COMPLETED', progress: 28 },
    notes: null,
    failWrite: null,
    onRead: null,
    isConnected: async () => true,
    resolveId: (media) => (id === 'anilist' ? media.mediaId : media.idMal),
    getEntry: async (): Promise<TrackerEntry> => {
      tracker.onRead?.();
      return { title: 'Frieren', episodes: 28, entry: tracker.entry, notes: tracker.entry ? tracker.notes : null };
    },
    saveScore: async (_id, score) => {
      tracker.scores.push(score);
      return tracker.entry ?? { status: 'CURRENT', progress: 0 };
    },
    deleteEntry: async (entryId) => {
      if (tracker.failWrite) throw tracker.failWrite;
      tracker.deleted.push(entryId);
      tracker.entry = null;
    },
    saveNotes: async (_id, notes) => {
      if (tracker.failWrite) throw tracker.failWrite;
      tracker.notesWritten.push(notes);
      tracker.notes = notes || null;
      return tracker.entry ?? { status: 'CURRENT', progress: 0 };
    },
    saveProgress: unused,
    saveStatus: unused,
    startRewatch: async (_id, progress) => {
      tracker.rewatches.push(progress);
      tracker.entry = { status: 'REPEATING', progress };
      return tracker.entry;
    },
    saveEntry: unused,
  };
  return tracker;
}

let anilist: FakeTracker;
let mal: FakeTracker;

beforeEach(() => {
  anilist = fakeTracker('anilist');
  mal = fakeTracker('mal');
  fakes.trackers = [anilist, mal];
  fakes.idMal = null;
  fakes.catalogReads = 0;
  store = {
    anilistToken: { accessToken: 'A', expiresAt: Number.MAX_SAFE_INTEGER },
    malToken: { accessToken: 'M', refreshToken: 'R', expiresAt: Number.MAX_SAFE_INTEGER },
    sessionEpoch: { anilist: 0, mal: 0 },
  };
  session = {};
  vi.spyOn(console, 'info').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('carte « À noter » (DATA-01)', () => {
  it('« Plus tard » : la carte mémorise les sessions ouvertes', async () => {
    await deferRating(MEDIA, null);
    expect(await getPendingRatings()).toMatchObject([{ id: 'anilist:1001', epochs: { anilist: 0, mal: 0 } }]);
  });

  it('carte du compte AniList A, compte B connecté depuis : notée sur MAL seulement, puis retirée', async () => {
    await deferRating(MEDIA, null);
    store.sessionEpoch = { anilist: 1, mal: 0 };
    const outcome = await rateMedia(MEDIA, 8, true);
    expect(outcome).toMatchObject({ status: 'synced', results: [{ service: 'anilist', outcome: { status: 'skipped' } }, { service: 'mal', outcome: { status: 'updated' } }] });
    expect(anilist.scores).toEqual([]);
    expect(mal.scores).toEqual([8]);
    expect(await getPendingRatings()).toEqual([]);
  });

  it('carte importée d’une sauvegarde avant toute connexion : notée sur les comptes connectés ensuite, puis retirée', async () => {
    const card = { id: 'anilist:1001', mediaId: 1001, malId: 2001, title: 'Frieren', coverUrl: null, completedAt: 1 };
    const data = { settings: DEFAULT_SETTINGS, mediaMappings: {}, pendingReviews: [], recentSyncs: [], excludedSeries: [], pendingRatings: [card], rewatchDeclined: {} };
    store.pendingRatings = bindBackupToSession(data, {}).pendingRatings;
    const outcome = await rateMedia(MEDIA, 8, true);
    expect(outcome).toMatchObject({ status: 'synced', results: [{ service: 'anilist', outcome: { status: 'updated' } }, { service: 'mal', outcome: { status: 'updated' } }] });
    expect(anilist.scores).toEqual([8]);
    expect(mal.scores).toEqual([8]);
    expect(await getPendingRatings()).toEqual([]);
  });

  it('carte créée depuis la liste MAL (fiche AniList inconnue), notée avec son id AniList : sessions de la carte, puis retirée', async () => {
    await deferRating({ ...MEDIA, mediaId: null }, null);
    expect(await getPendingRatings()).toMatchObject([{ id: 'mal:2001' }]);
    store.sessionEpoch = { anilist: 1, mal: 0 };
    const outcome = await rateMedia(MEDIA, 8, true);
    expect(outcome).toMatchObject({ status: 'synced', results: [{ service: 'anilist', outcome: { status: 'skipped' } }, { service: 'mal', outcome: { status: 'updated' } }] });
    expect(anilist.scores).toEqual([]);
    expect(await getPendingRatings()).toEqual([]);
  });

  it('note depuis la page (bulle après la synchro) : tous les services connectés, la carte n’y fait rien', async () => {
    await deferRating(MEDIA, null);
    store.sessionEpoch = { anilist: 1, mal: 0 };
    await rateMedia(MEDIA, 8);
    expect(anilist.scores).toEqual([8]);
    expect(mal.scores).toEqual([8]);
  });
});

const watchingEntry = (mediaId: number | null, malId: number | null, title: string): WatchingEntry => ({
  mediaId,
  malId,
  title,
  coverUrl: null,
  progress: 3,
  totalEpisodes: 28,
  updatedAt: null,
  nextEpisode: null,
  airingStatus: null,
  platforms: [],
  lastSync: null,
  siteUrl: 'https://anilist.co/anime/1',
});

/** Fiche de l'onglet en cache de session (seuls les champs relus par l'invalidation sont réalistes) */
const cachedPage = (mediaId: number, idMal: number): Record<string, unknown> => ({
  pageKey: 'k',
  episodeId: null,
  partial: false,
  view: { media: { mediaId, idMal }, lists: [] },
  resolvedAt: Date.now(),
  source: 'resolve',
  epochs: { anilist: 0, mal: 0 },
});

describe('« Retirer de la liste »', () => {
  it('retire la série de chaque service où elle est ; cache « En cours », fiche des onglets et carte « À noter » oubliés', async () => {
    await deferRating(MEDIA, null);
    store[STORAGE_KEYS.watchingCache] = {
      anilist: { service: 'anilist', fetchedAt: 1, entries: [watchingEntry(1001, 2001, 'Frieren'), watchingEntry(5, 6, 'Autre')] },
      mal: { service: 'mal', fetchedAt: 1, entries: [watchingEntry(1001, 2001, 'Frieren')] },
    };
    session = { 'pageMedia:7': cachedPage(1001, 2001), 'pageMedia:8': cachedPage(5, 6) };

    const outcome = await removeFromList(MEDIA);

    expect(outcome).toMatchObject({ status: 'synced', results: [{ service: 'anilist', outcome: { status: 'updated' } }, { service: 'mal', outcome: { status: 'updated' } }] });
    expect(anilist.deleted).toEqual([1001]);
    expect(mal.deleted).toEqual([2001]);
    const cache = store[STORAGE_KEYS.watchingCache] as Record<string, WatchingList>;
    expect(cache.anilist?.entries.map((e) => e.title)).toEqual(['Autre']);
    expect(cache.mal?.entries).toEqual([]);
    expect(Object.keys(session)).toEqual(['pageMedia:8']);
    expect(await getPendingRatings()).toEqual([]);
  });

  it('absente d’un service : sautée (« not-in-list »), rien n’y est retiré', async () => {
    mal.entry = null;
    const outcome = await removeFromList(MEDIA);
    expect(outcome).toMatchObject({
      status: 'synced',
      results: [{ service: 'anilist', outcome: { status: 'updated' } }, { service: 'mal', outcome: { status: 'skipped', code: 'not-in-list' } }],
    });
    expect(mal.deleted).toEqual([]);
  });

  it('un service en échec : l’autre est retiré, l’erreur est rendue et la carte « À noter » reste', async () => {
    await deferRating(MEDIA, null);
    mal.failWrite = new ApiError('RATE_LIMITED', 'Trop de requêtes MyAnimeList');
    const outcome = await removeFromList(MEDIA);
    expect(outcome).toMatchObject({
      status: 'synced',
      results: [{ service: 'anilist', outcome: { status: 'updated' } }, { service: 'mal', outcome: { status: 'error', code: 'RATE_LIMITED' } }],
    });
    expect(anilist.deleted).toEqual([1001]);
    expect(await getPendingRatings()).toHaveLength(1);
  });

  it('déconnexion (puis autre compte) pendant la lecture : rien n’est retiré de ce compte', async () => {
    anilist.onRead = () => {
      store.sessionEpoch = { anilist: 1, mal: 0 };
    };
    const outcome = await removeFromList(MEDIA);
    expect(outcome).toMatchObject({ status: 'synced', results: [{ service: 'anilist', outcome: { status: 'skipped' } }, { service: 'mal', outcome: { status: 'updated' } }] });
    expect(anilist.deleted).toEqual([]);
    expect(mal.deleted).toEqual([2001]);
  });

  it('aucun compte connecté : not-connected', async () => {
    fakes.trackers = [];
    expect(await removeFromList(MEDIA)).toEqual({ status: 'not-connected' });
  });
});

describe('commentaire de l’entrée', () => {
  it('lecture : AniList d’abord, MyAnimeList si la série n’est que là, inList faux sinon', async () => {
    anilist.notes = 'Revoir avec les sous-titres';
    mal.notes = 'Autre texte';
    expect(await getListNotes(MEDIA)).toEqual({ ok: true, data: { inList: true, notes: 'Revoir avec les sous-titres' } });
    anilist.entry = null;
    expect(await getListNotes(MEDIA)).toEqual({ ok: true, data: { inList: true, notes: 'Autre texte' } });
    mal.entry = null;
    expect(await getListNotes(MEDIA)).toEqual({ ok: true, data: { inList: false, notes: null } });
  });

  it('lecture : AniList en erreur, MyAnimeList répond ; les deux en erreur : erreur rendue', async () => {
    anilist.getEntry = () => Promise.reject(new ApiError('NETWORK', 'AniList injoignable'));
    mal.notes = 'Note MAL';
    expect(await getListNotes(MEDIA)).toEqual({ ok: true, data: { inList: true, notes: 'Note MAL' } });
    mal.getEntry = () => Promise.reject(new ApiError('RATE_LIMITED', 'Trop de requêtes'));
    expect(await getListNotes(MEDIA)).toEqual({ ok: false, code: 'NETWORK', message: 'AniList injoignable' });
  });

  it('écrit le texte normalisé sur chaque service où la série est ; même texte déjà enregistré : rien n’est écrit', async () => {
    mal.notes = 'Très bon';
    const outcome = await setListNotes(MEDIA, '  Très bon\r\n');
    expect(outcome).toMatchObject({ status: 'synced', results: [{ service: 'anilist', outcome: { status: 'updated' } }, { service: 'mal', outcome: { status: 'up-to-date' } }] });
    expect(anilist.notesWritten).toEqual(['Très bon']);
    expect(mal.notesWritten).toEqual([]);
  });

  it('série absente de la liste : jamais ajoutée (« not-in-list »)', async () => {
    anilist.entry = null;
    mal.entry = null;
    const outcome = await setListNotes(MEDIA, 'Note');
    expect(outcome).toMatchObject({ results: [{ outcome: { status: 'skipped', code: 'not-in-list' } }, { outcome: { status: 'skipped', code: 'not-in-list' } }] });
    expect(anilist.notesWritten).toEqual([]);
    expect(mal.notesWritten).toEqual([]);
  });

  it('effacer : texte vide envoyé ; un service en échec est signalé, l’autre écrit', async () => {
    anilist.notes = 'Ancien';
    mal.notes = 'Ancien';
    mal.failWrite = new ApiError('NETWORK', 'MyAnimeList injoignable');
    const outcome = await setListNotes(MEDIA, '   ');
    expect(outcome).toMatchObject({ results: [{ outcome: { status: 'updated' } }, { outcome: { status: 'error', code: 'NETWORK' } }] });
    expect(anilist.notesWritten).toEqual(['']);
  });

  it('déconnexion pendant la lecture : rien n’est écrit sur ce compte', async () => {
    mal.onRead = () => {
      store.sessionEpoch = { anilist: 0, mal: 1 };
    };
    await setListNotes(MEDIA, 'Note');
    expect(anilist.notesWritten).toEqual(['Note']);
    expect(mal.notesWritten).toEqual([]);
  });
});

describe('cible MAL : une seule résolution (audit 6-D9)', () => {
  const WITHOUT_MAL: MediaRef = { mediaId: 1001, malId: null, title: 'Frieren' };

  it('écran sans idMal, catalogue qui en a un : note, revisionnage et retrait aussi sur MAL', async () => {
    fakes.idMal = 2001;
    await rateMedia(WITHOUT_MAL, 8);
    expect(mal.scores).toEqual([8]);
    await startRewatch(WITHOUT_MAL, 3);
    expect(mal.rewatches).toEqual([3]);
    await removeFromList(WITHOUT_MAL);
    expect(mal.deleted).toEqual([2001]);
  });

  it('écran avec idMal : catalogue jamais lu ; MAL non connecté : catalogue jamais lu', async () => {
    await rateMedia(MEDIA, 8);
    fakes.trackers = [anilist];
    await rateMedia(WITHOUT_MAL, 8);
    expect(fakes.catalogReads).toBe(0);
  });
});

describe('revisionnage gardé par la session (audit 6-D10)', () => {
  it('déconnexion (puis autre compte) pendant la lecture : rien n’est écrit sur ce compte', async () => {
    anilist.onRead = () => {
      store.sessionEpoch = { anilist: 1, mal: 0 };
    };
    const outcome = await startRewatch(MEDIA, 3);
    expect(outcome).toMatchObject({ status: 'synced', results: [{ service: 'anilist', outcome: { status: 'skipped' } }, { service: 'mal', outcome: { status: 'updated' } }] });
    expect(anilist.rewatches).toEqual([]);
    expect(mal.rewatches).toEqual([3]);
  });
});

describe('« Retirer de la liste » : file et cartes de la série (audit B7, décision 18)', () => {
  const episodeOf = (seriesId: string, n: number): EpisodeInfo => ({
    platform: 'crunchyroll',
    episodeId: `${seriesId}-E${n}`,
    seriesId,
    seriesSlug: 'serie',
    animeTitle: 'Série',
    seasonNumber: 1,
    seasonTitle: null,
    seasonEpisodeNumber: n,
    displayedEpisodeNumber: n,
    episodeTitle: null,
    url: `https://www.crunchyroll.com/watch/${seriesId}-E${n}`,
  });
  const queued = (episode: EpisodeInfo, firstFailedAt: number): SyncQueueItem => ({
    id: `crunchyroll:${episode.episodeId}`,
    episode,
    services: null,
    epochs: { anilist: 0, mal: 0 },
    attempts: 1,
    status: 'pending',
    nextAttemptAt: 0,
    firstFailedAt,
    lastError: 'Hors ligne',
  });
  const reviewCard = (episode: EpisodeInfo, mediaId: number, createdAt: number, previous: PendingReview['previous'] = null): PendingReview => ({
    key: mappingKey(episode),
    episode,
    reason: 'À vérifier',
    suggestion: { mediaId, progress: episode.displayedEpisodeNumber ?? 1 },
    candidates: [],
    previous,
    createdAt,
  });
  const FRIEREN = episodeOf('GFRIEREN', 5);
  const OTHER = episodeOf('GOTHER', 2);
  const mapping = (mediaId: number): Record<string, unknown> => ({ mediaId, numbering: 'season', offset: 0, episodes: 28, learned: true });

  beforeEach(() => {
    store[STORAGE_KEYS.mediaMappings] = { [mappingKey(FRIEREN)]: mapping(1001), [mappingKey(OTHER)]: mapping(5) };
  });

  it('synchro en file avant le retrait : retirée (elle rajouterait la série) ; autres séries gardées', async () => {
    store[SYNC_QUEUE_KEY] = [queued(FRIEREN, Date.now() - 1000), queued(OTHER, Date.now() - 1000)];
    await removeFromList(MEDIA);
    expect((await getSyncQueue()).map((i) => i.id)).toEqual([`crunchyroll:${OTHER.episodeId}`]);
  });

  it('carte « À vérifier » simple qui propose la série retirée : retirée ; correction et autres cartes gardées', async () => {
    const correctionEp = episodeOf('GFRIEREN2', 1);
    store[STORAGE_KEYS.pendingReviews] = [
      reviewCard(FRIEREN, 1001, Date.now() - 1000),
      reviewCard(OTHER, 5, Date.now() - 1000),
      { ...reviewCard(correctionEp, 1001, Date.now() - 1000, { mediaId: 1001, title: 'Frieren', progress: 1 }), epochs: { anilist: 0, mal: 0 } },
    ];
    await removeFromList(MEDIA);
    expect((await getPendingReviews()).map((r) => r.key).sort()).toEqual([mappingKey(OTHER), mappingKey(correctionEp)].sort());
  });

  it('élément mis en file après le début du retrait : gardé', async () => {
    store[SYNC_QUEUE_KEY] = [queued(FRIEREN, Date.now() + 60_000)];
    await removeFromList(MEDIA);
    expect(await getSyncQueue()).toHaveLength(1);
  });

  it('retrait en échec sur un service : file et cartes gardées (un nouvel essai reste possible)', async () => {
    store[SYNC_QUEUE_KEY] = [queued(FRIEREN, Date.now() - 1000)];
    store[STORAGE_KEYS.pendingReviews] = [reviewCard(FRIEREN, 1001, Date.now() - 1000)];
    mal.failWrite = new ApiError('NETWORK', 'MyAnimeList injoignable');
    await removeFromList(MEDIA);
    expect(await getSyncQueue()).toHaveLength(1);
    expect(await getPendingReviews()).toHaveLength(1);
  });
});
