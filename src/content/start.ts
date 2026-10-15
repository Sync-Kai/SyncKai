import { ensureContentLanguage, t } from '../i18n/content';
import { isContentMessage, type PageMediaResponse } from '../protocol/content-messages';
import { isLivePanelMessage, LIVE_PORT_NAME, type LiveContentMessage } from '../protocol/live';
import { createLogger } from '../browser/logger';
import { trace } from '../browser/debug-trace-client';
import { pageMediaTraceData } from '../shared/debug-trace';
import type { StreamingAdapter } from './lib/adapter';
import { isExtensionContextInvalidated } from './lib/extension-context';
import { createLiveStream, type LiveStream } from './lib/live-stream';
import { detectPageMedia, loadPageMedia, needsAsyncPageMedia } from './lib/page-media';
import { createSeasonWatch } from './lib/season-watch';
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
 * Un bundle par plateforme (crunchyroll/content-crunchyroll.iife.ts, adn/content-adn.iife.ts, netflix/content-netflix.iife.ts…).
 */
export function startContent(adapters: readonly StreamingAdapter[], options: StartContentOptions = {}): void {
  // Aucune langue lue au démarrage (PERF-12) : chaque texte affiché l'assure d'abord (ensureContentLanguage, réglage relu
  // à chaque besoin, sans écouteur de storage.onChanged, PERF-03), jamais `<html lang>` du site réécrit (ARCH-01)
  main(adapters, options);
}

function main(adapters: readonly StreamingAdapter[], options: StartContentOptions): void {
  const adapter = adapters.find((a) => a.supportsHost(location.hostname));
  if (!adapter) {
    if (__SYNCKAI_DEBUG__) log.info(`Aucun adapter pour ${location.hostname}`);
    return;
  }
  if (__SYNCKAI_DEBUG__) log.info(`Adapter "${adapter.platform}" chargé (build ${__SYNCKAI_BUILD__})`);

  // Écouteurs DOM de la page : retirés si cette instance devient orpheline et qu'une nouvelle prend le relais
  const page = new AbortController();
  document.dispatchEvent(new Event(CONTENT_STARTED_EVENT));

  let session: WatchSession | null = null;
  // Progression en direct vers le panneau latéral : rien ne tourne tant qu'aucun panneau n'est connecté
  const live = createLiveStream(() => session?.snapshot() ?? null);
  // Saison choisie dans le menu d'une page de série : panneaux prévenus (seulement si l'un d'eux est connecté)
  const seasons = createSeasonWatch(adapter, () => live.notifySeason());
  const followSeasons = (): void => seasons.update(new URL(location.href), live.peerCount);

  // Sites en SPA : chaque changement d'URL peut démarrer ou terminer une session
  const handleUrl = (url: URL): void => {
    const episodeId = adapter.getEpisodeId(url);
    if (episodeId !== null && episodeId === session?.episodeId) return; // Même épisode (query/hash modifiés)

    // Trace de débogage (builds de développement seulement) : navigation SPA, lecture automatique de l'épisode suivant
    if (__SYNCKAI_DEBUG__) trace('page', 'navigation', { from: session?.episodeId ?? null, to: episodeId, page: episodeId ? 'watch' : 'other' }, { platform: adapter.platform });
    session?.destroy();
    session = episodeId ? startWatchSession(adapter, episodeId) : null;
    session?.onStateChange((state, outcome) => live.notifySync(state, outcome));
    live.refresh();
    seasons.update(url, live.peerCount);
  };

  // Un seul écouteur pour toute la vie de la page, routé vers la session courante
  chrome.runtime.onMessage.addListener((message: unknown, sender, sendResponse: (response?: PageMediaResponse) => void): boolean | undefined => {
    if (sender.id !== chrome.runtime.id || !isContentMessage(message)) return undefined;
    if (message.type === 'GET_PAGE_MEDIA') {
      // Popup / panneau : série ou épisode affiché (lecture du DOM ou du cache du pont, aucune donnée de compte)
      const url = new URL(location.href);
      const page = detectPageMedia(adapter, url);
      if (!needsAsyncPageMedia(adapter, url, page)) {
        if (__SYNCKAI_DEBUG__) trace('page', 'page-media', pageMediaTraceData(page), { platform: adapter.platform });
        sendResponse(page);
        return undefined;
      }
      // Page de série Netflix / Disney+ hors cache : réponse asynchrone (canal gardé ouvert par `return true`), bornée
      void loadPageMedia(adapter, url).then((loaded) => {
        // Diagnostic (build de développement seulement : retiré des scripts publiés, budget de taille)
        if (__SYNCKAI_DEBUG__) log.debug(`Page de série : ${loaded ? `« ${loaded.seriesTitle} », saison ${loaded.seasonNumber ?? '?'}` : 'métadonnées absentes à temps'}`);
        if (__SYNCKAI_DEBUG__) trace('page', 'page-media', { ...pageMediaTraceData(loaded), async: true }, { platform: adapter.platform });
        sendResponse(loaded);
      });
      return true;
    }
    sendResponse(); // Accusé de réception : le service worker n'attend rien de plus
    if (!session) {
      if (__SYNCKAI_DEBUG__) log.info('Raccourci « valider l’épisode » ignoré : aucune lecture en cours');
      if (__SYNCKAI_DEBUG__) trace('shortcut', 'decision', { decision: 'no-playback' }, { platform: adapter.platform });
      // Textes calculés une fois la langue assurée (demandée au service worker au premier besoin de la page)
      void ensureContentLanguage().then(() =>
        showToast({ tone: 'info', title: t('content.shortcut.noPlayback.title'), message: t('content.shortcut.noPlayback.message') }, { autoHideMs: NOTICE_TOAST_MS }),
      );
      return undefined;
    }
    session.forceComplete();
    return undefined;
  });

  listenLivePorts(live, followSeasons);
  options.onAdapter?.(adapter);
  handleUrl(new URL(location.href));
  const stopWatchingUrl = watchUrl(handleUrl);
  page.signal.addEventListener('abort', stopWatchingUrl, { once: true });
  // Épisode suivant sans changement d'URL (Prime Video) : même traitement qu'un changement d'URL
  const stopWatchingEpisode = adapter.watchEpisode?.(() => handleUrl(new URL(location.href)));
  if (stopWatchingEpisode) page.signal.addEventListener('abort', stopWatchingEpisode, { once: true });
  // Nouvelle instance après une mise à jour de l'extension : celle-ci, orpheline, s'arrête sans rien afficher
  document.addEventListener(
    CONTENT_STARTED_EVENT,
    () => {
      if (!isExtensionContextInvalidated()) return;
      if (__SYNCKAI_DEBUG__) log.info('Extension rechargée : instance orpheline arrêtée, la nouvelle prend le relais');
      session?.destroy();
      session = null;
      seasons.stop();
      page.abort();
    },
    { signal: page.signal },
  );
}

/**
 * Ports du panneau latéral (chrome.tabs.connect depuis la page de l'extension, sans service worker).
 * Chaque port reçoit l'état complet à la connexion ; l'intervalle s'arrête quand le dernier se ferme.
 */
function listenLivePorts(live: LiveStream, onPeersChange: () => void): void {
  chrome.runtime.onConnect.addListener((port) => {
    // Seule une page de cette extension (panneau) peut ouvrir ce port
    if (port.name !== LIVE_PORT_NAME || port.sender?.id !== chrome.runtime.id) return;
    const peer = live.addPeer((message: LiveContentMessage) => port.postMessage(message));
    onPeersChange();
    const onMessage = (message: unknown): void => {
      if (isLivePanelMessage(message)) peer.resend();
    };
    port.onMessage.addListener(onMessage);
    port.onDisconnect.addListener(() => {
      port.onMessage.removeListener(onMessage);
      peer.remove();
      onPeersChange();
    });
  });
}
