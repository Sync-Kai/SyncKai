import { createLogger } from '../browser/logger';
import { DEV_BUILD_FILE, devBuildChanged } from '../build/dev-reload';

// Builds de développement seulement (appelé sous `if (__SYNCKAI_DEBUG__)` dans background.ts, absent des bundles publiés) :
// le service worker se recharge de lui-même après un `npm run build:dev`, sans passer par chrome://extensions
// (src/build/dev-reload.ts). L'alarme réveille le worker toutes les 30 s, en développement uniquement.

// Logger créé à l'usage : un appel de premier niveau resterait dans les bundles publiés (effet de bord)
const log = (): ReturnType<typeof createLogger> => createLogger('dev-reload');

export const DEV_RELOAD_ALARM = 'debug:dev-reload';
const PERIOD_MINUTES = 0.5;

/** Alarme périodique créée si absente (une alarme existante garde sa période et sa prochaine échéance) */
export async function ensureDevReloadAlarm(): Promise<void> {
  try {
    if (await chrome.alarms.get(DEV_RELOAD_ALARM)) return;
    await chrome.alarms.create(DEV_RELOAD_ALARM, { periodInMinutes: PERIOD_MINUTES });
  } catch (error: unknown) {
    log().warn('Alarme de rechargement non créée :', error);
  }
}

/** Fichier témoin relu sur le disque ; nouveau build → rechargement de l'extension. Fichier absent (build en cours) : rien */
export async function reloadIfRebuilt(): Promise<void> {
  let body: string;
  try {
    const response = await fetch(chrome.runtime.getURL(DEV_BUILD_FILE), { cache: 'no-store' });
    if (!response.ok) return;
    body = await response.text();
  } catch {
    return;
  }
  if (!devBuildChanged(__SYNCKAI_BUILD__, body)) return;
  log().info('Nouveau build de développement : rechargement de l’extension');
  chrome.runtime.reload();
}
