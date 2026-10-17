// Carte « Sur cette page » (maquettes PopupPageEtats, PopupPageMenu, PopupPageRetours, PopupSeriesDeplie) : fiche AniList
// de la série ouverte dans l'onglet actif, à la place de la carte « Reprendre ». Chargement (squelette), introuvable
// (« Réessayer »), erreur réseau ou limite AniList, pas un anime / plateforme désactivée (mention, lien vers Réglages ›
// Plateformes), puis la fiche : en-tête (jaquette, titre, ligne d'infos, prochain épisode, menu « ⋯ » partagé avec « Mes
// séries »), saison devinée et son sélecteur, lignes par service, retour de la dernière action, ajout à une liste ou statut
// et progression, détails repliables (saison, note, commentaire). Données et actions : contrôleur de la fiche
// (ui/page-media-controller.ts) et popup.ts ; les parties sont des composants partagés (src/ui/components/), prêts pour
// « En lecture » du panneau latéral.
import { useState } from 'preact/hooks';
import { formatList, t, tp } from '../../i18n';
import { pageKey } from '../../browser/storage/page-media-cache';
import { PLATFORMS } from '../../platforms/registry';
import { entryLink, entryLinks, type EntryLinkContext } from '../../shared/entry-link';
import type { PageMediaInfo, PageMediaView } from '../../shared/page-media.types';
import type { AddListStatus, AdjustRetry, ListStatusChange } from '../../shared/sync.types';
import { TRACKER_LABELS } from '../../shared/tracker.types';
import { Alert } from '../../ui/components/alert';
import { FeedbackBanner } from '../../ui/components/feedback-banner';
import { MediaDetails } from '../../ui/components/media-details';
import { MediaHeader, MediaHeaderSkeleton, type MediaAiring } from '../../ui/components/media-header';
import { RatingBlock } from '../../ui/components/rating-block';
import { SeasonPicker } from '../../ui/components/season-picker';
import { NotesEditor } from '../../ui/components/notes-editor';
import { ServiceLines } from '../../ui/components/service-lines';
import { AddToListButtons, StatusActions } from '../../ui/components/status-actions';
import {
  displayScore,
  formatAiringDate,
  hasMissingList,
  listStatusLabel,
  pageBadge,
  pageMetaParts,
  primaryList,
  progressText,
  seasonOptionLabel,
  seasonPickerOptions,
  serviceLineText,
  showsServiceLines,
  splitAround,
} from '../../ui/page-media-view';
import { settingsPath } from '../../ui/settings/navigation';
import type { InlineFeedback } from '../../ui/state';
import { SeriesMenu } from '../../ui/series-menu';
import type { PageCardState } from '../state';

export interface PageMediaCardProps {
  card: PageCardState;
  now: number;
  /** Comptes connectés et fiche préférée : lien du titre et de la jaquette, fiches du menu */
  entryLinks: EntryLinkContext;
  /** Série exclue de la synchro (« Réactiver la synchro » dans le menu) */
  excluded: boolean;
  /** Retour propre au popup (exclusion, réactivation), prioritaire sur celui du contrôleur */
  notice: InlineFeedback | null;
  onRetry: () => void;
  onAdd: (status: AddListStatus) => void;
  onAdjust: (delta: 1 | -1) => void;
  /** « Réessayer » d'un + / − en échec partiel */
  onRetryAdjust: (retry: AdjustRetry) => void;
  onSetStatus: (status: ListStatusChange) => void;
  onRate: (value: number) => void;
  onPickSeason: (mediaId: number) => void;
  /** Commentaire enregistré ; true si c'est fait */
  onSaveNotes: (notes: string) => Promise<boolean>;
  onExclude: () => void;
  onInclude: () => void;
  /** « Retirer de la liste » confirmé */
  onRemove: () => void;
  /** Lien « Réglages › Plateformes » d'une plateforme désactivée */
  onOpenPlatformsSettings: () => void;
}

const CARD = 'flex shrink-0 flex-col gap-2.5 rounded-card border border-line bg-surface p-3';

/** Carte affichée (série ou épisode reconnu, en chargement ou en erreur) : elle remplace alors la carte « Reprendre » */
export function hasPageMediaCard(card: PageCardState): boolean {
  const { status } = card.content;
  return status !== 'idle' && status !== 'detecting' && status !== 'no-page';
}

/** Message d'une page sans suivi ; « Réglages › Plateformes » (plateforme désactivée) devient un lien */
function UntrackedMessage({ message, onOpen }: { message: string; onOpen: () => void }) {
  const path = settingsPath('platforms');
  const parts = splitAround(message, path);
  return (
    <p class="m-0 text-secondary text-muted" role="status">
      {parts ? (
        <>
          {parts[0]}
          <button
            type="button"
            class="cursor-pointer border-0 bg-transparent p-0 font-extrabold text-ink underline decoration-field underline-offset-2 hover:decoration-ink"
            data-focus="page-platforms-settings"
            onClick={onOpen}
          >
            {path}
          </button>
          {parts[1]}
        </>
      ) : (
        message
      )}
    </p>
  );
}

/** Pastille du prochain épisode : seulement s'il est disponible ou annoncé (terminée, inconnue : la ligne d'infos le dit) */
function airingOf(view: PageMediaView, now: number): MediaAiring | null {
  const badge = pageBadge(view, now);
  if (badge.kind !== 'available' && badge.kind !== 'upcoming') return null;
  const next = view.media.nextEpisode;
  return { tone: badge.kind === 'available' ? 'ok' : 'info', text: badge.label, date: next && next.airingAt > now ? formatAiringDate(next.airingAt) : null };
}

interface ReadyProps {
  props: PageMediaCardProps;
  page: PageMediaInfo;
  view: PageMediaView;
  refreshing: boolean;
}

function ReadyCard({ props, page, view, refreshing }: ReadyProps) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const { actions } = props.card;
  const { media } = view;
  const busy = actions.busy !== null || refreshing;
  const primary = primaryList(view.lists);
  const site = entryLink({ mediaId: media.mediaId, malId: media.idMal }, props.entryLinks);
  const links = entryLinks({ mediaId: media.mediaId, malId: media.idMal }, props.entryLinks);
  const total = media.episodes;
  const options = seasonPickerOptions(view).map((season) => ({ id: season.id, label: seasonOptionLabel(season) }));
  const picker = options.length >= 2;
  const uncertain = view.confidence === 'uncertain';
  const feedback = props.notice ?? actions.feedback;
  const services = feedback?.retry ? formatList(feedback.retry.services.map((service) => TRACKER_LABELS[service])) : null;
  // Détails : saison (quand elle n'est pas à vérifier au-dessus), note et commentaire d'une série dans une liste
  const details = (picker && !uncertain) || primary !== null;
  const seasonPicker = (inDetails: boolean) => (
    <SeasonPicker
      label={t(inDetails ? 'page.seasonOnAniList' : 'page.seasonPicker')}
      ariaLabel={t('page.seasonPickerAria')}
      options={options}
      value={media.mediaId}
      disabled={busy}
      onPick={props.onPickSeason}
      warning={inDetails ? null : t(view.source === 'manual' ? 'page.manualNotSaved' : 'page.uncertain')}
      // Page de lecture : le choix devient la correspondance de la saison (sur une page de série, il ne vaut que pour l'affichage)
      help={inDetails && page.kind === 'episode' ? t('page.seasonHelp') : null}
      focusKey="page-season"
    />
  );

  return (
    <section class={CARD} aria-label={t('page.title')} aria-busy={busy ? 'true' : 'false'} data-page-card="">
      <MediaHeader
        overline={t('page.title')}
        title={media.title}
        coverUrl={media.coverUrl}
        entry={site && { href: site.url, label: t('entry.openAria', { title: media.title, service: TRACKER_LABELS[site.service] }) }}
        titleFocusKey="page-entry"
        meta={pageMetaParts(view, PLATFORMS[page.platform].label).join(' · ')}
        airing={airingOf(view, props.now)}
        actions={
          <SeriesMenu
            title={media.title}
            focusKey="page"
            busy={busy}
            onStatus={props.onSetStatus}
            entryLinks={links}
            searches={[]}
            sync={{ excluded: props.excluded, canExclude: true, onExclude: props.onExclude, onInclude: props.onInclude }}
            onRemove={props.onRemove}
            inList={primary !== null}
            currentStatus={primary?.status ?? null}
          />
        }
      />
      {picker && uncertain && seasonPicker(false)}
      {showsServiceLines(view) && (
        <ServiceLines
          label={t('page.listsAria')}
          lines={view.lists.map((list) => ({
            service: list.service,
            serviceLabel: TRACKER_LABELS[list.service],
            text: serviceLineText(list, total),
            state: list.state === 'in-list' ? 'in-list' : list.state === 'error' ? 'error' : 'absent',
          }))}
        />
      )}
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
      {primary && (
        <StatusActions
          statusLabel={listStatusLabel(primary.status)}
          stepper={{
            text: progressText(primary.progress, total),
            value: primary.progress,
            max: total,
            decrementLabel: t('page.minusOneAria', { title: media.title }),
            incrementLabel: total !== null && primary.progress >= total ? t('watching.allWatched') : t('watching.plusOneAria', { title: media.title }),
            groupLabel: total !== null ? tp('watching.seenOf', primary.progress, { total }) : tp('watching.seen', primary.progress),
            onDecrement: () => props.onAdjust(-1),
            onIncrement: () => props.onAdjust(1),
            // Action en cours ou fiche relue : clics ignorés, le focus clavier reste sur le bouton
            busy,
            focusKey: 'page',
          }}
        />
      )}
      {details && view.lists.length > 0 && (
        <MediaDetails label={t('page.details')} open={detailsOpen} onToggle={() => setDetailsOpen(!detailsOpen)} focusKey="page-details">
          {picker && !uncertain && seasonPicker(true)}
          {primary && (
            <RatingBlock label={t('page.yourRating')} sliderLabel={t('rating.groupLabel', { title: media.title })} value={displayScore(view.lists) ?? 0} disabled={busy} onRate={props.onRate} focusKey="page-rate" />
          )}
          <NotesEditor
            // Autre fiche (saison choisie) : brouillon oublié
            key={media.mediaId}
            variant="inline"
            title={media.title}
            notes={primary?.notes ?? null}
            loading={false}
            unavailable={primary ? null : t('notes.notInList')}
            busy={busy}
            focusKey="page-notes"
            onSave={props.onSaveNotes}
          />
        </MediaDetails>
      )}
    </section>
  );
}

/** Carte « Sur cette page », ou rien hors page de série / d'épisode reconnue (carte « Reprendre » affichée) */
export function PageMediaCard(props: PageMediaCardProps) {
  const { content } = props.card;
  switch (content.status) {
    case 'idle':
    case 'detecting':
    case 'no-page':
      return null;
    case 'loading':
      return (
        <section class={CARD} aria-busy="true" aria-label={t('page.loading', { title: content.page.seriesTitle })} data-page-card="">
          <MediaHeaderSkeleton overline={t('page.title')} title={content.page.seriesTitle} />
        </section>
      );
    case 'not-found':
      return (
        <section class={CARD} aria-label={t('page.title')} data-page-card="">
          <MediaHeader overline={t('page.title')} title={content.page.seriesTitle} muted={content.untracked} />
          {content.untracked ? (
            // Série ignorée (pas un anime) ou plateforme désactivée : mention neutre, rien à réessayer
            <UntrackedMessage message={content.message} onOpen={props.onOpenPlatformsSettings} />
          ) : (
            <Alert message={content.message} tone="warn" icon="search" action={{ label: t('common.retry'), onClick: props.onRetry }} />
          )}
        </section>
      );
    case 'error':
      return (
        <section class={CARD} aria-label={t('page.title')} data-page-card="">
          <MediaHeader overline={t('page.title')} title={content.page.seriesTitle} />
          <Alert message={content.message} action={{ label: t('common.retry'), onClick: props.onRetry }} />
        </section>
      );
    case 'ready':
      return <ReadyCard key={pageKey(content.page)} props={props} page={content.page} view={content.view} refreshing={content.refreshing} />;
  }
}
