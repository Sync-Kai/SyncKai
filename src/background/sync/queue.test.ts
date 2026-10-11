import { beforeEach, describe, expect, it, vi } from 'vitest';
import { setLocale } from '../../i18n';
import type { EpisodeInfo } from '../../shared/episode.types';
import type { SyncQueueItem } from '../../shared/queue.types';
import type { SyncOutcome } from '../../shared/sync.types';

// File de relance liée au compte (DATA-01) : un élément n'est relancé que sur les sessions de son échec.
// Vrai queue.ts et vrai stockage (simulé) ; syncEpisode relevé.

const mocks = vi.hoisted(() => ({ syncEpisode: vi.fn() }));
vi.mock('./sync-service', () => ({ syncEpisode: mocks.syncEpisode }));
vi.mock('../../shared/badge', () => ({ refreshReviewBadge: async () => undefined }));

let store: Record<string, unknown> = {};
vi.stubGlobal('chrome', {
  alarms: { create: async () => undefined, clear: async () => true },
  storage: {
    local: {
      get: async (keys: string | string[]): Promise<Record<string, unknown>> =>
        Object.fromEntries((Array.isArray(keys) ? keys : [keys]).filter((k) => k in store).map((k) => [k, store[k]])),
      set: async (items: Record<string, unknown>): Promise<void> => void Object.assign(store, items),
      remove: async (keys: string | string[]): Promise<void> => {
        for (const k of Array.isArray(keys) ? keys : [keys]) delete store[k];
      },
    },
  },
});
// Verrous immédiats ; `ifAvailable` (exécution de la file) reçoit un verrou
vi.stubGlobal('navigator', {
  language: 'fr',
  locks: {
    request: (_name: string, optionsOrTask: unknown, maybeTask?: (lock: unknown) => Promise<unknown>) =>
      typeof optionsOrTask === 'function' ? (optionsOrTask as () => Promise<unknown>)() : maybeTask?.({ name: _name }),
  },
});

const { processSyncQueue, recordSyncOutcome, retryQueued } = await import('./queue');
const { getSyncQueue, SYNC_QUEUE_KEY } = await import('../../shared/sync-queue-store');

setLocale('fr');

const episode: EpisodeInfo = {
  platform: 'crunchyroll',
  episodeId: 'EP5',
  seriesId: 'GSERIES',
  seriesSlug: 'serie',
  animeTitle: 'Série',
  seasonNumber: 1,
  seasonTitle: null,
  seasonEpisodeNumber: 5,
  displayedEpisodeNumber: 5,
  episodeTitle: null,
  url: 'https://www.crunchyroll.com/watch/EP5',
};

const item = (overrides: Partial<SyncQueueItem> = {}): SyncQueueItem => ({
  id: 'crunchyroll:EP5',
  episode,
  services: null,
  attempts: 1,
  status: 'pending',
  nextAttemptAt: 0,
  firstFailedAt: Date.now(),
  lastError: 'Hors ligne',
  ...overrides,
});

const SYNCED: SyncOutcome = { status: 'synced', mediaTitle: 'Série', results: [] };
const NETWORK: SyncOutcome = { status: 'error', message: 'Connexion impossible.', code: 'NETWORK' };

/** Compte B connecté sur AniList (génération 1 : le compte A a été déconnecté), MAL de la génération 0 */
function signedInAsB(withMal = false): void {
  store = {
    anilistToken: { accessToken: 'B', expiresAt: Number.MAX_SAFE_INTEGER },
    ...(withMal ? { malToken: { accessToken: 'M', refreshToken: 'R', expiresAt: Number.MAX_SAFE_INTEGER } } : {}),
    sessionEpoch: { anilist: 1, mal: 0 },
  };
}

beforeEach(() => {
  mocks.syncEpisode.mockReset();
  mocks.syncEpisode.mockResolvedValue(SYNCED);
  vi.spyOn(console, 'info').mockImplementation(() => {});
});

describe('relance de la file (DATA-01)', () => {
  it('élément enregistré sous le compte A (génération 0) relancé sous le compte B : retiré sans écriture', async () => {
    signedInAsB();
    store[SYNC_QUEUE_KEY] = [item({ epochs: { anilist: 0 } })];
    await processSyncQueue();
    expect(mocks.syncEpisode).not.toHaveBeenCalled();
    expect(await getSyncQueue()).toEqual([]);
  });

  it('« Réessayer » sur un élément de l’ancien compte : retiré avec un message, sans écriture', async () => {
    signedInAsB();
    store[SYNC_QUEUE_KEY] = [item({ status: 'failed', epochs: { anilist: 0 } })];
    expect(await retryQueued('crunchyroll:EP5')).toEqual({ status: 'error', message: expect.stringContaining('compte déconnecté') });
    expect(mocks.syncEpisode).not.toHaveBeenCalled();
    expect(await getSyncQueue()).toEqual([]);
  });

  it('AniList changé, MAL inchangé : relancé sur MAL seul, avec la session MAL de l’échec', async () => {
    signedInAsB(true);
    store[SYNC_QUEUE_KEY] = [item({ epochs: { anilist: 0, mal: 0 } })];
    await processSyncQueue();
    expect(mocks.syncEpisode).toHaveBeenCalledWith(episode, ['mal'], { mal: 0 });
    expect(await getSyncQueue()).toEqual([]);
  });

  it('élément antérieur à la 2.2.0 encore présent (aucune déconnexion depuis) : relancé sur la session courante', async () => {
    signedInAsB();
    store[SYNC_QUEUE_KEY] = [item()];
    await processSyncQueue();
    expect(mocks.syncEpisode).toHaveBeenCalledWith(episode, ['anilist'], { anilist: 1 });
  });
});

describe('mise en file (DATA-01)', () => {
  it('échec passager d’une synchro commencée sous le compte A, terminée après sa déconnexion : rien en file', async () => {
    signedInAsB();
    expect(await recordSyncOutcome(episode, null, NETWORK, { anilist: 0 })).toEqual(NETWORK);
    expect(await getSyncQueue()).toEqual([]);
  });

  it('échec passager sous la session courante : en file, lié à cette session', async () => {
    signedInAsB();
    expect(await recordSyncOutcome(episode, null, NETWORK, { anilist: 1 })).toMatchObject({ queued: true });
    expect(await getSyncQueue()).toMatchObject([{ services: ['anilist'], epochs: { anilist: 1 } }]);
  });
});
