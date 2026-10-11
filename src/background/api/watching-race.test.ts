import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearAniListSession, clearMalSession, clearUserSyncData, getCachedWatching, getSessionEpoch } from '../../shared/storage';
import { getWatchingList } from './watching';

// Requêtes réseau contrôlées par le test : résolues à la main pour simuler une requête en vol
const network = vi.hoisted(() => ({ anilist: null as ((value: unknown) => void) | null, mal: null as ((value: unknown) => void) | null }));

vi.mock('./client', () => ({
  anilistQuery: () => new Promise((resolve) => (network.anilist = resolve)),
  anilistPublicQuery: () => Promise.reject(new Error('catalogue hors test')),
}));
vi.mock('./mal', () => ({ malRequest: () => new Promise((resolve) => (network.mal = resolve)) }));

const ANILIST_DATA = {
  MediaListCollection: { lists: [{ entries: [{ progress: 3, updatedAt: 1, media: { id: 21, title: { userPreferred: 'One Piece' } } }] }] },
};
const MAL_DATA = { data: [{ node: { id: 21, title: 'One Piece' }, list_status: { num_episodes_watched: 3 } }] };

const viewer = (id: number): Record<string, unknown> => ({ id, name: 'u', siteUrl: 'https://anilist.co/user/u', avatarUrl: null });

let data: Record<string, unknown>;

/** Stockage simulé + verrou Web Locks sérialisé (comme navigator.locks) */
function stubChrome(initial: Record<string, unknown>): void {
  data = { ...initial };
  const pick = (keys: string | string[] | null): Record<string, unknown> => {
    if (keys === null) return { ...data };
    const list = Array.isArray(keys) ? keys : [keys];
    return Object.fromEntries(list.filter((k) => k in data).map((k) => [k, data[k]]));
  };
  vi.stubGlobal('chrome', {
    storage: {
      local: {
        get: (keys: string | string[] | null) => Promise.resolve(pick(keys)),
        set: (items: Record<string, unknown>) => Promise.resolve(void Object.assign(data, items)),
        remove: (keys: string | string[]) => Promise.resolve(void (Array.isArray(keys) ? keys : [keys]).forEach((k) => delete data[k])),
      },
    },
  });
  let queue: Promise<unknown> = Promise.resolve();
  vi.stubGlobal('navigator', {
    language: 'fr',
    locks: {
      request: <T>(_name: string, task: () => Promise<T>): Promise<T> => {
        const run = queue.then(task, task);
        queue = run.catch(() => undefined);
        return run;
      },
    },
  });
}

/** Attend que la requête réseau du service soit partie (étapes asynchrones préalables) */
async function inFlight(service: 'anilist' | 'mal'): Promise<(value: unknown) => void> {
  await vi.waitFor(() => expect(network[service]).not.toBeNull());
  const resolve = network[service];
  if (!resolve) throw new Error('requête absente');
  return resolve;
}

describe('getWatchingList : déconnexion pendant la requête', () => {
  beforeEach(() => {
    network.anilist = null;
    network.mal = null;
    stubChrome({ anilistToken: { accessToken: 'a', expiresAt: Date.now() + 1e9 }, anilistViewer: viewer(1), malToken: { accessToken: 'm' } });
  });
  afterEach(() => vi.unstubAllGlobals());

  it('sans déconnexion : la liste est mise en cache et renvoyée', async () => {
    const pending = getWatchingList('anilist');
    (await inFlight('anilist'))(ANILIST_DATA);
    const result = await pending;
    expect(result.ok).toBe(true);
    expect((await getCachedWatching('anilist'))?.entries[0].title).toBe('One Piece');
  });

  it('AniList : la réponse arrivée après la déconnexion n’est ni mise en cache ni renvoyée', async () => {
    const pending = getWatchingList('anilist');
    const resolve = await inFlight('anilist');
    await clearAniListSession();
    resolve(ANILIST_DATA);
    const result = await pending;
    expect(result).toMatchObject({ ok: false, code: 'NOT_AUTHENTICATED' });
    expect(await getCachedWatching('anilist')).toBeNull();
    expect(data.watchingCache ?? {}).not.toHaveProperty('anilist');
  });

  it('MyAnimeList : même protection, la liste AniList en cache n’est pas touchée', async () => {
    const anilistList = { service: 'anilist', entries: [], fetchedAt: 1 };
    data.watchingCache = { anilist: anilistList };
    const pending = getWatchingList('mal');
    const resolve = await inFlight('mal');
    await clearMalSession();
    resolve(MAL_DATA);
    expect(await pending).toMatchObject({ ok: false, code: 'NOT_AUTHENTICATED' });
    expect(data.watchingCache).toEqual({ anilist: anilistList });
  });

  it('déconnexion puis reconnexion avant la réponse : l’ancienne liste reste écartée', async () => {
    const pending = getWatchingList('anilist');
    const resolve = await inFlight('anilist');
    await clearAniListSession();
    // Dernier service déconnecté : purge complète, la génération doit survivre
    await clearMalSession();
    await clearUserSyncData();
    data.anilistToken = { accessToken: 'b', expiresAt: Date.now() + 1e9 };
    resolve(ANILIST_DATA);
    expect((await pending).ok).toBe(false);
    expect(await getCachedWatching('anilist')).toBeNull();
    expect(await getSessionEpoch('anilist')).toBe(1);
  });

  it('une requête lancée après la déconnexion écrit de nouveau le cache', async () => {
    await clearAniListSession();
    data.anilistToken = { accessToken: 'b', expiresAt: Date.now() + 1e9 };
    data.anilistViewer = viewer(2);
    const pending = getWatchingList('anilist');
    (await inFlight('anilist'))(ANILIST_DATA);
    expect((await pending).ok).toBe(true);
    expect(await getCachedWatching('anilist')).not.toBeNull();
  });
});

describe('getWatchingList : liste récente servie sans requête (PERF-04)', () => {
  const cachedList = (fetchedAt: number): Record<string, unknown> => ({
    service: 'anilist',
    fetchedAt,
    entries: [{ mediaId: 21, malId: null, title: 'En cache', coverUrl: null, progress: 2, totalEpisodes: null, updatedAt: null, nextEpisode: null, airingStatus: null, platforms: [], lastSync: null, siteUrl: 'https://anilist.co/anime/21' }],
  });

  const EPISODE = {
    platform: 'crunchyroll',
    episodeId: 'E1',
    seriesId: null,
    seriesSlug: null,
    animeTitle: 'One Piece',
    seasonNumber: null,
    seasonTitle: null,
    seasonEpisodeNumber: 3,
    displayedEpisodeNumber: 3,
    episodeTitle: null,
    url: 'https://www.crunchyroll.com/watch/E1',
  };

  beforeEach(() => {
    network.anilist = null;
    network.mal = null;
    stubChrome({ anilistToken: { accessToken: 'a', expiresAt: Date.now() + 1e9 }, anilistViewer: viewer(1) });
  });
  afterEach(() => vi.unstubAllGlobals());

  it('GET_WATCHING sans force, cache de moins de 90 s : aucune requête', async () => {
    data.watchingCache = { anilist: cachedList(Date.now() - 30_000) };
    const result = await getWatchingList('anilist');
    expect(result).toMatchObject({ ok: true, data: { entries: [{ title: 'En cache' }] } });
    expect(network.anilist).toBeNull();
  });

  it('avec force, cache trop ancien ou synchro depuis : la liste est relue', async () => {
    data.watchingCache = { anilist: cachedList(Date.now() - 30_000) };
    const forced = getWatchingList('anilist', true);
    (await inFlight('anilist'))(ANILIST_DATA);
    expect((await forced).ok).toBe(true);
    expect((await getCachedWatching('anilist'))?.entries[0].title).toBe('One Piece');

    for (const patch of [{ watchingCache: { anilist: cachedList(Date.now() - 120_000) } }, { recentSyncs: [{ key: 'k', episode: EPISODE, mediaId: 21, mediaTitle: 'x', progress: 3, syncedAt: Date.now() }] }]) {
      network.anilist = null;
      data.watchingCache = { anilist: cachedList(Date.now() - 30_000) };
      Object.assign(data, patch);
      const pending = getWatchingList('anilist');
      (await inFlight('anilist'))(ANILIST_DATA);
      expect((await pending).ok).toBe(true);
    }
  });
});
