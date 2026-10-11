import { isRecord } from './guards';
import { isJobOf, startJob, type Job } from './job';
import { STORAGE_KEYS } from './storage-keys';
import { isTrackerId, type TrackerId } from './tracker.types';

// Tâche de comparaison (analyse ou alignement) persistée dans chrome.storage.local (`compare:job`) :
// le popup affiche sa progression (même rouvert) et le service worker la reprend s'il a été arrêté.
// Transitions, état vivant / interrompu et pauses : tâche générique (job.ts).

export { isJobActive, isJobStale, JOB_STALE_MS, pauseSecondsLeft, reduceJob, type JobEvent, type JobStatus, type PauseReason } from './job';

export const COMPARE_JOB_KEY = STORAGE_KEYS.compareJob;
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

export const startApplyJob = (items: readonly ApplyDiffItem[], source: TrackerId, now: number): CompareJob => ({ ...startJob('apply', items, now), source });
export const startAnalyzeJob = (now: number): CompareJob => ({ ...startJob<JobKind, ApplyDiffItem>('analyze', [], now), source: null });

const isId = (v: unknown): v is number | null => v === null || (typeof v === 'number' && Number.isInteger(v) && v >= 1);
const isKind = (v: unknown): v is JobKind => v === 'analyze' || v === 'apply';
const isItem = (p: unknown): p is ApplyDiffItem => isRecord(p) && isId(p.mediaId) && isId(p.malId);

export function isCompareJob(value: unknown): value is CompareJob {
  return isRecord(value) && (value.source === null || isTrackerId(value.source)) && isJobOf(value, isKind, isItem);
}
