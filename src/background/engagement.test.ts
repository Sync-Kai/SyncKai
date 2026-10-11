import { beforeEach, describe, expect, it, vi } from 'vitest';
import { setLocale } from '../i18n';
import type { MediaRef } from '../shared/engagement.types';
import type { TrackerId } from '../shared/tracker.types';
import type { ListEntryState } from './sync/rules';
import type { TrackerService } from './trackers/tracker';

// Cartes « À noter » liées au compte (DATA-01) : vrai engagement.ts, services et stockage simulés.

const fakes = vi.hoisted(() => ({ trackers: [] as TrackerService[] }));
vi.mock('./trackers', () => ({ getConnectedTrackers: async (): Promise<TrackerService[]> => fakes.trackers }));
vi.mock('../shared/badge', () => ({ refreshReviewBadge: async () => undefined }));

let store: Record<string, unknown> = {};
vi.stubGlobal('chrome', {
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
vi.stubGlobal('navigator', { language: 'fr', locks: { request: <T>(_name: string, task: () => Promise<T>): Promise<T> => task() } });

const { deferRating, rateMedia } = await import('./engagement');
const { getPendingRatings } = await import('../shared/engagement-store');

setLocale('fr');

const MEDIA: MediaRef = { mediaId: 1001, malId: 2001, title: 'Frieren' };

/** Service en mémoire : la série est dans la liste, les notes écrites sont relevées */
function fakeTracker(id: TrackerId): TrackerService & { scores: number[] } {
  const entry: ListEntryState = { status: 'COMPLETED', progress: 28 };
  const scores: number[] = [];
  const unused = (): Promise<ListEntryState> => Promise.reject(new Error('hors test'));
  return {
    id,
    scores,
    isConnected: async () => true,
    resolveId: (media) => (id === 'anilist' ? media.mediaId : media.idMal),
    getEntry: async () => ({ title: 'Frieren', episodes: 28, entry }),
    saveScore: async (_id, score) => {
      scores.push(score);
      return entry;
    },
    saveProgress: unused,
    saveStatus: unused,
    startRewatch: unused,
    saveEntry: unused,
  };
}

let anilist: ReturnType<typeof fakeTracker>;
let mal: ReturnType<typeof fakeTracker>;

beforeEach(() => {
  anilist = fakeTracker('anilist');
  mal = fakeTracker('mal');
  fakes.trackers = [anilist, mal];
  store = {
    anilistToken: { accessToken: 'A', expiresAt: Number.MAX_SAFE_INTEGER },
    malToken: { accessToken: 'M', refreshToken: 'R', expiresAt: Number.MAX_SAFE_INTEGER },
    sessionEpoch: { anilist: 0, mal: 0 },
  };
  vi.spyOn(console, 'info').mockImplementation(() => {});
});

describe('carte « À noter » (DATA-01)', () => {
  it('« Plus tard » : la carte mémorise les sessions ouvertes', async () => {
    await deferRating(MEDIA, null);
    expect(await getPendingRatings()).toMatchObject([{ id: 'anilist:1001', epochs: { anilist: 0, mal: 0 } }]);
  });

  it('carte du compte AniList A, compte B connecté depuis : notée sur MAL seulement, puis retirée', async () => {
    await deferRating(MEDIA, null);
    store.sessionEpoch = { anilist: 1, mal: 0 };
    const outcome = await rateMedia(MEDIA, 8, true);
    expect(outcome).toMatchObject({ status: 'synced', results: [{ service: 'anilist', outcome: { status: 'skipped' } }, { service: 'mal', outcome: { status: 'updated' } }] });
    expect(anilist.scores).toEqual([]);
    expect(mal.scores).toEqual([8]);
    expect(await getPendingRatings()).toEqual([]);
  });

  it('note depuis la page (bulle après la synchro) : tous les services connectés, la carte n’y fait rien', async () => {
    await deferRating(MEDIA, null);
    store.sessionEpoch = { anilist: 1, mal: 0 };
    await rateMedia(MEDIA, 8);
    expect(anilist.scores).toEqual([8]);
    expect(mal.scores).toEqual([8]);
  });
});
