import type { AniListMedia } from '../../api/media';

// Recherche AniList « Attack on Titan » (20 résultats, relevée le 2026-10-11 sur https://graphql.anilist.co), réduite aux
// champs lus par la résolution : format, épisodes, date de début, titres (romaji, anglais, quelques synonymes), liens vers
// les plateformes prises en charge, relations SEQUEL / PREQUEL. Ordre de pertinence de la recherche conservé.
// La recherche complémentaire « Attack on Titan: Last Attack » (saison Crunchyroll du film THE LAST ATTACK) ne renvoie
// rien : AniList n'a pas de fiche pour ce film de montage (aucun résultat non plus pour « THE LAST ATTACK »,
// « Shingeki no Kyojin Movie », ni aucune fiche « Shingeki no Kyojin » sortie après 2024).

type Relation = AniListMedia['relations'][number];

const rel = (relationType: 'SEQUEL' | 'PREQUEL', id: number, format: string): Relation => ({ relationType, id, type: 'ANIME', format });

function entry(id: number, format: string, episodes: number, [year, month, day]: [number, number, number], titles: string[], externalLinkUrls: string[], relations: Relation[]): AniListMedia {
  return { id, idMal: null, format, episodes, startDate: { year, month, day }, displayTitle: titles[0] ?? '', titles, year, coverUrl: null, externalLinkUrls, relations };
}

/** Page de série Crunchyroll de la franchise (GR751KNZY, slug « attack-on-titan ») */
export const AOT_SERIES = { seriesId: 'GR751KNZY', seriesSlug: 'attack-on-titan', animeTitle: 'Attack on Titan' } as const;

/** Libellé du menu des saisons Crunchyroll (relevé le 2026-10-11) : une saison, un seul épisode « Attack on Titan: The Last Attack » (2 h 24) */
export const LAST_ATTACK_SEASON = 'Attack on Titan: Last Attack';

/** Saisons série liées à la page (ancien slug ou identifiant), dans l'ordre de diffusion */
export const AOT_SEASON_IDS = [16498, 20958, 99147, 104578, 110277, 131681] as const;
export const FINAL_SEASON_PART_2 = 131681;
/** Spéciaux « THE FINAL CHAPTERS » (liés à leur page de lecture Crunchyroll), dont le film THE LAST ATTACK est le montage */
export const FINAL_CHAPTERS_SPECIALS = [146984, 162314] as const;

export const ATTACK_ON_TITAN_SEARCH: AniListMedia[] = [
  entry(16498, 'TV', 25, [2013, 4, 7], ['Shingeki no Kyojin', 'Attack on Titan', 'SnK', 'AoT', 'Ataque a los Titanes'], ['http://www.crunchyroll.com/attack-on-titan'], [rel('SEQUEL', 20958, 'TV'), rel('PREQUEL', 20811, 'OVA')]),
  entry(110277, 'TV', 16, [2020, 12, 7], ['Shingeki no Kyojin: The Final Season', 'Attack on Titan Final Season', 'SnK 4', 'AoT 4', 'Shingeki no Kyojin 4'], ['https://www.crunchyroll.com/attack-on-titan', 'https://www.netflix.com/title/70299043', 'https://www.crunchyroll.com/attack-on-titan-dubs'], [rel('PREQUEL', 104578, 'TV'), rel('SEQUEL', 131681, 'TV')]),
  entry(20958, 'TV', 12, [2017, 4, 1], ['Shingeki no Kyojin Season 2', 'Attack on Titan Season 2', 'SnK 2', 'AoT 2'], ['http://www.crunchyroll.com/attack-on-titan', 'https://www.netflix.com/title/70299043', 'https://www.crunchyroll.com/attack-on-titan-dubs'], [rel('PREQUEL', 16498, 'TV'), rel('SEQUEL', 99147, 'TV')]),
  entry(99147, 'TV', 12, [2018, 7, 23], ['Shingeki no Kyojin Season 3', 'Attack on Titan Season 3', 'SnK 3', 'AoT 3'], ['http://www.crunchyroll.com/attack-on-titan', 'https://www.netflix.com/title/70299043', 'https://www.crunchyroll.com/attack-on-titan-dubs'], [rel('PREQUEL', 20958, 'TV'), rel('SEQUEL', 104578, 'TV')]),
  entry(18397, 'OVA', 3, [2013, 12, 9], ['Shingeki no Kyojin OVA', 'Attack on Titan OVA', 'Attack on Titan: A Sudden Visitor'], ['https://www.crunchyroll.com/attack-on-titan', 'https://www.crunchyroll.com/attack-on-titan-dubs'], []),
  entry(20811, 'OVA', 2, [2014, 12, 9], ['Shingeki no Kyojin Gaiden: Kuinaki Sentaku', 'Attack on Titan: No Regrets', 'SnK', 'AoT'], ['https://www.crunchyroll.com/attack-on-titan', 'https://www.crunchyroll.com/attack-on-titan-dubs'], [rel('SEQUEL', 16498, 'TV')]),
  entry(119113, 'MOVIE', 1, [2020, 7, 17], ['Shingeki no Kyojin: Chronicle', 'Attack on Titan ~Chronicle~'], ['https://www.crunchyroll.com/attack-on-titan-movies'], []),
  entry(19391, 'SPECIAL', 9, [2013, 7, 17], ['Shingeki no Kyojin: Chimi Kyara Gekijou - Tondeke! Kunren Heidan', 'Attack on Titan Picture Drama'], [], []),
  entry(99634, 'OVA', 3, [2017, 12, 8], ['Shingeki no Kyojin: LOST GIRLS', 'Attack on Titan: Lost Girls', 'Episode 16.5A: Wall Sina. Goodbye', 'Episode 16.5B: Wall Sina. Goodbye', 'SnK'], ['https://www.crunchyroll.com/attack-on-titan'], []),
  entry(21281, 'TV', 12, [2015, 10, 4], ['Shingeki! Kyojin Chuugakkou', 'Attack on Titan: Junior High', 'Ataque a los Titanes: Junior High'], ['https://www.crunchyroll.com/attack-on-titan-junior-high'], []),
  entry(100465, 'MOVIE', 1, [2018, 1, 13], ['Shingeki no Kyojin Season 2: Kakusei no Houkou', 'Attack on Titan: The Roar of Awakening', 'AoT', 'SnK', 'Attack on Titan: O Rugido do Despertar'], [], [rel('PREQUEL', 20692, 'MOVIE')]),
  entry(139754, 'SPECIAL', 2, [2021, 7, 7], ['Shingeki no Kyojin: Chimi Kyara Gekijou - Final', 'Attack On Titan: The Final Season Specials', 'Shingeki no Kyojin: The Final Season Specials'], [], [rel('PREQUEL', 120257, 'SPECIAL')]),
  entry(131681, 'TV', 12, [2022, 1, 10], ['Shingeki no Kyojin: The Final Season Part 2', 'Attack on Titan Final Season Part 2', 'SnK 4', 'AoT 4', 'Shingeki no Kyojin: The Final Season (2022)'], ['https://crunchyroll.com/series/GR751KNZY', 'https://www.netflix.com/title/70299043'], [rel('PREQUEL', 110277, 'TV'), rel('SEQUEL', 146984, 'SPECIAL')]),
  entry(20692, 'MOVIE', 1, [2015, 6, 27], ['Shingeki no Kyojin Kouhen: Jiyuu no Tsubasa', 'Attack on Titan Part II: Wings of Freedom', 'Attack on Titan: Asas da Liberdade'], [], [rel('PREQUEL', 20691, 'MOVIE'), rel('SEQUEL', 100465, 'MOVIE')]),
  entry(108942, 'SPECIAL', 4, [2018, 10, 17], ['Shingeki no Kyojin: Chimi Kyara Gekijou - Rivai-han', 'Attack on Titan Season 3 Picture Drama', 'Shingeki no Kyojin Chimi Kyara Gekijou Tonde Ke! Shinsei Levi-han', 'Shingeki no Kyojin Season 3 Specials'], [], [rel('SEQUEL', 120257, 'SPECIAL')]),
  entry(162314, 'SPECIAL', 1, [2023, 11, 5], ['Shingeki no Kyojin: The Final Season - Kanketsu-hen Kouhen', 'Attack on Titan Final Season THE FINAL CHAPTERS Special 2', 'Shingeki no Kyojin: The Final Season Final Edition', 'Attack on Titan Final Season Part 3 Final Arc Part 2', 'Attack on Titan: The Final Season Part 4'], ['https://www.crunchyroll.com/watch/GWDU8ED5Q/attack-on-titan-final-season-the-final-chapters-special-2'], [rel('PREQUEL', 146984, 'SPECIAL')]),
  entry(104578, 'TV', 10, [2019, 4, 29], ['Shingeki no Kyojin Season 3 Part 2', 'Attack on Titan Season 3 Part 2', 'SnK 3', 'AoT 3', 'Shingeki no Kyojin Season 3 (2019)'], ['https://www.crunchyroll.com/attack-on-titan', 'https://www.netflix.com/title/70299043', 'https://www.crunchyroll.com/attack-on-titan-dubs'], [rel('PREQUEL', 99147, 'TV'), rel('SEQUEL', 110277, 'TV')]),
  entry(120257, 'SPECIAL', 3, [2019, 7, 24], ['Shingeki no Kyojin: Chimi Kyara Gekijou - Rivai-han Part 2', 'Attack on Titan Season 3 Picture Drama', 'Shingeki no Kyojin Chimi Kyara Gekijou Tonde Ke! Shinsei Levi-han Part 2', 'Shingeki no Kyojin Season 3 Part 2 Specials'], [], [rel('PREQUEL', 108942, 'SPECIAL'), rel('SEQUEL', 139754, 'SPECIAL')]),
  entry(146984, 'SPECIAL', 1, [2023, 3, 4], ['Shingeki no Kyojin: The Final Season - Kanketsu-hen Zenpen', 'Attack on Titan Final Season THE FINAL CHAPTERS Special 1', 'Shingeki no Kyojin: The Final Season Final Edition', 'Shingeki no Kyojin: The Final Season Part 3', 'Attack on Titan Final Season Part 3 Final Arc Part 1'], ['https://www.crunchyroll.com/watch/G8WUNMMMW/attack-on-titan-final-season-the-final-chapters-special-1'], [rel('PREQUEL', 131681, 'TV'), rel('SEQUEL', 162314, 'SPECIAL')]),
  entry(20691, 'MOVIE', 1, [2014, 11, 22], ['Shingeki no Kyojin Zenpen: Guren no Yumiya', 'Attack on Titan Part I: Crimson Bow and Arrow', 'Attack on Titan Teil I: Feuerroter Pfeil und Bogen', 'Attack on Titan: O Arco e Flecha Escarlate'], [], [rel('SEQUEL', 20692, 'MOVIE')]),
];

/**
 * Fiche FICTIVE (absente d'AniList le 2026-10-11) : film THE LAST ATTACK tel qu'AniList le publierait (titre romaji
 * supposé, titre anglais officiel), sans lien Crunchyroll, identifiant inventé. Sert à vérifier qu'une saison nommée
 * désignant une fiche dédiée la retient.
 */
export const LAST_ATTACK_MOVIE_ID = 900_001;
export const LAST_ATTACK_MOVIE: AniListMedia = entry(
  LAST_ATTACK_MOVIE_ID,
  'MOVIE',
  1,
  [2024, 11, 8],
  ['Shingeki no Kyojin Movie: Kanketsu-hen - THE LAST ATTACK', 'Attack on Titan: THE LAST ATTACK'],
  [],
  [],
);
