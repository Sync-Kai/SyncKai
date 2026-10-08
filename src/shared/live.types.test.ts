import { describe, expect, it } from 'vitest';
import { isLiveContentMessage, isLivePanelMessage, LIVE_STATES } from './live.types';

describe('messages de progression en direct', () => {
  const tick = { type: 'tick', t: 125, duration: 1420, paused: false, point: { seconds: 1290, source: 'credits' }, state: 'watching' };

  it('accepte une identité de page (épisode ou aucun)', () => {
    expect(isLiveContentMessage({ type: 'page', episodeId: 'GE00376431JAJP' })).toBe(true);
    expect(isLiveContentMessage({ type: 'page', episodeId: null })).toBe(true);
    expect(isLiveContentMessage({ type: 'page', episodeId: '' })).toBe(false);
    expect(isLiveContentMessage({ type: 'page' })).toBe(false);
  });

  it('accepte un tick complet, lecteur prêt ou non', () => {
    expect(isLiveContentMessage(tick)).toBe(true);
    expect(isLiveContentMessage({ ...tick, t: null, duration: null, point: null, state: 'idle' })).toBe(true);
    for (const state of LIVE_STATES) expect(isLiveContentMessage({ ...tick, state })).toBe(true);
  });

  it('refuse un tick mal formé', () => {
    expect(isLiveContentMessage({ ...tick, t: -1 })).toBe(false);
    expect(isLiveContentMessage({ ...tick, t: Number.NaN })).toBe(false);
    expect(isLiveContentMessage({ ...tick, duration: Infinity })).toBe(false);
    expect(isLiveContentMessage({ ...tick, paused: 'non' })).toBe(false);
    expect(isLiveContentMessage({ ...tick, point: { seconds: 10, source: 'chapters' } })).toBe(false);
    expect(isLiveContentMessage({ ...tick, state: 'playing' })).toBe(false);
  });

  it('accepte un changement de synchro avec ou sans issue', () => {
    expect(isLiveContentMessage({ type: 'sync', state: 'syncing' })).toBe(true);
    expect(isLiveContentMessage({ type: 'sync', state: 'synced', outcome: { status: 'synced', message: null } })).toBe(true);
    expect(isLiveContentMessage({ type: 'sync', state: 'error', outcome: { status: 'error', message: 'AniList indisponible' } })).toBe(true);
    expect(isLiveContentMessage({ type: 'sync', state: 'error', outcome: { status: 'boom', message: null } })).toBe(false);
    expect(isLiveContentMessage({ type: 'sync', state: 'error', outcome: { status: 'error' } })).toBe(false);
  });

  it('refuse le reste', () => {
    for (const value of [null, 'tick', 42, {}, { type: 'hello' }, { type: 'TICK' }]) expect(isLiveContentMessage(value)).toBe(false);
  });

  it('message du panneau : « hello » uniquement', () => {
    expect(isLivePanelMessage({ type: 'hello' })).toBe(true);
    expect(isLivePanelMessage({ type: 'tick' })).toBe(false);
    expect(isLivePanelMessage(null)).toBe(false);
  });
});
