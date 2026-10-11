import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { EpisodeInfo } from '../shared/episode.types';
import type { SyncOutcome } from '../shared/sync.types';

// Routage de EPISODE_COMPLETED : synchro, file de relance et fiche de l'onglet simulées, accès Netflix piloté.
const mocks = vi.hoisted(() => ({
  hasNetflixAccess: vi.fn(),
  syncEpisode: vi.fn(),
  recordSyncOutcome: vi.fn(),
  forgetPageResolutions: vi.fn(),
  refreshTabPageMedia: vi.fn(),
}));
/** Sessions ouvertes au début de la synchro : transmises à la file avec l'épisode */
const SESSIONS = { anilist: 2, mal: 0 };
vi.mock('../shared/storage', () => ({ getOpenSessions: async () => SESSIONS }));
vi.mock('../shared/netflix-access', () => ({ hasNetflixAccess: mocks.hasNetflixAccess }));
vi.mock('./sync/sync-service', () => ({ syncEpisode: mocks.syncEpisode }));
vi.mock('./sync/queue', () => ({ recordSyncOutcome: mocks.recordSyncOutcome }));
vi.mock('./page-media', () => ({ forgetPageResolutions: mocks.forgetPageResolutions, refreshTabPageMedia: mocks.refreshTabPageMedia }));

const { handleEpisodeCompleted } = await import('./episode-completed');

function episode(platform: EpisodeInfo['platform']): EpisodeInfo {
  return {
    platform,
    episodeId: '81991750',
    seriesId: '81991749',
    seriesSlug: null,
    animeTitle: 'Comme un rat',
    seasonNumber: 1,
    seasonTitle: null,
    seasonEpisodeNumber: 1,
    displayedEpisodeNumber: 1,
    episodeTitle: null,
    url: 'https://www.netflix.com/watch/81991750',
  };
}

const SYNCED: SyncOutcome = { status: 'synced', mediaTitle: 'Comme un rat', results: [] };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.syncEpisode.mockResolvedValue(SYNCED);
  mocks.recordSyncOutcome.mockImplementation((_episode: EpisodeInfo, _services: unknown, outcome: SyncOutcome) => Promise.resolve(outcome));
  mocks.refreshTabPageMedia.mockResolvedValue(undefined);
});

describe('EPISODE_COMPLETED — accès Netflix', () => {
  it('Netflix sans la permission (onglet ouvert avant le retrait) → ignoré, sans synchro, file ni fiche', async () => {
    mocks.hasNetflixAccess.mockResolvedValue(false);
    expect(await handleEpisodeCompleted({ episode: episode('netflix'), services: null }, 7)).toEqual({ status: 'ignored', noAccess: true });
    expect(mocks.syncEpisode).not.toHaveBeenCalled();
    expect(mocks.recordSyncOutcome).not.toHaveBeenCalled();
    expect(mocks.refreshTabPageMedia).not.toHaveBeenCalled();
  });

  it('Netflix avec la permission → synchronisé et passé à la file', async () => {
    mocks.hasNetflixAccess.mockResolvedValue(true);
    const ep = episode('netflix');
    expect(await handleEpisodeCompleted({ episode: ep, services: ['mal'] }, 7)).toEqual(SYNCED);
    expect(mocks.syncEpisode).toHaveBeenCalledWith(ep, ['mal'], SESSIONS);
    expect(mocks.recordSyncOutcome).toHaveBeenCalledWith(ep, ['mal'], SYNCED, SESSIONS);
    expect(mocks.refreshTabPageMedia).toHaveBeenCalledWith(7, ep);
  });

  it('Crunchyroll et ADN : la permission Netflix n’est jamais lue', async () => {
    for (const platform of ['crunchyroll', 'adn'] as const) {
      expect(await handleEpisodeCompleted({ episode: episode(platform), services: null }, undefined)).toEqual(SYNCED);
    }
    expect(mocks.hasNetflixAccess).not.toHaveBeenCalled();
    expect(mocks.syncEpisode).toHaveBeenCalledTimes(2);
  });
});
