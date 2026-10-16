import { describe, expect, it } from 'vitest';
import { isEpisodeInfo } from './episode.types';
import { hasSignals, isPlatformSignals, toPlatformSignals, withSignals } from './match-signals';

describe('toPlatformSignals', () => {
  it('valeurs invalides ou absentes retirées une à une, ordre des champs fixe (tables dédoublonnées par JSON)', () => {
    const all = { country: 'JP', originalTitle: '無職転生', format: 'series', episodeMinutes: 23.7, airing: false, seasonEpisodeCount: 25, seriesYear: 2021, seasonYear: 2023 } as const;
    expect(JSON.stringify(toPlatformSignals(all))).toBe('{"seasonYear":2023,"seriesYear":2021,"seasonEpisodeCount":25,"airing":false,"episodeMinutes":23.7,"format":"series","originalTitle":"無職転生","country":"JP"}');
    expect(toPlatformSignals({ seasonYear: 1850, seriesYear: null, seasonEpisodeCount: 0, episodeMinutes: 23.7, format: undefined, country: 'jp' })).toStrictEqual({ episodeMinutes: 23.7 });
    // `airing` seul, ou rien de valide : aucun signal comparable
    expect(toPlatformSignals({ airing: true, seasonYear: 2023.5 })).toBeUndefined();
    expect(toPlatformSignals({})).toBeUndefined();
  });
});

describe('withSignals', () => {
  it('propriété `signals` seulement s’il y en a (jamais `signals: undefined`)', () => {
    expect(withSignals({ seasonYear: 2023 })).toEqual({ signals: { seasonYear: 2023 } });
    expect(withSignals(undefined)).toEqual({});
    expect(Object.hasOwn(withSignals(undefined), 'signals')).toBe(false);
  });
});

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

  it('EpisodeInfo bornée (SEC-10) : textes trop longs et nombres non finis ou négatifs refusés, épisode décimal accepté', () => {
    const episode = { platform: 'crunchyroll', episodeId: 'GEP1', seriesId: 'GSERIES', seriesSlug: 'serie', animeTitle: 'X', seasonNumber: 0, seasonTitle: 'Saison', seasonEpisodeNumber: 24.5, displayedEpisodeNumber: 1180, episodeTitle: 'Titre', url: 'https://www.crunchyroll.com/watch/GEP1' };
    expect(isEpisodeInfo(episode)).toBe(true);
    for (const [field, value] of [
      ['animeTitle', 'x'.repeat(501)],
      ['episodeId', 'x'.repeat(201)],
      ['seriesId', 'x'.repeat(201)],
      ['seriesSlug', 'x'.repeat(201)],
      ['seasonTitle', 'x'.repeat(501)],
      ['episodeTitle', 'x'.repeat(1001)],
      ['url', `https://www.crunchyroll.com/${'x'.repeat(2048)}`],
      ['seasonNumber', Number.NaN],
      ['seasonEpisodeNumber', Number.POSITIVE_INFINITY],
      ['displayedEpisodeNumber', -1],
      ['displayedEpisodeNumber', 10_000_001],
    ] as const) {
      expect(isEpisodeInfo({ ...episode, [field]: value }), field).toBe(false);
    }
  });
});
