import { STORAGE_KEYS } from '../protocol/storage-keys';
import { isSequelCheckResult, isSequelStore, nextSequelCheckAt, SEQUEL_CHECK_INTERVAL_MS, SEQUEL_FAILURE_BACKOFF_MS } from '../shared/sequels';
import type { TrackerId } from '../shared/tracker.types';
import { createLogger } from './logger';
import { trace } from './debug-trace-client';
import { getSettings } from './storage/settings-access';
import { hasMalToken, hasValidAniListToken } from './storage/tokens';

// Alarme horaire des alertes de sortie (PERF-17, 2026-10-15) : créée ou supprimée là où ses conditions changent, par
// le contexte qui les change (réglages et sauvegarde depuis une page, connexion dans le service worker, déconnexion
// des deux côtés), et revérifiée à chaque déclenchement. Plus d'écouteur storage.onChanged dans le service worker : il
// le réveillait à chaque écriture locale. chrome.alarms est ouvert aux pages de l'extension ; l'évènement reste traité
// par le service worker (alarms.onAlarm de background.ts). Les alertes de suite ont leur alarme unique (PERF-04, 2026-11-13) :
// l'alarme horaire n'existe qu'avec les alertes de sortie.

export const AIRING_ALARM = 'synckai:airing';
/** Première vérification une minute après la création, puis toutes les heures */
const AIRING_ALARM_SCHEDULE: chrome.alarms.AlarmCreateInfo = { delayInMinutes: 1, periodInMinutes: 60 };

/** Passe quotidienne des suites (alertes de suite), reprogrammée après chaque passe (sequels/check.ts) */
export const SEQUEL_ALARM = 'synckai:sequels';
/** Filet : passe interrompue (worker arrêté avant la reprogrammation) relancée 6 h plus tard, comme un échec */
const SEQUEL_ALARM_PERIOD_MINUTES = SEQUEL_FAILURE_BACKOFF_MS / 60_000;
const MIN_DELAY_MS = 60_000;

const log = createLogger('airing');

/** Services connectés : token AniList valide, token MAL présent (renouvelé à la demande) ; sans déchiffrement */
export async function connectedServices(): Promise<TrackerId[]> {
  const [anilist, mal] = await Promise.all([hasValidAniListToken(), hasMalToken()]);
  const services: TrackerId[] = [];
  if (anilist) services.push('anilist');
  if (mal) services.push('mal');
  return services;
}

/** Échéance de l'alarme des suites : lastCheck + 24 h (+ 6 h après un échec), au plus tôt dans une minute, au plus tard dans 24 h */
async function sequelAlarmTime(now: number): Promise<number> {
  const stored = await chrome.storage.local.get([STORAGE_KEYS.sequelsState, STORAGE_KEYS.sequelsLastResult]);
  const state: unknown = stored[STORAGE_KEYS.sequelsState];
  const last: unknown = stored[STORAGE_KEYS.sequelsLastResult];
  const due = nextSequelCheckAt(isSequelStore(state) ? state.lastCheck : null, isSequelCheckResult(last) ? last : null) ?? now;
  return Math.max(now + MIN_DELAY_MS, Math.min(due, now + SEQUEL_CHECK_INTERVAL_MS));
}

/**
 * Un service connecté : alarme horaire si les alertes de sortie sont actives (sans repousser une alarme existante),
 * alarme des suites reprogrammée à sa prochaine échéance si les alertes de suite le sont ; sinon chacune est supprimée.
 * Ne lève jamais.
 */
export async function ensureAiringAlarm(): Promise<void> {
  try {
    const settings = await getSettings();
    const connected = (settings.airingAlerts || settings.sequelAlerts) && (await connectedServices()).length > 0;
    if (connected && settings.airingAlerts) {
      const existing = await chrome.alarms.get(AIRING_ALARM);
      if (!existing) await chrome.alarms.create(AIRING_ALARM, AIRING_ALARM_SCHEDULE);
      if (__SYNCKAI_DEBUG__) trace('alarm', 'airing', { action: existing ? 'kept' : 'created', nextAt: existing?.scheduledTime ?? null });
    } else {
      const cleared = await chrome.alarms.clear(AIRING_ALARM);
      // Trace de débogage (builds de développement seulement)
      if (__SYNCKAI_DEBUG__) trace('alarm', 'airing', { action: cleared ? 'cleared' : 'absent', alerts: settings.airingAlerts, connected });
    }
    if (connected && settings.sequelAlerts) {
      const when = await sequelAlarmTime(Date.now());
      await chrome.alarms.create(SEQUEL_ALARM, { when, periodInMinutes: SEQUEL_ALARM_PERIOD_MINUTES });
      if (__SYNCKAI_DEBUG__) trace('alarm', 'sequels', { action: 'scheduled', nextAt: when });
    } else {
      const cleared = await chrome.alarms.clear(SEQUEL_ALARM);
      if (__SYNCKAI_DEBUG__) trace('alarm', 'sequels', { action: cleared ? 'cleared' : 'absent', sequels: settings.sequelAlerts, connected });
    }
  } catch (error) {
    log.error('Alarme impossible à configurer :', error);
  }
}
