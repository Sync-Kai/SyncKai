import { describe, expect, it } from 'vitest';
import type { EpisodeInfo } from '../../shared/episode.types';
import type { RecentSync } from '../../shared/review.types';
import { buildPlatforms } from './watching';

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
    expect(links).toEqual([{ platform: 'crunchyroll', url: anilist[0].url }, learnedAdn]);
  });

  it('sans lien appris : l’historique complète toujours AniList', () => {
    expect(buildPlatforms(anilist, [sync('adn', 'https://animationdigitalnetwork.com/video/1311-x/5-ep')])).toEqual([
      { platform: 'crunchyroll', url: anilist[0].url },
      { platform: 'adn', url: 'https://animationdigitalnetwork.com/video/1311-x/5-ep' },
    ]);
    expect(buildPlatforms(null, [])).toEqual([]);
  });
});
