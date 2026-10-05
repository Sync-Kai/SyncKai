import { describe, expect, it } from 'vitest';
import { groupSeasons, stripCourMarker } from './season-groups';

const entry = (id: number, ...titles: string[]): { id: number; titles: string[] } => ({ id, titles });
const ids = (groups: { id: number }[][]): number[][] => groups.map((g) => g.map((e) => e.id));

/** Fiches AniList de Mushoku Tensei, ordre de diffusion (titres romaji / anglais / natif) */
const MUSHOKU = [
  entry(1, 'Mushoku Tensei: Isekai Ittara Honki Dasu', 'Mushoku Tensei: Jobless Reincarnation', '無職転生 ～異世界行ったら本気だす～'),
  entry(2, 'Mushoku Tensei: Isekai Ittara Honki Dasu Part 2', 'Mushoku Tensei: Jobless Reincarnation Cour 2', '無職転生 ～異世界行ったら本気だす～ 第2クール'),
  entry(3, 'Mushoku Tensei II: Isekai Ittara Honki Dasu', 'Mushoku Tensei: Jobless Reincarnation Season 2', '無職転生Ⅱ ～異世界行ったら本気だす～'),
  entry(4, 'Mushoku Tensei II: Isekai Ittara Honki Dasu Part 2', 'Mushoku Tensei: Jobless Reincarnation Season 2 Part 2', '無職転生Ⅱ ～異世界行ったら本気だす～ 第2クール'),
  entry(5, 'Mushoku Tensei III: Isekai Ittara Honki Dasu', 'Mushoku Tensei: Jobless Reincarnation Season 3'),
  entry(6, 'Mushoku Tensei III: Isekai Ittara Honki Dasu Part 2', 'Mushoku Tensei: Jobless Reincarnation Season 3 Part 2'),
];

describe('stripCourMarker', () => {
  it('retire les marqueurs de partie usuels', () => {
    expect(stripCourMarker('Mushoku Tensei II: Isekai Ittara Honki Dasu Part 2')).toEqual({ base: 'mushoku tensei ii isekai ittara honki dasu', part: 2 });
    expect(stripCourMarker('SPY x FAMILY Cour 2')).toEqual({ base: 'spy x family', part: 2 });
    expect(stripCourMarker('Vinland Saga 2nd Cour')).toEqual({ base: 'vinland saga', part: 2 });
    expect(stripCourMarker('Dr. Stone: New World (Part 2)')).toEqual({ base: 'dr stone new world', part: 2 });
    expect(stripCourMarker('Kaguya - Part II')).toEqual({ base: 'kaguya', part: 2 });
    expect(stripCourMarker('Mushoku Tensei: Jobless Reincarnation Season 2 Part 2')).toEqual({ base: 'mushoku tensei jobless reincarnation season 2', part: 2 });
    expect(stripCourMarker('Re:Zero kara Hajimeru Isekai Seikatsu 2nd Season Part 2')).toEqual({ base: 're zero kara hajimeru isekai seikatsu 2nd season', part: 2 });
    // Titre natif : la normalisation ne garde que l'ASCII, base vide → non exploitable (les titres romaji/anglais suffisent)
    expect(stripCourMarker('無職転生 ～異世界行ったら本気だす～ 第2クール')).toBeNull();
    expect(stripCourMarker('Show 第2クール')).toEqual({ base: 'show', part: 2 });
  });

  it('ignore les suites sans marqueur de partie', () => {
    expect(stripCourMarker('Mushoku Tensei II: Isekai Ittara Honki Dasu')).toBeNull();
    expect(stripCourMarker('Attack on Titan Season 2')).toBeNull();
    expect(stripCourMarker('Re:Zero 2nd Season')).toBeNull();
    expect(stripCourMarker('Shingeki no Kyojin: The Final Season')).toBeNull();
    expect(stripCourMarker('JoJo no Kimyou na Bouken Part 3: Stardust Crusaders')).toBeNull();
    expect(stripCourMarker('Counterpart')).toBeNull();
  });
});

describe('groupSeasons', () => {
  it('Mushoku Tensei : 6 fiches → 3 saisons de 2 parties', () => {
    expect(ids(groupSeasons(MUSHOKU))).toEqual([[1, 2], [3, 4], [5, 6]]);
  });

  it('fiche unique (One Piece) : une saison', () => {
    expect(ids(groupSeasons([entry(21, 'ONE PIECE')]))).toEqual([[21]]);
  });

  it('saisons sans parties (Frieren) : une saison par fiche', () => {
    expect(ids(groupSeasons([entry(1, 'Sousou no Frieren', 'Frieren: Beyond Journey’s End'), entry(2, 'Sousou no Frieren 2nd Season', 'Frieren: Beyond Journey’s End Season 2')]))).toEqual([[1], [2]]);
  });

  it('Spy x Family : S1 + « Part 2 » / « Cour 2 », puis Season 2', () => {
    const pool = [
      entry(1, 'SPY×FAMILY', 'SPY x FAMILY'),
      entry(2, 'SPY×FAMILY Part 2', 'SPY x FAMILY Cour 2'),
      entry(3, 'SPY×FAMILY Season 2', 'SPY x FAMILY Season 2'),
    ];
    expect(ids(groupSeasons(pool))).toEqual([[1, 2], [3]]);
  });

  it('Attack on Titan : Final Season + Part 2 réunies ; « The Final Chapters » (titre distinct) reste à part', () => {
    const pool = [
      entry(1, 'Shingeki no Kyojin', 'Attack on Titan'),
      entry(2, 'Shingeki no Kyojin Season 2', 'Attack on Titan Season 2'),
      entry(3, 'Shingeki no Kyojin Season 3', 'Attack on Titan Season 3'),
      entry(4, 'Shingeki no Kyojin Season 3 Part 2', 'Attack on Titan Season 3 Part 2'),
      entry(5, 'Shingeki no Kyojin: The Final Season', 'Attack on Titan Final Season'),
      entry(6, 'Shingeki no Kyojin: The Final Season Part 2', 'Attack on Titan Final Season Part 2'),
      entry(7, 'Shingeki no Kyojin: The Final Season - Kanketsu-hen', 'Attack on Titan: The Final Season - The Final Chapters'),
    ];
    expect(ids(groupSeasons(pool))).toEqual([[1], [2], [3, 4], [5, 6], [7]]);
  });

  it('Re:Zero : « 2nd Season » et « 2nd Season Part 2 » forment la saison 2', () => {
    const pool = [
      entry(1, 'Re:Zero kara Hajimeru Isekai Seikatsu'),
      entry(2, 'Re:Zero kara Hajimeru Isekai Seikatsu 2nd Season'),
      entry(3, 'Re:Zero kara Hajimeru Isekai Seikatsu 2nd Season Part 2'),
      entry(4, 'Re:Zero kara Hajimeru Isekai Seikatsu 3rd Season'),
    ];
    expect(ids(groupSeasons(pool))).toEqual([[1], [2, 3], [4]]);
  });

  it('prudent : remakes au même titre ou « Part 1 » isolée ne sont pas rattachés', () => {
    expect(ids(groupSeasons([entry(1, 'Fruits Basket'), entry(2, 'Fruits Basket (2019)', 'Fruits Basket')]))).toEqual([[1], [2]]);
    expect(ids(groupSeasons([entry(1, 'Kingdom'), entry(2, 'Kingdom Part 1')]))).toEqual([[1], [2]]);
    // Partie d'une autre série (titre de base différent)
    expect(ids(groupSeasons([entry(1, 'Vinland Saga'), entry(2, 'Other Show Part 2')]))).toEqual([[1], [2]]);
  });

  it('« Part 1 » / « Part 2 » explicites : réunies', () => {
    expect(ids(groupSeasons([entry(1, 'Dr. Stone: New World'), entry(2, 'Dr. Stone: New World Part 2')]))).toEqual([[1, 2]]);
    expect(ids(groupSeasons([entry(1, 'Show Part 1'), entry(2, 'Show Part 2')]))).toEqual([[1, 2]]);
  });
});
