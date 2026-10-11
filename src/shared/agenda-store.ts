import { getLocale } from '../i18n';
import {
  airingWeekKey,
  firstDayOfWeek,
  isAiringWeekCache,
  weekKeysToPrune,
  weekLocaleTag,
  withSeriesOffset,
  type AiringWeekCache,
  type IsoWeekday,
} from './agenda';
import type { SessionEpochs } from './session-epochs';
import { getSettings, saveSettings } from './settings';
import { writeIfSessions } from './storage';
import { withStorageLock } from './storage-lock';

// Accès chrome.storage de l'agenda (panneau latéral et service worker).

/** Langue complète du navigateur (« en-GB »), vide si indisponible */
function browserLanguage(): string {
  try {
    return chrome.i18n?.getUILanguage?.() ?? (typeof navigator !== 'undefined' ? navigator.language : '');
  } catch {
    return '';
  }
}

/** Premier jour de la semaine selon la langue de l'interface (même calcul côté panneau et service worker) */
export function agendaFirstDay(): IsoWeekday {
  return firstDayOfWeek(weekLocaleTag(getLocale(), browserLanguage()));
}

export async function readWeekCache(weekStart: string): Promise<AiringWeekCache | null> {
  const key = airingWeekKey(weekStart);
  const stored = await chrome.storage.local.get(key);
  const value: unknown = stored[key];
  return isAiringWeekCache(value) && value.weekStart === weekStart ? value : null;
}

/**
 * Enregistre la semaine si les sessions `epochs` (relevées avant la lecture de la liste et du calendrier) sont
 * toujours ouvertes (DATA-05, ALRT-05), puis supprime les semaines trop anciennes ou trop lointaines. Retourne false
 * si la semaine, celle d'un compte déconnecté entre-temps, n'a pas été enregistrée.
 */
export async function writeWeekCache(cache: AiringWeekCache, epochs: SessionEpochs, now: number = Date.now()): Promise<boolean> {
  if (!(await writeIfSessions(epochs, { [airingWeekKey(cache.weekStart)]: cache }))) return false;
  const all = await chrome.storage.local.get(null);
  const stale = weekKeysToPrune(Object.keys(all), now);
  if (stale.length > 0) await chrome.storage.local.remove(stale);
  return true;
}

/** « Ajuster l'heure » : délai propre à une série (null = retour au délai de la plateforme) */
export function saveSeriesOffset(mediaId: number, offset: number | null): Promise<void> {
  return withStorageLock(async () => {
    const settings = await getSettings();
    await saveSettings(withSeriesOffset(settings, mediaId, offset));
  });
}
