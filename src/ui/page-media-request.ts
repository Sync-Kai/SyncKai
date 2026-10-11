import { isPageMediaResponse, type ContentMessage, type PageMediaResponse } from '../shared/content-messages';

// Lecture de la page d'un onglet (GET_PAGE_MEDIA au script de contenu) : une seule implémentation et les mêmes délais
// pour le popup (carte « Sur cette page »), le panneau (« En lecture ») et sa détection d'onglet (presence.ts).
// Délais retenus (ARCH-05) : ceux du panneau, éprouvés sur les navigations SPA. Le script de contenu répond de façon
// synchrone (lecture du DOM) : 800 ms ne sont atteints que par un script orphelin ou une page bloquée, et les
// nouvelles tentatives couvrent une page encore en cours de rendu (l'ancien délai unique de 1 500 ms du popup n'y suffisait pas).

/** Délai de réponse du script de contenu à une demande */
export const PAGE_MEDIA_TIMEOUT_MS = 800;
/** Attentes avant chaque demande : page pas encore lisible (navigation SPA, chargement) */
export const PAGE_MEDIA_RETRY_DELAYS_MS: readonly number[] = [0, 700, 1_800];

/**
 * Demande au script de contenu SyncKai la série / l'épisode affiché (GET_PAGE_MEDIA).
 * `unreachable` : pas de script de contenu (autre site, onglet ouvert avant l'installation) ou pas de réponse à temps.
 */
export async function requestPageMedia(tabId: number, timeoutMs: number = PAGE_MEDIA_TIMEOUT_MS): Promise<PageMediaResponse | 'unreachable'> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const message: ContentMessage = { type: 'GET_PAGE_MEDIA' };
    const timeout = new Promise<'timeout'>((resolve) => {
      timer = setTimeout(() => resolve('timeout'), timeoutMs);
    });
    const response: unknown = await Promise.race([chrome.tabs.sendMessage(tabId, message), timeout]);
    return response !== 'timeout' && isPageMediaResponse(response) ? response : 'unreachable';
  } catch {
    // « Receiving end does not exist » : pas de script de contenu dans cet onglet
    return 'unreachable';
  } finally {
    clearTimeout(timer);
  }
}
