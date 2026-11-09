import type { SequelRecord } from '../shared/sequels';
import type { SyncOutcome } from '../shared/sync.types';
import { callWorker, outcomeFailure } from './worker-call';

// Actions sur les suites annoncées, partagées par le popup (Activité) et le panneau (Agenda) : messages au service worker
// et lecture du résultat de « + À regarder ».

/** Résultat de « + À regarder » : `ended` = l'alerte n'a plus d'objet ; `notOnMal` = AniList écrit, MyAnimeList sans suite */
export type SequelAddResult = { kind: 'ended'; notOnMal: boolean } | { kind: 'failed'; message: string };

/** Un service a écrit, ou la suite était déjà dans une liste : l'alerte se termine (règle de la spec : un succès suffit) */
export function sequelAddResult(outcome: SyncOutcome, fallback: string): SequelAddResult {
  if (outcome.status !== 'synced') return { kind: 'failed', message: outcome.status === 'error' ? outcome.message : fallback };
  const done = outcome.results.filter((result) => result.outcome.status === 'updated' || result.outcome.status === 'up-to-date' || (result.outcome.status === 'skipped' && result.outcome.code === 'already-in-list'));
  if (done.length > 0) {
    const mal = outcome.results.find((result) => result.service === 'mal');
    return { kind: 'ended', notOnMal: mal !== undefined && !done.includes(mal) };
  }
  const failed = outcome.results.find((result) => result.outcome.status === 'error')?.outcome;
  return { kind: 'failed', message: failed?.status === 'error' ? failed.message : fallback };
}

export function addSequelToPlanning(record: SequelRecord): Promise<SyncOutcome> {
  return callWorker('ADD_TO_LIST', { mediaId: record.snapshot.id, malId: record.snapshot.idMal, status: 'PLANNING' }, outcomeFailure);
}

/** Change l'état des suites ; service worker injoignable : false */
export function updateSequels(ids: number[], state: 'seen' | 'dismissed' | 'removed' | 'restore'): Promise<boolean> {
  return callWorker('UPDATE_SEQUELS', { ids, state }, () => false);
}
