import { useState } from 'preact/hooks';
import { t } from '../../i18n';
import { newestFirst, type SequelRecord } from '../../shared/sequels';
import type { SyncOutcome } from '../../shared/sync.types';
import { addSequelToPlanning, sequelAddResult, updateSequels } from '../sequel-actions';

// « + À regarder » et × des suites annoncées, partagés par Activité (popup) et Agenda (panneau) : ajout en cours, dernier
// résultat par suite, et lignes terminées gardées avec leur mention (ajoutée, déjà dans la liste, pas sur MyAnimeList)
// jusqu'à la fermeture de la page, quand le stockage ne les a plus.

export interface SequelActions {
  /** Suites du stockage, puis les terminées (avec leur mention) que le stockage n'a plus */
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
    // Résultat noté avant le retrait du stockage : la ligne ne disparaît jamais entre les deux
    setOutcomes((current) => new Map(current).set(id, { record, outcome }));
    if (result.kind === 'ended') await updateSequels([id], 'removed');
    withBusy(id, false);
  };

  const dismiss = (id: number): void => {
    setOutcomes((current) => {
      const next = new Map(current);
      next.delete(id);
      return next;
    });
    // Ligne terminée gardée pour sa mention : déjà retirée du stockage, rien à masquer
    if (records.some((record) => record.snapshot.id === id)) void updateSequels([id], 'dismissed');
  };

  const kept = [...outcomes.values()].filter(({ record, outcome }) => {
    return sequelAddResult(outcome, '').kind === 'ended' && !records.some((r) => r.snapshot.id === record.snapshot.id);
  });
  // Même ordre que le stockage (la plus récemment détectée d'abord) : une ligne terminée garde sa place
  const all = [...records, ...kept.map(({ record }) => record)].sort(newestFirst);
  return { all, busy, outcomes, add, dismiss };
}
