import { describe, expect, it } from 'vitest';
import { adnSeriesTitleFromJsonLd, meaningfulSeasonTitle, parseAdnEpisodeLabel, parseAdnSeriesPath, parseAdnWatchPath } from './adn';
import { flattenJsonLd } from './parsing';

describe('parseAdnWatchPath', () => {
  it('extrait série et épisode d’une page de lecture (URL réelle)', () => {
    expect(parseAdnWatchPath('/video/1311-tougen-anki/29344-episode-1')).toEqual({
      seriesId: '1311',
      seriesSlug: 'tougen-anki',
      episodeId: '29344',
    });
  });

  it('accepte un préfixe de langue et un slash final', () => {
    expect(parseAdnWatchPath('/de/video/1311-tougen-anki/29344-folge-1/')?.episodeId).toBe('29344');
  });

  it('ignore les pages de série et le reste du site', () => {
    expect(parseAdnWatchPath('/video/1311-tougen-anki')).toBeNull();
    expect(parseAdnWatchPath('/catalog')).toBeNull();
  });
});

describe('parseAdnEpisodeLabel', () => {
  it('lit le nom JSON-LD avec préfixe de série', () => {
    expect(parseAdnEpisodeLabel('TOUGEN ANKI - Épisode 1 : Sang d’Oni')).toEqual({ number: 1, title: 'Sang d’Oni' });
  });

  it('lit le sous-titre du lecteur', () => {
    expect(parseAdnEpisodeLabel('Épisode 12 : Le retour')).toEqual({ number: 12, title: 'Le retour' });
  });

  it('gère un numéro décimal et un épisode sans titre', () => {
    expect(parseAdnEpisodeLabel('Épisode 12,5')).toEqual({ number: 12.5, title: null });
  });

  it('ne confond pas un tiret dans le titre de la série', () => {
    expect(parseAdnEpisodeLabel('Re:Zero - Starting Life - Épisode 3 : Titre')).toEqual({ number: 3, title: 'Titre' });
  });

  it('conserve le libellé tel quel sans numéro (film, OAV)', () => {
    expect(parseAdnEpisodeLabel('TOUGEN ANKI - Film')).toEqual({ number: null, title: 'TOUGEN ANKI - Film' });
  });
});

describe('meaningfulSeasonTitle', () => {
  it('écarte les libellés génériques', () => {
    expect(meaningfulSeasonTitle('Saison 1')).toBeNull();
    expect(meaningfulSeasonTitle('Staffel 2')).toBeNull();
  });

  it('garde un vrai nom de saison ou d’arc', () => {
    expect(meaningfulSeasonTitle('Arc du Pays des Wa')).toBe('Arc du Pays des Wa');
  });
});

describe('parseAdnSeriesPath', () => {
  it('reconnaît une page de série (sans segment d’épisode)', () => {
    expect(parseAdnSeriesPath('/video/1311-tougen-anki')).toEqual({ seriesId: '1311', seriesSlug: 'tougen-anki' });
    expect(parseAdnSeriesPath('/de/video/1311-tougen-anki/')).toEqual({ seriesId: '1311', seriesSlug: 'tougen-anki' });
  });

  it('ignore les pages de lecture et le reste du site', () => {
    expect(parseAdnSeriesPath('/video/1311-tougen-anki/29344-episode-1')).toBeNull();
    expect(parseAdnSeriesPath('/video/tougen-anki')).toBeNull();
    expect(parseAdnSeriesPath('/catalog')).toBeNull();
  });
});

describe('adnSeriesTitleFromJsonLd', () => {
  // Fixture supposée (à vérifier sur le site réel)
  const nodes = flattenJsonLd(JSON.parse('[{ "@type": "TVSeries", "name": "TOUGEN ANKI", "url": "https://animationdigitalnetwork.com/video/1311-tougen-anki" }]'));

  it('lit le nom de la série', () => {
    expect(adnSeriesTitleFromJsonLd(nodes, '1311')).toBe('TOUGEN ANKI');
  });

  it('ignore une autre série', () => {
    expect(adnSeriesTitleFromJsonLd(nodes, '999')).toBeNull();
  });
});
