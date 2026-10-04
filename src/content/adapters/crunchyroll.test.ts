import { describe, expect, it } from 'vitest';
import { crunchyrollAdapter, parseCrunchyrollSeasonLabel, parseCrunchyrollSeriesPath, seriesTitleFromJsonLd } from './crunchyroll';
import { flattenJsonLd } from './parsing';

// Fixture JSON-LD d'une page de série (structure supposée, à vérifier sur le site réel)
const SERIES_JSON_LD = `{
  "@context": "https://schema.org",
  "@graph": [
    { "@type": "Organization", "name": "Crunchyroll" },
    { "@type": "TVSeries", "name": "Black Clover", "url": "https://www.crunchyroll.com/fr/series/GRVN8MNQY/black-clover",
      "containsSeason": [{ "@type": "TVSeason", "name": "Black Clover", "seasonNumber": 1 }] }
  ]
}`;

describe('parseCrunchyrollSeriesPath', () => {
  it('reconnaît une page de série, avec ou sans préfixe de langue ni slug', () => {
    expect(parseCrunchyrollSeriesPath('/series/GRVN8MNQY/black-clover')).toEqual({ seriesId: 'GRVN8MNQY', seriesSlug: 'black-clover' });
    expect(parseCrunchyrollSeriesPath('/fr/series/GRVN8MNQY/black-clover/')).toEqual({ seriesId: 'GRVN8MNQY', seriesSlug: 'black-clover' });
    expect(parseCrunchyrollSeriesPath('/pt-br/series/GRVN8MNQY')).toEqual({ seriesId: 'GRVN8MNQY', seriesSlug: null });
  });

  it('ignore les pages de lecture et le reste du site', () => {
    expect(parseCrunchyrollSeriesPath('/fr/watch/GE00376431JAJP/titre')).toBeNull();
    expect(parseCrunchyrollSeriesPath('/fr/series/GRVN8MNQY/black-clover/videos/extra')).toBeNull();
    expect(parseCrunchyrollSeriesPath('/fr/simulcasts')).toBeNull();
  });

  it('l’adapter distingue page de série et page d’épisode', () => {
    expect(crunchyrollAdapter.getEpisodeId(new URL('https://www.crunchyroll.com/fr/series/GRVN8MNQY/black-clover'))).toBeNull();
  });
});

describe('parseCrunchyrollSeasonLabel', () => {
  it('lit le libellé du sélecteur de saison', () => {
    expect(parseCrunchyrollSeasonLabel('S2: Black Clover')).toEqual({ number: 2, title: 'Black Clover' });
    expect(parseCrunchyrollSeasonLabel('S24 : Elbaph (VF)')).toEqual({ number: 24, title: 'Elbaph' });
    expect(parseCrunchyrollSeasonLabel('S1: Frieren (English Dub)')).toEqual({ number: 1, title: 'Frieren' });
  });

  it('accepte les libellés génériques', () => {
    expect(parseCrunchyrollSeasonLabel('Saison 3')).toEqual({ number: 3, title: null });
    expect(parseCrunchyrollSeasonLabel('Staffel 2')).toEqual({ number: 2, title: null });
  });

  it('lit le libellé répété du sélecteur réel ("Season 1Season 1")', () => {
    expect(parseCrunchyrollSeasonLabel('Season 1Season 1')).toEqual({ number: 1, title: null });
    expect(parseCrunchyrollSeasonLabel('Season 12Season 12')).toEqual({ number: 12, title: null });
  });

  it('rejette un texte qui n’est pas un libellé de saison', () => {
    expect(parseCrunchyrollSeasonLabel('Black Clover')).toBeNull();
    expect(parseCrunchyrollSeasonLabel('Sous-titres')).toBeNull();
    expect(parseCrunchyrollSeasonLabel(null)).toBeNull();
  });
});

describe('seriesTitleFromJsonLd', () => {
  const nodes = flattenJsonLd(JSON.parse(SERIES_JSON_LD));

  it('lit le nom de la série (TVSeries)', () => {
    expect(seriesTitleFromJsonLd(nodes, 'GRVN8MNQY')).toBe('Black Clover');
  });

  it('retire le « Watch » du nom réel (page TOUGEN ANKI, 2026-10-05)', () => {
    const real = flattenJsonLd({
      '@type': 'TVSeries',
      '@id': 'https://www.crunchyroll.com/series/GP5HJ84D2/tougen-anki',
      url: 'https://www.crunchyroll.com/series/GP5HJ84D2/tougen-anki',
      name: 'Watch TOUGEN ANKI',
    });
    expect(seriesTitleFromJsonLd(real, 'GP5HJ84D2')).toBe('TOUGEN ANKI');
  });

  it('ignore le JSON-LD d’une autre série (navigation SPA)', () => {
    expect(seriesTitleFromJsonLd(nodes, 'GRMG8ZQZR')).toBeNull();
  });

  it('accepte un nœud sans URL', () => {
    expect(seriesTitleFromJsonLd([{ '@type': 'TVSeries', name: 'Frieren' }], 'ANY')).toBe('Frieren');
  });
});
