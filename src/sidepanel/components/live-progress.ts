import { isLiveContentMessage, LIVE_PORT_NAME, type LiveContentMessage, type LivePanelMessage } from '../../protocol/live';
import { createLogger } from '../../browser/logger';
import { createStore, type ReadonlyStore } from '../../ui/state';
import { liveStateKeepsMessage, type LiveSnapshot, type LiveTarget } from '../live-view';
import type { LiveEvent } from '../now-playing-view';

const log = createLogger('sidepanel');

// Progression en direct : port ouvert directement vers le script de contenu de l'onglet suivi
// (le service worker reste endormi). Sans rendu : l'état du port est un store, lu par le bloc « Tu regardes »
// (components/live-card.tsx), qui seul est redessiné à chaque tick.

export type { LiveTarget };

export interface LiveProgress {
  /** Dernier état connu du port (épisode annoncé, tick, message, page injoignable) */
  readonly store: ReadonlyStore<LiveSnapshot>;
  /** Épisode à suivre ; null : port fermé (autre onglet, page sans lecture, panneau masqué) */
  follow(target: LiveTarget | null): void;
}

/** Nouvelles tentatives quand le port se ferme sans réponse (page en chargement, script pas encore prêt) */
const CONNECT_RETRY_MS: readonly number[] = [800, 2_000];
/** Port fermé après des échanges (rechargement de la page) : reconnexion */
const RECONNECT_MS = 1_000;

/** `onEvent` : épisode annoncé par la page (navigation SPA) et synchro terminée, pour mettre la fiche à jour */
export function createLiveProgress(onEvent: (event: LiveEvent) => void): LiveProgress {
  let target: LiveTarget | null = null;
  let port: chrome.runtime.Port | null = null;
  /** Le port courant a reçu au moins un message (script de contenu vivant) */
  let received = false;
  let failures = 0;
  let retryTimer: ReturnType<typeof setTimeout> | undefined;
  /** Script de contenu injoignable (orphelin après rechargement de l'extension) */
  let unreachable = false;
  /** Épisode annoncé par la page : les ticks d'un autre épisode (navigation SPA) sont ignorés */
  let liveEpisode: string | null = null;
  let tick: LiveSnapshot['tick'] = null;
  let message: string | null = null;
  const store = createStore<LiveSnapshot>({ target: null, liveEpisode: null, tick: null, message: null, unreachable: false });

  /** Publie l'état courant (les lecteurs du store ne redessinent que ce qui a changé) */
  function update(): void {
    store.set({ target, liveEpisode, tick, message, unreachable });
  }

  // ─── Port ─────────────────────────────────────────────────────────────

  function handle(raw: unknown): void {
    if (!isLiveContentMessage(raw)) return;
    received = true;
    failures = 0;
    unreachable = false;
    const msg: LiveContentMessage = raw;
    switch (msg.type) {
      case 'page':
        liveEpisode = msg.episodeId;
        tick = null;
        message = null;
        update();
        onEvent({ type: 'page', episodeId: msg.episodeId });
        return;
      case 'tick':
        if (liveEpisode === null) return;
        tick = msg;
        if (!liveStateKeepsMessage(msg.state)) message = null;
        break;
      case 'sync':
        message = msg.outcome?.message ?? null;
        if (tick) tick = { ...tick, state: msg.state };
        update();
        // Synchro automatique terminée : la fiche relit la page puis recalcule saison et listes.
        // Pas de comparaison avec l'épisode de la fiche : c'est justement elle qui peut être en retard.
        if (msg.state === 'synced' && liveEpisode !== null) onEvent({ type: 'synced' });
        return;
      case 'season':
        onEvent({ type: 'season' });
        return;
    }
    update();
  }

  function post(message: LivePanelMessage): void {
    try {
      port?.postMessage(message);
    } catch (error: unknown) {
      log.debug('Port de lecture fermé :', error);
    }
  }

  function schedule(ms: number): void {
    clearTimeout(retryTimer);
    retryTimer = setTimeout(connect, ms);
  }

  function fail(): void {
    const wait = CONNECT_RETRY_MS[failures];
    failures++;
    if (wait === undefined) {
      unreachable = true;
      update();
      return;
    }
    schedule(wait);
  }

  function connect(): void {
    clearTimeout(retryTimer);
    retryTimer = undefined;
    if (!target || port) return;
    received = false;
    let next: chrome.runtime.Port;
    try {
      next = chrome.tabs.connect(target.tabId, { name: LIVE_PORT_NAME, frameId: 0 });
    } catch (error: unknown) {
      log.debug('Port de lecture non ouvert :', error);
      fail();
      return;
    }
    port = next;
    next.onMessage.addListener((raw: unknown) => {
      if (port === next) handle(raw);
    });
    next.onDisconnect.addListener(() => {
      // Lecture obligatoire : sinon Chrome journalise « Receiving end does not exist » (script absent / orphelin)
      void chrome.runtime.lastError;
      if (port !== next) return;
      port = null;
      if (!target) return;
      if (received) {
        // Page rechargée : le nouveau script de contenu répondra dans un instant
        liveEpisode = null;
        tick = null;
        update();
        schedule(RECONNECT_MS);
      } else {
        fail();
      }
    });
    // Pas de « hello » ici : la page envoie d'elle-même l'état complet à chaque nouveau port
  }

  function disconnect(): void {
    clearTimeout(retryTimer);
    retryTimer = undefined;
    const current = port;
    port = null;
    current?.disconnect();
    received = false;
    failures = 0;
    unreachable = false;
    liveEpisode = null;
    tick = null;
    message = null;
  }

  // Fermeture du panneau : le port se ferme avec la page, on le ferme explicitement par principe
  window.addEventListener('pagehide', () => {
    target = null;
    disconnect();
  });

  return {
    store,
    follow(next: LiveTarget | null): void {
      if (next === null) {
        if (target === null) return;
        target = null;
        disconnect();
        update();
        return;
      }
      if (target === null || target.tabId !== next.tabId) {
        disconnect();
        target = next;
        update();
        connect();
        return;
      }
      if (target.episodeId === next.episodeId) {
        // Même épisode : port relancé seulement s'il n'existe plus et qu'aucune tentative n'est prévue
        if (!port && retryTimer === undefined && !unreachable) connect();
        return;
      }
      target = next;
      update();
      // Navigation SPA : la page a déjà dû annoncer le nouvel épisode, on redemande l'état par sûreté
      if (port) post({ type: 'hello' });
      else if (retryTimer === undefined && !unreachable) connect();
    },
  };
}
