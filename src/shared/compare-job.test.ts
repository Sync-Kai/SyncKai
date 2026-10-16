import { describe, expect, it } from 'vitest';
import { startItem } from './job';
import { compareJobFromLegacy, currentApplyMalId, isCompareJob, isJobActive, isJobStale, JOB_STALE_MS, pauseSecondsLeft, reduceJob, startAnalyzeJob, startApplyJob } from './compare-job';

const items = [
  { mediaId: 1, malId: 101 },
  { mediaId: 2, malId: 102 },
  { mediaId: null, malId: 103 },
];

describe('tâche d’alignement : transitions', () => {
  it('démarre en cours avec toutes les séries à traiter', () => {
    const { job, items: list } = startApplyJob(items, 'anilist', 1_000);
    expect(job).toMatchObject({ kind: 'apply', source: 'anilist', status: 'running', total: 3, done: 0, cursor: 0, itemCount: 3, current: null, cancelled: false, startedAt: 1_000, updatedAt: 1_000 });
    expect(list).toEqual(items);
  });

  it('chaque série traitée avance la progression et compte son résultat', () => {
    let job = startApplyJob(items, 'mal', 0).job;
    job = reduceJob(job, { type: 'item', outcome: 'updated', at: 10 });
    job = reduceJob(job, { type: 'item', outcome: 'failed', message: 'Erreur MAL (400).', at: 20 });
    expect(job).toMatchObject({ status: 'running', done: 2, updated: 1, failed: 1, skipped: 0, updatedAt: 20, messages: ['Erreur MAL (400).'] });
    expect(job.cursor).toBe(2);
    job = reduceJob(job, { type: 'item', outcome: 'skipped', message: 'Erreur MAL (400).', at: 30 });
    expect(job).toMatchObject({ status: 'done', done: 3, skipped: 1, cursor: 3, messages: ['Erreur MAL (400).'] });
  });

  it('« Arrêter » : la série en cours se termine, puis la tâche est close comme arrêtée', () => {
    let job = reduceJob(startApplyJob(items, 'anilist', 0).job, { type: 'cancel', at: 5 });
    expect(job).toMatchObject({ status: 'running', cancelled: true });
    job = reduceJob(job, { type: 'item', outcome: 'updated', at: 6 });
    job = reduceJob(job, { type: 'finish', at: 7 });
    expect(job).toMatchObject({ status: 'cancelled', done: 1, updated: 1, cursor: 1 });
  });

  it('arrêt sur erreur bloquante : message conservé, séries restantes non traitées', () => {
    const job = reduceJob(startApplyJob(items, 'anilist', 0).job, { type: 'stop', message: 'Session expirée', at: 9 });
    expect(job).toMatchObject({ status: 'stopped', message: 'Session expirée', done: 0, cursor: 0 });
  });

  it('une tâche terminée n’évolue plus', () => {
    const done = reduceJob(startApplyJob([items[0]], 'anilist', 0).job, { type: 'item', outcome: 'updated', at: 1 });
    expect(done.status).toBe('done');
    expect(reduceJob(done, { type: 'item', outcome: 'failed', at: 2 })).toBe(done);
    expect(reduceJob(done, { type: 'cancel', at: 2 })).toBe(done);
  });

  it('messages distincts limités à 5', () => {
    let job = startApplyJob(Array.from({ length: 8 }, (_, i) => ({ mediaId: i + 1, malId: i + 1 })), 'anilist', 0).job;
    for (let i = 0; i < 7; i++) job = reduceJob(job, { type: 'item', outcome: 'failed', message: `e${i}`, at: i });
    expect(job.messages).toEqual(['e0', 'e1', 'e2', 'e3', 'e4']);
  });
});

describe('tâche vivante / interrompue', () => {
  it('signe de vie récent : active ; au-delà du délai : interrompue (reprise ou abandon)', () => {
    const job = startAnalyzeJob(0).job;
    expect(isJobActive(job, JOB_STALE_MS - 1)).toBe(true);
    expect(isJobStale(job, JOB_STALE_MS - 1)).toBe(false);
    expect(isJobActive(job, JOB_STALE_MS)).toBe(false);
    expect(isJobStale(job, JOB_STALE_MS)).toBe(true);
    expect(isJobActive(reduceJob(job, { type: 'touch', at: JOB_STALE_MS }), JOB_STALE_MS + 1)).toBe(true);
  });

  it('une tâche terminée ou absente ne bloque rien', () => {
    expect(isJobActive(null, 0)).toBe(false);
    const done = reduceJob(startApplyJob(items, 'mal', 0).job, { type: 'finish', at: 1 });
    expect(isJobActive(done, 2)).toBe(false);
    expect(isJobStale(done, JOB_STALE_MS * 2)).toBe(false);
  });

  it('isCompareJob valide le stockage', () => {
    const { job } = startApplyJob(items, 'mal', 0);
    expect(isCompareJob(job)).toBe(true);
    expect(isCompareJob(startAnalyzeJob(0).job)).toBe(true);
    expect(isCompareJob({ ...startAnalyzeJob(0).job, status: 'paused' })).toBe(false);
    expect(isCompareJob({ ...job, current: { mediaId: 0, malId: 1 } })).toBe(false);
    expect(isCompareJob({ ...job, source: 'kitsu' })).toBe(false);
    expect(isCompareJob(null)).toBe(false);
  });

  it('série en cours d’écriture : l’élément démarré (`current`), seulement pendant un alignement en cours', () => {
    const { job } = startApplyJob(items, 'mal', 0);
    expect(currentApplyMalId(job)).toBeNull();
    expect(currentApplyMalId(null)).toBeNull();
    const started = startItem(reduceJob(job, { type: 'item', outcome: 'updated', at: 1 }), items[1], 2);
    expect(currentApplyMalId(started)).toBe(102);
    expect(currentApplyMalId(reduceJob(started, { type: 'stop', message: 'x', at: 3 }))).toBeNull();
  });

  it('alignement d’une version précédente (file `pending`) : converti avec son service de référence', () => {
    const { job } = startApplyJob(items, 'mal', 0);
    const legacy: Record<string, unknown> = { ...job, done: 1, updated: 1, pending: items.slice(1) };
    delete legacy.cursor;
    delete legacy.itemCount;
    delete legacy.current;
    expect(isCompareJob(legacy)).toBe(false);
    const converted = compareJobFromLegacy(legacy);
    expect(converted?.items).toEqual(items.slice(1));
    expect(converted?.job).toMatchObject({ kind: 'apply', source: 'mal', total: 3, done: 1, cursor: 0, itemCount: 2, current: null });
    expect(isCompareJob(converted?.job)).toBe(true);
    expect(compareJobFromLegacy({ ...legacy, source: 'kitsu' })).toBeNull();
    expect(compareJobFromLegacy(job)).toBeNull();
  });
});

describe('pauses (limite de requêtes, service lent, reprise)', () => {
  const pause = (reason: 'rate-limit' | 'server' | 'network' | 'resume', until: number) =>
    reduceJob(startApplyJob(items, 'anilist', 0).job, { type: 'pause', until, reason, service: reason === 'resume' ? null : 'mal', at: 10 });

  it('pause : fin d’attente, raison et service enregistrés, série gardée en tête de file', () => {
    const job = pause('server', 15_010);
    expect(job).toMatchObject({ status: 'running', pausedUntil: 15_010, pauseReason: 'server', pauseService: 'mal', done: 0, updatedAt: 10 });
    expect(job.cursor).toBe(0);
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
