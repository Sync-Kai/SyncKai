import { t } from '../i18n';
import type { AiringSchedule } from '../shared/agenda';
import { isRecord } from '../shared/guards';

// Règles pures des alertes de sortie d'épisodes (testées sans chrome.*).

const HOUR_S = 3600;

/** Rattrapage maximal après une longue période sans vérification (navigateur fermé) */
export const MAX_LOOKBACK_S = 24 * HOUR_S;
/** Fenêtre par défaut au premier passage */
export const FIRST_RUN_LOOKBACK_S = 2 * HOUR_S;
/** Taille maximale de l'ensemble des sorties déjà notifiées */
export const MAX_NOTIFIED = 200;
/** Au-delà, les sorties sont regroupées en une seule notification */
export const GROUP_THRESHOLD = 3;
/** Taille d'un lot d'identifiants par requête (perPage AniList) */
export const MEDIA_CHUNK = 50;

/** Sortie renvoyée par AniList (airingSchedules) */
export type AiringItem = AiringSchedule;

export interface AiringWindow {
  /** UNIX secondes (exclu) */
  from: number;
  /** UNIX secondes (exclu) */
  to: number;
}

/**
 * Fenêtre de recherche : depuis la dernière vérification (2 h au premier passage, 24 h au plus),
 * décalée du délai choisi pour ne notifier qu'une fois le délai écoulé après la diffusion.
 */
export function computeWindow(nowS: number, lastCheckS: number | null, delayHours: number): AiringWindow {
  const delay = delayHours * HOUR_S;
  const start = lastCheckS === null ? nowS - FIRST_RUN_LOOKBACK_S : Math.min(nowS, Math.max(lastCheckS, nowS - MAX_LOOKBACK_S));
  return { from: start - delay, to: nowS - delay };
}

/**
 * Fenêtre interrogée par l'alarme : celle des alertes, élargie à toute la semaine affichée par l'agenda
 * (bornes exclues, comme airingAt_greater / airingAt_lesser). Une seule série de requêtes sert les deux.
 */
export function mergeWeekWindow(alerts: AiringWindow, weekStartS: number, weekEndS: number): AiringWindow {
  return { from: Math.min(alerts.from, weekStartS - 1), to: Math.max(alerts.to, weekEndS) };
}

/** Sorties strictement comprises dans la fenêtre (bornes exclues) */
export function itemsInWindow<T extends { airingAt: number }>(items: readonly T[], range: AiringWindow): T[] {
  return items.filter((item) => item.airingAt > range.from && item.airingAt < range.to);
}

/** Pages AniList lues au plus par lot de séries (50 sorties par page) */
export const MAX_SCHEDULE_PAGES = 3;

/** Nœud `airingSchedules` de la réponse GraphQL */
export interface AiringScheduleNode {
  id: number;
  episode: number;
  airingAt: number;
  media: { id: number; title: { userPreferred: string | null }; coverImage?: { medium: string | null } | null };
}

export interface AiringPageData {
  Page: { pageInfo?: { hasNextPage: boolean | null } | null; airingSchedules: AiringScheduleNode[] };
}

export function isAiringScheduleNode(value: unknown): value is AiringScheduleNode {
  if (!isRecord(value) || typeof value.id !== 'number' || typeof value.episode !== 'number' || typeof value.airingAt !== 'number') return false;
  const media = value.media;
  if (!isRecord(media) || typeof media.id !== 'number' || !isRecord(media.title)) return false;
  const title = media.title.userPreferred;
  const cover = media.coverImage;
  return (
    (title === null || typeof title === 'string') &&
    (cover === null || cover === undefined || (isRecord(cover) && (cover.medium === null || typeof cover.medium === 'string')))
  );
}

export function isAiringPageData(data: unknown): data is AiringPageData {
  if (!isRecord(data) || !isRecord(data.Page)) return false;
  const info = data.Page.pageInfo;
  return (
    (info === null || info === undefined || (isRecord(info) && (info.hasNextPage === null || typeof info.hasNextPage === 'boolean'))) &&
    Array.isArray(data.Page.airingSchedules) &&
    data.Page.airingSchedules.every(isAiringScheduleNode)
  );
}

/** Nœuds AniList → sorties (titre de repli « Anime #id ») */
export function toAiringItems(data: AiringPageData): AiringItem[] {
  return data.Page.airingSchedules.map((node) => ({
    scheduleId: node.id,
    mediaId: node.media.id,
    episode: node.episode,
    airingAt: node.airingAt,
    title: node.media.title.userPreferred ?? `Anime #${node.media.id}`,
    coverUrl: node.media.coverImage?.medium ?? null,
  }));
}

/** Découpe une liste en lots de `size` éléments. */
export function chunk<T>(items: readonly T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
  return chunks;
}

/** Ne garde que les sorties non notifiées et au-delà de la progression de l'utilisateur (sans doublon). */
export function filterNewEpisodes(
  items: readonly AiringItem[],
  progressByMedia: ReadonlyMap<number, number>,
  notified: readonly number[],
): AiringItem[] {
  const seen = new Set(notified);
  const result: AiringItem[] = [];
  for (const item of items) {
    const progress = progressByMedia.get(item.mediaId);
    if (progress === undefined || item.episode <= progress || seen.has(item.scheduleId)) continue;
    seen.add(item.scheduleId);
    result.push(item);
  }
  return result;
}

/** Ajoute les nouvelles sorties notifiées et ne garde que les `max` plus récentes. */
export function trimNotified(previous: readonly number[], added: readonly number[], max: number = MAX_NOTIFIED): number[] {
  const merged = [...previous.filter((id) => !added.includes(id)), ...added];
  return merged.slice(Math.max(0, merged.length - max));
}

export interface PlannedNotification {
  id: string;
  title: string;
  message: string;
  /** Séries ouvertes par un clic (la première pour un résumé) */
  mediaIds: number[];
}

export const AIRING_NOTIFICATION_PREFIX = 'synckai-airing:';

/** Une notification par sortie, ou un résumé unique au-delà de GROUP_THRESHOLD. */
export function planNotifications(items: readonly AiringItem[]): PlannedNotification[] {
  if (items.length === 0) return [];
  if (items.length <= GROUP_THRESHOLD) {
    return items.map((item) => ({
      id: `${AIRING_NOTIFICATION_PREFIX}${item.scheduleId}`,
      title: t('airing.notification.single', { episode: item.episode, title: item.title }),
      message: t('airing.notification.message'),
      mediaIds: [item.mediaId],
    }));
  }
  const titles = [...new Set(items.map((item) => item.title))];
  return [
    {
      id: `${AIRING_NOTIFICATION_PREFIX}group:${Math.max(...items.map((item) => item.scheduleId))}`,
      title: t('airing.notification.group', { count: items.length, titles: titles.join(', ') }),
      message: t('airing.notification.message'),
      mediaIds: [...new Set(items.map((item) => item.mediaId))],
    },
  ];
}
