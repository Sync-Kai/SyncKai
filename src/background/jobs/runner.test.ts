import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fromLegacyJob, isJobOf, JOB_STALE_MS, reduceJob, startJob, type Job, type JobEvent, type JobStart } from '../../shared/job';
import { createLoggerFor } from '../../browser/logger';
import { installFakeChrome } from '../../test/fake-chrome';
import { ApiError, isRetryableStatus, JOB_RETRY_STATUSES } from '../errors';
import { budgetWaitEvent, createJobLoop, createJobStore, isFatalError, reserveJob, RETRY_DELAYS_MS, startHeartbeat, transientKind, withHeartbeat, type StepResult, type TransientKind } from './runner';

describe('erreur définitive d’une tâche', () => {
  it('session expirée, réseau, limite persistante : arrêt ; service surchargé ou erreur ponctuelle : on continue', () => {
    expect(isFatalError(new ApiError('TOKEN_INVALID', 'x'))).toBe(true);
    expect(isFatalError(new ApiError('NETWORK', 'x'))).toBe(true);
    expect(isFatalError(new ApiError('RATE_LIMITED', 'x'))).toBe(true);
    expect(isFatalError(new ApiError('NETWORK', 'x', { timedOut: true }))).toBe(false);
    expect(isFatalError(new ApiError('API_ERROR', 'x', { httpStatus: 400 }))).toBe(false);
    expect(isFatalError(new Error('x'))).toBe(false);
  });
});

describe('attente du budget AniList → évènement de la tâche', () => {
  it('pause « quota » avec reprise estimée, reprise inconnue = pause échue (texte sans compte à rebours), fin = wait-end', () => {
    expect(budgetWaitEvent({ reason: 'budget', until: 13_000 }, 1_000)).toEqual({ type: 'pause', until: 13_000, reason: 'budget', service: 'anilist', at: 1_000 });
    expect(budgetWaitEvent({ reason: 'budget', until: null }, 1_000)).toEqual({ type: 'pause', until: 1_000, reason: 'budget', service: 'anilist', at: 1_000 });
    expect(budgetWaitEvent({ reason: 'rate-limit', until: 6_000 }, 1_000)).toMatchObject({ reason: 'rate-limit', until: 6_000 });
    expect(budgetWaitEvent(null, 2_000)).toEqual({ type: 'wait-end', at: 2_000 });
  });
});

// ─── Boucle de tâches reprenable (TEST-06) ────────────────────────────────
// Vraie boucle, vrai JobStore (stockage et verrous de la fausse API chrome), faux timers (setTimeout,
// setInterval, Date) ; le vrai setTimeout, gardé avant, laisse avancer les promesses sans avancer l'horloge.

type TestJob = Job<'test', string>;

const JOB_KEY = 'testJob';
const ITEMS_KEY = 'testJob:items';
const ALARM = 'synckai:test-job';
const T0 = 1_000_000_000_000;
const realSetTimeout = globalThis.setTimeout;

const fake = installFakeChrome();
const isKind = (kind: unknown): kind is 'test' => kind === 'test';
const isItem = (item: unknown): item is string => typeof item === 'string';
const isTestJob = (value: unknown): value is TestJob => isJobOf(value, isKind, isItem);
const store = createJobStore<TestJob>({ key: JOB_KEY, itemsKey: ITEMS_KEY, isJob: isTestJob, isItem, fromLegacy: (value) => fromLegacyJob(value, isKind, isItem) });
/** Tâche et sa liste d'éléments, comme les écrit la réservation */
const seeded = ({ job, items }: JobStart<TestJob>): Record<string, unknown> => ({ [JOB_KEY]: job, [ITEMS_KEY]: items });

/** Traitement scripté : réponses successives par élément (la dernière se répète), « terminé » par défaut */
type Script = Record<string, (StepResult | Promise<StepResult>)[]>;

interface Harness {
  ensure: () => void;
  /** Appels de `process` : élément et `isLastAttempt` pour chaque type d'erreur passagère */
  calls: { item: string; last: Record<TransientKind, boolean> }[];
  onEnd: ReturnType<typeof vi.fn<(job: TestJob) => void>>;
}

const done = (outcome: 'updated' | 'failed' = 'updated', stop: string | null = null): StepResult => ({
  kind: 'event',
  event: { type: 'item', outcome, at: Date.now() } satisfies JobEvent,
  stop,
});
const retry = (reason: TransientKind): StepResult => ({ kind: 'retry', reason, service: 'mal', error: 'MyAnimeList : erreur 503' });

function harness(script: Script): Harness {
  const calls: Harness['calls'] = [];
  const seen = new Map<string, number>();
  const onEnd = vi.fn<(job: TestJob) => void>();
  const loop = createJobLoop<TestJob>({
    label: 'test',
    log: createLoggerFor('test', false),
    store,
    alarm: ALARM,
    accepts: (job) => job.kind === 'test',
    itemKey: (item) => item,
    process: async (_job, item, isLastAttempt) => {
      calls.push({ item, last: { 'rate-limit': isLastAttempt('rate-limit'), server: isLastAttempt('server'), network: isLastAttempt('network') } });
      const steps = script[item] ?? [done()];
      const index = seen.get(item) ?? 0;
      seen.set(item, index + 1);
      return (await steps[Math.min(index, steps.length - 1)]) ?? done();
    },
    onEnd,
  });
  return { ensure: () => loop.ensure(), calls, onEnd };
}

/** Laisse avancer tout ce qui n'attend pas l'horloge (stockage, verrous, promesses) */
async function flush(): Promise<void> {
  for (let i = 0; i < 5; i++) await new Promise<void>((resolve) => realSetTimeout(resolve, 0));
}

/** Réponse de `process` retenue jusqu'à ce que le test la libère */
function held(): { promise: Promise<StepResult>; release: (step: StepResult) => void } {
  let release: (step: StepResult) => void = () => undefined;
  const promise = new Promise<StepResult>((resolve) => (release = resolve));
  return { promise, release };
}

const job = (): TestJob | undefined => fake.local.peek(JOB_KEY) as TestJob | undefined;
const cancel = (): Promise<TestJob | null> => store.update((j) => j && reduceJob(j, { type: 'cancel', at: Date.now() }));

beforeEach(async () => {
  fake.reset(seeded(startJob('test', ['a', 'b', 'c'], T0)));
  vi.useFakeTimers({ now: T0 });
  await chrome.alarms.create(ALARM, { periodInMinutes: 1 });
  vi.spyOn(console, 'info').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('createJobLoop (TEST-06)', () => {
  it('éléments traités dans l’ordre jusqu’à la fin : terminée, alarme retirée, bilan', async () => {
    const h = harness({});
    h.ensure();
    await flush();
    expect(h.calls.map((c) => c.item)).toEqual(['a', 'b', 'c']);
    expect(job()).toMatchObject({ status: 'done', done: 3, updated: 3, cursor: 3, current: null });
    expect(await chrome.alarms.get(ALARM)).toBeUndefined();
    expect(h.onEnd).toHaveBeenCalledOnce();
  });

  it('erreur passagère : pause visible puis même élément retenté ; essais remis à zéro à l’élément suivant', async () => {
    const h = harness({ a: [retry('server'), retry('server'), done()], b: [retry('server'), done()] });
    h.ensure();
    await flush();
    // Pause « serveur » de 5 s sur l'élément a, toujours en tête de file
    expect(job()).toMatchObject({ status: 'running', cursor: 0, current: 'a', pauseReason: 'server', pauseService: 'mal', pausedUntil: T0 + RETRY_DELAYS_MS.server[0] });
    expect(h.calls).toHaveLength(1);

    await vi.advanceTimersByTimeAsync(RETRY_DELAYS_MS.server[0]);
    await flush();
    expect(h.calls).toHaveLength(2);
    await vi.advanceTimersByTimeAsync(RETRY_DELAYS_MS.server[1]);
    await flush();
    await vi.advanceTimersByTimeAsync(RETRY_DELAYS_MS.server[0]);
    await flush();

    expect(h.calls.map((c) => [c.item, c.last.server])).toEqual([
      ['a', false],
      ['a', false],
      ['a', true],
      // Nouvel élément : droit à toutes ses nouvelles tentatives
      ['b', false],
      ['b', false],
      ['c', false],
    ]);
    expect(job()).toMatchObject({ status: 'done', done: 3, updated: 3, pausedUntil: null });
  });

  it('« Arrêter » pendant la pause : fin au prochain signe de vie, sans nouvelle tentative', async () => {
    const h = harness({ a: [retry('network'), done()] });
    h.ensure();
    await flush();
    expect(job()).toMatchObject({ pauseReason: 'network', pausedUntil: T0 + RETRY_DELAYS_MS.network[0] });

    await cancel();
    // La pause de 30 s est vérifiée par tranches de 5 s
    await vi.advanceTimersByTimeAsync(5_000);
    await flush();
    expect(h.calls).toHaveLength(1);
    expect(job()).toMatchObject({ status: 'cancelled', done: 0, cursor: 0, pausedUntil: null });
    expect(await chrome.alarms.get(ALARM)).toBeUndefined();
    expect(h.onEnd).toHaveBeenCalledOnce();
  });

  it('step.stop (erreur bloquante) : arrêtée avec le message, éléments restants non traités, alarme retirée', async () => {
    const h = harness({ a: [done('failed', 'Session expirée')] });
    h.ensure();
    await flush();
    expect(h.calls.map((c) => c.item)).toEqual(['a']);
    expect(job()).toMatchObject({ status: 'stopped', message: 'Session expirée', done: 1, failed: 1, cursor: 1 });
    expect(await chrome.alarms.get(ALARM)).toBeUndefined();
    expect(h.onEnd).toHaveBeenCalledOnce();
  });

  it('ensure() sur une boucle vivante (signe de vie pendant la requête) : aucune seconde boucle', async () => {
    const request = held();
    const h = harness({ a: [request.promise] });
    h.ensure();
    await flush();
    // Signe de vie entretenu toutes les 10 s pendant la requête
    await vi.advanceTimersByTimeAsync(JOB_STALE_MS + 10_000);
    h.ensure();
    await flush();
    expect(h.calls.map((c) => c.item)).toEqual(['a']);
    request.release(done());
    await flush();
    expect(job()).toMatchObject({ status: 'done', done: 3 });
    expect(h.calls.map((c) => c.item)).toEqual(['a', 'b', 'c']);
  });

  it('ensure() sur une boucle muette depuis plus de JOB_STALE_MS : relancée, l’ancienne sort sans compter son élément', async () => {
    const stuck = held();
    const retried = held();
    const h = harness({ a: [stuck.promise, retried.promise] });
    h.ensure();
    await flush();
    expect(h.calls).toHaveLength(1);

    // Horloge avancée sans déclencher les minuteries : aucun signe de vie (boucle réellement bloquée)
    vi.setSystemTime(T0 + JOB_STALE_MS + 1);
    h.ensure();
    await flush();
    // Nouvelle boucle : « Reprise… » affiché, l'élément a retraité
    expect(h.calls.map((c) => c.item)).toEqual(['a', 'a']);
    expect(job()).toMatchObject({ status: 'running', pauseReason: 'resume', cursor: 0, current: 'a' });

    // L'ancienne boucle se réveille pendant que la nouvelle traite a : son résultat n'est pas appliqué
    stuck.release(done('failed'));
    await flush();
    expect(job()).toMatchObject({ status: 'running', done: 0, failed: 0, cursor: 0 });

    retried.release(done());
    await flush();
    expect(h.calls.map((c) => c.item)).toEqual(['a', 'a', 'b', 'c']);
    expect(job()).toMatchObject({ status: 'done', done: 3, updated: 3, failed: 0, cursor: 3 });
    expect(h.onEnd).toHaveBeenCalledOnce();
  });
});

describe('réservation de la tâche (reserveJob)', () => {
  it('aucune tâche : créée ; tâche vivante : refusée et laissée telle quelle ; tâche muette depuis JOB_STALE_MS : remplacée', async () => {
    fake.reset();
    const first = await reserveJob(store, () => startJob('test', ['a'], Date.now()));
    expect(first).toMatchObject({ kind: 'test', status: 'running', cursor: 0, itemCount: 1 });
    expect(job()).toEqual(first);
    expect(fake.local.peek(ITEMS_KEY)).toEqual(['a']);

    const start = vi.fn(() => startJob('test', ['b'], Date.now()));
    expect(await reserveJob(store, start)).toBeNull();
    expect(start).not.toHaveBeenCalled();
    expect(job()).toEqual(first);

    await vi.advanceTimersByTimeAsync(JOB_STALE_MS + 1);
    const second = await reserveJob(store, start);
    expect(second).toMatchObject({ cursor: 0, itemCount: 1 });
    expect(job()).toEqual(second);
    expect(fake.local.peek(ITEMS_KEY)).toEqual(['b']);
  });

  it('tâche terminée : une nouvelle est réservée', async () => {
    fake.reset({ [JOB_KEY]: { ...startJob('test', ['a'], T0).job, status: 'done' }, [ITEMS_KEY]: ['a'] });
    expect(await reserveJob(store, () => startJob('test', ['z'], Date.now()))).toMatchObject({ cursor: 0, status: 'running' });
    expect(fake.local.peek(ITEMS_KEY)).toEqual(['z']);
  });
});

// ─── Stockage de la tâche : liste écrite une fois, curseur (PERF-16) ──────

/** Laisse la boucle traiter tous les éléments (verrous et stockage ne dépendent pas de l'horloge) */
async function untilSettled(maxTicks = 200_000): Promise<void> {
  for (let i = 0; i < maxTicks && job()?.status === 'running'; i++) await new Promise<void>((resolve) => realSetTimeout(resolve, 0));
}

/** Tâche au format précédent : file `pending` dans la tâche, sans curseur */
function legacyJob(fields: Partial<TestJob>, pending: string[]): Record<string, unknown> {
  const legacy: Record<string, unknown> = { ...startJob('test', [], T0).job, ...fields, pending };
  delete legacy.cursor;
  delete legacy.itemCount;
  delete legacy.current;
  return legacy;
}

describe('stockage de la tâche (PERF-16)', () => {
  it('2000 éléments : chaque écriture de la tâche reste petite (ne dépend pas des éléments restants), liste écrite une seule fois', async () => {
    const items = Array.from({ length: 2000 }, (_, i) => `s:${i}`);
    fake.reset();
    const writes: { key: string; bytes: number; remaining: number }[] = [];
    const write = fake.local.set;
    vi.spyOn(fake.local, 'set').mockImplementation(async (values: Record<string, unknown>) => {
      for (const [key, value] of Object.entries(values)) {
        const stored = value as Partial<TestJob>;
        writes.push({ key, bytes: JSON.stringify(value).length, remaining: (stored.total ?? 0) - (stored.done ?? 0) });
      }
      await write(values);
    });
    expect(await reserveJob(store, () => startJob('test', items, Date.now()))).not.toBeNull();
    const h = harness({});
    h.ensure();
    await untilSettled();

    expect(job()).toMatchObject({ status: 'done', done: 2000, updated: 2000, total: 2000, cursor: 2000, current: null });
    expect(h.calls.map((c) => c.item)).toEqual(items);
    expect(writes.filter((w) => w.key === ITEMS_KEY)).toHaveLength(1);
    const jobWrites = writes.filter((w) => w.key === JOB_KEY);
    const largest = (keep: (w: { remaining: number }) => boolean): number => Math.max(...jobWrites.filter(keep).map((w) => w.bytes));
    // Au début (1990 restants et plus) comme à la fin (10 restants et moins) : même taille, à quelques chiffres près
    expect(Math.abs(largest((w) => w.remaining >= 1990) - largest((w) => w.remaining <= 10))).toBeLessThan(32);
    expect(Math.max(...jobWrites.map((w) => w.bytes))).toBeLessThan(1_000);
    // Volume total linéaire : quelques écritures de moins de 1 Ko par élément
    expect(jobWrites.reduce((sum, w) => sum + w.bytes, 0)).toBeLessThan(items.length * 3 * 1_000);
  }, 60_000);

  it('reprise après l’arrêt du service worker : repart de l’élément du curseur, aucun traité deux fois ni sauté', async () => {
    const items = Array.from({ length: 10 }, (_, i) => `e${i}`);
    const { job: start } = startJob('test', items, T0);
    // Arrêté pendant e5 (en cours) : signe de vie trop ancien
    fake.reset({ [JOB_KEY]: { ...start, cursor: 5, done: 5, updated: 5, current: 'e5', updatedAt: T0 - JOB_STALE_MS }, [ITEMS_KEY]: items });
    const h = harness({});
    h.ensure();
    await untilSettled();
    expect(h.calls.map((c) => c.item)).toEqual(['e5', 'e6', 'e7', 'e8', 'e9']);
    expect(job()).toMatchObject({ status: 'done', done: 10, updated: 10, total: 10, cursor: 10, current: null });
  });

  it('tâche d’une version précédente (file `pending` dans la tâche) : convertie, menée à son terme avec les bons compteurs', async () => {
    const pending = ['d', 'e', 'f', 'g', 'h', 'i', 'j'];
    const legacy = legacyJob({ total: 10, done: 3, updated: 2, skipped: 1 }, pending);
    fake.reset({ [JOB_KEY]: legacy });
    expect(isTestJob(legacy)).toBe(false);
    // Lecture : déjà au format actuel (rien n'est écrit sans le verrou)
    expect(await store.read()).toMatchObject({ status: 'running', total: 10, done: 3, cursor: 0, itemCount: 7, current: null });
    expect(await store.readItems()).toEqual(pending);
    expect(fake.local.peek(ITEMS_KEY)).toBeUndefined();

    const h = harness({});
    h.ensure();
    await untilSettled();
    expect(h.calls.map((c) => c.item)).toEqual(pending);
    expect(job()).toMatchObject({ status: 'done', total: 10, done: 10, updated: 9, skipped: 1, failed: 0, cursor: 7, itemCount: 7, current: null });
    expect(job()).not.toHaveProperty('pending');
    expect(fake.local.peek(ITEMS_KEY)).toEqual(pending);
  });

  it('élément en cours visible dans la tâche (`current`) ; « Arrêter » entre deux éléments : arrêtée, suivants non traités', async () => {
    const request = held();
    const h = harness({ b: [request.promise] });
    h.ensure();
    await flush();
    expect(job()).toMatchObject({ status: 'running', cursor: 1, current: 'b' });
    await cancel();
    request.release(done());
    await flush();
    expect(h.calls.map((c) => c.item)).toEqual(['a', 'b']);
    expect(job()).toMatchObject({ status: 'cancelled', done: 2, cursor: 2, current: null });
  });

  it('fin d’un élément : l’élément suivant est aussitôt l’élément en cours (pas de `current` null entre deux, la ligne de la page ne clignote pas)', async () => {
    const seen: (string | null)[] = [];
    const write = fake.local.set;
    vi.spyOn(fake.local, 'set').mockImplementation(async (values: Record<string, unknown>) => {
      const stored = values[JOB_KEY] as TestJob | undefined;
      if (stored?.status === 'running') seen.push(stored.current);
      await write(values);
    });
    harness({}).ensure();
    await untilSettled();
    expect(job()).toMatchObject({ status: 'done', current: null });
    expect(seen.length).toBeGreaterThan(0);
    expect(seen).not.toContain(null);
  });

  it('tâche retirée (mise à jour qui renvoie null) : la tâche et sa liste disparaissent, même au format précédent', async () => {
    expect(fake.local.peek(ITEMS_KEY)).toEqual(['a', 'b', 'c']);
    await store.update(() => null);
    expect(job()).toBeUndefined();
    expect(fake.local.peek(ITEMS_KEY)).toBeUndefined();

    fake.reset({ [JOB_KEY]: legacyJob({}, ['x']) });
    await store.update(() => null);
    expect(job()).toBeUndefined();
  });
});

describe('signe de vie d’une tâche (startHeartbeat, withHeartbeat)', () => {
  it('la tâche stockée est touchée toutes les 10 s tant que le travail dure, plus après l’arrêt', async () => {
    const onBeat = vi.fn();
    const stop = startHeartbeat(store, onBeat);
    await vi.advanceTimersByTimeAsync(10_000);
    await flush();
    expect(job()?.updatedAt).toBe(T0 + 10_000);
    await vi.advanceTimersByTimeAsync(25_000);
    await flush();
    expect(job()?.updatedAt).toBe(T0 + 30_000);
    expect(onBeat).toHaveBeenCalledTimes(3);
    await stop();
    await vi.advanceTimersByTimeAsync(60_000);
    await flush();
    expect(job()?.updatedAt).toBe(T0 + 30_000);
    expect(onBeat).toHaveBeenCalledTimes(3);
  });

  it('une analyse plus longue que JOB_STALE_MS ne passe pas pour interrompue', async () => {
    let finish: () => void = () => undefined;
    const work = withHeartbeat(store, () => new Promise<string>((resolve) => (finish = () => resolve('fin'))));
    await vi.advanceTimersByTimeAsync(JOB_STALE_MS * 2);
    await flush();
    expect(Date.now() - (job()?.updatedAt ?? 0)).toBeLessThan(JOB_STALE_MS);
    finish();
    expect(await work).toBe('fin');
  });

  it('le suivi s’arrête aussi quand le travail échoue', async () => {
    await expect(withHeartbeat(store, () => Promise.reject(new Error('échec')))).rejects.toThrow('échec');
    const at = job()?.updatedAt;
    await vi.advanceTimersByTimeAsync(60_000);
    await flush();
    expect(job()?.updatedAt).toBe(at);
  });
});

describe('statuts HTTP retentés : la file de synchro et les tâches de fond restent distinctes (audit 6-D8)', () => {
  const jobsRetry = (status: number): boolean => transientKind(new ApiError('API_ERROR', 'x', { httpStatus: status })) === 'server';

  it('tâches de fond : 500, 502, 503, 504 seulement', () => {
    expect(JOB_RETRY_STATUSES).toEqual([500, 502, 503, 504]);
    for (const status of [500, 502, 503, 504]) expect(jobsRetry(status), String(status)).toBe(true);
    for (const status of [400, 404, 429, 501, 505, 599]) expect(jobsRetry(status), String(status)).toBe(false);
  });

  it('file de synchro : toute la plage 5xx (501 et 505 compris), jamais un 4xx', () => {
    for (const status of [500, 501, 502, 503, 504, 505, 599]) expect(isRetryableStatus(status), String(status)).toBe(true);
    for (const status of [200, 400, 404, 429]) expect(isRetryableStatus(status), String(status)).toBe(false);
    expect(isRetryableStatus(501, JOB_RETRY_STATUSES)).toBe(false);
    expect(isRetryableStatus(503, JOB_RETRY_STATUSES)).toBe(true);
  });
});
