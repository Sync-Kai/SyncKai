import { isRecord } from './guards';
import { fromLegacyJob, isJobOf, startJob, type Job, type JobStart } from './job';
import { STORAGE_KEYS } from '../protocol/storage-keys';
import { isTrackerId, type TrackerId } from './tracker.types';

// Tâche de comparaison (analyse ou alignement) persistée dans chrome.storage.local (`compare:job`) :
// le popup affiche sa progression (même rouvert) et le service worker la reprend s'il a été arrêté.
// Transitions, état vivant / interrompu et pauses : tâche générique (job.ts).

export { isJobActive, isJobStale, JOB_STALE_MS, pauseSecondsLeft, reduceJob, type JobEvent, type JobStatus, type PauseReason } from './job';

export const COMPARE_JOB_KEY = STORAGE_KEYS.compareJob;
/** Séries de l'alignement, écrites une fois au démarrage (la tâche n'en garde que le curseur) */
export const COMPARE_JOB_ITEMS_KEY = STORAGE_KEYS.compareJobItems;
/** Alarme de reprise : relance la boucle d'alignement si le service worker a redémarré */
export const COMPARE_JOB_ALARM = 'synckai:compare-job';

export type JobKind = 'analyze' | 'apply';

/** Fiche à aligner (identifiants AniList et MAL) */
export interface ApplyDiffItem {
  mediaId: number | null;
  malId: number | null;
}

export interface CompareJob extends Job<JobKind, ApplyDiffItem> {
  /** Service de référence d'un alignement (null pour une analyse) */
  source: TrackerId | null;
}

function withSource({ job, items }: JobStart<Job<JobKind, ApplyDiffItem>>, source: TrackerId | null): JobStart<CompareJob> {
  return { job: { ...job, source }, items };
}

export const startApplyJob = (items: readonly ApplyDiffItem[], source: TrackerId, now: number): JobStart<CompareJob> => withSource(startJob('apply', items, now), source);
export const startAnalyzeJob = (now: number): JobStart<CompareJob> => withSource(startJob<JobKind, ApplyDiffItem>('analyze', [], now), null);

const isId = (v: unknown): v is number | null => v === null || (typeof v === 'number' && Number.isInteger(v) && v >= 1);
const isKind = (v: unknown): v is JobKind => v === 'analyze' || v === 'apply';
export const isApplyDiffItem = (p: unknown): p is ApplyDiffItem => isRecord(p) && isId(p.mediaId) && isId(p.malId);
const isSource = (v: unknown): v is TrackerId | null => v === null || isTrackerId(v);

export function isCompareJob(value: unknown): value is CompareJob {
  return isRecord(value) && isSource(value.source) && isJobOf(value, isKind, isApplyDiffItem);
}

/** Tâche enregistrée avant PERF-16 (file `pending` dans la tâche) : convertie, voir fromLegacyJob */
export function compareJobFromLegacy(value: unknown): JobStart<CompareJob> | null {
  if (!isRecord(value) || !isSource(value.source)) return null;
  const legacy = fromLegacyJob(value, isKind, isApplyDiffItem);
  return legacy && withSource(legacy, value.source);
}

/** Série en cours d'écriture (élément démarré de l'alignement), null hors alignement en cours */
export function currentApplyMalId(job: CompareJob | null): number | null {
  return job?.kind === 'apply' && job.status === 'running' ? (job.current?.malId ?? null) : null;
}
