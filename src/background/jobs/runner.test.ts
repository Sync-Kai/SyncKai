import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { isJobOf, JOB_STALE_MS, reduceJob, startJob, type Job, type JobEvent } from '../../shared/job';
import { createLoggerFor } from '../../shared/logger';
import { installFakeChrome } from '../../test/fake-chrome';
import { ApiError } from '../api/errors';
import { budgetWaitEvent, createJobLoop, createJobStore, isFatalError, RETRY_DELAYS_MS, type StepResult, type TransientKind } from './runner';

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
const ALARM = 'synckai:test-job';
const T0 = 1_000_000_000_000;
const realSetTimeout = globalThis.setTimeout;

const fake = installFakeChrome();
const isTestJob = (value: unknown): value is TestJob =>
  isJobOf(value, (kind): kind is 'test' => kind === 'test', (item): item is string => typeof item === 'string');
const store = createJobStore<TestJob>(JOB_KEY, isTestJob);

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
  fake.reset({ [JOB_KEY]: startJob('test', ['a', 'b', 'c'], T0) });
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
    expect(job()).toMatchObject({ status: 'done', done: 3, updated: 3, pending: [] });
    expect(await chrome.alarms.get(ALARM)).toBeUndefined();
    expect(h.onEnd).toHaveBeenCalledOnce();
  });

  it('erreur passagère : pause visible puis même élément retenté ; essais remis à zéro à l’élément suivant', async () => {
    const h = harness({ a: [retry('server'), retry('server'), done()], b: [retry('server'), done()] });
    h.ensure();
    await flush();
    // Pause « serveur » de 5 s sur l'élément a, toujours en tête de file
    expect(job()).toMatchObject({ status: 'running', pending: ['a', 'b', 'c'], pauseReason: 'server', pauseService: 'mal', pausedUntil: T0 + RETRY_DELAYS_MS.server[0] });
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
    expect(job()).toMatchObject({ status: 'cancelled', done: 0, pending: ['a', 'b', 'c'], pausedUntil: null });
    expect(await chrome.alarms.get(ALARM)).toBeUndefined();
    expect(h.onEnd).toHaveBeenCalledOnce();
  });

  it('step.stop (erreur bloquante) : arrêtée avec le message, éléments restants non traités, alarme retirée', async () => {
    const h = harness({ a: [done('failed', 'Session expirée')] });
    h.ensure();
    await flush();
    expect(h.calls.map((c) => c.item)).toEqual(['a']);
    expect(job()).toMatchObject({ status: 'stopped', message: 'Session expirée', done: 1, failed: 1, pending: ['b', 'c'] });
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
    expect(job()).toMatchObject({ status: 'running', pauseReason: 'resume', pending: ['a', 'b', 'c'] });

    // L'ancienne boucle se réveille pendant que la nouvelle traite a : son résultat n'est pas appliqué
    stuck.release(done('failed'));
    await flush();
    expect(job()).toMatchObject({ status: 'running', done: 0, failed: 0, pending: ['a', 'b', 'c'] });

    retried.release(done());
    await flush();
    expect(h.calls.map((c) => c.item)).toEqual(['a', 'a', 'b', 'c']);
    expect(job()).toMatchObject({ status: 'done', done: 3, updated: 3, failed: 0, pending: [] });
    expect(h.onEnd).toHaveBeenCalledOnce();
  });
});
