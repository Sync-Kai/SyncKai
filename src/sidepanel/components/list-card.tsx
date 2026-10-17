// Carte « Ta liste » de « En lecture » (maquettes PanelLecture, PanelLectureMenu, PanelLectureConfirm, PanelListeEtats) :
// titre et statut de la liste de référence en pastille, « ⋯ » (menu de la série partagé avec le popup : statuts
// confirmés en ligne, fiches AniList / MyAnimeList, exclusion, retrait ; seulement si la série est dans une liste,
// rotation à sa place pendant le retrait), « Progression » et la pilule − / « Ép. 6 / 28 » / +, une ligne par service
// (statut, progression, note), le retour de la dernière action, puis l'ajout à une liste là où la série manque. Aucun
// compte connecté : la marche à suivre seule.
import { formatList, t, tp } from '../../i18n';
import type { EntryLink } from '../../shared/entry-link';
import type { PageMediaView } from '../../shared/page-media.types';
import type { AddListStatus, AdjustRetry, ListStatusChange } from '../../shared/sync.types';
import { TRACKER_LABELS } from '../../shared/tracker.types';
import { FeedbackBanner } from '../../ui/components/feedback-banner';
import { Icon } from '../../ui/components/icon';
import { ServiceLines } from '../../ui/components/service-lines';
import { AddToListButtons } from '../../ui/components/status-actions';
import { Stepper } from '../../ui/components/stepper';
import type { MediaActionsState } from '../../ui/media-action-requests';
import { hasMissingList, listStatusLabel, primaryList, progressText, serviceLineWithScore } from '../../ui/page-media-view';
import { SeriesMenu } from '../../ui/series-menu';
import type { InlineFeedback } from '../../ui/state';

export interface ListCardProps {
  view: PageMediaView;
  actions: MediaActionsState;
  /** Fiche relue : actions inactives */
  refreshing: boolean;
  /** Retour propre au panneau (exclusion, réactivation), prioritaire sur celui du contrôleur */
  notice: InlineFeedback | null;
  /** Fiches ouvrables depuis le menu (comptes connectés, service préféré en tête) */
  entryLinks: readonly EntryLink[];
  excluded: boolean;
  onAdd: (status: AddListStatus) => void;
  onAdjust: (delta: 1 | -1) => void;
  onRetryAdjust: (retry: AdjustRetry) => void;
  onSetStatus: (status: ListStatusChange) => void;
  onExclude: () => void;
  onInclude: () => void;
  onRemove: () => void;
}

const SECTION_TITLE = 'm-0 text-section text-muted uppercase';

export function ListCard(props: ListCardProps) {
  const { view, actions, refreshing } = props;
  const { media } = view;
  const busy = actions.busy !== null || refreshing;
  const primary = primaryList(view.lists);
  const total = media.episodes;
  const feedback = props.notice ?? actions.feedback;
  const services = feedback?.retry ? formatList(feedback.retry.services.map((service) => TRACKER_LABELS[service])) : null;

  if (view.lists.length === 0) {
    return (
      <section class="flex flex-col gap-2 rounded-card border border-line bg-surface p-3" aria-label={t('panel.nowPlaying.list')} data-list-card="">
        <h3 class={SECTION_TITLE}>{t('panel.nowPlaying.list')}</h3>
        <p class="m-0 text-secondary text-muted">{t('panel.nowPlaying.connectHint')}</p>
      </section>
    );
  }

  return (
    <section class="flex flex-col gap-2.5 rounded-card border border-line bg-surface p-3" aria-label={t('panel.nowPlaying.list')} aria-busy={busy ? 'true' : 'false'} data-list-card="">
      <div class="flex min-h-8 min-w-0 items-center gap-2">
        <h3 class={`${SECTION_TITLE} shrink-0`}>{t('panel.nowPlaying.list')}</h3>
        {primary && (
          <span class="min-w-0 truncate rounded-pill bg-lavender/15 px-2 py-0.5 text-secondary font-extrabold text-lavender" title={listStatusLabel(primary.status)} data-list-status="">
            {listStatusLabel(primary.status)}
          </span>
        )}
        <span class="flex-1" />
        {/* « ⋯ » : seulement si la série est dans au moins une liste (maquette PanelListeEtats) ; rotation pendant le retrait */}
        {primary !== null &&
          (actions.busy === 'remove' ? (
            <span class="flex size-8 shrink-0 items-center justify-center text-muted" role="status" aria-label={t('list.remove')} data-removing="">
              <Icon name="spinner" class="size-4 motion-safe:animate-spin" strokeWidth="2.4" />
            </span>
          ) : (
            <SeriesMenu
              title={media.title}
              focusKey="panel"
              busy={busy}
              onStatus={props.onSetStatus}
              entryLinks={props.entryLinks}
              searches={[]}
              sync={{ excluded: props.excluded, canExclude: true, onExclude: props.onExclude, onInclude: props.onInclude }}
              onRemove={props.onRemove}
              currentStatus={primary.status}
            />
          ))}
      </div>
      {primary && (
        <div class="flex min-w-0 flex-wrap items-center gap-2">
          <span class="min-w-0 flex-1 text-secondary font-bold text-muted">{t('compare.filter.progress')}</span>
          <Stepper
            variant="pill"
            text={progressText(primary.progress, total)}
            value={primary.progress}
            max={total}
            decrementLabel={t('page.minusOneAria', { title: media.title })}
            incrementLabel={total !== null && primary.progress >= total ? t('watching.allWatched') : t('watching.plusOneAria', { title: media.title })}
            groupLabel={total !== null ? tp('watching.seenOf', primary.progress, { total }) : tp('watching.seen', primary.progress)}
            onDecrement={() => props.onAdjust(-1)}
            onIncrement={() => props.onAdjust(1)}
            busy={busy}
            focusKey="page"
          />
        </div>
      )}
      <ServiceLines
        label={t('page.listsAria')}
        lines={view.lists.map((list) => ({
          service: list.service,
          serviceLabel: TRACKER_LABELS[list.service],
          text: serviceLineWithScore(list, total),
          state: list.state === 'in-list' ? 'in-list' : list.state === 'error' ? 'error' : 'absent',
        }))}
      />
      {feedback && (
        <FeedbackBanner
          tone={feedback.tone}
          text={feedback.text}
          detail={feedback.detail}
          retry={
            feedback.retry && services !== null
              ? { label: t('common.retry'), ariaLabel: t('inline.retryOn', { services }), disabled: busy, onClick: () => feedback.retry && props.onRetryAdjust(feedback.retry) }
              : null
          }
          focusKey="page-retry"
        />
      )}
      {hasMissingList(view.lists) && (
        <AddToListButtons
          labels={{ PLANNING: t('page.addPlanning'), CURRENT: t('page.addCurrent') }}
          busy={actions.busy === 'add-PLANNING' ? 'PLANNING' : actions.busy === 'add-CURRENT' ? 'CURRENT' : null}
          disabled={busy}
          primary={primary === null}
          onAdd={props.onAdd}
          focusKey="page"
        />
      )}
    </section>
  );
}
