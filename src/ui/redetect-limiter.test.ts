import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRedetectLimiter, type RedetectLimiter } from './redetect-limiter';

// Plafond des relectures automatiques de la fiche (1 toutes les 2 s, 5 par minute, `navigated`) : mêmes règles que
// lorsqu'il vivait dans ui/page-media-controller.ts (CLAUDE.md › Series pages of bridge platforms)

let runs: boolean[];
let active: boolean;
let suspended: number;
let limiter: RedetectLimiter;

beforeEach(() => {
  vi.useFakeTimers();
  runs = [];
  active = true;
  suspended = 0;
  limiter = createRedetectLimiter({
    minIntervalMs: 2_000,
    maxPerMinute: 5,
    run: (reresolve) => runs.push(reresolve),
    active: () => active,
    onSuspend: () => suspended++,
  });
});

afterEach(() => {
  limiter.dispose();
  vi.useRealTimers();
});

describe('createRedetectLimiter', () => {
  it('première demande accordée aussitôt', () => {
    limiter.request(false);
    expect(runs).toEqual([false]);
  });

  it('rafale dans les 2 s : une seule relecture reportée, `reresolve` cumulé', () => {
    limiter.request(false);
    limiter.request(false);
    limiter.request(true);
    limiter.request(false);
    expect(runs).toEqual([false]);
    vi.advanceTimersByTime(1_999);
    expect(runs).toEqual([false]);
    vi.advanceTimersByTime(1);
    expect(runs).toEqual([false, true]);
  });

  it('6e relecture dans la minute : suspendue jusqu’à reset, signalée une fois', () => {
    for (let i = 0; i < 5; i++) {
      limiter.request(false);
      vi.advanceTimersByTime(2_000);
    }
    expect(runs).toHaveLength(5);
    limiter.request(false);
    limiter.request(true);
    vi.advanceTimersByTime(60_000);
    limiter.request(false);
    expect(runs).toHaveLength(5);
    expect(suspended).toBe(1);
    limiter.reset();
    limiter.request(true);
    expect(runs).toEqual([false, false, false, false, false, true]);
  });

  it('demandes espacées de plus d’une minute : jamais suspendues', () => {
    for (let i = 0; i < 12; i++) {
      limiter.request(false);
      vi.advanceTimersByTime(15_000);
    }
    expect(runs).toHaveLength(12);
    expect(suspended).toBe(0);
  });

  it('navigated : suspension levée, compte de la minute remis à zéro, intervalle de 2 s gardé', () => {
    for (let i = 0; i < 5; i++) {
      limiter.request(false);
      vi.advanceTimersByTime(2_000);
    }
    limiter.request(false);
    expect(suspended).toBe(1);
    limiter.navigated();
    expect(runs).toHaveLength(6);
    // Choix suivant dans les 2 s : regroupé, pas perdu
    limiter.navigated();
    expect(runs).toHaveLength(6);
    vi.advanceTimersByTime(2_000);
    expect(runs).toHaveLength(7);
  });

  it('navigated reprend le `reresolve` de la relecture reportée', () => {
    limiter.request(false);
    limiter.request(true);
    limiter.navigated();
    vi.advanceTimersByTime(2_000);
    expect(runs).toEqual([false, true]);
  });

  it('inactif (aucun onglet) : demande ignorée sans être comptée', () => {
    active = false;
    limiter.request(true);
    expect(runs).toEqual([]);
    active = true;
    limiter.request(false);
    expect(runs).toEqual([false]);
  });

  it('reset : relecture reportée oubliée', () => {
    limiter.request(false);
    limiter.request(true);
    limiter.reset();
    vi.advanceTimersByTime(5_000);
    expect(runs).toEqual([false]);
  });

  it('dispose : relecture reportée annulée', () => {
    limiter.request(false);
    limiter.request(true);
    limiter.dispose();
    vi.advanceTimersByTime(5_000);
    expect(runs).toEqual([false]);
  });
});
