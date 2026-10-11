import { reduceJob, isJobStale, JOB_STALE_MS, type AnyJob, type JobEvent } from '../../shared/job';
import type { Logger } from '../../shared/logger';
import { withStorageLock } from '../../shared/storage-lock';
import type { TrackerId } from '../../shared/tracker.types';
import { ApiError, type ApiErrorCode } from '../api/errors';
import { aniListBudget, sleep, type BudgetWait } from '../api/rate-limit';

// Exécution des tâches de fond reprenables (src/shared/job.ts) : file traitée élément par élément,
// signe de vie, pauses avec nouvelle tentative sur erreur passagère, « Arrêter », reprise par alarme
// après l'arrêt du service worker. Partagé par l'alignement des listes et l'import Crunchyroll.

// ─── Stockage de la tâche ─────────────────────────────────────────────────

export interface JobStore<J> {
  read(): Promise<J | null>;
  /**
   * Lecture-modification-écriture sous verrou : la page (« Arrêter ») et la boucle écrivent toutes deux
   * la tâche. `update` renvoie null pour la supprimer.
   */
  update(update: (job: J | null) => J | null): Promise<J | null>;
}

export function createJobStore<J>(key: string, isJob: (value: unknown) => value is J): JobStore<J> {
  const read = async (): Promise<J | null> => {
    const stored = await chrome.storage.local.get(key);
    const value: unknown = stored[key];
    return isJob(value) ? value : null;
  };
  return {
    read,
    update: (update) =>
      withStorageLock(async () => {
        const next = update(await read());
        if (next === null) await chrome.storage.local.remove(key);
        else await chrome.storage.local.set({ [key]: next });
        return next;
      }),
  };
}

/** Période de l'alarme de reprise d'une tâche (30 s) */
export const RESUME_ALARM_PERIOD_MIN = 0.5;

/**
 * Recrée l'alarme de reprise d'une tâche en cours si elle a disparu : Chrome ne garantit pas les alarmes après une
 * mise à jour de l'extension (ARCH-14). Une alarme existante est gardée (son échéance n'est pas repoussée).
 */
export async function ensureResumeAlarm(name: string): Promise<void> {
  if (!(await chrome.alarms.get(name))) await chrome.alarms.create(name, { periodInMinutes: RESUME_ALARM_PERIOD_MIN });
}

// ─── Espacement des écritures et erreurs passagères ───────────────────────

/** Espacement minimal entre deux écritures MyAnimeList (pas de limite publiée : ~60 écritures/min) */
export const MAL_WRITE_GAP_MS = 1_000;
/** Espacement minimal entre deux écritures AniList (limite ~90 requêtes/min) */
export const ANILIST_WRITE_GAP_MS = 750;
const WRITE_GAP_MS: Record<TrackerId, number> = { anilist: ANILIST_WRITE_GAP_MS, mal: MAL_WRITE_GAP_MS };
/** Dernière écriture par service, commune à toutes les tâches (mêmes limites d'API) */
const lastWriteAt: Record<TrackerId, number> = { anilist: 0, mal: 0 };

/**
 * Attend que l'écriture suivante sur `target` respecte l'espacement minimal, puis la réserve. AniList : la place
 * est aussi prise sur le budget des tâches de fond (requêtes interactives prioritaires, voir rate-limit.ts).
 */
export async function waitWriteSlot(target: TrackerId): Promise<void> {
  await sleep(Math.max(0, lastWriteAt[target] + WRITE_GAP_MS[target] - Date.now()));
  if (target === 'anilist') await aniListBudget.acquire('background');
  lastWriteAt[target] = Date.now();
}

/** Lecture AniList d'une tâche de fond (état de l'entrée avant écriture) : place prise sur le budget de fond */
export async function waitReadSlot(target: TrackerId): Promise<void> {
  if (target === 'anilist') await aniListBudget.acquire('background');
}

/** Attente du budget AniList → évènement de la tâche (pur, testé) : pause « quota » / « limite », ou fin de l'attente */
export function budgetWaitEvent(wait: BudgetWait | null, now: number): JobEvent {
  if (wait === null) return { type: 'wait-end', at: now };
  // Reprise inconnue : pause échue d'emblée, la page affiche « En attente du quota AniList… » sans compte à rebours
  return { type: 'pause', until: wait.until ?? now, reason: wait.reason, service: 'anilist', at: now };
}

/**
 * Inscrit dans la tâche stockée les attentes du budget AniList (pause visible, levée dès que la requête part).
 * Renvoie l'arrêt du suivi, qui attend les dernières écritures. Chaque attente est aussi un signe de vie.
 */
export function trackBudgetWaits<J extends AnyJob>(store: JobStore<J>, onWait: () => void = () => undefined): () => Promise<void> {
  // Écritures enchaînées : l'ordre début → fin de l'attente est conservé
  let writes: Promise<unknown> = Promise.resolve();
  const unsubscribe = aniListBudget.onBackgroundWait((wait) => {
    onWait();
    writes = writes.then(() => store.update((job) => job && reduceJob(job, budgetWaitEvent(wait, Date.now())))).catch(() => undefined);
  });
  return async () => {
    unsubscribe();
    await writes;
  };
}

/** Signe de vie pendant une requête ou une pause : la tâche ne passe jamais pour interrompue */
const HEARTBEAT_MS = 10_000;

/**
 * Attentes avant de retenter le MÊME élément, par type d'erreur passagère (la longueur fixe le nombre d'essais) :
 * - rate-limit : 429 persistant (le client a déjà attendu Retry-After une fois) ;
 * - server : 502 / 503 / 504 ou délai dépassé (MAL surchargé répond 504 après une longue attente) ;
 * - network : connexion perdue.
 */
export const RETRY_DELAYS_MS: Record<'rate-limit' | 'server' | 'network', readonly number[]> = {
  'rate-limit': [60_000, 120_000, 240_000],
  server: [5_000, 15_000],
  network: [30_000, 60_000],
};

export type TransientKind = 'rate-limit' | 'server' | 'network';

/** Erreur passagère qui mérite une nouvelle tentative du même élément (pur, testé) */
export function transientKind(error: unknown): TransientKind | null {
  if (!(error instanceof ApiError)) return null;
  if (error.code === 'RATE_LIMITED') return 'rate-limit';
  if (error.timedOut || (error.httpStatus !== null && [500, 502, 503, 504].includes(error.httpStatus))) return 'server';
  if (error.code === 'NETWORK') return 'network';
  return null;
}

/** Erreurs qui feraient échouer tous les éléments suivants : la tâche s'arrête */
const FATAL_CODES: ReadonlySet<ApiErrorCode> = new Set(['NOT_AUTHENTICATED', 'TOKEN_INVALID', 'RATE_LIMITED', 'NETWORK']);

/** Erreur définitive (après les nouvelles tentatives) qui doit arrêter la tâche ; un service surchargé n'arrête rien */
export function isFatalError(error: unknown): boolean {
  return error instanceof ApiError && transientKind(error) !== 'server' && FATAL_CODES.has(error.code);
}

// ─── Boucle de traitement ─────────────────────────────────────────────────

export type StepResult =
  | { kind: 'event'; event: JobEvent; stop: string | null }
  /** Erreur passagère : attendre puis retenter le même élément */
  | { kind: 'retry'; reason: TransientKind; service: TrackerId | null; error: string };

type ItemOf<J extends AnyJob> = J['pending'][number];

export interface JobLoopConfig<J extends AnyJob> {
  /** Nom de la tâche dans les logs (« alignement », « analyse de l'historique »…) */
  label: string;
  log: Logger;
  store: JobStore<J>;
  /** Alarme de reprise, retirée quand plus rien ne tourne */
  alarm: string;
  /** Tâche traitée par cette boucle (type de tâche) */
  accepts: (job: J) => boolean;
  /** Identifiant d'un élément (compteur de nouvelles tentatives remis à zéro à chaque nouvel élément) */
  itemKey: (item: ItemOf<J>) => string;
  /** Traite UN élément. Ne lève jamais. `isLastAttempt` : plus de nouvelle tentative possible pour ce type d'erreur */
  process: (job: J, item: ItemOf<J>, isLastAttempt: (reason: TransientKind) => boolean) => Promise<StepResult>;
  /** Fin de la tâche (bilan dans les logs) */
  onEnd?: (job: J) => void | Promise<void>;
}

export interface JobLoop {
  /** Démarre la boucle si aucune boucle vivante ne tourne dans ce service worker */
  ensure(): void;
}

export function createJobLoop<J extends AnyJob>(config: JobLoopConfig<J>): JobLoop {
  const { store, log, label } = config;
  /** Génération de la boucle : une boucle plus récente (reprise après blocage) fait sortir l'ancienne */
  let generation = 0;
  let running = false;
  let beat = 0;

  const touch = (): Promise<J | null> => store.update((job) => job && reduceJob(job, { type: 'touch', at: Date.now() }));

  /**
   * Exécute `task` en entretenant le signe de vie (mémoire + tâche stockée) toutes les 10 s. Une attente du budget
   * AniList (quota de fond, pénalité 429) devient une pause visible, levée dès que la requête part.
   */
  async function withHeartbeat<T>(task: () => Promise<T>): Promise<T> {
    const timer = setInterval(() => {
      beat = Date.now();
      void touch();
    }, HEARTBEAT_MS);
    const stopTracking = trackBudgetWaits(store, () => (beat = Date.now()));
    try {
      return await task();
    } finally {
      clearInterval(timer);
      await stopTracking();
    }
  }

  /** Attend la fin de la pause par tranches (signe de vie entretenu) ; s'interrompt sur « Arrêter » */
  async function waitPause(until: number, gen: number): Promise<void> {
    while (Date.now() < until && gen === generation) {
      beat = Date.now();
      await sleep(Math.min(5_000, until - Date.now()));
      const job = await touch();
      if (!job || job.status !== 'running' || job.cancelled) return;
    }
  }

  /**
   * Traite les éléments de la tâche un par un, jusqu'à la fin, un « Arrêter » ou une erreur bloquante.
   * Erreur passagère : pause visible (compte à rebours) puis nouvelle tentative du même élément.
   * Chaque appel au stockage prolonge la vie du service worker ; s'il est quand même arrêté,
   * l'alarme de reprise relance la boucle sur les éléments restants (stockés dans la tâche).
   */
  async function run(gen: number): Promise<void> {
    // Tâche sans signe de vie depuis 60 s : service worker arrêté puis relancé → « Reprise… » affiché
    const initial = await store.read();
    if (isJobStale(initial, Date.now())) {
      log.info(`Reprise : ${label}`);
      await store.update((j) => j && reduceJob(j, { type: 'pause', until: Date.now(), reason: 'resume', service: null, at: Date.now() }));
    }

    /** Essais déjà faits pour l'élément en tête de file, par type d'erreur passagère */
    let attempts: Record<TransientKind, number> = { 'rate-limit': 0, server: 0, network: 0 };
    let currentKey: string | null = null;

    while (gen === generation) {
      beat = Date.now();
      const job = await store.read();
      if (!job || job.status !== 'running' || !config.accepts(job)) break;
      const item: ItemOf<J> | undefined = job.pending[0];
      if (job.cancelled || item === undefined) {
        await store.update((j) => j && reduceJob(j, { type: 'finish', at: Date.now() }));
        break;
      }
      const key = config.itemKey(item);
      if (key !== currentKey) {
        currentKey = key;
        attempts = { 'rate-limit': 0, server: 0, network: 0 };
      }

      await store.update((j) => j && reduceJob(j, { type: 'item-start', at: Date.now() }));
      const step = await withHeartbeat(() => config.process(job, item, (reason) => attempts[reason] >= RETRY_DELAYS_MS[reason].length));
      if (gen !== generation) break;

      if (step.kind === 'retry') {
        const delay = RETRY_DELAYS_MS[step.reason][attempts[step.reason]] ?? 0;
        attempts[step.reason]++;
        const until = Date.now() + delay;
        await store.update((j) => j && reduceJob(j, { type: 'pause', until, reason: step.reason, service: step.service, at: Date.now() }));
        await waitPause(until, gen);
        continue;
      }

      await store.update((j) => {
        if (!j || j.status !== 'running') return j;
        const next = step.event.type === 'item' ? reduceJob(j, step.event) : j;
        return step.stop === null ? next : reduceJob(next, { type: 'stop', message: step.stop, at: Date.now() });
      });
    }
    const job = await store.read();
    if (!job || job.status !== 'running') {
      await chrome.alarms.clear(config.alarm);
      if (job) await config.onEnd?.(job);
    }
  }

  return {
    ensure(): void {
      const now = Date.now();
      // Le signe de vie est entretenu pendant les requêtes et les pauses : une boucle muette depuis 60 s est
      // réellement bloquée ; elle est remplacée, le drapeau ne peut pas bloquer indéfiniment
      if (running && now - beat < JOB_STALE_MS) return;
      if (running) log.warn(`Boucle sans signe de vie (${label}) : relance`);
      const gen = ++generation;
      running = true;
      beat = now;
      void run(gen)
        .catch((error: unknown) => log.error(`Boucle interrompue (${label}) :`, error))
        .finally(() => {
          if (gen === generation) running = false;
        });
    },
  };
}
