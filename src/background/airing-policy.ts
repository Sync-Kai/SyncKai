import { formatList, t, tp } from '../i18n';
import { estimateRelease, type AiringSchedule, type OffsetSettings } from '../shared/agenda';
import { isRecord } from '../shared/guards';
import type { StreamingPlatform } from '../platforms/ids';
import type { SyncSettings } from '../shared/settings';
import { toSafeImageUrl } from '../shared/url';

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

/** Réglages de l'heure des alertes : délais de l'agenda et délai propre aux alertes */
export type AlertSettings = OffsetSettings & Pick<SyncSettings, 'airingDelayHours'>;

/**
 * Heure de l'alerte d'une sortie (UNIX secondes), celle de l'agenda (décision 17, 6-D13) : sortie estimée sur la
 * plateforme (délai de la série, sinon de la plateforme de son lien « Ouvrir » ; diffusion japonaise si aucun n'est
 * connu, comme l'agenda qui n'affiche alors pas d'estimation), plus le délai des alertes (0 par défaut).
 */
export function alertAt(airingAt: number, mediaId: number, platform: StreamingPlatform | null, settings: AlertSettings): number {
  return (estimateRelease(airingAt, platform, settings, mediaId) ?? airingAt) + settings.airingDelayHours * HOUR_S;
}

/** Écart entre diffusion japonaise et alerte (secondes) : plus petit et plus grand parmi les séries suivies */
export interface AlertShifts {
  min: number;
  max: number;
}

/** Écarts extrêmes des séries (fiche AniList → plateforme du lien « Ouvrir ») ; sans série : délai des alertes seul */
export function alertShifts(series: ReadonlyMap<number, StreamingPlatform | null>, settings: AlertSettings): AlertShifts {
  // estimateRelease est linéaire : l'écart d'une série est l'heure de l'alerte d'une diffusion à l'instant 0
  const shifts = [...series].map(([mediaId, platform]) => alertAt(0, mediaId, platform, settings));
  if (shifts.length === 0) return { min: settings.airingDelayHours * HOUR_S, max: settings.airingDelayHours * HOUR_S };
  return { min: Math.min(...shifts), max: Math.max(...shifts) };
}

export interface AlertWindow {
  /** Diffusions japonaises à lire (bornes exclues) */
  fetch: AiringWindow;
  /** Rattrapage borné : une alerte à cette heure ou avant n'est plus envoyée (2 h au premier passage, 24 h ensuite) */
  notBefore: number;
}

/**
 * Diffusions à lire : reprend à la fin de la fenêtre réellement couverte (`coveredUntilS`, diffusions antérieures déjà
 * traitées), assez loin pour la série au plus grand écart, jusqu'à la dernière diffusion dont l'alerte peut être échue
 * (plus petit écart ; un délai négatif lit des diffusions à venir). La reprise reste en heure de diffusion : une baisse
 * d'un délai ne saute donc aucune sortie (ALRT-02) ; une hausse repasse sur des sorties déjà notifiées, écartées par
 * airingNotified.
 */
export function alertWindow(nowS: number, coveredUntilS: number | null, shifts: AlertShifts): AlertWindow {
  const notBefore = nowS - (coveredUntilS === null ? FIRST_RUN_LOOKBACK_S : MAX_LOOKBACK_S);
  const to = nowS - shifts.min;
  const floor = notBefore - shifts.max;
  if (coveredUntilS === null) return { fetch: { from: floor, to }, notBefore };
  // Bornes exclues : `coveredUntilS - 1` inclut la seconde `coveredUntilS`, pas encore couverte
  return { fetch: { from: Math.min(Math.max(coveredUntilS - 1, floor), to), to }, notBefore };
}

/**
 * Sorties lues dont l'alerte est échue (avant `nowS`, après `notBefore`), et fin de la fenêtre couverte : une sortie dont
 * l'alerte est encore à venir y retient la reprise (sa diffusion sera relue jusqu'à l'heure de son alerte).
 */
export function dueAlerts<T extends { airingAt: number }>(items: readonly T[], alertTime: (item: T) => number, nowS: number, notBefore: number, coveredUntil: number): { due: T[]; coveredUntil: number } {
  let covered = coveredUntil;
  const due: T[] = [];
  for (const item of items) {
    const at = alertTime(item);
    if (at >= nowS) covered = Math.min(covered, item.airingAt);
    else if (at > notBefore) due.push(item);
  }
  return { due, coveredUntil: covered };
}

/** Ancien format (heure de la dernière vérification) → fin de fenêtre couverte, décalée du délai actuel */
export function legacyCoveredUntil(lastCheckS: number, delayHours: number): number {
  return lastCheckS - delayHours * HOUR_S;
}

/**
 * Fin de la fenêtre couverte après la lecture : `range.to`, ramenée à `truncatedAt` (dernière sortie lue d'un lot
 * tronqué) si la pagination s'est arrêtée avant. La vérification suivante reprend là, sans perdre de sortie (ALRT-06).
 */
export function coveredEnd(range: AiringWindow, truncatedAt: number | null): number {
  return truncatedAt === null ? range.to : Math.max(range.from + 1, Math.min(range.to, truncatedAt));
}

/**
 * Progression relevée par les synchros récentes de SyncKai (max par fiche), pour les séries déjà suivies : le cache
 * « En cours » n'est rechargé que toutes les 12 h, un épisode vu entre-temps ne doit pas être annoncé (ALRT-01).
 */
export function withSyncedProgress(
  progressByMedia: ReadonlyMap<number, number>,
  syncs: readonly { mediaId: number; progress: number; syncedAt: number }[],
  sinceMs: number,
): Map<number, number> {
  const progress = new Map(progressByMedia);
  for (const sync of syncs) {
    const current = progress.get(sync.mediaId);
    if (current !== undefined && sync.syncedAt > sinceMs && sync.progress > current) progress.set(sync.mediaId, sync.progress);
  }
  return progress;
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

/** Pages AniList lues au plus par lot de séries (50 sorties par page) : vérification horaire */
export const MAX_SCHEDULE_PAGES = 3;
/** Agenda demandé par le panneau (semaine entière, à l'ouverture seulement) : 50 séries quotidiennes tiennent */
export const AGENDA_SCHEDULE_PAGES = 8;

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
    coverUrl: toSafeImageUrl(node.media.coverImage?.medium),
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
  /** Sorties annoncées : retirées de airingNotified si la notification ne peut pas être affichée (ALRT-04) */
  scheduleIds: number[];
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
      scheduleIds: [item.scheduleId],
    }));
  }
  const titles = [...new Set(items.map((item) => item.title))];
  return [
    {
      id: `${AIRING_NOTIFICATION_PREFIX}group:${Math.max(...items.map((item) => item.scheduleId))}`,
      title: tp('airing.notification.group', items.length, { titles: formatList(titles) }),
      message: t('airing.notification.message'),
      mediaIds: [...new Set(items.map((item) => item.mediaId))],
      scheduleIds: items.map((item) => item.scheduleId),
    },
  ];
}
