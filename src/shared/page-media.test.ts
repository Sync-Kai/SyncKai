import { describe, expect, it } from 'vitest';
import type { EpisodeInfo } from './episode.types';
import { isPageMediaInfo } from './page-media.types';
import { pageMediaFromEpisode, pageMediaFromSeries } from './page-media';

const episode: EpisodeInfo = {
  platform: 'crunchyroll',
  episodeId: 'GE00376431JAJP',
  seriesId: 'GRMG8ZQZR',
  seriesSlug: 'one-piece',
  animeTitle: 'One Piece',
  seasonNumber: 24,
  seasonTitle: 'Elbaph',
  seasonEpisodeNumber: 25,
  displayedEpisodeNumber: 1180,
  episodeTitle: 'Titre',
  url: 'https://www.crunchyroll.com/fr/watch/GE00376431JAJP/titre',
};

describe('fiche de la page', () => {
  it('page d’épisode : série et saison reprises de l’épisode', () => {
    const page = pageMediaFromEpisode(episode);
    expect(page).toMatchObject({ kind: 'episode', seriesTitle: 'One Piece', seasonNumber: 24, seasonTitle: 'Elbaph', episode });
    expect(isPageMediaInfo(page)).toBe(true);
  });

  it('page de série : textes bornés et saison invalide écartée', () => {
    const page = pageMediaFromSeries('adn', { seriesId: '1311', seriesSlug: 'tougen-anki', seriesTitle: 'T'.repeat(400), seasonNumber: 1.5, seasonTitle: null });
    expect(page.seriesTitle).toHaveLength(300);
    expect(page.seasonNumber).toBeNull();
    expect(isPageMediaInfo(page)).toBe(true);
  });

  it('page de série : nombre d’épisodes de la saison facultatif, borné', () => {
    const series = { seriesId: 'G24H1N3MP', seriesSlug: 'mushoku-tensei', seriesTitle: 'Mushoku Tensei', seasonNumber: 2, seasonTitle: null };
    expect(pageMediaFromSeries('crunchyroll', { ...series, seasonEpisodeCount: 25 }).seasonEpisodeCount).toBe(25);
    expect(pageMediaFromSeries('crunchyroll', { ...series, seasonEpisodeCount: 0 }).seasonEpisodeCount).toBeNull();
    expect(pageMediaFromSeries('adn', series).seasonEpisodeCount).toBeNull();
    expect(isPageMediaInfo(pageMediaFromSeries('crunchyroll', { ...series, seasonEpisodeCount: 25 }))).toBe(true);
  });

  it('validation : nombre d’épisodes absent accepté, invalide rejeté', () => {
    const page = pageMediaFromEpisode(episode);
    expect(isPageMediaInfo(page)).toBe(true);
    expect(isPageMediaInfo({ ...page, seasonEpisodeCount: 12 })).toBe(true);
    expect(isPageMediaInfo({ ...page, seasonEpisodeCount: -1 })).toBe(false);
    expect(isPageMediaInfo({ ...page, seasonEpisodeCount: '25' })).toBe(false);
  });
});
