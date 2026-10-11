import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PendingRating } from './engagement.types';
import type { EpisodeInfo } from './episode.types';
import type { SyncQueueItem } from './queue.types';
import type { PendingReview, RecentSync } from './review.types';
import type { SessionEpochs } from './session-epochs';
import { PENDING_RATINGS_KEY, REWATCH_DECLINED_KEY, SESSION_EXPIRED_KEYS, STORAGE_KEYS, SYNC_QUEUE_KEY } from './storage-keys';
import type { MediaMapping } from './sync.types';
import { forgetTokenKey } from '../test/memory-key-store';
import { revealToken } from '../test/tokens';

// Effacements de session, données liées au compte, écritures sous session et plafonds de storage.ts
// (TEST-10, DATA-01, DATA-06, AUTH-01, AUTH-02, ARCH-17) :
// chrome.storage.local simulé par une Map, verrou du stockage immédiat.

const store = new Map<string, unknown>();

vi.stubGlobal('chrome', {
  storage: {
    local: {
      get: async (keys: string | string[] | null): Promise<Record<string, unknown>> => {
        const wanted = keys === null ? [...store.keys()] : Array.isArray(keys) ? keys : [keys];
        return Object.fromEntries(wanted.filter((key) => store.has(key)).map((key) => [key, structuredClone(store.get(key))]));
      },
      set: async (items: Record<string, unknown>): Promise<void> => {
        for (const [key, value] of Object.entries(items)) store.set(key, structuredClone(value));
      },
      remove: async (keys: string | string[]): Promise<void> => {
        for (const key of Array.isArray(keys) ? keys : [keys]) store.delete(key);
      },
    },
  },
});
vi.stubGlobal('navigator', { locks: { request: <T>(_name: string, task: () => Promise<T>): Promise<T> => task() } });
vi.mock('./badge', () => ({ refreshReviewBadge: async () => undefined }));

const storage = await import('./storage');
const tokenAccess = await import('./token-access');
const { getSyncQueue, saveQueueItem } = await import('./sync-queue-store');
const { PLATFORM_LINKS_KEY } = await import('./platform-links');
const { MAX_PENDING_REVIEWS, MAX_RECENT_SYNCS } = storage;

const FAR = Number.MAX_SAFE_INTEGER;
const ANILIST_TOKEN = { accessToken: 'anilist', expiresAt: FAR };
const MAL_TOKEN = { accessToken: 'mal', refreshToken: 'refresh', expiresAt: FAR };
/** Les deux services connectés, première génération */
const BOTH: SessionEpochs = { anilist: 0, mal: 0 };

const episode = (n: number): EpisodeInfo => ({
  platform: 'crunchyroll',
  episodeId: `EP${n}`,
  seriesId: `GSERIES${n}`,
  seriesSlug: 'serie',
  animeTitle: 'Série',
  seasonNumber: 1,
  seasonTitle: null,
  seasonEpisodeNumber: n,
  displayedEpisodeNumber: n,
  episodeTitle: null,
  url: `https://www.crunchyroll.com/watch/EP${n}`,
});

const queued = (n: number, services: SyncQueueItem['services'], epochs?: SessionEpochs): SyncQueueItem => ({
  id: `crunchyroll:EP${n}`,
  episode: episode(n),
  services,
  ...(epochs ? { epochs } : {}),
  attempts: 1,
  status: 'pending',
  nextAttemptAt: 1,
  firstFailedAt: 1,
  lastError: 'Hors ligne',
});
const rating = (mediaId: number, epochs?: SessionEpochs): PendingRating => ({
  id: `anilist:${mediaId}`,
  mediaId,
  malId: null,
  title: `Série ${mediaId}`,
  coverUrl: null,
  completedAt: mediaId,
  ...(epochs ? { epochs } : {}),
});
const recent = (n: number, epochs?: SessionEpochs, syncedAt = n): RecentSync => ({
  key: `crunchyroll:GSERIES${n}:s1`,
  episode: episode(n),
  mediaId: n,
  mediaTitle: `Fiche ${n}`,
  progress: n,
  syncedAt,
  ...(epochs ? { epochs } : {}),
});
const review = (n: number, overrides: Partial<PendingReview> = {}): PendingReview => ({
  key: `crunchyroll:GSERIES${n}:s1`,
  episode: episode(n),
  reason: 'À vérifier',
  suggestion: null,
  candidates: [],
  previous: null,
  createdAt: n,
  ...overrides,
});
const correction = (n: number, epochs?: SessionEpochs): PendingReview =>
  review(n, { previous: { mediaId: n, title: `Fiche ${n}`, progress: n }, ...(epochs ? { epochs } : {}) });

/** Toutes les clés écrites par SyncKai pour un utilisateur connecté aux deux services */
function seedEverything(): void {
  const entries: Record<string, unknown> = {
    [STORAGE_KEYS.anilistToken]: ANILIST_TOKEN,
    [STORAGE_KEYS.anilistViewer]: { id: 1, name: 'A' },
    [STORAGE_KEYS.malToken]: MAL_TOKEN,
    [STORAGE_KEYS.malViewer]: { id: 2, name: 'M' },
    [STORAGE_KEYS.mediaMappings]: { 'crunchyroll:GSERIES1:s1': { mediaId: 1, numbering: 'season', offset: 0, episodes: 12 } },
    [STORAGE_KEYS.pendingReviews]: [review(1)],
    [STORAGE_KEYS.recentSyncs]: [recent(1, BOTH)],
    [STORAGE_KEYS.watchingCache]: { anilist: { service: 'anilist' }, mal: { service: 'mal' } },
    [STORAGE_KEYS.sessionEpoch]: { anilist: 0, mal: 0 },
    [STORAGE_KEYS.compareLast]: {},
    [STORAGE_KEYS.compareJob]: {},
    [STORAGE_KEYS.crImportJob]: {},
    [STORAGE_KEYS.crImportInput]: {},
    [STORAGE_KEYS.crImportResolutions]: {},
    [STORAGE_KEYS.crImportPlan]: {},
    [SYNC_QUEUE_KEY]: [queued(1, null, BOTH)],
    [PENDING_RATINGS_KEY]: [rating(1, BOTH)],
    [REWATCH_DECLINED_KEY]: { 'anilist:1': 1 },
    [PLATFORM_LINKS_KEY]: { '1': [] },
    'airingWeek:2026-10-05': {},
    'airingWeek:2026-10-12': {},
    // Alertes de sortie (ALRT-05)
    airingLastCheck: 1,
    airingCoveredUntil: 1,
    airingNotified: [1],
    airingTargets: { 'synckai-airing:1': [1] },
    airingLastResult: { checkedAt: 1, notified: 1, skipped: null, error: null },
    excludedSeries: [],
    settings: {},
  };
  for (const [key, value] of Object.entries(entries)) store.set(key, value);
}

const keys = (): string[] => [...store.keys()].sort();

beforeEach(() => store.clear());

describe('clearUserSyncData (TEST-10)', () => {
  it('efface exactement les données de l’utilisateur, garde sessions, correspondances, exclusions et réglages', async () => {
    seedEverything();
    await storage.clearUserSyncData();
    expect(keys()).toEqual(
      [
        STORAGE_KEYS.anilistToken,
        STORAGE_KEYS.anilistViewer,
        STORAGE_KEYS.malToken,
        STORAGE_KEYS.malViewer,
        STORAGE_KEYS.mediaMappings,
        STORAGE_KEYS.sessionEpoch,
        'excludedSeries',
        'settings',
      ].sort(),
    );
  });
});

describe('clearAniListSession / clearMalSession (TEST-10, DATA-01)', () => {
  it('AniList : session, comparaison, import et cache AniList effacés ; génération AniList incrémentée seule', async () => {
    seedEverything();
    await storage.clearAniListSession();
    for (const key of [STORAGE_KEYS.anilistToken, STORAGE_KEYS.anilistViewer, STORAGE_KEYS.compareLast, STORAGE_KEYS.compareJob, STORAGE_KEYS.crImportJob, STORAGE_KEYS.crImportInput, STORAGE_KEYS.crImportResolutions, STORAGE_KEYS.crImportPlan]) {
      expect(store.has(key), key).toBe(false);
    }
    expect(store.get(STORAGE_KEYS.watchingCache)).toEqual({ mal: { service: 'mal' } });
    expect(store.get(STORAGE_KEYS.sessionEpoch)).toEqual({ anilist: 1, mal: 0 });
    expect(await storage.getSessionEpoch('anilist')).toBe(1);
    // Conservés : session MAL, correspondances, données encore valables pour MAL
    for (const key of [STORAGE_KEYS.malToken, STORAGE_KEYS.malViewer, STORAGE_KEYS.mediaMappings, STORAGE_KEYS.pendingReviews, PLATFORM_LINKS_KEY, REWATCH_DECLINED_KEY, 'airingWeek:2026-10-05']) {
      expect(store.has(key), key).toBe(true);
    }
  });

  it('MAL : symétrique, le cache AniList et la génération AniList restent', async () => {
    seedEverything();
    await storage.clearMalSession();
    expect(store.has(STORAGE_KEYS.malToken)).toBe(false);
    expect(store.has(STORAGE_KEYS.malViewer)).toBe(false);
    expect(store.has(STORAGE_KEYS.crImportPlan)).toBe(false);
    expect(store.get(STORAGE_KEYS.watchingCache)).toEqual({ anilist: { service: 'anilist' } });
    expect(store.get(STORAGE_KEYS.sessionEpoch)).toEqual({ anilist: 0, mal: 1 });
    expect(store.get(STORAGE_KEYS.anilistToken)).toEqual(ANILIST_TOKEN);
  });

  it('retire la part AniList de la file, des notes, des synchros récentes et des corrections', async () => {
    store.set(STORAGE_KEYS.anilistToken, ANILIST_TOKEN);
    store.set(STORAGE_KEYS.malToken, MAL_TOKEN);
    store.set(SYNC_QUEUE_KEY, [queued(1, ['anilist'], BOTH), queued(2, null, BOTH), queued(3, ['anilist', 'mal'], BOTH), queued(4, null)]);
    store.set(PENDING_RATINGS_KEY, [rating(1, { anilist: 0 }), rating(2, BOTH), rating(3)]);
    store.set(STORAGE_KEYS.recentSyncs, [recent(1, { anilist: 0 }), recent(2, BOTH), recent(3)]);
    store.set(STORAGE_KEYS.pendingReviews, [correction(1, { anilist: 0 }), correction(2, BOTH), review(3)]);

    await storage.clearAniListSession();

    // Élément sans session (antérieur à la 2.2.0, non migré) : supprimé, comme ce qui ne vaut que pour AniList
    expect(await getSyncQueue()).toEqual([
      { ...queued(2, null), services: ['mal'], epochs: { mal: 0 } },
      { ...queued(3, null), services: ['mal'], epochs: { mal: 0 } },
    ]);
    expect(store.get(PENDING_RATINGS_KEY)).toEqual([rating(2, BOTH)]);
    expect(store.get(STORAGE_KEYS.recentSyncs)).toEqual([recent(2, BOTH)]);
    // Vérification simple : non liée au compte, conservée
    expect(store.get(STORAGE_KEYS.pendingReviews)).toEqual([correction(2, BOTH), review(3)]);
  });

  it('ne retire rien qui vaut encore pour une session ouverte : stockage non réécrit', async () => {
    store.set(STORAGE_KEYS.malToken, MAL_TOKEN);
    const ratings = [rating(2, BOTH)];
    store.set(PENDING_RATINGS_KEY, ratings);
    await storage.clearAniListSession();
    expect(store.get(PENDING_RATINGS_KEY)).toBe(ratings);
  });
});

describe('clearUserSyncDataIfNoSession (DATA-01, DATA-06)', () => {
  it('token AniList seulement expiré (« Reconnecter ») : la session reste, rien n’est effacé', async () => {
    seedEverything();
    store.set(STORAGE_KEYS.anilistToken, { accessToken: 'anilist', expiresAt: 1 });
    await storage.clearMalSession();
    expect(await storage.clearUserSyncDataIfNoSession()).toBe(false);
    expect(store.has(SYNC_QUEUE_KEY)).toBe(true);
    expect(store.has(PLATFORM_LINKS_KEY)).toBe(true);
  });

  it('plus aucun token : données de l’utilisateur effacées', async () => {
    seedEverything();
    store.delete(STORAGE_KEYS.malToken);
    await storage.clearAniListSession();
    expect(await storage.clearUserSyncDataIfNoSession()).toBe(true);
    expect(store.has(STORAGE_KEYS.pendingReviews)).toBe(false);
    expect(store.has(PLATFORM_LINKS_KEY)).toBe(false);
    expect(store.has('airingWeek:2026-10-12')).toBe(false);
    expect(store.has(STORAGE_KEYS.mediaMappings)).toBe(true);
    expect(store.get(STORAGE_KEYS.sessionEpoch)).toEqual({ anilist: 1, mal: 0 });
  });
});

describe('sessions ouvertes', () => {
  it('token enregistré (AniList même expiré) : génération du service, 0 par défaut', async () => {
    expect(await storage.getOpenSessions()).toEqual({});
    store.set(STORAGE_KEYS.anilistToken, { accessToken: 'anilist', expiresAt: 1 });
    store.set(STORAGE_KEYS.sessionEpoch, { anilist: 4 });
    expect(await storage.getOpenSessions()).toEqual({ anilist: 4 });
    store.set(STORAGE_KEYS.malToken, MAL_TOKEN);
    expect(await storage.getOpenSessions()).toEqual({ anilist: 4, mal: 0 });
    expect(await storage.isSessionOpen('anilist', 4)).toBe(true);
    expect(await storage.isSessionOpen('anilist', 3)).toBe(false);
    expect(await storage.isSessionOpen('mal', undefined)).toBe(false);
  });

  it('file : un échec d’une session fermée n’est jamais enregistré, l’entrée de même épisode est retirée', async () => {
    store.set(STORAGE_KEYS.anilistToken, ANILIST_TOKEN);
    store.set(STORAGE_KEYS.sessionEpoch, { anilist: 1 });
    store.set(SYNC_QUEUE_KEY, [queued(1, ['anilist'], { anilist: 1 })]);
    expect(await saveQueueItem(queued(1, ['anilist'], { anilist: 0 }))).toBe(false);
    expect(store.has(SYNC_QUEUE_KEY)).toBe(false);
    expect(await saveQueueItem(queued(2, null, { anilist: 1, mal: 0 }))).toBe(true);
    expect(await getSyncQueue()).toEqual([{ ...queued(2, ['anilist']), epochs: { anilist: 1 } }]);
  });
});

describe('plafonds (TEST-10)', () => {
  it('savePendingReview : une carte par saison (la dernière l’emporte), 20 au plus, la plus récente en premier', async () => {
    for (let n = 1; n <= MAX_PENDING_REVIEWS + 3; n++) await storage.savePendingReview(review(n));
    await storage.savePendingReview(review(23, { reason: 'Remplacée', createdAt: 100 }));
    const reviews = await storage.getPendingReviews();
    expect(reviews).toHaveLength(MAX_PENDING_REVIEWS);
    expect(reviews[0]).toMatchObject({ key: review(23).key, reason: 'Remplacée' });
    expect(reviews.filter((r) => r.key === review(23).key)).toHaveLength(1);
    expect(reviews.map((r) => r.createdAt)).not.toContain(1);
  });

  it('addRecentSync : une entrée par saison, 5 au plus, la plus récente en premier', async () => {
    for (let n = 1; n <= 7; n++) await storage.addRecentSync(recent(n, BOTH));
    await storage.addRecentSync(recent(6, BOTH, 50));
    const syncs = await storage.getRecentSyncs();
    expect(syncs).toHaveLength(MAX_RECENT_SYNCS);
    expect(syncs.map((s) => s.mediaId)).toEqual([6, 7, 5, 4, 3]);
  });
});

describe('écritures sous session (ARCH-17, AUTH-04, DATA-05)', () => {
  it('writeIfSession : écrit tant que la session relevée est ouverte, rien après une déconnexion', async () => {
    store.set(STORAGE_KEYS.malToken, MAL_TOKEN);
    expect(await storage.writeIfSession('mal', 0, { [STORAGE_KEYS.malViewer]: { id: 2, name: 'M' } })).toBe(true);
    expect(store.get(STORAGE_KEYS.malViewer)).toEqual({ id: 2, name: 'M' });

    await storage.clearMalSession();
    expect(await storage.writeIfSession('mal', 0, { [STORAGE_KEYS.malViewer]: { id: 2, name: 'M' } })).toBe(false);
    expect(store.has(STORAGE_KEYS.malViewer)).toBe(false);
  });

  it('writeIfSession : autre compte connecté depuis (nouvelle génération) → rien n’est écrit', async () => {
    store.set(STORAGE_KEYS.anilistToken, ANILIST_TOKEN);
    await storage.clearAniListSession();
    store.set(STORAGE_KEYS.anilistToken, { accessToken: 'autre', expiresAt: FAR });
    expect(await storage.saveCachedViewer({ id: 1, name: 'A', siteUrl: 'https://anilist.co/user/1', avatarUrl: null }, 0)).toBe(false);
    expect(store.has(STORAGE_KEYS.anilistViewer)).toBe(false);
    expect(await storage.saveCachedViewer({ id: 3, name: 'B', siteUrl: 'https://anilist.co/user/3', avatarUrl: null }, 1)).toBe(true);
    expect(store.get(STORAGE_KEYS.anilistViewer)).toMatchObject({ id: 3 });
  });

  it('writeIfSessions : toutes les sessions relevées doivent rester ouvertes ; aucune relevée → rien', async () => {
    store.set(STORAGE_KEYS.anilistToken, ANILIST_TOKEN);
    store.set(STORAGE_KEYS.malToken, MAL_TOKEN);
    expect(await storage.writeIfSessions(BOTH, { [STORAGE_KEYS.compareLast]: { n: 1 } })).toBe(true);
    await storage.clearMalSession();
    expect(await storage.writeIfSessions(BOTH, { [STORAGE_KEYS.compareLast]: { n: 2 } })).toBe(false);
    expect(store.has(STORAGE_KEYS.compareLast)).toBe(false);
    // Session AniList seule relevée : la déconnexion MAL n'y change rien
    expect(await storage.writeIfSessions({ anilist: 0 }, { 'airingWeek:2026-10-12': {} })).toBe(true);
    expect(await storage.writeIfSessions({}, { 'airingWeek:2026-10-05': {} })).toBe(false);
    expect(store.has('airingWeek:2026-10-05')).toBe(false);
  });

  it('saveRefreshedMalToken : abandonné après une déconnexion, ou si le token renouvelé n’est plus enregistré (AUTH-01)', async () => {
    const next = { accessToken: 'mal2', refreshToken: 'refresh2', expiresAt: FAR };
    store.set(STORAGE_KEYS.malToken, MAL_TOKEN);
    expect(await storage.saveRefreshedMalToken('autre', next, 0)).toBe(false);
    expect(store.get(STORAGE_KEYS.malToken)).toEqual(MAL_TOKEN);
    expect(await storage.saveRefreshedMalToken('mal', next, 0)).toBe(true);
    expect(await revealToken('mal', store.get(STORAGE_KEYS.malToken))).toEqual(next);

    await storage.clearMalSession();
    expect(await storage.saveRefreshedMalToken('mal2', { ...next, accessToken: 'mal3' }, 0)).toBe(false);
    expect(store.has(STORAGE_KEYS.malToken)).toBe(false);
  });
});

describe('token refusé (AUTH-02)', () => {
  it('clearAniListSessionIfToken : n’efface que le token refusé, une reconnexion entre-temps est conservée', async () => {
    seedEverything();
    store.set(STORAGE_KEYS.anilistToken, { accessToken: 'nouveau', expiresAt: FAR });
    expect(await storage.clearAniListSessionIfToken('anilist')).toBe(false);
    expect(store.get(STORAGE_KEYS.anilistToken)).toEqual({ accessToken: 'nouveau', expiresAt: FAR });
    expect(store.has(STORAGE_KEYS.anilistViewer)).toBe(true);
    expect(store.get(STORAGE_KEYS.sessionEpoch)).toEqual({ anilist: 0, mal: 0 });

    expect(await storage.clearAniListSessionIfToken('nouveau')).toBe(true);
    expect(store.has(STORAGE_KEYS.anilistToken)).toBe(false);
    expect(store.has(STORAGE_KEYS.anilistViewer)).toBe(false);
    expect(store.get(STORAGE_KEYS.sessionEpoch)).toEqual({ anilist: 1, mal: 0 });
  });

  it('clearMalSessionIfToken : symétrique ; aucun token enregistré → rien', async () => {
    seedEverything();
    expect(await storage.clearMalSessionIfToken('ancien')).toBe(false);
    expect(store.get(STORAGE_KEYS.malToken)).toEqual(MAL_TOKEN);
    expect(await storage.clearMalSessionIfToken('mal')).toBe(true);
    expect(store.has(STORAGE_KEYS.malToken)).toBe(false);
    expect(store.has(STORAGE_KEYS.malViewer)).toBe(false);
    expect(store.get(STORAGE_KEYS.sessionEpoch)).toEqual({ anilist: 0, mal: 1 });
    expect(await storage.clearMalSessionIfToken('mal')).toBe(false);
    expect(store.get(STORAGE_KEYS.sessionEpoch)).toEqual({ anilist: 0, mal: 1 });
  });
});

describe('indicateur « Session expirée » (AUTH-03)', () => {
  it('posé par un token refusé, retiré par la déconnexion volontaire et par une connexion', async () => {
    seedEverything();
    expect(await storage.clearAniListSessionIfToken('anilist')).toBe(true);
    expect(await storage.clearMalSessionIfToken('mal')).toBe(true);
    expect(await storage.isSessionExpired('anilist')).toBe(true);
    expect(await storage.isSessionExpired('mal')).toBe(true);
    // Les données de l'utilisateur (plus aucune session ouverte) n'emportent pas l'indicateur
    await storage.clearUserSyncDataIfNoSession();
    expect(store.get(SESSION_EXPIRED_KEYS.anilist)).toBe(true);

    await storage.saveToken(ANILIST_TOKEN);
    await storage.saveMalToken(MAL_TOKEN);
    expect(await storage.isSessionExpired('anilist')).toBe(false);
    expect(await storage.isSessionExpired('mal')).toBe(false);

    store.set(SESSION_EXPIRED_KEYS.anilist, true);
    store.set(SESSION_EXPIRED_KEYS.mal, true);
    await storage.clearAniListSession();
    await storage.clearMalSession();
    expect(store.has(SESSION_EXPIRED_KEYS.anilist)).toBe(false);
    expect(store.has(SESSION_EXPIRED_KEYS.mal)).toBe(false);
  });
});

describe('correspondances : écritures non destructives (ARCH-15)', () => {
  const valid = (mediaId: number): MediaMapping => ({ mediaId, numbering: 'season', offset: 0, episodes: 12 });
  /** Entrée d'un format que cette version ne sait pas lire (autre version, garde resserrée) */
  const unreadable = { mediaId: 7, numbering: 'absolute-v3', offset: 0, episodes: 12 };
  const mappings = (): unknown => store.get(STORAGE_KEYS.mediaMappings);

  beforeEach(() => store.set(STORAGE_KEYS.mediaMappings, { 'adn:7:s1': unreadable, 'crunchyroll:A:s1': valid(1) }));

  it('saveMediaMapping : une entrée illisible survit, seule la clé visée change', async () => {
    await storage.saveMediaMapping('crunchyroll:B:s1', valid(2));
    expect(mappings()).toEqual({ 'adn:7:s1': unreadable, 'crunchyroll:A:s1': valid(1), 'crunchyroll:B:s1': valid(2) });
    expect(await storage.getMediaMappings()).toEqual({ 'crunchyroll:A:s1': valid(1), 'crunchyroll:B:s1': valid(2) });
  });

  it('saveMediaMappingsIfAbsent : jamais d’écrasement d’une correspondance lisible, entrée illisible gardée', async () => {
    expect(await storage.saveMediaMappingsIfAbsent([{ key: 'crunchyroll:A:s1', mapping: valid(9) }, { key: 'crunchyroll:C:s1', mapping: valid(3) }])).toBe(1);
    expect(mappings()).toEqual({ 'adn:7:s1': unreadable, 'crunchyroll:A:s1': valid(1), 'crunchyroll:C:s1': valid(3) });
  });

  it('deleteMediaMapping : retire la seule clé visée, illisible comprise', async () => {
    await storage.deleteMediaMapping('crunchyroll:A:s1');
    expect(mappings()).toEqual({ 'adn:7:s1': unreadable });
    await storage.deleteMediaMapping('adn:7:s1');
    expect(mappings()).toEqual({});
  });

  it('deleteMediaMappingsByPrefix : les autres plateformes, même illisibles, restent', async () => {
    expect(await storage.deleteMediaMappingsByPrefix('crunchyroll:')).toBe(1);
    expect(mappings()).toEqual({ 'adn:7:s1': unreadable });
  });

  it('une correspondance au mediaId non entier, au décalage non entier ou sans épisode n’est jamais lue (BAK-02)', async () => {
    store.set(STORAGE_KEYS.mediaMappings, { a: { ...valid(1), mediaId: 1.5 }, b: { ...valid(2), offset: 0.5 }, c: { ...valid(3), episodes: 0 }, d: valid(4) });
    expect(Object.keys(await storage.getMediaMappings())).toEqual(['d']);
  });
});

describe('tokens chiffrés au repos (SEC-01)', () => {
  beforeEach(() => forgetTokenKey());

  it('saveToken / saveMalToken : AES-GCM versionné, aucun secret lisible dans le stockage, IV neuf à chaque écriture', async () => {
    await storage.saveToken(ANILIST_TOKEN);
    await storage.saveMalToken(MAL_TOKEN);
    const anilist = store.get(STORAGE_KEYS.anilistToken);
    const mal = store.get(STORAGE_KEYS.malToken);
    expect(anilist).toEqual({ v: 1, iv: expect.any(String), data: expect.any(String), expiresAt: FAR });
    expect(mal).toEqual({ v: 1, iv: expect.any(String), data: expect.any(String), expiresAt: FAR });
    // Aucun token en clair : ni la valeur, ni les champs du token
    expect(JSON.stringify([anilist, mal])).not.toMatch(/accessToken|refreshToken|"anilist"|"mal"|"refresh"/);
    expect(await revealToken('anilist', anilist)).toEqual(ANILIST_TOKEN);
    expect(await revealToken('mal', mal)).toEqual(MAL_TOKEN);

    await storage.saveMalToken(MAL_TOKEN);
    const again = store.get(STORAGE_KEYS.malToken);
    expect(again).not.toEqual(mal);
    expect(await revealToken('mal', again)).toEqual(MAL_TOKEN);
  });

  it('déchiffrement : lecture du service worker identique au token enregistré ; chiffré d’un autre service refusé', async () => {
    await storage.saveToken(ANILIST_TOKEN);
    await storage.saveMalToken(MAL_TOKEN);
    expect(await tokenAccess.getValidToken()).toEqual(ANILIST_TOKEN);
    expect(await tokenAccess.getMalToken()).toEqual(MAL_TOKEN);
    // Chiffré AniList recopié sous la clé MAL : données authentifiées différentes, illisible
    expect((await storage.readStoredToken('mal')).kind).toBe('sealed');
    store.set(STORAGE_KEYS.malToken, store.get(STORAGE_KEYS.anilistToken));
    expect((await storage.readStoredToken('mal')).kind).toBe('unreadable');
  });

  it('présence et expiration lues sans déchiffrement (pages de l’extension, sessions ouvertes)', async () => {
    expect(await storage.hasValidAniListToken()).toBe(false);
    expect(await storage.hasMalToken()).toBe(false);
    await storage.saveToken({ accessToken: 'expire', expiresAt: 1 });
    await storage.saveMalToken(MAL_TOKEN);
    // Clé perdue : la présence reste lisible (la session n'est fermée qu'au déchiffrement)
    forgetTokenKey();
    expect(await storage.hasAniListToken()).toBe(true);
    expect(await storage.hasValidAniListToken()).toBe(false);
    expect(await storage.hasMalToken()).toBe(true);
    expect(await storage.getOpenSessions()).toEqual({ anilist: 0, mal: 0 });
  });

  it('ancien token en clair : chiffré au premier accès du service worker, même valeur renvoyée', async () => {
    store.set(STORAGE_KEYS.anilistToken, ANILIST_TOKEN);
    store.set(STORAGE_KEYS.malToken, MAL_TOKEN);
    expect(await tokenAccess.getMalToken()).toEqual(MAL_TOKEN);
    // Les deux tokens chiffrés en une fois, sous le verrou
    expect(store.get(STORAGE_KEYS.malToken)).toMatchObject({ v: 1 });
    expect(store.get(STORAGE_KEYS.anilistToken)).toMatchObject({ v: 1 });
    expect(await tokenAccess.getValidToken()).toEqual(ANILIST_TOKEN);
    expect(await tokenAccess.getMalToken()).toEqual(MAL_TOKEN);
  });

  it('encryptLegacyTokens (mise à jour) : chiffre les seuls tokens en clair, sans changer de session', async () => {
    store.set(STORAGE_KEYS.anilistToken, ANILIST_TOKEN);
    await storage.saveMalToken(MAL_TOKEN);
    const sealedMal = store.get(STORAGE_KEYS.malToken);
    expect(await storage.encryptLegacyTokens()).toBe(1);
    expect(store.get(STORAGE_KEYS.malToken)).toEqual(sealedMal);
    expect(await revealToken('anilist', store.get(STORAGE_KEYS.anilistToken))).toEqual(ANILIST_TOKEN);
    expect(await storage.encryptLegacyTokens()).toBe(0);
    expect(await storage.getOpenSessions()).toEqual({ anilist: 0, mal: 0 });
  });

  it('clé perdue (IndexedDB vidée) : déconnexion propre avec « Session expirée », une seule fois', async () => {
    seedEverything();
    await storage.saveToken(ANILIST_TOKEN);
    await storage.saveMalToken(MAL_TOKEN);
    forgetTokenKey();

    expect(await tokenAccess.getMalToken()).toBeNull();
    expect(store.has(STORAGE_KEYS.malToken)).toBe(false);
    expect(store.has(STORAGE_KEYS.malViewer)).toBe(false);
    expect(await storage.isSessionExpired('mal')).toBe(true);
    expect(store.get(STORAGE_KEYS.sessionEpoch)).toEqual({ anilist: 0, mal: 1 });
    // Aucune boucle : la lecture suivante ne trouve plus rien à fermer
    expect(await tokenAccess.getMalToken()).toBeNull();
    expect(store.get(STORAGE_KEYS.sessionEpoch)).toEqual({ anilist: 0, mal: 1 });

    expect(await tokenAccess.getValidToken()).toBeNull();
    expect(await storage.isSessionExpired('anilist')).toBe(true);
    // Plus aucune session : données de l'utilisateur effacées comme après un token refusé
    expect(store.has(SYNC_QUEUE_KEY)).toBe(false);
    expect(store.has(STORAGE_KEYS.recentSyncs)).toBe(false);
  });

  it('clé perdue mais reconnexion entre-temps : la nouvelle session est conservée', async () => {
    await storage.saveMalToken(MAL_TOKEN);
    forgetTokenKey();
    const read = await storage.readStoredToken('mal');
    if (read.kind !== 'unreadable') throw new Error('attendu : unreadable');
    await storage.saveMalToken({ ...MAL_TOKEN, accessToken: 'neuf' });
    expect(await storage.clearUnreadableSession('mal', read.sealed)).toBe(false);
    expect(await tokenAccess.getMalToken()).toMatchObject({ accessToken: 'neuf' });
  });

  it('tokens chiffrés : refus (AUTH-02) et renouvellement (AUTH-01) comparés sur le token déchiffré', async () => {
    await storage.saveToken(ANILIST_TOKEN);
    await storage.saveMalToken(MAL_TOKEN);
    expect(await storage.clearAniListSessionIfToken('autre')).toBe(false);
    expect(await storage.saveRefreshedMalToken('autre', { ...MAL_TOKEN, accessToken: 'mal2' }, 0)).toBe(false);
    expect(await storage.saveRefreshedMalToken('mal', { ...MAL_TOKEN, accessToken: 'mal2' }, 0)).toBe(true);
    expect(await storage.clearMalSessionIfToken('mal')).toBe(false);
    expect(await storage.clearMalSessionIfToken('mal2')).toBe(true);
    expect(await storage.clearAniListSessionIfToken('anilist')).toBe(true);
    expect(store.has(STORAGE_KEYS.anilistToken)).toBe(false);
  });

  it('readTokenSecrets (rapport de diagnostic) : valeurs déchiffrées, rien si la clé est perdue', async () => {
    await storage.saveToken(ANILIST_TOKEN);
    await storage.saveMalToken(MAL_TOKEN);
    expect(await tokenAccess.readTokenSecrets()).toEqual(['anilist', 'mal', 'refresh']);
    forgetTokenKey();
    expect(await tokenAccess.readTokenSecrets()).toEqual([]);
    // Sans effet de bord : aucune déconnexion
    expect(store.has(STORAGE_KEYS.malToken)).toBe(true);
  });
});
