import { CR_HISTORY_PORT_NAME, isCrHistoryRequest, type CrHistoryPortMessage } from '../../protocol/content-messages';
import { createLogger } from '../../shared/logger';
import { getSettings } from '../../shared/settings';
import { CrHistoryError, pageLocale, readCrunchyrollHistory } from './history';
import { abortableSleep, listenHistoryPort } from '../lib/history-port';
import { pageFetch } from '../lib/page-fetch';

const log = createLogger('cr-history');

/** Seul hôte où l'API est appelée en même origine (cookies de session du site) */
const HISTORY_HOST = 'www.crunchyroll.com';

/** Port de la page d'import (Réglages › Importer un historique › Crunchyroll), voir history-port.ts */
export function listenCrHistoryPorts(): void {
  listenHistoryPort(CR_HISTORY_PORT_NAME, isCrHistoryRequest, read);
}

async function read(signal: AbortSignal, post: (message: CrHistoryPortMessage) => void): Promise<void> {
  if (location.hostname !== HISTORY_HOST) {
    post({ type: 'error', code: 'wrong-page' });
    return;
  }
  try {
    const { completionPercentage } = await getSettings();
    const result = await readCrunchyrollHistory(
      {
        fetch: pageFetch(),
        origin: location.origin,
        locale: pageLocale(document.documentElement.lang),
        deviceId: crypto.randomUUID(),
        sleep: (ms) => abortableSleep(ms, signal),
        now: () => Date.now(),
        signal,
      },
      completionPercentage,
      (progress) => post({ type: 'progress', ...progress }),
    );
    if (__SYNCKAI_DEBUG__) log.info(`Historique lu : ${result.stats.items} éléments, ${result.seasons.length} saisons${result.stats.partial ? ' (partiel)' : ''}`);
    post({ type: 'done', result });
  } catch (error: unknown) {
    if (signal.aborted) return;
    const code = error instanceof CrHistoryError ? error.code : 'unavailable';
    // Jamais le jeton ni les réponses : le code et le message de l'erreur suffisent
    log.warn(`Lecture de l’historique impossible (${code}) :`, error instanceof Error ? error.message : String(error));
    post({ type: 'error', code });
  }
}
