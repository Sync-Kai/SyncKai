// Section « Suites annoncées » d'Activité (popup) : 3 lignes, puis « N autres suites annoncées » qui déplie le reste.
// Les suites viennent de ui/sequels-store.ts (via l'écran) ; chaque action passe par le service worker et la ligne
// disparaît quand le stockage change. Une ligne ajoutée à AniList mais pas à MyAnimeList reste, le temps de le dire.
import { useState } from 'preact/hooks';
import { t, tp } from '../../i18n';
import type { SequelRecord } from '../../shared/sequels';
import type { SyncOutcome } from '../../shared/sync.types';
import { Section } from '../../ui/components/section';
import { SequelRow } from '../../ui/components/sequel-row';
import { useLocale } from '../../ui/preact/hooks';
import { addSequelToPlanning, sequelAddResult, updateSequels } from '../../ui/sequel-actions';

const COLLAPSED_ROWS = 3;

export interface SequelsSectionProps {
  /** Suites visibles (ui/sequels-store.ts) : lues par l'écran, qui rend la main au repli du focus à chaque changement */
  records: readonly SequelRecord[];
}

export function SequelsSection({ records }: SequelsSectionProps) {
  useLocale();
  const [expanded, setExpanded] = useState(false);
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

  // Suites du stockage, puis les terminées avec mention « pas sur MyAnimeList » que le stockage n'a plus
  const kept = [...outcomes.values()].filter(({ record, outcome }) => {
    const result = sequelAddResult(outcome, '');
    return result.kind === 'ended' && result.notOnMal && !records.some((r) => r.snapshot.id === record.snapshot.id);
  });
  const all = [...records, ...kept.map(({ record }) => record)];
  if (all.length === 0) return null;
  const shown = expanded ? all : all.slice(0, COLLAPSED_ROWS);
  const hidden = all.length - shown.length;

  return (
    <Section title={t('sequel.heading')} tone="info">
      <ul class="m-0 flex list-none flex-col gap-2 p-0">
        {shown.map((record) => (
          <SequelRow key={record.snapshot.id} record={record} busy={busy.has(record.snapshot.id)} outcome={outcomes.get(record.snapshot.id)?.outcome ?? null} onAdd={() => void add(record)} onDismiss={() => dismiss(record.snapshot.id)} />
        ))}
      </ul>
      {hidden > 0 && (
        <button type="button" class="cursor-pointer self-start rounded-pill border-0 bg-transparent px-1 py-1 text-secondary font-extrabold text-muted hover:text-ink" data-sequels-more="" data-focus="sequels-more" onClick={() => setExpanded(true)}>
          {tp('sequel.more', hidden)}
        </button>
      )}
    </Section>
  );
}
