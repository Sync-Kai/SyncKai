import { CR_HISTORY_PORT_NAME, isCrHistoryRequest, type CrHistoryPortMessage } from '../../shared/content-messages';
import { createLogger } from '../../shared/logger';
import { getSettings } from '../../shared/settings';
import { CrHistoryError, pageFetch, pageLocale, readCrunchyrollHistory } from './crunchyroll-history';

const log = createLogger('cr-history');

/** Seul hôte où l'API est appelée en même origine (cookies de session du site) */
const HISTORY_HOST = 'www.crunchyroll.com';

/**
 * Port de la page d'import (Réglages › Importer depuis Crunchyroll) : lecture de l'historique sur demande
 * explicite, progression envoyée sur le port, abandon dès que la page ferme le port. Rien ne tourne sinon.
 */
export function listenCrHistoryPorts(): void {
  chrome.runtime.onConnect.addListener((port) => {
    if (port.name !== CR_HISTORY_PORT_NAME || !isExtensionPage(port.sender)) return;
    const controller = new AbortController();
    let started = false;
    const post = (message: CrHistoryPortMessage): void => {
      if (!controller.signal.aborted) port.postMessage(message);
    };

    const onMessage = (message: unknown): void => {
      if (started || !isCrHistoryRequest(message)) return;
      started = true;
      void read(controller.signal, post);
    };
    port.onMessage.addListener(onMessage);
    port.onDisconnect.addListener(() => {
      controller.abort();
      port.onMessage.removeListener(onMessage);
    });
  });
}

/** Port ouvert par une page de cette extension (jamais par un site ni une autre extension) */
function isExtensionPage(sender: chrome.runtime.MessageSender | undefined): boolean {
  if (sender?.id !== chrome.runtime.id) return false;
  return sender.url === undefined || sender.url.startsWith(chrome.runtime.getURL(''));
}

/** Attente interrompue dès la fermeture du port (une attente avant nouvel essai peut durer jusqu'à une minute) */
function abortableSleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const done = (): void => {
      clearTimeout(timer);
      signal.removeEventListener('abort', done);
      resolve();
    };
    const timer = setTimeout(done, ms);
    signal.addEventListener('abort', done, { once: true });
  });
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
    log.info(`Historique lu : ${result.stats.items} éléments, ${result.seasons.length} saisons${result.stats.partial ? ' (partiel)' : ''}`);
    post({ type: 'done', result });
  } catch (error: unknown) {
    if (signal.aborted) return;
    const code = error instanceof CrHistoryError ? error.code : 'unavailable';
    // Jamais le jeton ni les réponses : le code et le message de l'erreur suffisent
    log.warn(`Lecture de l’historique impossible (${code}) :`, error instanceof Error ? error.message : String(error));
    post({ type: 'error', code });
  }
}
