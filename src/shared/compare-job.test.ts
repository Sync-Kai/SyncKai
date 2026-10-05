import { describe, expect, it } from 'vitest';
import { isCompareJob, isJobActive, isJobStale, JOB_STALE_MS, pauseSecondsLeft, reduceJob, startAnalyzeJob, startApplyJob } from './compare-job';

const items = [
  { mediaId: 1, malId: 101 },
  { mediaId: 2, malId: 102 },
  { mediaId: null, malId: 103 },
];

describe('tâche d’alignement : transitions', () => {
  it('démarre en cours avec toutes les séries à traiter', () => {
    const job = startApplyJob(items, 'anilist', 1_000);
    expect(job).toMatchObject({ kind: 'apply', source: 'anilist', status: 'running', total: 3, done: 0, pending: items, cancelled: false, startedAt: 1_000, updatedAt: 1_000 });
  });

  it('chaque série traitée avance la progression et compte son résultat', () => {
    let job = startApplyJob(items, 'mal', 0);
    job = reduceJob(job, { type: 'item', outcome: 'updated', at: 10 });
    job = reduceJob(job, { type: 'item', outcome: 'failed', message: 'Erreur MAL (400).', at: 20 });
    expect(job).toMatchObject({ status: 'running', done: 2, updated: 1, failed: 1, skipped: 0, updatedAt: 20, messages: ['Erreur MAL (400).'] });
    expect(job.pending).toEqual([items[2]]);
    job = reduceJob(job, { type: 'item', outcome: 'skipped', message: 'Erreur MAL (400).', at: 30 });
    expect(job).toMatchObject({ status: 'done', done: 3, skipped: 1, pending: [], messages: ['Erreur MAL (400).'] });
  });

  it('« Arrêter » : la série en cours se termine, puis la tâche est close comme arrêtée', () => {
    let job = reduceJob(startApplyJob(items, 'anilist', 0), { type: 'cancel', at: 5 });
    expect(job).toMatchObject({ status: 'running', cancelled: true });
    job = reduceJob(job, { type: 'item', outcome: 'updated', at: 6 });
    job = reduceJob(job, { type: 'finish', at: 7 });
    expect(job).toMatchObject({ status: 'cancelled', done: 1, updated: 1 });
    expect(job.pending).toHaveLength(2);
  });

  it('arrêt sur erreur bloquante : message conservé, séries restantes non traitées', () => {
    const job = reduceJob(startApplyJob(items, 'anilist', 0), { type: 'stop', message: 'Session expirée', at: 9 });
    expect(job).toMatchObject({ status: 'stopped', message: 'Session expirée', done: 0 });
    expect(job.pending).toHaveLength(3);
  });

  it('une tâche terminée n’évolue plus', () => {
    const done = reduceJob(startApplyJob([items[0]!], 'anilist', 0), { type: 'item', outcome: 'updated', at: 1 });
    expect(done.status).toBe('done');
    expect(reduceJob(done, { type: 'item', outcome: 'failed', at: 2 })).toBe(done);
    expect(reduceJob(done, { type: 'cancel', at: 2 })).toBe(done);
  });

  it('messages distincts limités à 5', () => {
    let job = startApplyJob(Array.from({ length: 8 }, (_, i) => ({ mediaId: i + 1, malId: i + 1 })), 'anilist', 0);
    for (let i = 0; i < 7; i++) job = reduceJob(job, { type: 'item', outcome: 'failed', message: `e${i}`, at: i });
    expect(job.messages).toEqual(['e0', 'e1', 'e2', 'e3', 'e4']);
  });
});

describe('tâche vivante / interrompue', () => {
  it('signe de vie récent : active ; au-delà du délai : interrompue (reprise ou abandon)', () => {
    const job = startAnalyzeJob(0);
    expect(isJobActive(job, JOB_STALE_MS - 1)).toBe(true);
    expect(isJobStale(job, JOB_STALE_MS - 1)).toBe(false);
    expect(isJobActive(job, JOB_STALE_MS)).toBe(false);
    expect(isJobStale(job, JOB_STALE_MS)).toBe(true);
    expect(isJobActive(reduceJob(job, { type: 'touch', at: JOB_STALE_MS }), JOB_STALE_MS + 1)).toBe(true);
  });

  it('une tâche terminée ou absente ne bloque rien', () => {
    expect(isJobActive(null, 0)).toBe(false);
    const done = reduceJob(startApplyJob(items, 'mal', 0), { type: 'finish', at: 1 });
    expect(isJobActive(done, 2)).toBe(false);
    expect(isJobStale(done, JOB_STALE_MS * 2)).toBe(false);
  });

  it('isCompareJob valide le stockage', () => {
    expect(isCompareJob(startApplyJob(items, 'mal', 0))).toBe(true);
    expect(isCompareJob(startAnalyzeJob(0))).toBe(true);
    expect(isCompareJob({ ...startAnalyzeJob(0), status: 'paused' })).toBe(false);
    expect(isCompareJob({ ...startApplyJob(items, 'mal', 0), pending: [{ mediaId: 0, malId: 1 }] })).toBe(false);
    expect(isCompareJob(null)).toBe(false);
  });
});

describe('pauses (limite de requêtes, service lent, reprise)', () => {
  const pause = (reason: 'rate-limit' | 'server' | 'network' | 'resume', until: number) =>
    reduceJob(startApplyJob(items, 'anilist', 0), { type: 'pause', until, reason, service: reason === 'resume' ? null : 'mal', at: 10 });

  it('pause : fin d’attente, raison et service enregistrés, série gardée en tête de file', () => {
    const job = pause('server', 15_010);
    expect(job).toMatchObject({ status: 'running', pausedUntil: 15_010, pauseReason: 'server', pauseService: 'mal', done: 0, updatedAt: 10 });
    expect(job.pending).toEqual(items);
    expect(pauseSecondsLeft(job, 10)).toBe(15);
    expect(pauseSecondsLeft(job, 20_000)).toBe(0);
  });

  it('la série suivante démarre : fin de la pause', () => {
    const job = reduceJob(pause('rate-limit', 60_000), { type: 'item-start', at: 60_001 });
    expect(job).toMatchObject({ pausedUntil: null, pauseReason: null, pauseService: null, updatedAt: 60_001 });
  });

  it('« Reprise… » reste affichée jusqu’à la fin de la série reprise', () => {
    const resumed = reduceJob(pause('resume', 10), { type: 'item-start', at: 11 });
    expect(resumed.pauseReason).toBe('resume');
    expect(reduceJob(resumed, { type: 'item', outcome: 'updated', at: 12 })).toMatchObject({ pausedUntil: null, pauseReason: null });
  });

  it('arrêt ou fin : plus de pause affichée', () => {
    expect(reduceJob(pause('network', 99), { type: 'stop', message: 'x', at: 20 }).pausedUntil).toBeNull();
    expect(reduceJob(pause('network', 99), { type: 'finish', at: 20 }).pausedUntil).toBeNull();
    expect(pauseSecondsLeft(null, 0)).toBe(0);
  });

  it('isCompareJob accepte une tâche en pause, refuse une raison inconnue', () => {
    expect(isCompareJob(pause('server', 5))).toBe(true);
    expect(isCompareJob({ ...pause('server', 5), pauseReason: 'lunch' })).toBe(false);
  });
});
