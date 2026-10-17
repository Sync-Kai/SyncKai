import { describe, expect, it } from 'vitest';
import { aniListStats, isAccountStats, malStats } from './account-stats';

describe('statistiques du profil (menu du compte)', () => {
  it('AniList : count (hors « À voir », mesuré le 2026-10-17), episodesWatched, minutesWatched / 1440', () => {
    // Profil public réel : statuts 215 + 67 (PLANNING) + 23 + 17 + 3 = 325, count = 258 = 325 − 67
    expect(aniListStats({ count: 258, episodesWatched: 3152, minutesWatched: 78350 })).toEqual({ animeCount: 258, episodes: 3152, days: 78350 / 1440 });
  });

  it('MAL : num_items moins num_items_plan_to_watch (comme AniList), num_episodes, num_days', () => {
    // Exemple de la documentation de l'API v2 (GET /users/@me?fields=anime_statistics)
    const raw = {
      num_items_watching: 2,
      num_items_completed: 1,
      num_items_on_hold: 0,
      num_items_dropped: 0,
      num_items_plan_to_watch: 997,
      num_items: 1000,
      num_days_watched: 0.09,
      num_days: 0.09,
      num_episodes: 8,
      mean_score: 7.9,
    };
    expect(malStats(raw)).toEqual({ animeCount: 3, episodes: 8, days: 0.09 });
    // Sans num_items_plan_to_watch : num_items tel quel
    expect(malStats({ num_items: 12, num_episodes: 40, num_days: 0.5 })).toEqual({ animeCount: 12, episodes: 40, days: 0.5 });
  });

  it('réponse illisible : null (les tuiles sont masquées, le reste du menu reste)', () => {
    for (const raw of [undefined, null, 'x', {}, { count: '3', episodesWatched: 1, minutesWatched: 1 }, { count: -1, episodesWatched: 1, minutesWatched: 1 }, { count: 1.5, episodesWatched: 1, minutesWatched: 1 }, { count: 1, episodesWatched: 1, minutesWatched: Number.NaN }]) {
      expect(aniListStats(raw)).toBeNull();
    }
    for (const raw of [undefined, null, {}, { num_items: 3, num_episodes: 2 }, { num_items: 3, num_episodes: 2, num_days: -1 }, { num_items: 3, num_items_plan_to_watch: 'x', num_episodes: 2, num_days: 1 }]) {
      expect(malStats(raw)).toBeNull();
    }
    // Plus de « À voir » que d'éléments (réponse incohérente) : jamais négatif
    expect(malStats({ num_items: 2, num_items_plan_to_watch: 5, num_episodes: 0, num_days: 0 })).toEqual({ animeCount: 0, episodes: 0, days: 0 });
  });

  it('garde : nombres finis, positifs, compteurs entiers', () => {
    expect(isAccountStats({ animeCount: 3, episodes: 8, days: 0.09 })).toBe(true);
    expect(isAccountStats({ animeCount: 3, episodes: 8 })).toBe(false);
    expect(isAccountStats({ animeCount: 3.2, episodes: 8, days: 1 })).toBe(false);
    expect(isAccountStats({ animeCount: 3, episodes: 8, days: Number.POSITIVE_INFINITY })).toBe(false);
    expect(isAccountStats(null)).toBe(false);
  });
});
