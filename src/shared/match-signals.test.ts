import { describe, expect, it } from 'vitest';
import { isEpisodeInfo } from './episode.types';
import { hasSignals, isPlatformSignals } from './match-signals';

describe('isPlatformSignals', () => {
  it('accepte des signaux bornés, facultatifs', () => {
    expect(isPlatformSignals({})).toBe(true);
    expect(isPlatformSignals({ seasonYear: 2023, seriesYear: 2021, seasonEpisodeCount: 25, airing: false, episodeMinutes: 23.7, format: 'series', originalTitle: '無職転生', country: 'JP' })).toBe(true);
  });

  it('refuse les valeurs hors bornes ou d’un autre type', () => {
    for (const value of [
      { seasonYear: 1850 },
      { seasonYear: 2023.5 },
      { seriesYear: '2023' },
      { seasonEpisodeCount: 0 },
      { seasonEpisodeCount: 20_000 },
      { episodeMinutes: -1 },
      { episodeMinutes: Number.POSITIVE_INFINITY },
      { format: 'ova' },
      { originalTitle: '' },
      { originalTitle: 'x'.repeat(201) },
      { country: 'jp' },
      { country: 'JPN' },
      { airing: 'yes' },
      null,
      [2023],
    ]) {
      expect(isPlatformSignals(value), JSON.stringify(value)).toBe(false);
    }
  });

  it('hasSignals : au moins un signal comparable (`airing` seul ne suffit pas)', () => {
    expect(hasSignals(undefined)).toBe(false);
    expect(hasSignals({})).toBe(false);
    expect(hasSignals({ airing: true })).toBe(false);
    expect(hasSignals({ seasonYear: 2023 })).toBe(true);
  });

  it('EpisodeInfo : signaux facultatifs, validés', () => {
    const episode = { platform: 'netflix', episodeId: '1', seriesId: '2', seriesSlug: null, animeTitle: 'X', seasonNumber: 1, seasonTitle: null, seasonEpisodeNumber: 1, displayedEpisodeNumber: 1, episodeTitle: null, url: 'https://www.netflix.com/watch/1' };
    expect(isEpisodeInfo(episode)).toBe(true);
    expect(isEpisodeInfo({ ...episode, signals: { seasonYear: 2023 } })).toBe(true);
    expect(isEpisodeInfo({ ...episode, signals: { seasonYear: 'x' } })).toBe(false);
  });
});
