import { describe, expect, it } from 'vitest';
import {
  episodeCountMismatch,
  firstUnfinishedSeason,
  learnableSeriesLink,
  pickKnownSeason,
  pickPartInGroup,
  rememberedSeason,
  seriesMappingPrefix,
  toPageSeasons,
} from './page-media-rules';
import type { CandidateSummary } from '../shared/review.types';
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

describe('saisons découpées en parties', () => {
  const summary = (id: number): CandidateSummary => ({ id, title: `Fiche ${id}`, format: 'TV', episodes: 12, year: 2020, coverUrl: null });

  it('toPageSeasons : position saison · partie, fiches hors saisons à la fin', () => {
    // Ordre d'entrée de la synchro : suggestion d'abord (spécial 99), puis saisons
    const seasons = toPageSeasons([summary(99), summary(3), summary(1), summary(2), summary(4)], [[1, 2], [3, 4]]);
    expect(seasons.map((s) => [s.id, s.slot])).toEqual([
      [1, { season: 1, part: 1, parts: 2 }],
      [2, { season: 1, part: 2, parts: 2 }],
      [3, { season: 2, part: 1, parts: 2 }],
      [4, { season: 2, part: 2, parts: 2 }],
      [99, null],
    ]);
    expect(toPageSeasons([summary(1)], [[1]])[0]?.slot).toEqual({ season: 1, part: 1, parts: 1 });
  });

  it('pickPartInGroup : correspondance mémorisée de la saison, puis première partie non terminée', () => {
    expect(pickPartInGroup([3, 4], { mediaId: 4, exact: true }, [])).toBe(4);
    // Correspondance d'une autre saison : ignorée
    expect(pickPartInGroup([3, 4], { mediaId: 1, exact: true }, ['COMPLETED', 'CURRENT'])).toBe(4);
    expect(pickPartInGroup([3, 4], null, [null])).toBe(3);
    expect(pickPartInGroup([3, 4], null, ['COMPLETED', 'COMPLETED'])).toBe(4);
    // Statuts tronqués (toutes terminées jusque-là) : partie suivante ; aucun statut : première partie
    expect(pickPartInGroup([3, 4, 5], null, ['COMPLETED'])).toBe(4);
    expect(pickPartInGroup([3, 4], null, [])).toBe(3);
    expect(pickPartInGroup([], null, [])).toBeNull();
  });

  it('episodeCountMismatch : tolère épisode 0 et récapitulatifs, ignore les totaux inconnus', () => {
    // Mushoku Tensei saison 2 : 25 épisodes sur Crunchyroll, 12 + 12 sur AniList (épisode 0 à part)
    expect(episodeCountMismatch(25, [12, 12])).toBe(false);
    expect(episodeCountMismatch(25, [11, 12])).toBe(false);
    // Saison comparée à une seule partie, ou à la mauvaise saison : écart hors tolérance
    expect(episodeCountMismatch(25, [12])).toBe(true);
    expect(episodeCountMismatch(14, [11, 12])).toBe(true);
    expect(episodeCountMismatch(14, [null, null])).toBe(false);
    expect(episodeCountMismatch(null, [12])).toBe(false);
    expect(episodeCountMismatch(undefined, [12])).toBe(false);
  });
});

describe('learnableSeriesLink', () => {
  const adn = { platform: 'adn', seriesId: '1311', seriesSlug: 'tougen-anki' } as const;

  it('correspondance certaine : page de la série, forme canonique', () => {
    expect(learnableSeriesLink(adn, 'certain')).toEqual({ platform: 'adn', url: 'https://animationdigitalnetwork.com/video/1311-tougen-anki' });
    expect(learnableSeriesLink({ platform: 'crunchyroll', seriesId: 'GRMG8ZQZR', seriesSlug: 'one-piece' }, 'certain')).toEqual({
      platform: 'crunchyroll',
      url: 'https://www.crunchyroll.com/series/GRMG8ZQZR/one-piece',
    });
  });

  it('correspondance à confirmer ou identifiant inconnu : rien n’est appris', () => {
    expect(learnableSeriesLink(adn, 'uncertain')).toBeNull();
    expect(learnableSeriesLink({ platform: 'crunchyroll', seriesId: null, seriesSlug: 'one-piece' }, 'certain')).toBeNull();
  });
});
