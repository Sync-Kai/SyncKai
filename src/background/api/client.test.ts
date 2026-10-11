import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../shared/storage', () => ({ getValidToken: async () => null }));
vi.mock('../../shared/session-end', () => ({ endSession: async () => undefined }));

import { anilistPublicQuery } from './client';
import { aniListBudget } from './rate-limit';

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
