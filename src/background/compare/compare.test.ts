import { beforeEach, describe, expect, it, vi } from 'vitest';
import { setLocale, t } from '../../i18n';
import { COMPARE_STORAGE_KEY, isComparisonResult, planApply, type ComparisonResult, type DiffSide, type ListDiff } from '../../shared/compare';
import { COMPARE_JOB_KEY, isCompareJob, type CompareJob } from '../../shared/compare-job';
import type { ApplyDiffsPayload } from '../../shared/compare';
import type { ListEntryState } from '../sync/rules';
import { SessionChangedError } from '../../shared/session-epochs';
import { ApiError } from '../errors';
import { STORAGE_KEYS } from '../../protocol/storage-keys';

// Services simulés au niveau des clients d'API : les vrais adaptateurs (trackers) et la vraie boucle d'alignement tournent
const api = vi.hoisted(() => ({
  getMediaListInfo: vi.fn(),
  saveListEntry: vi.fn(),
  saveProgress: vi.fn(),
  saveListStatus: vi.fn(),
  getMalAnime: vi.fn(),
  saveMalEntry: vi.fn(),
  saveMalProgress: vi.fn(),
}));
vi.mock('../anilist/list', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../anilist/list')>()),
  getMediaListInfo: api.getMediaListInfo,
  saveListEntry: api.saveListEntry,
  saveProgress: api.saveProgress,
  saveListStatus: api.saveListStatus,
}));
vi.mock('../mal/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../mal/client')>()),
  getMalAnime: api.getMalAnime,
  saveMalEntry: api.saveMalEntry,
  saveMalProgress: api.saveMalProgress,
}));
// Deux comptes connectés
vi.mock('../../browser/storage/tokens', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../browser/storage/tokens')>()),
  hasValidAniListToken: async () => true,
  hasMalToken: async () => true,
}));
// Espacement des écritures et budget AniList sans attente réelle
const slots = vi.hoisted(() => ({ waitWriteSlot: vi.fn(async () => undefined), waitReadSlot: vi.fn(async () => undefined) }));
vi.mock('../jobs/runner', async (importOriginal) => ({ ...(await importOriginal<typeof import('../jobs/runner')>()), ...slots }));

// chrome.storage.local, alarmes et verrous Web Locks en file (une tâche à la fois par nom, comme navigator.locks)
let store: Record<string, unknown> = {};
const alarmsClear = vi.fn(async () => true);
vi.stubGlobal('chrome', {
  storage: {
    local: {
      get: async (keys: string | string[] | null) => {
        if (keys === null) return { ...store };
        return Object.fromEntries((Array.isArray(keys) ? keys : [keys]).map((k) => [k, store[k]]));
      },
      set: async (items: Record<string, unknown>) => {
        store = { ...store, ...items };
      },
      remove: async (keys: string | string[]) => {
        for (const k of Array.isArray(keys) ? keys : [keys]) delete store[k];
      },
    },
  },
  alarms: { create: async () => undefined, clear: alarmsClear },
});
// Une file par nom de verrou : le verrou de la fiche (alignement) englobe celui du stockage (comparaison)
const queues = new Map<string, Promise<unknown>>();
vi.stubGlobal('navigator', {
  locks: {
    request: <T>(name: string, task: () => Promise<T>): Promise<T> => {
      const run = (queues.get(name) ?? Promise.resolve()).then(task);
      queues.set(name, run.catch(() => undefined));
      return run;
    },
  },
});

const { applyDiffs, MAL_WRITE_GAP_MS, RETRY_DELAYS_MS, transientKind } = await import('./compare');
const { anilistTracker, malTracker } = await import('../trackers');

setLocale('fr');

describe('erreurs passagères pendant un alignement', () => {
  it('429 persistant → limite de requêtes', () => {
    expect(transientKind(new ApiError('RATE_LIMITED', 'x'))).toBe('rate-limit');
  });

  it('502 / 503 / 504 et délai dépassé → service surchargé (nouvelle tentative 5 s puis 15 s)', () => {
    for (const status of [502, 503, 504]) expect(transientKind(new ApiError('API_ERROR', 'x', { httpStatus: status }))).toBe('server');
    expect(transientKind(new ApiError('NETWORK', 'x', { timedOut: true }))).toBe('server');
    expect(RETRY_DELAYS_MS.server).toEqual([5_000, 15_000]);
  });

  it('connexion perdue → réseau ; erreurs définitives → aucune nouvelle tentative', () => {
    expect(transientKind(new ApiError('NETWORK', 'x'))).toBe('network');
    expect(transientKind(new ApiError('API_ERROR', 'x', { httpStatus: 400 }))).toBeNull();
    expect(transientKind(new ApiError('TOKEN_INVALID', 'x'))).toBeNull();
    expect(transientKind(new Error('x'))).toBeNull();
  });

  it('écritures MyAnimeList espacées d’au moins 1 s', () => {
    expect(MAL_WRITE_GAP_MS).toBeGreaterThanOrEqual(1_000);
  });
});

// ─── Instantané périmé (compare:last) ─────────────────────────────────────

const side = (progress: number, status: DiffSide['status'] = 'CURRENT'): DiffSide => ({ status, progress, score: null, repeat: 0 });

/** Frieren : analyse AniList 7 / MAL 5 ; Dandadan : AniList 4 / MAL 2 */
const FRIEREN: ListDiff = { key: 'mal:52991', mediaId: 154587, malId: 52991, title: 'Frieren', coverUrl: null, anilist: side(7), mal: side(5), fields: ['progress'] };
const DANDADAN: ListDiff = { key: 'mal:57334', mediaId: 171018, malId: 57334, title: 'Dandadan', coverUrl: null, anilist: side(4), mal: side(2), fields: ['progress'] };

const snapshot = (items: ListDiff[]): ComparisonResult => ({
  analyzedAt: 1,
  scoreFormat: 'POINT_10',
  counts: { compared: 10, identical: 10 - items.length, different: items.length, onlyAniList: 0, onlyMal: 0, notComparable: 0 },
  items,
  errors: {},
});

/** État réel des listes, relu par getEntry (fiche AniList → entrée, id MAL → entrée) */
let anilistLive: Record<number, ListEntryState | null> = {};
let malLive: Record<number, ListEntryState | null> = {};

function storedComparison(): ComparisonResult {
  const value = store[COMPARE_STORAGE_KEY];
  if (!isComparisonResult(value)) throw new Error('comparaison absente');
  return value;
}

function storedJob(): CompareJob {
  const value = store[COMPARE_JOB_KEY];
  if (!isCompareJob(value)) throw new Error('tâche absente');
  return value;
}

/** Lance l'alignement et attend la fin de la boucle (alarme retirée, boucle libérée) */
async function runApply(payload: ApplyDiffsPayload): Promise<CompareJob> {
  alarmsClear.mockClear();
  const started = await applyDiffs(payload);
  expect(started.ok).toBe(true);
  await vi.waitFor(() => expect(alarmsClear).toHaveBeenCalled());
  await new Promise((resolve) => setTimeout(resolve, 0));
  return storedJob();
}

/** Deux comptes connectés (anciens tokens en clair : présence seule, les requêtes sont simulées), première génération */
const SIGNED_IN = {
  [STORAGE_KEYS.anilistToken]: { accessToken: 'a', expiresAt: Number.MAX_SAFE_INTEGER },
  [STORAGE_KEYS.malToken]: { accessToken: 'm', refreshToken: 'r', expiresAt: Number.MAX_SAFE_INTEGER },
};

const item = (diff: ListDiff): { mediaId: number | null; malId: number } => ({ mediaId: diff.mediaId, malId: diff.malId });

beforeEach(() => {
  vi.clearAllMocks();
  store = { ...SIGNED_IN, [COMPARE_STORAGE_KEY]: snapshot([DANDADAN, FRIEREN]) };
  anilistLive = { 154587: { status: 'CURRENT', progress: 7, repeat: 0 }, 171018: { status: 'CURRENT', progress: 4, repeat: 0 } };
  malLive = { 52991: { status: 'CURRENT', progress: 5, repeat: 0 }, 57334: { status: 'CURRENT', progress: 2, repeat: 0 } };
  api.getMediaListInfo.mockImplementation(async (id: number) => ({ mediaId: id, title: `#${id}`, episodes: 28, entry: anilistLive[id] ?? null }));
  api.getMalAnime.mockImplementation(async (id: number) => ({ title: `#${id}`, episodes: 28, entry: malLive[id] ?? null }));
  api.saveMalEntry.mockImplementation(async (_id: number, write: { status: ListEntryState['status']; progress: number }) => ({ status: write.status, progress: write.progress }));
  api.saveListEntry.mockImplementation(async (_id: number, write: { status: ListEntryState['status']; progress: number }) => ({ status: write.status, progress: write.progress }));
  api.saveMalProgress.mockImplementation(async (_id: number, progress: number, status: ListEntryState['status']) => ({ status, progress }));
  api.saveListStatus.mockImplementation(async (_id: number, status: ListEntryState['status'], progress: number) => ({ status, progress }));
});

describe('alignement : relecture avant écriture', () => {
  it('état inchangé depuis l’analyse → écrit comme avant, écart retiré', async () => {
    const job = await runApply({ items: [item(FRIEREN)], source: 'anilist' });
    expect(api.saveMalEntry).toHaveBeenCalledWith(52991, { status: 'CURRENT', progress: 7 }, 0);
    expect(job.updated).toBe(1);
    expect(storedComparison().items.map((d) => d.key)).toEqual([DANDADAN.key]);
    // Lectures comptées sur le budget des tâches de fond (source puis cible)
    expect(slots.waitReadSlot.mock.calls).toEqual([['anilist'], ['mal']]);
    // B9 : la relecture AniList part sur la file de fond (place réservée par waitReadSlot), jamais sur celle des écrans
    expect(api.getMediaListInfo.mock.calls).toEqual([[154587, 'background', 0]]);
  });

  it('cible avancée depuis l’analyse (MAL 5 → 8) : « Garder AniList » n’écrit pas 7, série ignorée et à réanalyser', async () => {
    malLive[52991] = { status: 'CURRENT', progress: 8, repeat: 0 };
    const job = await runApply({ items: [item(FRIEREN)], source: 'anilist' });
    expect(api.saveMalEntry).not.toHaveBeenCalled();
    expect(job.skipped).toBe(1);
    expect(job.messages).toContain(t('compare.skip.changed'));
    const diff = storedComparison().items.find((d) => d.key === FRIEREN.key);
    expect(diff?.stale).toBe(true);
    // Plus aucun alignement possible avec ces valeurs périmées
    expect(diff && planApply(diff, 'anilist')).toEqual({ action: 'skip', reason: 'changed' });
  });

  it('cible retirée de la liste depuis l’analyse → ignorée (rien n’est recréé)', async () => {
    malLive[52991] = null;
    const job = await runApply({ items: [item(FRIEREN)], source: 'anilist' });
    expect(api.saveMalEntry).not.toHaveBeenCalled();
    expect(job.skipped).toBe(1);
  });

  it('source modifiée depuis l’analyse (AniList 7 → 9) → ignorée, aucune écriture', async () => {
    anilistLive[154587] = { status: 'CURRENT', progress: 9, repeat: 0 };
    const job = await runApply({ items: [item(FRIEREN)], source: 'anilist' });
    expect(api.saveMalEntry).not.toHaveBeenCalled();
    expect(job.skipped).toBe(1);
    expect(job.messages).toContain(t('compare.skip.changed'));
  });

  it('statut ou note changés depuis l’analyse → ignorée', async () => {
    malLive[52991] = { status: 'PAUSED', progress: 5, repeat: 0 };
    expect((await runApply({ items: [item(FRIEREN)], source: 'mal' })).skipped).toBe(1);
    store = { ...SIGNED_IN, [COMPARE_STORAGE_KEY]: snapshot([FRIEREN]) };
    malLive[52991] = { status: 'CURRENT', progress: 5, repeat: 0, score: 8 };
    expect((await runApply({ items: [item(FRIEREN)], source: 'mal' })).skipped).toBe(1);
    expect(api.saveListEntry).not.toHaveBeenCalled();
  });

  it('déjà alignées entre-temps (synchro en direct : les deux à 8) → rien n’est écrit, écart retiré', async () => {
    anilistLive[154587] = { status: 'CURRENT', progress: 8, repeat: 0 };
    malLive[52991] = { status: 'CURRENT', progress: 8, repeat: 0 };
    const job = await runApply({ items: [item(FRIEREN)], source: 'anilist' });
    expect(api.saveMalEntry).not.toHaveBeenCalled();
    expect(job.skipped).toBe(1);
    expect(storedComparison().items.map((d) => d.key)).toEqual([DANDADAN.key]);
  });

  it('« Tout aligner » avec une série périmée et une à jour → seule la série à jour est écrite', async () => {
    malLive[52991] = { status: 'CURRENT', progress: 8, repeat: 0 };
    const job = await runApply({ items: [item(DANDADAN), item(FRIEREN)], source: 'anilist' });
    expect(api.saveMalEntry).toHaveBeenCalledTimes(1);
    expect(api.saveMalEntry).toHaveBeenCalledWith(57334, { status: 'CURRENT', progress: 4 }, 0);
    expect({ updated: job.updated, skipped: job.skipped }).toEqual({ updated: 1, skipped: 1 });
    expect(storedComparison().items).toEqual([{ ...FRIEREN, stale: true }]);
  });
});

describe('alignement : sessions relevées au démarrage (L2)', () => {
  /** Déconnexion de MyAnimeList puis connexion à un autre compte : nouvelle génération, un token est de nouveau enregistré */
  const reconnectMal = (): void => {
    store = { ...store, [STORAGE_KEYS.sessionEpoch]: { mal: 1 }, [STORAGE_KEYS.malToken]: { accessToken: 'autre', refreshToken: 'r', expiresAt: Number.MAX_SAFE_INTEGER } };
  };

  it('écritures liées à la session du démarrage : chaque requête du service porte sa génération', async () => {
    await runApply({ items: [item(FRIEREN)], source: 'anilist' });
    expect(api.getMediaListInfo.mock.calls).toEqual([[154587, 'background', 0]]);
    expect(api.getMalAnime.mock.calls).toEqual([[52991, 0]]);
    expect(api.saveMalEntry.mock.calls).toEqual([[52991, { status: 'CURRENT', progress: 7 }, 0]]);
  });

  it('autre compte MAL connecté pendant la relecture : rien n’est écrit sur le nouveau compte, alignement arrêté', async () => {
    api.getMalAnime.mockImplementationOnce(async (id: number) => {
      reconnectMal();
      return { title: `#${id}`, episodes: 28, entry: malLive[id] ?? null };
    });
    const job = await runApply({ items: [item(FRIEREN), item(DANDADAN)], source: 'anilist' });
    expect(api.saveMalEntry).not.toHaveBeenCalled();
    expect(job.status).toBe('stopped');
    expect(job.message).toBe(t('compare.error.notConnected'));
  });

  it('autre compte MAL connecté entre deux séries : la série suivante n’est jamais écrite sur le nouveau compte', async () => {
    api.saveMalEntry.mockImplementationOnce(async (_id: number, write: { status: ListEntryState['status']; progress: number }) => {
      reconnectMal();
      return { status: write.status, progress: write.progress };
    });
    const job = await runApply({ items: [item(FRIEREN), item(DANDADAN)], source: 'anilist' });
    expect(api.saveMalEntry).toHaveBeenCalledTimes(1);
    expect(job.updated).toBe(1);
    expect(job.status).toBe('stopped');
  });

  it('autre compte AniList (la source) connecté avant la relecture : la valeur d’un autre compte n’est jamais recopiée', async () => {
    api.getMediaListInfo.mockImplementationOnce(async () => {
      throw new SessionChangedError('anilist');
    });
    const job = await runApply({ items: [item(FRIEREN)], source: 'anilist' });
    expect(api.saveMalEntry).not.toHaveBeenCalled();
    expect(job.status).toBe('stopped');
  });
});

describe('comparaison invalidée après une écriture hors alignement', () => {
  it('synchro réussie sur MAL (saveProgress) → l’écart de la fiche est marqué à réanalyser, les autres restent', async () => {
    await malTracker.saveProgress(52991, 6, 'CURRENT');
    const items = storedComparison().items;
    expect(items.find((d) => d.key === FRIEREN.key)?.stale).toBe(true);
    expect(items.find((d) => d.key === DANDADAN.key)?.stale).toBeUndefined();
  });

  it('contrôle sur AniList (statut) → même invalidation, par l’identifiant de la fiche AniList', async () => {
    await anilistTracker.saveStatus(171018, 'PAUSED', 4);
    expect(storedComparison().items.find((d) => d.key === DANDADAN.key)?.stale).toBe(true);
  });

  it('puis « Garder AniList » sur cette série → ignorée sans aucune relecture ni écriture', async () => {
    await malTracker.saveProgress(52991, 6, 'CURRENT');
    const job = await runApply({ items: [item(FRIEREN)], source: 'anilist' });
    expect(job.skipped).toBe(1);
    expect(api.getMalAnime).not.toHaveBeenCalled();
    expect(api.saveMalEntry).not.toHaveBeenCalled();
  });

  it('aucune comparaison stockée → rien n’est créé', async () => {
    store = {};
    await malTracker.saveProgress(52991, 6, 'CURRENT');
    expect(store[COMPARE_STORAGE_KEY]).toBeUndefined();
  });
});
