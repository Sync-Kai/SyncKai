// Statistiques du profil AniList / MyAnimeList (menu du compte de la barre d'état), lues avec le profil (même requête,
// même cache) : nombre d'animes de la liste, épisodes vus, jours de visionnage. Fonctions pures (testées).
import { isRecord } from './guards';

export interface AccountStats {
  /** Animes de la liste, « À voir » exclu : définition d'AniList (`statistics.anime.count`), reprise pour MAL */
  animeCount: number;
  /** Épisodes vus, comptés par le service */
  episodes: number;
  /** Temps de visionnage en jours (décimal), arrondi à l'affichage */
  days: number;
}

const isCount = (value: unknown): value is number => typeof value === 'number' && Number.isInteger(value) && value >= 0;
const isAmount = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0;

export function isAccountStats(value: unknown): value is AccountStats {
  return isRecord(value) && isCount(value.animeCount) && isCount(value.episodes) && isAmount(value.days);
}

const MINUTES_PER_DAY = 24 * 60;

/**
 * `Viewer.statistics.anime` d'AniList. `count` exclut les entrées « À voir » (PLANNING) : mesuré le 2026-10-17 sur un
 * profil public (statuts 215 + 67 PLANNING + 23 + 17 + 3, count 258). null si illisible
 */
export function aniListStats(raw: unknown): AccountStats | null {
  if (!isRecord(raw) || !isCount(raw.count) || !isCount(raw.episodesWatched) || !isAmount(raw.minutesWatched)) return null;
  return { animeCount: raw.count, episodes: raw.episodesWatched, days: raw.minutesWatched / MINUTES_PER_DAY };
}

/**
 * `anime_statistics` de MyAnimeList (GET /users/@me?fields=anime_statistics, champs de la documentation de l'API v2) :
 * `num_items` compte aussi « À voir », retiré pour suivre la définition d'AniList ; `num_days` = en cours + terminés +
 * en pause + abandonnés (sans « À voir »). null si illisible
 */
export function malStats(raw: unknown): AccountStats | null {
  if (!isRecord(raw) || !isCount(raw.num_items) || !isCount(raw.num_episodes) || !isAmount(raw.num_days)) return null;
  const planned = raw.num_items_plan_to_watch;
  if (planned !== undefined && !isCount(planned)) return null;
  return { animeCount: Math.max(0, raw.num_items - (planned ?? 0)), episodes: raw.num_episodes, days: raw.num_days };
}
