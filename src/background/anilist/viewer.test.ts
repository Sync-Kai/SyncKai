import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AniListViewer } from '../../shared/anilist.types';

// Requête AniList et cache simulés : getViewer est testé seul (le client l'est dans client.test.ts)
const deps = vi.hoisted(() => ({
  anilistQuery: vi.fn<(query: string, isData: (data: unknown) => boolean, variables?: Record<string, unknown>, lane?: string) => Promise<unknown>>(),
  getSessionEpoch: vi.fn<(service: string) => Promise<number>>(),
  saveCachedViewer: vi.fn<(viewer: AniListViewer, epoch: number) => Promise<boolean>>(),
}));
vi.mock('./client', () => ({ anilistQuery: deps.anilistQuery }));
vi.mock('../../browser/storage/sessions', async (importOriginal) => ({ ...(await importOriginal<typeof import('../../browser/storage/sessions')>()), getSessionEpoch: deps.getSessionEpoch }));
vi.mock('../../browser/storage/viewer-cache', async (importOriginal) => ({ ...(await importOriginal<typeof import('../../browser/storage/viewer-cache')>()), saveCachedViewer: deps.saveCachedViewer }));

const { getViewer } = await import('./viewer');

/** Réponse validée par la garde de la requête, comme le ferait le client */
function answer(data: unknown): void {
  deps.anilistQuery.mockImplementation(async (_query, isData) => {
    if (!isData(data)) throw new Error('garde refusée');
    return data;
  });
}

describe('getViewer (profil et statistiques du menu du compte)', () => {
  beforeEach(() => {
    deps.anilistQuery.mockReset();
    deps.getSessionEpoch.mockReset();
    deps.getSessionEpoch.mockResolvedValue(2);
    deps.saveCachedViewer.mockReset();
    deps.saveCachedViewer.mockResolvedValue(true);
  });

  it('une seule requête Viewer : profil et statistics.anime (count, épisodes, minutes → jours), mis en cache avec la génération', async () => {
    answer({ Viewer: { id: 5, name: 'Kai', siteUrl: 'https://anilist.co/user/Kai', avatar: { medium: null }, statistics: { anime: { count: 258, episodesWatched: 3152, minutesWatched: 77760 } } } });
    const viewer: AniListViewer = { id: 5, name: 'Kai', siteUrl: 'https://anilist.co/user/Kai', avatarUrl: null, stats: { animeCount: 258, episodes: 3152, days: 54 } };
    await expect(getViewer()).resolves.toEqual({ ok: true, data: viewer });
    expect(deps.saveCachedViewer).toHaveBeenCalledWith(viewer, 2);
    expect(deps.anilistQuery).toHaveBeenCalledTimes(1);
    const [query, , , lane] = deps.anilistQuery.mock.calls[0] ?? [];
    expect(query).toMatch(/statistics\s*\{\s*anime\s*\{\s*count\s+episodesWatched\s+minutesWatched\s*\}\s*\}/);
    expect(lane).toBe('interactive');
  });

  it('statistiques absentes ou illisibles : stats null, le profil reste valide', async () => {
    answer({ Viewer: { id: 5, name: 'Kai', siteUrl: 'https://anilist.co/user/Kai', statistics: { anime: { count: '3' } } } });
    await expect(getViewer()).resolves.toMatchObject({ ok: true, data: { id: 5, stats: null } });
    answer({ Viewer: { id: 5, name: 'Kai', siteUrl: 'https://anilist.co/user/Kai', statistics: null } });
    await expect(getViewer()).resolves.toMatchObject({ ok: true, data: { id: 5, stats: null } });
  });

  it('déconnexion pendant la requête (cache refusé) : NOT_AUTHENTICATED, rien renvoyé à l’interface (AUTH-04)', async () => {
    deps.saveCachedViewer.mockResolvedValue(false);
    answer({ Viewer: { id: 5, name: 'Kai', siteUrl: 'https://anilist.co/user/Kai', statistics: { anime: { count: 1, episodesWatched: 1, minutesWatched: 24 } } } });
    await expect(getViewer()).resolves.toMatchObject({ ok: false, code: 'NOT_AUTHENTICATED' });
  });
});
