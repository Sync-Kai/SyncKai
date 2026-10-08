import { afterEach, describe, expect, it } from 'vitest';
import { setLocale } from '../i18n';
import type { LiveTickMessage } from '../shared/live.types';
import { formatClock, formatCountdown, liveDisplay, pointLabel } from './live-view';

const tick = (extra: Partial<LiveTickMessage> = {}): LiveTickMessage => ({
  type: 'tick',
  t: 1160,
  duration: 1420,
  paused: false,
  point: { seconds: 1290, source: 'credits' },
  state: 'watching',
  ...extra,
});

describe('progression en direct (panneau)', () => {
  afterEach(() => setLocale('fr'));

  it('horloge mm:ss et h:mm:ss', () => {
    expect(formatClock(0)).toBe('0:00');
    expect(formatClock(83.9)).toBe('1:23');
    expect(formatClock(3725)).toBe('1:02:05');
    expect(formatClock(-4)).toBe('0:00');
  });

  it('compte à rebours', () => {
    setLocale('fr');
    expect(formatCountdown(130)).toBe('2 min 10');
    expect(formatCountdown(125)).toBe('2 min 05');
    expect(formatCountdown(120)).toBe('2 min');
    expect(formatCountdown(44.2)).toBe('45 s');
    setLocale('en');
    expect(formatCountdown(130)).toBe('2 min 10');
    setLocale('de');
    expect(formatCountdown(130)).toBe('2 Min. 10');
  });

  it('libellé du point de synchro selon sa source', () => {
    setLocale('fr');
    expect(pointLabel({ seconds: 1290, source: 'credits' }, 1420)).toBe('Synchro au générique');
    expect(pointLabel({ seconds: 1207, source: 'ratio' }, 1420)).toBe('Synchro à 85 %');
  });

  it('lecture : compte à rebours non annoncé, barre et marqueur', () => {
    setLocale('fr');
    const view = liveDisplay(tick(), null);
    expect(view.text).toBe('Synchro dans 2 min 10');
    expect(view.announce).toBeNull();
    expect(view.detail).toBe('Synchro au générique · 21:30');
    expect(view.bar).toEqual({ percent: (1160 / 1420) * 100, pointPercent: (1290 / 1420) * 100, valueNow: 1160, valueMax: 1420, valueText: '19:20 sur 23:40' });
  });

  it('états annoncés (pause, synchro, erreur…)', () => {
    setLocale('fr');
    expect(liveDisplay(tick({ paused: true }), null)).toMatchObject({ text: 'En pause', announce: 'En pause' });
    expect(liveDisplay(tick({ state: 'syncing' }), null).text).toBe('Synchronisation…');
    expect(liveDisplay(tick({ state: 'synced' }), null)).toMatchObject({ text: 'Synchronisé ✓', tone: 'success' });
    expect(liveDisplay(tick({ state: 'excluded' }), null).text).toBe('Série exclue');
    expect(liveDisplay(tick({ state: 'error' }), 'AniList indisponible')).toMatchObject({ text: 'Échec de la synchro', detail: 'AniList indisponible', tone: 'error' });
    expect(liveDisplay(tick({ state: 'no-video', t: null, duration: null, point: null }), null)).toMatchObject({ text: 'Aucune vidéo détectée', bar: null });
    expect(liveDisplay(tick({ t: 1300 }), null).text).toBe('Point de synchro dépassé');
  });

  it('lecteur pas prêt, synchro automatique en pause', () => {
    setLocale('fr');
    expect(liveDisplay(tick({ t: null, duration: null, point: null, state: 'idle' }), null)).toMatchObject({ text: 'En attente du lecteur…', bar: null });
    expect(liveDisplay(tick({ state: 'idle' }), null).text).toBe('Synchro automatique en pause');
    expect(liveDisplay(tick({ point: null }), null)).toMatchObject({ text: '', announce: null });
  });
});
