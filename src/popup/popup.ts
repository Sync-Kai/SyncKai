import { getLocale, initI18n, onLocaleChange, t } from '../i18n';
import { refreshReviewBadge } from '../browser/badge';
import type { EntryLinkContext } from '../shared/entry-link';
import type { EpisodeInfo } from '../shared/episode.types';
import { EXCLUDED_SERIES_KEY, getExcludedSeries, platformSeriesKey } from '../shared/exclusions';
import { excludeSeries } from '../browser/storage/exclusions-store';
import { sendMessage } from '../protocol/messages';
import type { RecentSync } from '../shared/review.types';
import { DEFAULT_SETTINGS, effectivePlayer, normalizeSettings, SETTINGS_STORAGE_KEY } from '../shared/settings';
import { getSettings } from '../browser/storage/settings-access';
import type { StreamingPlatform } from '../shared/episode.types';
import { grantedOptionalPlatforms } from '../browser/platform-access';
import { deletePendingReview, getPendingReviews, getRecentSyncs } from '../browser/storage/reviews';
import { STORAGE_KEYS } from '../protocol/storage-keys';
import type { ListStatusChange } from '../shared/sync.types';
import type { PageMediaInfo, PageMediaView } from '../shared/page-media.types';
import { TRACKER_IDS, type TrackerId } from '../shared/tracker.types';
import { formatRelativeTime } from '../shared/watching';
import type { WatchingEntry, WatchingSort } from '../shared/watching.types';
import { createMemo, createRenderScheduler, h, nodes, preserveFocus } from '../ui/dom';
import { tickJobPause } from '../ui/job-pause';
import { createMenuDismiss } from '../ui/menu';
import { createPageMediaController, detectPageMedia } from '../ui/page-media-controller';
import { hasHostAccess, requestHostAccess, requiredOrigins } from '../browser/host-access';
import { renderFooter, type FooterStatus } from './components/footer';
import { renderHostAccessBanner } from './components/host-access-banner';
import { renderHeader, renderNav } from './components/header';
import { renderOnboarding } from './components/onboarding';
import { renderCompareSection } from './components/compare-section';
import { createCompareController } from './controllers/compare';
import { createQueueController } from './controllers/queue';
import { createRatingsController } from './controllers/ratings';
import { createWatchingController } from './controllers/watching';
import { renderQueueSection } from './components/queue-section';
import { renderRatingSection } from './components/rating-section';
import { renderRecentSyncs } from './components/recent-syncs';
import type { ReviewActions } from './components/review-card';
import { createReviewSection } from './components/review-section';
import { renderPageMediaCard } from './components/page-media-card';
import { entryKey, renderWatchingScreen } from './components/watching-screen';
import type { HostAccessState, PageCardState, RowConfirm, Screen, SettingsState, SyncData, UiState } from './state';
import { createNotesEditor, type NotesEditor } from '../ui/notes-editor';
import { primaryList } from '../ui/page-media-view';
import { createStore, patchStore, type AccountState, type ExclusionsState, type Store } from '../ui/state';
import { createLogger } from '../browser/logger';
import { openSidePanel, sidePanelKind, type PanelTarget } from '../browser/side-panel';
import { createAccountsController } from '../ui/accounts';
import type { SettingsPage } from '../ui/settings/navigation';
import { createSettingsView } from '../ui/settings/settings-view';

const log = createLogger('popup');

// Langue lue avant le premier rendu : toutes les vues sont construites directement dans la bonne langue
await initI18n();

const swUnreachable = (): string => t('popup.swUnreachable');
const CLOCK_TICK_MS = 60_000;

/**
 * Mémo d'une zone dont la langue fait partie des entrées : un changement de langue la redessine (retraduite en place,
 * sans recharger le popup : un rechargement recrée la vue auto-dimensionnée de Chrome, qui s'affiche alors zoomée)
 */
function createLocaleMemo(): (inputs: readonly unknown[]) => boolean {
  const changed = createMemo();
  return (inputs) => changed([getLocale(), ...inputs]);
}

function getRoot(): HTMLDivElement {
  const el = document.querySelector<HTMLDivElement>('#app');
  if (!el) throw new Error('Élément #app introuvable');
  return el;
}

/** Comptes AniList / MyAnimeList (connexion, session expirée…), aussi affichés par les Réglages */
const accounts = createAccountsController();
const anilistStore = accounts.anilist;
const malStore = accounts.mal;
const syncStore = createStore<SyncData>({ reviews: [], recentSyncs: [], busyKey: null, recentError: null });
const uiStore = createStore<UiState>({ screen: 'watching', previous: 'watching', sortMenuOpen: false, rowMenu: null, rowConfirm: null });
const settingsStore = createStore<SettingsState>({ status: 'loading' });
const exclusionsStore = createStore<ExclusionsState>({ status: 'loading' });
/** Liste « En cours » (source, tri, actions sur une série, bandeau de retour) */
const watching = createWatchingController({
  accounts,
  exclusions: exclusionsStore,
  reloadExclusions: () => loadExclusions(),
  onServiceShown: () => startPageMedia(),
  // Bandeau en haut de la liste : ramené dans la zone visible si la série était plus bas
  onNoticeShown: () => {
    renderer.flush();
    watchingSlot.querySelector('[data-watching-notice]')?.scrollIntoView({ block: 'nearest' });
  },
});
/** Activité › « Synchros en attente » */
const queue = createQueueController();
/** Activité › « À noter » */
const ratings = createRatingsController();
/** Carte « Sur cette page » (série de l'onglet actif) */
const pageCardStore = createStore<PageCardState>({ content: { status: 'idle' }, actions: { busy: null, confirm: null, feedback: null } });
/** Accès à Crunchyroll / ADN et aux API (bandeau « Autoriser l'accès » si Firefox l'a retiré) */
const hostAccessStore = createStore<HostAccessState>({ status: 'unknown' });
/**
 * Plateformes à accès optionnel accordées (Netflix, Disney+, Prime Video) : lecteur préféré « Netflix » ou « Prime Video » ignoré sans son accès ;
 * undefined = pas encore lu
 */
const platformAccessStore = createStore<readonly StreamingPlatform[] | undefined>(undefined);

const version = chrome.runtime.getManifest().version;
/** Lues au démarrage (synchrone) : la demande d'accès doit partir sans `await` dans le clic */
const hostOrigins = requiredOrigins(chrome.runtime.getManifest());
let now = Date.now();

function accountStore(service: TrackerId): Store<AccountState<unknown>> {
  return accounts.store(service);
}

function connectedServices(): TrackerId[] {
  return TRACKER_IDS.filter((service) => accountStore(service).get().status === 'logged-in');
}

/** Fiche ouverte au clic sur un titre ou une jaquette : comptes connectés et réglage « Fiche ouverte par défaut » */
function entryLinkContext(): EntryLinkContext {
  const state = settingsStore.get();
  return { connected: connectedServices(), preferred: state.status === 'ready' ? state.settings.entryService : DEFAULT_SETTINGS.entryService };
}

// ─── Actions des cartes "À vérifier" ────────────────────────────────────────

const reviewActions: ReviewActions = {
  async search(query) {
    try {
      return await sendMessage('SEARCH_ANIME', { query });
    } catch (error: unknown) {
      log.error('Service worker injoignable :', error);
      return { ok: false, code: 'NETWORK', message: swUnreachable() };
    }
  },
  async confirm(key, mediaId, progress) {
    try {
      return await sendMessage('RESOLVE_REVIEW', { key, mediaId, progress });
    } catch (error: unknown) {
      log.error('Service worker injoignable :', error);
      return { status: 'error', message: swUnreachable() };
    }
  },
  // Service worker : l'épisode mis de côté pendant une correction est rejoué après le retrait de la carte
  async dismiss(key) {
    const result = await sendMessage('DISMISS_REVIEW', { key });
    if (!result.ok) throw new Error(result.message);
  },
  async exclude(review) {
    // Fiche suggérée volontairement ignorée (par définition incertaine) : seule une fiche déjà écrite est reprise
    await excludeSeries({ platformKey: platformSeriesKey(review.episode), mediaId: review.previous?.mediaId ?? null, label: review.episode.animeTitle });
    // Série exclue : simple suppression, aucun épisode mis de côté n'est rejoué
    await deletePendingReview(review.key);
    await refreshReviewBadge();
  },
};

// ─── Mise en page ───────────────────────────────────────────────────────────
// En-tête, navigation et barre d'état fixes ; seule la zone centrale défile.
// Les écrans à état local (Activité, Réglages) sont masqués plutôt que recréés.

const headerSlot = h('div', { class: 'contents' });
const barSlot = h('div', { class: 'contents' });
const hostAccessSlot = h('div', { class: 'contents' });
const watchingSlot = h('div', { class: 'min-h-full' });
const onboardingSlot = h('div', { class: 'min-h-full' });
const reviewSection = createReviewSection(reviewActions);
const queueSlot = h('div', { class: 'contents' });
const ratingSlot = h('div', { class: 'contents' });
const recentSlot = h('div', { class: 'contents' });
const compareSlot = h('div', { class: 'contents' });
/** Activité › « Écarts AniList ↔ MAL » */
const compare = createCompareController({
  onApplied: () => void watching.reload(),
  onPauseTick: (job, at) => tickJobPause(compareSlot, job, at),
});
const activityScreen = h('div', { class: 'flex flex-col gap-4 pb-1' }, queueSlot, ratingSlot, reviewSection.element, recentSlot, compareSlot);
const settingsView = createSettingsView({
  navigateBack: () => goBack(),
  // Le popup se ferme de lui-même quand le nouvel onglet prend le focus
  openTab: (url) => void chrome.tabs.create({ url }),
  closesOnBlur: true,
  accounts,
});
const footerSlot = h('div', { class: 'contents' });
const main = h(
  'main',
  { class: 'sk-scroll min-h-0 flex-1 overflow-y-auto px-4 pt-1 pb-3' },
  watchingSlot,
  activityScreen,
  settingsView.element,
  onboardingSlot,
);
const root = getRoot();
root.replaceChildren(headerSlot, barSlot, hostAccessSlot, main, footerSlot);

// ─── Navigation ───────────────────────────────────────────────────────────

function navigate(screen: Screen, settingsPage: SettingsPage = 'home'): void {
  const ui = uiStore.get();
  if (ui.screen === screen) return;
  // Entrée dans les Réglages : accueil, ou sous-page demandée (pastille de compte → Comptes)
  if (screen === 'settings') settingsView.show(settingsPage);
  // Changement d'écran : les menus éventuellement ouverts se ferment
  uiStore.set({ ...ui, screen, previous: ui.screen === 'settings' ? ui.previous : ui.screen, sortMenuOpen: false, rowMenu: null, rowConfirm: null });
  main.scrollTop = 0;
}

function goBack(): void {
  navigate(uiStore.get().previous);
}

function toggleSettings(): void {
  if (uiStore.get().screen === 'settings') goBack();
  else navigate('settings');
}

// ─── Menu de tri « Mes séries » ─────────────────────────────────────────────
// Ouvert/fermé dans uiStore (survit aux nouveaux rendus) ; les écouteurs globaux
// (clic extérieur, Échap) n'existent que pendant l'ouverture.

function focusInWatching(selector: string): void {
  // Rendu en attente dessiné d'abord : l'élément visé doit déjà exister
  renderer.flush();
  watchingSlot.querySelector<HTMLElement>(selector)?.focus({ preventScroll: true });
}

function setSortMenu(open: boolean, restoreFocus = true): void {
  const ui = uiStore.get();
  if (ui.sortMenuOpen === open) return;
  // Un seul menu ouvert à la fois
  uiStore.set({ ...ui, sortMenuOpen: open, rowMenu: open ? null : ui.rowMenu, rowConfirm: open ? null : ui.rowConfirm });
  // focusInWatching dessine d'abord le rendu en attente : à l'ouverture, focus sur l'option cochée ; à la fermeture, retour au bouton
  if (open) focusInWatching('[role="menuitemradio"][aria-checked="true"]');
  else if (restoreFocus) focusInWatching('[data-focus="sort-trigger"]');
}

/** Choix de source : les menus ouverts se ferment, la liste du service choisi est chargée */
function pickSource(source: TrackerId): void {
  patchStore(uiStore, { sortMenuOpen: false, rowMenu: null, rowConfirm: null });
  void watching.pickSource(source);
}

function pickSort(sort: WatchingSort): void {
  patchStore(uiStore, { sortMenuOpen: false });
  void watching.pickSort(sort);
  focusInWatching('[data-focus="sort-trigger"]');
}

/** Menu « … » d'une série : ouverture = focus sur la première action, fermeture = retour au bouton */
function setRowMenu(key: string | null, restoreFocus = true): void {
  const ui = uiStore.get();
  if (ui.rowMenu === key) return;
  const previous = ui.rowMenu;
  uiStore.set({ ...ui, rowMenu: key, rowConfirm: null, sortMenuOpen: false });
  if (key !== null) {
    renderer.flush();
    const root = watchingSlot.querySelector<HTMLElement>(`[data-menu-root="${key}"]`);
    root?.querySelector<HTMLElement>('[role="menuitem"]:not(:disabled)')?.focus({ preventScroll: true });
    // Dernières lignes : le menu déborde vers le bas, on le ramène dans la zone visible
    root?.querySelector('[role="menu"]')?.scrollIntoView({ block: 'nearest' });
  } else if (restoreFocus && previous !== null) {
    focusInWatching(`[data-focus="more-${previous}"]`);
  }
}

/**
 * Confirmation dans le menu ouvert (Abandonner, Terminé, Retirer de la liste). Ouverture : focus sur « Non » / « Annuler »
 * (une action irréversible ne se valide pas d'un double Entrée) ; annulation : focus rendu à l'option d'origine.
 */
function setRowConfirm(status: RowConfirm | null): void {
  const ui = uiStore.get();
  if (ui.rowMenu === null || ui.rowConfirm === status) return;
  const previous = ui.rowConfirm;
  uiStore.set({ ...ui, rowConfirm: status });
  if (status !== null) {
    focusInWatching(`[data-focus="confirm-no-${ui.rowMenu}"]`);
    // Confirmation plus haute que l'option (retrait : deux lignes) : ramenée dans la zone visible en bas de liste
    watchingSlot.querySelector(`[data-menu-root="${ui.rowMenu}"] [role="group"]`)?.scrollIntoView({ block: 'nearest' });
  } else if (previous !== null) focusInWatching(`[data-focus="${previous}-${ui.rowMenu}"]`);
}

// ─── Commentaire d'une série (« Commentaire… » du menu « … ») ──────────────

/** Éditeur ouvert : élément persistant (brouillon et curseur gardés entre deux rendus), recréé pour une autre série */
let notesEditor: { key: string; editor: NotesEditor } | null = null;

function openNotes(entry: WatchingEntry): void {
  // Nouvelle ouverture : brouillon d'une ouverture précédente oublié (déjà ouvert : gardé)
  if (watching.notes.get()?.key !== entryKey(entry)) notesEditor = null;
  watching.openNotes(entry);
  // Focus dans la zone de texte (lecture seule le temps de lire le commentaire)
  focusInWatching(`[data-focus="notes-${entryKey(entry)}-input"]`);
  watchingSlot.querySelector(`[data-notes-row="${entryKey(entry)}"]`)?.scrollIntoView({ block: 'nearest' });
}

/** Fermeture (Annuler, Échap, enregistré) : focus rendu au bouton « … » de la série */
function closeNotes(): void {
  const key = watching.notes.get()?.key;
  watching.closeNotes();
  if (key !== undefined) focusInWatching(`[data-focus="more-${key}"]`);
}

function notesEditorFor(entry: WatchingEntry): HTMLElement | null {
  const session = watching.notes.get();
  if (!session || session.key !== entryKey(entry)) return null;
  if (notesEditor?.key !== session.key) {
    const { entry: target } = session;
    notesEditor = {
      key: session.key,
      editor: createNotesEditor({ focusKey: `notes-${session.key}`, collapsible: false, onSave: (text) => watching.saveNotes(target, text), onClose: closeNotes }),
    };
  }
  notesEditor.editor.update({
    notes: session.phase === 'ready' ? session.notes : null,
    loading: session.phase === 'loading',
    unavailable: session.phase === 'error' ? session.message : session.phase === 'ready' && !session.inList ? t('notes.notInList') : null,
    busy: watching.entryActions.get().get(session.key)?.phase === 'pending',
    title: session.entry.title,
  });
  return notesEditor.editor.element;
}

/**
 * Commentaire de la carte « Sur cette page », sous la note (même éditeur repliable que le panneau) : élément persistant,
 * brouillon oublié quand la carte change de fiche
 */
const pageNotesEditor = createNotesEditor({
  focusKey: 'page-notes',
  collapsible: true,
  onSave: async (notes) => (await pageCtl.runAction({ kind: 'notes', notes }))?.tone === 'success',
});
let pageNotesMediaId: number | null = null;

function pageNotesFor(view: PageMediaView, refreshing: boolean): HTMLElement | null {
  // Aucun compte connecté : rien à commenter (la carte invite déjà à se connecter)
  if (view.lists.length === 0) return null;
  if (pageNotesMediaId !== view.media.mediaId) {
    pageNotesMediaId = view.media.mediaId;
    pageNotesEditor.reset();
  }
  const primary = primaryList(view.lists);
  pageNotesEditor.update({
    notes: primary?.notes ?? null,
    loading: false,
    unavailable: primary ? null : t('notes.notInList'),
    busy: pageCtl.actions.busy !== null || refreshing,
    title: view.media.title,
  });
  return pageNotesEditor.element;
}

/** Écouteurs globaux (clic extérieur, Échap) présents seulement pendant qu'un menu est ouvert */
const menuDismiss = createMenuDismiss({
  onPointerDown(target) {
    const ui = uiStore.get();
    if (ui.sortMenuOpen && !target?.closest('[data-sort-root]')) setSortMenu(false, false);
    const rowRoot = target?.closest<HTMLElement>('[data-menu-root]');
    if (ui.rowMenu !== null && rowRoot?.dataset.menuRoot !== ui.rowMenu) setRowMenu(null, false);
  },
  onEscape() {
    const ui = uiStore.get();
    if (ui.sortMenuOpen) setSortMenu(false);
    if (ui.rowConfirm !== null) {
      // Échap annule d'abord la confirmation en cours, le menu reste ouvert
      setRowConfirm(null);
      return;
    }
    if (ui.rowMenu !== null) setRowMenu(null);
  },
});

// ─── Rendu ────────────────────────────────────────────────────────────────

function footerStatus(): FooterStatus {
  const connected = connectedServices();
  const expired = TRACKER_IDS.find((service) => {
    const state = accountStore(service).get();
    return state.status === 'logged-out' && state.expired;
  });
  const { reviews, recentSyncs } = syncStore.get();
  const { failed, pending } = queue.counts();

  // Priorité : synchros abandonnées, vérifications, relances en attente, session expirée
  if (connected.length > 0 && failed > 0) return { kind: 'queue-failed', count: failed };
  if (connected.length > 0 && reviews.length > 0) return { kind: 'pending', count: reviews.length };
  if (connected.length > 0 && pending > 0) return { kind: 'queue-pending', count: pending };
  if (expired) return { kind: 'expired', service: expired };
  if (connected.length === 0) return { kind: 'none' };
  // Priorité la plus basse : une note reportée n'empêche rien de fonctionner
  const toRate = ratings.store.get().items.length;
  if (toRate > 0) return { kind: 'to-rate', count: toRate };
  const latest = recentSyncs[0];
  return { kind: 'ok', relative: latest ? formatRelativeTime(latest.syncedAt, now) : null };
}

type FooterChip = { service: TrackerId; state: 'ok' | 'expired' };

function footerChips(): FooterChip[] {
  return TRACKER_IDS.flatMap((service): FooterChip[] => {
    const state = accountStore(service).get();
    if (state.status === 'logged-in') return [{ service, state: 'ok' }];
    if (state.status === 'logged-out' && state.expired) return [{ service, state: 'expired' }];
    return [];
  });
}

/** Onboarding : plus aucun chargement en cours et aucun compte connecté */
function isOnboarding(): boolean {
  return TRACKER_IDS.every((service) => accountStore(service).get().status === 'logged-out');
}

/** Entrées du rendu de « En cours » : on ne redessine la liste que si elles changent */
const watchingChanged = createLocaleMemo();

function renderWatching(): void {
  const preferredPlayer = (() => {
    const state = settingsStore.get();
    return state.status === 'ready' ? effectivePlayer(state.settings.preferredPlayer, platformAccessStore.get()) : DEFAULT_SETTINGS.preferredPlayer;
  })();
  const services = connectedServices();
  const { sortMenuOpen, rowMenu, rowConfirm } = uiStore.get();
  const { sort } = watching.prefs.get();
  const exclusions = exclusionsStore.get();
  const actions = watching.entryActions.get();
  const notice = watching.notice.get();
  const notesSession = watching.notes.get();
  const pageCard = pageCardStore.get();
  const optionalPlatforms = platformAccessStore.get() ?? [];
  const entryLinks = entryLinkContext();
  if (!watchingChanged([watching.store.get(), now, preferredPlayer, optionalPlatforms.join(), services.join(), entryLinks.preferred, sort, sortMenuOpen, rowMenu, rowConfirm, exclusions, actions, notice, notesSession, pageCard])) return;

  preserveFocus(watchingSlot, () =>
    watchingSlot.replaceChildren(
      renderWatchingScreen({
        state: watching.store.get(),
        notice: notice?.feedback ?? null,
        onNoticeRetry: notice?.retry ?? null,
        now,
        preferredPlayer,
        services,
        onPickSource: (source) => pickSource(source),
        sort,
        sortMenuOpen,
        onSortMenu: (open) => setSortMenu(open),
        onPickSort: (value) => pickSort(value),
        onRetry: () => void watching.reload(),
        optionalPlatforms,
        onOpenSyncSettings: () => navigate('settings', 'sync'),
        pageCard: renderPageMediaCard({
          card: pageCard,
          now,
          entryLinks,
          onRetry: () => pageCtl.retry(),
          onAdd: (status) => void pageCtl.runAction({ kind: 'add', status }),
          onAdjust: (delta) => void pageCtl.runAction({ kind: 'adjust', delta }),
          onRetryAdjust: (retry) => void pageCtl.runAction({ kind: 'adjust', delta: retry.delta, retry }),
          onConfirm: (status) => setPageConfirm(status),
          onSetStatus: (status) => void pageCtl.runAction({ kind: 'status', status }),
          onRate: (value) => void pageCtl.runAction({ kind: 'rate', value }),
          onPickSeason: (mediaId) => pageCtl.pickSeason(mediaId),
          notesFor: pageNotesFor,
        }),
        controls: {
          actions,
          excludedMediaIds: new Set(exclusions.status === 'ready' ? exclusions.items.flatMap((e) => (e.mediaId !== null ? [e.mediaId] : [])) : []),
          rowMenu,
          rowConfirm,
          onRowConfirm: (status) => setRowConfirm(status),
          onSetStatus: (entry, status) => void watching.setStatus(entry, status),
          onRowMenu: (key) => setRowMenu(key),
          onAdjust: (entry, delta) => void watching.adjust(entry, delta),
          onExclude: (entry) => void watching.exclude(entry),
          onInclude: (entry) => void watching.include(entry),
          onRemove: (entry) => void watching.remove(entry),
          onNotes: (entry) => openNotes(entry),
          notesFor: notesEditorFor,
          entryLinks,
        },
      }),
    ),
  );
  // Menu ouvert mais contrôle absent (liste vide, chargement, erreur, série disparue) : on le referme après ce rendu
  if (sortMenuOpen && !watchingSlot.querySelector('[data-sort-root]')) queueMicrotask(() => setSortMenu(false, false));
  if (rowMenu !== null && !watchingSlot.querySelector(`[data-menu-root="${rowMenu}"]`)) queueMicrotask(() => setRowMenu(null, false));
}

/** Section « À noter » redessinée seulement si son état change (préserve le survol des étoiles) */
const ratingsChanged = createLocaleMemo();

function renderRatings(): void {
  const connected = connectedServices().length > 0;
  const entryLinks = entryLinkContext();
  if (!ratingsChanged([ratings.store.get(), connected, now, entryLinks.connected.join(), entryLinks.preferred])) return;
  ratingSlot.replaceChildren(
    ...nodes([
      connected &&
        renderRatingSection({
          ratings: ratings.store.get(),
          now,
          onRate: (item, value) => void ratings.rate(item, value),
          onIgnore: (item) => void ratings.ignore(item),
          entryLinks,
        }),
    ]),
  );
}

/**
 * Section « Écarts » redessinée seulement si son état change (jusqu'à 30+ lignes). Le compte à rebours d'une pause
 * d'alignement n'en fait pas partie : il est mis à jour en place chaque seconde (tickJobPause).
 */
const compareChanged = createLocaleMemo();

function renderCompare(): void {
  const both = connectedServices().length === 2;
  const entryLinks = entryLinkContext();
  if (!compareChanged([compare.store.get(), both, now, entryLinks.preferred])) return;
  compareSlot.replaceChildren(
    ...nodes([
      both &&
        renderCompareSection({
          state: compare.store.get(),
          now,
          onAnalyze: () => void compare.analyze(),
          onApply: (diffs, source) => void compare.apply(diffs, source),
          onConfirm: (source) => compare.setConfirm(source),
          onFilter: (filter) => compare.setFilter(filter),
          onCancel: () => void compare.cancel(),
          onDismissJob: () => void compare.dismissJob(),
          onRetryFailed: (diffs, source) => void compare.apply(diffs, source),
          onShowMore: () => compare.showMore(),
          entryLinks,
        }),
    ]),
  );
}

// Chaque zone n'est redessinée que si ses entrées changent : focus, survol et régions live (bandeau d'accès,
// barre d'état) restent en place entre deux rendus
const headerChanged = createLocaleMemo();
const navChanged = createLocaleMemo();
const hostAccessChanged = createLocaleMemo();
const onboardingChanged = createLocaleMemo();
const queueChanged = createLocaleMemo();
const recentChanged = createLocaleMemo();
const footerChanged = createLocaleMemo();

function render(): void {
  const ui = uiStore.get();
  const onboarding = isOnboarding();
  const isSettings = ui.screen === 'settings';
  const data = syncStore.get();
  const connected = connectedServices().length > 0;
  // Pastille « Activité » : vérifications + synchros abandonnées + séries à noter (à traiter par l'utilisateur)
  const pending = connected ? data.reviews.length + queue.counts().failed + ratings.store.get().items.length : 0;
  const hostAccess = hostAccessStore.get();

  preserveFocus(root, () => {
    if (headerChanged([isSettings, panelTarget])) {
      headerSlot.replaceChildren(renderHeader({ isSettings, onSettings: toggleSettings, onOpenPanel: panelTarget === null ? null : openPanel }));
    }
    const navStale = navChanged([isSettings, onboarding, ui.screen, pending]);
    // Barre des Réglages persistante (gérée par la vue) : jamais retirée puis réinsérée, le focus y resterait perdu
    if (isSettings) {
      if (barSlot.firstChild !== settingsView.bar || barSlot.childNodes.length !== 1) barSlot.replaceChildren(settingsView.bar);
    } else if (navStale) {
      barSlot.replaceChildren(
        ...nodes([!onboarding && renderNav({ screen: ui.screen === 'activity' ? 'activity' : 'watching', pending, onNavigate: (screen) => navigate(screen) })]),
      );
    }

    // Bandeau d'accès : même nœud tant que son contenu ne change pas (pas de nouvelle annonce à chaque rendu)
    if (hostAccessChanged([hostAccess.status, hostAccess.status === 'missing' && hostAccess.denied])) {
      hostAccessSlot.replaceChildren(...nodes([renderHostAccessBanner({ state: hostAccess, onAllow: allowHostAccess })]));
    }

    watchingSlot.hidden = isSettings || onboarding || ui.screen !== 'watching';
    activityScreen.hidden = isSettings || onboarding || ui.screen !== 'activity';
    settingsView.element.hidden = !isSettings;
    onboardingSlot.hidden = isSettings || !onboarding;

    if (!watchingSlot.hidden) renderWatching();
    if (!onboardingSlot.hidden && onboardingChanged([anilistStore.get(), malStore.get()])) {
      onboardingSlot.replaceChildren(
        renderOnboarding({ anilist: anilistStore.get(), mal: malStore.get(), onLogin: (service) => void accounts.login(service) }),
      );
    }

    if (queueChanged([connected, queue.store.get(), now])) {
      queueSlot.replaceChildren(
        ...nodes([
          connected &&
            renderQueueSection({
              queue: queue.store.get(),
              now,
              onRetry: (id) => void queue.retry(id),
              onAbandon: (id) => void queue.abandon(id),
            }),
        ]),
      );
    }
    renderRatings();
    renderCompare();
    reviewSection.update(connected ? data.reviews : []);
    const entryLinks = entryLinkContext();
    if (recentChanged([data.recentSyncs, data.reviews, data.busyKey, data.recentError, exclusionsStore.get(), entryLinks.connected.join(), entryLinks.preferred])) {
      recentSlot.replaceChildren(
        renderRecentSyncs({
          syncs: data.recentSyncs,
          pendingKeys: new Set(data.reviews.map((r) => r.key)),
          busyKey: data.busyKey,
          error: data.recentError,
          onCorrect: (key) => void handleCorrect(key),
          isExcluded: isRecentExcluded,
          onExclude: (sync) => void excludeRecent(sync),
          entryLinks,
        }),
      );
    }

    // Barre d'état (role="status") : comparée sur son contenu, pas sur l'identité des objets recalculés
    const chips = footerChips();
    const status = footerStatus();
    if (footerChanged([JSON.stringify(chips), JSON.stringify(status)])) {
      footerSlot.replaceChildren(
        renderFooter({
          version,
          chips,
          status,
          onOpenSettings: () => navigate('settings', 'accounts'),
          onOpenActivity: () => navigate('activity'),
          onReconnect: (service) => void accounts.login(service),
        }),
      );
    }
  });
}

/** Rendus regroupés : plusieurs stores modifiés dans le même tour (chargements parallèles, job) = un seul rendu */
const renderer = createRenderScheduler(render);

// ─── Accès aux sites (Firefox) et accès Netflix / Disney+ (optionnels) ─────

async function checkHostAccess(): Promise<void> {
  const optional = await grantedOptionalPlatforms();
  if (platformAccessStore.get()?.join() !== optional.join()) platformAccessStore.set(optional);
  const granted = await hasHostAccess(hostOrigins);
  const current = hostAccessStore.get();
  hostAccessStore.set(granted ? { status: 'granted' } : { status: 'missing', denied: current.status === 'missing' && current.denied });
}

/** Clic « Autoriser l'accès » : `permissions.request` appelé immédiatement (geste utilisateur requis par Firefox) */
function allowHostAccess(): void {
  requestHostAccess(hostOrigins).then(
    (granted) => {
      if (granted) void checkHostAccess();
      else hostAccessStore.set({ status: 'missing', denied: true });
    },
    (error: unknown) => {
      log.warn('Demande d’accès aux sites impossible :', error);
      hostAccessStore.set({ status: 'missing', denied: true });
    },
  );
}

// ─── Exclusions (pastille « Exclue » des dernières synchros et de « En cours ») ───

/** Clé de série plateforme, sans faire échouer le rendu si elle est incalculable */
function seriesKeyOrNull(episode: EpisodeInfo): string | null {
  try {
    return platformSeriesKey(episode);
  } catch {
    return null;
  }
}

function isRecentExcluded(sync: RecentSync): boolean {
  const exclusions = exclusionsStore.get();
  if (exclusions.status !== 'ready' || exclusions.items.length === 0) return false;
  const platformKey = seriesKeyOrNull(sync.episode);
  return exclusions.items.some((e) => e.mediaId === sync.mediaId || (e.platformKey !== null && e.platformKey === platformKey));
}

async function excludeRecent(sync: RecentSync): Promise<void> {
  let error: string | null = null;
  try {
    await excludeSeries({ platformKey: platformSeriesKey(sync.episode), mediaId: sync.mediaId, label: sync.episode.animeTitle });
  } catch (e: unknown) {
    log.error('Exclusion de la série impossible :', e);
    error = t('common.excludeFailed');
  }
  patchStore(syncStore, { recentError: error });
  await loadExclusions();
}

async function loadExclusions(): Promise<void> {
  try {
    exclusionsStore.set({ status: 'ready', items: await getExcludedSeries() });
  } catch (error: unknown) {
    log.error('Lecture des séries exclues impossible :', error);
    exclusionsStore.set({ status: 'error' });
  }
}

// ─── Carte « Sur cette page » (série de l'onglet actif) ────────────────────
// Le content script de l'onglet actif décrit la page ; le service worker résout la fiche AniList. Machine d'état
// commune avec le panneau (ui/page-media-controller.ts). Tout est asynchrone : sans réponse (autre site, onglet
// ouvert avant le rechargement de l'extension), la carte « Reprendre » reste affichée.

/** Onglet actif et sa fenêtre (ni l'un ni l'autre ne requiert la permission "tabs") */
async function queryActiveTab(): Promise<{ tabId: number | null; windowId: number | null }> {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    return { tabId: tab?.id ?? null, windowId: tab?.windowId ?? null };
  } catch (error: unknown) {
    log.debug('Onglet actif illisible :', error);
    return { tabId: null, windowId: null };
  }
}

/** Lancées dès l'ouverture du popup, en parallèle de la lecture des comptes */
const activeTab = queryActiveTab();
/** Série ou épisode de l'onglet actif (mêmes essais et délais que le panneau) */
const activePage: Promise<PageMediaInfo | null> = activeTab.then(async ({ tabId }) => {
  if (tabId === null) return null;
  const page = await detectPageMedia(tabId);
  return page === 'unreachable' ? null : page;
});

const pageCtl = createPageMediaController({
  onChange: () => pageCardStore.set({ content: pageCtl.content, actions: pageCtl.actions }),
  onActionDone: () => watching.scheduleRevalidation(),
});

// ─── Panneau latéral : bouton d'en-tête, sur toutes les pages ───
// Le panneau suit l'onglet actif : « En lecture » sur une page de streaming, Agenda ailleurs.

/** Onglet actif (et sa fenêtre) pour lequel le bouton « Ouvrir le panneau » est proposé ; null sans API de panneau */
let panelTarget: PanelTarget | null = null;

void activeTab.then(({ tabId, windowId }) => {
  if (sidePanelKind() === null || (tabId === null && windowId === null)) return;
  panelTarget = { tabId: tabId ?? undefined, windowId: windowId ?? undefined };
  renderer.schedule();
});

/** Clic : aucun `await` avant l'ouverture (geste utilisateur requis par sidePanel.open / sidebarAction.open) */
function openPanel(): void {
  if (panelTarget === null) return;
  openSidePanel(panelTarget).then(
    () => window.close(),
    (error: unknown) => log.warn('Ouverture du panneau impossible :', error),
  );
}

let pageStarted = false;

/** Premier chargement, dès qu'un service est connecté (l'écran « En cours » devient visible) */
function startPageMedia(): void {
  if (pageStarted) return;
  pageStarted = true;
  void Promise.all([activeTab, activePage]).then(([{ tabId }, page]) => {
    if (tabId !== null && page) pageCtl.open(tabId, page);
  });
}

/**
 * Confirmation Abandonner / Terminé de la carte. Ouverture : focus sur « Non » (une action
 * irréversible ne se valide pas d'un double Entrée) ; annulation : focus rendu au bouton d'origine.
 */
function setPageConfirm(status: ListStatusChange | null): void {
  const previous = pageCtl.actions.confirm;
  if (!pageCtl.setConfirm(status)) return;
  if (status !== null) focusInWatching('[data-focus="confirm-no-page"]');
  else if (previous !== null) focusInWatching(`[data-focus="page-status-${previous}"]`);
}

// ─── Données de synchro ───────────────────────────────────────────────────

/** "Corriger" : le service worker recharge les fiches candidates et rouvre une carte. */
async function handleCorrect(key: string): Promise<void> {
  patchStore(syncStore, { busyKey: key, recentError: null });
  let error: string | null = null;
  try {
    const result = await sendMessage('REOPEN_REVIEW', { key });
    if (!result.ok) error = result.message;
    else navigate('activity');
  } catch (e: unknown) {
    log.error('Service worker injoignable :', e);
    error = swUnreachable();
  }
  patchStore(syncStore, { busyKey: null, recentError: error });
}

async function loadSyncData(): Promise<void> {
  const [reviews, recentSyncs] = await Promise.all([getPendingReviews(), getRecentSyncs()]);
  patchStore(syncStore, { reviews, recentSyncs });
}

async function loadSettings(): Promise<void> {
  try {
    settingsStore.set({ status: 'ready', settings: await getSettings() });
  } catch (error: unknown) {
    log.error('Lecture des réglages impossible :', error);
    settingsStore.set({ status: 'error' });
  }
}

// ─── Synchronisation avec le stockage ──────────────────────────────────────
// La popup se ferme souvent pendant l'OAuth, et le service worker peut invalider une session
// ou ajouter des vérifications : on suit donc les changements du stockage.

chrome.storage.onChanged.addListener((changes, areaName): void => {
  if (areaName !== 'local') return;
  // Sessions et profils : suivis par le contrôleur des comptes (ui/accounts.ts)

  if (changes[STORAGE_KEYS.pendingReviews] || changes[STORAGE_KEYS.recentSyncs]) void loadSyncData();

  const settingsChange = changes[SETTINGS_STORAGE_KEY];
  if (settingsChange) settingsStore.set({ status: 'ready', settings: normalizeSettings(settingsChange.newValue) });

  if (changes[EXCLUDED_SERIES_KEY]) void loadExclusions();
});

// ─── Démarrage ────────────────────────────────────────────────────────────

watching.start();
uiStore.subscribe(({ sortMenuOpen, rowMenu }) => menuDismiss.setOpen(sortMenuOpen || rowMenu !== null));
for (const store of [anilistStore, malStore, syncStore, uiStore, watching.store, watching.prefs, watching.entryActions, watching.notice, watching.notes, queue.store, ratings.store, pageCardStore, compare.store, hostAccessStore, platformAccessStore]) store.subscribe(renderer.schedule);
// Accès accordé ou retiré pendant que le popup est ouvert (about:addons, autre fenêtre)
chrome.permissions?.onAdded?.addListener(() => void checkHostAccess());
chrome.permissions?.onRemoved?.addListener(() => void checkHostAccess());
exclusionsStore.subscribe(renderer.schedule);
settingsStore.subscribe(renderer.schedule);

// Nouvelle langue : retraduction en place (écran, sous-page des Réglages et défilement conservés). Chaque zone a la
// langue dans son mémo ; les Réglages se retraduisent eux-mêmes (settings-view.ts)
onLocaleChange(() => renderer.schedule());

// Les comptes à rebours et « il y a… » vieillissent tant que le popup reste ouvert
setInterval(() => {
  now = Date.now();
  renderer.schedule();
}, CLOCK_TICK_MS);

void checkHostAccess();
void loadSettings();
void loadSyncData();
void loadExclusions();
void queue.load();
void ratings.load();
void compare.load();
// La source préférée est lue avant les comptes : évite de charger la mauvaise liste puis de basculer
void watching.loadPrefs().then(() => accounts.bootstrapAll());
