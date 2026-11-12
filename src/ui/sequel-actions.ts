import type { SequelRecord } from '../shared/sequels';
import type { SyncOutcome } from '../shared/sync.types';
import { callWorker, outcomeFailure } from './worker-call';

// Actions sur les suites annoncées, partagées par le popup (Activité) et le panneau (Agenda) : messages au service worker
// et lecture du résultat de « + À regarder ».

/**
 * Résultat de « + À regarder » : `ended` = l'alerte n'a plus d'objet ; `notOnMal` = AniList écrit, MyAnimeList sans suite ;
 * `inList` = aucun service n'a écrit, la suite était déjà dans une liste
 */
export type SequelAddResult = { kind: 'ended'; notOnMal: boolean; inList: boolean } | { kind: 'failed'; message: string };

/** Mention d'une alerte terminée, gardée sur la ligne jusqu'à la fermeture de la page */
export function sequelEndedKey(result: { notOnMal: boolean; inList: boolean }): 'sequel.notOnMal' | 'sequel.inList' | 'sequel.added' {
  return result.notOnMal ? 'sequel.notOnMal' : result.inList ? 'sequel.inList' : 'sequel.added';
}

/** Un service a écrit, ou la suite était déjà dans une liste : l'alerte se termine (règle de la spec : un succès suffit) */
export function sequelAddResult(outcome: SyncOutcome, fallback: string): SequelAddResult {
  if (outcome.status !== 'synced') return { kind: 'failed', message: outcome.status === 'error' ? outcome.message : fallback };
  const done = outcome.results.filter((result) => result.outcome.status === 'updated' || result.outcome.status === 'up-to-date' || (result.outcome.status === 'skipped' && result.outcome.code === 'already-in-list'));
  if (done.length > 0) {
    const mal = outcome.results.find((result) => result.service === 'mal');
    const written = done.some((result) => result.outcome.status === 'updated' || result.outcome.status === 'up-to-date');
    return { kind: 'ended', notOnMal: mal !== undefined && !done.includes(mal), inList: !written };
  }
  const failed = outcome.results.find((result) => result.outcome.status === 'error')?.outcome;
  return { kind: 'failed', message: failed?.status === 'error' ? failed.message : fallback };
}

/** « + À regarder » d'une fiche connue par ses seuls identifiants (relations du panneau) */
export function addToPlanning(target: { mediaId: number; malId: number | null }): Promise<SyncOutcome> {
  return callWorker('ADD_TO_LIST', { mediaId: target.mediaId, malId: target.malId, status: 'PLANNING' }, outcomeFailure);
}

export function addSequelToPlanning(record: SequelRecord): Promise<SyncOutcome> {
  return addToPlanning({ mediaId: record.snapshot.id, malId: record.snapshot.idMal });
}

/** Retire les suites affichées déjà dans une liste (le service worker freine). Ne lève jamais : injoignable, les lignes restent */
export function checkShownSequels(): Promise<null> {
  return callWorker('CHECK_SHOWN_SEQUELS', null, () => null);
}

/** Change l'état des suites ; service worker injoignable : false */
export function updateSequels(ids: number[], state: 'seen' | 'dismissed' | 'removed' | 'restore' | 'listed'): Promise<boolean> {
  return callWorker('UPDATE_SEQUELS', { ids, state }, () => false);
}

/** « + À regarder » réussi depuis une recommandation du panneau : le lot de Découvrir la retire. Ne lève jamais ; false si non enregistré */
export function markRecommendationAdded(id: number): Promise<boolean> {
  return callWorker('UPDATE_RECOMMENDATION', { id, action: 'added' }, () => false);
}
