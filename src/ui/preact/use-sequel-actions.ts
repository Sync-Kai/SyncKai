import { useState } from 'preact/hooks';
import { t } from '../../i18n';
import type { SequelRecord } from '../../shared/sequels';
import type { SyncOutcome } from '../../shared/sync.types';
import { addSequelToPlanning, sequelAddResult, updateSequels } from '../sequel-actions';

// « + À regarder » et × des suites annoncées, partagés par Activité (popup) et Agenda (panneau) : ajout en cours, dernier
// résultat par suite, et lignes gardées pour leur mention quand le stockage ne les a plus.

export interface SequelActions {
  /** Suites du stockage, puis les terminées avec mention « pas sur MyAnimeList » que le stockage n'a plus */
  all: SequelRecord[];
  busy: ReadonlySet<number>;
  outcomes: ReadonlyMap<number, { record: SequelRecord; outcome: SyncOutcome }>;
  add: (record: SequelRecord) => Promise<void>;
  dismiss: (id: number) => void;
}

export function useSequelActions(records: readonly SequelRecord[]): SequelActions {
  const [busy, setBusy] = useState<ReadonlySet<number>>(new Set());
  /** Dernier résultat par suite ; les suites terminées (retirées du stockage) gardent leur ligne avec leur mention */
  const [outcomes, setOutcomes] = useState<ReadonlyMap<number, { record: SequelRecord; outcome: SyncOutcome }>>(new Map());

  const withBusy = (id: number, on: boolean): void =>
    setBusy((current) => {
      const next = new Set(current);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });

  const add = async (record: SequelRecord): Promise<void> => {
    const id = record.snapshot.id;
    if (busy.has(id)) return;
    withBusy(id, true);
    const outcome = await addSequelToPlanning(record);
    const result = sequelAddResult(outcome, t('error.unexpectedAdd'));
    if (result.kind === 'ended') await updateSequels([id], 'removed');
    setOutcomes((current) => new Map(current).set(id, { record, outcome }));
    withBusy(id, false);
  };

  const dismiss = (id: number): void => {
    setOutcomes((current) => {
      const next = new Map(current);
      next.delete(id);
      return next;
    });
    // Ligne gardée pour sa mention : déjà retirée du stockage, rien à masquer
    if (records.some((record) => record.snapshot.id === id)) void updateSequels([id], 'dismissed');
  };

  const kept = [...outcomes.values()].filter(({ record, outcome }) => {
    const result = sequelAddResult(outcome, '');
    return result.kind === 'ended' && result.notOnMal && !records.some((r) => r.snapshot.id === record.snapshot.id);
  });
  return { all: [...records, ...kept.map(({ record }) => record)], busy, outcomes, add, dismiss };
}
