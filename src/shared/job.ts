import { isRecord } from './guards';
import { isTrackerId, type TrackerId } from './tracker.types';

// Tâche de fond reprenable, persistée dans chrome.storage.local : une file d'éléments traités un par un
// par le service worker (voir src/background/jobs/runner.ts). La page qui l'a lancée affiche sa progression
// (même rouverte) et le service worker la reprend s'il a été arrêté. Utilisée par la comparaison des listes
// (compare-job.ts) et l'import de l'historique Crunchyroll (cr-import.ts).

/** Tâche « en cours » sans signe de vie depuis ce délai : considérée comme interrompue (reprise ou abandon) */
export const JOB_STALE_MS = 60_000;
/** Messages distincts conservés pour le bilan (éléments ignorés ou en échec) */
const MAX_JOB_MESSAGES = 5;

/**
 * Attente en cours : limite de requêtes (429), quota des tâches de fond (budget AniList partagé, requêtes interactives
 * prioritaires), service surchargé (5xx, délai dépassé), réseau, ou reprise après une interruption du service worker
 */
export type PauseReason = 'rate-limit' | 'budget' | 'server' | 'network' | 'resume';
export type JobStatus = 'running' | 'done' | 'cancelled' | 'stopped';

export interface Job<Kind extends string, Item> {
  kind: Kind;
  status: JobStatus;
  total: number;
  done: number;
  updated: number;
  skipped: number;
  failed: number;
  /** Éléments restant à traiter (le premier est en cours) */
  pending: Item[];
  /** « Arrêter » demandé : vérifié entre deux éléments */
  cancelled: boolean;
  startedAt: number;
  /** Dernier signe de vie (après chaque élément) : sert à détecter une tâche interrompue */
  updatedAt: number;
  /** Raison d'un arrêt (session expirée, réseau, limite de requêtes) */
  message: string | null;
  /** Raisons distinctes des éléments ignorés ou en échec (infobulle du bilan) */
  messages: string[];
  /** Fin de l'attente en cours (ms), null hors pause : la page affiche un compte à rebours */
  pausedUntil: number | null;
  pauseReason: PauseReason | null;
  /** Service qui a imposé l'attente (null : reprise) */
  pauseService: TrackerId | null;
}

/** Tâche quelconque (fonctions génériques : transitions, état vivant / interrompu) */
export type AnyJob = Job<string, unknown>;

export type JobOutcome = 'updated' | 'skipped' | 'failed';

export type JobEvent =
  | { type: 'item'; outcome: JobOutcome; message?: string; at: number }
  | { type: 'cancel'; at: number }
  /** Erreur bloquante : les éléments restants ne sont pas traités */
  | { type: 'stop'; message: string; at: number }
  /** Fin de boucle : plus rien à traiter, ou arrêt demandé */
  | { type: 'finish'; at: number }
  | { type: 'touch'; at: number }
  /** Attente avant de retenter l'élément en cours (il reste en tête de file) */
  | { type: 'pause'; until: number; reason: PauseReason; service: TrackerId | null; at: number }
  /** L'élément suivant démarre : fin de la pause éventuelle */
  | { type: 'item-start'; at: number }
  /** Attente du budget de requêtes terminée (la requête part) : fin de la pause « quota » ou « limite » */
  | { type: 'wait-end'; at: number };

export function startJob<Kind extends string, Item>(kind: Kind, pending: readonly Item[], now: number): Job<Kind, Item> {
  return {
    kind,
    status: 'running',
    total: pending.length,
    done: 0,
    updated: 0,
    skipped: 0,
    failed: 0,
    pending: [...pending],
    cancelled: false,
    startedAt: now,
    updatedAt: now,
    message: null,
    messages: [],
    pausedUntil: null,
    pauseReason: null,
    pauseService: null,
  };
}

const NO_PAUSE = { pausedUntil: null, pauseReason: null, pauseService: null } as const;

/** Transitions de la tâche (pur, testé). Une tâche terminée n'évolue plus. Les champs propres à un type de tâche sont conservés. */
export function reduceJob<J extends AnyJob>(job: J, event: JobEvent): J {
  if (job.status !== 'running') return job;
  switch (event.type) {
    case 'item': {
      const messages = event.message && !job.messages.includes(event.message) && job.messages.length < MAX_JOB_MESSAGES ? [...job.messages, event.message] : job.messages;
      const next: J = {
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
      // « Reprise après interruption » reste affiché jusqu'à la fin de l'élément repris
      return job.pausedUntil === null || job.pauseReason === 'resume' ? { ...job, updatedAt: event.at } : { ...job, updatedAt: event.at, ...NO_PAUSE };
    case 'wait-end':
      return job.pauseReason === 'budget' || job.pauseReason === 'rate-limit' ? { ...job, updatedAt: event.at, ...NO_PAUSE } : { ...job, updatedAt: event.at };
    case 'touch':
      return { ...job, updatedAt: event.at };
  }
}

/** Tâche en cours et vivante : bloque une nouvelle tâche du même type */
export function isJobActive<J extends AnyJob>(job: J | null, now: number): job is J {
  return job !== null && job.status === 'running' && now - job.updatedAt < JOB_STALE_MS;
}

/** Tâche « en cours » sans signe de vie : service worker arrêté pendant le traitement */
export function isJobStale<J extends AnyJob>(job: J | null, now: number): job is J {
  return job !== null && job.status === 'running' && now - job.updatedAt >= JOB_STALE_MS;
}

/** Secondes restantes avant la fin de la pause (0 si aucune pause ou pause échue) */
export function pauseSecondsLeft(job: AnyJob | null, now: number): number {
  return job?.pausedUntil ? Math.max(0, Math.ceil((job.pausedUntil - now) / 1000)) : 0;
}

const isCount = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 0;
const JOB_STATUSES: readonly JobStatus[] = ['running', 'done', 'cancelled', 'stopped'];
const PAUSE_REASONS: readonly PauseReason[] = ['rate-limit', 'budget', 'server', 'network', 'resume'];

/**
 * Champs communs d'une tâche relue du stockage (format de l'extension, validé quand même : version précédente possible).
 * `isKind` et `isItem` valident le type de tâche et chaque élément de la file.
 */
export function isJobOf<Kind extends string, Item>(
  value: unknown,
  isKind: (kind: unknown) => kind is Kind,
  isItem: (item: unknown) => item is Item,
): value is Job<Kind, Item> {
  return (
    isRecord(value) &&
    isKind(value.kind) &&
    JOB_STATUSES.some((s) => s === value.status) &&
    isCount(value.total) &&
    isCount(value.done) &&
    isCount(value.updated) &&
    isCount(value.skipped) &&
    isCount(value.failed) &&
    Array.isArray(value.pending) &&
    value.pending.every(isItem) &&
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
