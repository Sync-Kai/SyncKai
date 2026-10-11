import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AniListToken } from '../../shared/auth.types';

// Token AniList et fermeture de session simulés : aucun token par défaut (catalogue public)
const mocks = vi.hoisted(() => ({
  getValidToken: vi.fn<() => Promise<AniListToken | null>>(async () => null),
  endSessionIfToken: vi.fn<(service: string, accessToken: string) => Promise<boolean>>(async () => true),
}));
vi.mock('../../shared/token-access', () => ({ getValidToken: mocks.getValidToken }));
vi.mock('../../shared/session-end', () => ({ endSessionIfToken: mocks.endSessionIfToken }));

import { anilistPublicQuery, anilistQuery } from './client';
import { aniListBudget, MAX_RETRY_WAIT_MS } from './rate-limit';

const isAny = (data: unknown): data is { ok: boolean } => typeof data === 'object' && data !== null;
const json = (status: number, body: unknown, headers: Record<string, string> = {}): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...headers } });

describe('client AniList : 429 et budget partagé', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(Date.parse('2026-10-08T16:32:00Z'));
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('« Retry-After: 0 » : nouvelle tentative après 5 s au moins, pas aussitôt', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(json(429, { errors: [{ message: 'Too Many Requests.' }] }, { 'Retry-After': '0', 'X-RateLimit-Remaining': '0' }))
      .mockResolvedValueOnce(json(200, { data: { ok: true } }, { 'X-RateLimit-Remaining': '25' }));
    vi.stubGlobal('fetch', fetchMock);

    const result = anilistPublicQuery('query { ok }', isAny);
    await vi.advanceTimersByTimeAsync(4_900);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(200);
    await expect(result).resolves.toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('requête de fond pendant la pénalité : attend, puis part', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(json(200, { data: { ok: true } }));
    vi.stubGlobal('fetch', fetchMock);
    aniListBudget.penalize(8_000);
    const result = anilistPublicQuery('query { ok }', isAny, {}, 'background');
    await vi.advanceTimersByTimeAsync(7_000);
    expect(fetchMock).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(5_000);
    await expect(result).resolves.toEqual({ ok: true });
  });
});

describe('client AniList : token refusé et erreurs GraphQL (TEST-03)', () => {
  const token = (accessToken: string): AniListToken => ({ accessToken, expiresAt: Number.MAX_SAFE_INTEGER });
  const authorization = (init: RequestInit | undefined): string | null => new Headers(init?.headers).get('Authorization');

  beforeEach(() => {
    vi.useFakeTimers();
    // Bien après les pénalités des tests précédents (budget partagé par le module)
    vi.setSystemTime(Date.parse('2026-10-09T12:00:00Z'));
    // Token A jusqu'à la fermeture de la session (comme clearAniListSessionIfToken)
    let current: AniListToken | null = token('A');
    mocks.getValidToken.mockImplementation(async () => current);
    mocks.endSessionIfToken.mockImplementation(async () => {
      current = null;
      return true;
    });
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    mocks.getValidToken.mockReset();
    mocks.endSessionIfToken.mockReset();
  });

  it('« Invalid token » en mode public : session fermée, requête rejouée sans Authorization', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(json(400, { errors: [{ message: 'Invalid token', status: 400 }] }))
      .mockResolvedValueOnce(json(200, { data: { ok: true } }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(anilistPublicQuery('query { ok }', isAny)).resolves.toEqual({ ok: true });
    expect(mocks.endSessionIfToken).toHaveBeenCalledWith('anilist', 'A');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(authorization(fetchMock.mock.calls[0]?.[1])).toBe('Bearer A');
    expect(authorization(fetchMock.mock.calls[1]?.[1])).toBeNull();
  });

  it('« Invalid token » en mode required : TOKEN_INVALID, aucun rejeu', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(json(400, { errors: [{ message: 'Invalid token', status: 400 }] }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(anilistQuery('query { ok }', isAny)).rejects.toMatchObject({ code: 'TOKEN_INVALID' });
    expect(mocks.endSessionIfToken).toHaveBeenCalledWith('anilist', 'A');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('200 avec errors : API_ERROR, session intacte', async () => {
    vi.stubGlobal('fetch', vi.fn<typeof fetch>().mockResolvedValue(json(200, { data: null, errors: [{ message: 'Not Found.', status: 404 }] })));

    await expect(anilistQuery('query { ok }', isAny)).rejects.toMatchObject({ code: 'API_ERROR', httpStatus: 200 });
    expect(mocks.endSessionIfToken).not.toHaveBeenCalled();
  });

  it('délai dépassé pendant la lecture du corps : NETWORK avec timedOut, pas « réponse invalide » (AUTH-09)', async () => {
    const response = json(200, { data: { ok: true } });
    response.json = (): Promise<never> => Promise.reject(new DOMException('signal timed out', 'TimeoutError'));
    vi.stubGlobal('fetch', vi.fn<typeof fetch>().mockResolvedValue(response));

    await expect(anilistQuery('query { ok }', isAny)).rejects.toMatchObject({ code: 'NETWORK', timedOut: true });
  });

  it('pénalité plus longue que l’attente maximale : RATE_LIMITED aussitôt, sans requête', async () => {
    const fetchMock = vi.fn<typeof fetch>();
    vi.stubGlobal('fetch', fetchMock);
    aniListBudget.penalize(MAX_RETRY_WAIT_MS + 10_000);

    await expect(anilistQuery('query { ok }', isAny)).rejects.toMatchObject({ code: 'RATE_LIMITED' });
    expect(fetchMock).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(MAX_RETRY_WAIT_MS + 10_000);
  });
});
