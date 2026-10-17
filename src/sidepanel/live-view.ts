import { t } from '../i18n';
import type { LivePoint, LiveState, LiveTickMessage } from '../protocol/live';

// Progression en direct (onglet « En lecture ») : fonctions pures dérivées du dernier tick de la page.

export type LiveTone = 'info' | 'success' | 'muted' | 'warning' | 'error';

/** Icône de la ligne d'état (nom de ui/icons.ts) ; null : compte à rebours, texte simple */
export type LiveIcon = 'clock' | 'videoOff' | 'pause' | 'skip' | 'sync' | 'check' | 'alert' | 'xCircle' | 'ban';

/** Onglet et épisode affichés par la fiche ; `episodeId` null : page de série (seulement la saison choisie, aucune progression) */
export interface LiveTarget {
  tabId: number;
  episodeId: string | null;
}

export interface LiveDisplay {
  /** Ligne d'état (maquette PanelLectureEtats) : compte à rebours ou état */
  text: string;
  tone: LiveTone;
  /** Icône de l'état ; null pour le compte à rebours (ligne simple, atténuée) */
  icon: LiveIcon | null;
  /** Ligne secondaire : raison, marche à suivre, message d'erreur, point de synchro en pause */
  detail: string | null;
  /**
   * Texte annoncé aux lecteurs d'écran (région aria-live) : seulement les changements d'état,
   * jamais le compte à rebours (sinon une annonce par seconde)
   */
  announce: string | null;
  /** Barre de progression : absente sans durée connue ; `legend` : « Générique à 21:32 » sous la barre, à droite */
  bar: { percent: number; pointPercent: number | null; valueNow: number; valueMax: number; valueText: string; legend: string | null } | null;
}

/** État du port de lecture vu par la fiche (ui sans rendu : components/live-progress.ts) */
export interface LiveSnapshot {
  /** Épisode suivi par la fiche, null : port fermé */
  target: LiveTarget | null;
  /** Épisode annoncé par la page (message `page`) */
  liveEpisode: string | null;
  tick: LiveTickMessage | null;
  /** Message de la page (raison, erreur) gardé par les états qui en portent un */
  message: string | null;
  /** Script de contenu muet après les essais (onglet ouvert avant une mise à jour de l'extension) */
  unreachable: boolean;
}

/** Bloc « Tu regardes » : lecture de l'épisode de la fiche, page injoignable, ou rien (en attente du premier tick) */
export type LiveBlock = { kind: 'none' } | { kind: 'unreachable' } | { kind: 'live'; display: LiveDisplay };

/** 83 → "1:23" ; 3725 → "1:02:05" */
export function formatClock(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = String(total % 60).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`;
}

/** Temps restant avant la synchro : "2 min 10", "2 min", "45 s" */
export function formatCountdown(seconds: number): string {
  const total = Math.max(0, Math.ceil(seconds));
  const min = Math.floor(total / 60);
  const sec = total % 60;
  if (min === 0) return t('panel.live.seconds', { sec });
  return sec === 0 ? t('panel.live.minutes', { min }) : t('panel.live.minutesSeconds', { min, sec: String(sec).padStart(2, '0') });
}

/** « Synchro au générique » / « Synchro à 85 % » */
export function pointLabel(point: LivePoint, duration: number): string {
  return point.source === 'credits' ? t('panel.live.pointCredits') : t('panel.live.pointRatio', { percent: Math.round((point.seconds / duration) * 100) });
}

/** États dont le message de la page (raison, erreur) reste affiché tant qu'ils durent */
export function liveStateKeepsMessage(state: LiveState): boolean {
  return state === 'error' || state === 'review' || state === 'not-connected';
}

const clampPercent = (value: number): number => Math.min(100, Math.max(0, value));

/** Légende du repère sur la barre : « Générique à 21:32 » / « Générique inconnu · synchro à 85 % » */
function pointLegend(point: LivePoint, duration: number): string {
  return point.source === 'credits' ? t('panel.live.creditsAt', { time: formatClock(point.seconds) }) : t('panel.live.creditsUnknown', { percent: Math.round((point.seconds / duration) * 100) });
}

/** Compte à rebours jusqu'au point de synchro, avec ce qu'il désigne */
function countdownText(point: LivePoint, remaining: number, duration: number): string {
  const time = formatCountdown(remaining);
  return point.source === 'credits' ? t('panel.live.countdownCredits', { time }) : t('panel.live.countdownRatio', { time, percent: Math.round((point.seconds / duration) * 100) });
}

export function liveDisplay(tick: LiveTickMessage, message: string | null): LiveDisplay {
  const { t: position, duration, point, state, paused } = tick;
  const known = duration !== null && duration > 0;
  const now = position ?? 0;
  const bar = known
    ? {
        percent: clampPercent((now / duration) * 100),
        pointPercent: point ? clampPercent((point.seconds / duration) * 100) : null,
        valueNow: Math.min(Math.floor(now), Math.round(duration)),
        valueMax: Math.round(duration),
        valueText: t('panel.live.position', { position: formatClock(now), duration: formatClock(duration) }),
        legend: point ? pointLegend(point, duration) : null,
      }
    : null;
  const status = (text: string, tone: LiveTone, icon: LiveIcon, detail: string | null = null): LiveDisplay => ({ text, tone, icon, detail, announce: text, bar });

  switch (state) {
    case 'syncing':
      return status(t('panel.live.syncing'), 'info', 'sync');
    case 'synced':
      return status(t('panel.live.synced'), 'success', 'check');
    case 'excluded':
      return status(t('panel.live.excluded'), 'muted', 'ban');
    case 'no-video':
      return { ...status(t('panel.live.noVideo'), 'muted', 'videoOff'), bar: null };
    case 'review':
      // Correspondance par titre seul : rien d'écrit, l'utilisateur choisit la fiche (pas un échec)
      return status(t('panel.live.review'), 'warning', 'alert', message ?? t('panel.live.reviewHint'));
    case 'not-connected':
      return status(t('feedback.notConnected.title'), 'warning', 'alert', message ?? t('feedback.notConnected.message'));
    case 'error':
      return status(t('panel.live.error'), 'error', 'xCircle', message);
    case 'idle':
      return known ? status(t('panel.live.autoSyncOff'), 'muted', 'pause') : status(t('panel.live.waiting'), 'muted', 'clock');
    case 'watching': {
      if (!known) return status(t('panel.live.waiting'), 'muted', 'clock');
      // En pause : ce que la synchro attend, sous l'état
      if (paused) return status(t('panel.live.paused'), 'muted', 'pause', point ? pointLabel(point, duration) : null);
      if (!point) return { text: '', tone: 'muted', icon: null, detail: null, announce: null, bar };
      if (now >= point.seconds) return status(t('panel.live.pointPassed'), 'muted', 'skip');
      // Lecture en cours : compte à rebours non annoncé (aria-live réservé aux changements d'état)
      return { text: countdownText(point, point.seconds - now, duration), tone: 'muted', icon: null, detail: null, announce: null, bar };
    }
  }
}

/**
 * Bloc à afficher : la lecture seulement quand la page a annoncé l'épisode de la fiche et envoyé un tick (les ticks d'un
 * autre épisode, pendant une navigation SPA, sont ignorés) ; sinon « Recharge l'onglet… » si la page reste muette
 */
export function liveBlock(snapshot: LiveSnapshot): LiveBlock {
  const { target, liveEpisode, tick, message, unreachable } = snapshot;
  if (target !== null && liveEpisode === target.episodeId && tick !== null) return { kind: 'live', display: liveDisplay(tick, message) };
  return unreachable ? { kind: 'unreachable' } : { kind: 'none' };
}
