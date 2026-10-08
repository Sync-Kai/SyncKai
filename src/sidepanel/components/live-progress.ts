import { t } from '../../i18n';
import { isLiveContentMessage, LIVE_PORT_NAME, type LiveContentMessage, type LivePanelMessage, type LiveTickMessage } from '../../shared/live.types';
import { createLogger } from '../../shared/logger';
import { h } from '../../ui/dom';
import { formatClock, liveDisplay, type LiveTone } from '../live-view';
import type { LiveEvent } from '../now-playing-view';

const log = createLogger('sidepanel');

// Progression en direct : port ouvert directement vers le script de contenu de l'onglet suivi
// (le service worker reste endormi). Le bloc est mis à jour sur place : un tick ne redessine pas le panneau.

/** Onglet et épisode affichés par la fiche */
export interface LiveTarget {
  tabId: number;
  episodeId: string;
}

export interface LiveProgress {
  /** Bloc persistant, réinséré tel quel à chaque rendu de la fiche */
  readonly element: HTMLElement;
  /** Épisode à suivre ; null : port fermé (autre onglet, page sans lecture, panneau masqué) */
  follow(target: LiveTarget | null): void;
}

/** Nouvelles tentatives quand le port se ferme sans réponse (page en chargement, script pas encore prêt) */
const CONNECT_RETRY_MS: readonly number[] = [800, 2_000];
/** Port fermé après des échanges (rechargement de la page) : reconnexion */
const RECONNECT_MS = 1_000;

const TONE_CLASS: Record<LiveTone, string> = {
  info: 'text-ink',
  success: 'text-mint',
  muted: 'text-muted',
  error: 'text-danger',
};

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
  let tick: LiveTickMessage | null = null;
  let message: string | null = null;
  let announced: string | null = null;

  // ─── Bloc (créé une fois) ─────────────────────────────────────────────
  const text = h('span', { class: 'min-w-0 truncate text-[12px] font-bold' });
  const clock = h('span', { class: 'shrink-0 text-[11px] font-semibold text-muted tabular-nums' });
  const fill = h('div', {
    class: 'absolute inset-y-0 left-0 rounded-full bg-sakura transition-[width] duration-1000 ease-linear motion-reduce:transition-none',
  });
  const marker = h('div', { class: 'absolute -top-[3px] h-[12px] w-[3px] -translate-x-1/2 rounded-full bg-butter', attrs: { 'aria-hidden': 'true' } });
  const bar = h('div', { class: 'relative h-1.5 rounded-full bg-raised', attrs: { role: 'progressbar', 'aria-label': t('panel.live.playback'), 'aria-valuemin': '0' } }, fill, marker);
  const detail = h('span', { class: 'min-w-0 truncate text-[11px] text-muted' });
  // Région annoncée : changements d'état uniquement (pause, synchro, erreur), jamais le compte à rebours
  const announcer = h('span', { class: 'sr-only', attrs: { 'aria-live': 'polite', 'aria-atomic': 'true' } });
  const hint = h('p', { class: 'm-0 text-[11px] text-muted' });
  const body = h('div', { class: 'flex flex-col gap-1.5' }, h('div', { class: 'flex items-baseline justify-between gap-2' }, text, clock), bar, detail);
  const element = h('div', { class: 'flex flex-col gap-1.5', attrs: { hidden: '' } }, body, hint, announcer);

  function update(): void {
    const visible = target !== null && liveEpisode === target.episodeId && tick !== null;
    hint.hidden = !(unreachable && !visible);
    hint.textContent = t('panel.live.unreachable');
    body.hidden = !visible;
    element.hidden = !visible && !unreachable;
    if (!visible || !tick) {
      announce(null);
      return;
    }
    const view = liveDisplay(tick, message);
    text.textContent = view.text;
    text.className = `min-w-0 truncate text-[12px] font-bold ${TONE_CLASS[view.tone]}`;
    detail.textContent = view.detail ?? '';
    detail.hidden = view.detail === null;
    detail.className = `min-w-0 text-[11px] ${view.tone === 'error' ? 'text-danger' : 'truncate text-muted'}`;
    bar.hidden = view.bar === null;
    clock.hidden = view.bar === null;
    if (view.bar) {
      clock.textContent = `${formatClock(tick.t ?? 0)} / ${formatClock(tick.duration ?? 0)}`;
      fill.style.width = `${view.bar.percent}%`;
      bar.setAttribute('aria-valuemax', String(view.bar.valueMax));
      bar.setAttribute('aria-valuenow', String(view.bar.valueNow));
      bar.setAttribute('aria-valuetext', view.bar.valueText);
      marker.hidden = view.bar.pointPercent === null;
      if (view.bar.pointPercent !== null) marker.style.left = `${view.bar.pointPercent}%`;
      marker.title = view.detail ?? '';
    }
    announce(view.announce);
  }

  function announce(value: string | null): void {
    if (value === announced) return;
    announced = value;
    announcer.textContent = value ?? '';
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
        if (msg.state !== 'error') message = null;
        break;
      case 'sync':
        message = msg.outcome?.message ?? null;
        if (tick) tick = { ...tick, state: msg.state };
        update();
        // Synchro automatique terminée : la fiche relit la page puis recalcule saison et listes.
        // Pas de comparaison avec l'épisode de la fiche : c'est justement elle qui peut être en retard.
        if (msg.state === 'synced' && liveEpisode !== null) onEvent({ type: 'synced' });
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
    element,
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
