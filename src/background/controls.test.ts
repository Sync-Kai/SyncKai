import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setLocale } from '../i18n';
import type { TrackerId } from '../shared/tracker.types';
import { ApiError } from './api/errors';
import type { ListEntryState, WriteStatus } from './sync/rules';
import type { CatalogMedia, TrackerEntry, TrackerService } from './trackers/tracker';

const MEDIA_ID = 154587;
const MAL_ID = 52991;

// Services simulés en mémoire pour adjustProgress (le reste du fichier teste les règles pures)
const fakes = vi.hoisted(() => ({ trackers: [] as TrackerService[], episodes: 12 as number | null }));

vi.mock('./trackers', () => ({
  getConnectedTrackers: async (only: readonly TrackerId[] | null = null): Promise<TrackerService[]> =>
    only ? fakes.trackers.filter((tracker) => only.includes(tracker.id)) : fakes.trackers,
}));
vi.mock('./sync/sync-service', () => ({
  getCatalogMedia: async (mediaId: number): Promise<CatalogMedia> => ({ mediaId, idMal: MAL_ID, title: 'Frieren', episodes: fakes.episodes }),
}));

const { adjustProgress, decideAdjustment, decideRetryAdjustment, shouldQueueRating } = await import('./controls');

// Textes attendus en français
setLocale('fr');

const NOT_IN_LIST = { action: 'skip', reason: 'Absente de ta liste', notInList: true } as const;

describe('decideAdjustment', () => {
  it('+1 avance et passe en cours', () => {
    expect(decideAdjustment({ status: 'CURRENT', progress: 3 }, 12, 1)).toEqual({ action: 'write', progress: 4, status: 'CURRENT' });
    expect(decideAdjustment({ status: 'PAUSED', progress: 0 }, null, 1)).toEqual({ action: 'write', progress: 1, status: 'CURRENT' });
  });

  it('série absente de la liste : +1 / −1 ne l’y ajoute jamais (skip notInList)', () => {
    expect(decideAdjustment(null, 12, 1)).toEqual(NOT_IN_LIST);
    expect(decideAdjustment(null, null, 1)).toEqual(NOT_IN_LIST);
    expect(decideAdjustment(null, 12, -1)).toEqual(NOT_IN_LIST);
  });

  it('+1 sur le dernier épisode termine l’anime', () => {
    expect(decideAdjustment({ status: 'CURRENT', progress: 11 }, 12, 1)).toEqual({ action: 'write', progress: 12, status: 'COMPLETED' });
  });

  it('revisionnage : +1 reste en REPEATING, le dernier épisode le termine avec le compteur + 1', () => {
    expect(decideAdjustment({ status: 'REPEATING', progress: 4, repeat: 1 }, 12, 1)).toEqual({ action: 'write', progress: 5, status: 'REPEATING' });
    expect(decideAdjustment({ status: 'REPEATING', progress: 11, repeat: 1 }, 12, 1)).toEqual({ action: 'write', progress: 12, status: 'COMPLETED', repeat: 2 });
    expect(decideAdjustment({ status: 'REPEATING', progress: 11 }, 12, 1)).toEqual({ action: 'write', progress: 12, status: 'COMPLETED', repeat: 1 });
  });

  it('+1 au-delà du total est refusé', () => {
    expect(decideAdjustment({ status: 'COMPLETED', progress: 12 }, 12, 1)).toEqual({ action: 'skip', reason: 'Déjà au dernier épisode' });
  });

  it('−1 sur une entrée terminée la repasse en cours', () => {
    expect(decideAdjustment({ status: 'COMPLETED', progress: 12 }, 12, -1)).toEqual({ action: 'write', progress: 11, status: 'CURRENT' });
  });

  it('−1 à zéro ne fait rien', () => {
    expect(decideAdjustment({ status: 'CURRENT', progress: 0 }, 12, -1)).toEqual({ action: 'skip', reason: 'Aucun épisode à retirer' });
  });

  it('total inconnu : jamais terminé automatiquement', () => {
    expect(decideAdjustment({ status: 'CURRENT', progress: 1100 }, null, 1)).toEqual({ action: 'write', progress: 1101, status: 'CURRENT' });
  });
});

describe('decideRetryAdjustment (nouvel essai après un échec partiel)', () => {
  it('écrit la progression absolue visée, statut selon les règles de la synchro', () => {
    expect(decideRetryAdjustment({ status: 'CURRENT', progress: 5 }, 12, 1, 6)).toEqual({ action: 'write', progress: 6, status: 'CURRENT' });
    expect(decideRetryAdjustment({ status: 'REPEATING', progress: 11, repeat: 2 }, 12, 1, 12)).toEqual({ action: 'write', progress: 12, status: 'COMPLETED', repeat: 3 });
    expect(decideRetryAdjustment({ status: 'COMPLETED', progress: 12 }, 12, -1, 11)).toEqual({ action: 'write', progress: 11, status: 'CURRENT' });
  });

  it('déjà à la valeur (ou au-delà dans le sens du delta) : rien n’est réécrit', () => {
    expect(decideRetryAdjustment({ status: 'CURRENT', progress: 6 }, 12, 1, 6)).toEqual({ action: 'up-to-date', progress: 6 });
    expect(decideRetryAdjustment({ status: 'CURRENT', progress: 8 }, 12, 1, 6)).toEqual({ action: 'up-to-date', progress: 8 });
    expect(decideRetryAdjustment({ status: 'CURRENT', progress: 3 }, 12, -1, 4)).toEqual({ action: 'up-to-date', progress: 3 });
  });

  it('série absente ou cible au-delà du total : refusé', () => {
    expect(decideRetryAdjustment(null, 12, 1, 6)).toEqual(NOT_IN_LIST);
    expect(decideRetryAdjustment({ status: 'CURRENT', progress: 5 }, 12, 1, 13)).toEqual({ action: 'skip', reason: 'Déjà au dernier épisode' });
  });
});

// ─── adjustProgress sur des services simulés ─────────────────────────────

interface FakeTracker extends TrackerService {
  entries: Map<number, ListEntryState>;
  /** Écritures reçues, dans l'ordre */
  saves: { progress: number; status: WriteStatus; repeat?: number }[];
  /** Nombre de prochaines écritures en échec (503) */
  failNext: number;
}

function fakeTracker(id: TrackerId): FakeTracker {
  const unused = (): Promise<ListEntryState> => Promise.reject(new Error('hors test'));
  const tracker: FakeTracker = {
    id,
    entries: new Map(),
    saves: [],
    failNext: 0,
    isConnected: async () => true,
    resolveId: (media: CatalogMedia) => (id === 'anilist' ? media.mediaId : media.idMal),
    getEntry: async (entryId: number): Promise<TrackerEntry> => {
      const entry = tracker.entries.get(entryId);
      return { title: 'Frieren', episodes: fakes.episodes, entry: entry ? { ...entry } : null };
    },
    saveProgress: async (entryId, progress, status, repeat) => {
      if (tracker.failNext > 0) {
        tracker.failNext -= 1;
        throw new ApiError('API_ERROR', 'Service indisponible', { httpStatus: 503 });
      }
      tracker.saves.push(repeat === undefined ? { progress, status } : { progress, status, repeat });
      const saved: ListEntryState = { status, progress };
      const count = repeat ?? tracker.entries.get(entryId)?.repeat;
      if (count !== undefined) saved.repeat = count;
      tracker.entries.set(entryId, saved);
      return saved;
    },
    saveScore: unused,
    startRewatch: unused,
    saveStatus: unused,
    saveEntry: unused,
  };
  return tracker;
}

type Outcome = Awaited<ReturnType<typeof adjustProgress>>;
const resultsOf = (outcome: Outcome): unknown[] => (outcome.status === 'synced' ? outcome.results : []);

describe('adjustProgress', () => {
  let anilist: FakeTracker;
  let mal: FakeTracker;

  beforeEach(() => {
    fakes.episodes = 12;
    anilist = fakeTracker('anilist');
    mal = fakeTracker('mal');
    fakes.trackers = [anilist, mal];
    // Web Locks : exécution directe (la sérialisation par fiche est couverte par entry-lock.test.ts)
    vi.stubGlobal('navigator', { language: 'fr', locks: { request: (_name: string, task: () => Promise<unknown>) => task() } });
    vi.spyOn(console, 'info').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('série absente de MAL : +1 n’y crée pas d’entrée, MAL signalé « absente » (notInList)', async () => {
    anilist.entries.set(MEDIA_ID, { status: 'CURRENT', progress: 7 });
    const outcome = await adjustProgress({ mediaId: MEDIA_ID, malId: MAL_ID, delta: 1 });
    expect(anilist.entries.get(MEDIA_ID)).toEqual({ status: 'CURRENT', progress: 8 });
    expect(mal.saves).toEqual([]);
    expect(mal.entries.has(MAL_ID)).toBe(false);
    expect(resultsOf(outcome)).toEqual([
      { service: 'anilist', outcome: { status: 'updated', progress: 8, completed: false } },
      { service: 'mal', outcome: { status: 'skipped', reason: 'Absente de ta liste', code: 'not-in-list' } },
    ]);
  });

  it('revisionnage 11/12 puis +1 : COMPLETED avec un revisionnage de plus sur chaque service', async () => {
    anilist.entries.set(MEDIA_ID, { status: 'REPEATING', progress: 11, repeat: 1 });
    mal.entries.set(MAL_ID, { status: 'REPEATING', progress: 11, repeat: 1 });
    await adjustProgress({ mediaId: MEDIA_ID, malId: MAL_ID, delta: 1 });
    expect(anilist.saves).toEqual([{ progress: 12, status: 'COMPLETED', repeat: 2 }]);
    expect(mal.saves).toEqual([{ progress: 12, status: 'COMPLETED', repeat: 2 }]);
  });

  it('échec partiel puis nouvel essai : progression absolue sur le seul service en échec, l’autre n’est pas décalé', async () => {
    anilist.entries.set(MEDIA_ID, { status: 'CURRENT', progress: 5 });
    mal.entries.set(MAL_ID, { status: 'CURRENT', progress: 5 });
    mal.failNext = 1;
    const first = await adjustProgress({ mediaId: MEDIA_ID, malId: MAL_ID, delta: 1 });
    expect(resultsOf(first)).toEqual([
      { service: 'anilist', outcome: { status: 'updated', progress: 6, completed: false } },
      { service: 'mal', outcome: { status: 'error', message: 'Service indisponible', code: 'API_ERROR' } },
    ]);

    const retry = await adjustProgress({ mediaId: MEDIA_ID, malId: MAL_ID, delta: 1, retry: { services: ['mal'], progress: 6 } });
    expect(resultsOf(retry)).toEqual([{ service: 'mal', outcome: { status: 'updated', progress: 6, completed: false } }]);
    expect(anilist.saves).toEqual([{ progress: 6, status: 'CURRENT' }]);
    expect(mal.saves).toEqual([{ progress: 6, status: 'CURRENT' }]);
    expect(anilist.entries.get(MEDIA_ID)?.progress).toBe(6);
    expect(mal.entries.get(MAL_ID)?.progress).toBe(6);
  });

  it('nouvel essai alors que l’écriture était passée malgré l’erreur : rien n’est réécrit', async () => {
    anilist.entries.set(MEDIA_ID, { status: 'CURRENT', progress: 6 });
    mal.entries.set(MAL_ID, { status: 'CURRENT', progress: 6 });
    const retry = await adjustProgress({ mediaId: MEDIA_ID, malId: MAL_ID, delta: 1, retry: { services: ['mal'], progress: 6 } });
    expect(mal.saves).toEqual([]);
    expect(resultsOf(retry)).toEqual([{ service: 'mal', outcome: { status: 'up-to-date', progress: 6 } }]);
  });
});

describe('shouldQueueRating', () => {
  const completed = { result: { service: 'anilist', outcome: { status: 'updated', progress: 12, completed: true } }, scored: false } as const;
  const malUpToDate = { result: { service: 'mal', outcome: { status: 'up-to-date', progress: 12 } }, scored: false } as const;

  it('carte « À noter » après Terminé, sans note existante', () => {
    expect(shouldQueueRating('COMPLETED', [completed, malUpToDate], true)).toBe(true);
  });

  it('pas de carte si une note existe sur un service', () => {
    expect(shouldQueueRating('COMPLETED', [completed, { ...malUpToDate, scored: true }], true)).toBe(false);
  });

  it('pas de carte si la proposition de note est désactivée', () => {
    expect(shouldQueueRating('COMPLETED', [completed], false)).toBe(false);
  });

  it('pas de carte pour En pause / Abandonné, ni sans passage effectif en Terminé', () => {
    expect(shouldQueueRating('PAUSED', [completed], true)).toBe(false);
    expect(shouldQueueRating('DROPPED', [completed], true)).toBe(false);
    expect(shouldQueueRating('COMPLETED', [malUpToDate], true)).toBe(false);
  });
});
