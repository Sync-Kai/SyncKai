// Carte « Reprendre » (maquette PopupReprendre) : hors page de streaming, la série à reprendre prend la place de « Sur
// cette page ». Surtitre « Reprendre ツヅキ », jaquette et sa barre de progression, titre (lien vers la fiche), statut de
// sortie (ou retour d'une action), plateforme et dernière synchro, « Ouvrir sur {plateforme} » et la progression − / +,
// menu « ⋯ » de l'hôte. Tous les textes arrivent traduits ou passent par t().
import type { ComponentChildren } from 'preact';
import { t } from '../../i18n';
import type { StreamingPlatform } from '../../platforms/ids';
import { Button } from '../../ui/components/button';
import { Cover } from '../../ui/components/cover';
import { Icon } from '../../ui/components/icon';
import { SeriesStatusLine, SeriesTitle, type SeriesEntryLink, type SeriesOpenLink, type SeriesStatus, type SeriesTag } from '../../ui/components/series-row';
import { ServiceLogo } from '../../ui/components/service-logo';
import { Stepper } from '../../ui/components/stepper';

export interface ResumeCardProps {
  /** Clé de la série : data-focus du titre (`title-<clé>`), d'« Ouvrir » (`open-<clé>`), des − / + (`<clé>-minus`…) */
  rowKey: string;
  title: string;
  coverUrl: string | null;
  entry: SeriesEntryLink | null;
  progress: number;
  total: number | null;
  /** « Ép. 6 / 28 » */
  progressText: string;
  /** « 6 épisodes vus sur 28 » */
  progressLabel: string;
  status: SeriesStatus;
  tag?: SeriesTag | null;
  /** « Crunchyroll · il y a 2 h » (plateforme affichée, dernière synchro) ; vide : rien */
  meta: string;
  decrementLabel: string;
  incrementLabel: string;
  onDecrement: () => void;
  onIncrement: () => void;
  busy?: boolean;
  incrementHidden?: boolean;
  /** « Ouvrir sur {plateforme} » ; null : aucun lien connu */
  open: (SeriesOpenLink & { platform: StreamingPlatform }) | null;
  /** Bouton « ⋯ » */
  actions?: ComponentChildren;
}

export function ResumeCard(props: ResumeCardProps) {
  const { title, entry, rowKey } = props;
  const cover = <Cover size="row" title={title} src={props.coverUrl} progress={{ value: props.progress, total: props.total, label: props.progressLabel }} />;
  return (
    <section class="flex shrink-0 flex-col gap-2.5 rounded-card border border-line bg-surface p-3" aria-label={t('watching.resume')} data-resume-card={rowKey}>
      <div class="flex min-w-0 items-start gap-3">
        {entry ? (
          // Même lien que le titre : hors tabulation et masqué aux lecteurs d'écran (doublon)
          <a class="flex shrink-0 rounded-cover transition hover:brightness-110" href={entry.href} target="_blank" rel="noopener noreferrer" tabIndex={-1} aria-hidden="true">
            {cover}
          </a>
        ) : (
          cover
        )}
        <div class="flex min-w-0 flex-1 flex-col gap-0.5">
          <span class="flex min-w-0 items-baseline gap-1.5">
            <span class="truncate text-section text-muted uppercase">{t('watching.resume')}</span>
            <span class="shrink-0 text-section font-extrabold tracking-normal text-sakura" aria-hidden="true">
              ツヅキ
            </span>
          </span>
          <SeriesTitle title={title} entry={entry} focusKey={`title-${rowKey}`} />
          <SeriesStatusLine status={props.status} tag={props.tag} />
          {props.meta !== '' && (
            <span class="truncate text-secondary text-muted" title={props.meta} data-resume-meta="">
              {props.meta}
            </span>
          )}
        </div>
        {props.actions}
      </div>
      <div class="flex min-w-0 flex-wrap items-center justify-between gap-x-2 gap-y-1.5">
        {props.open && (
          <Button size="sm" href={props.open.href} target="_blank" ariaLabel={props.open.label} focusKey={`open-${rowKey}`}>
            <ServiceLogo id={props.open.platform} size="sm" />
            <Icon name="play" class="size-2.5 fill-sakura text-sakura" />
            {props.open.title}
          </Button>
        )}
        <span class="ms-auto flex">
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
        </span>
      </div>
    </section>
  );
}
