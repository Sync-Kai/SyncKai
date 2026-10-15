import type { TrackerId } from '../shared/tracker.types';
import { createLogger } from './logger';
import { trace } from './debug-trace-client';
import { getSettings } from './storage/settings-access';
import { hasMalToken, hasValidAniListToken } from './storage/tokens';

// Alarme horaire des alertes de sortie (PERF-17, 2026-10-15) : créée ou supprimée là où ses conditions changent, par
// le contexte qui les change (réglages et sauvegarde depuis une page, connexion dans le service worker, déconnexion
// des deux côtés), et revérifiée à chaque déclenchement. Plus d'écouteur storage.onChanged dans le service worker : il
// le réveillait à chaque écriture locale. chrome.alarms est ouvert aux pages de l'extension ; l'évènement reste traité
// par le service worker (alarms.onAlarm de background.ts).

export const AIRING_ALARM = 'synckai:airing';
/** Première vérification une minute après la création, puis toutes les heures */
const AIRING_ALARM_SCHEDULE: chrome.alarms.AlarmCreateInfo = { delayInMinutes: 1, periodInMinutes: 60 };

const log = createLogger('airing');

/** Services connectés : token AniList valide, token MAL présent (renouvelé à la demande) ; sans déchiffrement */
export async function connectedServices(): Promise<TrackerId[]> {
  const [anilist, mal] = await Promise.all([hasValidAniListToken(), hasMalToken()]);
  const services: TrackerId[] = [];
  if (anilist) services.push('anilist');
  if (mal) services.push('mal');
  return services;
}

/** Crée l'alarme horaire si les alertes sont actives et un service connecté (sans repousser une alarme existante), sinon la supprime. Ne lève jamais. */
export async function ensureAiringAlarm(): Promise<void> {
  try {
    const settings = await getSettings();
    if (!settings.airingAlerts || (await connectedServices()).length === 0) {
      const cleared = await chrome.alarms.clear(AIRING_ALARM);
      // Trace de débogage (builds de développement seulement)
      if (__SYNCKAI_DEBUG__) trace('alarm', 'airing', { action: cleared ? 'cleared' : 'absent', alerts: settings.airingAlerts });
      return;
    }
    const existing = await chrome.alarms.get(AIRING_ALARM);
    if (!existing) await chrome.alarms.create(AIRING_ALARM, AIRING_ALARM_SCHEDULE);
    if (__SYNCKAI_DEBUG__) trace('alarm', 'airing', { action: existing ? 'kept' : 'created', nextAt: existing?.scheduledTime ?? null });
  } catch (error) {
    log.error('Alarme impossible à configurer :', error);
  }
}
