import { describe, expect, it } from 'vitest';
import { setLocale } from '../../i18n';
import { matchCrunchyrollEpisodeLink, matchPlatformLink, resolveTarget, seasonSearchQuery, type EpisodeNumbers, type MediaCandidate } from './matching';

// Saisons découpées en parties (cours) et fiches dédiées à une saison. Textes attendus en français.
setLocale('fr');

function candidate(overrides: Partial<MediaCandidate> & Pick<MediaCandidate, 'id'>): MediaCandidate {
  return { format: 'TV', episodes: 12, startDate: null, titles: [], link: 'id', ...overrides };
}

function episode(overrides: Partial<EpisodeNumbers>): EpisodeNumbers {
  return { animeTitle: 'Anime', seasonTitle: null, seasonNumber: 1, seasonEpisodeNumber: 1, displayedEpisodeNumber: 1, ...overrides };
}

describe('resolveTarget : saisons découpées en parties (cours)', () => {
  // Mushoku Tensei sur AniList : chaque saison Crunchyroll est découpée en deux fiches
  const mushoku = [
    candidate({ id: 1, episodes: 11, startDate: 20210111, titles: ['Mushoku Tensei: Isekai Ittara Honki Dasu', 'Mushoku Tensei: Jobless Reincarnation'] }),
    candidate({ id: 2, episodes: 12, startDate: 20211004, titles: ['Mushoku Tensei: Isekai Ittara Honki Dasu Part 2', 'Mushoku Tensei: Jobless Reincarnation Cour 2'], link: 'relation' }),
    candidate({ id: 3, episodes: 12, startDate: 20230703, titles: ['Mushoku Tensei II: Isekai Ittara Honki Dasu', 'Mushoku Tensei: Jobless Reincarnation Season 2'], link: 'relation' }),
    candidate({ id: 4, episodes: 12, startDate: 20240408, titles: ['Mushoku Tensei II: Isekai Ittara Honki Dasu Part 2', 'Mushoku Tensei: Jobless Reincarnation Season 2 Part 2'], link: 'relation' }),
    candidate({ id: 5, episodes: null, startDate: 20260701, titles: ['Mushoku Tensei III: Isekai Ittara Honki Dasu', 'Mushoku Tensei: Jobless Reincarnation Season 3'], link: 'relation' }),
    candidate({ id: 6, episodes: null, startDate: 20270101, titles: ['Mushoku Tensei III: Isekai Ittara Honki Dasu Part 2', 'Mushoku Tensei: Jobless Reincarnation Season 3 Part 2'], link: 'relation' }),
  ];
  const ep = (seasonNumber: number, n: number): EpisodeNumbers =>
    episode({ animeTitle: 'Mushoku Tensei: Jobless Reincarnation', seasonNumber, seasonEpisodeNumber: n, displayedEpisodeNumber: n });

  it('saison 2 → 1re partie de la saison 2 (et non « Part 2 » de la saison 1)', () => {
    expect(resolveTarget(ep(2, 1), mushoku)).toMatchObject({ ok: true, target: { mediaId: 3, progress: 1, confidence: 'high', reason: 'Saison 2 = partie 1/2 sur AniList' } });
  });

  it('épisode au-delà de la 1re partie : report sur la 2e partie de la même saison, fiable', () => {
    expect(resolveTarget(ep(2, 15), mushoku)).toMatchObject({ ok: true, target: { mediaId: 4, progress: 3, offset: 12, confidence: 'high' } });
    expect(resolveTarget(ep(1, 14), mushoku)).toMatchObject({ ok: true, target: { mediaId: 2, progress: 3, confidence: 'high' } });
  });

  it('saison 3 en cours : 1re partie (nombre d’épisodes inconnu)', () => {
    expect(resolveTarget(ep(3, 4), mushoku)).toMatchObject({ ok: true, target: { mediaId: 5, progress: 4, confidence: 'high' } });
  });

  it('épisode qui déborde du groupe sur la saison suivante : à vérifier', () => {
    expect(resolveTarget(ep(1, 25), mushoku)).toMatchObject({ ok: true, target: { mediaId: 3, progress: 2, confidence: 'low' } });
  });

  it('saison au-delà des groupes détectés : repli sur l’index des fiches, à vérifier', () => {
    expect(resolveTarget(ep(4, 1), mushoku)).toMatchObject({ ok: true, target: { mediaId: 4, progress: 1, confidence: 'low' } });
  });

  it('le titre de saison (étape 3) reste prioritaire', () => {
    const result = resolveTarget(
      episode({
        animeTitle: 'Mushoku Tensei: Jobless Reincarnation',
        seasonTitle: 'Mushoku Tensei: Jobless Reincarnation Season 2 Part 2',
        seasonNumber: 3,
        seasonEpisodeNumber: 2,
        displayedEpisodeNumber: 2,
      }),
      mushoku,
    );
    expect(result).toMatchObject({ ok: true, target: { mediaId: 4, progress: 2, confidence: 'high' } });
  });
});

describe('resolveTarget : fiche dédiée à une saison (ONE PIECE HEROINES)', () => {
  // Page réelle : https://www.crunchyroll.com/watch/GE00380778JAJP, saison 30 « HEROINES » de One Piece, E1
  const heroinesEpisode = episode({ animeTitle: 'One Piece', seasonTitle: 'HEROINES', seasonNumber: 30, seasonEpisodeNumber: 1, displayedEpisodeNumber: 1 });
  const onePiece = candidate({ id: 21, episodes: null, startDate: 19991020, titles: ['ONE PIECE'], link: 'slug' });
  const others = [
    candidate({ id: 459, format: 'MOVIE', episodes: 1, startDate: 20000304, titles: ['ONE PIECE (Movie)'], link: null }),
    candidate({ id: 21831, format: 'SPECIAL', episodes: 1, startDate: 20160716, titles: ['ONE PIECE: Heart of Gold'], link: 'slug' }),
    candidate({ id: 188668, format: 'ONA', episodes: 5, startDate: 20250101, titles: ['Koisuru ONE PIECE'], link: null }),
  ];

  it('fiche AniList liée à la page de l’épisode (spécial) : retenue, fiable', () => {
    const heroines = candidate({ id: 197178, format: 'SPECIAL', episodes: 1, startDate: 20260705, titles: ['ONE PIECE HEROINES', 'ONE PIECE HEROINES episode: NAMI'], link: 'episode' });
    expect(resolveTarget(heroinesEpisode, [onePiece, ...others, heroines])).toMatchObject({
      ok: true,
      target: { mediaId: 197178, progress: 1, confidence: 'high', reason: 'Fiche AniList liée à cet épisode' },
    });
  });

  it('fiche « série + saison » sans lien (TV, ONA ou spécial) : retenue plutôt que l’épisode 1 de One Piece', () => {
    for (const format of ['TV', 'ONA', 'SPECIAL']) {
      const heroines = candidate({ id: 197178, format, episodes: 1, startDate: 20260705, titles: ['ONE PIECE HEROINES'], link: null });
      expect(resolveTarget(heroinesEpisode, [onePiece, ...others, heroines])).toMatchObject({ ok: true, target: { mediaId: 197178, progress: 1, confidence: 'high' } });
    }
  });

  it('fiche liée à la série (parmi les saisons) : étape 3, titre de saison inclus', () => {
    const heroines = candidate({ id: 197178, format: 'TV', episodes: 1, startDate: 20260705, titles: ['ONE PIECE HEROINES'], link: 'relation' });
    expect(resolveTarget(heroinesEpisode, [onePiece, heroines])).toMatchObject({ ok: true, target: { mediaId: 197178, progress: 1, confidence: 'high' } });
  });

  it('fiche introuvable : jamais One Piece en confiance élevée (vérification demandée)', () => {
    const result = resolveTarget(heroinesEpisode, [onePiece, ...others]);
    expect(result.ok && result.target.confidence).toBe('low');
  });

  it('numérotation absolue (E1180) : One Piece, même avec une fiche au titre de la saison', () => {
    const elbaph = candidate({ id: 999, format: 'SPECIAL', episodes: 1, titles: ['ONE PIECE Elbaph'], link: null });
    const result = resolveTarget(
      episode({ animeTitle: 'One Piece', seasonTitle: 'Elbaph', seasonNumber: 24, seasonEpisodeNumber: 25, displayedEpisodeNumber: 1180 }),
      [onePiece, ...others, elbaph],
    );
    expect(result).toMatchObject({ ok: true, target: { mediaId: 21, progress: 1180, numbering: 'displayed', confidence: 'high' } });
  });

  it('un OVA au titre proche ne vole pas une saison de la série', () => {
    const result = resolveTarget(
      episode({ animeTitle: 'Attack on Titan', seasonTitle: 'Attack on Titan Season 2', seasonNumber: 2, seasonEpisodeNumber: 1, displayedEpisodeNumber: 1 }),
      [
        candidate({ id: 10, episodes: 25, startDate: 20130407, titles: ['Attack on Titan'] }),
        candidate({ id: 20, episodes: 12, startDate: 20170401, titles: ['Attack on Titan Season 2'], link: 'relation' }),
        candidate({ id: 30, format: 'OVA', episodes: 1, startDate: 20180101, titles: ['Attack on Titan Season 2 OVA'], link: null }),
      ],
    );
    expect(result).toMatchObject({ ok: true, target: { mediaId: 20 } });
  });

  it('série Crunchyroll à part (spécial publié seul) : fiche au titre exact, à vérifier sans lien', () => {
    const result = resolveTarget(episode({ animeTitle: 'ONE PIECE HEROINES', seasonNumber: 1 }), [
      candidate({ id: 197178, format: 'SPECIAL', episodes: 1, titles: ['ONE PIECE HEROINES'], link: null }),
      ...others,
    ]);
    expect(result).toMatchObject({ ok: true, target: { mediaId: 197178, progress: 1, confidence: 'low' } });
  });
});

describe('seasonSearchQuery / matchCrunchyrollEpisodeLink', () => {
  it('recherche « série + saison » pour un titre de saison distinct', () => {
    expect(seasonSearchQuery('One Piece', 'HEROINES')).toBe('One Piece HEROINES');
    expect(seasonSearchQuery('Attack on Titan', 'Attack on Titan Season 2')).toBe('Attack on Titan Season 2');
    expect(seasonSearchQuery('Frieren', 'Frieren')).toBeNull();
    expect(seasonSearchQuery('Frieren', null)).toBeNull();
  });

  it('reconnaît un lien vers la page de lecture de l’épisode', () => {
    expect(matchCrunchyrollEpisodeLink('https://crunchyroll.com/watch/GE00380778JAJP', 'GE00380778JAJP')).toBe(true);
    expect(matchCrunchyrollEpisodeLink('https://www.crunchyroll.com/fr/watch/ge00380778jajp/one-piece-heroines', 'GE00380778JAJP')).toBe(true);
    expect(matchCrunchyrollEpisodeLink('https://crunchyroll.com/watch/GK9U3MN17', 'GE00380778JAJP')).toBe(false);
    expect(matchCrunchyrollEpisodeLink('https://crunchyroll.com/watch/GE00380778JAJP', null)).toBe(false);
    expect(matchPlatformLink('https://crunchyroll.com/watch/GE00380778JAJP', 'crunchyroll', 'GRMG8ZQZR', 'one-piece', 'GE00380778JAJP')).toBe('episode');
    expect(matchPlatformLink('https://www.crunchyroll.com/one-piece', 'crunchyroll', 'GRMG8ZQZR', 'one-piece', 'GE00380778JAJP')).toBe('slug');
  });
});
