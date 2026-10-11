import { initI18n, t } from '../i18n';
import { isContentMessage, type PageMediaResponse } from '../shared/content-messages';
import { isLivePanelMessage, LIVE_PORT_NAME, type LiveContentMessage } from '../shared/live.types';
import { createLogger } from '../shared/logger';
import { sendMessage } from '../shared/messages';
import type { StreamingAdapter } from './adapters/adapter';
import { isExtensionContextInvalidated } from './lib/extension-context';
import { createLiveStream, type LiveStream } from './lib/live-stream';
import { detectPageMedia } from './lib/page-media';
import { watchUrl } from './lib/url-watcher';
import { startWatchSession, type WatchSession } from './lib/watch-session';
import { NOTICE_TOAST_MS } from './ui/sync-toast';
import { showToast } from './ui/toast';

const log = createLogger('content');

/**
 * Émis sur `document` au démarrage d'une instance : les instances orphelines de la page (extension rechargée
 * ou mise à jour, script réinjecté par le service worker) se retirent. Une instance valide l'ignore, même si
 * la page l'émet elle-même.
 */
const CONTENT_STARTED_EVENT = 'synckai:content-started';

export interface StartContentOptions {
  /** Écouteurs propres à une plateforme, posés une fois l'adapter choisi (ex : historique Crunchyroll) */
  onAdapter?: (adapter: StreamingAdapter) => void;
}

/**
 * Point d'entrée commun des scripts de contenu : choisit l'adapter du site et suit les pages de lecture.
 * Un bundle par groupe de plateformes (content.ts : Crunchyroll / ADN ; netflix/content-netflix.iife.ts : Netflix).
 */
export function startContent(adapters: readonly StreamingAdapter[], options: StartContentOptions = {}): void {
  // Langue des toasts lue avant le démarrage, puis relue à chaque lecture (watch-session) : ni `<html lang>`
  // du site réécrit (ARCH-01, l'import Crunchyroll le lit), ni écouteur de storage.onChanged (PERF-03)
  void initI18n({ setDocumentLang: false, follow: false }).then(() => main(adapters, options));
}

function main(adapters: readonly StreamingAdapter[], options: StartContentOptions): void {
  const adapter = adapters.find((a) => a.supportsHost(location.hostname));
  if (!adapter) {
    log.info(`Aucun adapter pour ${location.hostname}`);
    return;
  }
  log.info(`Adapter "${adapter.platform}" chargé (build ${__SYNCKAI_BUILD__})`);

  // Écouteurs DOM de la page : retirés si cette instance devient orpheline et qu'une nouvelle prend le relais
  const page = new AbortController();
  document.dispatchEvent(new Event(CONTENT_STARTED_EVENT));

  let session: WatchSession | null = null;
  // Progression en direct vers le panneau latéral : rien ne tourne tant qu'aucun panneau n'est connecté
  const live = createLiveStream(() => session?.snapshot() ?? null);

  // Sites en SPA : chaque changement d'URL peut démarrer ou terminer une session
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
      showToast({ tone: 'info', title: t('content.shortcut.noPlayback.title'), message: t('content.shortcut.noPlayback.message') }, { autoHideMs: NOTICE_TOAST_MS });
      return;
    }
    session.forceComplete();
  });

  listenLivePorts(live);
  options.onAdapter?.(adapter);
  handleUrl(new URL(location.href));
  const stopWatchingUrl = watchUrl(handleUrl);
  page.signal.addEventListener('abort', stopWatchingUrl, { once: true });
  announcePanel();
  // Retour arrière depuis le cache (bfcache) : le script ne redémarre pas, mais le panneau a pu être retiré
  window.addEventListener(
    'pageshow',
    (event) => {
      if (event.persisted) announcePanel();
    },
    { signal: page.signal },
  );
  // Nouvelle instance après une mise à jour de l'extension : celle-ci, orpheline, s'arrête sans rien afficher
  document.addEventListener(
    CONTENT_STARTED_EVENT,
    () => {
      if (!isExtensionContextInvalidated()) return;
      log.info('Extension rechargée : instance orpheline arrêtée, la nouvelle prend le relais');
      session?.destroy();
      session = null;
      page.abort();
    },
    { signal: page.signal },
  );
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
 * chargement de page : l'option reste valable pendant la navigation SPA du site.
 */
function announcePanel(): void {
  if (__SYNCKAI_TARGET__ !== 'chrome' || window !== window.top) return;
  sendMessage('PANEL_AVAILABLE', null).catch((error: unknown) => log.debug('Panneau non signalé :', error));
}
