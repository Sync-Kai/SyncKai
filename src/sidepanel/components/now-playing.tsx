// Onglet « En lecture » du panneau latéral (maquettes PanelLecture, PanelFicheDetails, PanelFicheEtats, PanelListeEtats,
// PanelSeriePage, PanelSaisonDevinee) : fiche AniList de la série ou de l'épisode ouvert dans l'onglet suivi. États avant
// la fiche (lecture de la page, squelette, page sans série, introuvable, pas un anime, plateforme désactivée, erreur), puis
// la fiche : en-tête, « Détails AniList indisponibles », « Tu regardes » (page de lecture), « Saison » (deux choix au
// moins), « Ta liste », sections repliables. Données et actions : contrôleur sans rendu (components/now-playing-controller.ts,
// publié par sidepanel.ts) ; parties partagées avec la carte « Sur cette page » du popup (src/ui/components/).
import type { ComponentChildren } from 'preact';
import { joinSentences, t } from '../../i18n';
import { entryLink, entryLinks, type EntryLinkContext } from '../../shared/entry-link';
import type { StreamingPlatform } from '../../shared/episode.types';
import type { PageMediaInfo, PageMediaView } from '../../shared/page-media.types';
import type { PanelMedia } from '../../shared/panel-media.types';
import type { AddListStatus, AdjustRetry, ListStatusChange } from '../../shared/sync.types';
import type { TrackerId } from '../../shared/tracker.types';
import { Alert } from '../../ui/components/alert';
import { Icon } from '../../ui/components/icon';
import { SeasonPicker } from '../../ui/components/season-picker';
import type { IconName } from '../../ui/icons';
import type { MediaActionsState } from '../../ui/media-action-requests';
import { isPageSeriesExcluded } from '../../ui/page-exclusion';
import { seasonOptionLabel, seasonPickerOptions, splitAround } from '../../ui/page-media-view';
import { useLocale, useNow, useStore } from '../../ui/preact/hooks';
import { settingsPath } from '../../ui/settings/navigation';
import type { ExclusionsState, InlineFeedback, ReadonlyStore } from '../../ui/state';
import type { LiveSnapshot } from '../live-view';
import { episodeLine, pageKey } from '../now-playing-view';
import { DetailsCard, type PanelSection, type PanelSectionsState } from './details-card';
import { ListCard } from './list-card';
import { LiveCard } from './live-card';
import type { NowPlayingContent } from './now-playing-controller';
import { HeroSkeleton, NowPlayingHero } from './now-playing-hero';

/** Instantané du contrôleur de l'onglet, republié à chaque changement */
export interface NowPlayingSnapshot {
  content: NowPlayingContent;
  actions: MediaActionsState;
  /** Lecteur préféré effectif : « Regarder » des suites */
  preferred: StreamingPlatform;
  /** Réglage « Fiche ouverte par défaut » */
  entryService: TrackerId;
  /** Réglage « Afficher la progression en direct » */
  liveEnabled: boolean;
}

export interface NowPlayingHandlers {
  onToggleSection: (section: PanelSection, open: boolean) => void;
  /** « Actualiser la fiche » */
  onRefresh: () => void;
  /** « Réessayer » (introuvable, erreur, détails indisponibles) */
  onRetry: () => void;
  onAdd: (status: AddListStatus) => void;
  onAdjust: (delta: 1 | -1) => void;
  onRetryAdjust: (retry: AdjustRetry) => void;
  onSetStatus: (status: ListStatusChange) => void;
  onRate: (value: number) => void;
  onRemove: () => void;
  /** Commentaire enregistré ; true si c'est fait */
  onSaveNotes: (notes: string) => Promise<boolean>;
  onPickSeason: (mediaId: number) => void;
  onExclude: () => void;
  onInclude: () => void;
  /** Lien « Réglages › Plateformes » d'une plateforme désactivée */
  onOpenPlatformsSettings: () => void;
}

export interface NowPlayingProps extends NowPlayingHandlers {
  state: ReadonlyStore<NowPlayingSnapshot>;
  live: ReadonlyStore<LiveSnapshot>;
  exclusions: ReadonlyStore<ExclusionsState>;
  /** Retour propre au panneau (exclusion, réactivation) */
  notice: ReadonlyStore<InlineFeedback | null>;
  sections: ReadonlyStore<PanelSectionsState>;
}

/** L'heure des pastilles de diffusion avance tant que le panneau reste ouvert */
const CLOCK_TICK_MS = 60_000;

/** Carte d'état centrée : icône, texte, suite facultative */
function StateCard({ icon, iconClass = 'text-lavender', busy = false, children }: { icon: IconName; iconClass?: string; busy?: boolean; children: ComponentChildren }) {
  return (
    <section class="flex flex-col items-center gap-3 rounded-card border border-line bg-surface px-4 py-6 text-center" role="status" data-now-playing-state="">
      <span class={`flex ${iconClass} ${busy ? 'motion-safe:animate-spin' : ''}`}>
        <Icon name={icon} class="size-5.5" strokeWidth="2.2" />
      </span>
      {children}
    </section>
  );
}

/** Message d'une page sans suivi ; « Réglages › Plateformes » (plateforme désactivée) devient un lien */
function UntrackedState({ message, onOpen }: { message: string; onOpen: () => void }) {
  const path = settingsPath('platforms');
  const parts = splitAround(message, path);
  return (
    <StateCard icon={parts ? 'power' : 'ban'} iconClass="text-muted">
      <p class="m-0 max-w-70 text-muted">
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
    </StateCard>
  );
}

interface ReadyProps {
  props: NowPlayingProps;
  snapshot: NowPlayingSnapshot;
  page: PageMediaInfo;
  view: PageMediaView;
  details: PanelMedia | null;
  detailsError: string | null;
  refreshing: boolean;
}

function Ready({ props, snapshot, page, view, details, detailsError, refreshing }: ReadyProps) {
  const now = useNow(CLOCK_TICK_MS);
  const exclusions = useStore(props.exclusions);
  const notice = useStore(props.notice);
  const sections = useStore(props.sections);
  const { actions } = snapshot;
  const { media } = view;
  const busy = actions.busy !== null || refreshing;
  // Fiche ouverte par le titre, la jaquette, les suites et le menu : comptes connectés (un état de liste par compte) et réglage
  const links: EntryLinkContext = { connected: view.lists.map((list) => list.service), preferred: snapshot.entryService };
  const ids = { mediaId: media.mediaId, malId: media.idMal };
  const options = seasonPickerOptions(view).map((season) => ({ id: season.id, label: seasonOptionLabel(season) }));
  const uncertain = view.confidence === 'uncertain';
  return (
    <div class="flex flex-col gap-2.5" aria-label={t('panel.nowPlaying.aria')}>
      <NowPlayingHero view={view} details={details} entry={entryLink(ids, links)} refreshing={refreshing} busy={busy} now={now} onRefresh={props.onRefresh} />
      {detailsError !== null && <Alert message={joinSentences([t('panel.nowPlaying.detailsError'), detailsError])} action={{ label: t('common.retry'), onClick: props.onRetry }} />}
      {/* Position de lecture en direct et compte à rebours : page de lecture uniquement */}
      {page.kind === 'episode' && <LiveCard episode={episodeLine(view.episodeProgress, media.episodes)} enabled={snapshot.liveEnabled} live={props.live} />}
      {options.length >= 2 && (
        <section class="rounded-card border border-line bg-surface p-3" data-season-card="">
          <SeasonPicker
            label={t('page.seasonPicker')}
            ariaLabel={t('page.seasonPickerAria')}
            options={options}
            value={media.mediaId}
            disabled={busy}
            onPick={props.onPickSeason}
            warning={uncertain ? t(view.source === 'manual' ? 'page.manualNotSaved' : 'page.uncertain') : null}
            // Page de lecture : le choix devient la correspondance de la saison (sur une page de série, il ne vaut que pour l'affichage)
            help={!uncertain && page.kind === 'episode' ? t('page.seasonHelp') : null}
            focusKey="page-season"
            framed={false}
          />
        </section>
      )}
      <ListCard
        view={view}
        actions={actions}
        refreshing={refreshing}
        notice={notice}
        entryLinks={entryLinks(ids, links)}
        excluded={isPageSeriesExcluded({ page, mediaId: media.mediaId }, exclusions)}
        onAdd={props.onAdd}
        onAdjust={props.onAdjust}
        onRetryAdjust={props.onRetryAdjust}
        onSetStatus={props.onSetStatus}
        onExclude={props.onExclude}
        onInclude={props.onInclude}
        onRemove={props.onRemove}
      />
      <DetailsCard
        page={page}
        view={view}
        details={details}
        entryLinks={links}
        preferred={snapshot.preferred}
        busy={busy}
        sections={sections}
        onToggle={props.onToggleSection}
        onRate={props.onRate}
        onSaveNotes={props.onSaveNotes}
      />
    </div>
  );
}

export function NowPlaying(props: NowPlayingProps) {
  useLocale();
  const snapshot = useStore(props.state);
  const { content } = snapshot;
  switch (content.status) {
    case 'idle':
      return (
        <StateCard icon="spinner" busy>
          <p class="m-0 text-muted">{t('panel.nowPlaying.detecting')}</p>
        </StateCard>
      );
    case 'detecting':
      return <HeroSkeleton title={null} />;
    case 'loading':
      return <HeroSkeleton title={content.page.seriesTitle} />;
    case 'no-page':
      return (
        <StateCard icon="screen">
          <p class="m-0 max-w-70 text-muted">{t('panel.nowPlaying.noPage')}</p>
          {content.unreachable && (
            <p class="m-0 flex items-center gap-1.5 text-secondary font-extrabold text-butter">
              <Icon name="retry" class="size-3.5" strokeWidth="2.4" />
              {t('panel.live.unreachable')}
            </p>
          )}
        </StateCard>
      );
    case 'not-found':
      // Série ignorée ou plateforme désactivée : état neutre, sans l'indice « termine l'épisode » (aucune carte « À vérifier » ne viendra)
      if (content.untracked) return <UntrackedState message={content.message} onOpen={props.onOpenPlatformsSettings} />;
      return (
        <StateCard icon="search" iconClass="text-butter">
          <p class="m-0 max-w-70 text-muted">{content.message}</p>
          <p class="m-0 max-w-70 text-secondary text-muted">
            <span class="font-display text-overline font-bold text-butter" aria-hidden="true">
              ヒント
            </span>{' '}
            {t('panel.nowPlaying.notFoundHint')}
          </p>
        </StateCard>
      );
    case 'error':
      return (
        <section class="flex flex-col gap-2 rounded-card border border-line bg-surface p-3" data-now-playing-error="">
          <span class="truncate text-row-title" title={content.page.seriesTitle}>
            {content.page.seriesTitle}
          </span>
          <Alert message={content.message} action={{ label: t('common.retry'), onClick: props.onRetry }} />
        </section>
      );
    case 'ready':
      return (
        <Ready
          key={pageKey(content.page)}
          props={props}
          snapshot={snapshot}
          page={content.page}
          view={content.view}
          details={content.details}
          detailsError={content.detailsError}
          refreshing={content.refreshing}
        />
      );
  }
}

