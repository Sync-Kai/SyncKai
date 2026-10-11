import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Token MAL et fermeture de session simulés : malRequest est testé seul (le renouvellement l'est dans auth/mal.test.ts)
const auth = vi.hoisted(() => ({
  getMalAccessToken: vi.fn<(options?: { rejected?: string }) => Promise<string | null>>(),
  endSessionIfToken: vi.fn<(service: string, accessToken: string) => Promise<boolean>>(),
}));
vi.mock('../auth/mal', () => ({ getMalAccessToken: auth.getMalAccessToken }));
vi.mock('../../shared/session-end', () => ({ endSessionIfToken: auth.endSessionIfToken }));

import { fromMalStatus, malProgressBody, malRequest, malStatusBody, parseMalListStatus, toMalStatus } from './mal';

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
