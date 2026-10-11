import { t } from '../i18n';
import { anilistPublicQuery } from './api/client';
import {
  AIRING_NOTIFICATION_PREFIX,
  chunk,
  computeWindow,
  filterNewEpisodes,
  isAiringPageData,
  itemsInWindow,
  MAX_SCHEDULE_PAGES,
  MEDIA_CHUNK,
  mergeWeekWindow,
  planNotifications,
  toAiringItems,
  trimNotified,
  type AiringItem,
} from './airing-policy';
import { watchingProgress, weekRange } from '../shared/agenda';
import { agendaFirstDay, writeWeekCache } from '../shared/agenda-store';
import { AIRING_RESULT_KEY, type AiringCheckResult, type AiringSkipReason } from '../shared/airing.types';
import { getExcludedSeries } from '../shared/exclusions';
import { isRecord } from '../shared/guards';
import { effectivePreferredPlayer } from '../shared/netflix-access';
import { getSettings } from '../shared/settings';
import { getCachedWatching, getMalToken, getValidToken, withStorageLock } from '../shared/storage';
import { choosePlatformLink } from '../shared/watching';
import type { WatchingEntry } from '../shared/watching.types';
import { createLogger } from '../shared/logger';

// Alertes de sortie : une alarme horaire interroge le calendrier public AniList pour les séries en cours.

export const AIRING_ALARM = 'synckai:airing';

const LAST_CHECK_KEY = 'airingLastCheck';
const NOTIFIED_KEY = 'airingNotified';
/** notificationId → mediaIds à ouvrir au clic (le service worker peut s'endormir entre-temps) */
const TARGETS_KEY = 'airingTargets';
const MAX_TARGETS = 20;
const log = createLogger('airing');

// Pagination : une semaine de séries suivies peut dépasser 50 sorties par lot
const AIRING_QUERY = `
query ($ids: [Int], $from: Int, $to: Int, $page: Int) {
  Page(page: $page, perPage: 50) {
    pageInfo { hasNextPage }
    airingSchedules(mediaId_in: $ids, airingAt_greater: $from, airingAt_lesser: $to, sort: TIME) {
      id episode airingAt
      media { id title { userPreferred } coverImage { medium } }
    }
  }
}`;

const isNumberArray = (value: unknown): value is number[] => Array.isArray(value) && value.every((v) => typeof v === 'number');

/** Entrées en cache des deux services (AniList d'abord) */
export async function getCachedEntries(): Promise<WatchingEntry[]> {
  const [anilist, mal] = await Promise.all([getCachedWatching('anilist'), getCachedWatching('mal')]);
  return [...(anilist?.entries ?? []), ...(mal?.entries ?? [])];
}

export async function hasConnectedService(): Promise<boolean> {
  const [anilist, mal] = await Promise.all([getValidToken(), getMalToken()]);
  return anilist !== null || mal !== null;
}

/** Crée l'alarme horaire si les alertes sont actives et un service connecté, sinon la supprime. */
export async function ensureAiringAlarm(): Promise<void> {
  try {
    const settings = await getSettings();
    if (!settings.airingAlerts || !(await hasConnectedService())) {
      await chrome.alarms.clear(AIRING_ALARM);
      return;
    }
    const existing = await chrome.alarms.get(AIRING_ALARM);
    if (!existing) await chrome.alarms.create(AIRING_ALARM, { delayInMinutes: 1, periodInMinutes: 60 });
  } catch (error) {
    log.error('Alarme impossible à configurer :', error);
  }
}

/**
 * Sorties des séries `ids` entre `from` et `to` (UNIX secondes, bornes exclues) : lots de 50 séries,
 * au plus MAX_SCHEDULE_PAGES pages par lot. Lève une ApiError.
 */
export async function fetchAiring(ids: readonly number[], from: number, to: number): Promise<AiringItem[]> {
  const items: AiringItem[] = [];
  for (const ids50 of chunk(ids, MEDIA_CHUNK)) {
    for (let page = 1; page <= MAX_SCHEDULE_PAGES; page++) {
      const data = await anilistPublicQuery(AIRING_QUERY, isAiringPageData, { ids: ids50, from, to, page });
      items.push(...toAiringItems(data));
      if (data.Page.pageInfo?.hasNextPage !== true) break;
      if (page === MAX_SCHEDULE_PAGES) log.warn('Calendrier tronqué : trop de sorties pour un lot de séries');
    }
  }
  return items;
}

/** Message d'erreur court et lisible pour le popup */
function describeError(error: unknown): string {
  const message = error instanceof Error && error.message ? error.message : t('airing.unknownError');
  return message.length > 160 ? `${message.slice(0, 157)}…` : message;
}

/** Vérification proprement dite : nombre de notifications créées ou raison de l'abandon. Peut lever. */
async function runCheck(): Promise<{ notified: number; skipped: AiringSkipReason | null }> {
  const settings = await getSettings();
  if (!settings.airingAlerts) return { notified: 0, skipped: 'disabled' };
  if (!(await hasConnectedService())) return { notified: 0, skipped: 'not-connected' };

  const [entries, excluded] = await Promise.all([getCachedEntries(), getExcludedSeries()]);
  // Progression par fiche AniList (la plus avancée si la série est sur les deux services)
  const progressByMedia = watchingProgress(entries, excluded);
  log.info(`${progressByMedia.size} série(s) en cours à vérifier`);
  if (progressByMedia.size === 0) return { notified: 0, skipped: 'no-series' };

  const stored = await chrome.storage.local.get(LAST_CHECK_KEY);
  const lastCheck: unknown = stored[LAST_CHECK_KEY];
  const nowS = Math.floor(Date.now() / 1000);
  const range = computeWindow(nowS, typeof lastCheck === 'number' ? lastCheck : null, settings.airingDelayHours);
  // Une seule lecture du calendrier sert aussi l'agenda : fenêtre élargie à toute la semaine en cours
  const week = weekRange(nowS * 1000, agendaFirstDay());
  const weekWindow = { from: Math.floor(week.start / 1000) - 1, to: Math.floor(week.end / 1000) };
  const mediaIds = [...progressByMedia.keys()];
  const fetchWindow = mergeWeekWindow(range, weekWindow.from + 1, weekWindow.to);
  const fetched = await fetchAiring(mediaIds, fetchWindow.from, fetchWindow.to);
  const items = itemsInWindow(fetched, range);
  log.info(`${items.length} diffusion(s) trouvée(s) dans la fenêtre`);
  try {
    await writeWeekCache({ weekStart: week.key, fetchedAt: Date.now(), mediaIds, schedules: itemsInWindow(fetched, weekWindow) });
  } catch (error) {
    log.warn('Agenda non mis en cache :', error);
  }

  // Liste des épisodes déjà notifiés lue/écrite sous verrou : alarme et vérification manuelle ne doublonnent pas
  const fresh = await withStorageLock(async () => {
    const current = await chrome.storage.local.get([NOTIFIED_KEY, TARGETS_KEY]);
    const notifiedRaw: unknown = current[NOTIFIED_KEY];
    const notified = isNumberArray(notifiedRaw) ? notifiedRaw : [];
    const newItems = filterNewEpisodes(items, progressByMedia, notified);
    const plan = planNotifications(newItems);

    const targetsRaw: unknown = current[TARGETS_KEY];
    const targets = Object.entries(isRecord(targetsRaw) ? targetsRaw : {}).filter((pair): pair is [string, number[]] => isNumberArray(pair[1]));
    const nextTargets = [...targets.filter(([id]) => !plan.some((p) => p.id === id)), ...plan.map((p): [string, number[]] => [p.id, p.mediaIds])];

    await chrome.storage.local.set({
      [LAST_CHECK_KEY]: nowS,
      [NOTIFIED_KEY]: trimNotified(notified, newItems.map((i) => i.scheduleId)),
      [TARGETS_KEY]: Object.fromEntries(nextTargets.slice(-MAX_TARGETS)),
    });
    return plan;
  });

  const iconUrl = chrome.runtime.getURL('icons/icon-128.png');
  for (const notification of fresh) {
    await chrome.notifications.create(notification.id, {
      type: 'basic',
      iconUrl,
      title: notification.title,
      message: notification.message,
      // Firefox ne gère pas les boutons de notification : un clic sur la notification ouvre déjà la série
      ...(__SYNCKAI_TARGET__ === 'firefox' ? {} : { buttons: [{ title: t('common.open') }] }),
      priority: 0,
    });
  }
  return { notified: fresh.length, skipped: null };
}

/**
 * Notifie les épisodes sortis depuis la dernière vérification (alarme ou « Vérifier maintenant »).
 * Ne lève jamais ; le résumé est aussi enregistré sous `airingLastResult` pour le popup.
 */
export async function checkNewEpisodes(): Promise<AiringCheckResult> {
  log.info('Début de la vérification des sorties');
  let result: AiringCheckResult;
  try {
    const { notified, skipped } = await runCheck();
    result = { checkedAt: Date.now(), notified, skipped, error: null };
  } catch (error) {
    log.error('Vérification des sorties impossible :', error);
    result = { checkedAt: Date.now(), notified: 0, skipped: null, error: describeError(error) };
  }
  log.info('Fin de la vérification :', result.error ? 'échec' : result.skipped ? `ignorée (${result.skipped})` : `${result.notified} notification(s)`);
  try {
    await chrome.storage.local.set({ [AIRING_RESULT_KEY]: result });
  } catch (error) {
    log.error('Enregistrement du résumé impossible :', error);
  }
  return result;
}

/** URL d'ouverture : plateforme préférée du cache (Netflix seulement avec l'accès), sinon la fiche du service, sinon AniList. */
async function resolveUrl(mediaId: number): Promise<string> {
  const [entries, settings] = await Promise.all([getCachedEntries(), getSettings()]);
  const preferred = await effectivePreferredPlayer(settings.preferredPlayer);
  const matches = entries.filter((entry) => entry.mediaId === mediaId);
  for (const entry of matches) {
    const link = choosePlatformLink(entry, preferred);
    if (link) return link.url;
  }
  return matches[0]?.siteUrl ?? `https://anilist.co/anime/${mediaId}`;
}

async function openFromNotification(notificationId: string): Promise<void> {
  if (!notificationId.startsWith(AIRING_NOTIFICATION_PREFIX)) return;
  try {
    await chrome.notifications.clear(notificationId);
    const stored = await chrome.storage.local.get(TARGETS_KEY);
    const targets: unknown = stored[TARGETS_KEY];
    const mediaIds: unknown = isRecord(targets) ? targets[notificationId] : undefined;
    const mediaId = isNumberArray(mediaIds) ? mediaIds[0] : undefined;
    if (mediaId === undefined) return;
    await chrome.tabs.create({ url: await resolveUrl(mediaId) });
  } catch (error) {
    log.error('Ouverture impossible :', error);
  }
}

export function handleNotificationClick(notificationId: string): Promise<void> {
  return openFromNotification(notificationId);
}

export function handleNotificationButton(notificationId: string, buttonIndex: number): Promise<void> {
  return buttonIndex === 0 ? openFromNotification(notificationId) : Promise.resolve();
}
