import { afterEach, describe, expect, it } from 'vitest';
import { setLocale } from '../i18n';
import type { LiveState, LiveTickMessage } from '../protocol/live';
import { formatClock, formatCountdown, liveBlock, liveDisplay, liveStateKeepsMessage, pointLabel, type LiveSnapshot } from './live-view';

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

  it('lecture : compte à rebours non annoncé (sans icône), barre, marqueur et légende du générique', () => {
    setLocale('fr');
    const view = liveDisplay(tick(), null);
    expect(view.text).toBe('Synchro dans 2 min 10 · au début du générique');
    expect(view.icon).toBeNull();
    expect(view.announce).toBeNull();
    expect(view.detail).toBeNull();
    expect(view.bar).toEqual({
      percent: (1160 / 1420) * 100,
      pointPercent: (1290 / 1420) * 100,
      valueNow: 1160,
      valueMax: 1420,
      valueText: '19:20 sur 23:40',
      legend: 'Générique à 21:30',
    });
  });

  it('générique inconnu : seuil en % dans la légende et le compte à rebours', () => {
    setLocale('fr');
    const view = liveDisplay(tick({ point: { seconds: 1207, source: 'ratio' }, t: 700 }), null);
    expect(view.text).toBe('Synchro dans 8 min 27 · à 85 % de l’épisode');
    expect(view.bar?.legend).toBe('Générique inconnu · synchro à 85 %');
    setLocale('en');
    expect(liveDisplay(tick(), null)).toMatchObject({ text: 'Sync in 2 min 10 · at the start of the credits', bar: { legend: 'Credits at 21:30' } });
  });

  it('états annoncés (pause, synchro, erreur…) : icône, ton, ligne secondaire', () => {
    setLocale('fr');
    expect(liveDisplay(tick({ paused: true }), null)).toMatchObject({ text: 'En pause', icon: 'pause', announce: 'En pause', detail: 'Synchro au générique' });
    expect(liveDisplay(tick({ state: 'syncing' }), null)).toMatchObject({ text: 'Synchronisation…', icon: 'sync', tone: 'info', detail: null });
    expect(liveDisplay(tick({ state: 'synced' }), null)).toMatchObject({ text: 'Synchronisé', icon: 'check', tone: 'success', detail: null });
    expect(liveDisplay(tick({ state: 'excluded' }), null)).toMatchObject({ text: 'Série exclue', icon: 'ban' });
    expect(liveDisplay(tick({ state: 'error' }), 'AniList indisponible')).toMatchObject({ text: 'Échec de la synchro', icon: 'xCircle', detail: 'AniList indisponible', tone: 'error' });
    expect(liveDisplay(tick({ state: 'no-video', t: null, duration: null, point: null }), null)).toMatchObject({ text: 'Aucune vidéo détectée', icon: 'videoOff', bar: null });
    expect(liveDisplay(tick({ t: 1300 }), null)).toMatchObject({ text: 'Point de synchro dépassé', icon: 'skip' });
  });

  it('fiche à vérifier, compte absent, échec : libellé et ton distincts', () => {
    setLocale('fr');
    const reason = 'Trouvé par le titre seulement. Clique sur l’icône SyncKai pour choisir la fiche.';
    expect(liveDisplay(tick({ state: 'review' }), reason)).toMatchObject({ text: 'À vérifier', tone: 'warning', icon: 'alert', detail: reason, announce: 'À vérifier' });
    // Panneau ouvert après la synchro (tick sans message) : marche à suivre seule
    expect(liveDisplay(tick({ state: 'review' }), null)).toMatchObject({ text: 'À vérifier', tone: 'warning', detail: 'Clique sur l’icône SyncKai pour choisir la fiche.' });
    expect(liveDisplay(tick({ state: 'not-connected' }), null)).toMatchObject({
      text: 'Aucun compte connecté',
      tone: 'warning',
      detail: 'Clique sur l’icône SyncKai pour connecter AniList ou MyAnimeList.',
    });
    expect(liveDisplay(tick({ state: 'error' }), null)).toMatchObject({ text: 'Échec de la synchro', tone: 'error', detail: null });
    setLocale('en');
    expect(liveDisplay(tick({ state: 'review' }), null)).toMatchObject({ text: 'To check', detail: 'Click the SyncKai icon to pick the entry.' });
    expect(liveDisplay(tick({ state: 'not-connected' }), null).text).toBe('No account connected');
    setLocale('de');
    expect(liveDisplay(tick({ state: 'review' }), null).text).toBe('Zu prüfen');
    expect(liveDisplay(tick({ state: 'not-connected' }), null).text).toBe('Kein Konto verbunden');
  });

  it('message conservé seulement par les états qui en portent un', () => {
    const keeping: LiveState[] = ['review', 'not-connected', 'error'];
    const clearing: LiveState[] = ['watching', 'syncing', 'synced', 'idle', 'excluded', 'no-video'];
    expect(keeping.every(liveStateKeepsMessage)).toBe(true);
    expect(clearing.some(liveStateKeepsMessage)).toBe(false);
  });

  it('lecteur pas prêt, synchro automatique en pause', () => {
    setLocale('fr');
    expect(liveDisplay(tick({ t: null, duration: null, point: null, state: 'idle' }), null)).toMatchObject({ text: 'En attente du lecteur…', icon: 'clock', bar: null });
    expect(liveDisplay(tick({ state: 'idle' }), null)).toMatchObject({ text: 'Synchro automatique en pause', icon: 'pause', detail: null });
    // Point inconnu : barre seule, ni texte ni légende
    expect(liveDisplay(tick({ point: null }), null)).toMatchObject({ text: '', icon: null, announce: null, bar: { pointPercent: null, legend: null } });
  });

  it('bloc affiché : épisode suivi seulement, page injoignable sans tick, rien sinon', () => {
    setLocale('fr');
    const base: LiveSnapshot = { target: { tabId: 1, episodeId: 'E7' }, liveEpisode: 'E7', tick: tick(), message: null, unreachable: false };
    expect(liveBlock(base)).toMatchObject({ kind: 'live', display: { text: 'Synchro dans 2 min 10 · au début du générique' } });
    // Tick d'un autre épisode (navigation SPA en cours) : rien
    expect(liveBlock({ ...base, liveEpisode: 'E8' })).toEqual({ kind: 'none' });
    expect(liveBlock({ ...base, tick: null })).toEqual({ kind: 'none' });
    expect(liveBlock({ ...base, target: null })).toEqual({ kind: 'none' });
    // Script de contenu muet (onglet ouvert avant une mise à jour)
    expect(liveBlock({ ...base, tick: null, liveEpisode: null, unreachable: true })).toEqual({ kind: 'unreachable' });
    // Tick reçu ensuite : la lecture prime
    expect(liveBlock({ ...base, unreachable: true }).kind).toBe('live');
  });
});
