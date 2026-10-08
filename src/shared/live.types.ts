import { isRecord } from './guards';

// Progression en direct : port longue durée entre le panneau latéral et le script de contenu de son onglet
// (chrome.tabs.connect). Le service worker n'intervient pas : il reste endormi pendant la lecture.

export const LIVE_PORT_NAME = 'synckai:live';

/** État du suivi de l'épisode côté page */
export type LiveState = 'idle' | 'watching' | 'syncing' | 'synced' | 'error' | 'excluded' | 'no-video';

export const LIVE_STATES: readonly LiveState[] = ['idle', 'watching', 'syncing', 'synced', 'error', 'excluded', 'no-video'];

/** Point de synchronisation : début du générique de fin, ou seuil en % de la durée */
export interface LivePoint {
  seconds: number;
  source: 'credits' | 'ratio';
}

/** Issue d'une synchronisation, réduite à ce que le panneau affiche */
export interface LiveOutcome {
  status: 'synced' | 'needs-review' | 'not-connected' | 'excluded' | 'error';
  /** Texte prêt à afficher (déjà traduit par la page), null si rien à ajouter */
  message: string | null;
}

/** Identité de la page : envoyée à la connexion et à chaque changement d'épisode (navigation SPA) */
export interface LivePageMessage {
  type: 'page';
  /** Épisode suivi, null hors page de lecture */
  episodeId: string | null;
}

/** Position de lecture : au plus une par seconde, seulement si quelque chose a changé */
export interface LiveTickMessage {
  type: 'tick';
  /** Position (s), null tant que le lecteur n'est pas prêt */
  t: number | null;
  duration: number | null;
  paused: boolean;
  point: LivePoint | null;
  state: LiveState;
}

/** Changement d'état de la synchronisation, envoyé immédiatement */
export interface LiveSyncMessage {
  type: 'sync';
  state: LiveState;
  outcome?: LiveOutcome;
}

export type LiveContentMessage = LivePageMessage | LiveTickMessage | LiveSyncMessage;

/** Panneau → page : demande l'état complet (connexion ou reprise) */
export interface LiveHelloMessage {
  type: 'hello';
}

export type LivePanelMessage = LiveHelloMessage;

const OUTCOME_STATUSES: readonly LiveOutcome['status'][] = ['synced', 'needs-review', 'not-connected', 'excluded', 'error'];

const isSeconds = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0;
const isNullableSeconds = (value: unknown): value is number | null => value === null || isSeconds(value);

export function isLiveState(value: unknown): value is LiveState {
  return typeof value === 'string' && (LIVE_STATES as readonly string[]).includes(value);
}

export function isLivePoint(value: unknown): value is LivePoint {
  return isRecord(value) && isSeconds(value.seconds) && (value.source === 'credits' || value.source === 'ratio');
}

function isLiveOutcome(value: unknown): value is LiveOutcome {
  return (
    isRecord(value) &&
    typeof value.status === 'string' &&
    (OUTCOME_STATUSES as readonly string[]).includes(value.status) &&
    (value.message === null || typeof value.message === 'string')
  );
}

export function isLiveContentMessage(value: unknown): value is LiveContentMessage {
  if (!isRecord(value)) return false;
  switch (value.type) {
    case 'page':
      return value.episodeId === null || (typeof value.episodeId === 'string' && value.episodeId !== '');
    case 'tick':
      return (
        isNullableSeconds(value.t) &&
        isNullableSeconds(value.duration) &&
        typeof value.paused === 'boolean' &&
        (value.point === null || isLivePoint(value.point)) &&
        isLiveState(value.state)
      );
    case 'sync':
      return isLiveState(value.state) && (value.outcome === undefined || isLiveOutcome(value.outcome));
    default:
      return false;
  }
}

export function isLivePanelMessage(value: unknown): value is LivePanelMessage {
  return isRecord(value) && value.type === 'hello';
}
