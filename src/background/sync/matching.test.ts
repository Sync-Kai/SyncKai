import { describe, expect, it } from 'vitest';
import {
  applyMapping,
  mappingFromManualChoice,
  mappingKey,
  matchAdnLink,
  matchPlatformLink,
  matchCrunchyrollLink,
  normalizeTitle,
  resolveTarget,
  seasonLabel,
  toSortableDate,
  type EpisodeNumbers,
  type MediaCandidate,
} from './matching';
import { setLocale } from '../../i18n';

// Textes attendus en français
setLocale('fr');

function candidate(overrides: Partial<MediaCandidate> & Pick<MediaCandidate, 'id'>): MediaCandidate {
  return { format: 'TV', episodes: 12, startDate: null, titles: [], link: 'id', ...overrides };
}

function episode(overrides: Partial<EpisodeNumbers>): EpisodeNumbers {
  return {
    animeTitle: 'Anime',
    seasonTitle: null,
    seasonNumber: 1,
    seasonEpisodeNumber: 1,
    displayedEpisodeNumber: 1,
    ...overrides,
  };
}

describe('normalizeTitle', () => {
  it('retire accents, ponctuation et casse', () => {
    expect(normalizeTitle('Shingeki no Kyojin: Season 2')).toBe('shingeki no kyojin season 2');
    expect(normalizeTitle('  Pokémon — Horizons ! ')).toBe('pokemon horizons');
  });
});

describe('toSortableDate', () => {
  it('produit une date triable et place les dates partielles en fin de période', () => {
    expect(toSortableDate({ year: 2013, month: 4, day: 7 })).toBe(20130407);
    expect(toSortableDate({ year: 2013, month: null, day: null })).toBe(20131231);
    expect(toSortableDate(null)).toBeNull();
  });
});

describe('matchCrunchyrollLink', () => {
  it('reconnaît le lien par identifiant de série', () => {
    expect(matchCrunchyrollLink('https://www.crunchyroll.com/series/GRMG8ZQZR/one-piece', 'GRMG8ZQZR', 'one-piece')).toBe('id');
    expect(matchCrunchyrollLink('https://www.crunchyroll.com/fr/series/grmg8zqzr', 'GRMG8ZQZR', null)).toBe('id');
  });

  it('reconnaît l’ancien format par slug', () => {
    expect(matchCrunchyrollLink('https://www.crunchyroll.com/one-piece', 'GRMG8ZQZR', 'one-piece')).toBe('slug');
    expect(matchCrunchyrollLink('http://crunchyroll.com/fr/one-piece/', null, 'one-piece')).toBe('slug');
  });

  it('rejette une autre série, un autre site ou une URL invalide', () => {
    expect(matchCrunchyrollLink('https://www.crunchyroll.com/series/GOTHER/one-piece', 'GRMG8ZQZR', 'one-piece')).toBeNull();
    expect(matchCrunchyrollLink('https://www.netflix.com/one-piece', 'GRMG8ZQZR', 'one-piece')).toBeNull();
    expect(matchCrunchyrollLink('https://evil-crunchyroll.com/one-piece', null, 'one-piece')).toBeNull();
    expect(matchCrunchyrollLink('pas une url', 'GRMG8ZQZR', 'one-piece')).toBeNull();
  });
});

describe('resolveTarget', () => {
  it('One Piece : fiche unique, numéro affiché absolu (E1180 = S24 E25)', () => {
    const result = resolveTarget(
      episode({ animeTitle: 'One Piece', seasonTitle: 'Elbaph', seasonNumber: 24, seasonEpisodeNumber: 25, displayedEpisodeNumber: 1180 }),
      [
        candidate({ id: 21, episodes: null, startDate: 19991020, titles: ['ONE PIECE'] }),
        candidate({ id: 99, format: 'MOVIE', episodes: 1, titles: ['ONE PIECE FILM RED'] }),
      ],
    );
    expect(result).toMatchObject({ ok: true, target: { mediaId: 21, progress: 1180, numbering: 'displayed', offset: 0, confidence: 'high' } });
  });

  it('One Piece : fiche en cours + fiche dérivée liée à la même série (régression)', () => {
    const result = resolveTarget(
      episode({ animeTitle: 'One Piece', seasonTitle: 'Elbaph', seasonNumber: 24, seasonEpisodeNumber: 25, displayedEpisodeNumber: 1180 }),
      [
        candidate({ id: 180000, episodes: 21, startDate: 20240407, titles: ['ONE PIECE Log: Fish-Man Island Saga'] }),
        candidate({ id: 21, episodes: null, startDate: 19991020, titles: ['ONE PIECE'] }),
      ],
    );
    expect(result).toMatchObject({ ok: true, target: { mediaId: 21, progress: 1180, numbering: 'displayed', offset: 0, confidence: 'high' } });
  });

  it('numérotation absolue avec une saison en cours au milieu de la franchise (S3 annoncée)', () => {
    const result = resolveTarget(
      episode({ seasonNumber: 2, seasonEpisodeNumber: 5, displayedEpisodeNumber: 30 }),
      [
        candidate({ id: 1, episodes: 25, startDate: 20200101 }),
        candidate({ id: 2, episodes: null, startDate: 20210101 }),
        candidate({ id: 3, episodes: null, startDate: null }),
      ],
    );
    expect(result).toMatchObject({ ok: true, target: { mediaId: 2, progress: 5, offset: 25, confidence: 'high' } });
  });

  it('saisons séparées, numérotation relative : saison identifiée par son titre', () => {
    const result = resolveTarget(
      episode({ animeTitle: 'Attack on Titan', seasonTitle: 'Attack on Titan Season 2', seasonNumber: 2, seasonEpisodeNumber: 5, displayedEpisodeNumber: 5 }),
      [
        candidate({ id: 20, episodes: 12, startDate: 20170401, titles: ['Shingeki no Kyojin Season 2', 'Attack on Titan Season 2'], link: 'relation' }),
        candidate({ id: 10, episodes: 25, startDate: 20130407, titles: ['Shingeki no Kyojin', 'Attack on Titan'] }),
      ],
    );
    expect(result).toMatchObject({ ok: true, target: { mediaId: 20, progress: 5, numbering: 'season', confidence: 'high' } });
  });

  it('saisons séparées, numérotation relative : saison identifiée par son numéro', () => {
    const result = resolveTarget(
      episode({ seasonTitle: 'Arc inconnu', seasonNumber: 2, seasonEpisodeNumber: 3, displayedEpisodeNumber: 3 }),
      [
        candidate({ id: 1, episodes: 12, startDate: 20200101 }),
        candidate({ id: 2, episodes: 12, startDate: 20210101 }),
      ],
    );
    expect(result).toMatchObject({ ok: true, target: { mediaId: 2, progress: 3, confidence: 'high' } });
  });

  it('numérotation absolue répartie sur plusieurs fiches (E30 → 2e fiche, épisode 5)', () => {
    const result = resolveTarget(
      episode({ seasonNumber: 2, seasonEpisodeNumber: 5, displayedEpisodeNumber: 30 }),
      [
        candidate({ id: 1, episodes: 25, startDate: 20200101 }),
        candidate({ id: 2, episodes: 12, startDate: 20210101 }),
      ],
    );
    expect(result).toMatchObject({ ok: true, target: { mediaId: 2, progress: 5, numbering: 'displayed', offset: 25, confidence: 'high' } });
  });

  it('saison découpée en deux cours sur AniList : report sur la fiche suivante en confiance faible', () => {
    const result = resolveTarget(
      episode({ seasonNumber: 1, seasonEpisodeNumber: 15, displayedEpisodeNumber: 15 }),
      [
        candidate({ id: 1, episodes: 12, startDate: 20200101 }),
        candidate({ id: 2, episodes: 12, startDate: 20200701 }),
      ],
    );
    expect(result).toMatchObject({ ok: true, target: { mediaId: 2, progress: 3, confidence: 'low' } });
  });

  it('saison > 1 mais une seule fiche liée : confiance faible (suite non liée sur AniList)', () => {
    const result = resolveTarget(episode({ seasonNumber: 2, seasonEpisodeNumber: 4, displayedEpisodeNumber: 4 }), [
      candidate({ id: 1, episodes: 12 }),
    ]);
    expect(result).toMatchObject({ ok: true, target: { mediaId: 1, confidence: 'low' } });
  });

  it('sans lien plateforme : titre exact unique en saison 1 → confiance élevée (ex : Fairy Tail sur ADN)', () => {
    const result = resolveTarget(episode({ animeTitle: 'Fairy Tail', seasonNumber: 1, seasonEpisodeNumber: 1, displayedEpisodeNumber: 1 }), [
      candidate({ id: 6702, link: null, episodes: 175, titles: ['FAIRY TAIL', 'Fairy Tail'] }),
      candidate({ id: 20626, link: null, episodes: 102, titles: ['FAIRY TAIL (2014)'] }),
      candidate({ id: 99, link: null, format: 'MOVIE', titles: ['Fairy Tail'] }),
    ]);
    expect(result).toMatchObject({ ok: true, target: { mediaId: 6702, progress: 1, confidence: 'high', reason: expect.stringContaining('Seule fiche') } });
  });

  it('sans lien plateforme : saison > 1 → confiance faible', () => {
    const result = resolveTarget(episode({ animeTitle: 'Frieren', seasonNumber: 2, seasonEpisodeNumber: 3, displayedEpisodeNumber: 3 }), [
      candidate({ id: 1, link: null, titles: ['Sousou no Frieren', 'Frieren'] }),
    ]);
    expect(result).toMatchObject({
      ok: true,
      target: { mediaId: 1, confidence: 'low', reason: expect.stringContaining('titre seul') },
    });
  });

  it('sans lien plateforme : remakes au même titre → confiance faible', () => {
    const result = resolveTarget(episode({ animeTitle: 'Fruits Basket' }), [
      candidate({ id: 120, link: null, episodes: 26, startDate: 20010705, titles: ['Fruits Basket'] }),
      candidate({ id: 105334, link: null, episodes: 25, startDate: 20190406, titles: ['Fruits Basket (2019)', 'Fruits Basket'] }),
    ]);
    expect(result).toMatchObject({ ok: true, target: { confidence: 'low' } });
  });

  it('échoue si aucune fiche ne correspond', () => {
    expect(resolveTarget(episode({ animeTitle: 'Inconnu' }), [candidate({ id: 1, link: null, titles: ['Autre'] })])).toMatchObject({ ok: false });
  });

  it('échoue si l’épisode dépasse la fiche unique', () => {
    expect(resolveTarget(episode({ seasonEpisodeNumber: 13, displayedEpisodeNumber: 13 }), [candidate({ id: 1, episodes: 12 })])).toMatchObject({
      ok: false,
    });
  });

  it('échoue sur un épisode récapitulatif non entier (E12.5)', () => {
    expect(resolveTarget(episode({ seasonEpisodeNumber: 12.5, displayedEpisodeNumber: 12.5 }), [candidate({ id: 1 })])).toMatchObject({ ok: false });
  });
});

describe('applyMapping / mappingKey', () => {
  const onePiece = episode({ seasonNumber: 24, seasonEpisodeNumber: 26, displayedEpisodeNumber: 1181 });

  it('applique le décalage selon la numérotation en cache', () => {
    expect(applyMapping(onePiece, { mediaId: 21, numbering: 'displayed', offset: 0, episodes: null })).toBe(1181);
    expect(applyMapping(onePiece, { mediaId: 2, numbering: 'displayed', offset: 1100, episodes: 100 })).toBe(81);
  });

  it('invalide le cache si la progression sort de la fiche', () => {
    expect(applyMapping(episode({ seasonEpisodeNumber: 13, displayedEpisodeNumber: 13 }), { mediaId: 1, numbering: 'season', offset: 0, episodes: 12 })).toBeNull();
  });

  it('construit une clé stable par série et saison', () => {
    expect(mappingKey({ platform: 'crunchyroll', seriesId: 'GRMG8ZQZR', animeTitle: 'One Piece', seasonNumber: 24 })).toBe('crunchyroll:GRMG8ZQZR:s24');
    expect(mappingKey({ platform: 'crunchyroll', seriesId: null, animeTitle: 'One Piece', seasonNumber: null })).toBe('crunchyroll:title:one piece:s0');
  });
});

describe('mappingFromManualChoice', () => {
  const ep = episode({ seasonNumber: 2, seasonEpisodeNumber: 4, displayedEpisodeNumber: 28 });

  it('numéro dans la saison confirmé : numbering "season" sans décalage', () => {
    expect(mappingFromManualChoice(ep, 7, 4, 12)).toEqual({ mediaId: 7, numbering: 'season', offset: 0, episodes: 12 });
  });

  it('autre numéro confirmé : décalage calculé depuis le numéro affiché', () => {
    const mapping = mappingFromManualChoice(ep, 7, 16, 24);
    expect(mapping).toEqual({ mediaId: 7, numbering: 'displayed', offset: 12, episodes: 24 });
    // L'épisode suivant (E29) donnera 17
    expect(mapping && applyMapping(episode({ seasonEpisodeNumber: 5, displayedEpisodeNumber: 29 }), mapping)).toBe(17);
  });

  it('refuse une progression invalide ou au-delà de la fiche', () => {
    expect(mappingFromManualChoice(ep, 7, 0, 12)).toBeNull();
    expect(mappingFromManualChoice(ep, 7, 13, 12)).toBeNull();
    expect(mappingFromManualChoice(ep, 7, 2.5, 12)).toBeNull();
  });
});

describe('seasonLabel', () => {
  it('ajoute la saison et son titre quand il diffère de l’anime', () => {
    expect(seasonLabel({ animeTitle: 'One Piece', seasonNumber: 24, seasonTitle: 'Elbaph' })).toBe('One Piece · S24 (Elbaph)');
    expect(seasonLabel({ animeTitle: 'Frieren', seasonNumber: 1, seasonTitle: 'Frieren' })).toBe('Frieren · S1');
    expect(seasonLabel({ animeTitle: 'Film', seasonNumber: null, seasonTitle: null })).toBe('Film');
  });
});

describe('matchAdnLink / matchPlatformLink', () => {
  it('reconnaît une fiche liée à la série ADN par identifiant ou slug', () => {
    expect(matchAdnLink('https://animationdigitalnetwork.com/video/1311-tougen-anki', '1311', 'tougen-anki')).toBe('id');
    expect(matchAdnLink('https://animationdigitalnetwork.fr/video/tougen-anki', '1311', 'tougen-anki')).toBe('slug');
  });

  it('rejette un identifiant différent même avec le même slug (autre série ADN)', () => {
    expect(matchAdnLink('https://animationdigitalnetwork.fr/video/999-tougen-anki', '1311', 'tougen-anki')).toBeNull();
  });

  it('rejette une autre série ou un autre site', () => {
    expect(matchAdnLink('https://animationdigitalnetwork.com/video/1400-autre-serie', '1311', 'tougen-anki')).toBeNull();
    expect(matchAdnLink('https://www.crunchyroll.com/series/1311/tougen-anki', '1311', 'tougen-anki')).toBeNull();
    expect(matchAdnLink('https://animationdigitalnetwork.com/catalog', '1311', 'tougen-anki')).toBeNull();
  });

  it('choisit la règle selon la plateforme de l’épisode', () => {
    const adnUrl = 'https://animationdigitalnetwork.com/video/1311-tougen-anki';
    expect(matchPlatformLink(adnUrl, 'adn', '1311', 'tougen-anki')).toBe('id');
    expect(matchPlatformLink(adnUrl, 'crunchyroll', 'GP5HJ84D2', 'tougen-anki')).toBeNull();
  });
});
