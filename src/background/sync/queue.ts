import { t } from '../../i18n';
import { refreshReviewBadge } from '../../shared/badge';
import type { EpisodeInfo } from '../../shared/episode.types';
import { queueItemId, restrictToSession, type SyncQueueItem } from '../../shared/queue.types';
import type { SessionEpochs } from '../../shared/session-epochs';
import { getOpenSessions } from '../../shared/storage';
import { getSyncQueue, removeQueueItem, saveQueueItem } from '../../shared/sync-queue-store';
import type { SyncOutcome } from '../../shared/sync.types';
import type { TrackerId } from '../../shared/tracker.types';
import { classifyOutcome, decideAfterRetry, dueItems, nextAlarmTime, upsertFailure, withoutServices } from './queue-policy';
import { syncEpisode } from './sync-service';
import { createLogger } from '../../shared/logger';

// File de synchro hors ligne (service worker).

/** Nom de l'alarme chrome.alarms qui relance la file (n'existe que si la file contient un élément pending) */
export const QUEUE_ALARM = 'synckai:sync-queue';

const log = createLogger('queue');
const RUN_LOCK = 'synckai:sync-queue-run';
/** Pause entre deux relances : évite de solliciter les API en rafale */
const ITEM_DELAY_MS = 1_000;

/** Sérialise les opérations sur UNE entrée (alarme, « Réessayer », nouvelle synchro du même épisode) */
function withItemLock<T>(id: string, task: () => Promise<T>): Promise<T> {
  return navigator.locks.request(`synckai:sync-queue-item:${id}`, task);
}

async function findItem(id: string): Promise<SyncQueueItem | null> {
  return (await getSyncQueue()).find((i) => i.id === id) ?? null;
}

function markQueued(outcome: SyncOutcome): SyncOutcome {
  return outcome.status === 'synced' || outcome.status === 'error' ? { ...outcome, queued: true } : outcome;
}

/** Recalcule l'alarme : prochaine tentative pending, supprimée si aucune */
async function scheduleAlarm(): Promise<void> {
  const when = nextAlarmTime(await getSyncQueue(), Date.now());
  if (when === null) await chrome.alarms.clear(QUEUE_ALARM);
  else await chrome.alarms.create(QUEUE_ALARM, { when });
}

async function refreshBadgeSafely(): Promise<void> {
  try {
    await refreshReviewBadge();
  } catch (error: unknown) {
    log.warn('Badge non mis à jour :', error);
  }
}

/**
 * Après une synchro : met en file l'épisode si l'échec est passager (erreur globale réseau/limite/serveur,
 * ou services en erreur dans un résultat `synced`), et retourne le résultat avec `queued: true` le cas échéant.
 * Retire l'éventuelle entrée existante si la synchro a réussi pour tous les services demandés.
 * `epochs` : sessions ouvertes au début de la synchro (getOpenSessions), l'entrée n'est relancée que sur elles.
 */
export async function recordSyncOutcome(
  episode: EpisodeInfo,
  services: TrackerId[] | null,
  outcome: SyncOutcome,
  epochs: SessionEpochs,
): Promise<SyncOutcome> {
  try {
    const id = queueItemId(episode);
    const result = classifyOutcome(outcome, services);
    if (result.kind === 'final') return outcome;

    const queued = await withItemLock(id, async (): Promise<boolean> => {
      const existing = await findItem(id);
      if (result.kind === 'retry') {
        // Session fermée pendant la synchro : rien n'est mis en file
        return saveQueueItem(upsertFailure(existing, episode, result.services, result.message, Date.now(), epochs));
      }
      // Succès (ou plus rien à relancer) : retire les services concernés de l'entrée existante
      if (existing !== null) {
        const rest = result.kind === 'resolved' ? null : withoutServices(existing, services);
        if (rest === null) await removeQueueItem(id);
        else await saveQueueItem(rest);
      }
      return false;
    });

    await scheduleAlarm();
    await refreshBadgeSafely();
    return queued ? markQueued(outcome) : outcome;
  } catch (error: unknown) {
    log.error('Mise en file impossible :', error);
    return outcome;
  }
}

/** Relance une entrée et applique la décision ; null si l'entrée a disparu ou n'est plus due */
async function retryItem(id: string, manual: boolean): Promise<SyncOutcome | null> {
  return withItemLock(id, async (): Promise<SyncOutcome | null> => {
    const stored = await findItem(id);
    if (stored === null) return null;
    // Relue sous verrou : un « Réessayer » concurrent a pu la replanifier
    if (!manual && (stored.status !== 'pending' || stored.nextAttemptAt > Date.now())) return null;

    // Relancée seulement sur les sessions de son échec : un épisode de l'ancien compte n'est jamais écrit sur un
    // autre (déconnexion puis connexion d'un autre compte entre-temps). Élément antérieur à la 2.2.0 encore présent :
    // aucune déconnexion depuis (elle l'aurait purgé), session courante
    const item = restrictToSession(stored, await getOpenSessions(), 'current');
    if (item === null) {
      await removeQueueItem(id);
      log.info('Synchro d’une session fermée retirée sans écriture :', id);
      return { status: 'error', message: t('queue.sessionClosed') };
    }

    const outcome = await syncEpisode(item.episode, item.services, item.epochs);
    const decision = decideAfterRetry(item, outcome, Date.now(), manual);
    if (decision.action === 'remove') {
      await removeQueueItem(id);
      return outcome;
    }
    await saveQueueItem(decision.item);
    if (decision.item.status === 'failed') log.warn('Synchro abandonnée :', id, decision.item.lastError);
    return decision.item.status === 'pending' ? markQueued(outcome) : outcome;
  });
}

/** Handler de l'alarme : relance les éléments dus, replanifie l'alarme ou la supprime si la file est vide. */
export async function processSyncQueue(): Promise<void> {
  try {
    // ifAvailable : une exécution déjà en cours suffit (alarme et démarrage simultanés)
    await navigator.locks.request(RUN_LOCK, { ifAvailable: true }, async (lock): Promise<void> => {
      if (lock === null) return;
      const due = dueItems(await getSyncQueue(), Date.now());
      for (const [index, item] of due.entries()) {
        if (index > 0) await new Promise<void>((resolve) => setTimeout(resolve, ITEM_DELAY_MS));
        try {
          await retryItem(item.id, false);
        } catch (error: unknown) {
          log.error('Relance en échec :', item.id, error);
        }
      }
    });
  } catch (error: unknown) {
    log.error('Traitement de la file impossible :', error);
  }
  try {
    await scheduleAlarm();
  } catch (error: unknown) {
    log.error('Alarme non replanifiée :', error);
  }
  await refreshBadgeSafely();
}

/** « Réessayer » depuis le popup (élément pending ou failed) : relance immédiate et retour du résultat. */
export async function retryQueued(id: string): Promise<SyncOutcome> {
  let outcome: SyncOutcome;
  try {
    outcome = (await retryItem(id, true)) ?? { status: 'error', message: t('queue.gone') };
  } catch (error: unknown) {
    log.error('Réessai impossible :', id, error);
    outcome = { status: 'error', message: t('queue.retryFailed') };
  }
  try {
    await scheduleAlarm();
  } catch (error: unknown) {
    log.error('Alarme non replanifiée :', error);
  }
  await refreshBadgeSafely();
  return outcome;
}

/** Au démarrage du navigateur / à l'installation : recrée l'alarme si la file contient des éléments pending. */
export async function ensureQueueAlarm(): Promise<void> {
  try {
    await scheduleAlarm();
  } catch (error: unknown) {
    log.error('Alarme non recréée :', error);
  }
  await refreshBadgeSafely();
}
