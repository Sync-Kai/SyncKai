import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MalViewer } from '../../shared/mal.types';

// Token MAL et fermeture de session simulés : malRequest est testé seul (le renouvellement l'est dans mal/auth.test.ts)
const auth = vi.hoisted(() => ({
  getMalAccessToken: vi.fn<(options?: { rejected?: string }) => Promise<string | null>>(),
  endSessionIfToken: vi.fn<(service: string, accessToken: string) => Promise<boolean>>(),
  getSessionEpoch: vi.fn<(service: string) => Promise<number>>(),
  saveCachedMalViewer: vi.fn<(viewer: MalViewer, epoch: number) => Promise<boolean>>(),
}));
vi.mock('./auth', () => ({ getMalAccessToken: auth.getMalAccessToken }));
vi.mock('../../browser/storage/session-end', () => ({ endSessionIfToken: auth.endSessionIfToken }));
vi.mock('../../browser/storage/sessions', async (importOriginal) => ({ ...(await importOriginal<typeof import('../../browser/storage/sessions')>()), getSessionEpoch: auth.getSessionEpoch }));
vi.mock('../../browser/storage/viewer-cache', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../browser/storage/viewer-cache')>()),
  saveCachedMalViewer: auth.saveCachedMalViewer,
}));

import {
  deleteMalEntry,
  fromMalStatus,
  getMalAnime,
  getMalViewer,
  malProgressBody,
  malRequest,
  malStatusBody,
  parseMalListStatus,
  saveMalEntry,
  saveMalListStatus,
  saveMalNotes,
  saveMalProgress,
  saveMalScore,
  toMalStatus,
} from './client';

describe('statuts MyAnimeList', () => {
  it('convertit les statuts MAL vers les statuts communs', () => {
    expect(fromMalStatus('watching', false)).toBe('CURRENT');
    expect(fromMalStatus('completed', false)).toBe('COMPLETED');
    expect(fromMalStatus('on_hold', false)).toBe('PAUSED');
    expect(fromMalStatus('dropped', false)).toBe('DROPPED');
    expect(fromMalStatus('plan_to_watch', undefined)).toBe('PLANNING');
    expect(fromMalStatus('inconnu', false)).toBeNull();
  });

  it('traite un revisionnage MAL comme REPEATING', () => {
    expect(fromMalStatus('completed', true)).toBe('REPEATING');
  });

  it('convertit les statuts écrits par SyncKai', () => {
    expect(toMalStatus('CURRENT')).toBe('watching');
    expect(toMalStatus('COMPLETED')).toBe('completed');
    expect(toMalStatus('REPEATING')).toBe('completed');
  });

  it('lit my_list_status (absent = anime hors liste)', () => {
    expect(parseMalListStatus({ status: 'watching', num_episodes_watched: 4, is_rewatching: false })).toEqual({ status: 'CURRENT', progress: 4 });
    expect(parseMalListStatus(undefined)).toBeNull();
    expect(parseMalListStatus({ status: 'plan_to_watch' })).toEqual({ status: 'PLANNING', progress: 0 });
  });

  it('lit le compteur de revisionnages', () => {
    expect(parseMalListStatus({ status: 'completed', num_episodes_watched: 3, is_rewatching: true, num_times_rewatched: 1 })).toEqual({
      status: 'REPEATING',
      progress: 3,
      repeat: 1,
    });
  });

  it('construit le corps du PATCH de progression', () => {
    // is_rewatching explicite : une correction ou un +1 en CURRENT / COMPLETED sort d'un revisionnage MAL
    expect(Object.fromEntries(malProgressBody(4, 'CURRENT'))).toEqual({ status: 'watching', num_watched_episodes: '4', is_rewatching: 'false' });
    expect(Object.fromEntries(malProgressBody(12, 'COMPLETED'))).toEqual({ status: 'completed', num_watched_episodes: '12', is_rewatching: 'false' });
    expect(Object.fromEntries(malProgressBody(2, 'REPEATING'))).toEqual({ status: 'completed', num_watched_episodes: '2', is_rewatching: 'true' });
    expect(Object.fromEntries(malProgressBody(12, 'COMPLETED', 2))).toEqual({
      status: 'completed',
      num_watched_episodes: '12',
      is_rewatching: 'false',
      num_times_rewatched: '2',
    });
  });
});

describe('changement de statut MyAnimeList', () => {
  it('convertit les statuts du popup vers les statuts MAL', () => {
    expect(malStatusBody('PAUSED', 5).get('status')).toBe('on_hold');
    expect(malStatusBody('DROPPED', 5).get('status')).toBe('dropped');
    expect(malStatusBody('COMPLETED', 12).get('status')).toBe('completed');
  });

  it('construit le corps du PATCH (sortie de revisionnage, compteur si fourni)', () => {
    expect(Object.fromEntries(malStatusBody('PAUSED', 5))).toEqual({ status: 'on_hold', num_watched_episodes: '5', is_rewatching: 'false' });
    expect(Object.fromEntries(malStatusBody('COMPLETED', 12, 2))).toEqual({
      status: 'completed',
      num_watched_episodes: '12',
      is_rewatching: 'false',
      num_times_rewatched: '2',
    });
  });

  it('lit la note (0 = non notée)', () => {
    expect(parseMalListStatus({ status: 'watching', num_episodes_watched: 4, score: 8 })).toEqual({ status: 'CURRENT', progress: 4, score: 8 });
    expect(parseMalListStatus({ status: 'watching', num_episodes_watched: 4, score: 0 })).toEqual({ status: 'CURRENT', progress: 4 });
  });
});

describe('ajout à la liste MyAnimeList (fiche de la page)', () => {
  it('plan_to_watch / watching à 0 épisode', () => {
    expect(Object.fromEntries(malStatusBody('PLANNING', 0))).toEqual({ status: 'plan_to_watch', num_watched_episodes: '0', is_rewatching: 'false' });
    expect(Object.fromEntries(malStatusBody('CURRENT', 0))).toEqual({ status: 'watching', num_watched_episodes: '0', is_rewatching: 'false' });
  });
});

// ─── malRequest : 401, 429, délai (TEST-03, AUTH-09) ──────────────────────

describe('malRequest : 401, 429 et délai (TEST-03)', () => {
  const isUser = (data: unknown): data is { id: number } => typeof data === 'object' && data !== null && 'id' in data;
  const json = (status: number, body: unknown, headers: Record<string, string> = {}): Response =>
    new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...headers } });
  const bearer = (init: RequestInit | undefined): string | null => new Headers(init?.headers).get('Authorization');

  beforeEach(() => {
    auth.getMalAccessToken.mockReset();
    auth.endSessionIfToken.mockReset();
    // Token A, puis B après le renouvellement qui suit un refus de A
    auth.getMalAccessToken.mockImplementation(async ({ rejected } = {}) => (rejected === 'A' ? 'B' : 'A'));
    auth.endSessionIfToken.mockResolvedValue(true);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('401 : un renouvellement du token refusé, puis succès', async () => {
    const fetchMock = vi.fn<typeof fetch>(async (_input, init) => (bearer(init) === 'Bearer A' ? new Response(null, { status: 401 }) : json(200, { id: 1 })));
    vi.stubGlobal('fetch', fetchMock);

    await expect(malRequest('/users/@me', isUser)).resolves.toEqual({ id: 1 });
    expect(auth.getMalAccessToken).toHaveBeenLastCalledWith({ rejected: 'A' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(auth.endSessionIfToken).not.toHaveBeenCalled();
  });

  it('401 encore après le renouvellement : session fermée, TOKEN_INVALID', async () => {
    vi.stubGlobal('fetch', vi.fn<typeof fetch>(async () => new Response(null, { status: 401 })));

    await expect(malRequest('/users/@me', isUser)).rejects.toMatchObject({ code: 'TOKEN_INVALID' });
    expect(auth.endSessionIfToken).toHaveBeenCalledWith('mal', 'B');
  });

  it('429 avec Retry-After : une nouvelle tentative après le délai indiqué, puis RATE_LIMITED', async () => {
    vi.useFakeTimers();
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(null, { status: 429, headers: { 'Retry-After': '8' } }))
      .mockResolvedValueOnce(json(200, { id: 1 }))
      .mockResolvedValue(new Response(null, { status: 429, headers: { 'Retry-After': '8' } }));
    vi.stubGlobal('fetch', fetchMock);

    const result = malRequest('/users/@me', isUser);
    await vi.advanceTimersByTimeAsync(7_900);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(200);
    await expect(result).resolves.toEqual({ id: 1 });
    expect(fetchMock).toHaveBeenCalledTimes(2);

    // Deux 429 de suite : une seule nouvelle tentative
    const limited = malRequest('/users/@me', isUser);
    const settled = expect(limited).rejects.toMatchObject({ code: 'RATE_LIMITED' });
    await vi.advanceTimersByTimeAsync(10_000);
    await settled;
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it('délai dépassé pendant la lecture du corps : NETWORK avec timedOut (AUTH-09)', async () => {
    const response = json(200, { id: 1 });
    response.json = (): Promise<never> => Promise.reject(new DOMException('signal timed out', 'TimeoutError'));
    vi.stubGlobal('fetch', vi.fn<typeof fetch>(async () => response));

    await expect(malRequest('/users/@me', isUser)).rejects.toMatchObject({ code: 'NETWORK', timedOut: true });
  });

  it('réponse non JSON : INVALID_RESPONSE', async () => {
    vi.stubGlobal('fetch', vi.fn<typeof fetch>(async () => new Response('<html>', { status: 200 })));

    await expect(malRequest('/users/@me', isUser)).rejects.toMatchObject({ code: 'INVALID_RESPONSE', timedOut: false });
  });
});

describe('commentaire et retrait (MyAnimeList)', () => {
  const json = (status: number, body: unknown): Response => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

  beforeEach(() => {
    auth.getMalAccessToken.mockReset();
    auth.getMalAccessToken.mockResolvedValue('A');
  });
  afterEach(() => vi.unstubAllGlobals());

  it('lit `comments` (champ demandé explicitement, vide = aucun)', async () => {
    const fetchMock = vi.fn<typeof fetch>(async () =>
      json(200, { id: 52991, title: 'Frieren', num_episodes: 28, my_list_status: { status: 'watching', num_episodes_watched: 3, comments: 'À revoir' } }),
    );
    vi.stubGlobal('fetch', fetchMock);
    expect(await getMalAnime(52991)).toMatchObject({ notes: 'À revoir', entry: { status: 'CURRENT', progress: 3 } });
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('my_list_status{status,score,num_episodes_watched,is_rewatching,num_times_rewatched,comments}');
  });

  it('PATCH my_list_status avec le seul champ comments', async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => json(200, { status: 'watching', num_episodes_watched: 3, comments: 'Top' }));
    vi.stubGlobal('fetch', fetchMock);
    await expect(saveMalNotes(52991, 'Top')).resolves.toMatchObject({ status: 'CURRENT', progress: 3 });
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(String(url)).toBe('https://api.myanimelist.net/v2/anime/52991/my_list_status');
    expect(init?.method).toBe('PATCH');
    expect(String(init?.body)).toBe('comments=Top');
  });

  it('DELETE my_list_status ; 404 (déjà absente, doc MAL) = succès ; autre erreur propagée', async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => json(200, null));
    vi.stubGlobal('fetch', fetchMock);
    await expect(deleteMalEntry(52991)).resolves.toBeUndefined();
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(String(url)).toBe('https://api.myanimelist.net/v2/anime/52991/my_list_status');
    expect(init?.method).toBe('DELETE');
    expect(init?.body).toBeUndefined();

    vi.stubGlobal('fetch', vi.fn<typeof fetch>(async () => new Response('', { status: 200 })));
    await expect(deleteMalEntry(52991)).resolves.toBeUndefined();

    vi.stubGlobal('fetch', vi.fn<typeof fetch>(async () => json(404, { error: 'not_found' })));
    await expect(deleteMalEntry(52991)).resolves.toBeUndefined();

    vi.stubGlobal('fetch', vi.fn<typeof fetch>(async () => json(500, { error: 'boom' })));
    await expect(deleteMalEntry(52991)).rejects.toMatchObject({ code: 'API_ERROR', httpStatus: 500 });
  });
});

describe('écritures de liste MyAnimeList (PATCH my_list_status)', () => {
  const json = (status: number, body: unknown): Response => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
  const sentBody = (fetchMock: ReturnType<typeof vi.fn<typeof fetch>>): Record<string, string> => Object.fromEntries(new URLSearchParams(String(fetchMock.mock.calls[0]?.[1]?.body)));

  beforeEach(() => {
    auth.getMalAccessToken.mockReset();
    auth.getMalAccessToken.mockResolvedValue('A');
  });
  afterEach(() => vi.unstubAllGlobals());

  it('progression, statut manuel, note et alignement : un PATCH avec les seuls champs voulus, entrée relue de la réponse', async () => {
    const saved = { status: 'completed', num_episodes_watched: 12, is_rewatching: false, num_times_rewatched: 1, score: 8 };
    const cases: Array<[() => Promise<unknown>, Record<string, string>]> = [
      [() => saveMalProgress(1, 12, 'COMPLETED', 1), { status: 'completed', num_watched_episodes: '12', is_rewatching: 'false', num_times_rewatched: '1' }],
      [() => saveMalListStatus(1, 'PAUSED', 5), { status: 'on_hold', num_watched_episodes: '5', is_rewatching: 'false' }],
      [() => saveMalScore(1, 8), { score: '8' }],
      [() => saveMalEntry(1, { status: 'REPEATING', progress: 3 }), { status: 'completed', is_rewatching: 'true', num_watched_episodes: '3' }],
    ];
    for (const [write, body] of cases) {
      const fetchMock = vi.fn<typeof fetch>(async () => json(200, saved));
      vi.stubGlobal('fetch', fetchMock);
      await expect(write()).resolves.toEqual({ status: 'COMPLETED', progress: 12, repeat: 1, score: 8 });
      expect(fetchMock.mock.calls[0]?.[1]?.method).toBe('PATCH');
      expect(sentBody(fetchMock)).toEqual(body);
    }
  });

  it('réponse au PATCH sans statut lisible : INVALID_RESPONSE (écriture non confirmée)', async () => {
    vi.stubGlobal('fetch', vi.fn<typeof fetch>(async () => json(200, { status: 'inconnu', num_episodes_watched: 3 })));
    await expect(saveMalProgress(1, 3, 'CURRENT')).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
  });
});

describe('malRequest : session absente et réseau', () => {
  const isUser = (data: unknown): data is { id: number } => typeof data === 'object' && data !== null && 'id' in data;

  beforeEach(() => {
    auth.getMalAccessToken.mockReset();
    auth.getMalAccessToken.mockResolvedValue('A');
  });
  afterEach(() => vi.unstubAllGlobals());

  it('non connecté : NOT_AUTHENTICATED, aucune requête', async () => {
    auth.getMalAccessToken.mockResolvedValue(null);
    const fetchMock = vi.fn<typeof fetch>();
    vi.stubGlobal('fetch', fetchMock);
    await expect(malRequest('/users/@me', isUser)).rejects.toMatchObject({ code: 'NOT_AUTHENTICATED' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('réseau coupé : NETWORK ; délai dépassé avant la réponse : NETWORK avec timedOut', async () => {
    vi.stubGlobal('fetch', vi.fn<typeof fetch>(async () => Promise.reject(new TypeError('Failed to fetch'))));
    await expect(malRequest('/users/@me', isUser)).rejects.toMatchObject({ code: 'NETWORK', timedOut: false });
    vi.stubGlobal('fetch', vi.fn<typeof fetch>(async () => Promise.reject(new DOMException('signal timed out', 'TimeoutError'))));
    await expect(malRequest('/users/@me', isUser)).rejects.toMatchObject({ code: 'NETWORK', timedOut: true });
  });
});

describe('getMalViewer (profil du popup, ne lève jamais)', () => {
  const json = (body: unknown): Response => new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });

  beforeEach(() => {
    auth.getMalAccessToken.mockReset();
    auth.getMalAccessToken.mockResolvedValue('A');
    auth.getSessionEpoch.mockReset();
    auth.getSessionEpoch.mockResolvedValue(3);
    auth.saveCachedMalViewer.mockReset();
    auth.saveCachedMalViewer.mockResolvedValue(true);
  });
  afterEach(() => vi.unstubAllGlobals());

  it('profil lu et mis en cache avec la génération relevée avant la requête ; image hors des hôtes permis écartée', async () => {
    vi.stubGlobal('fetch', vi.fn<typeof fetch>(async () => json({ id: 7, name: 'Kai', picture: 'https://cdn.myanimelist.net/images/userimages/7.jpg' })));
    const viewer: MalViewer = { id: 7, name: 'Kai', pictureUrl: 'https://cdn.myanimelist.net/images/userimages/7.jpg', stats: null };
    await expect(getMalViewer()).resolves.toEqual({ ok: true, data: viewer });
    expect(auth.saveCachedMalViewer).toHaveBeenCalledWith(viewer, 3);

    vi.stubGlobal('fetch', vi.fn<typeof fetch>(async () => json({ id: 7, name: 'Kai', picture: 'https://pirate.example/7.jpg' })));
    await expect(getMalViewer()).resolves.toEqual({ ok: true, data: { id: 7, name: 'Kai', pictureUrl: null, stats: null } });
  });

  it('statistiques du menu du compte dans la même requête (anime_statistics) ; illisibles : null, profil gardé', async () => {
    const fetchMock = vi.fn<typeof fetch>(async () =>
      json({ id: 7, name: 'Kai', anime_statistics: { num_items: 1000, num_items_plan_to_watch: 997, num_episodes: 8, num_days: 0.09, num_items_watching: 2 } }),
    );
    vi.stubGlobal('fetch', fetchMock);
    await expect(getMalViewer()).resolves.toEqual({ ok: true, data: { id: 7, name: 'Kai', pictureUrl: null, stats: { animeCount: 3, episodes: 8, days: 0.09 } } });
    const url = new URL(String(fetchMock.mock.calls[0]?.[0]));
    expect(url.pathname).toBe('/v2/users/@me');
    expect(url.searchParams.get('fields')).toBe('picture,anime_statistics');

    vi.stubGlobal('fetch', vi.fn<typeof fetch>(async () => json({ id: 7, name: 'Kai', anime_statistics: { num_items: '3' } })));
    await expect(getMalViewer()).resolves.toEqual({ ok: true, data: { id: 7, name: 'Kai', pictureUrl: null, stats: null } });
  });

  it('déconnexion pendant la requête (cache refusé) : NOT_AUTHENTICATED (AUTH-04)', async () => {
    auth.saveCachedMalViewer.mockResolvedValue(false);
    vi.stubGlobal('fetch', vi.fn<typeof fetch>(async () => json({ id: 7, name: 'Kai' })));
    await expect(getMalViewer()).resolves.toMatchObject({ ok: false, code: 'NOT_AUTHENTICATED' });
  });

  it('erreur de l’API : son code ; profil illisible : INVALID_RESPONSE ; erreur inattendue : API_ERROR', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    auth.getMalAccessToken.mockResolvedValueOnce(null);
    await expect(getMalViewer()).resolves.toMatchObject({ ok: false, code: 'NOT_AUTHENTICATED' });

    vi.stubGlobal('fetch', vi.fn<typeof fetch>(async () => json({ id: '7' })));
    await expect(getMalViewer()).resolves.toMatchObject({ ok: false, code: 'INVALID_RESPONSE' });

    auth.getSessionEpoch.mockRejectedValueOnce(new Error('stockage illisible'));
    await expect(getMalViewer()).resolves.toMatchObject({ ok: false, code: 'API_ERROR' });
    vi.restoreAllMocks();
  });
});
