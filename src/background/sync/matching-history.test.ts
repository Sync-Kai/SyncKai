import { describe, expect, it } from 'vitest';
import { setLocale } from '../../i18n';
import {
  effectiveSeasonNumber,
  isSpecialSeason,
  matchCrunchyrollLink,
  resolveTarget,
  seasonNumberFromTitle,
  seasonPool,
  titleSeasonOf,
  type EpisodeNumbers,
  type MediaCandidate,
} from './matching';

// Cas réels de l'import de l'historique Crunchyroll (test du 2026-10-08, fiches AniList relevées le même jour).
setLocale('fr');

function candidate(overrides: Partial<MediaCandidate> & Pick<MediaCandidate, 'id'>): MediaCandidate {
  return { format: 'TV', episodes: 12, startDate: null, titles: [], link: 'slug', ...overrides };
}

function episode(overrides: Partial<EpisodeNumbers>): EpisodeNumbers {
  return { animeTitle: 'Anime', seasonTitle: null, seasonNumber: 1, seasonEpisodeNumber: 1, displayedEpisodeNumber: 1, ...overrides };
}

describe('One Piece : saisons Crunchyroll en numérotation absolue', () => {
  it('ancien lien AniList http://www.crunchyroll.com/one-piece reconnu grâce au slug de l’historique', () => {
    expect(matchCrunchyrollLink('http://www.crunchyroll.com/one-piece', 'GRMG8ZQZR', 'one-piece')).toBe('slug');
    expect(matchCrunchyrollLink('http://www.crunchyroll.com/one-piece', 'GRMG8ZQZR', null)).toBeNull();
  });

  const onePiece = (link: MediaCandidate['link']): MediaCandidate[] => [
    candidate({ id: 21, episodes: null, startDate: 19991020, titles: ['ONE PIECE'], link }),
    candidate({ id: 459, format: 'MOVIE', episodes: 1, startDate: 20000304, titles: ['ONE PIECE (Movie)', 'ONE PIECE: The Movie'], link: null }),
    candidate({ id: 21831, format: 'SPECIAL', episodes: 1, startDate: 20160716, titles: ['ONE PIECE: Heart of Gold'], link }),
  ];

  it('titre seul, fiche unique, numéro absolu qui y tient : sûr quelle que soit la saison (S31 E1180, S3 E143)', () => {
    expect(resolveTarget(episode({ animeTitle: 'One Piece', seasonNumber: 31, seasonTitle: 'Elbaph (1156-current)', displayedEpisodeNumber: 1180, seasonEpisodeNumber: 25 }), onePiece(null))).toMatchObject({
      ok: true,
      target: { mediaId: 21, progress: 1180, numbering: 'displayed', confidence: 'high', reason: 'Seule fiche AniList portant ce titre (numérotation absolue)' },
    });
    expect(resolveTarget(episode({ animeTitle: 'One Piece', seasonNumber: 3, seasonTitle: 'Alabasta (62-143)', displayedEpisodeNumber: 143, seasonEpisodeNumber: 82 }), onePiece(null))).toMatchObject({
      ok: true,
      target: { mediaId: 21, progress: 143, confidence: 'high' },
    });
  });

  it('lien par slug : sûr (S5 Skypiea E206)', () => {
    expect(resolveTarget(episode({ animeTitle: 'One Piece', seasonNumber: 5, seasonTitle: 'Skypiea (136-206)', displayedEpisodeNumber: 206, seasonEpisodeNumber: 71 }), onePiece('slug'))).toMatchObject({
      ok: true,
      target: { mediaId: 21, progress: 206, confidence: 'high' },
    });
  });

  it('numérotation relative sur une fiche unique non liée : toujours à vérifier au-delà de la saison 1', () => {
    expect(resolveTarget(episode({ animeTitle: 'RADIANT', seasonNumber: 2, displayedEpisodeNumber: 5, seasonEpisodeNumber: 5 }), [candidate({ id: 101024, episodes: 21, titles: ['Radiant', 'RADIANT'], link: null })])).toMatchObject({
      ok: true,
      target: { mediaId: 101024, confidence: 'low' },
    });
  });
});

describe('saisons spéciales (OVA, extras, saison 0) : jamais la N-ième saison de la série', () => {
  it('détection : saison 0 ou titre de saison OVA / Extras / Specials / Movie, pas un titre de série qui en contient', () => {
    expect(isSpecialSeason({ animeTitle: 'JUJUTSU KAISEN 0', seasonTitle: null, seasonNumber: 0 })).toBe(true);
    expect(isSpecialSeason({ animeTitle: 'Slime', seasonTitle: 'OVA Season 1', seasonNumber: 5 })).toBe(true);
    expect(isSpecialSeason({ animeTitle: 'Dr. STONE', seasonTitle: 'Extras', seasonNumber: 6 })).toBe(true);
    expect(isSpecialSeason({ animeTitle: 'Moriarty the Patriot', seasonTitle: 'Moriarty the Patriot: OVA Season 1', seasonNumber: 2 })).toBe(true);
    expect(isSpecialSeason({ animeTitle: 'One Piece', seasonTitle: 'Elbaph (1156-current)', seasonNumber: 31 })).toBe(false);
    expect(isSpecialSeason({ animeTitle: 'Pokémon the Movie', seasonTitle: 'Pokémon the Movie', seasonNumber: 1 })).toBe(false);
    expect(isSpecialSeason({ animeTitle: 'Kaiju No. 8', seasonTitle: 'Season 2', seasonNumber: 3 })).toBe(false);
  });

  const slime = [
    candidate({ id: 101280, episodes: 24, startDate: 20181002, titles: ['Tensei Shitara Slime Datta Ken', 'That Time I Got Reincarnated as a Slime'] }),
    candidate({ id: 106509, format: 'OVA', episodes: 5, startDate: 20190703, titles: ['Tensei Shitara Slime Datta Ken OVA', 'That Time I Got Reincarnated as a Slime OAD'] }),
    candidate({ id: 108511, episodes: 12, startDate: 20210112, titles: ['Tensei Shitara Slime Datta Ken 2nd Season', 'That Time I Got Reincarnated as a Slime Season 2'] }),
    candidate({ id: 116742, episodes: 12, startDate: 20210706, titles: ['Tensei Shitara Slime Datta Ken 2nd Season Part 2', 'That Time I Got Reincarnated as a Slime Season 2 Part 2'] }),
    candidate({ id: 161802, format: 'OVA', episodes: 3, startDate: 20231103, titles: ['Tensei Shitara Slime Datta Ken: Coleus no Yume', 'That Time I Got Reincarnated as a Slime: Visions of Coleus'] }),
    candidate({ id: 156822, episodes: 24, startDate: 20240405, titles: ['Tensei Shitara Slime Datta Ken 3rd Season', 'That Time I Got Reincarnated as a Slime Season 3'], link: 'id' }),
    candidate({ id: 182205, episodes: 24, startDate: 20260403, titles: ['Tensei Shitara Slime Datta Ken 4th Season Part 1 & 2', 'That Time I Got Reincarnated as a Slime Season 4'], link: 'id' }),
    candidate({ id: 217331, episodes: null, startDate: 20270701, titles: ['Tensei Shitara Slime Datta Ken 4th Season Part 3'], link: 'relation' }),
  ];
  const slimeTitle = 'That Time I Got Reincarnated as a Slime';

  it('Slime S5 (OVA Season 1) E5 et S6 (OVA Season 2) E3 : deux OVA possibles → fiche à choisir', () => {
    for (const [seasonNumber, seasonTitle, n] of [[5, 'OVA Season 1', 5], [6, 'OVA Season 2', 3]] as const) {
      expect(resolveTarget(episode({ animeTitle: slimeTitle, seasonNumber, seasonTitle, seasonEpisodeNumber: n, displayedEpisodeNumber: n }), slime)).toEqual({
        ok: false,
        reason: 'Épisode spécial / OVA : fiche à choisir',
      });
    }
  });

  it('Dr. STONE S6 (Extras) E1 : fiche à choisir (et non la 6e fiche)', () => {
    const drStone = [
      candidate({ id: 105333, episodes: 24, startDate: 20190705, titles: ['Dr. STONE'] }),
      candidate({ id: 113936, episodes: 11, startDate: 20210114, titles: ['Dr. STONE: STONE WARS'] }),
      candidate({ id: 142876, format: 'SPECIAL', episodes: 1, startDate: 20220710, titles: ['Dr. STONE: Ryuusui', 'Dr. STONE Special Episode – RYUSUI'], link: 'id' }),
      candidate({ id: 131518, episodes: 11, startDate: 20230406, titles: ['Dr. STONE: NEW WORLD'], link: 'id' }),
      candidate({ id: 162670, episodes: 11, startDate: 20231012, titles: ['Dr. STONE: NEW WORLD Part 2'], link: 'id' }),
      candidate({ id: 172019, episodes: 12, startDate: 20250109, titles: ['Dr. STONE: SCIENCE FUTURE'], link: 'id' }),
      candidate({ id: 189117, episodes: 12, startDate: 20250710, titles: ['Dr. STONE: SCIENCE FUTURE Part 2'], link: 'id' }),
    ];
    expect(resolveTarget(episode({ animeTitle: 'Dr. STONE', seasonNumber: 6, seasonTitle: 'Extras' }), drStone)).toEqual({ ok: false, reason: 'Épisode spécial / OVA : fiche à choisir' });
  });

  it('Moriarty S2 (OVA Season 1) E2 : seule OVA « Moriarty the Patriot OVA » → sûre', () => {
    const moriarty = [
      candidate({ id: 114124, episodes: 11, startDate: 20201011, titles: ['Yuukoku no Moriarty', 'Moriarty the Patriot'], link: null }),
      candidate({ id: 138700, format: 'OVA', episodes: 2, startDate: 20220404, titles: ['Yuukoku no Moriarty OVA', 'Moriarty the Patriot OVA'], link: null }),
      candidate({ id: 124858, episodes: 13, startDate: 20210404, titles: ['Yuukoku no Moriarty Part 2', 'Moriarty the Patriot Part 2'], link: null }),
    ];
    expect(
      resolveTarget(episode({ animeTitle: 'Moriarty the Patriot', seasonNumber: 2, seasonTitle: 'Moriarty the Patriot: OVA Season 1', seasonEpisodeNumber: 2, displayedEpisodeNumber: 2 }), moriarty),
    ).toMatchObject({ ok: true, target: { mediaId: 138700, progress: 2, confidence: 'high', reason: 'Seule fiche spéciale (OVA, film) portant ce titre' } });
  });

  it('JUJUTSU KAISEN 0 · S0 E1 et Hakubo · S0 E1 : film unique au titre exact → sûr', () => {
    const jjk = [
      candidate({ id: 131573, format: 'MOVIE', episodes: 1, titles: ['Jujutsu Kaisen 0', 'JUJUTSU KAISEN 0'], link: null }),
      candidate({ id: 113415, episodes: 24, titles: ['Jujutsu Kaisen', 'JUJUTSU KAISEN'], link: null }),
    ];
    expect(resolveTarget(episode({ animeTitle: 'JUJUTSU KAISEN 0', seasonNumber: 0 }), jjk)).toMatchObject({ ok: true, target: { mediaId: 131573, progress: 1, confidence: 'high' } });
    expect(resolveTarget(episode({ animeTitle: 'Hakubo', seasonNumber: 0, seasonTitle: 'Hakubo' }), [candidate({ id: 98784, format: 'MOVIE', episodes: 1, titles: ['Hakubo'], link: null })])).toMatchObject({
      ok: true,
      target: { mediaId: 98784, confidence: 'high' },
    });
  });

  it('récapitulatif sans fiche (THE LEVELING OF SOLO LEVELING) : reste à vérifier', () => {
    const solo = [
      candidate({ id: 151807, episodes: 12, titles: ['Ore dake Level Up na Ken', 'Solo Leveling'], link: null }),
      candidate({ id: 184694, format: 'MOVIE', episodes: 1, titles: ['Ore dake Level Up na Ken: ReAwakening', 'Solo Leveling -ReAwakening-'], link: null }),
    ];
    expect(resolveTarget(episode({ animeTitle: 'THE LEVELING OF SOLO LEVELING', seasonNumber: 1 }), solo)).toMatchObject({ ok: false });
    expect(resolveTarget(episode({ animeTitle: 'THE LEVELING OF SOLO LEVELING', seasonNumber: 0 }), solo)).toMatchObject({ ok: false });
  });
});

describe('numéro de saison écrit dans le titre (Kaiju No. 8 : S3 « Season 2 »)', () => {
  it('lit « Season N », « Saison N », « Nth Season », jamais « Part N »', () => {
    expect(seasonNumberFromTitle('Season 2')).toBe(2);
    expect(seasonNumberFromTitle('Kaiju No. 8 (Saison 2)')).toBe(2);
    expect(seasonNumberFromTitle('Mushoku Tensei: Jobless Reincarnation Season 2 Part 2')).toBe(2);
    expect(seasonNumberFromTitle('2nd Season')).toBe(2);
    expect(seasonNumberFromTitle('JoJo Part 3')).toBeNull();
    expect(seasonNumberFromTitle('Elbaph (1156-current)')).toBeNull();
    expect(effectiveSeasonNumber({ seasonNumber: 3, seasonTitle: 'Season 2' })).toBe(2);
    expect(effectiveSeasonNumber({ seasonNumber: 3, seasonTitle: null })).toBe(3);
  });

  const kaiju = [
    candidate({ id: 153288, episodes: 12, startDate: 20240413, titles: ['Kaijuu 8-gou', 'Kaiju No. 8'], link: 'id' }),
    candidate({ id: 178754, episodes: 11, startDate: 20250719, titles: ['Kaijuu 8-gou 2nd Season', 'Kaiju No. 8 Season 2'], link: 'id' }),
  ];

  it('numérotation absolue E23 (11e de la saison) → 2e fiche, épisode 11', () => {
    expect(resolveTarget(episode({ animeTitle: 'Kaiju No. 8', seasonNumber: 3, seasonTitle: 'Season 2', displayedEpisodeNumber: 23, seasonEpisodeNumber: 11 }), kaiju)).toMatchObject({
      ok: true,
      target: { mediaId: 178754, progress: 11, confidence: 'high' },
    });
  });

  it('sans lien (autre identifiant de série) : « Kaiju No. 8 Season 2 » rejoint les saisons, numérotation absolue concordante → sûr', () => {
    const unlinked = kaiju.map((c) => ({ ...c, link: null }));
    expect(seasonPool(unlinked, 'Kaiju No. 8').map((c) => c.id)).toEqual([153288, 178754]);
    expect(titleSeasonOf(['Kaijuu 8-gou 2nd Season', 'Kaiju No. 8 Season 2'], 'kaiju no 8')).toBe(2);
    expect(resolveTarget(episode({ animeTitle: 'Kaiju No. 8', seasonNumber: 3, seasonTitle: 'Season 2', displayedEpisodeNumber: 23, seasonEpisodeNumber: 11 }), unlinked)).toMatchObject({
      ok: true,
      target: { mediaId: 178754, progress: 11, confidence: 'high', reason: 'Fiche « Saison 2 » de la série, numérotation absolue concordante' },
    });
    // Numérotation relative : bonne fiche proposée, mais à vérifier (titre seul)
    expect(resolveTarget(episode({ animeTitle: 'Kaiju No. 8', seasonNumber: 3, seasonTitle: 'Season 2', displayedEpisodeNumber: 11, seasonEpisodeNumber: 11 }), unlinked)).toMatchObject({
      ok: true,
      target: { mediaId: 178754, progress: 11, confidence: 'low' },
    });
    // Saison 1 (ou sans numéro, ADN) : toujours sûre sur la fiche au titre exact
    expect(resolveTarget(episode({ animeTitle: 'Kaiju No. 8', seasonNumber: 1, seasonEpisodeNumber: 5, displayedEpisodeNumber: 5 }), unlinked)).toMatchObject({ ok: true, target: { mediaId: 153288, confidence: 'high' } });
    expect(resolveTarget(episode({ animeTitle: 'Kaiju No. 8', seasonNumber: null, seasonEpisodeNumber: 5, displayedEpisodeNumber: 5 }), unlinked)).toMatchObject({ ok: true, target: { mediaId: 153288, confidence: 'high' } });
  });

  it('numérotation relative : la saison du titre (2) choisit la fiche, et non season_number (3)', () => {
    expect(resolveTarget(episode({ animeTitle: 'Kaiju No. 8', seasonNumber: 3, seasonTitle: 'Season 2', displayedEpisodeNumber: 11, seasonEpisodeNumber: 11 }), kaiju)).toMatchObject({
      ok: true,
      target: { mediaId: 178754, progress: 11, confidence: 'high' },
    });
  });
});

describe('saisons Crunchyroll découpées en plusieurs fiches AniList', () => {
  const moriarty = [
    candidate({ id: 114124, episodes: 11, startDate: 20201011, titles: ['Yuukoku no Moriarty', 'Moriarty the Patriot'], link: null }),
    candidate({ id: 124858, episodes: 13, startDate: 20210404, titles: ['Yuukoku no Moriarty Part 2', 'Moriarty the Patriot Part 2'], link: null }),
  ];

  it('titre seul : « Part 2 » rejoint la fiche au titre de la série', () => {
    expect(seasonPool(moriarty, 'Moriarty the Patriot').map((c) => c.id)).toEqual([114124, 124858]);
  });

  it('Moriarty S1 (Season 1) E24 : report sur « Part 2 », épisode 13 (titre seul, saison 1 unique : sûr)', () => {
    expect(resolveTarget(episode({ animeTitle: 'Moriarty the Patriot', seasonTitle: 'Season 1', seasonEpisodeNumber: 24, displayedEpisodeNumber: 24 }), moriarty)).toMatchObject({
      ok: true,
      target: { mediaId: 124858, progress: 13, offset: 11, confidence: 'high' },
    });
    // Liées par l'ancien lien crunchyroll.com/moriarty-the-patriot
    const linked = moriarty.map((c) => ({ ...c, link: 'slug' as const }));
    expect(resolveTarget(episode({ animeTitle: 'Moriarty the Patriot', seasonTitle: 'Season 1', seasonEpisodeNumber: 24, displayedEpisodeNumber: 24 }), linked)).toMatchObject({
      ok: true,
      target: { mediaId: 124858, progress: 13, confidence: 'high', reason: 'Saison 1 = partie 2/2 sur AniList' },
    });
  });

  it('My Hero Academia S4 E88 (25e de la saison) : 4e fiche, épisode 25', () => {
    const mha = [
      candidate({ id: 21459, episodes: 13, startDate: 20160403, titles: ['Boku no Hero Academia', 'My Hero Academia'] }),
      candidate({ id: 21856, episodes: 25, startDate: 20170401, titles: ['Boku no Hero Academia 2', 'My Hero Academia Season 2'] }),
      candidate({ id: 100166, episodes: 25, startDate: 20180407, titles: ['Boku no Hero Academia 3', 'My Hero Academia Season 3'] }),
      candidate({ id: 104276, episodes: 25, startDate: 20191012, titles: ['Boku no Hero Academia 4', 'My Hero Academia Season 4'], link: 'relation' }),
      candidate({ id: 117193, episodes: 25, startDate: 20210327, titles: ['Boku no Hero Academia 5', 'My Hero Academia Season 5'], link: 'relation' }),
      candidate({ id: 139630, episodes: 25, startDate: 20221001, titles: ['Boku no Hero Academia 6', 'My Hero Academia Season 6'], link: 'id' }),
    ];
    expect(resolveTarget(episode({ animeTitle: 'My Hero Academia', seasonNumber: 4, displayedEpisodeNumber: 88, seasonEpisodeNumber: 25 }), mha)).toMatchObject({
      ok: true,
      target: { mediaId: 104276, progress: 25, offset: 63, confidence: 'high' },
    });
  });

  it('Attack on Titan S4 (Final Season) E87 : « Final Season Part 2 », épisode 12', () => {
    const aot = [
      candidate({ id: 16498, episodes: 25, startDate: 20130407, titles: ['Shingeki no Kyojin', 'Attack on Titan'] }),
      candidate({ id: 20958, episodes: 12, startDate: 20170401, titles: ['Shingeki no Kyojin Season 2', 'Attack on Titan Season 2'] }),
      candidate({ id: 99147, episodes: 12, startDate: 20180723, titles: ['Shingeki no Kyojin Season 3', 'Attack on Titan Season 3'] }),
      candidate({ id: 104578, episodes: 10, startDate: 20190429, titles: ['Shingeki no Kyojin Season 3 Part 2', 'Attack on Titan Season 3 Part 2'] }),
      candidate({ id: 110277, episodes: 16, startDate: 20201207, titles: ['Shingeki no Kyojin: The Final Season', 'Attack on Titan Final Season'] }),
      candidate({ id: 131681, episodes: 12, startDate: 20220110, titles: ['Shingeki no Kyojin: The Final Season Part 2', 'Attack on Titan Final Season Part 2'], link: 'id' }),
      candidate({ id: 146984, format: 'SPECIAL', episodes: 1, startDate: 20230304, titles: ['Attack on Titan Final Season THE FINAL CHAPTERS Special 1'], link: null }),
    ];
    expect(
      resolveTarget(episode({ animeTitle: 'Attack on Titan', seasonNumber: 4, seasonTitle: 'Attack on Titan Final Season', displayedEpisodeNumber: 87, seasonEpisodeNumber: 28 }), aot),
    ).toMatchObject({ ok: true, target: { mediaId: 131681, progress: 12, confidence: 'high' } });
  });

  it('Mushoku Tensei S1 E24 : au-delà des 23 épisodes de la saison 1 → à vérifier, motif explicite', () => {
    const mushoku = [
      candidate({ id: 108465, episodes: 11, startDate: 20210111, titles: ['Mushoku Tensei: Isekai Ittara Honki Dasu', 'Mushoku Tensei: Jobless Reincarnation'] }),
      candidate({ id: 127720, episodes: 12, startDate: 20211004, titles: ['Mushoku Tensei: Isekai Ittara Honki Dasu Part 2', 'Mushoku Tensei: Jobless Reincarnation Cour 2'] }),
      candidate({ id: 146065, episodes: 13, startDate: 20230703, titles: ['Mushoku Tensei II: Isekai Ittara Honki Dasu', 'Mushoku Tensei: Jobless Reincarnation Season 2'], link: 'id' }),
      candidate({ id: 166873, episodes: 12, startDate: 20240408, titles: ['Mushoku Tensei II: Isekai Ittara Honki Dasu Part 2', 'Mushoku Tensei: Jobless Reincarnation Season 2 Part 2'], link: 'id' }),
    ];
    expect(resolveTarget(episode({ animeTitle: 'Mushoku Tensei: Jobless Reincarnation', seasonEpisodeNumber: 24, displayedEpisodeNumber: 24 }), mushoku)).toMatchObject({
      ok: true,
      target: { confidence: 'low', reason: 'Épisode 24 au-delà des 23 épisodes de la saison 1 sur AniList' },
    });
  });
});

describe('2e passage (2026-10-08) : position dans la saison non reconnue (numéro affiché = position)', () => {
  // Liens réels : anciens slugs http/https (± www, -dubs), « Part 2 » liée seulement par /series/GR751KNZY
  // (autre identifiant que celui de l'historique) → rattachée par relation.
  const aot = [
    candidate({ id: 16498, episodes: 25, startDate: 20130407, titles: ['Shingeki no Kyojin', 'Attack on Titan'] }),
    candidate({ id: 20958, episodes: 12, startDate: 20170401, titles: ['Shingeki no Kyojin Season 2', 'Attack on Titan Season 2'] }),
    candidate({ id: 99147, episodes: 12, startDate: 20180723, titles: ['Shingeki no Kyojin Season 3', 'Attack on Titan Season 3'] }),
    candidate({ id: 104578, episodes: 10, startDate: 20190429, titles: ['Shingeki no Kyojin Season 3 Part 2', 'Attack on Titan Season 3 Part 2'] }),
    candidate({ id: 110277, episodes: 16, startDate: 20201207, titles: ['Shingeki no Kyojin: The Final Season', 'Attack on Titan Final Season'] }),
    candidate({ id: 131681, episodes: 12, startDate: 20220110, titles: ['Shingeki no Kyojin: The Final Season Part 2', 'Attack on Titan Final Season Part 2'], link: 'relation' }),
    candidate({ id: 146984, format: 'SPECIAL', episodes: 1, startDate: 20230304, titles: ['Shingeki no Kyojin: The Final Season - Kanketsu-hen Zenpen'], link: 'relation' }),
    candidate({ id: 18397, format: 'OVA', episodes: 3, startDate: 20131209, titles: ['Shingeki no Kyojin OVA', 'Attack on Titan OVA'] }),
  ];

  it('liens réels : ancien slug (http, https, sans www, -dubs) reconnu, identifiant d’une autre série ignoré', () => {
    expect(matchCrunchyrollLink('https://www.crunchyroll.com/attack-on-titan', 'GOTHER', 'attack-on-titan')).toBe('slug');
    expect(matchCrunchyrollLink('https://crunchyroll.com/attack-on-titan', 'GOTHER', 'attack-on-titan')).toBe('slug');
    expect(matchCrunchyrollLink('http://www.crunchyroll.com/my-hero-academia', 'GOTHER', 'my-hero-academia')).toBe('slug');
    expect(matchCrunchyrollLink('https://www.crunchyroll.com/attack-on-titan-dubs', 'GOTHER', 'attack-on-titan')).toBeNull();
    expect(matchCrunchyrollLink('https://crunchyroll.com/series/GR751KNZY', 'GOTHER', 'attack-on-titan')).toBeNull();
    expect(matchCrunchyrollLink('https://www.crunchyroll.com/series/GG5H5XQ7D/kaiju-no-8', 'GG5H5XQ7D', 'kaiju-no-8')).toBe('id');
  });

  it('Attack on Titan S4 (Final Season) E87 vu comme position 87 : cumul → « Final Season Part 2 » ép. 12 (dans la saison 4)', () => {
    expect(
      resolveTarget(episode({ animeTitle: 'Attack on Titan', seasonNumber: 4, seasonTitle: 'Attack on Titan Final Season', displayedEpisodeNumber: 87, seasonEpisodeNumber: 87 }), aot),
    ).toMatchObject({ ok: true, target: { mediaId: 131681, progress: 12, numbering: 'displayed', offset: 75, confidence: 'high' } });
  });

  it('Kaiju No. 8 S3 (Season 2) E23 vu comme position 23 : cumul → Season 2 ép. 11 (lié par id, ou titre seul)', () => {
    const kaiju = [
      candidate({ id: 153288, episodes: 12, startDate: 20240413, titles: ['Kaijuu 8-gou', 'Kaiju No. 8'], link: 'id' }),
      candidate({ id: 178754, episodes: 11, startDate: 20250719, titles: ['Kaijuu 8-gou 2nd Season', 'Kaiju No. 8 Season 2'], link: 'id' }),
      candidate({ id: 186300, format: 'ONA', episodes: 31, startDate: 20241206, titles: ['minute! kaiju no. 8'], link: null }),
    ];
    const ep = episode({ animeTitle: 'Kaiju No. 8', seasonNumber: 3, seasonTitle: 'Season 2', displayedEpisodeNumber: 23, seasonEpisodeNumber: 23 });
    expect(resolveTarget(ep, kaiju)).toMatchObject({ ok: true, target: { mediaId: 178754, progress: 11, confidence: 'high' } });
    expect(resolveTarget(ep, kaiju.map((c) => ({ ...c, link: null })))).toMatchObject({ ok: true, target: { mediaId: 178754, progress: 11, confidence: 'high' } });
  });

  const mha = [
    candidate({ id: 21459, episodes: 13, startDate: 20160403, titles: ['Boku no Hero Academia', 'My Hero Academia'] }),
    candidate({ id: 21856, episodes: 25, startDate: 20170401, titles: ['Boku no Hero Academia 2', 'My Hero Academia Season 2'] }),
    candidate({ id: 100166, episodes: 25, startDate: 20180407, titles: ['Boku no Hero Academia 3', 'My Hero Academia Season 3'] }),
    candidate({ id: 104276, episodes: 25, startDate: 20191012, titles: ['Boku no Hero Academia 4', 'My Hero Academia Season 4'] }),
    candidate({ id: 117193, episodes: 25, startDate: 20210327, titles: ['Boku no Hero Academia 5', 'My Hero Academia Season 5'] }),
    candidate({ id: 149073, format: 'ONA', episodes: 2, startDate: 20220801, titles: ['Boku no Hero Academia 5 (ONA)', 'My Hero Academia Season 5 OVA'] }),
    candidate({ id: 139630, episodes: 25, startDate: 20221001, titles: ['Boku no Hero Academia 6', 'My Hero Academia Season 6'], link: 'relation' }),
    candidate({ id: 163139, episodes: 21, startDate: 20240504, titles: ['Boku no Hero Academia 7', 'My Hero Academia Season 7'], link: 'relation' }),
  ];

  it('My Hero Academia S4 (Season 4) E88 vu comme position 88 : cumul → BnHA 4 ép. 25', () => {
    expect(resolveTarget(episode({ animeTitle: 'My Hero Academia', seasonNumber: 4, seasonTitle: 'Season 4', displayedEpisodeNumber: 88, seasonEpisodeNumber: 88 }), mha)).toMatchObject({
      ok: true,
      target: { mediaId: 104276, progress: 25, confidence: 'high' },
    });
  });

  it('ONA « Season 5 OVA » hors des saisons : la saison 6 reste la 6e fiche (E114 → BnHA 6 ép. 1)', () => {
    expect(seasonPool(mha, 'My Hero Academia').map((c) => c.id)).not.toContain(149073);
    expect(resolveTarget(episode({ animeTitle: 'My Hero Academia', seasonNumber: 6, displayedEpisodeNumber: 114, seasonEpisodeNumber: 1 }), mha)).toMatchObject({
      ok: true,
      target: { mediaId: 139630, progress: 1, confidence: 'high' },
    });
  });

  it('cumul qui tombe hors de la saison N : rien d’inventé (Mushoku S1 E24 reste à vérifier)', () => {
    const mushoku = [
      candidate({ id: 108465, episodes: 11, startDate: 20210111, titles: ['Mushoku Tensei: Jobless Reincarnation'] }),
      candidate({ id: 127720, episodes: 12, startDate: 20211004, titles: ['Mushoku Tensei: Jobless Reincarnation Cour 2'] }),
      candidate({ id: 146065, episodes: 13, startDate: 20230703, titles: ['Mushoku Tensei: Jobless Reincarnation Season 2'] }),
    ];
    expect(resolveTarget(episode({ animeTitle: 'Mushoku Tensei: Jobless Reincarnation', seasonNumber: 1, displayedEpisodeNumber: 24, seasonEpisodeNumber: 24 }), mushoku)).toMatchObject({
      ok: true,
      target: { confidence: 'low' },
    });
  });
});
