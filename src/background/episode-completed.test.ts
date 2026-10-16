import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { EpisodeInfo } from '../shared/episode.types';
import type { SyncOutcome } from '../shared/sync.types';

// Routage de EPISODE_COMPLETED : synchro, file de relance et fiche de l'onglet simulées, accès Netflix / Disney+ piloté.
const mocks = vi.hoisted(() => ({
  hasPlatformAccess: vi.fn(),
  syncEpisode: vi.fn(),
  recordSyncOutcome: vi.fn(),
  forgetPageResolutions: vi.fn(),
  refreshTabPageMedia: vi.fn(),
}));
/** Sessions ouvertes au début de la synchro : transmises à la file avec l'épisode */
const SESSIONS = { anilist: 2, mal: 0 };
vi.mock('../browser/storage/sessions', () => ({ getOpenSessions: async () => SESSIONS }));
vi.mock('../browser/platform-access', () => ({ hasPlatformAccess: mocks.hasPlatformAccess }));
vi.mock('./sync/sync-service', () => ({ syncEpisode: mocks.syncEpisode }));
vi.mock('./sync/queue', () => ({ recordSyncOutcome: mocks.recordSyncOutcome }));
vi.mock('./page-media/page-media', () => ({ forgetPageResolutions: mocks.forgetPageResolutions, refreshTabPageMedia: mocks.refreshTabPageMedia }));

const { handleEpisodeCompleted } = await import('./episode-completed');

function episode(platform: EpisodeInfo['platform']): EpisodeInfo {
  return {
    platform,
    episodeId: '81991750',
    seriesId: '81991749',
    seriesSlug: null,
    animeTitle: 'Comme un rat',
    seasonNumber: 1,
    seasonTitle: null,
    seasonEpisodeNumber: 1,
    displayedEpisodeNumber: 1,
    episodeTitle: null,
    url: 'https://www.netflix.com/watch/81991750',
  };
}

const SYNCED: SyncOutcome = { status: 'synced', mediaTitle: 'Comme un rat', results: [] };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.syncEpisode.mockResolvedValue(SYNCED);
  mocks.recordSyncOutcome.mockImplementation((_episode: EpisodeInfo, _services: unknown, outcome: SyncOutcome) => Promise.resolve(outcome));
  mocks.refreshTabPageMedia.mockResolvedValue(undefined);
});

describe('EPISODE_COMPLETED — accès Netflix', () => {
  it('Netflix sans la permission (onglet ouvert avant le retrait) → ignoré, sans synchro, file ni fiche', async () => {
    mocks.hasPlatformAccess.mockResolvedValue(false);
    expect(await handleEpisodeCompleted({ episode: episode('netflix'), services: null }, 7)).toEqual({ status: 'ignored', noAccess: true });
    expect(mocks.syncEpisode).not.toHaveBeenCalled();
    expect(mocks.recordSyncOutcome).not.toHaveBeenCalled();
    expect(mocks.refreshTabPageMedia).not.toHaveBeenCalled();
  });

  it('Netflix avec la permission → synchronisé et passé à la file', async () => {
    mocks.hasPlatformAccess.mockResolvedValue(true);
    const ep = episode('netflix');
    expect(await handleEpisodeCompleted({ episode: ep, services: ['mal'] }, 7)).toEqual(SYNCED);
    expect(mocks.syncEpisode).toHaveBeenCalledWith(ep, ['mal'], SESSIONS);
    expect(mocks.recordSyncOutcome).toHaveBeenCalledWith(ep, ['mal'], SYNCED, SESSIONS);
    expect(mocks.refreshTabPageMedia).toHaveBeenCalledWith(7, ep);
  });

  it('Disney+ sans la permission → ignoré de même ; la permission lue est celle de Disney+', async () => {
    mocks.hasPlatformAccess.mockResolvedValue(false);
    expect(await handleEpisodeCompleted({ episode: episode('disney'), services: null }, 7)).toEqual({ status: 'ignored', noAccess: true });
    expect(mocks.hasPlatformAccess).toHaveBeenCalledWith('disney');
    expect(mocks.syncEpisode).not.toHaveBeenCalled();
    expect(mocks.recordSyncOutcome).not.toHaveBeenCalled();
  });

  it('Prime Video sans la permission → ignoré de même ; avec : synchronisé', async () => {
    mocks.hasPlatformAccess.mockResolvedValue(false);
    expect(await handleEpisodeCompleted({ episode: episode('prime'), services: null }, 7)).toEqual({ status: 'ignored', noAccess: true });
    expect(mocks.hasPlatformAccess).toHaveBeenCalledWith('prime');
    expect(mocks.syncEpisode).not.toHaveBeenCalled();
    expect(mocks.recordSyncOutcome).not.toHaveBeenCalled();
    mocks.hasPlatformAccess.mockResolvedValue(true);
    expect(await handleEpisodeCompleted({ episode: episode('prime'), services: null }, 7)).toEqual(SYNCED);
  });

  it('Crunchyroll et ADN : la permission Netflix n’est jamais lue', async () => {
    for (const platform of ['crunchyroll', 'adn'] as const) {
      expect(await handleEpisodeCompleted({ episode: episode(platform), services: null }, undefined)).toEqual(SYNCED);
    }
    expect(mocks.hasPlatformAccess).not.toHaveBeenCalled();
    expect(mocks.syncEpisode).toHaveBeenCalledTimes(2);
  });
});

describe('EPISODE_COMPLETED — limite de débit par onglet et par série (SEC-01, décision 1)', () => {
  let session: Record<string, unknown> = {};
  const MINUTE = 60_000;
  /** Épisode n de la série `seriesId` sur Crunchyroll */
  const crEpisode = (n: number, seriesId = 'GSERIES'): EpisodeInfo => ({
    ...episode('crunchyroll'),
    episodeId: `${seriesId}-E${n}`,
    seriesId,
    seasonEpisodeNumber: n,
    displayedEpisodeNumber: n,
    url: `https://www.crunchyroll.com/watch/${seriesId}-E${n}`,
  });
  /** Synchros réellement écrites (sans demande de vérification) */
  const reviewed = (): boolean[] => mocks.syncEpisode.mock.calls.map((call: unknown[]) => call.length > 3);

  beforeEach(() => {
    session = {};
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-16T20:00:00Z'));
    vi.stubGlobal('chrome', {
      storage: {
        session: {
          get: async (key: string) => (key in session ? { [key]: session[key] } : {}),
          set: async (values: Record<string, unknown>) => void Object.assign(session, values),
        },
      },
    });
    vi.stubGlobal('navigator', { locks: { request: <T>(_name: string, task: () => Promise<T>): Promise<T> => task() } });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('enchaînement autoplay (épisodes consécutifs à quelques minutes d’intervalle) : jamais limité', async () => {
    for (let n = 1; n <= 12; n++) {
      await handleEpisodeCompleted({ episode: crEpisode(n), services: null }, 7);
      vi.setSystemTime(Date.now() + 22 * MINUTE);
    }
    expect(reviewed()).toEqual(Array.from({ length: 12 }, () => false));
  });

  it('épisodes courts (moins de 2 min) en rafale : 5 par 10 minutes écrits, au-delà « À vérifier » au lieu d’écrire', async () => {
    for (let n = 1; n <= 7; n++) {
      await handleEpisodeCompleted({ episode: crEpisode(n), services: null }, 7);
      vi.setSystemTime(Date.now() + 1.5 * MINUTE);
    }
    expect(reviewed()).toEqual([false, false, false, false, false, true, true]);
    expect(mocks.syncEpisode.mock.calls[5]?.[3]).toMatchObject({ review: expect.any(String) as unknown });
    // La fenêtre glisse : passé 10 minutes sans rafale, l'écriture reprend
    vi.setSystemTime(Date.now() + 10 * MINUTE);
    await handleEpisodeCompleted({ episode: crEpisode(8), services: null }, 7);
    expect(reviewed().at(-1)).toBe(false);
  });

  it('par série : la même série depuis plusieurs onglets est limitée ; d’autres séries du même onglet aussi (par onglet)', async () => {
    for (let n = 1; n <= 5; n++) await handleEpisodeCompleted({ episode: crEpisode(n), services: null }, n);
    await handleEpisodeCompleted({ episode: crEpisode(6), services: null }, 99);
    expect(reviewed().at(-1)).toBe(true);
    mocks.syncEpisode.mockClear();
    vi.setSystemTime(Date.now() + 11 * MINUTE);
    for (let n = 1; n <= 6; n++) await handleEpisodeCompleted({ episode: crEpisode(1, `GOTHER${n}`), services: null }, 42);
    expect(reviewed()).toEqual([false, false, false, false, false, true]);
  });
});
