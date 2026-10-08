import { t } from '../i18n';
import type { LivePoint, LiveTickMessage } from '../shared/live.types';

// Progression en direct (onglet « En lecture ») : fonctions pures dérivées du dernier tick de la page.

export type LiveTone = 'info' | 'success' | 'muted' | 'error';

export interface LiveDisplay {
  /** Ligne principale : compte à rebours ou état */
  text: string;
  tone: LiveTone;
  /** Ligne secondaire : point de synchro (« Synchro au générique · 21:30 ») ou message d'erreur */
  detail: string | null;
  /**
   * Texte annoncé aux lecteurs d'écran (région aria-live) : seulement les changements d'état,
   * jamais le compte à rebours (sinon une annonce par seconde)
   */
  announce: string | null;
  /** Barre de progression : absente sans durée connue */
  bar: { percent: number; pointPercent: number | null; valueNow: number; valueMax: number; valueText: string } | null;
}

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

const clampPercent = (value: number): number => Math.min(100, Math.max(0, value));

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
      }
    : null;
  const detail = known && point ? `${pointLabel(point, duration)} · ${formatClock(point.seconds)}` : null;
  const status = (text: string, tone: LiveTone, extra: string | null = detail): LiveDisplay => ({ text, tone, detail: extra, announce: text, bar });

  switch (state) {
    case 'syncing':
      return status(t('panel.live.syncing'), 'info');
    case 'synced':
      return status(t('panel.live.synced'), 'success');
    case 'excluded':
      return status(t('panel.live.excluded'), 'muted');
    case 'no-video':
      return { text: t('panel.live.noVideo'), tone: 'muted', detail: null, announce: t('panel.live.noVideo'), bar: null };
    case 'error':
      return status(t('panel.live.error'), 'error', message);
    case 'idle':
      return known ? status(t('panel.live.autoSyncOff'), 'muted') : status(t('panel.live.waiting'), 'muted', null);
    case 'watching': {
      if (!known) return status(t('panel.live.waiting'), 'muted', null);
      if (paused) return status(t('panel.live.paused'), 'muted');
      if (!point) return { text: '', tone: 'muted', detail: null, announce: null, bar };
      if (now >= point.seconds) return status(t('panel.live.pointPassed'), 'muted');
      // Lecture en cours : compte à rebours non annoncé (aria-live réservé aux changements d'état)
      return { text: t('panel.live.countdown', { time: formatCountdown(point.seconds - now) }), tone: 'info', detail, announce: null, bar };
    }
  }
}
