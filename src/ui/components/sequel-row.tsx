// Ligne d'une suite annoncée (Activité du popup, Agenda du panneau) : jaquette 32 × 44, titre, « ● date · format »
// (point lavande, gris quand la date est inconnue), « + À regarder » et × (masquer). Jaquette et titre ouvrent la fiche de
// la suite. Série d'une liste (`listStatus`, « Annoncées ») : « Dans ta liste · statut » à la place des boutons. Aucun accès au
// service worker : les actions et le résultat viennent de l'écran qui l'affiche.
import { getLocale, t, type MessageKey } from '../../i18n';
import type { ListedStatus, SequelDisplay } from '../../shared/sequels';
import { formatSequelDate } from '../../shared/sequel-date';
import type { SyncOutcome } from '../../shared/sync.types';
import { TRACKER_LABELS, type TrackerId } from '../../shared/tracker.types';
import { noMalEntry } from '../../shared/sequels';
import { sequelAddResult, sequelEndedKey } from '../sequel-actions';
import { Button } from './button';
import { Cover } from './cover';
import { IconButton } from './icon-button';

export interface SequelRowProps {
  record: { snapshot: SequelDisplay };
  onAdd: () => void;
  onDismiss: () => void;
  /** Ajout en cours */
  busy: boolean;
  /** Dernier résultat de « + À regarder » (échec : message et « Réessayer » ; MAL absent : mention) */
  outcome: SyncOutcome | null;
  /** Pastille « Nouveau » à côté du titre (suite pas encore vue) */
  showNew?: boolean;
  /** Services connectés : MyAnimeList seul et suite sans idMal = rien à ajouter (mention, sans bouton) */
  connected?: readonly TrackerId[];
  /** Série d'une liste de l'utilisateur : mention de son statut, ni bouton ni × */
  listStatus?: ListedStatus;
}

const FORMAT_KEYS = { TV_SHORT: 'review.format.tvShort', MOVIE: 'review.format.movie' } as const;

function formatLabel(format: SequelDisplay['format']): string {
  return format === 'TV_SHORT' || format === 'MOVIE' ? t(FORMAT_KEYS[format]) : format;
}

export function SequelRow({ record, onAdd, onDismiss, busy, outcome, showNew = false, connected = ['anilist'], listStatus }: SequelRowProps) {
  const { snapshot } = record;
  const result = outcome ? sequelAddResult(outcome, t('error.unexpectedAdd')) : null;
  const unaddable = noMalEntry(connected, snapshot.idMal);
  const ended = result?.kind === 'ended';
  const entryAria = t('panel.nowPlaying.newTab', { label: t('entry.openAria', { title: snapshot.title, service: TRACKER_LABELS.anilist }) });
  const dated = snapshot.status === 'RELEASING' || snapshot.year !== null || snapshot.seasonYear !== null;
  return (
    <li class="flex items-center gap-2.5 rounded-card border border-line bg-surface px-3 py-2" data-sequel={snapshot.id} aria-busy={busy ? 'true' : undefined}>
      <a href={snapshot.siteUrl} target="_blank" rel="noopener noreferrer" tabIndex={-1} aria-hidden="true" class="shrink-0 no-underline">
        <Cover size="agenda" title={snapshot.title} src={snapshot.coverUrl} />
      </a>
      <span class="flex min-w-0 flex-1 flex-col">
        <span class="flex min-w-0 items-center gap-1.5">
          <a class="min-w-0 truncate font-bold text-ink no-underline hover:underline" href={snapshot.siteUrl} target="_blank" rel="noopener noreferrer" title={snapshot.title} aria-label={entryAria} data-focus={`sequel-entry-${snapshot.id}`}>
            {snapshot.title}
          </a>
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
        {listStatus !== undefined && <span class="text-secondary font-bold text-lavender">{t('sequel.listedAs', { status: t(`page.status.${listStatus}` satisfies MessageKey) })}</span>}
        {listStatus === undefined && ended && <span class="text-secondary font-bold text-lavender">{t(sequelEndedKey(result))}</span>}
        {listStatus === undefined && !ended && unaddable && <span class="text-secondary font-bold text-lavender">{t('sequel.notOnMal')}</span>}
        {result?.kind === 'failed' && <span class="line-clamp-2 text-secondary font-bold text-danger" title={result.message}>{result.message}</span>}
      </span>
      {listStatus === undefined && !ended && !unaddable && (
        <Button size="sm" busy={busy} ariaLabel={t('sequel.addLabel', { title: snapshot.title })} focusKey={`sequel-add-${snapshot.id}`} onClick={onAdd}>
          {result?.kind === 'failed' ? t('common.retry') : t('sequel.add')}
        </Button>
      )}
      {listStatus === undefined && <IconButton icon="close" label={t('sequel.dismissLabel', { title: snapshot.title })} focusKey={`sequel-dismiss-${snapshot.id}`} onClick={onDismiss} />}
    </li>
  );
}
