// Popup › Activité : textes et règles pures (sans rendu) des synchros en attente et des dernières synchros.
import { t, tp } from '../../i18n';
import type { EpisodeInfo } from '../../shared/episode.types';
import { matchesExclusion } from '../../shared/exclusions';
import { exclusionKey } from '../../platforms/series-identity';
import type { SyncQueueItem } from '../../shared/queue.types';
import type { RecentSync } from '../../shared/review.types';
import { TRACKER_LABELS } from '../../shared/tracker.types';
import type { ExclusionsState } from '../../ui/state';
import { PLATFORM_LABELS } from '../../ui/kit';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** Délai avant la prochaine tentative : « dans 5 min », « dans 2 h »… */
export function formatUntil(timestamp: number, now: number): string {
  const diff = timestamp - now;
  if (diff < MINUTE) return t('queue.until.imminent');
  if (diff < HOUR) return t('queue.until.minutes', { count: Math.ceil(diff / MINUTE) });
  if (diff < DAY) return t('queue.until.hours', { count: Math.round(diff / HOUR) });
  return tp('queue.until.days', Math.round(diff / DAY));
}

/** « Dandadan · S1 E4 » (épisode inconnu : le titre seul) */
export function queueTitle({ animeTitle, seasonNumber, seasonEpisodeNumber, displayedEpisodeNumber }: EpisodeInfo): string {
  const number = seasonEpisodeNumber ?? displayedEpisodeNumber;
  const parts = [seasonNumber !== null ? `S${seasonNumber}` : null, number !== null ? `E${number}` : null].filter((p): p is string => p !== null);
  return parts.length > 0 ? `${animeTitle} · ${parts.join(' ')}` : animeTitle;
}

/** « Crunchyroll → AniList · MyAnimeList » : services encore à écrire (tous : null) */
export function queueRoute(item: SyncQueueItem): string {
  const services = item.services === null ? 'AniList · MyAnimeList' : item.services.map((s) => TRACKER_LABELS[s]).join(' · ');
  return `${PLATFORM_LABELS[item.episode.platform]} → ${services}`;
}

/** « Frieren · E6 » : numéro affiché par la plateforme, sinon dans la saison */
export function recentTitle(sync: RecentSync): string {
  const number = sync.episode.displayedEpisodeNumber ?? sync.episode.seasonEpisodeNumber;
  return number !== null ? `${sync.episode.animeTitle} · E${number}` : sync.episode.animeTitle;
}

/** Clé de série plateforme, sans faire échouer le rendu si elle est incalculable */
function seriesKeyOrNull(episode: EpisodeInfo): string | null {
  try {
    return exclusionKey(episode);
  } catch {
    return null;
  }
}

/** Série d'une synchro récente exclue de la synchronisation (pastille « Exclue » à la place du bouton) */
export function isRecentExcluded(sync: RecentSync, exclusions: ExclusionsState): boolean {
  if (exclusions.status !== 'ready' || exclusions.items.length === 0) return false;
  const platformKey = seriesKeyOrNull(sync.episode);
  return exclusions.items.some((e) => matchesExclusion(e, { platformKey, mediaId: sync.mediaId }));
}
