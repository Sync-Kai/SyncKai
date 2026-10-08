import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setLocale } from '../../i18n';
import type { LiveContentMessage } from '../../shared/live.types';
import { createLiveStream, liveOutcomeOf, sameTick, toTick, type LiveSnapshot } from './live-stream';

const playing = (t: number, extra: Partial<LiveSnapshot> = {}): LiveSnapshot => ({
  episodeId: 'EP1',
  t,
  duration: 1420.4,
  paused: false,
  point: { seconds: 1290.2, source: 'credits' },
  state: 'watching',
  ...extra,
});

describe('toTick / sameTick', () => {
  it('arrondit à la seconde : même seconde = pas de nouvel envoi', () => {
    const a = toTick(playing(12.1));
    expect(a).toEqual({ type: 'tick', t: 12, duration: 1420, paused: false, point: { seconds: 1290, source: 'credits' }, state: 'watching' });
    expect(sameTick(a, toTick(playing(12.9)))).toBe(true);
    expect(sameTick(a, toTick(playing(13.0)))).toBe(false);
    expect(sameTick(a, toTick(playing(12.5, { paused: true })))).toBe(false);
    expect(sameTick(a, toTick(playing(12.5, { state: 'syncing' })))).toBe(false);
    expect(sameTick(null, a)).toBe(false);
  });

  it('lecteur pas prêt : valeurs nulles', () => {
    expect(toTick(playing(Number.NaN, { duration: null, point: null }))).toMatchObject({ t: null, duration: null, point: null });
  });
});

describe('createLiveStream', () => {
  let snapshot: LiveSnapshot | null;
  beforeEach(() => {
    vi.useFakeTimers();
    snapshot = playing(10);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  const collect = (): { send: (m: LiveContentMessage) => void; received: LiveContentMessage[] } => {
    const received: LiveContentMessage[] = [];
    return { send: (m) => received.push(m), received };
  };

  it('aucun intervalle sans panneau connecté', () => {
    const getSnapshot = vi.fn(() => snapshot);
    const stream = createLiveStream(getSnapshot);
    stream.refresh();
    stream.notifySync('syncing');
    vi.advanceTimersByTime(5_000);
    expect(getSnapshot).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('envoie l’état complet à la connexion, puis au plus un tick par seconde', () => {
    const stream = createLiveStream(() => snapshot);
    const peer = collect();
    stream.addPeer(peer.send);
    expect(peer.received).toEqual([{ type: 'page', episodeId: 'EP1' }, toTick(playing(10))]);
    snapshot = playing(10.4);
    vi.advanceTimersByTime(1_000);
    expect(peer.received).toHaveLength(2); // Même seconde : rien
    snapshot = playing(11.2);
    vi.advanceTimersByTime(1_000);
    expect(peer.received.at(-1)).toMatchObject({ type: 'tick', t: 11 });
    expect(peer.received).toHaveLength(3);
  });

  it('en pause : aucun envoi tant que rien ne change', () => {
    const stream = createLiveStream(() => snapshot);
    const peer = collect();
    snapshot = playing(42, { paused: true });
    stream.addPeer(peer.send);
    vi.advanceTimersByTime(10_000);
    expect(peer.received).toHaveLength(2);
    snapshot = playing(42, { paused: false });
    vi.advanceTimersByTime(1_000);
    expect(peer.received.at(-1)).toMatchObject({ type: 'tick', paused: false });
  });

  it('changement de synchro diffusé immédiatement', () => {
    const stream = createLiveStream(() => snapshot);
    const peer = collect();
    stream.addPeer(peer.send);
    snapshot = playing(1291, { state: 'syncing' });
    stream.notifySync('syncing');
    expect(peer.received.slice(2)).toEqual([{ type: 'sync', state: 'syncing' }, toTick(playing(1291, { state: 'syncing' }))]);
    stream.notifySync('synced', { status: 'synced', message: null });
    expect(peer.received).toContainEqual({ type: 'sync', state: 'synced', outcome: { status: 'synced', message: null } });
  });

  it('navigation SPA : nouvelle identité de page avant les ticks', () => {
    const stream = createLiveStream(() => snapshot);
    const peer = collect();
    stream.addPeer(peer.send);
    snapshot = playing(0, { episodeId: 'EP2', duration: null, point: null, state: 'idle' });
    stream.refresh();
    expect(peer.received.slice(2)).toEqual([{ type: 'page', episodeId: 'EP2' }, toTick(snapshot)]);
    snapshot = null; // Page hors lecture
    vi.advanceTimersByTime(1_000);
    expect(peer.received.at(-1)).toEqual({ type: 'page', episodeId: null });
  });

  it('plusieurs panneaux ; l’intervalle s’arrête au départ du dernier', () => {
    const stream = createLiveStream(() => snapshot);
    const a = collect();
    const b = collect();
    const peerA = stream.addPeer(a.send);
    const peerB = stream.addPeer(b.send);
    expect(b.received).toHaveLength(2);
    snapshot = playing(12);
    vi.advanceTimersByTime(1_000);
    expect(a.received).toHaveLength(3);
    expect(b.received).toHaveLength(3);
    peerA.remove();
    expect(stream.peerCount).toBe(1);
    expect(vi.getTimerCount()).toBe(1);
    peerB.remove();
    peerB.remove(); // Double déconnexion sans effet
    expect(stream.peerCount).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('« hello » renvoie l’état complet à ce seul panneau', () => {
    const stream = createLiveStream(() => snapshot);
    const a = collect();
    const b = collect();
    const peerA = stream.addPeer(a.send);
    stream.addPeer(b.send);
    peerA.resend();
    expect(a.received).toHaveLength(4);
    expect(b.received).toHaveLength(2);
  });

  it('un port fermé (envoi en erreur) est retiré et l’intervalle nettoyé', () => {
    const stream = createLiveStream(() => snapshot);
    let open = true;
    stream.addPeer(() => {
      if (!open) throw new Error('Attempting to use a disconnected port object');
    });
    open = false;
    snapshot = playing(20);
    vi.advanceTimersByTime(1_000);
    expect(stream.peerCount).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe('liveOutcomeOf', () => {
  it('synchro complète, partielle, exclue, en erreur', () => {
    setLocale('fr');
    expect(liveOutcomeOf({ status: 'synced', mediaTitle: 'X', results: [{ service: 'anilist', outcome: { status: 'updated', progress: 5, completed: false } }] })).toEqual({
      state: 'synced',
      outcome: { status: 'synced', message: null },
    });
    const partial = liveOutcomeOf({
      status: 'synced',
      mediaTitle: 'X',
      results: [
        { service: 'anilist', outcome: { status: 'updated', progress: 5, completed: false } },
        { service: 'mal', outcome: { status: 'error', message: 'MAL indisponible' } },
      ],
    });
    expect(partial.state).toBe('error');
    expect(partial.outcome.message).toContain('MAL indisponible');
    expect(liveOutcomeOf({ status: 'excluded', mediaTitle: 'X' }).state).toBe('excluded');
    expect(liveOutcomeOf({ status: 'error', message: 'Réseau' })).toEqual({ state: 'error', outcome: { status: 'error', message: 'Réseau' } });
    expect(liveOutcomeOf({ status: 'not-connected' }).outcome.status).toBe('not-connected');
  });
});
