import { beforeEach, describe, expect, it, vi } from 'vitest';
import { setLocale } from '../i18n';
import type { MediaRef } from '../shared/engagement.types';
import type { TrackerId } from '../shared/tracker.types';
import type { WatchingEntry, WatchingList } from '../shared/watching.types';
import { ApiError } from './api/errors';
import type { ListEntryState } from './sync/rules';
import type { TrackerEntry, TrackerService } from './trackers/tracker';

// Cartes « À noter » liées au compte (DATA-01), retrait de la liste et commentaire : vrai engagement.ts, services et
// stockage simulés.

const fakes = vi.hoisted(() => ({ trackers: [] as TrackerService[] }));
vi.mock('./trackers', () => ({ getConnectedTrackers: async (): Promise<TrackerService[]> => fakes.trackers }));
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

const { deferRating, getListNotes, rateMedia, removeFromList, setListNotes } = await import('./engagement');
const { getPendingRatings } = await import('../browser/storage/engagement-store');
const { STORAGE_KEYS } = await import('../protocol/storage-keys');
const { bindBackupToSession } = await import('../shared/backup');
const { DEFAULT_SETTINGS } = await import('../shared/settings');

setLocale('fr');

const MEDIA: MediaRef = { mediaId: 1001, malId: 2001, title: 'Frieren' };

interface FakeTracker extends TrackerService {
  scores: number[];
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
    startRewatch: unused,
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
