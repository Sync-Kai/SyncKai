import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PendingRating } from '../../shared/engagement.types';
import type { SyncOutcome } from '../../shared/sync.types';
import { installFakeChrome } from '../../test/fake-chrome';
import type { RatingsController } from './ratings';

// Contrôleur « À noter » : fausse API chrome (stockage + onChanged, verrous) et faux service worker (réponses à la main).

interface PendingCall {
  type: string;
  payload: unknown;
  resolve: (value: SyncOutcome) => void;
  reject: (error: unknown) => void;
}

const sw = vi.hoisted(() => ({ calls: [] as PendingCall[] }));

vi.mock('../../shared/messages', () => ({
  sendMessage: (type: string, payload: unknown) => new Promise((resolve, reject) => sw.calls.push({ type, payload, resolve, reject })),
}));

const fake = installFakeChrome();
const { createRatingsController } = await import('./ratings');
const { PENDING_RATINGS_KEY } = await import('../../shared/storage-keys');
const { NOTICE_MS } = await import('./notice');

async function settle(): Promise<void> {
  for (let i = 0; i < 20; i++) await Promise.resolve();
}

function rating(mediaId: number, title: string, completedAt: number): PendingRating {
  return { id: `anilist:${mediaId}`, mediaId, malId: null, title, coverUrl: null, completedAt };
}

const FRIEREN = rating(154587, 'Frieren', 2_000);
const DANDADAN = rating(171018, 'Dandadan', 1_000);

const saved: SyncOutcome = { status: 'synced', mediaTitle: 'Frieren', results: [{ service: 'anilist', outcome: { status: 'updated', progress: 28, completed: true } }] };
const failed: SyncOutcome = { status: 'synced', mediaTitle: 'Frieren', results: [{ service: 'anilist', outcome: { status: 'error', message: 'HTTP 500' } }] };

let ctl: RatingsController;

beforeEach(async () => {
  fake.reset({ [PENDING_RATINGS_KEY]: [DANDADAN, FRIEREN] });
  sw.calls.length = 0;
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
  ctl = createRatingsController();
  await ctl.load();
});

afterEach(() => {
  ctl.dispose();
  vi.useRealTimers();
});

describe('createRatingsController', () => {
  it('load : cartes triées de la plus récente à la plus ancienne', () => {
    expect(ctl.store.get().items.map((i) => i.title)).toEqual(['Frieren', 'Dandadan']);
  });

  it('note : carte conservée pendant l’envoi (même retirée du stockage), retirée une fois la note écrite', async () => {
    void ctl.rate(FRIEREN, 8);
    void ctl.rate(FRIEREN, 8);
    expect(sw.calls).toHaveLength(1);
    expect(sw.calls[0]?.payload).toEqual({ media: { mediaId: 154587, malId: null, title: 'Frieren' }, score: 8, fromCard: true });
    expect(ctl.store.get().busyIds.has(FRIEREN.id)).toBe(true);

    // Le service worker retire la carte du stockage avant de répondre : elle reste affichée (envoi en cours)
    await fake.local.set({ [PENDING_RATINGS_KEY]: [DANDADAN] });
    await settle();
    expect(ctl.store.get().items.map((i) => i.id)).toEqual([FRIEREN.id, DANDADAN.id]);

    sw.calls[0]?.resolve(saved);
    await settle();
    const state = ctl.store.get();
    expect(state.items.map((i) => i.id)).toEqual([DANDADAN.id]);
    expect(state.busyIds.size).toBe(0);
    expect(state.notice?.tone).toBe('success');

    vi.advanceTimersByTime(NOTICE_MS);
    expect(ctl.store.get().notice).toBeNull();
  });

  it('échec : carte conservée avec son erreur, effacée au nouvel essai', async () => {
    void ctl.rate(FRIEREN, 8);
    sw.calls[0]?.resolve(failed);
    await settle();
    expect(ctl.store.get().items).toHaveLength(2);
    expect(ctl.store.get().busyIds.size).toBe(0);
    expect(ctl.store.get().errors.get(FRIEREN.id)).toBeTruthy();
    expect(ctl.store.get().notice).toBeNull();

    void ctl.rate(FRIEREN, 9);
    expect(ctl.store.get().errors.has(FRIEREN.id)).toBe(false);
  });

  it('service worker injoignable : erreur sur la carte', async () => {
    void ctl.rate(DANDADAN, 5);
    sw.calls[0]?.reject(new Error('down'));
    await settle();
    expect(ctl.store.get().errors.get(DANDADAN.id)).toBeTruthy();
    expect(ctl.store.get().items).toHaveLength(2);
  });

  it('« Ignorer » : carte retirée du stockage puis de la liste (storage.onChanged)', async () => {
    await ctl.ignore(DANDADAN);
    expect(fake.local.peek(PENDING_RATINGS_KEY)).toEqual([FRIEREN]);
    await settle();
    expect(ctl.store.get().items.map((i) => i.id)).toEqual([FRIEREN.id]);
    expect(ctl.store.get().error).toBeNull();
  });
});
