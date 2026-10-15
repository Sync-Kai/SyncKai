import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BACKGROUND_PER_MINUTE, INTERACTIVE_GRACE_MS, INTERACTIVE_RESERVE, readRateLimitHeaders, RequestBudget, retryDelayMs, sleep, type BudgetWait } from './rate-limit';

describe('retryDelayMs', () => {
  it('lit un délai en secondes, jamais moins de 5 s (« Retry-After: 0 » relancerait aussitôt)', () => {
    expect(retryDelayMs('8')).toBe(8000);
    expect(retryDelayMs('3')).toBe(5000);
    expect(retryDelayMs('0')).toBe(5000);
  });

  it('lit une date HTTP', () => {
    const now = Date.parse('2026-09-30T20:00:00Z');
    expect(retryDelayMs('Wed, 30 Sep 2026 20:00:10 GMT', now)).toBe(10_000);
  });

  it('respecte X-RateLimit-Reset (horodatage Unix) s’il impose une attente plus longue', () => {
    const now = Date.parse('2026-10-08T16:32:00Z');
    expect(retryDelayMs('0', now, String(now / 1000 + 12))).toBe(12_000);
    expect(retryDelayMs(null, now, String(now / 1000 - 30))).toBe(5000);
  });

  it('utilise un délai par défaut sans en-tête exploitable', () => {
    expect(retryDelayMs(null)).toBe(5000);
    expect(retryDelayMs('')).toBe(5000);
    expect(retryDelayMs('n’importe quoi')).toBe(5000);
  });

  it('abandonne si l’attente demandée est trop longue', () => {
    expect(retryDelayMs('60')).toBeNull();
  });
});

describe('readRateLimitHeaders', () => {
  it('lit X-RateLimit-Limit / Remaining, ignore les valeurs illisibles', () => {
    const headers = new Headers({ 'X-RateLimit-Limit': '30', 'X-RateLimit-Remaining': '7' });
    expect(readRateLimitHeaders(headers)).toEqual({ limit: 30, remaining: 7 });
    expect(readRateLimitHeaders(new Headers({ 'X-RateLimit-Remaining': 'abc' }))).toEqual({ limit: null, remaining: null });
  });
});

describe('RequestBudget', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(Date.parse('2026-10-08T16:29:00Z'));
  });
  afterEach(() => vi.useRealTimers());

  const budget = (): RequestBudget => new RequestBudget({ now: () => Date.now(), sleep });

  /** Démarre `count` requêtes de fond et renvoie le nombre parti après `ms` */
  async function startedWithin(b: RequestBudget, count: number, ms: number): Promise<number> {
    let started = 0;
    for (let i = 0; i < count; i++) void b.acquire('background').then(() => started++);
    await vi.advanceTimersByTimeAsync(ms);
    return started;
  }

  it('tâches de fond : au plus BACKGROUND_PER_MINUTE requêtes par minute glissante', async () => {
    const b = budget();
    let started = 0;
    const run = async (): Promise<void> => {
      for (let i = 0; i < BACKGROUND_PER_MINUTE + 5; i++) {
        await b.acquire('background');
        started++;
      }
    };
    void run();
    await vi.advanceTimersByTimeAsync(1_000);
    expect(started).toBe(BACKGROUND_PER_MINUTE);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(started).toBe(BACKGROUND_PER_MINUTE + 5);
  });

  it('requêtes interactives prioritaires : jamais retenues, la tâche de fond attend leur fin (+ délai de grâce)', async () => {
    const b = budget();
    for (let i = 0; i < BACKGROUND_PER_MINUTE * 2; i++) (await b.acquire('interactive'))();
    const release = await b.acquire('interactive');
    expect(await startedWithin(b, 1, 10_000)).toBe(0);
    release();
    let started = false;
    void b.acquire('background').then(() => (started = true));
    await vi.advanceTimersByTimeAsync(INTERACTIVE_GRACE_MS - 100);
    expect(started).toBe(false);
    await vi.advanceTimersByTimeAsync(200);
    expect(started).toBe(true);
  });

  it('réserve interactive annoncée par AniList (X-RateLimit-Remaining) : la tâche de fond attend la minute suivante', async () => {
    const b = budget();
    b.observe({ limit: 30, remaining: INTERACTIVE_RESERVE + 1 });
    expect(await startedWithin(b, 3, 100)).toBe(1);
    expect(b.backgroundWait()).toBeGreaterThan(50_000);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(b.backgroundWait()).toBe(0);
  });

  it('estimation de l’attente : quota (fin de la minute), pénalité 429, priorité interactive (reprise inconnue)', async () => {
    const b = budget();
    expect(b.backgroundWaitEstimate()).toBeNull();
    for (let i = 0; i < BACKGROUND_PER_MINUTE; i++) await b.acquire('background');
    expect(b.backgroundWaitEstimate()).toEqual({ reason: 'budget', until: Date.now() + 60_000 });
    b.penalize(90_000);
    expect(b.backgroundWaitEstimate()).toEqual({ reason: 'rate-limit', until: Date.now() + 90_000 });
    const fresh = budget();
    const release = await fresh.acquire('interactive');
    expect(fresh.backgroundWaitEstimate()).toEqual({ reason: 'budget', until: null });
    release();
  });

  it('attente de plus de 2 s signalée aux tâches (estimation), puis fin signalée quand la requête part', async () => {
    const b = budget();
    const events: (BudgetWait | null)[] = [];
    const unsubscribe = b.onBackgroundWait((w) => events.push(w));
    for (let i = 0; i < BACKGROUND_PER_MINUTE; i++) await b.acquire('background');
    expect(events).toEqual([]);
    const start = Date.now();
    let started = false;
    void b.acquire('background').then(() => (started = true));
    await vi.advanceTimersByTimeAsync(100);
    expect(events).toEqual([{ reason: 'budget', until: start + 60_000 }]);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(started).toBe(true);
    expect(events.at(-1)).toBeNull();
    // Attente courte (délai de grâce après une requête interactive) : rien d’affiché
    events.length = 0;
    (await b.acquire('interactive'))();
    void b.acquire('background');
    await vi.advanceTimersByTimeAsync(INTERACTIVE_GRACE_MS + 100);
    expect(events).toEqual([]);
    unsubscribe();
  });

  it('429 : pénalité commune (requêtes de fond suspendues), remaining remis à zéro', async () => {
    const b = budget();
    b.penalize(5_000);
    expect(b.cooldownLeft()).toBe(5_000);
    expect(await startedWithin(b, 1, 4_900)).toBe(0);
    await vi.advanceTimersByTimeAsync(200);
    expect(b.cooldownLeft()).toBe(0);
  });
});
