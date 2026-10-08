import type { LiveContentMessage, LiveOutcome, LivePoint, LiveState, LiveTickMessage } from '../../shared/live.types';
import { describeOutcome } from '../../shared/sync-feedback';
import { failedServices, type SyncOutcome } from '../../shared/sync.types';

// Diffusion de la progression vers les panneaux connectés (logique pure : ni chrome.*, ni DOM).
// L'intervalle n'existe que tant qu'au moins un panneau est connecté.

/** État instantané de l'épisode suivi (lu sur la session et la <video>) */
export interface LiveSnapshot {
  episodeId: string;
  t: number | null;
  duration: number | null;
  paused: boolean;
  point: LivePoint | null;
  state: LiveState;
}

export type LiveSend = (message: LiveContentMessage) => void;

export interface LivePeer {
  /** Renvoie la page et la position courantes à ce panneau (message « hello ») */
  resend(): void;
  /** Déconnexion : le dernier panneau parti arrête l'intervalle */
  remove(): void;
}

export interface LiveStream {
  addPeer(send: LiveSend): LivePeer;
  /** Changement d'état de la synchronisation : diffusé immédiatement */
  notifySync(state: LiveState, outcome?: LiveOutcome): void;
  /** Changement de session (navigation SPA) : identité de page et position relues tout de suite */
  refresh(): void;
  readonly peerCount: number;
}

export const LIVE_TICK_MS = 1_000;

/** Issue d'une synchronisation → état affiché par le panneau (un service en échec compte comme une erreur ; série ignorée → repos) */
export function liveOutcomeOf(outcome: SyncOutcome): { state: LiveState; outcome?: LiveOutcome } {
  if (outcome.status === 'ignored') return { state: 'idle' };
  if (outcome.status === 'synced' && failedServices(outcome).length === 0) return { state: 'synced', outcome: { status: 'synced', message: null } };
  if (outcome.status === 'excluded') return { state: 'excluded', outcome: { status: 'excluded', message: null } };
  const feedback = describeOutcome(outcome);
  return { state: 'error', outcome: { status: outcome.status, message: feedback.message ?? feedback.title } };
}

/** Valeurs arrondies : une position identique à la seconde près n'est pas renvoyée (pause, lecteur figé) */
export function toTick(snapshot: LiveSnapshot): LiveTickMessage {
  const round = (value: number | null): number | null => (value === null || !Number.isFinite(value) ? null : Math.max(0, Math.round(value)));
  return {
    type: 'tick',
    t: snapshot.t === null || !Number.isFinite(snapshot.t) ? null : Math.max(0, Math.floor(snapshot.t)),
    duration: round(snapshot.duration),
    paused: snapshot.paused,
    point: snapshot.point ? { seconds: Math.max(0, Math.round(snapshot.point.seconds)), source: snapshot.point.source } : null,
    state: snapshot.state,
  };
}

export function sameTick(a: LiveTickMessage | null, b: LiveTickMessage): boolean {
  return (
    a !== null &&
    a.t === b.t &&
    a.duration === b.duration &&
    a.paused === b.paused &&
    a.state === b.state &&
    a.point?.seconds === b.point?.seconds &&
    a.point?.source === b.point?.source
  );
}

export function createLiveStream(getSnapshot: () => LiveSnapshot | null, intervalMs: number = LIVE_TICK_MS): LiveStream {
  const peers = new Set<LiveSend>();
  let timer: ReturnType<typeof setInterval> | undefined;
  /** undefined : rien envoyé depuis le démarrage de l'intervalle */
  let lastPage: string | null | undefined;
  let lastTick: LiveTickMessage | null = null;

  /** Un port fermé lève une exception : le panneau est retiré sans casser la diffusion aux autres */
  const deliver = (send: LiveSend, message: LiveContentMessage): void => {
    try {
      send(message);
    } catch {
      drop(send);
    }
  };

  const broadcast = (message: LiveContentMessage): void => {
    for (const send of [...peers]) deliver(send, message);
  };

  const stop = (): void => {
    clearInterval(timer);
    timer = undefined;
    lastPage = undefined;
    lastTick = null;
  };

  function drop(send: LiveSend): void {
    if (!peers.delete(send)) return;
    if (peers.size === 0) stop();
  }

  /** Envoie l'identité de page si elle a changé, puis la position si elle a changé */
  const evaluate = (): void => {
    if (peers.size === 0) return;
    const snapshot = getSnapshot();
    const page = snapshot?.episodeId ?? null;
    if (page !== lastPage) {
      lastPage = page;
      lastTick = null;
      broadcast({ type: 'page', episodeId: page });
    }
    if (!snapshot) return;
    const tick = toTick(snapshot);
    if (sameTick(lastTick, tick)) return;
    lastTick = tick;
    broadcast(tick);
  };

  /** État complet pour un seul panneau (connexion, « hello ») */
  const sendFull = (send: LiveSend): void => {
    const snapshot = getSnapshot();
    deliver(send, { type: 'page', episodeId: snapshot?.episodeId ?? null });
    if (snapshot && peers.has(send)) deliver(send, toTick(snapshot));
  };

  return {
    addPeer(send: LiveSend): LivePeer {
      peers.add(send);
      if (timer === undefined) {
        // Premier panneau : référence posée pour ne pas renvoyer aux suivants ce qu'ils reçoivent déjà
        const snapshot = getSnapshot();
        lastPage = snapshot?.episodeId ?? null;
        lastTick = snapshot ? toTick(snapshot) : null;
        timer = setInterval(evaluate, intervalMs);
      }
      sendFull(send);
      return {
        resend: () => {
          if (peers.has(send)) sendFull(send);
        },
        remove: () => drop(send),
      };
    },
    notifySync(state: LiveState, outcome?: LiveOutcome): void {
      if (peers.size === 0) return;
      broadcast(outcome ? { type: 'sync', state, outcome } : { type: 'sync', state });
      evaluate();
    },
    refresh: evaluate,
    get peerCount(): number {
      return peers.size;
    },
  };
}
