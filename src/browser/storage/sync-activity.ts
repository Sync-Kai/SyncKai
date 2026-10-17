import { isRecord } from '../../shared/guards';
import { SYNC_ACTIVITY_KEY } from '../../protocol/storage-keys';
import { createLogger } from '../logger';

// « Synchro… » de la barre d'état : signal posé par le service worker dans chrome.storage.session pendant les écritures
// d'une synchro (writeToServices), retiré après. Jamais dans local : aucune écriture persistante de plus par synchro, et
// rien ne survit à la fermeture du navigateur. Borné dans le temps par les pages (SYNC_ACTIVITY_MAX_MS de
// ui/status-bar-model.ts) : un service worker arrêté pendant l'écriture ne laisse pas « Synchro… » affiché.
// Jamais bloquant : une erreur de stockage n'empêche ni ne fait échouer la synchro.

const log = createLogger('sync-activity');

export interface SyncActivity {
  startedAt: number;
}

export function isSyncActivity(value: unknown): value is SyncActivity {
  return isRecord(value) && typeof value.startedAt === 'number' && Number.isFinite(value.startedAt);
}

/** Début de la synchro en cours (ms), null sans synchro ou valeur illisible */
export async function syncStartedAt(): Promise<number | null> {
  const value: unknown = (await chrome.storage.session.get(SYNC_ACTIVITY_KEY))[SYNC_ACTIVITY_KEY];
  return isSyncActivity(value) ? value.startedAt : null;
}

/**
 * `work` encadré par le signal. À la fin, retiré seulement s'il est toujours le sien : une synchro lancée entre-temps
 * garde le sien (deux synchros en parallèle : la première finie n'efface pas « Synchro… » de la seconde)
 */
export async function withSyncActivity<T>(work: () => Promise<T>, now: number = Date.now()): Promise<T> {
  try {
    await chrome.storage.session.set({ [SYNC_ACTIVITY_KEY]: { startedAt: now } satisfies SyncActivity });
  } catch (error: unknown) {
    log.debug('Signal « Synchro… » non posé :', error);
  }
  try {
    return await work();
  } finally {
    try {
      if ((await syncStartedAt()) === now) await chrome.storage.session.remove(SYNC_ACTIVITY_KEY);
    } catch (error: unknown) {
      log.debug('Signal « Synchro… » non retiré :', error);
    }
  }
}
