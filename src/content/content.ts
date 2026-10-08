import { initI18n } from '../i18n';
import { isContentMessage, type PageMediaResponse } from '../shared/content-messages';
import type { StreamingAdapter } from './adapters/adapter';
import { adnAdapter } from './adapters/adn';
import { crunchyrollAdapter } from './adapters/crunchyroll';
import { isLivePanelMessage, LIVE_PORT_NAME, type LiveContentMessage } from '../shared/live.types';
import { createLogger } from '../shared/logger';
import { sendMessage } from '../shared/messages';
import { createLiveStream, type LiveStream } from './lib/live-stream';
import { detectPageMedia } from './lib/page-media';
import { watchUrl } from './lib/url-watcher';
import { listenCrHistoryPorts } from './lib/cr-history-port';
import { startWatchSession, type WatchSession } from './lib/watch-session';

/** Adapters disponibles : ajouter ici les futures plateformes (ADN…) */
const ADAPTERS: readonly StreamingAdapter[] = [crunchyrollAdapter, adnAdapter];

const log = createLogger('content');

function main(): void {
  const adapter = ADAPTERS.find((a) => a.supportsHost(location.hostname));
  if (!adapter) {
    log.info(`Aucun adapter pour ${location.hostname}`);
    return;
  }
  log.info(`Adapter "${adapter.platform}" chargé (build ${__SYNCKAI_BUILD__})`);

  let session: WatchSession | null = null;
  // Progression en direct vers le panneau latéral : rien ne tourne tant qu'aucun panneau n'est connecté
  const live = createLiveStream(() => session?.snapshot() ?? null);

  // Crunchyroll est une SPA : chaque changement d'URL peut démarrer ou terminer une session
  const handleUrl = (url: URL): void => {
    const episodeId = adapter.getEpisodeId(url);
    if (episodeId !== null && episodeId === session?.episodeId) return; // Même épisode (query/hash modifiés)

    session?.destroy();
    session = episodeId ? startWatchSession(adapter, episodeId) : null;
    session?.onStateChange((state, outcome) => live.notifySync(state, outcome));
    live.refresh();
  };

  // Un seul écouteur pour toute la vie de la page, routé vers la session courante
  chrome.runtime.onMessage.addListener((message: unknown, sender, sendResponse: (response?: PageMediaResponse) => void): void => {
    if (sender.id !== chrome.runtime.id || !isContentMessage(message)) return;
    if (message.type === 'GET_PAGE_MEDIA') {
      // Popup : série ou épisode affiché (lecture synchrone du DOM, aucune donnée de compte)
      sendResponse(detectPageMedia(adapter, new URL(location.href)));
      return;
    }
    sendResponse(); // Accusé de réception : le service worker n'attend rien de plus
    if (!session) {
      log.info('Raccourci « valider l’épisode » ignoré : aucune lecture en cours');
      return;
    }
    session.forceComplete();
  });

  listenLivePorts(live);
  if (adapter.platform === 'crunchyroll') listenCrHistoryPorts();
  handleUrl(new URL(location.href));
  watchUrl(handleUrl);
  announcePanel();
  // Retour arrière depuis le cache (bfcache) : le script ne redémarre pas, mais le panneau a pu être retiré
  window.addEventListener('pageshow', (event) => {
    if (event.persisted) announcePanel();
  });
}

/**
 * Ports du panneau latéral (chrome.tabs.connect depuis la page de l'extension, sans service worker).
 * Chaque port reçoit l'état complet à la connexion ; l'intervalle s'arrête quand le dernier se ferme.
 */
function listenLivePorts(live: LiveStream): void {
  chrome.runtime.onConnect.addListener((port) => {
    // Seule une page de cette extension (panneau) peut ouvrir ce port
    if (port.name !== LIVE_PORT_NAME || port.sender?.id !== chrome.runtime.id) return;
    const peer = live.addPeer((message: LiveContentMessage) => port.postMessage(message));
    const onMessage = (message: unknown): void => {
      if (isLivePanelMessage(message)) peer.resend();
    };
    port.onMessage.addListener(onMessage);
    port.onDisconnect.addListener(() => {
      port.onMessage.removeListener(onMessage);
      peer.remove();
    });
  });
}

/**
 * Chrome : panneau latéral activé pour cet onglet (désactivé partout ailleurs). Un seul message par
 * chargement de page : l'option reste valable pendant la navigation SPA de Crunchyroll.
 */
function announcePanel(): void {
  if (__SYNCKAI_TARGET__ !== 'chrome' || window !== window.top) return;
  sendMessage('PANEL_AVAILABLE', null).catch((error: unknown) => log.debug('Panneau non signalé :', error));
}

// Langue des toasts lue avant le démarrage (puis suivie via storage.onChanged)
void initI18n().then(main);
