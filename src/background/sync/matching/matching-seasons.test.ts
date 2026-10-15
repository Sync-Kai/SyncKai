import { describe, expect, it } from 'vitest';
import { setLocale } from '../../../i18n';
import type { MediaMapping } from '../../../shared/sync.types';
import {
  cachedTitleVerdict,
  carriesSeasonTitle,
  isUnmatchedNamedSeason,
  matchCrunchyrollEpisodeLink,
  matchPlatformLink,
  resolveTarget,
  seasonSearchQuery,
  type EpisodeNumbers,
  type MediaCandidate,
} from './matching';

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

describe('isUnmatchedNamedSeason (page de série sur une saison nommée)', () => {
  const onePiece = { titles: ['ONE PIECE', 'One Piece'] };
  const named = (seasonTitle: string | null, more: { seasonNumber?: number | null; seasonFirstEpisode?: number } = {}): Parameters<typeof isUnmatchedNamedSeason>[0] => ({
    animeTitle: 'One Piece',
    seasonTitle,
    seasonNumber: more.seasonNumber ?? null,
    ...(more.seasonFirstEpisode !== undefined ? { seasonFirstEpisode: more.seasonFirstEpisode } : {}),
  });

  it('« HEROINES » sur la fiche ONE PIECE : rien ne la désigne, à vérifier ; sur ONE PIECE HEROINES : titre repris', () => {
    expect(isUnmatchedNamedSeason(named('HEROINES'), onePiece)).toBe(true);
    expect(isUnmatchedNamedSeason(named('HEROINES'), { titles: ['ONE PIECE HEROINES'] })).toBe(false);
  });

  it('titre repris à l’article « the » près : « Attack on Titan: Last Attack » ↔ « Attack on Titan: THE LAST ATTACK »', () => {
    const lastAttack = { animeTitle: 'Attack on Titan', seasonTitle: 'Attack on Titan: Last Attack', seasonNumber: null };
    expect(isUnmatchedNamedSeason(lastAttack, { titles: ['Attack on Titan: THE LAST ATTACK'] })).toBe(false);
    expect(isUnmatchedNamedSeason(lastAttack, { titles: ['Shingeki no Kyojin: The Final Season Part 2', 'Attack on Titan Final Season Part 2'] })).toBe(true);
  });

  it('saison numérotée, arc à plage d’épisodes, spéciale, au titre de la série ou absente : non concernée', () => {
    expect(isUnmatchedNamedSeason(named('Elbaph', { seasonFirstEpisode: 1156 }), onePiece)).toBe(false);
    expect(isUnmatchedNamedSeason(named('Elbaph', { seasonNumber: 24 }), onePiece)).toBe(false);
    expect(isUnmatchedNamedSeason(named('Special'), onePiece)).toBe(false);
    expect(isUnmatchedNamedSeason(named('One Piece Season 2'), onePiece)).toBe(false);
    expect(isUnmatchedNamedSeason(named('ONE PIECE'), onePiece)).toBe(false);
    expect(isUnmatchedNamedSeason(named(null), onePiece)).toBe(false);
  });
});

describe('resolveTarget : titre de saison avant numéro (spécial compté comme saison par la plateforme)', () => {
  // Dr. STONE sur Crunchyroll (import du 2026-10-15) : le spécial « RYUSUI » est la saison 3, NEW WORLD (2 parties AniList) la saison 4
  const drStone = [
    candidate({ id: 1, episodes: 24, startDate: 20190705, titles: ['Dr. STONE'] }),
    candidate({ id: 2, episodes: 11, startDate: 20210114, titles: ['Dr. STONE: STONE WARS'] }),
    candidate({ id: 3, format: 'SPECIAL', episodes: 1, startDate: 20220710, titles: ['Dr. STONE: Ryuusui', 'Dr. STONE Special Episode – RYUSUI'] }),
    candidate({ id: 4, episodes: 11, startDate: 20230406, titles: ['Dr. STONE: NEW WORLD', 'Dr.STONE Season 3'] }),
    candidate({ id: 5, episodes: 11, startDate: 20231012, titles: ['Dr. STONE: NEW WORLD Part 2', 'Dr.STONE Season 3 Part 2'] }),
    candidate({ id: 6, episodes: 12, startDate: 20250109, titles: ['Dr. STONE: SCIENCE FUTURE'] }),
    candidate({ id: 7, episodes: 12, startDate: 20250710, titles: ['Dr. STONE: SCIENCE FUTURE Part 2'] }),
    candidate({ id: 8, episodes: 13, startDate: 20260402, titles: ['Dr. STONE: SCIENCE FUTURE Part 3'] }),
  ];
  const ep = (seasonNumber: number, seasonTitle: string | null, n: number): EpisodeNumbers =>
    episode({ animeTitle: 'Dr. STONE', seasonTitle, seasonNumber, seasonEpisodeNumber: n, displayedEpisodeNumber: n });

  it('saison désignée par son titre : placée dans ce groupe, parties suivantes comprises, quel que soit son numéro', () => {
    expect(resolveTarget(ep(4, 'Dr. STONE NEW WORLD', 5), drStone)).toMatchObject({ ok: true, target: { mediaId: 4, progress: 5, confidence: 'high' } });
    expect(resolveTarget(ep(4, 'Dr. STONE NEW WORLD', 22), drStone)).toMatchObject({
      ok: true,
      target: { mediaId: 5, progress: 11, offset: 11, confidence: 'high', reason: 'Saison identifiée par son titre (« Dr. STONE NEW WORLD »)' },
    });
    expect(resolveTarget(ep(5, 'Dr. STONE SCIENCE FUTURE', 13), drStone)).toMatchObject({ ok: true, target: { mediaId: 7, progress: 1, confidence: 'high' } });
  });

  it('épisode au-delà du groupe désigné par le titre : le numéro ne tranche pas, à vérifier', () => {
    const result = resolveTarget(ep(4, 'Dr. STONE NEW WORLD', 23), drStone);
    expect(result.ok && result.target.confidence).toBe('low');
  });

  it('numérotation absolue répartie sur une fiche titrée d’une AUTRE saison (1re saison absente du cumul) : à vérifier', () => {
    // Slime (2026-10-15) : saison 1 manquante, « Saison 3 » E72 (24e de la saison) tombait sur la saison 4, épisode 24
    const slime = [
      candidate({ id: 12, episodes: 12, startDate: 20210112, titles: ['Slime Season 2'] }),
      candidate({ id: 13, episodes: 12, startDate: 20210706, titles: ['Slime Season 2 Part 2'] }),
      candidate({ id: 14, episodes: 24, startDate: 20240405, titles: ['Slime Season 3'] }),
      candidate({ id: 15, episodes: 24, startDate: 20260403, titles: ['Slime Season 4'] }),
    ];
    const s3e72 = episode({ animeTitle: 'Slime', seasonTitle: 'Season 3', seasonNumber: 3, seasonEpisodeNumber: 24, displayedEpisodeNumber: 72 });
    expect(resolveTarget(s3e72, slime)).toMatchObject({ ok: true, target: { mediaId: 15, progress: 24, confidence: 'low' } });
    // Saison 1 présente : cumul complet, fiche de la saison 3, sûre
    const withFirst = [candidate({ id: 11, episodes: 24, startDate: 20181002, titles: ['Slime'] }), ...slime];
    expect(resolveTarget(s3e72, withFirst)).toMatchObject({ ok: true, target: { mediaId: 14, progress: 24, confidence: 'high' } });
  });

  it('numérotation absolue sur une fiche titrée d’une saison PLUS PETITE (spécial compté par la plateforme) : inchangée', () => {
    // Kaiju No. 8 (import du 2026-10-15) : 2e saison rangée en S3 par Crunchyroll, E23 = « Season 2 » E11
    const kaiju = [
      candidate({ id: 1, episodes: 12, startDate: 20240413, titles: ['Kaiju No. 8'] }),
      candidate({ id: 2, episodes: 11, startDate: 20250719, titles: ['Kaiju No. 8 Season 2'] }),
    ];
    const s3e23 = episode({ animeTitle: 'Kaiju No. 8', seasonTitle: 'Kaiju No. 8', seasonNumber: 3, seasonEpisodeNumber: 11, displayedEpisodeNumber: 23 });
    expect(resolveTarget(s3e23, kaiju)).toMatchObject({ ok: true, target: { mediaId: 2, progress: 11, confidence: 'high' } });
  });

  it('placement par le seul rang (titre propre qui ne désigne aucune fiche) : signalé `byRank`', () => {
    expect(resolveTarget(ep(3, 'Dr. STONE NOUVEAU MONDE', 5), drStone)).toMatchObject({ ok: true, target: { mediaId: 4, progress: 5, confidence: 'high', byRank: true } });
  });

  it('pas `byRank` : titre désignant la saison, numéro écrit dans le titre, titre de la série, saison 1', () => {
    const notByRank = (e: EpisodeNumbers): void => {
      const result = resolveTarget(e, drStone);
      expect(result.ok && result.target.byRank).toBeFalsy();
    };
    notByRank(ep(4, 'Dr. STONE NEW WORLD', 5));
    notByRank(ep(4, 'Saison 3', 5));
    notByRank(ep(3, 'Dr. STONE', 5));
    notByRank(ep(3, null, 5));
    notByRank(ep(1, 'Dr. STONE PREMIÈRE PARTIE', 5));
  });

  describe('cachedTitleVerdict : correspondance en cache contre le titre de saison', () => {
    // Import fautif du 2026-10-15 : S4 « Dr. STONE NEW WORLD » → SCIENCE FUTURE Part 2 (7)
    const wrong: MediaMapping = { mediaId: 7, numbering: 'season', offset: 12, episodes: 12 };
    const newWorld = ep(4, 'Dr. STONE NEW WORLD', 22);

    it('fiche hors du groupe désigné : apprise → oubliée, origine inconnue → à vérifier, choisie → gardée', () => {
      expect(cachedTitleVerdict({ ...wrong, learned: true }, newWorld, drStone)).toEqual({ kind: 'drop', signals: [], titleGroup: [4, 5] });
      expect(cachedTitleVerdict(wrong, newWorld, drStone)).toEqual({ kind: 'doubt', signals: [], titleGroup: [4, 5] });
      expect(cachedTitleVerdict({ ...wrong, chosen: true }, newWorld, drStone)).toEqual({ kind: 'keep' });
    });

    it('gardée : fiche du groupe désigné, titre générique ou numéroté, aucun titre, numérotation absolue', () => {
      expect(cachedTitleVerdict({ ...wrong, mediaId: 5, offset: 11 }, newWorld, drStone)).toEqual({ kind: 'keep' });
      for (const title of ['Dr. STONE', 'Saison 4', 'Season 4', null, 'Dr. STONE NOUVEAU MONDE']) {
        expect(cachedTitleVerdict({ ...wrong, learned: true }, ep(4, title, 22), drStone)).toEqual({ kind: 'keep' });
      }
      expect(cachedTitleVerdict({ ...wrong, learned: true, numbering: 'displayed' }, newWorld, drStone)).toEqual({ kind: 'keep' });
    });

    it('la fiche porte le titre de saison : rien à rechercher', () => {
      expect(carriesSeasonTitle(['Dr. STONE: NEW WORLD Part 2'], 'Dr. STONE NEW WORLD')).toBe(true);
      expect(carriesSeasonTitle(['Dr. STONE: SCIENCE FUTURE Part 2'], 'Dr. STONE NEW WORLD')).toBe(false);
    });
  });
});
