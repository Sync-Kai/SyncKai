import { describe, expect, it } from 'vitest';
import { isEpisodeWatched, reduceWatchEvents, type WatchEvent } from './history-source';

// Règle « épisode vu » et réducteur par saison communs aux historiques Crunchyroll, ADN et Netflix (audit 6-D1, 6-D2) ;
// verdict identique des trois plateformes : content/crunchyroll/history.test.ts.

const RULE = { completionPercentage: 85 };

const event = (overrides: Partial<WatchEvent> = {}): WatchEvent => ({
  seasonKey: 'S:s1',
  episodeId: 'E1',
  rank: 1,
  position: 1300,
  duration: 1440,
  playedAt: null,
  ...overrides,
});

describe('isEpisodeWatched', () => {
  it('marqué terminé par la plateforme : vu, même sans position ni durée', () => {
    expect(isEpisodeWatched({ fullyWatched: true, position: 0, duration: null }, RULE)).toBe(true);
  });

  it('jamais commencé ou durée et marques inconnues : jamais vu', () => {
    expect(isEpisodeWatched({ position: 0, duration: 1440 }, { completionPercentage: 0 })).toBe(false);
    expect(isEpisodeWatched({ position: 9999, duration: null }, RULE)).toBe(false);
  });

  it('seuil de fin de la durée, sans marque', () => {
    expect(isEpisodeWatched({ position: 1224, duration: 1440 }, RULE)).toBe(true);
    expect(isEpisodeWatched({ position: 1223, duration: 1440 }, RULE)).toBe(false);
  });

  it('marques de fin : la plus petite connue décide (≤ 0 et null ignorées) ; « pourcentage » : la durée décide', () => {
    expect(isEpisodeWatched({ position: 1270, duration: 1440, endMarks: [1283, 1269] }, RULE)).toBe(true);
    expect(isEpisodeWatched({ position: 1262, duration: 1440, endMarks: [1283, 1293] }, RULE)).toBe(false);
    expect(isEpisodeWatched({ position: 1262, duration: 1440, endMarks: [null, 0] }, RULE)).toBe(true);
    expect(isEpisodeWatched({ position: 1262, duration: 1440, endMarks: [1283] }, { ...RULE, completionTrigger: 'percentage' })).toBe(true);
    expect(isEpisodeWatched({ position: 1262, duration: null, endMarks: [1283] }, { ...RULE, completionTrigger: 'percentage' })).toBe(false);
  });
});

describe('reduceWatchEvents', () => {
  it('une ligne par saison : épisode vu de plus grand rang, épisodes vus distincts, dernier visionnage', () => {
    const { seasons, ignored } = reduceWatchEvents(
      [
        event({ episodeId: 'E1', rank: 1, playedAt: 10 }),
        event({ episodeId: 'E3', rank: 3, playedAt: 5 }),
        event({ episodeId: 'E3', rank: 3, playedAt: 30 }),
        event({ episodeId: 'E2', rank: 2, position: 10, playedAt: 50 }),
      ],
      RULE,
    );
    expect(ignored).toBe(1);
    expect(seasons).toEqual([{ best: expect.objectContaining({ episodeId: 'E3', playedAt: 5 }) as unknown, watchedCount: 2, lastPlayedAt: 30 }]);
  });

  it('rang égal : le premier rencontré reste ; saisons triées du visionnage le plus récent au plus ancien, dates inconnues en dernier', () => {
    const { seasons } = reduceWatchEvents(
      [
        event({ seasonKey: 'A', episodeId: 'A1', rank: 4, playedAt: null }),
        event({ seasonKey: 'B', episodeId: 'B1', rank: 1, playedAt: 20 }),
        event({ seasonKey: 'A', episodeId: 'A2', rank: 4, playedAt: null }),
        event({ seasonKey: 'C', episodeId: 'C1', rank: 1, playedAt: 40 }),
      ],
      RULE,
    );
    expect(seasons.map((s) => s.best.episodeId)).toEqual(['C1', 'B1', 'A1']);
    expect(seasons[2]?.watchedCount).toBe(2);
  });

  it('aucun épisode vu : aucune saison', () => {
    expect(reduceWatchEvents([event({ position: 1 })], RULE)).toEqual({ seasons: [], ignored: 1 });
  });
});
