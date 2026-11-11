import { formatList, getLocale, t, tp } from '../../i18n';
import { STORAGE_KEYS } from '../../protocol/storage-keys';
import { connectedServices } from '../../browser/airing-alarm';
import { createLogger } from '../../browser/logger';
import { getSettings } from '../../browser/storage/settings-access';
import { getOpenSessions, sessionsStillOpen, writeIfSessions } from '../../browser/storage/sessions';
import { withStorageLock } from '../../browser/storage/lock';
import { formatSequelDate } from '../../shared/sequel-date';
import type { TrackerId } from '../../shared/tracker.types';
import type { SessionEpochs } from '../../shared/session-epochs';
import { EMPTY_SEQUEL_STORE, isSequelCheckResult, isSequelStore, mergeSequelPass, noMalEntry, sequelCandidates, type SequelCheckResult, type SequelSnapshot, type SequelStore } from '../../shared/sequels';
import { notificationsBlocked } from '../../browser/notifications';
import { fetchSequelRelations, readSourceSeries } from './fetch';

// Vérification quotidienne des suites, lancée par l'alarme horaire des alertes (airing.ts) : listes complètes des
// services connectés, relations AniList, fusion dans `sequels:state`, notification des suites repérées sur un service
// déjà amorcé. La première passe d'un service enregistre sans notifier.

export const SEQUEL_CHECK_INTERVAL_MS = 24 * 3_600_000;
/** Attente avant de relancer une passe en échec (alarme horaire) : une panne longue ne relit pas la liste AniList chaque heure */
export const SEQUEL_FAILURE_BACKOFF_MS = 6 * 3_600_000;
export const SEQUEL_NOTIFICATION_PREFIX = 'synckai-sequel:';

const log = createLogger('sequels');

function describeError(error: unknown): string {
  const message = error instanceof Error && error.message ? error.message : t('airing.unknownError');
  return message.length > 160 ? `${message.slice(0, 157)}…` : message;
}

export async function readSequelStore(): Promise<SequelStore> {
  const stored = await chrome.storage.local.get(STORAGE_KEYS.sequelsState);
  const value: unknown = stored[STORAGE_KEYS.sequelsState];
  return isSequelStore(value) ? value : EMPTY_SEQUEL_STORE;
}

/** Une notification pour une suite (boutons : ajouter, ouvrir), une seule groupée pour plusieurs. Retourne le nombre annoncé ; lève si refusée. */
async function notify(sequels: readonly SequelSnapshot[], now: number, services: readonly TrackerId[]): Promise<number> {
  const iconUrl = chrome.runtime.getURL('icons/icon-128.png');
  const [first] = sequels;
  if (first === undefined) return 0;
  // Firefox ne gère pas les boutons de notification : le clic ouvre déjà la suite
  if (sequels.length === 1) {
    // MAL seul et sans idMal : « + À regarder » échouerait toujours, aucun bouton (le clic sur le corps ouvre la fiche)
    const buttons = noMalEntry(services, first.idMal) ? [] : [{ title: t('sequel.add') }, { title: t('sequel.notification.openEntry') }];
    await chrome.notifications.create(`${SEQUEL_NOTIFICATION_PREFIX}${first.id}`, {
      type: 'basic',
      iconUrl,
      title: t('sequel.notification.single', { title: first.title }),
      message: t('sequel.notification.message', { date: formatSequelDate(first, getLocale()), source: first.sourceTitle }),
      ...(__SYNCKAI_TARGET__ === 'firefox' || buttons.length === 0 ? {} : { buttons }),
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

async function run(now: number, force: boolean, epochs: SessionEpochs): Promise<Omit<SequelCheckResult, 'checkedAt'>> {
  const none = { found: 0, notified: 0, error: null };
  const settings = await getSettings();
  if (!settings.sequelAlerts) return { ...none, skipped: 'disabled' };
  const services = await connectedServices();
  if (services.length === 0) return { ...none, skipped: 'not-connected' };
  const { lastCheck } = await readSequelStore();
  if (!force && lastCheck !== null && now - lastCheck < SEQUEL_CHECK_INTERVAL_MS) return { ...none, skipped: 'not-due' };
  // Passe en échec (aucun lastCheck posé depuis) : pas de nouvelle lecture des listes complètes avant 6 h, même sur l'alarme horaire
  if (!force) {
    const last = await readLastResult();
    if (last !== null && last.error !== null && (lastCheck === null || lastCheck < last.checkedAt) && now - last.checkedAt >= 0 && now - last.checkedAt < SEQUEL_FAILURE_BACKOFF_MS) return { ...none, skipped: 'not-due' };
  }

  // Toute lecture en échec (liste, relations) lève : la passe est abandonnée entière, aucun service marqué amorcé
  const { sources, inLists } = await readSourceSeries(services);
  const relations = await fetchSequelRelations(sources.map((source) => source.id));
  const candidates = sequelCandidates(
    // Titre de la série source : AniList seulement (les listes MAL ne donnent que des ids)
    sources.map((source) => ({ source: { ...source, title: relations.get(source.id)?.title ?? source.title }, edges: relations.get(source.id)?.edges ?? [] })),
    inLists,
  );

  // Store relu sous verrou (le panneau a pu changer des états), même verrou que la déconnexion
  const merged = await withStorageLock(async () => {
    if (!(await sessionsStillOpen(epochs))) return null;
    const result = mergeSequelPass(await readSequelStore(), candidates, services, now);
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
    return { found, notified: await notify(merged.toNotify, now, services), skipped: null, error: null };
  } catch (error) {
    // L'enregistrement reste « nouveau » : visible dans le panneau, jamais renotifié
    log.warn('Notification de suite non affichée :', error);
    return { found, notified: 0, skipped: null, error: describeError(error) };
  }
}

/** Délai minimal entre deux passes forcées (bouton « Vérifier maintenant », messages répétés) */
export const SEQUEL_FORCE_COOLDOWN_MS = 60_000;

/** Dernier résumé enregistré, null s'il est absent ou illisible */
async function readLastResult(): Promise<SequelCheckResult | null> {
  const stored = await chrome.storage.local.get(STORAGE_KEYS.sequelsLastResult);
  const value: unknown = stored[STORAGE_KEYS.sequelsLastResult];
  return isSequelCheckResult(value) ? value : null;
}

async function pass(now: number, force: boolean): Promise<SequelCheckResult> {
  if (force) {
    // Passe forcée récente d'une vraie vérification réussie : son résumé, sans requête (erreur, blocage, désactivé et non connecté se relisent aussitôt)
    const last = await readLastResult();
    if (last !== null && last.error === null && last.skipped !== 'disabled' && last.skipped !== 'not-connected' && last.skipped !== 'blocked' && now - last.checkedAt >= 0 && now - last.checkedAt < SEQUEL_FORCE_COOLDOWN_MS) return last;
  }
  // Sessions relevées avant toute requête : le store et le résumé sont des données du compte, jamais recréées après une déconnexion
  const epochs = await getOpenSessions();
  let result: SequelCheckResult;
  try {
    result = { checkedAt: now, ...(await run(now, force, epochs)) };
  } catch (error) {
    log.error('Vérification des suites impossible :', error);
    result = { checkedAt: now, found: 0, notified: 0, skipped: null, error: describeError(error) };
  }
  // `not-due` (alarme horaire) n'est pas un résultat : il écraserait le dernier résumé réel (suites trouvées, erreur, blocage)
  if (result.skipped === 'not-due') return result;
  // Sans session ouverte, rien à écrire ; sinon écriture sous le verrou de la déconnexion
  if (Object.keys(epochs).length === 0) return result;
  try {
    await writeIfSessions(epochs, { [STORAGE_KEYS.sequelsLastResult]: result });
  } catch (error) {
    log.error('Enregistrement du résumé impossible :', error);
  }
  return result;
}

/** Chrome arrête un worker sans appel d'API ni événement depuis 30 s ; les attentes du budget AniList durent jusqu'à 60 s */
const KEEP_ALIVE_MS = 20_000;

/** Appel d'API toutes les 20 s pendant toute la passe (sans écouteur ni écriture de stockage) */
async function withKeepAlive<T>(task: () => Promise<T>): Promise<T> {
  const ping = (): void => {
    void chrome.runtime.getPlatformInfo().catch(() => undefined);
  };
  ping();
  const timer = setInterval(ping, KEEP_ALIVE_MS);
  try {
    return await task();
  } finally {
    clearInterval(timer);
  }
}

let inFlight: Promise<SequelCheckResult> | null = null;

/**
 * Vérifie les suites (au plus une fois par 24 h sauf `force`, et une passe forcée par minute). Ne lève jamais ; le
 * résumé est aussi enregistré sous `sequels:lastResult` (sauf `not-due`). Un appel pendant une passe en cours rend la même promesse.
 */
export function checkSequels(now: number = Date.now(), force = false): Promise<SequelCheckResult> {
  inFlight ??= withKeepAlive(() => pass(now, force)).finally(() => {
    inFlight = null;
  });
  return inFlight;
}
