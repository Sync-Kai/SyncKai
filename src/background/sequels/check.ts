import { formatList, getLocale, t, tp } from '../../i18n';
import { STORAGE_KEYS } from '../../protocol/storage-keys';
import { connectedServices } from '../../browser/airing-alarm';
import { createLogger } from '../../browser/logger';
import { getSettings } from '../../browser/storage/settings-access';
import { getOpenSessions, sessionsStillOpen } from '../../browser/storage/sessions';
import { withStorageLock } from '../../browser/storage/lock';
import { formatSequelDate } from '../../shared/sequel-date';
import { EMPTY_SEQUEL_STORE, isSequelStore, mergeSequelPass, sequelCandidates, type SequelSnapshot, type SequelStore } from '../../shared/sequels';
import { notificationsBlocked } from '../../browser/notifications';
import { fetchSequelRelations, readSourceSeries } from './fetch';

// Vérification quotidienne des suites, lancée par l'alarme horaire des alertes (airing.ts) : listes complètes des
// services connectés, relations AniList, fusion dans `sequels:state`, notification des suites repérées sur un service
// déjà amorcé. La première passe d'un service enregistre sans notifier.

export const SEQUEL_CHECK_INTERVAL_MS = 24 * 3_600_000;
export const SEQUEL_NOTIFICATION_PREFIX = 'synckai-sequel:';

const log = createLogger('sequels');

/** `blocked` : suites enregistrées, aucune notification (désactivées dans le navigateur) */
export interface SequelCheckResult {
  checkedAt: number;
  found: number;
  notified: number;
  skipped: 'disabled' | 'not-connected' | 'not-due' | 'blocked' | null;
  error: string | null;
}

function describeError(error: unknown): string {
  const message = error instanceof Error && error.message ? error.message : t('airing.unknownError');
  return message.length > 160 ? `${message.slice(0, 157)}…` : message;
}

async function readStore(): Promise<SequelStore> {
  const stored = await chrome.storage.local.get(STORAGE_KEYS.sequelsState);
  const value: unknown = stored[STORAGE_KEYS.sequelsState];
  return isSequelStore(value) ? value : EMPTY_SEQUEL_STORE;
}

/** Une notification pour une suite (boutons : ajouter, ouvrir), une seule groupée pour plusieurs. Retourne le nombre annoncé ; lève si refusée. */
async function notify(sequels: readonly SequelSnapshot[], now: number): Promise<number> {
  const iconUrl = chrome.runtime.getURL('icons/icon-128.png');
  const [first] = sequels;
  if (first === undefined) return 0;
  // Firefox ne gère pas les boutons de notification : le clic ouvre déjà la suite
  if (sequels.length === 1) {
    await chrome.notifications.create(`${SEQUEL_NOTIFICATION_PREFIX}${first.id}`, {
      type: 'basic',
      iconUrl,
      title: t('sequel.notification.single', { title: first.title }),
      message: t('sequel.notification.message', { date: formatSequelDate(first, getLocale()), source: first.sourceTitle }),
      ...(__SYNCKAI_TARGET__ === 'firefox' ? {} : { buttons: [{ title: t('sequel.add') }, { title: t('sequel.notification.openEntry') }] }),
      priority: 0,
    });
  } else {
    await chrome.notifications.create(`${SEQUEL_NOTIFICATION_PREFIX}group:${now}`, {
      type: 'basic',
      iconUrl,
      title: tp('sequel.notification.group', sequels.length),
      message: formatList(sequels.map((sequel) => sequel.title)),
      ...(__SYNCKAI_TARGET__ === 'firefox' ? {} : { buttons: [{ title: t('sequel.notification.open') }] }),
      priority: 0,
    });
  }
  return sequels.length;
}

async function run(now: number, force: boolean): Promise<Omit<SequelCheckResult, 'checkedAt'>> {
  const none = { found: 0, notified: 0, error: null };
  const settings = await getSettings();
  if (!settings.sequelAlerts) return { ...none, skipped: 'disabled' };
  const services = await connectedServices();
  if (services.length === 0) return { ...none, skipped: 'not-connected' };
  const { lastCheck } = await readStore();
  if (!force && lastCheck !== null && now - lastCheck < SEQUEL_CHECK_INTERVAL_MS) return { ...none, skipped: 'not-due' };

  // Sessions relevées avant la première requête : une déconnexion pendant la passe l'abandonne sans rien écrire
  const epochs = await getOpenSessions();
  // Toute lecture en échec (liste, relations) lève : la passe est abandonnée entière, aucun service marqué amorcé
  const { sources, inLists } = await readSourceSeries(services);
  const relations = await fetchSequelRelations(sources.map((source) => source.id));
  const candidates = sequelCandidates(sources.map((source) => ({ source, edges: relations.get(source.id) ?? [] })), inLists);

  // Store relu sous verrou (le panneau a pu changer des états), même verrou que la déconnexion
  const merged = await withStorageLock(async () => {
    if (!(await sessionsStillOpen(epochs))) return null;
    const result = mergeSequelPass(await readStore(), candidates, services, now);
    await chrome.storage.local.set({ [STORAGE_KEYS.sequelsState]: result.store });
    return result;
  });
  if (merged === null) {
    log.info('Compte déconnecté pendant la vérification : rien enregistré');
    return { ...none, skipped: 'not-connected' };
  }
  const found = merged.store.records.filter((record) => record.firstSeenAt === now && record.state === 'new').length;
  if (merged.toNotify.length === 0 || !settings.sequelNotifications) return { ...none, found, skipped: null };
  if (await notificationsBlocked()) return { ...none, found, skipped: 'blocked' };
  try {
    return { found, notified: await notify(merged.toNotify, now), skipped: null, error: null };
  } catch (error) {
    // L'enregistrement reste « nouveau » : visible dans le panneau, jamais renotifié
    log.warn('Notification de suite non affichée :', error);
    return { found, notified: 0, skipped: null, error: describeError(error) };
  }
}

/**
 * Vérifie les suites (au plus une fois par 24 h sauf `force`). Ne lève jamais ; le résumé est aussi enregistré sous
 * `sequels:lastResult`.
 */
export async function checkSequels(now: number = Date.now(), force = false): Promise<SequelCheckResult> {
  let result: SequelCheckResult;
  try {
    result = { checkedAt: now, ...(await run(now, force)) };
  } catch (error) {
    log.error('Vérification des suites impossible :', error);
    result = { checkedAt: now, found: 0, notified: 0, skipped: null, error: describeError(error) };
  }
  try {
    await chrome.storage.local.set({ [STORAGE_KEYS.sequelsLastResult]: result });
  } catch (error) {
    log.error('Enregistrement du résumé impossible :', error);
  }
  return result;
}
