import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { EpisodeInfo } from '../../shared/episode.types';
import type { SyncQueueItem } from '../../shared/queue.types';
import type { SyncOutcome } from '../../shared/sync.types';
import { installFakeChrome } from '../../test/fake-chrome';
import type { QueueController } from './queue';

// Contrôleur « Synchros en attente » : fausse API chrome (stockage + onChanged, verrous) et faux service worker.

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
const { createQueueController } = await import('./queue');
const { SYNC_QUEUE_KEY } = await import('../../shared/storage-keys');
const { NOTICE_MS } = await import('./notice');

async function settle(): Promise<void> {
  for (let i = 0; i < 20; i++) await Promise.resolve();
}

function queued(episodeId: string, status: SyncQueueItem['status']): SyncQueueItem {
  const episode: EpisodeInfo = {
    platform: 'crunchyroll',
    episodeId,
    seriesId: 'GR001',
    seriesSlug: 'frieren',
    animeTitle: 'Frieren',
    seasonNumber: 1,
    seasonTitle: null,
    seasonEpisodeNumber: 5,
    displayedEpisodeNumber: 5,
    episodeTitle: null,
    url: `https://www.crunchyroll.com/watch/${episodeId}`,
  };
  return { id: `crunchyroll:${episodeId}`, episode, services: null, attempts: 1, status, nextAttemptAt: 1, firstFailedAt: 1, lastError: 'Hors ligne' };
}

const PENDING = queued('GE001', 'pending');
const FAILED = queued('GE002', 'failed');
const synced: SyncOutcome = { status: 'synced', mediaTitle: 'Frieren', results: [{ service: 'anilist', outcome: { status: 'updated', progress: 5, completed: false } }] };

let ctl: QueueController;

beforeEach(async () => {
  fake.reset({ [SYNC_QUEUE_KEY]: [FAILED, PENDING] });
  sw.calls.length = 0;
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
  ctl = createQueueController();
  await ctl.load();
});

afterEach(() => {
  ctl.dispose();
  vi.useRealTimers();
});

describe('createQueueController', () => {
  it('load : en attente d’abord, puis abandonnées ; compteurs', () => {
    expect(ctl.store.get().items.map((i) => i.id)).toEqual([PENDING.id, FAILED.id]);
    expect(ctl.counts()).toEqual({ failed: 1, pending: 1 });
  });

  it('réessai : élément occupé (un seul envoi), bandeau du résultat quelques secondes, file relue', async () => {
    void ctl.retry(FAILED.id);
    void ctl.retry(FAILED.id);
    expect(sw.calls).toHaveLength(1);
    expect(sw.calls[0]).toMatchObject({ type: 'RETRY_QUEUED', payload: { id: FAILED.id } });
    expect(ctl.store.get().busyIds.has(FAILED.id)).toBe(true);

    // Le service worker retire l'élément réussi avant de répondre
    fake.local.seed({ [SYNC_QUEUE_KEY]: [PENDING] });
    sw.calls[0]?.resolve(synced);
    await settle();
    const state = ctl.store.get();
    expect(state.busyIds.size).toBe(0);
    expect(state.notice?.tone).toBe('success');
    expect(state.items.map((i) => i.id)).toEqual([PENDING.id]);
    expect(ctl.counts()).toEqual({ failed: 0, pending: 1 });

    vi.advanceTimersByTime(NOTICE_MS);
    expect(ctl.store.get().notice).toBeNull();
  });

  it('réessai sans service worker : bandeau d’erreur, élément conservé', async () => {
    void ctl.retry(PENDING.id);
    sw.calls[0]?.reject(new Error('down'));
    await settle();
    expect(ctl.store.get().notice?.tone).toBe('error');
    expect(ctl.store.get().items).toHaveLength(2);
  });

  it('abandon : élément retiré du stockage et de la liste', async () => {
    await ctl.abandon(FAILED.id);
    expect(fake.local.peek(SYNC_QUEUE_KEY)).toEqual([PENDING]);
    expect(ctl.store.get().items.map((i) => i.id)).toEqual([PENDING.id]);
    expect(ctl.store.get().busyIds.size).toBe(0);
    expect(ctl.store.get().error).toBeNull();
  });

  it('changement de la file par le service worker : liste relue (storage.onChanged)', async () => {
    await fake.local.set({ [SYNC_QUEUE_KEY]: [] });
    await settle();
    expect(ctl.store.get().items).toEqual([]);
    expect(ctl.counts()).toEqual({ failed: 0, pending: 0 });
  });
});
