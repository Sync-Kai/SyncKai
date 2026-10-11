import { t } from '../i18n';
import { anilistPublicQuery } from './api/client';
import { getWatchingList } from './api/watching';
import {
  AIRING_NOTIFICATION_PREFIX,
  chunk,
  computeWindow,
  coveredEnd,
  filterNewEpisodes,
  isAiringPageData,
  itemsInWindow,
  legacyCoveredUntil,
  MAX_SCHEDULE_PAGES,
  MEDIA_CHUNK,
  mergeWeekWindow,
  planNotifications,
  toAiringItems,
  trimNotified,
  withSyncedProgress,
  type AiringItem,
  type PlannedNotification,
} from './airing-policy';
import { watchingProgress, weekRange } from '../shared/agenda';
import { agendaFirstDay, writeWeekCache } from '../shared/agenda-store';
import { AIRING_COVERED_KEY, AIRING_LAST_CHECK_KEY, AIRING_NOTIFIED_KEY, AIRING_RESULT_KEY, AIRING_TARGETS_KEY } from '../shared/airing-keys';
import type { AiringCheckResult, AiringSkipReason } from '../shared/airing.types';
import { getExcludedSeries } from '../shared/exclusions';
import { isRecord } from '../shared/guards';
import { effectivePreferredPlayer } from '../shared/netflix-access';
import type { SessionEpochs } from '../shared/session-epochs';
import { getSettings } from '../shared/settings';
import {
  getCachedWatching,
  getMalToken,
  getOpenSessions,
  getRecentSyncs,
  getValidToken,
  sessionsStillOpen,
  withStorageLock,
} from '../shared/storage';
import type { TrackerId } from '../shared/tracker.types';
import { choosePlatformLink, isWatchingFresh, WATCHING_MAX_AGE_MS } from '../shared/watching';
import type { WatchingEntry, WatchingList } from '../shared/watching.types';
import { createLogger } from '../shared/logger';

// Alertes de sortie : une alarme horaire interroge le calendrier public AniList pour les séries en cours.

export const AIRING_ALARM = 'synckai:airing';

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

/** Listes « En cours » en cache des deux services (AniList d'abord) */
async function getCachedLists(): Promise<WatchingList[]> {
  const lists = await Promise.all([getCachedWatching('anilist'), getCachedWatching('mal')]);
  return lists.filter((list): list is WatchingList => list !== null);
}

/** Entrées en cache des deux services (AniList d'abord) */
export async function getCachedEntries(): Promise<WatchingEntry[]> {
  return (await getCachedLists()).flatMap((list) => list.entries);
}

/** Services connectés : token AniList valide, token MAL présent (renouvelé à la demande) */
async function connectedServices(): Promise<TrackerId[]> {
  const [anilist, mal] = await Promise.all([getValidToken(), getMalToken()]);
  const services: TrackerId[] = [];
  if (anilist !== null) services.push('anilist');
  if (mal !== null) services.push('mal');
  return services;
}

export async function hasConnectedService(): Promise<boolean> {
  return (await connectedServices()).length > 0;
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

export interface AiringFetch {
  items: AiringItem[];
  /**
   * Pagination arrêtée avant la fin d'un lot : heure de la dernière sortie lue de ce lot (la plus petite si plusieurs).
   * Les sorties antérieures sont complètes ; null si rien n'a été coupé.
   */
  truncatedAt: number | null;
}

/**
 * Sorties des séries `ids` entre `from` et `to` (UNIX secondes, bornes exclues) : lots de 50 séries,
 * au plus `maxPages` pages par lot. Lève une ApiError.
 */
export async function fetchAiring(ids: readonly number[], from: number, to: number, maxPages: number = MAX_SCHEDULE_PAGES): Promise<AiringFetch> {
  const items: AiringItem[] = [];
  let truncatedAt: number | null = null;
  for (const ids50 of chunk(ids, MEDIA_CHUNK)) {
    for (let page = 1; page <= maxPages; page++) {
      const data = await anilistPublicQuery(AIRING_QUERY, isAiringPageData, { ids: ids50, from, to, page });
      const pageItems = toAiringItems(data);
      items.push(...pageItems);
      if (data.Page.pageInfo?.hasNextPage !== true) break;
      if (page === maxPages) {
        // Tri par heure croissante : ce sont les sorties les plus tardives qui manquent (ALRT-06)
        const last = pageItems.at(-1)?.airingAt ?? from + 1;
        truncatedAt = truncatedAt === null ? last : Math.min(truncatedAt, last);
        log.warn('Calendrier tronqué : trop de sorties pour un lot de séries');
      }
    }
  }
  return { items, truncatedAt };
}

/**
 * Liste « En cours » rechargée avant le calcul quand son cache manque ou a plus de 12 h : sans ouverture du popup,
 * elle n'était jamais relue (ALRT-01). Au plus une requête par service toutes les 12 h, dans le réveil horaire
 * existant ; un échec garde l'ancien cache. getWatchingList relève sa propre génération de session.
 */
async function refreshStaleWatching(services: readonly TrackerId[]): Promise<void> {
  for (const service of services) {
    if (isWatchingFresh(await getCachedWatching(service), Date.now(), WATCHING_MAX_AGE_MS)) continue;
    const result = await getWatchingList(service, true);
    if (!result.ok) log.warn(`Liste « En cours » (${service}) non rechargée :`, result.code);
  }
}

/** Fin de la fenêtre déjà couverte : nouveau format, sinon ancienne heure de vérification décalée du délai actuel */
function readCoveredUntil(stored: Record<string, unknown>, delayHours: number): number | null {
  const covered = stored[AIRING_COVERED_KEY];
  if (typeof covered === 'number' && Number.isFinite(covered)) return covered;
  const lastCheck = stored[AIRING_LAST_CHECK_KEY];
  return typeof lastCheck === 'number' && Number.isFinite(lastCheck) ? legacyCoveredUntil(lastCheck, delayHours) : null;
}

/** Message d'erreur court et lisible pour le popup */
function describeError(error: unknown): string {
  const message = error instanceof Error && error.message ? error.message : t('airing.unknownError');
  return message.length > 160 ? `${message.slice(0, 157)}…` : message;
}

/**
 * Notifications non affichées : leurs sorties sont retirées de airingNotified et la fenêtre couverte ramenée à la
 * plus ancienne d'entre elles, pour qu'elles soient réessayées à la vérification suivante (ALRT-04). Sous le verrou
 * de la déconnexion : rien n'est réécrit pour un compte déconnecté entre-temps.
 */
async function forgetFailedNotifications(failed: readonly PlannedNotification[], items: readonly AiringItem[], epochs: SessionEpochs): Promise<void> {
  const ids = new Set(failed.flatMap((notification) => notification.scheduleIds));
  const failedAt = items.filter((item) => ids.has(item.scheduleId)).map((item) => item.airingAt);
  if (failedAt.length === 0) return;
  const earliest = Math.min(...failedAt);
  const failedIds = new Set(failed.map((notification) => notification.id));
  await withStorageLock(async () => {
    if (!(await sessionsStillOpen(epochs))) return;
    const current = await chrome.storage.local.get([AIRING_NOTIFIED_KEY, AIRING_COVERED_KEY, AIRING_TARGETS_KEY]);
    const notifiedRaw: unknown = current[AIRING_NOTIFIED_KEY];
    const covered: unknown = current[AIRING_COVERED_KEY];
    const targetsRaw: unknown = current[AIRING_TARGETS_KEY];
    await chrome.storage.local.set({
      [AIRING_NOTIFIED_KEY]: (isNumberArray(notifiedRaw) ? notifiedRaw : []).filter((id) => !ids.has(id)),
      [AIRING_COVERED_KEY]: typeof covered === 'number' ? Math.min(covered, earliest) : earliest,
      [AIRING_TARGETS_KEY]: Object.fromEntries(Object.entries(isRecord(targetsRaw) ? targetsRaw : {}).filter(([id]) => !failedIds.has(id))),
    });
  });
}

interface CheckOutcome {
  notified: number;
  skipped: AiringSkipReason | null;
  /** Notification(s) non affichée(s), réessayée(s) à la vérification suivante */
  error: string | null;
}

/** Vérification proprement dite : nombre de notifications créées ou raison de l'abandon. Peut lever. */
async function runCheck(): Promise<CheckOutcome> {
  const settings = await getSettings();
  if (!settings.airingAlerts) return { notified: 0, skipped: 'disabled', error: null };
  const services = await connectedServices();
  if (services.length === 0) return { notified: 0, skipped: 'not-connected', error: null };

  // Sessions relevées avant la lecture des séries suivies : une déconnexion pendant la vérification abandonne la
  // semaine d'agenda et les notifications de l'ancien compte (ALRT-05)
  const epochs = await getOpenSessions();
  await refreshStaleWatching(services);
  const [lists, excluded, syncs] = await Promise.all([getCachedLists(), getExcludedSeries(), getRecentSyncs()]);
  // Progression par fiche AniList (la plus avancée si la série est sur les deux services), complétée par les synchros
  // faites depuis la lecture de la plus ancienne des listes
  const oldestList = lists.length > 0 ? Math.min(...lists.map((list) => list.fetchedAt)) : 0;
  const progressByMedia = withSyncedProgress(watchingProgress(lists.flatMap((list) => list.entries), excluded), syncs, oldestList);
  log.info(`${progressByMedia.size} série(s) en cours à vérifier`);
  if (progressByMedia.size === 0) return { notified: 0, skipped: 'no-series', error: null };

  const stored = await chrome.storage.local.get([AIRING_COVERED_KEY, AIRING_LAST_CHECK_KEY]);
  const nowS = Math.floor(Date.now() / 1000);
  const range = computeWindow(nowS, readCoveredUntil(stored, settings.airingDelayHours), settings.airingDelayHours);
  // Une seule lecture du calendrier sert aussi l'agenda : fenêtre élargie à toute la semaine en cours
  const week = weekRange(nowS * 1000, agendaFirstDay());
  const weekWindow = { from: Math.floor(week.start / 1000) - 1, to: Math.floor(week.end / 1000) };
  const mediaIds = [...progressByMedia.keys()];
  const fetchWindow = mergeWeekWindow(range, weekWindow.from + 1, weekWindow.to);
  const fetched = await fetchAiring(mediaIds, fetchWindow.from, fetchWindow.to);
  // Semaine coupée avant la fin de la fenêtre des alertes : celle-ci, bien plus petite, est relue seule (ALRT-06)
  const alertFetch = fetched.truncatedAt !== null && fetched.truncatedAt < range.to ? await fetchAiring(mediaIds, range.from, range.to) : fetched;
  const coveredUntil = coveredEnd(range, alertFetch.truncatedAt);
  const items = itemsInWindow(alertFetch.items, { from: range.from, to: coveredUntil });
  log.info(`${items.length} diffusion(s) trouvée(s) dans la fenêtre`);
  try {
    const schedules = itemsInWindow(fetched.items, weekWindow);
    // Semaine incomplète : marquée pour que le panneau la relise au lieu de la croire à jour
    await writeWeekCache({ weekStart: week.key, fetchedAt: Date.now(), mediaIds, schedules, ...(fetched.truncatedAt !== null ? { truncated: true } : {}) }, epochs);
  } catch (error) {
    log.warn('Agenda non mis en cache :', error);
  }

  // Liste des épisodes déjà notifiés lue/écrite sous verrou : alarme et vérification manuelle ne doublonnent pas.
  // Même verrou que la déconnexion : sessions revérifiées avant toute écriture (null = vérification abandonnée)
  const plan = await withStorageLock(async () => {
    if (!(await sessionsStillOpen(epochs))) return null;
    const current = await chrome.storage.local.get([AIRING_NOTIFIED_KEY, AIRING_TARGETS_KEY]);
    const notifiedRaw: unknown = current[AIRING_NOTIFIED_KEY];
    const notified = isNumberArray(notifiedRaw) ? notifiedRaw : [];
    const newItems = filterNewEpisodes(items, progressByMedia, notified);
    const planned = planNotifications(newItems);

    const targetsRaw: unknown = current[AIRING_TARGETS_KEY];
    const targets = Object.entries(isRecord(targetsRaw) ? targetsRaw : {}).filter((pair): pair is [string, number[]] => isNumberArray(pair[1]));
    const nextTargets = [...targets.filter(([id]) => !planned.some((p) => p.id === id)), ...planned.map((p): [string, number[]] => [p.id, p.mediaIds])];

    await chrome.storage.local.set({
      // Fin de la fenêtre réellement couverte, pas l'heure de la vérification (ALRT-02, ALRT-06)
      [AIRING_COVERED_KEY]: coveredUntil,
      [AIRING_NOTIFIED_KEY]: trimNotified(notified, newItems.map((i) => i.scheduleId)),
      [AIRING_TARGETS_KEY]: Object.fromEntries(nextTargets.slice(-MAX_TARGETS)),
    });
    await chrome.storage.local.remove(AIRING_LAST_CHECK_KEY);
    return planned;
  });
  if (plan === null) {
    log.info('Compte déconnecté pendant la vérification : aucune notification');
    return { notified: 0, skipped: 'not-connected', error: null };
  }

  // Chaque notification isolée : un échec n'empêche pas les suivantes, et ses sorties seront réessayées (ALRT-04)
  const iconUrl = chrome.runtime.getURL('icons/icon-128.png');
  const failed: PlannedNotification[] = [];
  let firstError: unknown = null;
  for (const notification of plan) {
    try {
      await chrome.notifications.create(notification.id, {
        type: 'basic',
        iconUrl,
        title: notification.title,
        message: notification.message,
        // Firefox ne gère pas les boutons de notification : un clic sur la notification ouvre déjà la série
        ...(__SYNCKAI_TARGET__ === 'firefox' ? {} : { buttons: [{ title: t('common.open') }] }),
        priority: 0,
      });
    } catch (error) {
      log.warn('Notification non affichée :', error);
      failed.push(notification);
      firstError ??= error;
    }
  }
  if (failed.length > 0) await forgetFailedNotifications(failed, items, epochs);
  return { notified: plan.length - failed.length, skipped: null, error: failed.length > 0 ? describeError(firstError) : null };
}

/**
 * Notifie les épisodes sortis depuis la dernière vérification (alarme ou « Vérifier maintenant »).
 * Ne lève jamais ; le résumé est aussi enregistré sous `airingLastResult` pour le popup.
 */
export async function checkNewEpisodes(): Promise<AiringCheckResult> {
  log.info('Début de la vérification des sorties');
  let result: AiringCheckResult;
  try {
    const { notified, skipped, error } = await runCheck();
    result = { checkedAt: Date.now(), notified, skipped, error };
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
    const stored = await chrome.storage.local.get(AIRING_TARGETS_KEY);
    const targets: unknown = stored[AIRING_TARGETS_KEY];
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
