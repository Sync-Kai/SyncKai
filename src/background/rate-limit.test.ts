import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  BACKGROUND_PER_MINUTE,
  backgroundQuota,
  INTERACTIVE_GRACE_MS,
  INTERACTIVE_RESERVE,
  MAX_BACKGROUND_PER_MINUTE,
  PREPAID_SLOT_TTL_MS,
  readRateLimitHeaders,
  RequestBudget,
  retryDelayMs,
  sleep,
  type BudgetWait,
} from './rate-limit';

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

describe('backgroundQuota (PERF-21) : quota de fond selon X-RateLimit-Limit', () => {
  it('limite normale (90/min) : 45 requêtes de fond par minute, le reste pour les écrans', () => {
    expect(backgroundQuota(90)).toBe(45);
    expect(MAX_BACKGROUND_PER_MINUTE).toBe(45);
  });

  it('mode dégradé (30/min, état actuel d’AniList) ou limite inconnue : exactement 20, comme avant', () => {
    expect(backgroundQuota(30)).toBe(BACKGROUND_PER_MINUTE);
    expect(BACKGROUND_PER_MINUTE).toBe(20);
    expect(backgroundQuota(null)).toBe(20);
    // 0 : en-tête absurde, traité comme illisible
    expect(backgroundQuota(0)).toBe(20);
  });

  it('valeurs intermédiaires ou inhabituelles : croissant avec la limite, plafonné à 45, jamais au-delà de limite − réserve', () => {
    expect(backgroundQuota(60)).toBe(35);
    expect(backgroundQuota(40)).toBe(25);
    expect(backgroundQuota(120)).toBe(45);
    expect(backgroundQuota(20)).toBe(10);
    expect(backgroundQuota(5)).toBe(1);
    let previous = 0;
    for (let limit = 1; limit <= 300; limit++) {
      const quota = backgroundQuota(limit);
      expect(quota).toBeGreaterThanOrEqual(previous);
      expect(quota).toBeLessThanOrEqual(Math.max(1, limit - INTERACTIVE_RESERVE));
      expect(quota).toBeLessThanOrEqual(MAX_BACKGROUND_PER_MINUTE);
      previous = quota;
    }
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

  it('PERF-21 : le quota de fond suit la limite annoncée, recalculé à chaque nouvelle limite (90 → 45, puis 30 → 20)', async () => {
    const b = budget();
    expect(b.backgroundPerMinute()).toBe(BACKGROUND_PER_MINUTE);
    b.observe({ limit: 90, remaining: null });
    expect(b.backgroundPerMinute()).toBe(45);
    let started = 0;
    for (let i = 0; i < 50; i++) void b.acquire('background').then(() => started++);
    await vi.advanceTimersByTimeAsync(1_000);
    expect(started).toBe(45);
    // AniList passe en mode dégradé : les 45 départs de la minute dépassent déjà le nouveau quota
    b.observe({ limit: 30, remaining: null });
    expect(b.backgroundPerMinute()).toBe(20);
    expect(b.backgroundWait()).toBeGreaterThan(50_000);
    for (let i = 0; i < 30; i++) void b.acquire('background').then(() => started++);
    // Minute suivante : 20 départs au plus
    await vi.advanceTimersByTimeAsync(60_000);
    expect(started).toBe(45 + 20);
  });

  it('PERF-21 : réponse sans limite lisible → dernière limite gardée ; 429 → retour au quota prudent (20)', async () => {
    const b = budget();
    b.observe({ limit: 90, remaining: 80 });
    b.observe({ limit: null, remaining: 79 });
    expect(b.backgroundPerMinute()).toBe(45);
    b.penalize(5_000);
    expect(b.backgroundPerMinute()).toBe(BACKGROUND_PER_MINUTE);
  });

  it('B9 : place de fond réservée par une tâche (avant le verrou de la fiche) → sa requête part aussitôt, comptée une seule fois', async () => {
    const b = budget();
    for (let i = 0; i < BACKGROUND_PER_MINUTE; i++) await b.reserveBackground();
    // Quota de la minute atteint par les réservations : les requêtes réservées partent quand même, sans attente
    expect(await startedWithin(b, BACKGROUND_PER_MINUTE, 100)).toBe(BACKGROUND_PER_MINUTE);
    // Réservations épuisées : la suivante attend la minute suivante, comme toute requête de fond
    expect(await startedWithin(b, 1, 100)).toBe(0);
  });

  it('B9 : requête de fond (même réservée) sans délai de grâce interactif : la tâche suivante n’est pas retardée', async () => {
    const b = budget();
    await b.reserveBackground();
    (await b.acquire('background'))();
    expect(b.backgroundWait()).toBe(0);
    // Une requête interactive, elle, retient les tâches de fond le temps du délai de grâce
    (await b.acquire('interactive'))();
    expect(b.backgroundWait()).toBe(INTERACTIVE_GRACE_MS);
  });

  it('B9 : place réservée inutilisée (écriture finalement inutile) : oubliée après PREPAID_SLOT_TTL_MS ; jamais utilisée pendant une pénalité 429', async () => {
    const b = budget();
    for (let i = 0; i < BACKGROUND_PER_MINUTE; i++) await b.reserveBackground();
    await vi.advanceTimersByTimeAsync(PREPAID_SLOT_TTL_MS + 1);
    expect(await startedWithin(b, 1, 100)).toBe(0);
    const c = budget();
    await c.reserveBackground();
    c.penalize(5_000);
    expect(await startedWithin(c, 1, 4_900)).toBe(0);
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
