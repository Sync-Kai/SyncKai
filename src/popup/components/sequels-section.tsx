// Section « Suites annoncées » d'Activité (popup) : 3 lignes, puis « N autres suites annoncées » qui déplie le reste.
// Les suites viennent de ui/sequels-store.ts (via l'écran) ; chaque action passe par le service worker et la ligne
// disparaît quand le stockage change. Une ligne ajoutée à AniList mais pas à MyAnimeList reste, le temps de le dire.
import { useState } from 'preact/hooks';
import { t, tp } from '../../i18n';
import type { SequelRecord } from '../../shared/sequels';
import type { TrackerId } from '../../shared/tracker.types';
import { Section } from '../../ui/components/section';
import { SequelRow } from '../../ui/components/sequel-row';
import { useLocale } from '../../ui/preact/hooks';
import { useSequelActions } from '../../ui/preact/use-sequel-actions';

const COLLAPSED_ROWS = 3;

export interface SequelsSectionProps {
  /** Suites visibles (ui/sequels-store.ts) : lues par l'écran, qui rend la main au repli du focus à chaque changement */
  records: readonly SequelRecord[];
  /** Services connectés : MyAnimeList seul, une suite sans idMal n'a pas de bouton d'ajout */
  connected: readonly TrackerId[];
  /** Section affichée (écran Activité visible) : sinon, pas de revérification des suites contre les listes */
  visible?: boolean;
}

export function SequelsSection({ records, connected, visible = true }: SequelsSectionProps) {
  useLocale();
  const [expanded, setExpanded] = useState(false);
  const { all, busy, outcomes, add, dismiss } = useSequelActions(records, visible);
  if (all.length === 0) return null;
  const shown = expanded ? all : all.slice(0, COLLAPSED_ROWS);
  const hidden = all.length - shown.length;

  return (
    <Section title={t('sequel.heading')} tone="info">
      <ul class="m-0 flex list-none flex-col gap-2 p-0">
        {shown.map((record) => (
          <SequelRow key={record.snapshot.id} record={record} connected={connected} busy={busy.has(record.snapshot.id)} outcome={outcomes.get(record.snapshot.id)?.outcome ?? null} onAdd={() => void add(record)} onDismiss={() => dismiss(record.snapshot.id)} />
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
