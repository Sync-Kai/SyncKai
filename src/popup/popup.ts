import { initI18n, onLocaleChange, t } from '../i18n';
import { refreshReviewBadge } from '../shared/badge';
import type { EpisodeInfo } from '../shared/episode.types';
import { EXCLUDED_SERIES_KEY, excludeSeries, getExcludedSeries, platformSeriesKey } from '../shared/exclusions';
import { sendMessage } from '../shared/messages';
import type { RecentSync } from '../shared/review.types';
import { DEFAULT_SETTINGS, effectivePlayer, getSettings, normalizeSettings, SETTINGS_STORAGE_KEY } from '../shared/settings';
import { hasNetflixAccess } from '../shared/netflix-access';
import { deletePendingReview, getPendingReviews, getRecentSyncs } from '../shared/storage';
import { STORAGE_KEYS } from '../shared/storage-keys';
import type { ListStatusChange } from '../shared/sync.types';
import type { PageMediaInfo } from '../shared/page-media.types';
import { TRACKER_IDS, type TrackerId } from '../shared/tracker.types';
import { formatRelativeTime } from '../shared/watching';
import type { WatchingSort } from '../shared/watching.types';
import { createMemo, createRenderScheduler, h, nodes, preserveFocus } from '../ui/dom';
import { tickJobPause } from '../ui/job-pause';
import { createMenuDismiss } from '../ui/menu';
import { createPageMediaController, detectPageMedia } from '../ui/page-media-controller';
import { hasHostAccess, requestHostAccess, requiredOrigins } from '../shared/host-access';
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
import { renderWatchingScreen } from './components/watching-screen';
import type { HostAccessState, PageCardState, Screen, SettingsState, SyncData, UiState } from './state';
import { createStore, patchStore, type AccountState, type ExclusionsState, type Store } from '../ui/state';
import { createLogger } from '../shared/logger';
import { openSidePanel, sidePanelKind } from '../shared/side-panel';
import { isTargetPage } from '../shared/target-pages';
import { createAccountsController } from '../ui/accounts';
import { isSettingsPage, type SettingsPage } from '../ui/settings/navigation';
import { createSettingsView } from '../ui/settings/settings-view';

const log = createLogger('popup');

// Langue lue avant le premier rendu : toutes les vues sont construites directement dans la bonne langue
await initI18n();

const swUnreachable = (): string => t('popup.swUnreachable');
/** Écran (et défilement) à rouvrir après le rechargement provoqué par un changement de langue */
const REOPEN_KEY = 'synckai:reopen';
const CLOCK_TICK_MS = 60_000;

interface ReopenState {
  screen: Screen;
  /** Sous-page des Réglages affichée (changement de langue depuis Réglages › Langue) */
  settingsPage: SettingsPage;
  scroll: number;
}

/** Écran mémorisé avant un changement de langue (lu une seule fois) */
function takeReopenState(): ReopenState | null {
  try {
    const raw = sessionStorage.getItem(REOPEN_KEY);
    sessionStorage.removeItem(REOPEN_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    if (typeof parsed !== 'object' || parsed === null || !('screen' in parsed) || !('scroll' in parsed)) return null;
    const { screen, scroll } = parsed;
    const settingsPage = 'settingsPage' in parsed && isSettingsPage(parsed.settingsPage) ? parsed.settingsPage : 'home';
    const valid = screen === 'watching' || screen === 'activity' || screen === 'settings';
    return valid && typeof scroll === 'number' ? { screen, settingsPage, scroll } : null;
  } catch {
    return null;
  }
}

const reopen = takeReopenState();

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
const uiStore = createStore<UiState>({ screen: reopen?.screen ?? 'watching', previous: 'watching', sortMenuOpen: false, rowMenu: null, rowConfirm: null });
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
/** Accès Netflix (permission optionnelle) : lecteur préféré « Netflix » ignoré sans lui ; undefined = pas encore lu */
const netflixAccessStore = createStore<boolean | undefined>(undefined);
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
  // Pas besoin du service worker : simple suppression dans le stockage
  async dismiss(key) {
    await deletePendingReview(key);
    await refreshReviewBadge();
  },
  async exclude(review) {
    // Fiche suggérée volontairement ignorée (par définition incertaine) : seule une fiche déjà écrite est reprise
    await excludeSeries({ platformKey: platformSeriesKey(review.episode), mediaId: review.previous?.mediaId ?? null, label: review.episode.animeTitle });
    await reviewActions.dismiss(review.key);
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
 * Confirmation dans le menu ouvert (Abandonner, Terminé). Ouverture : focus sur « Non » (une action
 * irréversible ne se valide pas d'un double Entrée) ; annulation : focus rendu à l'option d'origine.
 */
function setRowConfirm(status: ListStatusChange | null): void {
  const ui = uiStore.get();
  if (ui.rowMenu === null || ui.rowConfirm === status) return;
  const previous = ui.rowConfirm;
  uiStore.set({ ...ui, rowConfirm: status });
  if (status !== null) focusInWatching(`[data-focus="confirm-no-${ui.rowMenu}"]`);
  else if (previous !== null) focusInWatching(`[data-focus="${previous}-${ui.rowMenu}"]`);
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
const watchingChanged = createMemo();

function renderWatching(): void {
  const preferredPlayer = (() => {
    const state = settingsStore.get();
    return state.status === 'ready' ? effectivePlayer(state.settings.preferredPlayer, netflixAccessStore.get()) : DEFAULT_SETTINGS.preferredPlayer;
  })();
  const services = connectedServices();
  const { sortMenuOpen, rowMenu, rowConfirm } = uiStore.get();
  const { sort } = watching.prefs.get();
  const exclusions = exclusionsStore.get();
  const actions = watching.entryActions.get();
  const notice = watching.notice.get();
  const pageCard = pageCardStore.get();
  const netflixAccess = netflixAccessStore.get() === true;
  if (!watchingChanged([watching.store.get(), now, preferredPlayer, netflixAccess, services.join(), sort, sortMenuOpen, rowMenu, rowConfirm, exclusions, actions, notice, pageCard])) return;

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
        netflixAccess,
        onOpenSyncSettings: () => navigate('settings', 'sync'),
        pageCard: renderPageMediaCard({
          card: pageCard,
          now,
          onRetry: () => pageCtl.retry(),
          onAdd: (status) => void pageCtl.runAction({ kind: 'add', status }),
          onAdjust: (delta) => void pageCtl.runAction({ kind: 'adjust', delta }),
          onRetryAdjust: (retry) => void pageCtl.runAction({ kind: 'adjust', delta: retry.delta, retry }),
          onConfirm: (status) => setPageConfirm(status),
          onSetStatus: (status) => void pageCtl.runAction({ kind: 'status', status }),
          onRate: (value) => void pageCtl.runAction({ kind: 'rate', value }),
          onPickSeason: (mediaId) => pageCtl.pickSeason(mediaId),
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
        },
      }),
    ),
  );
  // Menu ouvert mais contrôle absent (liste vide, chargement, erreur, série disparue) : on le referme après ce rendu
  if (sortMenuOpen && !watchingSlot.querySelector('[data-sort-root]')) queueMicrotask(() => setSortMenu(false, false));
  if (rowMenu !== null && !watchingSlot.querySelector(`[data-menu-root="${rowMenu}"]`)) queueMicrotask(() => setRowMenu(null, false));
}

/** Section « À noter » redessinée seulement si son état change (préserve le survol des étoiles) */
const ratingsChanged = createMemo();

function renderRatings(): void {
  const connected = connectedServices().length > 0;
  if (!ratingsChanged([ratings.store.get(), connected, now])) return;
  ratingSlot.replaceChildren(
    ...nodes([
      connected &&
        renderRatingSection({
          ratings: ratings.store.get(),
          now,
          onRate: (item, value) => void ratings.rate(item, value),
          onIgnore: (item) => void ratings.ignore(item),
        }),
    ]),
  );
}

/**
 * Section « Écarts » redessinée seulement si son état change (jusqu'à 30+ lignes). Le compte à rebours d'une pause
 * d'alignement n'en fait pas partie : il est mis à jour en place chaque seconde (tickJobPause).
 */
const compareChanged = createMemo();

function renderCompare(): void {
  const both = connectedServices().length === 2;
  if (!compareChanged([compare.store.get(), both, now])) return;
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
        }),
    ]),
  );
}

// Chaque zone n'est redessinée que si ses entrées changent : focus, survol et régions live (bandeau d'accès,
// barre d'état) restent en place entre deux rendus
const headerChanged = createMemo();
const navChanged = createMemo();
const hostAccessChanged = createMemo();
const onboardingChanged = createMemo();
const queueChanged = createMemo();
const recentChanged = createMemo();
const footerChanged = createMemo();

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
    if (headerChanged([isSettings, panelTabId])) {
      headerSlot.replaceChildren(renderHeader({ isSettings, onSettings: toggleSettings, onOpenPanel: panelTabId === null ? null : openPanel }));
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
    if (recentChanged([data.recentSyncs, data.reviews, data.busyKey, data.recentError, exclusionsStore.get()])) {
      recentSlot.replaceChildren(
        renderRecentSyncs({
          syncs: data.recentSyncs,
          pendingKeys: new Set(data.reviews.map((r) => r.key)),
          busyKey: data.busyKey,
          error: data.recentError,
          onCorrect: (key) => void handleCorrect(key),
          isExcluded: isRecentExcluded,
          onExclude: (sync) => void excludeRecent(sync),
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

// ─── Accès aux sites (Firefox) et accès Netflix (optionnel) ─────────────────

async function checkHostAccess(): Promise<void> {
  const netflix = await hasNetflixAccess();
  if (netflixAccessStore.get() !== netflix) netflixAccessStore.set(netflix);
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

/** Onglet actif (l'id ne requiert pas la permission "tabs" ; l'URL, seulement visible avec une permission d'hôte) */
async function queryActiveTab(): Promise<{ tabId: number | null; url: string | undefined }> {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    return { tabId: tab?.id ?? null, url: tab?.url };
  } catch (error: unknown) {
    log.debug('Onglet actif illisible :', error);
    return { tabId: null, url: undefined };
  }
}

/** Lancées dès l'ouverture du popup, en parallèle de la lecture des comptes */
const activeTab = queryActiveTab();
/** Série ou épisode de l'onglet actif (mêmes essais et délais que le panneau) */
const activePage: Promise<PageMediaInfo | null> = activeTab.then(async ({ tabId }) => {
  if (tabId === null) return null;
  const page = await detectPageMedia(tabId, { onReached: () => offerPanel(tabId) });
  return page === 'unreachable' ? null : page;
});

const pageCtl = createPageMediaController({
  onChange: () => pageCardStore.set({ content: pageCtl.content, actions: pageCtl.actions }),
  onActionDone: () => watching.scheduleRevalidation(),
});

// ─── Panneau latéral : bouton d'en-tête, seulement sur Crunchyroll / ADN ───

/** Onglet Crunchyroll / ADN actif pour lequel le bouton « Ouvrir le panneau » est proposé */
let panelTabId: number | null = null;

/** Script de contenu joignable, ou URL reconnue (onglet ouvert avant l'installation : script absent) */
function offerPanel(tabId: number): void {
  if (panelTabId === tabId || sidePanelKind() === null) return;
  panelTabId = tabId;
  renderer.schedule();
}

void activeTab.then(({ tabId, url }) => {
  if (tabId !== null && isTargetPage(url)) offerPanel(tabId);
});

/** Clic : aucun `await` avant l'ouverture (geste utilisateur requis par sidePanel.open / sidebarAction.open) */
function openPanel(): void {
  if (panelTabId === null) return;
  openSidePanel(panelTabId).then(
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
for (const store of [anilistStore, malStore, syncStore, uiStore, watching.store, watching.prefs, watching.entryActions, watching.notice, queue.store, ratings.store, pageCardStore, compare.store, hostAccessStore, netflixAccessStore]) store.subscribe(renderer.schedule);
// Accès accordé ou retiré pendant que le popup est ouvert (about:addons, autre fenêtre)
chrome.permissions?.onAdded?.addListener(() => void checkHostAccess());
chrome.permissions?.onRemoved?.addListener(() => void checkHostAccess());
exclusionsStore.subscribe(renderer.schedule);
settingsStore.subscribe(renderer.schedule);

// Après un changement de langue : même sous-page des Réglages, défilement restauré une fois les réglages dessinés
if (reopen?.screen === 'settings') {
  settingsView.show(reopen.settingsPage, { focus: false });
  void settingsView.ready.then(() => {
    main.scrollTop = reopen.scroll;
  });
}

// Nouvelle langue : le popup est rechargé (toutes les vues reconstruites) en revenant au même écran
onLocaleChange(() => {
  try {
    const state: ReopenState = { screen: uiStore.get().screen, settingsPage: settingsView.page(), scroll: main.scrollTop };
    sessionStorage.setItem(REOPEN_KEY, JSON.stringify(state));
  } catch {
    // Stockage de session indisponible : retour à l'écran d'accueil du popup
  }
  location.reload();
});

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
