import { describe, expect, it } from 'vitest';
import point10 from './__fixtures__/profile-stats/anilist-point-10.json';
import point10Decimal from './__fixtures__/profile-stats/anilist-point-10-decimal.json';
import point100 from './__fixtures__/profile-stats/anilist-point-100.json';
import point3 from './__fixtures__/profile-stats/anilist-point-3.json';
import point5 from './__fixtures__/profile-stats/anilist-point-5.json';
import { aniListProfileStats, isProfileStats, malProfileStats, meanInFormat, type ProfileStats } from './profile-stats';

/** Entrées de la requête Viewer, telles que les lit getViewer */
const fromFixture = (fixture: { mediaListOptions: { scoreFormat: string }; statistics: { anime: unknown } }): ProfileStats | null =>
  aniListProfileStats(fixture.statistics.anime, fixture.mediaListOptions.scoreFormat);

describe('aniListProfileStats', () => {
  it('AniList POINT_10 (fixture) : statuts, formats, 6 genres, notes 1–10, 5 studios, décennies regroupées', () => {
    const stats = fromFixture(point10);
    expect(stats).not.toBeNull();
    expect(stats?.scoreFormat).toBe('POINT_10');
    expect(stats?.meanScore100).toBe(76.2);
    expect(stats?.rewatched).toBeNull();
    expect(stats?.statuses).toEqual([
      { status: 'COMPLETED', count: 285 },
      { status: 'PLANNING', count: 159 },
      { status: 'DROPPED', count: 45 },
      { status: 'PAUSED', count: 32 },
      { status: 'CURRENT', count: 29 },
    ]);
    expect(stats?.formats[0]).toEqual({ format: 'TV', count: 248 });
    expect(stats?.formats).toHaveLength(6);
    expect(stats?.genres).toHaveLength(6);
    expect(stats?.genres[0]).toEqual({ genre: 'Fantasy', count: 177, meanScore100: 75.87 });
    // Notes triées par valeur croissante
    expect(stats?.scores).toEqual([
      { score: 4, count: 4 },
      { score: 5, count: 19 },
      { score: 6, count: 48 },
      { score: 7, count: 88 },
      { score: 8, count: 118 },
      { score: 9, count: 72 },
      { score: 10, count: 22 },
    ]);
    expect(stats?.studios).toHaveLength(5);
    expect(stats?.studios[0]).toEqual({ name: 'A-1 Pictures', count: 19 });
    // 30 années de sortie regroupées par décennie (somme = 392 animes)
    expect(stats?.decades).toEqual([
      { decade: 1980, count: 3 },
      { decade: 1990, count: 5 },
      { decade: 2000, count: 11 },
      { decade: 2010, count: 107 },
      { decade: 2020, count: 266 },
    ]);
  });

  it('POINT_10_DECIMAL : 65 → 6,5', () => {
    const stats = fromFixture(point10Decimal);
    expect(stats?.scoreFormat).toBe('POINT_10_DECIMAL');
    expect(stats?.scores[0]).toEqual({ score: 3, count: 2 });
    expect(stats?.scores).toContainEqual({ score: 7.5, count: 5 });
    expect(stats?.scores.at(-1)).toEqual({ score: 10, count: 16 });
    expect(aniListProfileStats({ scores: [{ score: 65, count: 4 }] }, 'POINT_10_DECIMAL')?.scores).toEqual([{ score: 6.5, count: 4 }]);
  });

  it('POINT_3 : notes 1–3, moyenne sur 100', () => {
    const stats = fromFixture(point3);
    expect(stats?.scoreFormat).toBe('POINT_3');
    expect(stats?.meanScore100).toBe(83.83);
    expect(stats?.scores).toEqual([
      { score: 1, count: 2 },
      { score: 2, count: 1 },
      { score: 3, count: 104 },
    ]);
  });

  it('POINT_5 : notes 1–5 et POINT_100 : notes sur 100, gardées telles que reçues', () => {
    expect(fromFixture(point5)?.scores.map((s) => s.score)).toEqual([1, 2, 3, 4, 5]);
    const hundred = fromFixture(point100);
    expect(hundred?.scoreFormat).toBe('POINT_100');
    expect(hundred?.scores.map((s) => s.score).slice(0, 3)).toEqual([30, 40, 45]);
    expect(hundred?.scores.at(-1)).toEqual({ score: 100, count: 15 });
  });

  it('bloc illisible vide, les autres gardés ; raw non objet → null', () => {
    const stats = aniListProfileStats(
      { meanScore: 0, statuses: [{ status: 'CURRENT', count: 3 }, { status: 'INCONNU', count: 1 }, { status: 'DROPPED', count: -1 }], formats: 'x', genres: [{ genre: 'Drama', count: 2, meanScore: 0 }, { genre: 4, count: 1 }], scores: null, studios: [{ studio: null, count: 1 }, { studio: { name: 'Bones' }, count: 2 }], releaseYears: [{ releaseYear: null, count: 1 }, { releaseYear: 2011, count: 2 }] },
      'POINT_10',
    );
    expect(stats).toEqual({
      scoreFormat: 'POINT_10',
      meanScore100: null,
      statuses: [{ status: 'CURRENT', count: 3 }],
      formats: [],
      genres: [{ genre: 'Drama', count: 2, meanScore100: null }],
      scores: [],
      studios: [{ name: 'Bones', count: 2 }],
      decades: [{ decade: 2010, count: 2 }],
      rewatched: null,
    });
    expect(aniListProfileStats(null, 'POINT_10')).toBeNull();
    expect(aniListProfileStats('x', 'POINT_10')).toBeNull();
    expect(malProfileStats(undefined)).toBeNull();
    // Format de note illisible : notes ignorées (sens inconnu), le reste gardé
    const unknownFormat = aniListProfileStats({ count: 1, scores: [{ score: 8, count: 1 }], statuses: [{ status: 'COMPLETED', count: 1 }] }, 'POINT_7');
    expect(unknownFormat?.scores).toEqual([]);
    expect(unknownFormat?.statuses).toHaveLength(1);
  });
});

describe('malProfileStats', () => {
  it('MAL anime_statistics : statuts, revisionnages, moyenne × 10 ; formats, genres, notes, studios, décennies vides', () => {
    const stats = malProfileStats({
      num_items_watching: 4,
      num_items_completed: 120,
      num_items_on_hold: 0,
      num_items_dropped: 7,
      num_items_plan_to_watch: 30,
      num_times_rewatched: 9,
      mean_score: 7.64,
      num_items: 161,
    });
    expect(stats).toEqual({
      scoreFormat: 'POINT_10',
      meanScore100: 76.4,
      statuses: [
        { status: 'CURRENT', count: 4 },
        { status: 'COMPLETED', count: 120 },
        { status: 'DROPPED', count: 7 },
        { status: 'PLANNING', count: 30 },
      ],
      formats: [],
      genres: [],
      scores: [],
      studios: [],
      decades: [],
      rewatched: 9,
    });
    expect(malProfileStats({ mean_score: 0 })?.meanScore100).toBeNull();
    expect(malProfileStats({ num_times_rewatched: 'x' })?.rewatched).toBeNull();
  });
});

describe('meanInFormat', () => {
  it('meanInFormat pour les cinq formats', () => {
    expect(meanInFormat(76.2, 'POINT_100')).toEqual({ value: 76, max: 100 });
    expect(meanInFormat(76.2, 'POINT_10')).toEqual({ value: 7.6, max: 10 });
    expect(meanInFormat(83.59, 'POINT_10_DECIMAL')).toEqual({ value: 8.4, max: 10 });
    expect(meanInFormat(79.94, 'POINT_5')).toEqual({ value: 4, max: 5 });
    expect(meanInFormat(83.83, 'POINT_3')).toEqual({ value: 8.4, max: 10 });
  });
});

describe('isProfileStats', () => {
  const valid = malProfileStats({ num_items_completed: 2, mean_score: 8 });

  it('isProfileStats refuse les compteurs négatifs ou non entiers', () => {
    expect(isProfileStats(valid)).toBe(true);
    expect(isProfileStats(fromFixture(point10))).toBe(true);
    expect(isProfileStats(null)).toBe(false);
    expect(isProfileStats({ ...valid, statuses: [{ status: 'COMPLETED', count: -1 }] })).toBe(false);
    expect(isProfileStats({ ...valid, statuses: [{ status: 'COMPLETED', count: 1.5 }] })).toBe(false);
    expect(isProfileStats({ ...valid, statuses: [{ status: 'AUTRE', count: 1 }] })).toBe(false);
    expect(isProfileStats({ ...valid, genres: [{ genre: 'Drama', count: 1.2, meanScore100: null }] })).toBe(false);
    expect(isProfileStats({ ...valid, scoreFormat: 'POINT_7' })).toBe(false);
    expect(isProfileStats({ ...valid, rewatched: -2 })).toBe(false);
    expect(isProfileStats({ ...valid, decades: [{ decade: 1990, count: -1 }] })).toBe(false);
    expect(isProfileStats({ ...valid, studios: undefined })).toBe(false);
  });
});
