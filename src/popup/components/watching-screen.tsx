// Écran « En cours » du popup (maquettes PopupSeries, PopupSeriesEtats, PopupSeriesTri, PopupSeriesRetours) : bandeau
// de retour, carte « Sur cette page » ou « Reprendre », titre « Mes séries », son tri et le total du temps restant,
// lignes de 80 px (SeriesRow), états de chargement, d'erreur et vide. La liste suit le réglage « Fiche ouverte par
// défaut » (plus de sélecteur AniList / MAL). Menu « ⋯ » partagé (ui/series-menu.tsx), éditeur de commentaire sous la
// ligne (maquettes PopupSeriesMenu, PopupSeriesMenuConfirm, PopupSeriesCommentaire), carte « Reprendre »
// (PopupReprendre), carte « Sur cette page » (page-media-card.tsx, maquettes PopupPageEtats, PopupPageMenu,
// PopupPageRetours, PopupSeriesDeplie).
import type { ComponentChildren } from 'preact';
import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import { formatList, t, tp, type MessageKey } from '../../i18n';
import { activePlatforms } from '../../browser/platform-access';
import { PLATFORMS } from '../../platforms/registry';
import { STREAMING_PLATFORMS } from '../../platforms/ids';
import { entryLinks, type EntryLinkContext } from '../../shared/entry-link';
import type { StreamingPlatform } from '../../shared/episode.types';
import type { FeedbackTone } from '../../shared/sync-feedback';
import { TRACKER_LABELS } from '../../shared/tracker.types';
import { platformSearchUrl, platformsToSearch } from '../../platforms/links';
import type { MenuStatusChange } from '../../shared/sync.types';
import { formatRemaining, formatRemainingTotal } from '../../shared/remaining-time';
import { choosePlatformLink, entryKey, formatRelativeTime, groupWatchingByStatus, listBadge, pickHeroEntry, sortWatchingBy, type WatchingStatusGroup } from '../../shared/watching';
import { WATCHING_SORTS, type NextEpisodeBadge, type WatchingEntry, type WatchingSort } from '../../shared/watching.types';
import type { IconName } from '../../ui/icons';
import { kai } from '../../ui/icons';
import { TONE_CHIP } from '../../ui/feedback';
import { PLATFORM_LABELS } from '../../ui/kit';
import { formatPlatformList } from '../../ui/platform-list';
import { PlatformsTipText } from './platforms-tip';
import type { ExclusionsState, InlineFeedback, ReadonlyStore } from '../../ui/state';
import { Alert } from '../../ui/components/alert';
import { Button } from '../../ui/components/button';
import { Icon, MountedNode } from '../../ui/components/icon';
import { MenuItem, MenuPopup } from '../../ui/components/menu';
import { NotesEditor } from '../../ui/components/notes-editor';
import { releaseChipView } from './release-chip';
import { SeriesRow, type SeriesChip, type SeriesStatus } from '../../ui/components/series-row';
import { ServiceLogo } from '../../ui/components/service-logo';
import type { Tone } from '../../ui/components/tone';
import { useLocale, useStore } from '../../ui/preact/hooks';
import { SeriesMenu } from '../../ui/series-menu';
import type { NotesSession, WatchingNotice } from '../controllers/watching';
import type { NoticeHold } from '../controllers/notice';
import type { EntryAction, PageCardState, WatchingState } from '../state';
import { flushAfterRender } from '../after-render';
import { isPageSeriesExcluded } from '../../ui/page-exclusion';
import { hasPageMediaCard, PageMediaCard, type PageMediaCardProps } from './page-media-card';
import { ResumeCard } from './resume-card';
import { Section } from '../../ui/components/section';
import { DormantSection, type DormantHost } from './dormant-section';
import { entrySite } from './entry-site';
import { EmptyReco } from './empty-reco';

/** Ce dont dépend l'affichage des séries (réglages, accès aux plateformes, comptes), recalculé par l'hôte */
export interface WatchingContext {
  /** Lecteur préféré effectif (« Ouvrir ») */
  preferredPlayer: StreamingPlatform;
  /** Plateformes à accès optionnel accordées : l'état vide les propose */
  optionalPlatforms: readonly StreamingPlatform[];
  /** Comptes connectés et fiche préférée : lien du titre et de la jaquette */
  entryLinks: EntryLinkContext;
}

export interface WatchingScreenProps {
  state: ReadonlyStore<WatchingState>;
  sort: ReadonlyStore<{ sort: WatchingSort }>;
  actions: ReadonlyStore<ReadonlyMap<string, EntryAction>>;
  notice: ReadonlyStore<WatchingNotice | null>;
  /** Pointeur ou focus dans le bandeau : son délai attend la sortie (controllers/notice.ts › hold) */
  onNoticeHold: (reason: NoticeHold, held: boolean) => void;
  /** Éditeur de commentaire ouvert (une série à la fois) */
  notes: ReadonlyStore<NotesSession | null>;
  exclusions: ReadonlyStore<ExclusionsState>;
  pageCard: ReadonlyStore<PageCardState>;
  context: ReadonlyStore<WatchingContext>;
  now: number;
  /** Retour propre au popup sur la carte « Sur cette page » (exclusion, réactivation) */
  pageNotice: ReadonlyStore<InlineFeedback | null>;
  /** Actions de la carte « Sur cette page » */
  page: Omit<PageMediaCardProps, 'card' | 'now' | 'entryLinks' | 'excluded' | 'notice'>;
  onAdjust: (entry: WatchingEntry, delta: 1 | -1) => void;
  /** Menu « ⋯ » : statut (Abandonner et Terminé confirmés dans le menu) */
  onSetStatus: (entry: WatchingEntry, status: MenuStatusChange) => void;
  onExclude: (entry: WatchingEntry) => void;
  onInclude: (entry: WatchingEntry) => void;
  /** « Retirer de la liste » confirmé */
  onRemove: (entry: WatchingEntry) => void;
  /** « Commentaire… » : éditeur ouvert sous la série */
  onOpenNotes: (entry: WatchingEntry) => void;
  /** « Annuler », Échap, enregistré */
  onCloseNotes: () => void;
  /** Enregistre le commentaire ; true si c'est fait */
  onSaveNotes: (entry: WatchingEntry, text: string) => Promise<boolean>;
  onPickSort: (sort: WatchingSort) => void;
  /** Groupe « En sommeil » au bas de la liste */
  dormant: DormantHost;
  onRetry: () => void;
  /** Lien de l'astuce de l'état vide : Réglages › Plateformes */
  onOpenPlatformsSettings: () => void;
  /** État vide, « Plus d'idées dans le panneau » : panneau ouvert sur Découvrir (dans le clic) */
  onOpenDiscover: () => void;
  /** État vide, puce « Activer {plateforme} » de la suggestion */
  onEnablePlatform: (platform: StreamingPlatform) => void;
}

const SORT_LABELS: Record<WatchingSort, MessageKey> = {
  'next-episode': 'watching.sort.nextEpisode',
  recent: 'watching.sort.recent',
  title: 'watching.sort.title',
  remaining: 'watching.sort.remaining',
  time: 'watching.sort.time',
  status: 'watching.sort.status',
};

const SORT_ICONS: Record<WatchingSort, IconName> = { 'next-episode': 'clock', recent: 'history', title: 'sortAlpha', remaining: 'sortRemaining', time: 'hourglass', status: 'list' };

/** Fin de l'aria-label de la liste (« Mes séries AniList, triées … ») */
const SORT_ARIA: Record<WatchingSort, MessageKey> = {
  'next-episode': 'watching.sortAria.nextEpisode',
  recent: 'watching.sortAria.recent',
  title: 'watching.sortAria.title',
  remaining: 'watching.sortAria.remaining',
  time: 'watching.sortAria.time',
  status: 'watching.sortAria.status',
};

/** En-têtes des groupes du tri « État » (« EN DIFFUSION · 2 ») */
const STATUS_GROUP_TITLES: Record<WatchingStatusGroup['id'], MessageKey> = {
  airing: 'watching.statusGroup.airing',
  upcoming: 'watching.statusGroup.upcoming',
  finished: 'watching.statusGroup.finished',
  stopped: 'watching.statusGroup.stopped',
  unknown: 'watching.statusGroup.unknown',
};

/** Statut de sortie : `mint` disponible, `lavender` à venir, `muted` terminée ou inconnue */
const BADGE_TONES: Record<NextEpisodeBadge['kind'], Tone> = { available: 'ok', upcoming: 'info', finished: 'muted', unknown: 'muted' };

const FEEDBACK_TONES: Record<FeedbackTone, Tone> = { success: 'ok', info: 'info', warning: 'warn', error: 'error' };

/** Série de la carte « Sur cette page » exclue de la synchro : clé de la page (comme la lecture) ou fiche AniList affichée */
function isPageExcluded({ content }: PageCardState, exclusions: ExclusionsState): boolean {
  return content.status === 'ready' && isPageSeriesExcluded({ page: content.page, mediaId: content.view.media.mediaId }, exclusions);
}

/** Menu « ⋯ » d'une série (ligne ou carte « Reprendre ») */
function EntryMenu({ entry, props, context, busy, excluded }: { entry: WatchingEntry; props: WatchingScreenProps; context: WatchingContext; busy: boolean; excluded: boolean }) {
  const links = entryLinks(entry, context.entryLinks);
  return (
    <SeriesMenu
      title={entry.title}
      focusKey={entryKey(entry)}
      busy={busy}
      onStatus={(status) => props.onSetStatus(entry, status)}
      onNotes={() => props.onOpenNotes(entry)}
      entryLinks={links.length > 0 ? links : [entrySite(entry, context.entryLinks)]}
      searches={platformsToSearch(entry.platforms, context.preferredPlayer, activePlatforms(context.optionalPlatforms)).map((platform) => ({ platform, url: platformSearchUrl(platform, entry.title) }))}
      sync={{ excluded, canExclude: entry.mediaId !== null, onExclude: () => props.onExclude(entry), onInclude: () => props.onInclude(entry) }}
      onRemove={() => props.onRemove(entry)}
    />
  );
}

/** Éditeur de commentaire de la série ouverte (lecture, édition, série absente de la liste, lecture en échec) */
function EntryNotes({ session, props, busy }: { session: NotesSession; props: WatchingScreenProps; busy: boolean }) {
  return (
    <NotesEditor
      title={session.entry.title}
      notes={session.phase === 'ready' ? session.notes : null}
      loading={session.phase === 'loading'}
      unavailable={session.phase === 'error' ? session.message : session.phase === 'ready' && !session.inList ? t('notes.notInList') : null}
      busy={busy}
      focusKey={`notes-${session.key}`}
      onSave={(text) => props.onSaveNotes(session.entry, text)}
      onClose={props.onCloseNotes}
    />
  );
}

/** Ligne 2 : envoi en cours, retour bref d'une action (~3 s), sinon la sortie du prochain épisode */
function statusOf(entry: WatchingEntry, action: EntryAction | undefined, now: number): SeriesStatus | null {
  if (action?.phase === 'pending') return { tone: 'info', text: t('inline.saving'), live: true };
  if (action?.phase === 'done') return { tone: FEEDBACK_TONES[action.feedback.tone], text: action.feedback.text, title: action.feedback.detail, live: true };
  const badge = listBadge(entry, now);
  return badge && { tone: BADGE_TONES[badge.kind], text: badge.label };
}

/** Pastille de statut de sortie (ligne 2) ; masquée avec le reste de la ligne pendant le retour d'action */
const chipOf = (entry: WatchingEntry, action: EntryAction | undefined): SeriesChip | null => (action === undefined ? releaseChipView(entry) : null);

/** « Mes séries マイシリーズ » */
function SeriesHeading({ children }: { children?: ComponentChildren }) {
  return (
    <div class="mx-1 mt-1 flex min-h-7 items-center justify-between gap-2">
      <h2 class="m-0 flex min-w-0 items-baseline gap-1.5 text-body font-extrabold">
        <span class="truncate">{t('watching.mySeries')}</span>
        <span class="shrink-0 text-section font-bold tracking-normal text-muted" aria-hidden="true">
          マイシリーズ
        </span>
      </h2>
      {children}
    </div>
  );
}

/** « ≈ 24 h à rattraper · 5 séries » sous « Mes séries » (toutes les séries de la liste) ; rien si aucune n'a de valeur */
function RemainingTotal({ entries, now }: { entries: readonly WatchingEntry[]; now: number }) {
  const total = formatRemainingTotal(entries, now);
  return total === null ? null : (
    <p class="m-0 mx-1 -mt-1.5 truncate text-secondary text-muted tabular-nums" title={total} data-remaining-total="">
      {total}
    </p>
  );
}

/** Bouton de tri + menu de choix exclusifs (focus d'ouverture sur le tri actif, Échap / Tab / clic dehors ferment) */
function SortMenu({ sort, onPick }: { sort: WatchingSort; onPick: (sort: WatchingSort) => void }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const close = (restore: boolean): void => {
    setOpen(false);
    if (restore) trigger.current?.focus();
  };
  return (
    <div ref={root} class="relative shrink-0" data-sort-root="">
      <button
        ref={trigger}
        type="button"
        class="inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-pill border border-transparent bg-transparent px-1.5 text-secondary font-bold text-muted transition-colors hover:text-ink aria-expanded:border-field aria-expanded:bg-raised aria-expanded:text-ink"
        aria-haspopup="menu"
        aria-expanded={open ? 'true' : 'false'}
        aria-label={t('watching.sortTrigger', { label: t(SORT_LABELS[sort]) })}
        data-focus="sort-trigger"
        onClick={() => setOpen(!open)}
        onKeyDown={(event) => {
          // Flèches sur le bouton fermé : ouverture directe du menu
          if (!open && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
            event.preventDefault();
            setOpen(true);
          }
        }}
      >
        <Icon name={SORT_ICONS[sort]} class="size-3.5" strokeWidth="2.2" />
        <span class="whitespace-nowrap">{t(SORT_LABELS[sort])}</span>
        <span class={`flex transition-transform ${open ? 'rotate-180' : ''}`}>
          <Icon name="chevronDown" class="size-3" strokeWidth="2.4" />
        </span>
      </button>
      {open && (
        <MenuPopup label={t('watching.sortMenu')} align="end" placement="top-full right-0 mt-1 w-max min-w-52 max-w-72" root={root} onClose={close}>
          {WATCHING_SORTS.map((value) => (
            <MenuItem key={value} icon={SORT_ICONS[value]} checked={value === sort} onSelect={() => onPick(value)}>
              {t(SORT_LABELS[value])}
            </MenuItem>
          ))}
        </MenuPopup>
      )}
    </div>
  );
}

/** Chargement sans liste en cache : quatre lignes grisées dans la carte de la liste */
function SeriesSkeleton() {
  return (
    <div class="flex flex-col gap-2 motion-safe:animate-pulse" aria-busy="true" aria-label={t('watching.loading')} data-watching-skeleton="">
      <SeriesHeading />
      <div class="rounded-card border border-line bg-surface">
        {[0, 1, 2, 3].map((index) => (
          <div key={index} class="relative flex items-center gap-2.5 px-2.5 py-2">
            {index > 0 && <span class="absolute inset-x-2.5 top-0 h-px bg-line" />}
            <span class="h-12.5 w-9 shrink-0 rounded-cover bg-raised" />
            <span class="flex min-w-0 flex-1 flex-col gap-2">
              <span class="h-2.5 w-36 max-w-full rounded-pill bg-raised" />
              <span class="h-2.5 w-24 rounded-pill bg-raised" />
            </span>
            <span class="size-logo-button shrink-0 rounded-pill bg-raised" />
          </div>
        ))}
      </div>
    </div>
  );
}

/** Aucune série en cours : Kai endormi, une invitation par plateforme active (lecteur préféré en tête), astuce */
function EmptyWatching({ context, onOpenSettings, onOpenDiscover, onEnablePlatform }: { context: WatchingContext; onOpenSettings: () => void; onOpenDiscover: () => void; onEnablePlatform: (platform: StreamingPlatform) => void }) {
  const active = activePlatforms(context.optionalPlatforms);
  const ordered = [...active].sort((a, b) => Number(b === context.preferredPlayer) - Number(a === context.preferredPlayer));
  // Plus rien à activer (toutes les plateformes optionnelles accordées) : l'astuce disparaît
  const tip = active.length < STREAMING_PLATFORMS.length;
  return (
    <div class="flex flex-col gap-3 rounded-card border border-dashed border-line px-3 pt-5 pb-3">
      <section class="flex flex-col items-center gap-2 text-center" aria-labelledby="sk-empty-title">
        <MountedNode build={() => kai('h-12 w-12', { expression: 'sleep', size: 'large' })} inputs={[]} />
        <h2 class="m-0 mt-1 font-display text-stat" id="sk-empty-title">
          {t('watching.empty.title')}
        </h2>
        <p class="m-0 max-w-75 text-secondary text-muted">
          {context.optionalPlatforms.length > 0 ? t('watching.empty.textPlatforms', { platforms: formatPlatformList(active, 'disjunction') }) : t('watching.empty.text')}
        </p>
        <div class="mt-1 flex flex-wrap justify-center gap-2">
          {ordered.map((platform, index) => (
            <Button key={platform} variant={index === 0 ? 'primary' : 'secondary'} href={PLATFORMS[platform].homeUrl} target="_blank">
              <ServiceLogo id={platform} size="md" />
              {t('watching.openPlatform', { platform: PLATFORMS[platform].label })}
            </Button>
          ))}
        </div>
      </section>
      <EmptyReco granted={context.optionalPlatforms} onEnable={onEnablePlatform} onMore={onOpenDiscover} />
      {tip && (
        <aside class="flex flex-col gap-1 rounded-card border border-line bg-surface p-3" aria-label={t('watching.tipTitle')}>
          <span class="flex items-baseline gap-1.5">
            <span class="text-section font-extrabold tracking-normal text-butter" aria-hidden="true">
              ヒント
            </span>
            <span class="text-section text-muted uppercase">{t('watching.tipTitle')}</span>
          </span>
          <p class="m-0 text-secondary text-muted">
            <PlatformsTipText onOpen={onOpenSettings} />
          </p>
        </aside>
      )}
    </div>
  );
}

/**
 * Bandeau en haut de l'écran : changement de statut, retrait, +1 / −1 en échec partiel (« Réessayer » nommant les services),
 * action sur les séries en sommeil (« Annuler », « Réessayer »)
 */
export function WatchingNoticeBanner({ notice, onHold }: { notice: WatchingNotice; onHold: (reason: NoticeHold, held: boolean) => void }) {
  const { feedback, retry } = notice;
  const services = feedback.retry ? formatList(feedback.retry.services.map((service) => TRACKER_LABELS[service])) : null;
  const ref = useRef<HTMLParagraphElement>(null);
  const held = useRef({ pointer: false, focus: false });
  const hold = (reason: NoticeHold, value: boolean): void => {
    held.current[reason] = value;
    onHold(reason, value);
  };
  // Un bouton focalisé retiré du bandeau ne déclenche aucun focusout : on lève la suspension du focus si le focus a quitté le bandeau
  useEffect(() => {
    if (held.current.focus && !ref.current?.contains(document.activeElement)) hold('focus', false);
  }, [notice.undo, notice.retry]);
  // Démontage pendant un survol ou un focus : sinon la suspension resterait levée au prochain bandeau
  useEffect(
    () => () => {
      if (held.current.pointer) onHold('pointer', false);
      if (held.current.focus) onHold('focus', false);
    },
    [],
  );
  return (
    <p
      ref={ref}
      class={`m-0 flex shrink-0 items-center gap-2 rounded-panel border px-3 py-2 text-secondary font-bold ${TONE_CHIP[feedback.tone]}`}
      role="status"
      title={feedback.detail}
      data-watching-notice=""
      onPointerEnter={() => hold('pointer', true)}
      onPointerLeave={() => hold('pointer', false)}
      onFocusIn={() => hold('focus', true)}
      // Focus passé d'« Annuler » à « Réessayer » : toujours dans le bandeau
      onFocusOut={(event) => {
        if (!(event.relatedTarget instanceof Node && event.currentTarget.contains(event.relatedTarget))) hold('focus', false);
      }}
    >
      <span class="flex shrink-0">
        <Icon name={feedback.tone === 'success' ? 'check' : 'alert'} class="size-3.5" strokeWidth={feedback.tone === 'success' ? '3' : '2.2'} />
      </span>
      <span class="min-w-0 flex-1 break-words">{feedback.text}</span>
      {notice.undo && (
        <Button size="sm" focusKey="watching-undo" onClick={notice.undo}>
          {t('watching.dormant.undo')}
        </Button>
      )}
      {retry && (
        <Button size="sm" ariaLabel={services !== null ? t('inline.retryOn', { services }) : undefined} focusKey="watching-retry" onClick={retry}>
          {t('common.retry')}
        </Button>
      )}
    </p>
  );
}

interface RowProps {
  entry: WatchingEntry;
  index: number;
  props: WatchingScreenProps;
  context: WatchingContext;
  action: EntryAction | undefined;
  excluded: boolean;
  /** Éditeur de commentaire ouvert sous cette série */
  notes: NotesSession | null;
}

/** Textes et liens communs à une ligne et à la carte « Reprendre » */
function entryView(entry: WatchingEntry, context: WatchingContext, action: EntryAction | undefined, excluded: boolean, now: number) {
  const { title, progress, totalEpisodes: total } = entry;
  const link = choosePlatformLink(entry, context.preferredPlayer);
  const site = entrySite(entry, context.entryLinks);
  const atEnd = total !== null && progress >= total;
  return {
    rowKey: entryKey(entry),
    title,
    coverUrl: entry.coverUrl,
    entry: { href: site.url, label: t('entry.openAria', { title, service: TRACKER_LABELS[site.service] }) },
    progress,
    total,
    progressText: total !== null ? t('watching.heroProgress', { progress, total }) : t('watching.heroProgressNoTotal', { progress }),
    progressLabel: total !== null ? tp('watching.seenOf', progress, { total }) : tp('watching.seen', progress),
    status: statusOf(entry, action, now),
    chip: chipOf(entry, action),
    tag: excluded ? { text: t('common.excluded'), title: t('common.excludedTitle'), icon: 'ban' as const } : null,
    decrementLabel: t('page.minusOneAria', { title }),
    incrementLabel: atEnd ? t('watching.allWatched') : t('watching.plusOneAria', { title }),
    busy: action?.phase === 'pending',
    incrementHidden: excluded,
    open: link && {
      platform: link.platform,
      href: link.url,
      label: t('watching.openOnAria', { title, platform: PLATFORM_LABELS[link.platform] }),
      title: t('watching.openOn', { platform: PLATFORM_LABELS[link.platform] }),
    },
  };
}

/** Une série de « Mes séries » (ligne de 80 px), avec son éditeur de commentaire quand il est ouvert */
function WatchingRow({ entry, index, props, context, action, excluded, notes }: RowProps) {
  const view = entryView(entry, context, action, excluded, props.now);
  return (
    <>
      <SeriesRow
        {...view}
        remaining={formatRemaining(entry, props.now)}
        separated={index > 0}
        onDecrement={() => props.onAdjust(entry, -1)}
        onIncrement={() => props.onAdjust(entry, 1)}
        actions={<EntryMenu entry={entry} props={props} context={context} busy={view.busy} excluded={excluded} />}
      />
      {notes && (
        <li class="mx-2 mb-2" aria-label={t('notes.editAria', { title: entry.title })} data-notes-row={view.rowKey}>
          <EntryNotes session={notes} props={props} busy={view.busy} />
        </li>
      )}
    </>
  );
}

/** Plateforme affichée par la carte « Reprendre » : celle du lien « Ouvrir », sinon la dernière utilisée */
function displayPlatform(entry: WatchingEntry, preferred: StreamingPlatform): StreamingPlatform | null {
  return choosePlatformLink(entry, preferred)?.platform ?? entry.lastSync?.platform ?? null;
}

/** Carte « Reprendre » et, sous elle, son éditeur de commentaire */
function ResumeEntry({ entry, props, context, action, excluded, notes }: Omit<RowProps, 'index'>) {
  const view = entryView(entry, context, action, excluded, props.now);
  const platform = displayPlatform(entry, context.preferredPlayer);
  const meta = [platform && PLATFORM_LABELS[platform], entry.lastSync && formatRelativeTime(entry.lastSync.at, props.now)].filter((part): part is string => typeof part === 'string' && part.length > 0);
  return (
    <>
      <ResumeCard
        {...view}
        meta={meta.join(' · ')}
        onDecrement={() => props.onAdjust(entry, -1)}
        onIncrement={() => props.onAdjust(entry, 1)}
        actions={<EntryMenu entry={entry} props={props} context={context} busy={view.busy} excluded={excluded} />}
      />
      {notes && (
        <div aria-label={t('notes.editAria', { title: entry.title })} data-notes-row={view.rowKey}>
          <EntryNotes session={notes} props={props} busy={view.busy} />
        </div>
      )}
    </>
  );
}

export function WatchingScreen(props: WatchingScreenProps) {
  // Focus et défilement demandés par l'hôte (menus « ⋯ », commentaire) : appliqués dès ce rendu terminé
  useLayoutEffect(flushAfterRender);
  useLocale();
  const state = useStore(props.state);
  const { sort } = useStore(props.sort);
  const actions = useStore(props.actions);
  const notice = useStore(props.notice);
  const notes = useStore(props.notes);
  const exclusions = useStore(props.exclusions);
  const pageCard = useStore(props.pageCard);
  const context = useStore(props.context);
  const { now } = props;

  const pageNotice = useStore(props.pageNotice);
  const dormant = useStore(props.dormant.state);

  const pageCardShown = hasPageMediaCard(pageCard);
  const pageCardSlot = pageCardShown && (
    <PageMediaCard {...props.page} card={pageCard} now={now} entryLinks={context.entryLinks} excluded={isPageExcluded(pageCard, exclusions)} notice={pageNotice} />
  );

  if (state.status === 'idle') return <SeriesSkeleton />;
  if (state.status === 'loading') {
    return (
      <div class="flex flex-col gap-3">
        {pageCardSlot}
        <SeriesSkeleton />
      </div>
    );
  }
  if (state.status === 'error') {
    return (
      <div class="flex flex-col gap-3">
        {pageCardSlot}
        <Alert message={state.message} action={{ label: t('common.retry'), onClick: props.onRetry }} />
      </div>
    );
  }

  const { list } = state;
  const errorAlert = state.error && <Alert message={state.error} action={{ label: t('common.retry'), onClick: props.onRetry }} />;
  const banner = notice && <WatchingNoticeBanner notice={notice} onHold={props.onNoticeHold} />;

  if (list.entries.length === 0) {
    return (
      <div class="flex min-h-full flex-col gap-3">
        {errorAlert}
        {banner}
        {pageCardSlot}
        <EmptyWatching context={context} onOpenSettings={props.onOpenPlatformsSettings} onOpenDiscover={props.onOpenDiscover} onEnablePlatform={props.onEnablePlatform} />
      </div>
    );
  }

  const excludedMediaIds = new Set(exclusions.status === 'ready' ? exclusions.items.flatMap((e) => (e.mediaId !== null ? [e.mediaId] : [])) : []);
  const isExcluded = (entry: WatchingEntry): boolean => entry.mediaId !== null && excludedMediaIds.has(entry.mediaId);
  const notesOf = (entry: WatchingEntry): NotesSession | null => (notes?.key === entryKey(entry) ? notes : null);
  // Carte « Sur cette page » prioritaire : la série « Reprendre » reste alors dans la liste
  const hero = pageCardShown ? null : pickHeroEntry(list.entries);
  // La carte « Reprendre » reste hors tri : elle est simplement retirée de la liste triée, comme les séries en sommeil
  // (groupe au bas de la liste, qui n'inclut jamais la série « Reprendre »)
  const asleep = new Set(dormant.entries.map(entryKey));
  const active = list.entries.filter((entry) => entry !== hero && !asleep.has(entryKey(entry)));
  const rows = sortWatchingBy(active, sort, now);
  const listLabel = t('watching.listAria', { service: TRACKER_LABELS[state.service], sort: t(SORT_ARIA[sort]) });
  const rowsOf = (entries: readonly WatchingEntry[]) =>
    entries.map((entry, index) => {
      const key = entryKey(entry);
      return <WatchingRow key={key} entry={entry} index={index} props={props} context={context} action={actions.get(key)} excluded={isExcluded(entry)} notes={notesOf(entry)} />;
    });
  const listClass = 'm-0 list-none rounded-card border border-line bg-surface p-0';
  const dormantGroup = <DormantSection host={props.dormant} state={dormant} links={context.entryLinks} now={now} />;

  return (
    <div class="flex flex-col gap-2" aria-busy={state.refreshing ? 'true' : 'false'}>
      {errorAlert}
      {banner}
      {pageCardSlot}
      {hero && <ResumeEntry entry={hero} props={props} context={context} action={actions.get(entryKey(hero))} excluded={isExcluded(hero)} notes={notesOf(hero)} />}
      <SeriesHeading>{rows.length > 1 && <SortMenu sort={sort} onPick={props.onPickSort} />}</SeriesHeading>
      <RemainingTotal entries={list.entries} now={now} />
      {rows.length > 0 && sort === 'status' ? (
        // Tri « État » : un groupe par statut de sortie, sous un titre de niveau 3 (séries actives seulement, le groupe
        // « En sommeil » reste à la fin)
        <div class="flex flex-col gap-3" role="group" aria-label={listLabel} data-status-groups="">
          {groupWatchingByStatus(rows, now).map((group) => (
            <Section key={group.id} title={t(STATUS_GROUP_TITLES[group.id])} count={group.entries.length} countInline level={3}>
              <ul class={listClass}>{rowsOf(group.entries)}</ul>
            </Section>
          ))}
        </div>
      ) : rows.length > 0 ? (
        <ul class={listClass} aria-label={listLabel}>
          {rowsOf(rows)}
        </ul>
      ) : (
        asleep.size === 0 && <p class="m-0 rounded-card border border-line bg-surface p-3 text-secondary text-muted">{t('watching.noOther')}</p>
      )}
      {dormantGroup}
    </div>
  );
}
