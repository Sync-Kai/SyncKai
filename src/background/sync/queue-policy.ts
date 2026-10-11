import { t } from '../../i18n';
import type { EpisodeInfo } from '../../shared/episode.types';
import { queueItemId, restrictToSession, type SyncQueueItem } from '../../shared/queue.types';
import type { SessionEpochs } from '../../shared/session-epochs';
import type { SyncErrorCode, SyncOutcome } from '../../shared/sync.types';
import { TRACKER_LABELS, type TrackerId } from '../../shared/tracker.types';

// Règles pures de la file de relance (sans chrome.*) : testables unitairement.

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

/** Délai avant la tentative suivante, indexé par le nombre de tentatives déjà faites (plafond 6 h) */
export const BACKOFF_MS: readonly number[] = [1 * MINUTE, 5 * MINUTE, 15 * MINUTE, HOUR, 6 * HOUR];
export const MAX_ATTEMPTS = 6;
export const MAX_AGE_MS = 24 * HOUR;
/** Chrome refuse les alarmes à moins de 30 s */
export const MIN_ALARM_DELAY_MS = 30_000;

const RETRYABLE_CODES: ReadonlySet<SyncErrorCode> = new Set<SyncErrorCode>(['NETWORK', 'RATE_LIMITED', 'API_ERROR']);

/**
 * Échec passager, à relancer : réseau, limite de requêtes, ou erreur HTTP du serveur (5xx). Une erreur HTTP 4xx
 * (404 fiche supprimée ou introuvable, requête refusée) ne réussira pas mieux plus tard : définitive, comme pour
 * les tâches de fond (transientKind). Statut inconnu : relancé (prudence).
 */
export function isRetryableError(code: SyncErrorCode | undefined, httpStatus?: number): boolean {
  if (code === undefined || !RETRYABLE_CODES.has(code)) return false;
  return code !== 'API_ERROR' || httpStatus === undefined || httpStatus >= 500;
}

/**
 * Classement d'un résultat de synchro :
 * - success : tous les services demandés sont à jour
 * - retry   : échec passager, à relancer pour `services`
 * - final   : erreur définitive (session expirée, erreur métier…)
 * - resolved: plus rien à relancer (vérification manuelle, service déconnecté, série exclue ou ignorée)
 */
export type OutcomeClass =
  | { kind: 'success' }
  | { kind: 'retry'; services: TrackerId[] | null; message: string }
  | { kind: 'final'; message: string }
  | { kind: 'resolved' };

export function classifyOutcome(outcome: SyncOutcome, requested: TrackerId[] | null): OutcomeClass {
  switch (outcome.status) {
    case 'error':
      return isRetryableError(outcome.code, outcome.httpStatus)
        ? { kind: 'retry', services: requested, message: outcome.message }
        : { kind: 'final', message: outcome.message };
    case 'synced': {
      const errors = outcome.results.flatMap((r) =>
        r.outcome.status === 'error' ? [{ service: r.service, message: r.outcome.message, code: r.outcome.code, httpStatus: r.outcome.httpStatus }] : [],
      );
      if (errors.length === 0) return { kind: 'success' };
      const message = errors.map((e) => t('common.serviceMessage', { service: TRACKER_LABELS[e.service], message: e.message })).join(' · ');
      const retryable = errors.filter((e) => isRetryableError(e.code, e.httpStatus));
      // Services en erreur définitive ignorés : seuls les échecs passagers sont relancés
      return retryable.length > 0
        ? { kind: 'retry', services: retryable.map((e) => e.service), message }
        : { kind: 'final', message };
    }
    case 'needs-review':
    case 'not-connected':
    case 'excluded':
    case 'ignored':
      return { kind: 'resolved' };
  }
}

/** Délai après la n-ième tentative (n ≥ 1) */
export function backoffDelay(attempts: number): number {
  const index = Math.min(Math.max(attempts, 1), BACKOFF_MS.length) - 1;
  return BACKOFF_MS[index] ?? BACKOFF_MS[BACKOFF_MS.length - 1] ?? HOUR;
}

export function shouldAbandon(attempts: number, firstFailedAt: number, now: number): boolean {
  return attempts >= MAX_ATTEMPTS || now - firstFailedAt >= MAX_AGE_MS;
}

/** Union de deux listes de services (null = tous) */
export function mergeServices(a: TrackerId[] | null, b: TrackerId[] | null): TrackerId[] | null {
  if (a === null || b === null) return null;
  return [...new Set([...a, ...b])];
}

/**
 * Premier échec passager (synchro normale) : crée l'entrée ou fusionne avec l'entrée pending existante
 * (services unis, premier échec et compteur conservés). Une entrée abandonnée repart de zéro. `epochs` : sessions
 * ouvertes au début de la synchro ; seule la part de l'entrée existante encore valable pour elles est reprise.
 */
export function upsertFailure(
  existing: SyncQueueItem | null,
  episode: EpisodeInfo,
  services: TrackerId[] | null,
  message: string,
  now: number,
  epochs: SessionEpochs,
): SyncQueueItem {
  const live = existing !== null && existing.status === 'pending' ? restrictToSession(existing, epochs, 'current') : null;
  if (live !== null) {
    return {
      ...live,
      episode,
      services: mergeServices(live.services, services),
      epochs,
      nextAttemptAt: now + backoffDelay(live.attempts),
      lastError: message,
    };
  }
  return {
    id: queueItemId(episode),
    episode,
    services,
    epochs,
    attempts: 1,
    status: 'pending',
    nextAttemptAt: now + backoffDelay(1),
    firstFailedAt: now,
    lastError: message,
  };
}

/** Retire les services réussis d'une entrée ; null si plus rien à relancer */
export function withoutServices(item: SyncQueueItem, done: TrackerId[] | null): SyncQueueItem | null {
  if (done === null) return null;
  if (item.services === null) return item; // « tous » ne peut pas être réduit à partir d'un sous-ensemble
  const remaining = item.services.filter((s) => !done.includes(s));
  return remaining.length === 0 ? null : { ...item, services: remaining };
}

export type RetryDecision = { action: 'remove' } | { action: 'save'; item: SyncQueueItem };

/**
 * Après une relance (alarme ou « Réessayer ») : retire l'entrée si réussie / plus pertinente,
 * replanifie si l'échec reste passager, abandonne sinon (ou après 6 tentatives / 24 h).
 * `manual` : relance utilisateur (« Réessayer »), jamais abandonnée sur un échec passager.
 */
export function decideAfterRetry(item: SyncQueueItem, outcome: SyncOutcome, now: number, manual = false): RetryDecision {
  const result = classifyOutcome(outcome, item.services);
  switch (result.kind) {
    case 'success':
    case 'resolved':
      return { action: 'remove' };
    case 'final':
      return { action: 'save', item: { ...item, attempts: item.attempts + 1, status: 'failed', lastError: result.message } };
    case 'retry': {
      const attempts = item.attempts + 1;
      const next: SyncQueueItem = { ...item, attempts, services: result.services, lastError: result.message };
      // Relance manuelle : toujours replanifiée (l'utilisateur a explicitement redonné une chance)
      if (!manual && shouldAbandon(attempts, item.firstFailedAt, now)) return { action: 'save', item: { ...next, status: 'failed' } };
      return { action: 'save', item: { ...next, status: 'pending', nextAttemptAt: now + backoffDelay(attempts) } };
    }
  }
}

/** Entrées pending dont l'heure est venue */
export function dueItems(items: readonly SyncQueueItem[], now: number): SyncQueueItem[] {
  return items.filter((i) => i.status === 'pending' && i.nextAttemptAt <= now);
}

/** Heure de l'alarme : prochaine tentative pending (≥ maintenant + 30 s), null si aucune */
export function nextAlarmTime(items: readonly SyncQueueItem[], now: number): number | null {
  const pending = items.filter((i) => i.status === 'pending').map((i) => i.nextAttemptAt);
  if (pending.length === 0) return null;
  return Math.max(Math.min(...pending), now + MIN_ALARM_DELAY_MS);
}
