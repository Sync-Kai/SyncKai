// Ligne de série (maquettes PopupSeries, PopupSeriesRetours) : hauteur fixe de 80 px, jaquette 42 × 57 et sa barre de
// progression, titre (« … » + infobulle), statut en point + texte, « Ép. x / y » et − / + fantômes, puis « Ouvrir »
// (logo du lecteur dans un rond neutre) et les actions de l'hôte (« ⋯ »). Tous les textes arrivent traduits.
// Popup « Mes séries » aujourd'hui ; le panneau latéral réutilisera la ligne ou ses parties (SeriesTitle, SeriesStatus).
import type { ComponentChildren } from 'preact';
import type { StreamingPlatform } from '../../platforms/ids';
import { Cover } from './cover';
import { Icon } from './icon';
import { LogoButton } from './logo-button';
import { StatusText } from './status-text';
import { Stepper } from './stepper';
import type { Tone } from './tone';

/** Lien de la fiche AniList / MyAnimeList (titre et jaquette) */
export interface SeriesEntryLink {
  href: string;
  /** Nom accessible (« Ouvrir la fiche de Dandadan sur AniList ») */
  label: string;
}

/** Ligne 2 : sortie (« Ép. 5 disponible ») ou retour d'une action (« Ép. 5 vu ») */
export interface SeriesStatus {
  tone: Tone;
  text: string;
  /** Infobulle (détail par service) ; défaut : le texte */
  title?: string;
  /** Retour d'action : annoncé (role="status") */
  live?: boolean;
}

/** Pastille après le statut (« Exclue ») */
export interface SeriesTag {
  text: string;
  title: string;
  icon?: 'ban';
}

export interface SeriesOpenLink {
  platform: StreamingPlatform;
  href: string;
  /** « Ouvrir Dandadan sur Crunchyroll » */
  label: string;
  /** « Ouvrir sur Crunchyroll » */
  title: string;
}

export interface SeriesRowProps {
  title: string;
  coverUrl: string | null;
  entry: SeriesEntryLink | null;
  progress: number;
  /** Nombre d'épisodes ; null : inconnu (pas de barre, + toujours actif) */
  total: number | null;
  /** « Ép. 4 / 12 » */
  progressText: string;
  /** « 4 épisodes vus sur 12 » : barre de la jaquette et groupe − / + */
  progressLabel: string;
  status: SeriesStatus;
  tag?: SeriesTag | null;
  decrementLabel: string;
  incrementLabel: string;
  onDecrement: () => void;
  onIncrement: () => void;
  /** Envoi en cours (− / + aria-disabled, focus gardé) */
  busy?: boolean;
  /** + absent (série exclue) */
  incrementHidden?: boolean;
  /** « Ouvrir » sur le lecteur ; null : aucun lien connu */
  open: SeriesOpenLink | null;
  /** Actions à droite d'« Ouvrir » (bouton « ⋯ ») */
  actions?: ComponentChildren;
  /** Trait de séparation au-dessus (toutes les lignes sauf la première) */
  separated?: boolean;
  /**
   * Clé de la série : data-series-row, data-focus du titre (`title-<clé>`), d'« Ouvrir » (`open-<clé>`) et des − / +
   * (`<clé>-minus`, `<clé>-plus`)
   */
  rowKey: string;
}

/** Titre sur une ligne (« … » et texte entier en infobulle), lien vers la fiche quand il y en a une */
export function SeriesTitle({ title, entry, focusKey }: { title: string; entry: SeriesEntryLink | null; focusKey?: string }) {
  return (
    <span class="block min-w-0 truncate text-row-title text-ink" title={title} data-series-title="">
      {entry ? (
        <a class="text-ink no-underline underline-offset-2 hover:underline" href={entry.href} target="_blank" rel="noopener noreferrer" aria-label={entry.label} data-focus={focusKey}>
          {title}
        </a>
      ) : (
        title
      )}
    </span>
  );
}

/** Ligne de statut : point + texte du ton, pastille facultative ; un retour d'action est annoncé */
export function SeriesStatusLine({ status, tag }: { status: SeriesStatus; tag?: SeriesTag | null }) {
  return (
    <span class="flex h-4 min-w-0 items-center gap-2 overflow-hidden whitespace-nowrap" role={status.live ? 'status' : undefined} data-series-status="">
      <StatusText tone={status.tone} title={status.title}>
        {status.text}
      </StatusText>
      {tag && (
        <span class="inline-flex h-4 shrink-0 items-center gap-1 rounded-pill border border-line px-1.5 text-section font-bold tracking-normal text-muted" title={tag.title} data-series-tag="">
          {tag.icon && <Icon name={tag.icon} class="size-2.5" strokeWidth="2.6" />}
          {tag.text}
        </span>
      )}
    </span>
  );
}

export function SeriesRow(props: SeriesRowProps) {
  const { title, entry, rowKey } = props;
  const cover = <Cover size="row" title={title} src={props.coverUrl} progress={{ value: props.progress, total: props.total, label: props.progressLabel }} />;
  return (
    // Marges verticales de 8 px : jaquette + barre (63 px) et les trois lignes de texte (62 px) tiennent dans les 80 px
    <li class="relative flex h-series-row items-center gap-3 py-2 pr-2 pl-3" data-series-row={rowKey}>
      {props.separated && <span class="absolute inset-x-2.5 top-0 h-px bg-line" aria-hidden="true" />}
      {entry ? (
        // Même lien que le titre : hors tabulation et masqué aux lecteurs d'écran (doublon)
        <a class="flex shrink-0 rounded-cover transition hover:brightness-110" href={entry.href} target="_blank" rel="noopener noreferrer" tabIndex={-1} aria-hidden="true">
          {cover}
        </a>
      ) : (
        cover
      )}
      <div class="flex min-w-0 flex-1 flex-col gap-0.5">
        <SeriesTitle title={title} entry={entry} focusKey={`title-${rowKey}`} />
        <SeriesStatusLine status={props.status} tag={props.tag} />
        <Stepper
          text={props.progressText}
          value={props.progress}
          max={props.total}
          decrementLabel={props.decrementLabel}
          incrementLabel={props.incrementLabel}
          groupLabel={props.progressLabel}
          onDecrement={props.onDecrement}
          onIncrement={props.onIncrement}
          busy={props.busy}
          incrementHidden={props.incrementHidden}
          focusKey={rowKey}
        />
      </div>
      {props.open && <LogoButton platform={props.open.platform} href={props.open.href} label={props.open.label} title={props.open.title} focusKey={`open-${rowKey}`} />}
      {props.actions}
    </li>
  );
}
