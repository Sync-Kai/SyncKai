import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setLocale } from '../i18n';
import type { MediaRef } from '../shared/engagement.types';
import type { TrackerId } from '../shared/tracker.types';
import type { ManualListStatus } from '../shared/sync.types';
import { ApiError } from './errors';
import type { ListEntryState, WriteStatus } from './sync/rules';
import type { CatalogMedia, TrackerEntry, TrackerService } from './ports/tracker';

const MEDIA_ID = 154587;
const MAL_ID = 52991;

// Services simulés en mémoire pour adjustProgress (le reste du fichier teste les règles pures)
const fakes = vi.hoisted(() => ({
  trackers: [] as TrackerService[],
  episodes: 12,
  /** idMal du catalogue simulé (null : fiche sans équivalent MAL) */
  idMal: null as number | null,
  ratingPrompt: true,
  deferred: [] as { media: MediaRef; coverUrl: string | null }[],
  deferOk: true,
  /** Erreur levée par la lecture du catalogue AniList (null : catalogue lisible) */
  catalogError: null as Error | null,
  /** Erreur levée par la lecture des réglages (null : réglages lisibles) */
  settingsError: null as Error | null,
}));

vi.mock('./trackers', () => ({
  getConnectedTrackers: async (only: readonly TrackerId[] | null = null): Promise<TrackerService[]> =>
    only ? fakes.trackers.filter((tracker) => only.includes(tracker.id)) : fakes.trackers,
}));
vi.mock('./sync/sync-service', () => ({
  getCatalogMedia: async (mediaId: number): Promise<CatalogMedia> => {
    if (fakes.catalogError) throw fakes.catalogError;
    return { mediaId, idMal: fakes.idMal, title: 'Frieren', episodes: fakes.episodes };
  },
}));
vi.mock('../browser/storage/settings-access', () => ({
  getSettings: async (): Promise<{ ratingPrompt: boolean }> => {
    if (fakes.settingsError) throw fakes.settingsError;
    return { ratingPrompt: fakes.ratingPrompt };
  },
}));
vi.mock('./engagement', () => ({
  deferRating: async (media: MediaRef, coverUrl: string | null): Promise<{ ok: true; data: null } | { ok: false; code: string; message: string }> => {
    fakes.deferred.push({ media, coverUrl });
    return fakes.deferOk ? { ok: true, data: null } : { ok: false, code: 'API_ERROR', message: 'x' };
  },
}));

const { addToList, adjustProgress, decideAdjustment, decideRetryAdjustment, handleCommand, setListStatus, shouldQueueRating } = await import('./controls');

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
  /** Écritures de statut reçues (saveStatus), dans l'ordre */
  statusSaves: { status: ManualListStatus; progress: number; repeat?: number }[];
}

function fakeTracker(id: TrackerId): FakeTracker {
  const unused = (): Promise<ListEntryState> => Promise.reject(new Error('hors test'));
  const tracker: FakeTracker = {
    id,
    entries: new Map(),
    saves: [],
    statusSaves: [],
    failNext: 0,
    isConnected: async () => true,
    resolveId: (media: CatalogMedia) => (id === 'anilist' ? media.mediaId : media.idMal),
    getEntry: async (entryId: number): Promise<TrackerEntry> => {
      const entry = tracker.entries.get(entryId);
      return { title: 'Frieren', episodes: fakes.episodes, entry: entry ? { ...entry } : null, notes: null };
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
    saveStatus: async (entryId, status, progress, repeat) => {
      if (tracker.failNext > 0) {
        tracker.failNext -= 1;
        throw new ApiError('API_ERROR', 'Service indisponible', { httpStatus: 503 });
      }
      tracker.statusSaves.push(repeat === undefined ? { status, progress } : { status, progress, repeat });
      const saved: ListEntryState = { status, progress };
      if (repeat !== undefined) saved.repeat = repeat;
      tracker.entries.set(entryId, saved);
      return saved;
    },
    saveEntry: unused,
    deleteEntry: () => Promise.reject(new Error('hors test')),
    saveNotes: () => Promise.reject(new Error('hors test')),
  };
  return tracker;
}

type Outcome = Awaited<ReturnType<typeof adjustProgress>>;
const resultsOf = (outcome: Outcome): unknown[] => (outcome.status === 'synced' ? outcome.results : []);

let anilist: FakeTracker;
let mal: FakeTracker;

beforeEach(() => {
  fakes.episodes = 12;
  fakes.idMal = MAL_ID;
  fakes.ratingPrompt = true;
  fakes.deferred = [];
  fakes.deferOk = true;
  fakes.catalogError = null;
  fakes.settingsError = null;
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

describe('adjustProgress', () => {
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

describe('adjustProgress, cas limites', () => {
  it('aucun service connecté : not-connected, rien n’est lu', async () => {
    fakes.trackers = [];
    expect(await adjustProgress({ mediaId: MEDIA_ID, malId: MAL_ID, delta: 1 })).toEqual({ status: 'not-connected' });
  });

  it('fiche sans équivalent sur les services connectés : erreur « aucun service ne la suit »', async () => {
    fakes.trackers = [mal];
    fakes.idMal = null;
    const outcome = await adjustProgress({ mediaId: MEDIA_ID, malId: null, delta: 1 });
    expect(outcome.status).toBe('error');
    expect(mal.saves).toEqual([]);
  });

  it('entrée MAL sans fiche AniList (mediaId null) : MAL seul avec son identifiant', async () => {
    mal.entries.set(MAL_ID, { status: 'CURRENT', progress: 2 });
    const outcome = await adjustProgress({ mediaId: null, malId: MAL_ID, delta: 1 });
    expect(mal.saves).toEqual([{ progress: 3, status: 'CURRENT' }]);
    expect(anilist.saves).toEqual([]);
    expect(resultsOf(outcome)).toEqual([{ service: 'mal', outcome: { status: 'updated', progress: 3, completed: false } }]);
  });

  it('erreur inattendue (non ApiError) sur un service : résultat d’erreur générique, l’autre service est écrit', async () => {
    anilist.entries.set(MEDIA_ID, { status: 'CURRENT', progress: 1 });
    mal.entries.set(MAL_ID, { status: 'CURRENT', progress: 1 });
    mal.saveProgress = () => Promise.reject(new Error('boom'));
    const results = resultsOf(await adjustProgress({ mediaId: MEDIA_ID, malId: MAL_ID, delta: 1 }));
    expect(results[0]).toEqual({ service: 'anilist', outcome: { status: 'updated', progress: 2, completed: false } });
    expect(results[1]).toMatchObject({ service: 'mal', outcome: { status: 'error' } });
    expect(results[1]).not.toMatchObject({ outcome: { code: expect.anything() as unknown } });
  });

  it('catalogue illisible (ApiError) : erreur du service remontée avec son code', async () => {
    fakes.trackers = [anilist];
    anilist.getEntry = () => Promise.reject(new ApiError('RATE_LIMITED', 'Trop de requêtes'));
    const outcome = await adjustProgress({ mediaId: MEDIA_ID, malId: null, delta: 1 });
    expect(resultsOf(outcome)).toEqual([{ service: 'anilist', outcome: { status: 'error', message: 'Trop de requêtes', code: 'RATE_LIMITED' } }]);
  });

  it('catalogue AniList illisible (ApiError) : erreur remontée avec son code, aucun service lu ni écrit', async () => {
    fakes.catalogError = new ApiError('RATE_LIMITED', 'Trop de requêtes');
    anilist.entries.set(MEDIA_ID, { status: 'CURRENT', progress: 3 });
    expect(await adjustProgress({ mediaId: MEDIA_ID, malId: MAL_ID, delta: 1 })).toEqual({ status: 'error', message: 'Trop de requêtes', code: 'RATE_LIMITED' });
    expect(anilist.saves).toEqual([]);
    expect(mal.saves).toEqual([]);
  });

  it('catalogue AniList : erreur inattendue → message générique, sans code', async () => {
    fakes.catalogError = new Error('boom');
    expect(await adjustProgress({ mediaId: MEDIA_ID, malId: MAL_ID, delta: 1 })).toEqual({ status: 'error', message: 'Erreur inattendue pendant l’ajustement.' });
  });

  it('total inconnu du service : celui du catalogue termine la série au dernier épisode', async () => {
    fakes.trackers = [anilist];
    anilist.getEntry = async (): Promise<TrackerEntry> => ({ title: 'Frieren', episodes: null, entry: { status: 'CURRENT', progress: 11 }, notes: null });
    await adjustProgress({ mediaId: MEDIA_ID, malId: null, delta: 1 });
    expect(anilist.saves).toEqual([{ progress: 12, status: 'COMPLETED' }]);
  });

  it('−1 : recule d’un épisode sur chaque service où la série est', async () => {
    anilist.entries.set(MEDIA_ID, { status: 'CURRENT', progress: 5 });
    mal.entries.set(MAL_ID, { status: 'CURRENT', progress: 5 });
    const outcome = await adjustProgress({ mediaId: MEDIA_ID, malId: MAL_ID, delta: -1 });
    expect(anilist.saves).toEqual([{ progress: 4, status: 'CURRENT' }]);
    expect(mal.saves).toEqual([{ progress: 4, status: 'CURRENT' }]);
    expect(resultsOf(outcome)).toEqual([
      { service: 'anilist', outcome: { status: 'updated', progress: 4, completed: false } },
      { service: 'mal', outcome: { status: 'updated', progress: 4, completed: false } },
    ]);
  });

  it('+1 sur une série déjà au dernier épisode : ignoré avec sa raison, sans code « absente »', async () => {
    fakes.trackers = [anilist];
    anilist.entries.set(MEDIA_ID, { status: 'COMPLETED', progress: 12 });
    const outcome = await adjustProgress({ mediaId: MEDIA_ID, malId: null, delta: 1 });
    expect(anilist.saves).toEqual([]);
    expect(resultsOf(outcome)).toEqual([{ service: 'anilist', outcome: { status: 'skipped', reason: 'Déjà au dernier épisode' } }]);
  });

  it('sans fiche AniList et service en échec (aucun titre lu) : titre de secours', async () => {
    mal.getEntry = () => Promise.reject(new ApiError('API_ERROR', 'Service indisponible'));
    const outcome = await adjustProgress({ mediaId: null, malId: MAL_ID, delta: 1 });
    expect(outcome).toEqual({ status: 'synced', mediaTitle: 'Série', results: [{ service: 'mal', outcome: { status: 'error', message: 'Service indisponible', code: 'API_ERROR' } }] });
  });
});

describe('setListStatus', () => {
  const COVER = 'https://s4.anilist.co/cover.jpg';

  it('aucun service connecté : not-connected', async () => {
    fakes.trackers = [];
    expect(await setListStatus({ mediaId: MEDIA_ID, malId: MAL_ID, status: 'PAUSED', coverUrl: null })).toEqual({ status: 'not-connected' });
  });

  it('série absente de la liste : « absente », aucune écriture', async () => {
    const outcome = await setListStatus({ mediaId: MEDIA_ID, malId: MAL_ID, status: 'PAUSED', coverUrl: null });
    expect(anilist.statusSaves).toEqual([]);
    expect(mal.statusSaves).toEqual([]);
    expect(resultsOf(outcome)).toEqual([
      { service: 'anilist', outcome: { status: 'skipped', reason: 'Absente de ta liste', code: 'not-in-list' } },
      { service: 'mal', outcome: { status: 'skipped', reason: 'Absente de ta liste', code: 'not-in-list' } },
    ]);
  });

  it('En pause : écrit sur chaque service où la série est, sans changer la progression ; statut déjà posé : à jour', async () => {
    anilist.entries.set(MEDIA_ID, { status: 'CURRENT', progress: 4 });
    mal.entries.set(MAL_ID, { status: 'PAUSED', progress: 4 });
    const outcome = await setListStatus({ mediaId: MEDIA_ID, malId: MAL_ID, status: 'PAUSED', coverUrl: null });
    expect(anilist.statusSaves).toEqual([{ status: 'PAUSED', progress: 4 }]);
    expect(mal.statusSaves).toEqual([]);
    expect(resultsOf(outcome)).toEqual([
      { service: 'anilist', outcome: { status: 'updated', progress: 4, completed: false } },
      { service: 'mal', outcome: { status: 'up-to-date', progress: 4 } },
    ]);
    expect(fakes.deferred).toEqual([]);
  });

  it('Terminé : progression portée au total, carte « À noter » créée et signalée au popup', async () => {
    anilist.entries.set(MEDIA_ID, { status: 'CURRENT', progress: 4 });
    const outcome = await setListStatus({ mediaId: MEDIA_ID, malId: MAL_ID, status: 'COMPLETED', coverUrl: COVER });
    expect(anilist.statusSaves).toEqual([{ status: 'COMPLETED', progress: 12 }]);
    expect(fakes.deferred).toEqual([{ media: { mediaId: MEDIA_ID, malId: MAL_ID, title: 'Frieren' }, coverUrl: COVER }]);
    expect(outcome).toMatchObject({ status: 'synced', prompts: { rate: { mediaId: MEDIA_ID, malId: MAL_ID, title: 'Frieren' } } });
  });

  it('Terminé en revisionnage : un revisionnage de plus', async () => {
    anilist.entries.set(MEDIA_ID, { status: 'REPEATING', progress: 5, repeat: 2 });
    await setListStatus({ mediaId: MEDIA_ID, malId: null, status: 'COMPLETED', coverUrl: null });
    expect(anilist.statusSaves).toEqual([{ status: 'COMPLETED', progress: 12, repeat: 3 }]);
  });

  it('Terminé avec une note déjà posée, ou proposition désactivée : pas de carte', async () => {
    anilist.entries.set(MEDIA_ID, { status: 'CURRENT', progress: 4, score: 80 });
    const scored = await setListStatus({ mediaId: MEDIA_ID, malId: null, status: 'COMPLETED', coverUrl: null });
    expect(scored).not.toHaveProperty('prompts');
    anilist.entries.set(MEDIA_ID, { status: 'CURRENT', progress: 4 });
    fakes.ratingPrompt = false;
    const disabled = await setListStatus({ mediaId: MEDIA_ID, malId: null, status: 'COMPLETED', coverUrl: null });
    expect(disabled).not.toHaveProperty('prompts');
    expect(fakes.deferred).toEqual([]);
  });

  it('carte « À noter » impossible à enregistrer : le changement de statut reste réussi, sans prompt', async () => {
    anilist.entries.set(MEDIA_ID, { status: 'CURRENT', progress: 4 });
    fakes.deferOk = false;
    const outcome = await setListStatus({ mediaId: MEDIA_ID, malId: null, status: 'COMPLETED', coverUrl: null });
    expect(outcome.status).toBe('synced');
    expect(outcome).not.toHaveProperty('prompts');
  });

  it('échec d’un service : erreur sur celui-là seul, l’autre est écrit', async () => {
    anilist.entries.set(MEDIA_ID, { status: 'CURRENT', progress: 4 });
    mal.entries.set(MAL_ID, { status: 'CURRENT', progress: 4 });
    mal.failNext = 1;
    const outcome = await setListStatus({ mediaId: MEDIA_ID, malId: MAL_ID, status: 'DROPPED', coverUrl: null });
    expect(resultsOf(outcome)).toEqual([
      { service: 'anilist', outcome: { status: 'updated', progress: 4, completed: false } },
      { service: 'mal', outcome: { status: 'error', message: 'Service indisponible', code: 'API_ERROR' } },
    ]);
  });

  it('fiche sans équivalent sur les services connectés : erreur « aucun service ne la suit »', async () => {
    fakes.trackers = [mal];
    fakes.idMal = null;
    expect(await setListStatus({ mediaId: MEDIA_ID, malId: null, status: 'PAUSED', coverUrl: null })).toEqual({ status: 'error', message: 'Aucun service connecté n’a de fiche pour cette série.' });
  });

  it('catalogue illisible : ApiError remontée avec son code ; erreur inattendue : message générique', async () => {
    fakes.catalogError = new ApiError('RATE_LIMITED', 'Trop de requêtes');
    expect(await setListStatus({ mediaId: MEDIA_ID, malId: MAL_ID, status: 'PAUSED', coverUrl: null })).toEqual({ status: 'error', message: 'Trop de requêtes', code: 'RATE_LIMITED' });
    fakes.catalogError = new Error('boom');
    expect(await setListStatus({ mediaId: MEDIA_ID, malId: MAL_ID, status: 'PAUSED', coverUrl: null })).toEqual({ status: 'error', message: 'Erreur inattendue pendant le changement de statut.' });
    expect(anilist.statusSaves).toEqual([]);
  });

  it('entrée MAL sans fiche AniList (mediaId null), Terminé : carte « À noter » avec l’idMal du popup et le titre lu sur MAL', async () => {
    mal.entries.set(MAL_ID, { status: 'CURRENT', progress: 4 });
    const outcome = await setListStatus({ mediaId: null, malId: MAL_ID, status: 'COMPLETED', coverUrl: null });
    expect(mal.statusSaves).toEqual([{ status: 'COMPLETED', progress: 12 }]);
    expect(anilist.statusSaves).toEqual([]);
    expect(fakes.deferred).toEqual([{ media: { mediaId: null, malId: MAL_ID, title: 'Frieren' }, coverUrl: null }]);
    expect(outcome).toMatchObject({ status: 'synced', mediaTitle: 'Frieren', prompts: { rate: { mediaId: null, malId: MAL_ID } } });
  });

  it('total inconnu du service : Terminé porte la progression au total du catalogue', async () => {
    fakes.trackers = [anilist];
    anilist.getEntry = async (): Promise<TrackerEntry> => ({ title: 'Frieren', episodes: null, entry: { status: 'CURRENT', progress: 4 }, notes: null });
    await setListStatus({ mediaId: MEDIA_ID, malId: null, status: 'COMPLETED', coverUrl: null });
    expect(anilist.statusSaves).toEqual([{ status: 'COMPLETED', progress: 12 }]);
  });

  it('réglages illisibles : statut écrit, pas de carte « À noter » (facultative)', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    fakes.settingsError = new Error('storage');
    anilist.entries.set(MEDIA_ID, { status: 'CURRENT', progress: 4 });
    const outcome = await setListStatus({ mediaId: MEDIA_ID, malId: null, status: 'COMPLETED', coverUrl: null });
    expect(anilist.statusSaves).toEqual([{ status: 'COMPLETED', progress: 12 }]);
    expect(outcome.status).toBe('synced');
    expect(outcome).not.toHaveProperty('prompts');
    expect(fakes.deferred).toEqual([]);
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('sans fiche AniList et service en échec (aucun titre lu) : titre de secours, pas de carte', async () => {
    mal.getEntry = () => Promise.reject(new Error('boom'));
    const outcome = await setListStatus({ mediaId: null, malId: MAL_ID, status: 'COMPLETED', coverUrl: null });
    expect(outcome).toMatchObject({ status: 'synced', mediaTitle: 'Série', results: [{ service: 'mal', outcome: { status: 'error', message: 'Erreur inattendue.' } }] });
    expect(outcome).not.toHaveProperty('prompts');
  });
});

describe('addToList', () => {
  it('aucun service connecté : not-connected', async () => {
    fakes.trackers = [];
    expect(await addToList({ mediaId: MEDIA_ID, malId: null, status: 'PLANNING' })).toEqual({ status: 'not-connected' });
  });

  it('série absente : ajoutée à 0 épisode sur chaque service', async () => {
    const outcome = await addToList({ mediaId: MEDIA_ID, malId: null, status: 'PLANNING' });
    expect(anilist.statusSaves).toEqual([{ status: 'PLANNING', progress: 0 }]);
    expect(mal.statusSaves).toEqual([{ status: 'PLANNING', progress: 0 }]);
    expect(outcome).toMatchObject({ status: 'synced', mediaTitle: 'Frieren' });
    expect(resultsOf(outcome)).toEqual([
      { service: 'anilist', outcome: { status: 'updated', progress: 0, completed: false } },
      { service: 'mal', outcome: { status: 'updated', progress: 0, completed: false } },
    ]);
  });

  it('entrée existante (n’importe quel statut) : jamais modifiée', async () => {
    anilist.entries.set(MEDIA_ID, { status: 'COMPLETED', progress: 12 });
    await addToList({ mediaId: MEDIA_ID, malId: null, status: 'CURRENT' });
    expect(anilist.statusSaves).toEqual([]);
    expect(anilist.entries.get(MEDIA_ID)).toEqual({ status: 'COMPLETED', progress: 12 });
  });

  it('idMal du catalogue absent : celui du popup en secours', async () => {
    fakes.idMal = null;
    await addToList({ mediaId: MEDIA_ID, malId: MAL_ID, status: 'CURRENT' });
    expect(mal.statusSaves).toEqual([{ status: 'CURRENT', progress: 0 }]);
  });

  it('aucun idMal nulle part : MAL signalé « sans équivalent » plutôt qu’omis', async () => {
    fakes.idMal = null;
    const outcome = await addToList({ mediaId: MEDIA_ID, malId: null, status: 'CURRENT' });
    expect(mal.statusSaves).toEqual([]);
    expect(resultsOf(outcome)).toEqual([
      { service: 'anilist', outcome: { status: 'updated', progress: 0, completed: false } },
      { service: 'mal', outcome: { status: 'skipped', reason: expect.any(String) as unknown } },
    ]);
  });

  it('MAL seul connecté et sans équivalent : erreur « aucun service ne la suit »', async () => {
    fakes.trackers = [mal];
    fakes.idMal = null;
    expect((await addToList({ mediaId: MEDIA_ID, malId: null, status: 'CURRENT' })).status).toBe('error');
  });

  it('échec d’un service : erreur sur celui-là seul, l’autre est ajouté', async () => {
    mal.failNext = 1;
    const outcome = await addToList({ mediaId: MEDIA_ID, malId: null, status: 'PLANNING' });
    expect(anilist.statusSaves).toEqual([{ status: 'PLANNING', progress: 0 }]);
    expect(mal.statusSaves).toEqual([]);
    expect(resultsOf(outcome)).toEqual([
      { service: 'anilist', outcome: { status: 'updated', progress: 0, completed: false } },
      { service: 'mal', outcome: { status: 'error', message: 'Service indisponible', code: 'API_ERROR' } },
    ]);
  });

  it('catalogue illisible : ApiError remontée avec son code ; erreur inattendue : message générique', async () => {
    fakes.catalogError = new ApiError('RATE_LIMITED', 'Trop de requêtes');
    expect(await addToList({ mediaId: MEDIA_ID, malId: null, status: 'PLANNING' })).toEqual({ status: 'error', message: 'Trop de requêtes', code: 'RATE_LIMITED' });
    fakes.catalogError = new Error('boom');
    expect(await addToList({ mediaId: MEDIA_ID, malId: null, status: 'PLANNING' })).toEqual({ status: 'error', message: 'Erreur inattendue lors de l’ajout à la liste.' });
    expect(anilist.statusSaves).toEqual([]);
  });
});

describe('handleCommand (raccourci « valider l’épisode »)', () => {
  const sendMessage = vi.fn<(tabId: number, message: unknown) => Promise<unknown>>();
  const query = vi.fn<() => Promise<{ id?: number }[]>>();

  beforeEach(() => {
    sendMessage.mockReset();
    query.mockReset();
    vi.stubGlobal('chrome', { tabs: { query, sendMessage } });
  });

  it('commande inconnue : rien n’est fait', async () => {
    await handleCommand('open-side-panel');
    expect(query).not.toHaveBeenCalled();
  });

  it('envoie FORCE_COMPLETE à l’onglet actif', async () => {
    query.mockResolvedValue([{ id: 7 }]);
    sendMessage.mockResolvedValue(undefined);
    await handleCommand('complete-episode');
    expect(query).toHaveBeenCalledWith({ active: true, lastFocusedWindow: true });
    expect(sendMessage).toHaveBeenCalledWith(7, { type: 'FORCE_COMPLETE' });
  });

  it('aucun onglet actif : rien n’est envoyé', async () => {
    query.mockResolvedValue([]);
    await handleCommand('complete-episode');
    expect(sendMessage).not.toHaveBeenCalled();
  });

  it('onglet sans script de contenu : silencieux ; autre erreur : avertissement', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    query.mockResolvedValue([{ id: 7 }]);
    sendMessage.mockRejectedValueOnce(new Error('Could not establish connection. Receiving end does not exist.'));
    await handleCommand('complete-episode');
    expect(warn).not.toHaveBeenCalled();
    sendMessage.mockRejectedValueOnce(new Error('autre'));
    await handleCommand('complete-episode');
    expect(warn).toHaveBeenCalledTimes(1);
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
