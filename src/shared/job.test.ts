import { describe, expect, it } from 'vitest';
import { fromLegacyJob, isJobOf, reduceJob, startItem, startJob, type Job } from './job';

// Tâche générique : les tests détaillés des transitions restent dans compare-job.test.ts (comportement inchangé)

interface TaggedJob extends Job<'demo', string> {
  tag: string;
}

const isKind = (v: unknown): v is 'demo' => v === 'demo';
const isItem = (v: unknown): v is string => typeof v === 'string';

/** Tâche au format précédent (file `pending` dans la tâche, sans curseur) */
function legacyJob(fields: Record<string, unknown>, pending: unknown[]): Record<string, unknown> {
  const legacy: Record<string, unknown> = { ...startJob('demo', [], 0).job, ...fields, pending };
  delete legacy.cursor;
  delete legacy.itemCount;
  delete legacy.current;
  return legacy;
}

describe('tâche générique', () => {
  it('démarrage : la tâche (petite, sans les éléments) et sa liste, écrite à part', () => {
    const items = ['a', 'b'];
    const start = startJob('demo', items, 5);
    expect(start.items).toEqual(['a', 'b']);
    expect(start.items).not.toBe(items);
    expect(start.job).toMatchObject({ kind: 'demo', status: 'running', total: 2, done: 0, cursor: 0, itemCount: 2, current: null, startedAt: 5 });
    expect(start.job).not.toHaveProperty('pending');
  });

  it('les champs propres à un type de tâche traversent les transitions', () => {
    let job: TaggedJob = { ...startJob('demo', ['a', 'b'], 0).job, tag: 'x' };
    job = reduceJob(job, { type: 'item', outcome: 'updated', at: 1 });
    job = reduceJob(job, { type: 'pause', until: 10, reason: 'rate-limit', service: 'anilist', at: 2 });
    expect(job).toMatchObject({ tag: 'x', cursor: 1, done: 1, pausedUntil: 10 });
    job = reduceJob(job, { type: 'item', outcome: 'skipped', at: 3 });
    expect(job).toMatchObject({ tag: 'x', status: 'done', cursor: 2, skipped: 1, pausedUntil: null });
  });

  it('élément démarré : affiché (`current`) jusqu’à sa fin, qui avance le curseur', () => {
    let job = startJob('demo', ['a', 'b'], 0).job;
    job = reduceJob(job, { type: 'pause', until: 10, reason: 'budget', service: 'anilist', at: 1 });
    job = startItem(job, 'a', 2);
    expect(job).toMatchObject({ current: 'a', cursor: 0, updatedAt: 2, pausedUntil: null });
    job = reduceJob(job, { type: 'item', outcome: 'updated', at: 3 });
    expect(job).toMatchObject({ current: null, cursor: 1, done: 1, status: 'running' });
    // Reprise après interruption : « Reprise… » reste affiché pendant l'élément repris
    const resumed = startItem(reduceJob(job, { type: 'pause', until: 4, reason: 'resume', service: null, at: 4 }), 'b', 5);
    expect(resumed).toMatchObject({ current: 'b', pauseReason: 'resume' });
    const stopped = reduceJob(resumed, { type: 'stop', message: 'Session expirée', at: 6 });
    expect(stopped).toMatchObject({ status: 'stopped', current: null });
    expect(startItem(stopped, 'b', 7)).toBe(stopped);
  });

  it('fin : quand le curseur atteint le nombre d’éléments de la liste, pas `total` (tâche convertie)', () => {
    let job = startJob('demo', ['a', 'b', 'c'], 0).job;
    job = { ...job, total: 10, done: 7 };
    for (let i = 0; i < 2; i++) job = reduceJob(job, { type: 'item', outcome: 'updated', at: i });
    expect(job).toMatchObject({ status: 'running', done: 9, cursor: 2 });
    job = reduceJob(job, { type: 'item', outcome: 'updated', at: 3 });
    expect(job).toMatchObject({ status: 'done', done: 10, total: 10, cursor: 3 });
  });

  it('attente du quota AniList : pause « budget », levée par wait-end (une pause réseau ou une reprise reste)', () => {
    let job: TaggedJob = { ...startJob('demo', ['a', 'b'], 0).job, tag: 'x' };
    job = reduceJob(job, { type: 'pause', until: 12_000, reason: 'budget', service: 'anilist', at: 1 });
    expect(job).toMatchObject({ pausedUntil: 12_000, pauseReason: 'budget', pauseService: 'anilist', updatedAt: 1 });
    expect(isJobOf(job, isKind, isItem)).toBe(true);
    job = reduceJob(job, { type: 'wait-end', at: 2 });
    expect(job).toMatchObject({ pausedUntil: null, pauseReason: null, pauseService: null, updatedAt: 2, cursor: 0 });
    job = reduceJob(job, { type: 'pause', until: 9, reason: 'rate-limit', service: 'anilist', at: 3 });
    expect(reduceJob(job, { type: 'wait-end', at: 4 }).pauseReason).toBeNull();
    const network = reduceJob(job, { type: 'pause', until: 9, reason: 'network', service: 'mal', at: 5 });
    expect(reduceJob(network, { type: 'wait-end', at: 6 })).toMatchObject({ pauseReason: 'network', updatedAt: 6 });
  });

  it('isJobOf valide le type de tâche, le curseur et l’élément en cours ; refuse le format précédent', () => {
    const { job } = startJob('demo', ['a'], 0);
    expect(isJobOf(job, isKind, isItem)).toBe(true);
    expect(isJobOf(startItem(job, 'a', 1), isKind, isItem)).toBe(true);
    expect(isJobOf({ ...job, kind: 'other' }, isKind, isItem)).toBe(false);
    expect(isJobOf({ ...job, current: 1 }, isKind, isItem)).toBe(false);
    expect(isJobOf({ ...job, cursor: 2 }, isKind, isItem)).toBe(false);
    expect(isJobOf({ ...job, cursor: -1 }, isKind, isItem)).toBe(false);
    expect(isJobOf(legacyJob({}, ['a']), isKind, isItem)).toBe(false);
  });
});

describe('tâche d’une version précédente (fromLegacyJob)', () => {
  it('file restante → liste de la tâche, curseur au début, compteurs et champs propres conservés', () => {
    const legacy = legacyJob({ total: 5, done: 2, updated: 1, failed: 1, tag: 'x', pausedUntil: 9, pauseReason: 'network', pauseService: 'mal' }, ['c', 'd', 'e']);
    const converted = fromLegacyJob(legacy, isKind, isItem);
    expect(converted?.items).toEqual(['c', 'd', 'e']);
    expect(converted?.job).toMatchObject({ total: 5, done: 2, updated: 1, failed: 1, tag: 'x', cursor: 0, itemCount: 3, current: null, pauseReason: 'network' });
    expect(converted?.job).not.toHaveProperty('pending');
    expect(isJobOf(converted?.job, isKind, isItem)).toBe(true);
  });

  it('refuse le format actuel, un élément invalide ou une tâche invalide', () => {
    expect(fromLegacyJob(startJob('demo', ['a'], 0).job, isKind, isItem)).toBeNull();
    expect(fromLegacyJob(legacyJob({}, [1]), isKind, isItem)).toBeNull();
    expect(fromLegacyJob(legacyJob({ status: 'paused' }, ['a']), isKind, isItem)).toBeNull();
    expect(fromLegacyJob(null, isKind, isItem)).toBeNull();
  });
});
