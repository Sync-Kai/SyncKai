import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AniListViewer } from '../../shared/anilist.types';
import { isAniListViewer } from '../../shared/anilist.types';
import type { ProfileStats } from '../../shared/profile-stats';

/** Profil lu sans bloc détaillé : tout est vide, format de note par défaut */
const EMPTY_PROFILE: ProfileStats = { scoreFormat: 'POINT_10', meanScore100: null, statuses: [], formats: [], genres: [], scores: [], studios: [], decades: [], rewatched: null };

// Requête AniList et cache simulés : getViewer est testé seul (le client l'est dans client.test.ts)
const deps = vi.hoisted(() => ({
  anilistQuery: vi.fn<(query: string, isData: (data: unknown) => boolean, variables?: Record<string, unknown>, lane?: string) => Promise<unknown>>(),
  getSessionEpoch: vi.fn<(service: string) => Promise<number>>(),
  saveCachedViewer: vi.fn<(viewer: AniListViewer, epoch: number) => Promise<boolean>>(),
  dropOtherAccountActivity: vi.fn<(service: string, accountId: number) => Promise<void>>(),
}));
vi.mock('./client', () => ({ anilistQuery: deps.anilistQuery }));
vi.mock('../../browser/storage/sessions', async (importOriginal) => ({ ...(await importOriginal<typeof import('../../browser/storage/sessions')>()), getSessionEpoch: deps.getSessionEpoch }));
vi.mock('../../browser/storage/viewer-cache', async (importOriginal) => ({ ...(await importOriginal<typeof import('../../browser/storage/viewer-cache')>()), saveCachedViewer: deps.saveCachedViewer }));
vi.mock('../../browser/storage/activity-history', () => ({ dropOtherAccountActivity: deps.dropOtherAccountActivity }));

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
    deps.dropOtherAccountActivity.mockReset();
    deps.dropOtherAccountActivity.mockResolvedValue(undefined);
  });

  it('une seule requête Viewer : profil et statistics.anime (count, épisodes, minutes → jours), mis en cache avec la génération', async () => {
    answer({ Viewer: { id: 5, name: 'Kai', siteUrl: 'https://anilist.co/user/Kai', avatar: { medium: null }, statistics: { anime: { count: 258, episodesWatched: 3152, minutesWatched: 77760 } } } });
    const viewer: AniListViewer = { id: 5, name: 'Kai', siteUrl: 'https://anilist.co/user/Kai', avatarUrl: null, stats: { animeCount: 258, episodes: 3152, days: 54 }, profile: EMPTY_PROFILE };
    await expect(getViewer()).resolves.toEqual({ ok: true, data: viewer });
    expect(deps.saveCachedViewer).toHaveBeenCalledWith(viewer, 2);
    expect(deps.anilistQuery).toHaveBeenCalledTimes(1);
    const [query, , , lane] = deps.anilistQuery.mock.calls[0] ?? [];
    // Mêmes statistiques que le menu, enrichies pour l'écran Stats, dans la même requête
    for (const field of [
      /mediaListOptions\s*\{\s*scoreFormat\s*\}/,
      /statistics\s*\{\s*anime\s*\{/,
      /count\s+episodesWatched\s+minutesWatched\s+meanScore/,
      /statuses\s*\{\s*status\s+count\s*\}/,
      /formats\s*\{\s*format\s+count\s*\}/,
      /genres\(limit:\s*6,\s*sort:\s*COUNT_DESC\)\s*\{\s*genre\s+count\s+meanScore\s*\}/,
      /scores\(sort:\s*MEAN_SCORE\)\s*\{\s*score\s+count\s*\}/,
      /studios\(limit:\s*5,\s*sort:\s*COUNT_DESC\)\s*\{\s*studio\s*\{\s*name\s*\}\s+count\s*\}/,
      /releaseYears\s*\{\s*releaseYear\s+count\s*\}/,
    ]) {
      expect(query).toMatch(field);
    }
    expect(lane).toBe('interactive');
  });

  it('profil enregistré avec profile (statistiques détaillées), stats du menu inchangées', async () => {
    answer({
      Viewer: {
        id: 5,
        name: 'Kai',
        siteUrl: 'https://anilist.co/user/Kai',
        mediaListOptions: { scoreFormat: 'POINT_10_DECIMAL' },
        statistics: { anime: { count: 10, episodesWatched: 120, minutesWatched: 2880, meanScore: 80.5, statuses: [{ status: 'COMPLETED', count: 10 }], scores: [{ score: 65, count: 3 }], releaseYears: [{ releaseYear: 1998, count: 4 }] } },
      },
    });
    const result = await getViewer();
    expect(result).toMatchObject({
      ok: true,
      data: {
        stats: { animeCount: 10, episodes: 120, days: 2 },
        profile: { scoreFormat: 'POINT_10_DECIMAL', meanScore100: 80.5, statuses: [{ status: 'COMPLETED', count: 10 }], scores: [{ score: 6.5, count: 3 }], decades: [{ decade: 1990, count: 4 }] },
      },
    });
    expect(deps.saveCachedViewer).toHaveBeenCalledWith(result.ok ? result.data : null, 2);
  });

  it('profil en cache sans profile (avant cette version) : toujours valide', () => {
    const legacy: AniListViewer = { id: 5, name: 'Kai', siteUrl: 'https://anilist.co/user/Kai', avatarUrl: null, stats: { animeCount: 1, episodes: 1, days: 1 } };
    expect(isAniListViewer(legacy)).toBe(true);
    expect(isAniListViewer({ ...legacy, profile: null })).toBe(true);
    expect(isAniListViewer({ ...legacy, profile: EMPTY_PROFILE })).toBe(true);
    expect(isAniListViewer({ ...legacy, profile: { ...EMPTY_PROFILE, statuses: [{ status: 'CURRENT', count: -1 }] } })).toBe(false);
  });

  it('profil relu du stockage : siteUrl hors d’anilist.co refusé (SEC-03, lien du menu du compte)', () => {
    const viewer: AniListViewer = { id: 5, name: 'Kai', siteUrl: 'https://anilist.co/user/Kai', avatarUrl: null };
    expect(isAniListViewer(viewer)).toBe(true);
    expect(isAniListViewer({ ...viewer, siteUrl: 'https://evil.example/user/Kai' })).toBe(false);
    expect(isAniListViewer({ ...viewer, siteUrl: 'http://anilist.co/user/Kai' })).toBe(false);
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
    expect(deps.dropOtherAccountActivity).not.toHaveBeenCalled();
  });

  it('profil enregistré : part d’activité d’un autre compte AniList retirée', async () => {
    answer({ Viewer: { id: 5, name: 'Kai', siteUrl: 'https://anilist.co/user/Kai', statistics: null } });
    await expect(getViewer()).resolves.toMatchObject({ ok: true, data: { id: 5 } });
    expect(deps.dropOtherAccountActivity).toHaveBeenCalledWith('anilist', 5);
    // Échec du stockage de l'historique : le profil reste renvoyé
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    deps.dropOtherAccountActivity.mockRejectedValueOnce(new Error('stockage illisible'));
    await expect(getViewer()).resolves.toMatchObject({ ok: true, data: { id: 5 } });
    vi.restoreAllMocks();
  });
});
