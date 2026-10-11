import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ComparisonResult, ListDiff } from '../../shared/compare';
import type { CompareJob } from '../../shared/compare-job';
import { installFakeChrome } from '../../test/fake-chrome';
import type { CompareController } from './compare';

// Contrôleur « Écarts AniList ↔ MAL » : fausse API chrome (stockage + onChanged, verrous) et faux service worker
// (chaque réponse rendue à la main).

interface PendingCall {
  type: string;
  payload: unknown;
  resolve: (value: unknown) => void;
  reject: (error: unknown) => void;
}

const sw = vi.hoisted(() => ({ calls: [] as PendingCall[] }));

vi.mock('../../shared/messages', () => ({
  sendMessage: (type: string, payload: unknown) => new Promise((resolve, reject) => sw.calls.push({ type, payload, resolve, reject })),
}));

const fake = installFakeChrome();
const { createCompareController } = await import('./compare');
const { COMPARE_STORAGE_KEY } = await import('../../shared/compare');
const { COMPARE_JOB_KEY, startApplyJob } = await import('../../shared/compare-job');
const { t } = await import('../../i18n');

/** Laisse passer les promesses et les évènements du stockage (microtâches ; minuteries simulées) */
async function settle(): Promise<void> {
  for (let i = 0; i < 20; i++) await Promise.resolve();
}

function lastCall(type: string): PendingCall {
  const call = sw.calls.findLast((c) => c.type === type);
  if (!call) throw new Error(`${type} non envoyé`);
  return call;
}

const FRIEREN: ListDiff = {
  key: 'mal:52991',
  mediaId: 154587,
  malId: 52991,
  title: 'Frieren',
  coverUrl: null,
  anilist: { status: 'CURRENT', progress: 7, score: null, repeat: 0 },
  mal: { status: 'CURRENT', progress: 5, score: null, repeat: 0 },
  fields: ['progress'],
};
const comparison: ComparisonResult = {
  analyzedAt: 1,
  scoreFormat: 'POINT_10',
  counts: { compared: 10, identical: 9, different: 1, onlyAniList: 0, onlyMal: 0, notComparable: 0 },
  items: [FRIEREN],
  errors: {},
};

/** Alignement sur AniList (une série) */
function job(patch: Partial<CompareJob> = {}): CompareJob {
  return { ...startApplyJob([{ mediaId: FRIEREN.mediaId, malId: FRIEREN.malId }], 'anilist', 0), ...patch };
}

let ctl: CompareController;
const onApplied = vi.fn<() => void>();
const onPauseTick = vi.fn<(job: CompareJob, now: number) => void>();

beforeEach(() => {
  fake.reset();
  sw.calls.length = 0;
  onApplied.mockReset();
  onPauseTick.mockReset();
  vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'setTimeout', 'clearTimeout', 'Date'] });
  ctl = createCompareController({ onApplied, onPauseTick });
});

afterEach(() => {
  ctl.dispose();
  vi.useRealTimers();
});

describe('createCompareController', () => {
  it('load : dernière analyse et dernière tâche lues du stockage, valeurs invalides ignorées', async () => {
    fake.local.seed({ [COMPARE_STORAGE_KEY]: 'pas une analyse', [COMPARE_JOB_KEY]: job({ status: 'done' }) });
    await ctl.load();
    expect(ctl.store.get().result).toBeNull();
    expect(ctl.store.get().job?.status).toBe('done');
  });

  it('analyse : demande unique en cours, puis résultat (pagination remise à zéro) ou erreur', async () => {
    ctl.showMore();
    void ctl.analyze();
    void ctl.analyze();
    expect(ctl.store.get().requesting).toBe('analyze');
    expect(sw.calls.filter((c) => c.type === 'COMPARE_LISTS')).toHaveLength(1);

    lastCall('COMPARE_LISTS').resolve({ ok: true, data: comparison });
    await settle();
    expect(ctl.store.get()).toMatchObject({ requesting: null, result: comparison, shown: 30, error: null });

    void ctl.analyze();
    lastCall('COMPARE_LISTS').resolve({ ok: false, code: 'NETWORK', message: 'Hors ligne' });
    await settle();
    expect(ctl.store.get()).toMatchObject({ requesting: null, result: comparison, error: 'Hors ligne' });
  });

  it('service worker injoignable : message d’erreur traduit', async () => {
    void ctl.analyze();
    lastCall('COMPARE_LISTS').reject(new Error('Could not establish connection'));
    await settle();
    expect(ctl.store.get().error).toBe(t('popup.swUnreachable'));
  });

  it('alignement : tâche acceptée → pause (compte à rebours chaque seconde) → terminée : « En cours » relu une fois', async () => {
    ctl.setConfirm('anilist');
    void ctl.apply([], 'anilist');
    expect(sw.calls).toHaveLength(0);

    void ctl.apply([FRIEREN], 'anilist');
    expect(ctl.store.get()).toMatchObject({ requesting: 'apply', confirm: null });
    expect(lastCall('APPLY_DIFFS').payload).toEqual({ items: [{ mediaId: 154587, malId: 52991 }], source: 'anilist' });
    lastCall('APPLY_DIFFS').resolve({ ok: true, data: job() });
    await settle();
    expect(ctl.store.get()).toMatchObject({ requesting: null, job: { status: 'running' } });

    // Pause de 5 s : le compte à rebours avance sans nouveau rendu
    await fake.local.set({ [COMPARE_JOB_KEY]: job({ pausedUntil: Date.now() + 5_000, pauseReason: 'rate-limit', pauseService: 'anilist' }) });
    await settle();
    vi.advanceTimersByTime(3_000);
    expect(onPauseTick).toHaveBeenCalledTimes(3);
    expect(onPauseTick.mock.lastCall?.[0].pauseReason).toBe('rate-limit');

    // Reprise après redémarrage : pas de compte à rebours
    await fake.local.set({ [COMPARE_JOB_KEY]: job({ pausedUntil: Date.now() + 5_000, pauseReason: 'resume' }) });
    await settle();
    vi.advanceTimersByTime(3_000);
    expect(onPauseTick).toHaveBeenCalledTimes(3);

    await fake.local.set({ [COMPARE_JOB_KEY]: job({ status: 'done', updated: 1, done: 1 }) });
    await settle();
    expect(onApplied).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(3_000);
    expect(onPauseTick).toHaveBeenCalledTimes(3);

    // Même bilan relu : pas de nouvelle relecture
    await fake.local.set({ [COMPARE_JOB_KEY]: job({ status: 'done', updated: 2, done: 1 }) });
    await settle();
    expect(onApplied).toHaveBeenCalledTimes(1);
  });

  it('alignement terminé sans mise à jour : « En cours » non relu', async () => {
    await fake.local.set({ [COMPARE_JOB_KEY]: job() });
    await settle();
    await fake.local.set({ [COMPARE_JOB_KEY]: job({ status: 'done', skipped: 1, done: 1 }) });
    await settle();
    expect(onApplied).not.toHaveBeenCalled();
  });

  it('filtre et « Afficher plus » : pagination et confirmation remises à zéro au changement de filtre', () => {
    ctl.showMore();
    ctl.setConfirm('mal');
    expect(ctl.store.get()).toMatchObject({ shown: 60, confirm: 'mal' });
    ctl.setFilter('progress');
    expect(ctl.store.get()).toMatchObject({ filter: 'progress', shown: 30, confirm: null });
  });

  it('annulation : tâche marquée tout de suite, erreur si le service worker est injoignable', async () => {
    await fake.local.set({ [COMPARE_JOB_KEY]: job() });
    await settle();
    void ctl.cancel();
    expect(ctl.store.get().job?.cancelled).toBe(true);
    lastCall('CANCEL_COMPARE_JOB').reject(new Error('down'));
    await settle();
    expect(ctl.store.get().error).toBe(t('popup.swUnreachable'));
  });

  it('« OK » sur le bilan : tâche terminée retirée du stockage, tâche en cours conservée', async () => {
    fake.local.seed({ [COMPARE_JOB_KEY]: job() });
    await ctl.dismissJob();
    expect(fake.local.peek(COMPARE_JOB_KEY)).toBeDefined();

    fake.local.seed({ [COMPARE_JOB_KEY]: job({ status: 'done' }) });
    await ctl.dismissJob();
    expect(fake.local.peek(COMPARE_JOB_KEY)).toBeUndefined();
    await settle();
    expect(ctl.store.get().job).toBeNull();
  });

  it('dispose : le stockage n’est plus suivi', async () => {
    ctl.dispose();
    await fake.local.set({ [COMPARE_STORAGE_KEY]: comparison });
    await settle();
    expect(ctl.store.get().result).toBeNull();
  });
});
