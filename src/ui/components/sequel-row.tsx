// Ligne d'une suite annoncée (Activité du popup, Agenda du panneau) : jaquette 32 × 44, titre, « ● date · format »
// (point lavande, gris quand la date est inconnue), « + À regarder » et × (masquer). Aucun accès au service worker :
// les actions et le résultat viennent de l'écran qui l'affiche.
import { getLocale, t } from '../../i18n';
import type { SequelRecord } from '../../shared/sequels';
import { formatSequelDate } from '../../shared/sequel-date';
import type { SyncOutcome } from '../../shared/sync.types';
import { sequelAddResult } from '../sequel-actions';
import { Button } from './button';
import { Cover } from './cover';
import { IconButton } from './icon-button';

export interface SequelRowProps {
  record: SequelRecord;
  onAdd: () => void;
  onDismiss: () => void;
  /** Ajout en cours */
  busy: boolean;
  /** Dernier résultat de « + À regarder » (échec : message et « Réessayer » ; MAL absent : mention) */
  outcome: SyncOutcome | null;
  /** Pastille « Nouveau » à côté du titre (suite pas encore vue) */
  showNew?: boolean;
}

const FORMAT_KEYS = { TV_SHORT: 'review.format.tvShort', MOVIE: 'review.format.movie' } as const;

function formatLabel(format: SequelRecord['snapshot']['format']): string {
  return format === 'TV_SHORT' || format === 'MOVIE' ? t(FORMAT_KEYS[format]) : format;
}

export function SequelRow({ record, onAdd, onDismiss, busy, outcome, showNew = false }: SequelRowProps) {
  const { snapshot } = record;
  const result = outcome ? sequelAddResult(outcome, t('error.unexpectedAdd')) : null;
  const ended = result?.kind === 'ended';
  const dated = snapshot.status === 'RELEASING' || snapshot.year !== null || snapshot.seasonYear !== null;
  return (
    <li class="flex items-center gap-2.5 rounded-card border border-line bg-surface px-3 py-2" data-sequel={snapshot.id} aria-busy={busy ? 'true' : undefined}>
      <Cover size="agenda" title={snapshot.title} src={snapshot.coverUrl} />
      <span class="flex min-w-0 flex-1 flex-col">
        <span class="flex min-w-0 items-center gap-1.5">
          <span class="truncate font-bold" title={snapshot.title}>
            {snapshot.title}
          </span>
          {showNew && (
            <span class="inline-flex h-5 shrink-0 items-center rounded-pill border border-field px-2 text-section tracking-normal font-extrabold text-ink" data-sequel-new="">
              {t('sequel.new')}
            </span>
          )}
        </span>
        <span class="flex min-w-0 items-center gap-1.5 text-secondary text-muted">
          <span class={`size-1.5 shrink-0 rounded-pill ${dated ? 'bg-lavender' : 'bg-muted'}`} aria-hidden="true" data-sequel-dot="" />
          <span class="line-clamp-2 break-words">{`${formatSequelDate(snapshot, getLocale())} · ${formatLabel(snapshot.format)}`}</span>
        </span>
        {ended && result.notOnMal && <span class="text-secondary font-bold text-lavender">{t('sequel.notOnMal')}</span>}
        {result?.kind === 'failed' && <span class="line-clamp-2 text-secondary font-bold text-danger" title={result.message}>{result.message}</span>}
      </span>
      {!ended && (
        <Button size="sm" busy={busy} ariaLabel={t('sequel.addLabel', { title: snapshot.title })} focusKey={`sequel-add-${snapshot.id}`} onClick={onAdd}>
          {result?.kind === 'failed' ? t('common.retry') : t('sequel.add')}
        </Button>
      )}
      <IconButton icon="close" label={t('sequel.dismissLabel', { title: snapshot.title })} focusKey={`sequel-dismiss-${snapshot.id}`} onClick={onDismiss} />
    </li>
  );
}
