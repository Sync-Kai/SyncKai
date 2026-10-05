import type { ApplyDiffItem } from './compare';
import { isRecord } from './guards';
import { STORAGE_KEYS } from './storage';
import { isTrackerId, type TrackerId } from './tracker.types';

// Tâche de comparaison (analyse ou alignement) persistée dans chrome.storage.local (`compare:job`) :
// le popup affiche sa progression (même rouvert) et le service worker la reprend s'il a été arrêté.

export const COMPARE_JOB_KEY = STORAGE_KEYS.compareJob;
/** Alarme de reprise : relance la boucle d'alignement si le service worker a redémarré */
export const COMPARE_JOB_ALARM = 'synckai:compare-job';
/** Tâche « en cours » sans signe de vie depuis ce délai : considérée comme interrompue (reprise ou abandon) */
export const JOB_STALE_MS = 60_000;
/** Messages distincts conservés pour le bilan (séries ignorées ou en échec) */
const MAX_JOB_MESSAGES = 5;

export type JobKind = 'analyze' | 'apply';
/** Attente en cours : limite de requêtes (429), service surchargé (5xx, délai dépassé), réseau, ou reprise après une interruption du service worker */
export type PauseReason = 'rate-limit' | 'server' | 'network' | 'resume';
export type JobStatus = 'running' | 'done' | 'cancelled' | 'stopped';

export interface CompareJob {
  kind: JobKind;
  /** Service de référence d'un alignement (null pour une analyse) */
  source: TrackerId | null;
  status: JobStatus;
  total: number;
  done: number;
  updated: number;
  skipped: number;
  failed: number;
  /** Séries restant à traiter (la première est en cours) */
  pending: ApplyDiffItem[];
  /** « Arrêter » demandé : vérifié entre deux séries */
  cancelled: boolean;
  startedAt: number;
  /** Dernier signe de vie (après chaque série) : sert à détecter une tâche interrompue */
  updatedAt: number;
  /** Raison d'un arrêt (session expirée, réseau, limite de requêtes) */
  message: string | null;
  /** Raisons distinctes des séries ignorées ou en échec (infobulle du bilan) */
  messages: string[];
  /** Fin de l'attente en cours (ms), null hors pause : le popup affiche un compte à rebours */
  pausedUntil: number | null;
  pauseReason: PauseReason | null;
  /** Service qui a imposé l'attente (null : reprise) */
  pauseService: TrackerId | null;
}

export type JobEvent =
  | { type: 'item'; outcome: 'updated' | 'skipped' | 'failed'; message?: string; at: number }
  | { type: 'cancel'; at: number }
  /** Erreur bloquante : les séries restantes ne sont pas traitées */
  | { type: 'stop'; message: string; at: number }
  /** Fin de boucle : plus rien à traiter, ou arrêt demandé */
  | { type: 'finish'; at: number }
  | { type: 'touch'; at: number }
  /** Attente avant de retenter la série en cours (elle reste en tête de file) */
  | { type: 'pause'; until: number; reason: PauseReason; service: TrackerId | null; at: number }
  /** La série suivante démarre : fin de la pause éventuelle */
  | { type: 'item-start'; at: number };

function baseJob(kind: JobKind, source: TrackerId | null, pending: ApplyDiffItem[], now: number): CompareJob {
  return { kind, source, status: 'running', total: pending.length, done: 0, updated: 0, skipped: 0, failed: 0, pending, cancelled: false, startedAt: now, updatedAt: now, message: null, messages: [], pausedUntil: null, pauseReason: null, pauseService: null };
}

export const startApplyJob = (items: readonly ApplyDiffItem[], source: TrackerId, now: number): CompareJob => baseJob('apply', source, [...items], now);
export const startAnalyzeJob = (now: number): CompareJob => baseJob('analyze', null, [], now);

const NO_PAUSE = { pausedUntil: null, pauseReason: null, pauseService: null } as const;

/** Transitions de la tâche (pur, testé). Une tâche terminée n'évolue plus. */
export function reduceJob(job: CompareJob, event: JobEvent): CompareJob {
  if (job.status !== 'running') return job;
  switch (event.type) {
    case 'item': {
      const messages = event.message && !job.messages.includes(event.message) && job.messages.length < MAX_JOB_MESSAGES ? [...job.messages, event.message] : job.messages;
      const next: CompareJob = {
        ...job,
        pending: job.pending.slice(1),
        done: job.done + 1,
        updated: job.updated + (event.outcome === 'updated' ? 1 : 0),
        skipped: job.skipped + (event.outcome === 'skipped' ? 1 : 0),
        failed: job.failed + (event.outcome === 'failed' ? 1 : 0),
        messages,
        updatedAt: event.at,
        ...NO_PAUSE,
      };
      return next.pending.length === 0 ? { ...next, status: next.cancelled ? 'cancelled' : 'done' } : next;
    }
    case 'cancel':
      return { ...job, cancelled: true, updatedAt: event.at };
    case 'stop':
      return { ...job, status: 'stopped', message: event.message, updatedAt: event.at, ...NO_PAUSE };
    case 'finish':
      return { ...job, status: job.cancelled ? 'cancelled' : 'done', updatedAt: event.at, ...NO_PAUSE };
    case 'pause':
      return { ...job, pausedUntil: event.until, pauseReason: event.reason, pauseService: event.service, updatedAt: event.at };
    case 'item-start':
      // « Reprise après interruption » reste affiché jusqu'à la fin de la série reprise
      return job.pausedUntil === null || job.pauseReason === 'resume' ? { ...job, updatedAt: event.at } : { ...job, updatedAt: event.at, ...NO_PAUSE };
    case 'touch':
      return { ...job, updatedAt: event.at };
  }
}

/** Tâche en cours et vivante : bloque une nouvelle analyse ou un nouvel alignement */
export function isJobActive(job: CompareJob | null, now: number): job is CompareJob {
  return job !== null && job.status === 'running' && now - job.updatedAt < JOB_STALE_MS;
}

/** Tâche « en cours » sans signe de vie : service worker arrêté pendant le traitement */
export function isJobStale(job: CompareJob | null, now: number): job is CompareJob {
  return job !== null && job.status === 'running' && now - job.updatedAt >= JOB_STALE_MS;
}

const isCount = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 0;
const isId = (v: unknown): v is number | null => v === null || (typeof v === 'number' && Number.isInteger(v) && v >= 1);
const JOB_STATUSES: readonly JobStatus[] = ['running', 'done', 'cancelled', 'stopped'];
const PAUSE_REASONS: readonly PauseReason[] = ['rate-limit', 'server', 'network', 'resume'];

/** Secondes restantes avant la fin de la pause (0 si aucune pause ou pause échue) */
export function pauseSecondsLeft(job: CompareJob | null, now: number): number {
  return job?.pausedUntil ? Math.max(0, Math.ceil((job.pausedUntil - now) / 1000)) : 0;
}

export function isCompareJob(value: unknown): value is CompareJob {
  return (
    isRecord(value) &&
    (value.kind === 'analyze' || value.kind === 'apply') &&
    (value.source === null || isTrackerId(value.source)) &&
    JOB_STATUSES.some((s) => s === value.status) &&
    isCount(value.total) &&
    isCount(value.done) &&
    isCount(value.updated) &&
    isCount(value.skipped) &&
    isCount(value.failed) &&
    Array.isArray(value.pending) &&
    value.pending.every((p) => isRecord(p) && isId(p.mediaId) && isId(p.malId)) &&
    typeof value.cancelled === 'boolean' &&
    typeof value.startedAt === 'number' &&
    typeof value.updatedAt === 'number' &&
    (value.message === null || typeof value.message === 'string') &&
    Array.isArray(value.messages) &&
    value.messages.every((m) => typeof m === 'string') &&
    (value.pausedUntil === null || typeof value.pausedUntil === 'number') &&
    (value.pauseReason === null || PAUSE_REASONS.some((r) => r === value.pauseReason)) &&
    (value.pauseService === null || isTrackerId(value.pauseService))
  );
}
