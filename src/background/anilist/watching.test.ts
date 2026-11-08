import { describe, expect, it, vi } from 'vitest';
import type { EpisodeInfo } from '../../shared/episode.types';
import type { RecentSync } from '../../shared/review.types';
import { buildPlatforms, fetchAniListEntries, fetchMalEntries, MAL_WATCHING_PATH } from './watching';
import { anilistQuery } from './client';
import { malRequest } from '../mal/client';

vi.mock('./client', () => ({ anilistQuery: vi.fn(), anilistPublicQuery: vi.fn(() => Promise.reject(new Error('catalogue hors test'))) }));
vi.mock('./viewer', () => ({ getAniListUserId: () => Promise.resolve(1) }));
vi.mock('../mal/client', () => ({ malRequest: vi.fn() }));

const episode = (platform: EpisodeInfo['platform'], url: string): EpisodeInfo => ({
  platform,
  episodeId: 'E1',
  seriesId: null,
  seriesSlug: null,
  animeTitle: 'T',
  seasonNumber: null,
  seasonTitle: null,
  seasonEpisodeNumber: 1,
  displayedEpisodeNumber: 1,
  episodeTitle: null,
  url,
});
const sync = (platform: EpisodeInfo['platform'], url: string): RecentSync => ({
  key: `k-${platform}`,
  episode: episode(platform, url),
  mediaId: 21,
  mediaTitle: 'T',
  progress: 1,
  syncedAt: 1,
});

describe('buildPlatforms', () => {
  const anilist = [{ url: 'https://www.crunchyroll.com/series/GRMG8ZQZR/one-piece' }, { url: 'https://www.netflix.com/title/1' }];
  const learnedAdn = { platform: 'adn', url: 'https://animationdigitalnetwork.com/video/1311-x' } as const;

  it('ordre : liens AniList, puis liens appris, puis historique ; un par plateforme', () => {
    const links = buildPlatforms(anilist, [sync('adn', 'https://animationdigitalnetwork.com/video/1311-x/5-ep'), sync('crunchyroll', 'https://www.crunchyroll.com/watch/E1/x')], [
      { platform: 'crunchyroll', url: 'https://www.crunchyroll.com/series/OTHER' },
      learnedAdn,
    ]);
    expect(links).toEqual([{ platform: 'crunchyroll', url: anilist[0].url }, { platform: 'netflix', url: anilist[1].url }, learnedAdn]);
  });

  it('sans lien appris : l’historique complète toujours AniList', () => {
    expect(buildPlatforms(anilist, [sync('adn', 'https://animationdigitalnetwork.com/video/1311-x/5-ep')])).toEqual([
      { platform: 'crunchyroll', url: anilist[0].url },
      { platform: 'netflix', url: anilist[1].url },
      { platform: 'adn', url: 'https://animationdigitalnetwork.com/video/1311-x/5-ep' },
    ]);
    expect(buildPlatforms(null, [])).toEqual([]);
  });
});

describe('lecture de la durée et du statut de liste', () => {
  it('AniList : lit media.duration (24) et le statut REPEATING de l’entrée', async () => {
    vi.mocked(anilistQuery).mockResolvedValueOnce({
      MediaListCollection: {
        lists: [
          {
            entries: [
              { progress: 3, updatedAt: 1, status: 'REPEATING', media: { id: 21, duration: 24, title: { userPreferred: 'One Piece' } } },
              { progress: 1, updatedAt: 1, status: 'CURRENT', media: { id: 22, duration: null, title: { userPreferred: 'B' } } },
              { progress: 1, updatedAt: 1, media: { id: 23, title: { userPreferred: 'C' } } },
            ],
          },
        ],
      },
    });
    const entries = await fetchAniListEntries([], {}, 'interactive');
    expect(entries.map((e) => [e.episodeMinutes, e.listStatus])).toEqual([
      [24, 'REPEATING'],
      [null, 'CURRENT'],
      [null, null],
    ]);
  });

  it('MAL : average_episode_duration 1440 devient 24, is_rewatching true devient REPEATING', async () => {
    vi.mocked(malRequest).mockResolvedValueOnce({
      data: [
        { node: { id: 1, title: 'A', average_episode_duration: 1440 }, list_status: { num_episodes_watched: 2, is_rewatching: true } },
        { node: { id: 2, title: 'B', average_episode_duration: 0 }, list_status: { is_rewatching: false } },
        { node: { id: 3, title: 'C', average_episode_duration: 1500 }, list_status: {} },
      ],
    });
    const entries = await fetchMalEntries([], {}, 'interactive');
    expect(entries.map((e) => [e.episodeMinutes, e.listStatus])).toEqual([
      [24, 'REPEATING'],
      [null, 'CURRENT'],
      [25, 'CURRENT'],
    ]);
  });

  it('MAL_WATCHING_PATH demande average_episode_duration', () => {
    expect(MAL_WATCHING_PATH).toContain('average_episode_duration');
  });
});
