import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setLocale, t } from '../i18n';
import type { HistorySeason } from '../shared/cr-history';
import { CR_IMPORT_ALARM, CR_IMPORT_KEYS, isCrImportJob, isCrImportPlan, startAnalyzeJob, type CrImportJob, type CrImportPlan, type CrPlanItem } from '../shared/cr-import';
import type { EpisodeInfo } from '../shared/episode.types';
import { isRecord } from '../shared/guards';
import { STORAGE_KEYS } from '../shared/storage';
import type { MediaMapping } from '../shared/sync.types';
import type { TrackerId } from '../shared/tracker.types';
import { installFakeChrome } from '../test/fake-chrome';
import { ApiError } from './api/errors';
import type { EpisodeResolution } from './sync/resolver';
import type { ListEntryState, WriteStatus } from './sync/rules';
import type { TrackerEntry, TrackerService } from './trackers/tracker';

// Import de l'historique Crunchyroll côté service worker (TEST-05) : vraies boucles d'analyse et d'application,
// vrai stockage (fausse API chrome partagée), résolveur, catalogue, listes et services simulés.

const fakes = vi.hoisted(() => ({
  trackers: [] as TrackerService[],
  /** Résolution de chaque saison (appelée avec l'épisode équivalent et les options) */
  resolve: vi.fn<(episode: EpisodeInfo, options?: { persist?: boolean; lane?: string }) => Promise<EpisodeResolution>>(),
}));

vi.mock('./sync/resolver', () => ({ resolveEpisode: fakes.resolve }));
vi.mock('./trackers', () => ({ getConnectedTrackers: async (): Promise<TrackerService[]> => fakes.trackers }));
vi.mock('./api/media', () => ({
  getAnimeByIds: async (ids: number[]) => ids.map((id) => ({ id, idMal: id + 1000, displayTitle: `Fiche ${id}`, coverUrl: null, episodes: 24 })),
}));
// Listes vides : chaque saison sûre donne un élément à mettre à jour
vi.mock('./compare', () => ({ fetchAniListFullList: async () => [], fetchMalFullList: async () => [] }));
vi.mock('../shared/badge', () => ({ refreshReviewBadge: async () => undefined }));
// Espacement des écritures et budget AniList sans attente
vi.mock('./jobs/runner', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./jobs/runner')>()),
  waitWriteSlot: async () => undefined,
  waitReadSlot: async () => undefined,
}));

const fake = installFakeChrome();
const realSetTimeout = globalThis.setTimeout;

/** Sessions AniList et MAL ouvertes (génération 0) */
const OPEN_SESSIONS = {
  [STORAGE_KEYS.anilistToken]: { accessToken: 'anilist', expiresAt: Number.MAX_SAFE_INTEGER },
  [STORAGE_KEYS.malToken]: { accessToken: 'mal', refreshToken: 'refresh', expiresAt: Number.MAX_SAFE_INTEGER },
};

const crImport = await import('./cr-import');
const { cancelCrImport, resumeCrImport, startCrAnalyze, startCrApply, WRITE_BATCH_SIZE } = crImport;
const { RETRY_DELAYS_MS } = await import('./jobs/runner');

setLocale('fr');

// ─── Services en mémoire ──────────────────────────────────────────────────

interface FakeTracker extends TrackerService {
  entries: Map<number, ListEntryState>;
  writes: { id: number; progress: number; status: WriteStatus }[];
  reads: number;
  /** Erreurs levées aux prochaines écritures, dans l'ordre (la dernière se répète si `persistent`) */
  failures: ApiError[];
  persistent: boolean;
  attempts: number;
}

function fakeTracker(id: TrackerId): FakeTracker {
  const tracker: FakeTracker = {
    id,
    entries: new Map(),
    writes: [],
    reads: 0,
    failures: [],
    persistent: false,
    attempts: 0,
    isConnected: async () => true,
    resolveId: (media) => (id === 'anilist' ? media.mediaId : media.idMal),
    getEntry: async (entryId: number): Promise<TrackerEntry> => {
      tracker.reads++;
      const entry = tracker.entries.get(entryId);
      return { title: `#${entryId}`, episodes: 24, entry: entry ? { ...entry } : null };
    },
    saveProgress: async (entryId, progress, status) => {
      tracker.attempts++;
      const failure = tracker.persistent ? tracker.failures[0] : tracker.failures.shift();
      if (failure) throw failure;
      tracker.writes.push({ id: entryId, progress, status });
      const saved: ListEntryState = { ...tracker.entries.get(entryId), status, progress };
      tracker.entries.set(entryId, saved);
      return saved;
    },
    saveStatus: () => Promise.reject(new Error('hors test')),
    saveScore: () => Promise.reject(new Error('hors test')),
    startRewatch: () => Promise.reject(new Error('hors test')),
    saveEntry: () => Promise.reject(new Error('hors test')),
  };
  return tracker;
}

let anilist: FakeTracker;
let mal: FakeTracker;

// ─── Historique, résolutions ──────────────────────────────────────────────

/** Saison Crunchyroll n°i (série `GR{i}`) ; `seasonEpisodeNumber` null : position dans la saison inconnue */
function season(i: number, seasonEpisodeNumber: number | null = 3): HistorySeason {
  return {
    seriesId: `GR${i}`,
    seriesTitle: `Série ${i}`,
    seriesSlug: null,
    seasonId: `GS${i}`,
    seasonNumber: 2,
    seasonTitle: null,
    episodeId: `GE${i}`,
    episodeTitle: null,
    episodeNumber: seasonEpisodeNumber ?? 25,
    seasonEpisodeNumber,
    watchedCount: 3,
    lastPlayedAt: 1,
  };
}

const mapping = (mediaId: number, numbering: MediaMapping['numbering'] = 'season'): MediaMapping => ({ mediaId, numbering, offset: 0, episodes: 24 });

/** Correspondance sûre : la série `GR{i}` → fiche 100 + i, épisode affiché */
function certain(episode: EpisodeInfo): EpisodeResolution {
  const mediaId = 100 + Number(episode.seriesId?.slice(2));
  return {
    result: { ok: true, target: { ...mapping(mediaId), progress: episode.displayedEpisodeNumber ?? 1, confidence: 'high', reason: 'Lien Crunchyroll' } },
    candidates: [],
    seasons: [],
    seasonGroups: [],
  };
}

const history = (seasons: HistorySeason[]) => ({ history: { seasons, stats: { items: seasons.length, pages: 1, partial: false } } });

// ─── Lecture du stockage ──────────────────────────────────────────────────

function storedJob(): CrImportJob | null {
  const value = fake.local.peek(CR_IMPORT_KEYS.job);
  return isCrImportJob(value) ? value : null;
}

function storedPlan(): CrImportPlan {
  const value = fake.local.peek(CR_IMPORT_KEYS.plan);
  if (!isCrImportPlan(value)) throw new Error('aperçu absent');
  return value;
}

const keysOf = (value: unknown): string[] => (isRecord(value) ? Object.keys(value) : []);

/** Laisse avancer ce qui n'attend pas l'horloge (stockage, verrous, promesses) */
async function flush(): Promise<void> {
  for (let i = 0; i < 10; i++) await new Promise<void>((resolve) => realSetTimeout(resolve, 0));
}

/** Attend la fin de la tâche (alarme retirée, bilan de fin exécuté) */
async function untilEnded(): Promise<CrImportJob> {
  await vi.waitFor(() => expect(storedJob()?.status).not.toBe('running'));
  await flush();
  const job = storedJob();
  if (!job) throw new Error('tâche absente');
  return job;
}

beforeEach(() => {
  fake.reset({ ...OPEN_SESSIONS });
  anilist = fakeTracker('anilist');
  mal = fakeTracker('mal');
  fakes.trackers = [anilist, mal];
  fakes.resolve.mockReset();
  fakes.resolve.mockImplementation(async (episode) => certain(episode));
  vi.spyOn(console, 'info').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

// ─── Analyse ──────────────────────────────────────────────────────────────

describe('analyse de l’historique (TEST-05)', () => {
  it('saison sans position connue (seasonEpisodeNumber null) : à vérifier, jamais appliquée ; numéro « displayed » appris : sûre', async () => {
    // Saison 2 : numéro affiché appris par la synchro en direct (numérotation absolue)
    fake.local.data.set(STORAGE_KEYS.mediaMappings, { 'crunchyroll:GR2:s2': mapping(102, 'displayed') });
    expect((await startCrAnalyze(history([season(0, null), season(1, 3), season(2, null)]))).ok).toBe(true);
    expect(await untilEnded()).toMatchObject({ status: 'done' });

    const plan = storedPlan();
    expect(plan.review.map((r) => [r.key, r.reason, r.suggestion])).toEqual([['crunchyroll:GR0:s2', t('crImport.reason.numbering'), { mediaId: 100, progress: 25 }]]);
    expect(plan.items.map((i) => i.mediaId).sort()).toEqual([101, 102]);
  });

  it('résolveur appelé en lecture seule (persist:false, budget de fond) : aucune correspondance écrite pendant l’analyse', async () => {
    await startCrAnalyze(history([season(0), season(1)]));
    await untilEnded();
    expect(fakes.resolve).toHaveBeenCalledTimes(2);
    for (const [, options] of fakes.resolve.mock.calls) expect(options).toMatchObject({ persist: false, lane: 'background' });
    expect(fake.local.peek(STORAGE_KEYS.mediaMappings)).toBeUndefined();
  });

  it('PERF-02 : correspondances écrites par lots, historique lu une seule fois', async () => {
    const count = WRITE_BATCH_SIZE * 2 + 5;
    const set = vi.spyOn(fake.local, 'set');
    const get = vi.spyOn(fake.local, 'get');
    await startCrAnalyze(history(Array.from({ length: count }, (_, i) => season(i))));
    expect(await untilEnded()).toMatchObject({ status: 'done', updated: count + 1 });

    const resolutionWrites = set.mock.calls.filter(([items]) => CR_IMPORT_KEYS.resolutions in items);
    // Écriture initiale ({}) puis un lot par WRITE_BATCH_SIZE saisons (dernier lot à la fin de l'analyse)
    expect(resolutionWrites.length).toBeLessThanOrEqual(1 + Math.ceil(count / WRITE_BATCH_SIZE));
    const inputReads = get.mock.calls.filter(([keys]) => keys === CR_IMPORT_KEYS.input || (Array.isArray(keys) && keys.includes(CR_IMPORT_KEYS.input)));
    expect(inputReads).toHaveLength(0);
    expect(storedPlan().items).toHaveLength(count);
  });

  it('service worker arrêté entre deux lots : les correspondances perdues sont recalculées avant l’aperçu', async () => {
    // Troisième saison retenue : la boucle de ce service worker ne va pas plus loin
    let release: () => void = () => undefined;
    fakes.resolve.mockImplementation(async (episode) => {
      if (episode.seriesId === 'GR2' && fakes.resolve.mock.calls.length === 3) await new Promise<void>((resolve) => (release = resolve));
      return certain(episode);
    });
    await startCrAnalyze(history([season(0), season(1), season(2), season(3)]));
    await vi.waitFor(() => expect(fakes.resolve).toHaveBeenCalledTimes(3));
    // Saisons 0 et 1 traitées mais pas encore écrites (lot incomplet)
    expect(storedJob()).toMatchObject({ done: 2 });
    expect(keysOf(fake.local.peek(CR_IMPORT_KEYS.resolutions))).toEqual([]);

    // Nouveau service worker : mémoire vide, reprise par l'alarme
    vi.resetModules();
    const restarted = await import('./cr-import');
    await restarted.resumeCrImport();
    await untilEnded();
    expect(storedPlan().items.map((i) => i.mediaId).sort()).toEqual([100, 101, 102, 103]);
    release();
    await flush();
  });

  it('CRI-04 : « Arrêter » → historique réduit et correspondances effacés', async () => {
    let release: () => void = () => undefined;
    fakes.resolve.mockImplementationOnce(async (episode) => {
      await new Promise<void>((resolve) => (release = resolve));
      return certain(episode);
    });
    await startCrAnalyze(history([season(0), season(1), season(2)]));
    await vi.waitFor(() => expect(fakes.resolve).toHaveBeenCalledTimes(1));
    expect(fake.local.peek(CR_IMPORT_KEYS.input)).toBeDefined();

    expect((await cancelCrImport()).ok).toBe(true);
    release();
    expect(await untilEnded()).toMatchObject({ status: 'cancelled' });
    expect(fake.local.peek(CR_IMPORT_KEYS.input)).toBeUndefined();
    expect(fake.local.peek(CR_IMPORT_KEYS.resolutions)).toBeUndefined();
    expect(fake.local.peek(CR_IMPORT_KEYS.plan)).toBeUndefined();
  });

  it('CRI-04 : erreur bloquante (session refusée) → arrêt, historique réduit effacé', async () => {
    fakes.resolve.mockRejectedValue(new ApiError('TOKEN_INVALID', 'Session AniList expirée'));
    await startCrAnalyze(history([season(0), season(1)]));
    expect(await untilEnded()).toMatchObject({ status: 'stopped', message: 'Session AniList expirée' });
    expect(fake.local.peek(CR_IMPORT_KEYS.input)).toBeUndefined();
    expect(fake.local.peek(CR_IMPORT_KEYS.resolutions)).toBeUndefined();
  });

  it('migration : au démarrage, historique sans analyse en cours effacé ; celui d’une analyse en cours gardé', async () => {
    const input = { ...history([season(0)]).history, createdAt: 1 };
    fake.local.data.set(CR_IMPORT_KEYS.input, input);
    fake.local.data.set(CR_IMPORT_KEYS.resolutions, {});
    await resumeCrImport();
    expect(fake.local.peek(CR_IMPORT_KEYS.input)).toBeUndefined();
    expect(fake.local.peek(CR_IMPORT_KEYS.resolutions)).toBeUndefined();

    // Analyse en cours (service worker relancé) : reprise, rien n'est effacé, alarme recréée
    let release: () => void = () => undefined;
    fakes.resolve.mockImplementationOnce(async (episode) => {
      await new Promise<void>((resolve) => (release = resolve));
      return certain(episode);
    });
    fake.local.data.set(CR_IMPORT_KEYS.job, startAnalyzeJob(1, Date.now()));
    fake.local.data.set(CR_IMPORT_KEYS.input, input);
    fake.local.data.set(CR_IMPORT_KEYS.resolutions, {});
    await resumeCrImport();
    expect(await chrome.alarms.get(CR_IMPORT_ALARM)).toBeDefined();
    expect(fake.local.peek(CR_IMPORT_KEYS.input)).toEqual(input);
    await vi.waitFor(() => expect(fakes.resolve).toHaveBeenCalledOnce());
    release();
    expect(await untilEnded()).toMatchObject({ status: 'done' });
  });
});

// ─── Application ──────────────────────────────────────────────────────────

const MEDIA_ID = 100;
const MAL_ID = 200;

function planItem(over: Partial<CrPlanItem> = {}): CrPlanItem {
  return {
    id: `m:${MEDIA_ID}`,
    mediaId: MEDIA_ID,
    malId: MAL_ID,
    title: 'Frieren',
    coverUrl: null,
    episodes: 24,
    progress: 12,
    seasons: ['Frieren · S1'],
    services: [
      { service: 'anilist', current: { status: 'CURRENT', progress: 5 }, action: 'update', progress: 12, status: 'CURRENT' },
      { service: 'mal', current: { status: 'CURRENT', progress: 5 }, action: 'update', progress: 12, status: 'CURRENT' },
    ],
    mappings: [
      { key: 'crunchyroll:GRF:s1', mapping: mapping(MEDIA_ID) },
      { key: 'crunchyroll:GRF:s2', mapping: mapping(MEDIA_ID) },
    ],
    result: null,
    ...over,
  };
}

function seedPlan(items: CrPlanItem[]): void {
  const plan: CrImportPlan = { builtAt: 1, services: ['anilist', 'mal'], stats: { items: 1, pages: 1, partial: false }, seasonCount: items.length, items, review: [], excluded: 0, failed: 0 };
  fake.local.data.set(CR_IMPORT_KEYS.plan, plan);
}

/** Fait avancer les faux timers (pauses avant nouvel essai) jusqu'à la fin de la tâche */
async function driveUntilEnded(): Promise<CrImportJob> {
  for (let elapsed = 0; elapsed < 600_000 && storedJob()?.status === 'running'; elapsed += 1_000) {
    await vi.advanceTimersByTimeAsync(1_000);
  }
  await flush();
  const job = storedJob();
  if (!job) throw new Error('tâche absente');
  return job;
}

const MAL_503 = (): ApiError => new ApiError('API_ERROR', 'MyAnimeList : erreur 503', { httpStatus: 503 });

describe('application (TEST-05, CRI-05)', () => {
  beforeEach(() => {
    vi.useFakeTimers({ now: 1_000_000_000_000, toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'] });
    anilist.entries.set(MEDIA_ID, { status: 'CURRENT', progress: 5 });
    mal.entries.set(MAL_ID, { status: 'CURRENT', progress: 5 });
    // Correspondance déjà apprise (ou corrigée) pour la saison 2 : jamais écrasée
    fake.local.data.set(STORAGE_KEYS.mediaMappings, { 'crunchyroll:GRF:s2': mapping(999) });
  });

  it('AniList écrit puis MAL 503 : seul MAL est retenté, l’élément est « mis à jour » et la correspondance apprise', async () => {
    seedPlan([planItem()]);
    mal.failures = [MAL_503()];
    expect((await startCrApply({ ids: [`m:${MEDIA_ID}`] })).ok).toBe(true);
    const job = await driveUntilEnded();

    expect(job).toMatchObject({ status: 'done', updated: 1, failed: 0, skipped: 0 });
    // AniList lu et écrit une seule fois ; MAL : un échec puis l'écriture
    expect(anilist.reads).toBe(1);
    expect(anilist.writes).toEqual([{ id: MEDIA_ID, progress: 12, status: 'CURRENT' }]);
    expect(mal.attempts).toBe(2);
    expect(mal.writes).toEqual([{ id: MAL_ID, progress: 12, status: 'CURRENT' }]);

    const [item] = storedPlan().items;
    expect(item?.result).toEqual({ outcome: 'updated', message: null });
    expect(item).not.toHaveProperty('written');
    expect(fake.local.peek(STORAGE_KEYS.mediaMappings)).toEqual({
      'crunchyroll:GRF:s1': { ...mapping(MEDIA_ID), mediaTitle: 'Frieren' },
      'crunchyroll:GRF:s2': mapping(999),
    });
  });

  it('AniList écrit puis MAL 503 persistant : AniList compté « mis à jour » (échec MAL signalé), correspondance apprise', async () => {
    seedPlan([planItem()]);
    mal.failures = [MAL_503()];
    mal.persistent = true;
    await startCrApply({ ids: [`m:${MEDIA_ID}`] });
    const job = await driveUntilEnded();

    expect(job).toMatchObject({ status: 'done', updated: 1, failed: 0 });
    expect(anilist.writes).toHaveLength(1);
    expect(anilist.reads).toBe(1);
    expect(mal.attempts).toBe(1 + RETRY_DELAYS_MS.server.length);
    const [item] = storedPlan().items;
    expect(item?.result).toMatchObject({ outcome: 'updated', message: expect.stringContaining('MyAnimeList') });
    expect(fake.local.peek(STORAGE_KEYS.mediaMappings)).toMatchObject({ 'crunchyroll:GRF:s1': { mediaId: MEDIA_ID } });
  });

  it('PERF-02 : résultats inscrits dans l’aperçu par lots, aperçu lu une seule fois', async () => {
    const count = WRITE_BATCH_SIZE + 5;
    const items = Array.from({ length: count }, (_, i) => {
      const mediaId = 1_000 + i;
      return planItem({
        id: `m:${mediaId}`,
        mediaId,
        malId: null,
        services: [{ service: 'anilist', current: null, action: 'update', progress: 12, status: 'CURRENT' }],
        mappings: [{ key: `crunchyroll:GR${i}:s1`, mapping: mapping(mediaId) }],
      });
    });
    seedPlan(items);
    const set = vi.spyOn(fake.local, 'set');
    const get = vi.spyOn(fake.local, 'get');
    await startCrApply({ ids: items.map((i) => i.id) });
    expect(await driveUntilEnded()).toMatchObject({ status: 'done', updated: count });

    const planWrites = set.mock.calls.filter(([written]) => CR_IMPORT_KEYS.plan in written);
    expect(planWrites.length).toBeLessThanOrEqual(Math.ceil(count / WRITE_BATCH_SIZE) + 1);
    const mappingWrites = set.mock.calls.filter(([written]) => STORAGE_KEYS.mediaMappings in written);
    expect(mappingWrites.length).toBeLessThanOrEqual(Math.ceil(count / WRITE_BATCH_SIZE) + 1);
    // Lu par startCrApply, puis plus jamais par l'application (seules les écritures de lots le relisent)
    const planReads = get.mock.calls.filter(([keys]) => keys === CR_IMPORT_KEYS.plan);
    expect(planReads.length).toBeLessThanOrEqual(1 + planWrites.length);
    expect(storedPlan().items.every((i) => i.result?.outcome === 'updated')).toBe(true);
    expect(keysOf(fake.local.peek(STORAGE_KEYS.mediaMappings))).toHaveLength(count + 1);
  });
});
