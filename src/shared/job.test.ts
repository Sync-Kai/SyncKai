import { describe, expect, it } from 'vitest';
import { isJobOf, reduceJob, startJob, type Job } from './job';

// Tâche générique : les tests détaillés des transitions restent dans compare-job.test.ts (comportement inchangé)

interface TaggedJob extends Job<'demo', string> {
  tag: string;
}

describe('tâche générique', () => {
  it('les champs propres à un type de tâche traversent les transitions', () => {
    let job: TaggedJob = { ...startJob('demo', ['a', 'b'], 0), tag: 'x' };
    job = reduceJob(job, { type: 'item', outcome: 'updated', at: 1 });
    job = reduceJob(job, { type: 'pause', until: 10, reason: 'rate-limit', service: 'anilist', at: 2 });
    expect(job).toMatchObject({ tag: 'x', pending: ['b'], done: 1, pausedUntil: 10 });
    job = reduceJob(job, { type: 'item', outcome: 'skipped', at: 3 });
    expect(job).toMatchObject({ tag: 'x', status: 'done', skipped: 1, pausedUntil: null });
  });

  it('attente du quota AniList : pause « budget », levée par wait-end (une pause réseau ou une reprise reste)', () => {
    let job: TaggedJob = { ...startJob('demo', ['a', 'b'], 0), tag: 'x' };
    job = reduceJob(job, { type: 'pause', until: 12_000, reason: 'budget', service: 'anilist', at: 1 });
    expect(job).toMatchObject({ pausedUntil: 12_000, pauseReason: 'budget', pauseService: 'anilist', updatedAt: 1 });
    expect(isJobOf(job, (v): v is 'demo' => v === 'demo', (v): v is string => typeof v === 'string')).toBe(true);
    job = reduceJob(job, { type: 'wait-end', at: 2 });
    expect(job).toMatchObject({ pausedUntil: null, pauseReason: null, pauseService: null, updatedAt: 2, pending: ['a', 'b'] });
    job = reduceJob(job, { type: 'pause', until: 9, reason: 'rate-limit', service: 'anilist', at: 3 });
    expect(reduceJob(job, { type: 'wait-end', at: 4 }).pauseReason).toBeNull();
    const network = reduceJob(job, { type: 'pause', until: 9, reason: 'network', service: 'mal', at: 5 });
    expect(reduceJob(network, { type: 'wait-end', at: 6 })).toMatchObject({ pauseReason: 'network', updatedAt: 6 });
  });

  it('isJobOf valide le type de tâche et chaque élément de la file', () => {
    const isKind = (v: unknown): v is 'demo' => v === 'demo';
    const isItem = (v: unknown): v is string => typeof v === 'string';
    expect(isJobOf(startJob('demo', ['a'], 0), isKind, isItem)).toBe(true);
    expect(isJobOf({ ...startJob('demo', ['a'], 0), kind: 'other' }, isKind, isItem)).toBe(false);
    expect(isJobOf({ ...startJob('demo', ['a'], 0), pending: [1] }, isKind, isItem)).toBe(false);
  });
});
