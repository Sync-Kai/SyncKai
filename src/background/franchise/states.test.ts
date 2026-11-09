import { beforeEach, describe, expect, it, vi } from 'vitest';

const deps = vi.hoisted(() => ({
  anilistQuery: vi.fn(),
  fetchMalFullList: vi.fn(),
  connectedServices: vi.fn(),
  getOpenSessions: vi.fn(),
}));
vi.mock('../anilist/client', () => ({ anilistQuery: deps.anilistQuery }));
vi.mock('../mal/full-list', () => ({ fetchMalFullList: deps.fetchMalFullList }));
vi.mock('../../browser/airing-alarm', () => ({ connectedServices: deps.connectedServices }));
vi.mock('../../browser/storage/sessions', () => ({ getOpenSessions: deps.getOpenSessions }));

const { loadListStates } = await import('./states');

const entry = (id: number, status: string | null, progress = 0): { id: number; mediaListEntry: { status: string; progress: number } | null } => ({
  id,
  mediaListEntry: status === null ? null : { status, progress },
});

beforeEach(() => {
  for (const mock of Object.values(deps)) mock.mockReset();
  deps.getOpenSessions.mockResolvedValue({ anilist: 1, mal: 2 });
});

describe('loadListStates', () => {
  it('AniList seul : mal null, statuts convertis, hors liste = null', async () => {
    deps.connectedServices.mockResolvedValue(['anilist']);
    deps.anilistQuery.mockResolvedValue({
      Page: { media: [entry(1, 'COMPLETED'), entry(2, 'REPEATING'), entry(3, 'CURRENT', 4), entry(4, 'PLANNING'), entry(5, 'PAUSED'), entry(6, 'DROPPED'), entry(7, null)] },
    });
    const result = await loadListStates({ mediaIds: [1, 2, 3, 4, 5, 6, 7, 8], malIds: [10] });
    expect(result.mal).toBeNull();
    expect(deps.fetchMalFullList).not.toHaveBeenCalled();
    expect(result.anilist).toEqual({
      1: { kind: 'watched', progress: null },
      2: { kind: 'watched', progress: null },
      3: { kind: 'inProgress', progress: 4 },
      4: { kind: 'planned', progress: null },
      5: { kind: 'paused', progress: null },
      6: { kind: 'dropped', progress: null },
      7: null,
      8: null,
    });
    expect(deps.anilistQuery.mock.calls[0]?.[3]).toBe('background');
  });

  it('MAL seul : anilist null, états par identifiant MAL', async () => {
    deps.connectedServices.mockResolvedValue(['mal']);
    deps.fetchMalFullList.mockResolvedValue([
      { malId: 10, status: 'CURRENT', progress: 3 },
      { malId: 11, status: 'COMPLETED', progress: 12 },
      { malId: 99, status: 'DROPPED', progress: 1 },
    ]);
    const result = await loadListStates({ mediaIds: [1], malIds: [10, 11, 12] });
    expect(result.anilist).toBeNull();
    expect(deps.anilistQuery).not.toHaveBeenCalled();
    expect(result.mal).toEqual({ 10: { kind: 'inProgress', progress: 3 }, 11: { kind: 'watched', progress: null }, 12: null });
  });

  it('une lecture MAL en échec donne mal null, AniList est rendu', async () => {
    deps.connectedServices.mockResolvedValue(['anilist', 'mal']);
    deps.anilistQuery.mockResolvedValue({ Page: { media: [entry(1, 'CURRENT', 2)] } });
    deps.fetchMalFullList.mockRejectedValue(new Error('boom'));
    const result = await loadListStates({ mediaIds: [1], malIds: [10] });
    expect(result.mal).toBeNull();
    expect(result.anilist).toEqual({ 1: { kind: 'inProgress', progress: 2 } });
  });

  it('plafonne à 90 identifiants, une requête AniList par 50', async () => {
    deps.connectedServices.mockResolvedValue(['anilist']);
    deps.anilistQuery.mockResolvedValue({ Page: { media: [] } });
    const ids = Array.from({ length: 120 }, (_, i) => i + 1);
    const result = await loadListStates({ mediaIds: ids, malIds: [] });
    expect(deps.anilistQuery).toHaveBeenCalledTimes(2);
    expect((deps.anilistQuery.mock.calls[0]?.[2] as { ids: number[] }).ids).toHaveLength(50);
    expect((deps.anilistQuery.mock.calls[1]?.[2] as { ids: number[] }).ids).toHaveLength(40);
    expect(Object.keys(result.anilist ?? {})).toHaveLength(90);
  });

  it('session changée pendant la lecture : le service concerné répond null', async () => {
    deps.connectedServices.mockResolvedValue(['anilist', 'mal']);
    deps.getOpenSessions.mockResolvedValueOnce({ anilist: 1, mal: 2 }).mockResolvedValueOnce({ anilist: 5, mal: 2 });
    deps.anilistQuery.mockResolvedValue({ Page: { media: [entry(1, 'COMPLETED')] } });
    deps.fetchMalFullList.mockResolvedValue([{ malId: 10, status: 'COMPLETED', progress: 12 }]);
    const result = await loadListStates({ mediaIds: [1], malIds: [10] });
    expect(result.anilist).toBeNull();
    expect(result.mal).toEqual({ 10: { kind: 'watched', progress: null } });
  });

  it('une lecture AniList en échec donne anilist null', async () => {
    deps.connectedServices.mockResolvedValue(['anilist']);
    deps.anilistQuery.mockRejectedValue(new Error('boom'));
    const result = await loadListStates({ mediaIds: [1], malIds: [] });
    expect(result).toEqual({ anilist: null, mal: null });
  });
});
