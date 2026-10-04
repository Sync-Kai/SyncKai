import { describe, expect, it } from 'vitest';
import { firstUnfinishedSeason, pickKnownSeason, rememberedSeason, seriesMappingPrefix } from './page-media-rules';
import type { MediaMapping } from '../shared/sync.types';

const mapping = (mediaId: number): MediaMapping => ({ mediaId, numbering: 'season', offset: 0, episodes: 12 });

describe('seriesMappingPrefix', () => {
  it('reprend le format des clés de correspondance (toutes saisons)', () => {
    expect(seriesMappingPrefix({ platform: 'crunchyroll', seriesId: 'GRMG8ZQZR', seriesTitle: 'One Piece' })).toBe('crunchyroll:GRMG8ZQZR:');
    expect(seriesMappingPrefix({ platform: 'adn', seriesId: null, seriesTitle: 'Tougen Anki' })).toBe('adn:title:tougen anki:');
  });
});

describe('rememberedSeason', () => {
  const mappings = {
    'crunchyroll:ABC:s1': mapping(10),
    'crunchyroll:ABC:s3': mapping(30),
    'crunchyroll:ABC:s2': mapping(20),
    'crunchyroll:XYZ:s9': mapping(99),
  };

  it('saison de la page connue : correspondance exacte', () => {
    expect(rememberedSeason(mappings, 'crunchyroll:ABC:', 2)).toEqual({ mediaId: 20, exact: true });
  });

  it('saison inconnue : la plus avancée des saisons mémorisées de CETTE série', () => {
    expect(rememberedSeason(mappings, 'crunchyroll:ABC:', null)).toEqual({ mediaId: 30, exact: false });
    expect(rememberedSeason(mappings, 'crunchyroll:ABC:', 7)).toEqual({ mediaId: 30, exact: false });
  });

  it('aucune correspondance pour la série', () => {
    expect(rememberedSeason(mappings, 'adn:1311:', null)).toBeNull();
  });
});

describe('pickKnownSeason', () => {
  const base = { seasonIds: [1, 2, 3], manual: null, pageMatch: null, remembered: null };

  it('le choix manuel prime', () => {
    expect(pickKnownSeason({ ...base, manual: 3, pageMatch: { mediaId: 1, confident: true } })).toEqual({ mediaId: 3, source: 'manual', confidence: 'certain' });
  });

  it('saison lue sur la page (fiable) avant la correspondance mémorisée', () => {
    expect(pickKnownSeason({ ...base, pageMatch: { mediaId: 2, confident: true }, remembered: { mediaId: 3, exact: true } })).toEqual({
      mediaId: 2,
      source: 'page',
      confidence: 'certain',
    });
  });

  it('correspondance exacte avant une saison de page incertaine', () => {
    expect(pickKnownSeason({ ...base, pageMatch: { mediaId: 2, confident: false }, remembered: { mediaId: 3, exact: true } })).toEqual({
      mediaId: 3,
      source: 'remembered',
      confidence: 'certain',
    });
  });

  it('page incertaine puis dernière saison mémorisée : incertaines', () => {
    expect(pickKnownSeason({ ...base, pageMatch: { mediaId: 2, confident: false } })).toEqual({ mediaId: 2, source: 'page', confidence: 'uncertain' });
    expect(pickKnownSeason({ ...base, remembered: { mediaId: 3, exact: false } })).toEqual({ mediaId: 3, source: 'remembered', confidence: 'uncertain' });
  });

  it('saison unique : fiable seulement si la page la désigne', () => {
    expect(pickKnownSeason({ ...base, seasonIds: [5], pageMatch: { mediaId: 5, confident: true } })).toEqual({ mediaId: 5, source: 'single', confidence: 'certain' });
    expect(pickKnownSeason({ ...base, seasonIds: [5] })).toEqual({ mediaId: 5, source: 'single', confidence: 'uncertain' });
  });

  it('plusieurs saisons sans indice : liste à consulter', () => {
    expect(pickKnownSeason(base)).toBeNull();
  });
});

describe('firstUnfinishedSeason', () => {
  const ids = [1, 2, 3];

  it('première saison non terminée (hors liste comprise)', () => {
    expect(firstUnfinishedSeason(ids, ['COMPLETED', 'CURRENT'])).toEqual({ mediaId: 2, source: 'progress', confidence: 'uncertain' });
    expect(firstUnfinishedSeason(ids, ['COMPLETED', null])).toEqual({ mediaId: 2, source: 'progress', confidence: 'uncertain' });
    expect(firstUnfinishedSeason(ids, [null])?.mediaId).toBe(1);
  });

  it('toutes terminées : dernière saison', () => {
    expect(firstUnfinishedSeason(ids, ['COMPLETED', 'COMPLETED', 'COMPLETED'])?.mediaId).toBe(3);
  });

  it('lectures tronquées : saison suivant la dernière terminée lue', () => {
    expect(firstUnfinishedSeason([1, 2, 3, 4], ['COMPLETED', 'COMPLETED'])?.mediaId).toBe(3);
  });

  it('aucun service consulté : première saison ; aucune saison : null', () => {
    expect(firstUnfinishedSeason(ids, [])?.mediaId).toBe(1);
    expect(firstUnfinishedSeason([], [])).toBeNull();
  });
});
