// Port d'une page d'import (Réglages › Importer un historique) vers le script de contenu de l'onglet de la plateforme :
// lecture de l'historique sur demande explicite, progression envoyée sur le port, abandon dès que la page ferme le port.
// Rien ne tourne sinon. Commun aux imports Crunchyroll (cr-history-port.ts) et ADN (adn-history.ts).

/** Lecture lancée par la demande : `post` n'envoie plus rien une fois le port fermé (signal abandonné) */
export type HistoryRead<M> = (signal: AbortSignal, post: (message: M) => void) => Promise<void>;

export function listenHistoryPort<M>(name: string, isRequest: (message: unknown) => boolean, read: HistoryRead<M>): void {
  chrome.runtime.onConnect.addListener((port) => {
    if (port.name !== name || !isExtensionPage(port.sender)) return;
    const controller = new AbortController();
    let started = false;
    const post = (message: M): void => {
      if (!controller.signal.aborted) port.postMessage(message);
    };

    const onMessage = (message: unknown): void => {
      if (started || !isRequest(message)) return;
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
export function abortableSleep(ms: number, signal: AbortSignal): Promise<void> {
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
