import { initI18n, onLocaleChange, t } from '../i18n';
import { COMPARE_STORAGE_KEY, isComparisonResult, type ApplyResult, type CompareResult, type ListDiff } from '../shared/compare';
import { COMPARE_JOB_KEY, isCompareJob } from '../shared/compare-job';
import { withStorageLock } from '../shared/storage-lock';
import { AIRING_RESULT_KEY, isAiringCheckResult, type AiringCheckResult } from '../shared/airing.types';
import { isAniListViewer, type ViewerErrorCode, type ViewerResult } from '../shared/anilist.types';
import { isAniListToken, type AuthResult } from '../shared/auth.types';
import { refreshReviewBadge } from '../shared/badge';
import type { PendingRating } from '../shared/engagement.types';
import type { EpisodeInfo } from '../shared/episode.types';
import { EXCLUDED_SERIES_KEY, excludeSeries, getExcludedSeries, includeSeries, platformSeriesKey } from '../shared/exclusions';
import { isMalViewer, type MalViewerResult } from '../shared/mal.types';
import { sendMessage } from '../shared/messages';
import type { RecentSync } from '../shared/review.types';
import { DEFAULT_SETTINGS, getSettings, normalizeSettings, SETTINGS_STORAGE_KEY } from '../shared/settings';
import {
  clearAniListSession,
  clearMalSession,
  clearUserSyncData,
  deletePendingReview,
  getCachedMalViewer,
  getCachedViewer,
  getCachedWatching,
  getMalToken,
  getPendingReviews,
  getRecentSyncs,
  getValidToken,
  STORAGE_KEYS,
} from '../shared/storage';
import { getSyncQueue, removeQueueItem, SYNC_QUEUE_KEY } from '../shared/sync-queue-store';
import type { ListStatusChange, SyncOutcome } from '../shared/sync.types';
import { isPageMediaResponse, type ContentMessage } from '../shared/content-messages';
import type { PageMediaInfo, PageMediaResult } from '../shared/page-media.types';
import { isTrackerId, TRACKER_IDS, TRACKER_LABELS, type TrackerId } from '../shared/tracker.types';
import { formatRelativeTime } from '../shared/watching';
import { parsePlatformLinkStore, PLATFORM_LINKS_KEY, withLearnedLinks } from '../shared/platform-links';
import { DEFAULT_WATCHING_SORT, isWatchingSort, type WatchingEntry, type WatchingResult, type WatchingSort } from '../shared/watching.types';
import { h, nodes, preserveFocus } from '../ui/dom';
import { formatStarValue } from '../ui/rating';
import { mediaActionKey, runMediaAction, type MediaActionRequest } from '../ui/media-action-requests';
import { hasHostAccess, requestHostAccess, requiredOrigins } from '../shared/host-access';
import { renderFooter, type FooterStatus } from './components/footer';
import { renderHostAccessBanner } from './components/host-access-banner';
import { renderHeader, renderNav, renderSettingsBar } from './components/header';
import { renderOnboarding } from './components/onboarding';
import { COMPARE_PAGE_SIZE, renderCompareSection } from './components/compare-section';
import { renderQueueSection } from './components/queue-section';
import { renderRatingSection } from './components/rating-section';
import { renderRecentSyncs } from './components/recent-syncs';
import type { ReviewActions } from './components/review-card';
import { createReviewSection } from './components/review-section';
import { createSettingsScreen } from './components/settings-screen';
import { renderPageMediaCard } from './components/page-media-card';
import { entryKey, renderWatchingScreen } from './components/watching-screen';
import { adjustFeedback, errorFeedback, ratingFeedback, retryFeedback, statusFeedback } from './feedback';
import { getPendingRatings, PENDING_RATINGS_KEY, removePendingRating } from './pending-ratings';
import {
  createStore,
  LOGGED_OUT,
  type AccountState,
  type AniListState,
  type CompareState,
  type EntryAction,
  type ExclusionsState,
  type HostAccessState,
  type InlineFeedback,
  type QueueState,
  type RatingsState,
  type MalState,
  type PageCardState,
  type Screen,
  type SettingsState,
  type Store,
  type SyncData,
  type UiState,
  type WatchingState,
} from './state';
import { createLogger } from '../shared/logger';
import { openSidePanel, sidePanelKind } from '../shared/side-panel';
import { isTargetPage } from '../shared/target-pages';

const log = createLogger('popup');

// Langue lue avant le premier rendu : toutes les vues sont construites directement dans la bonne langue
await initI18n();

const swUnreachable = (): string => t('popup.swUnreachable');
/** Écran (et défilement) à rouvrir après le rechargement provoqué par un changement de langue */
const REOPEN_KEY = 'synckai:reopen';
/** Erreurs qui invalident la session : « Session expirée » + reconnexion */
const AUTH_ERRORS: ReadonlySet<ViewerErrorCode> = new Set(['NOT_AUTHENTICATED', 'TOKEN_INVALID']);
const PREFS_KEY = 'popupPrefs';
const CLOCK_TICK_MS = 60_000;
/** Durée d'affichage du retour d'une action sur une série (+1, −1, exclusion) */
const ENTRY_FEEDBACK_MS = 3_000;
const QUEUE_NOTICE_MS = 5_000;

interface PopupPrefs {
  source: TrackerId;
  sort: WatchingSort;
}

/** Écran mémorisé avant un changement de langue (lu une seule fois) */
function takeReopenState(): { screen: Screen; scroll: number } | null {
  try {
    const raw = sessionStorage.getItem(REOPEN_KEY);
    sessionStorage.removeItem(REOPEN_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    if (typeof parsed !== 'object' || parsed === null || !('screen' in parsed) || !('scroll' in parsed)) return null;
    const { screen, scroll } = parsed;
    const valid = screen === 'watching' || screen === 'activity' || screen === 'settings';
    return valid && typeof scroll === 'number' ? { screen, scroll } : null;
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

const anilistStore = createStore<AniListState>({ status: 'loading' });
const malStore = createStore<MalState>({ status: 'loading' });
const syncStore = createStore<SyncData>({ reviews: [], recentSyncs: [], busyKey: null, recentError: null });
const uiStore = createStore<UiState>({ screen: reopen?.screen ?? 'watching', previous: 'watching', source: 'anilist', sort: DEFAULT_WATCHING_SORT, sortMenuOpen: false, rowMenu: null, rowConfirm: null });
const watchingStore = createStore<WatchingState>({ status: 'idle' });
const settingsStore = createStore<SettingsState>({ status: 'loading' });
const entryActionsStore = createStore<ReadonlyMap<string, EntryAction>>(new Map());
/** Bandeau de retour d'un changement de statut sur « En cours » (la série a quitté la liste) */
const watchingNoticeStore = createStore<InlineFeedback | null>(null);
const exclusionsStore = createStore<ExclusionsState>({ status: 'loading' });
const queueStore = createStore<QueueState>({ items: [], busyIds: new Set(), notice: null, error: null });
const ratingsStore = createStore<RatingsState>({ items: [], busyIds: new Set(), errors: new Map(), notice: null, error: null });
/** Carte « Sur cette page » (série de l'onglet actif) */
const pageCardStore = createStore<PageCardState>({ media: { status: 'none' }, busy: null, confirm: null, feedback: null });
/** Activité › « Écarts AniList ↔ MAL » */
const compareStore = createStore<CompareState>({ result: null, job: null, requesting: null, error: null, confirm: null, filter: 'all', shown: COMPARE_PAGE_SIZE });
/** Accès à Crunchyroll / ADN et aux API (bandeau « Autoriser l'accès » si Firefox l'a retiré) */
const hostAccessStore = createStore<HostAccessState>({ status: 'unknown' });
const version = chrome.runtime.getManifest().version;
/** Lues au démarrage (synchrone) : la demande d'accès doit partir sans `await` dans le clic */
const hostOrigins = requiredOrigins(chrome.runtime.getManifest());
let now = Date.now();

function accountStore(service: TrackerId): Store<AccountState<unknown>> {
  // Les deux stores ne diffèrent que par le type du profil : les transitions génériques les manipulent pareil
  return (service === 'anilist' ? anilistStore : malStore) as Store<AccountState<unknown>>;
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
const activityScreen = h('div', { class: 'flex flex-col gap-4 pb-1' }, queueSlot, ratingSlot, reviewSection.element, recentSlot, compareSlot);
const settingsScreen = createSettingsScreen();
const footerSlot = h('div', { class: 'contents' });
const main = h(
  'main',
  { class: 'sk-scroll min-h-0 flex-1 overflow-y-auto px-4 pt-1 pb-3' },
  watchingSlot,
  activityScreen,
  settingsScreen.element,
  onboardingSlot,
);
const root = getRoot();
root.replaceChildren(headerSlot, barSlot, hostAccessSlot, main, footerSlot);

// ─── Navigation ───────────────────────────────────────────────────────────

function navigate(screen: Screen): void {
  const ui = uiStore.get();
  if (ui.screen === screen) return;
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

async function savePrefs(): Promise<void> {
  const { source, sort } = uiStore.get();
  try {
    await chrome.storage.local.set({ [PREFS_KEY]: { source, sort } satisfies PopupPrefs });
  } catch (error: unknown) {
    log.warn('Préférences du popup non enregistrées :', error);
  }
}

async function pickSource(source: TrackerId): Promise<void> {
  uiStore.set({ ...uiStore.get(), source, sortMenuOpen: false, rowMenu: null, rowConfirm: null });
  await savePrefs();
}

async function loadPrefs(): Promise<void> {
  try {
    const stored = await chrome.storage.local.get(PREFS_KEY);
    const raw: unknown = stored[PREFS_KEY];
    if (typeof raw !== 'object' || raw === null) return;
    // Chaque champ est validé séparément : une valeur inconnue retombe sur la valeur par défaut
    const ui = uiStore.get();
    uiStore.set({
      ...ui,
      source: 'source' in raw && isTrackerId(raw.source) ? raw.source : ui.source,
      sort: 'sort' in raw && isWatchingSort(raw.sort) ? raw.sort : DEFAULT_WATCHING_SORT,
    });
  } catch (error: unknown) {
    log.warn('Préférences du popup illisibles :', error);
  }
}

// ─── Menu de tri « Mes séries » ─────────────────────────────────────────────
// Ouvert/fermé dans uiStore (survit aux nouveaux rendus) ; les écouteurs globaux
// (clic extérieur, Échap) n'existent que pendant l'ouverture.

function focusInWatching(selector: string): void {
  watchingSlot.querySelector<HTMLElement>(selector)?.focus({ preventScroll: true });
}

function setSortMenu(open: boolean, restoreFocus = true): void {
  const ui = uiStore.get();
  if (ui.sortMenuOpen === open) return;
  // Un seul menu ouvert à la fois
  uiStore.set({ ...ui, sortMenuOpen: open, rowMenu: open ? null : ui.rowMenu, rowConfirm: open ? null : ui.rowConfirm });
  // Le rendu est synchrone : à l'ouverture, focus sur l'option cochée ; à la fermeture, retour au bouton
  if (open) focusInWatching('[role="menuitemradio"][aria-checked="true"]');
  else if (restoreFocus) focusInWatching('[data-focus="sort-trigger"]');
}

async function pickSort(sort: WatchingSort): Promise<void> {
  uiStore.set({ ...uiStore.get(), sort, sortMenuOpen: false });
  focusInWatching('[data-focus="sort-trigger"]');
  await savePrefs();
}

/** Menu « … » d'une série : ouverture = focus sur la première action, fermeture = retour au bouton */
function setRowMenu(key: string | null, restoreFocus = true): void {
  const ui = uiStore.get();
  if (ui.rowMenu === key) return;
  const previous = ui.rowMenu;
  uiStore.set({ ...ui, rowMenu: key, rowConfirm: null, sortMenuOpen: false });
  if (key !== null) {
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

function onMenuPointerDown(event: PointerEvent): void {
  const target = event.target instanceof Element ? event.target : null;
  const ui = uiStore.get();
  if (ui.sortMenuOpen && !target?.closest('[data-sort-root]')) setSortMenu(false, false);
  const rowRoot = target?.closest<HTMLElement>('[data-menu-root]');
  if (ui.rowMenu !== null && rowRoot?.dataset.menuRoot !== ui.rowMenu) setRowMenu(null, false);
}

function onMenuKeyDown(event: KeyboardEvent): void {
  if (event.key !== 'Escape') return;
  // Échap ferme le menu sans fermer le popup
  event.preventDefault();
  event.stopPropagation();
  const ui = uiStore.get();
  if (ui.sortMenuOpen) setSortMenu(false);
  if (ui.rowConfirm !== null) {
    // Échap annule d'abord la confirmation en cours, le menu reste ouvert
    setRowConfirm(null);
    return;
  }
  if (ui.rowMenu !== null) setRowMenu(null);
}

let menuListening = false;

/** Écouteurs globaux (clic extérieur, Échap) présents seulement pendant qu'un menu est ouvert */
function syncMenuListeners({ sortMenuOpen, rowMenu }: UiState): void {
  const open = sortMenuOpen || rowMenu !== null;
  if (open === menuListening) return;
  menuListening = open;
  if (open) {
    document.addEventListener('pointerdown', onMenuPointerDown, true);
    document.addEventListener('keydown', onMenuKeyDown, true);
  } else {
    document.removeEventListener('pointerdown', onMenuPointerDown, true);
    document.removeEventListener('keydown', onMenuKeyDown, true);
  }
}

// ─── Rendu ────────────────────────────────────────────────────────────────

function footerStatus(): FooterStatus {
  const connected = connectedServices();
  const expired = TRACKER_IDS.find((service) => {
    const state = accountStore(service).get();
    return state.status === 'logged-out' && state.expired;
  });
  const { reviews, recentSyncs } = syncStore.get();
  const { failed, pending } = queueCounts();

  // Priorité : synchros abandonnées, vérifications, relances en attente, session expirée
  if (connected.length > 0 && failed > 0) return { kind: 'queue-failed', count: failed };
  if (connected.length > 0 && reviews.length > 0) return { kind: 'pending', count: reviews.length };
  if (connected.length > 0 && pending > 0) return { kind: 'queue-pending', count: pending };
  if (expired) return { kind: 'expired', service: expired };
  if (connected.length === 0) return { kind: 'none' };
  // Priorité la plus basse : une note reportée n'empêche rien de fonctionner
  const toRate = ratingsStore.get().items.length;
  if (toRate > 0) return { kind: 'to-rate', count: toRate };
  const latest = recentSyncs[0];
  return { kind: 'ok', relative: latest ? formatRelativeTime(latest.syncedAt, now) : null };
}

function queueCounts(): { failed: number; pending: number } {
  const { items } = queueStore.get();
  const failed = items.filter((item) => item.status === 'failed').length;
  return { failed, pending: items.length - failed };
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

/** Dernières entrées du rendu de « En cours » : on ne redessine la liste que si elles changent */
let watchingMemo: readonly unknown[] = [];

function renderWatching(): void {
  const preferredPlayer = (() => {
    const state = settingsStore.get();
    return state.status === 'ready' ? state.settings.preferredPlayer : DEFAULT_SETTINGS.preferredPlayer;
  })();
  const services = connectedServices();
  const { sort, sortMenuOpen, rowMenu, rowConfirm } = uiStore.get();
  const exclusions = exclusionsStore.get();
  const actions = entryActionsStore.get();
  const notice = watchingNoticeStore.get();
  const pageCard = pageCardStore.get();
  const inputs = [watchingStore.get(), now, preferredPlayer, services.join(), sort, sortMenuOpen, rowMenu, rowConfirm, exclusions, actions, notice, pageCard];
  if (inputs.length === watchingMemo.length && inputs.every((value, i) => value === watchingMemo[i])) return;
  watchingMemo = inputs;

  preserveFocus(watchingSlot, () =>
    watchingSlot.replaceChildren(
      renderWatchingScreen({
        state: watchingStore.get(),
        notice,
        now,
        preferredPlayer,
        services,
        onPickSource: (source) => void pickSource(source),
        sort,
        sortMenuOpen,
        onSortMenu: (open) => setSortMenu(open),
        onPickSort: (value) => void pickSort(value),
        onRetry: () => void reloadWatching(),
        pageCard: renderPageMediaCard({
          card: pageCard,
          now,
          onRetry: () => void loadPageMedia(),
          onAdd: (status) => void runPageAction({ kind: 'add', status }),
          onAdjust: (delta) => void runPageAction({ kind: 'adjust', delta }),
          onConfirm: (status) => setPageConfirm(status),
          onSetStatus: (status) => void runPageAction({ kind: 'status', status }),
          onRate: (value) => void runPageAction({ kind: 'rate', value }),
          onPickSeason: (mediaId) => pickPageSeason(mediaId),
        }),
        controls: {
          actions,
          excludedMediaIds: new Set(exclusions.status === 'ready' ? exclusions.items.flatMap((e) => (e.mediaId !== null ? [e.mediaId] : [])) : []),
          rowMenu,
          rowConfirm,
          onRowConfirm: (status) => setRowConfirm(status),
          onSetStatus: (entry, status) => void setEntryStatus(entry, status),
          onRowMenu: (key) => setRowMenu(key),
          onAdjust: (entry, delta) => void adjustProgress(entry, delta),
          onExclude: (entry) => void excludeEntry(entry),
          onInclude: (entry) => void includeEntry(entry),
        },
      }),
    ),
  );
  // Menu ouvert mais contrôle absent (liste vide, chargement, erreur, série disparue) : on le referme après ce rendu
  if (sortMenuOpen && !watchingSlot.querySelector('[data-sort-root]')) queueMicrotask(() => setSortMenu(false, false));
  if (rowMenu !== null && !watchingSlot.querySelector(`[data-menu-root="${rowMenu}"]`)) queueMicrotask(() => setRowMenu(null, false));
}

/** Section « À noter » redessinée seulement si son état change (préserve le survol des étoiles) */
let ratingsMemo: readonly unknown[] = [];

function renderRatings(): void {
  const connected = connectedServices().length > 0;
  const inputs = [ratingsStore.get(), connected, now];
  if (inputs.every((value, i) => value === ratingsMemo[i])) return;
  ratingsMemo = inputs;
  ratingSlot.replaceChildren(
    ...nodes([
      connected &&
        renderRatingSection({
          ratings: ratingsStore.get(),
          now,
          onRate: (item, value) => void rateMedia(item, value),
          onIgnore: (item) => void ignoreRating(item),
        }),
    ]),
  );
}

/** Section « Écarts » redessinée seulement si son état change (jusqu'à 30+ lignes) */
let compareMemo: readonly unknown[] = [];
/** Compte à rebours d'une pause d'alignement : avance chaque seconde tant que la pause dure */
let compareClock = 0;

function renderCompare(): void {
  const both = connectedServices().length === 2;
  const inputs = [compareStore.get(), both, now, compareClock];
  if (inputs.every((value, i) => value === compareMemo[i])) return;
  compareMemo = inputs;
  compareSlot.replaceChildren(
    ...nodes([
      both &&
        renderCompareSection({
          state: compareStore.get(),
          now,
          onAnalyze: () => void analyzeLists(),
          onApply: (diffs, source) => void applyDiffs(diffs, source),
          onConfirm: (source) => patchCompare({ confirm: source }),
          onFilter: (filter) => patchCompare({ filter, shown: COMPARE_PAGE_SIZE, confirm: null }),
          onCancel: () => void cancelCompareJob(),
          onDismissJob: () => void dismissCompareJob(),
          onRetryFailed: (diffs, source) => void applyDiffs(diffs, source),
          onShowMore: () => patchCompare({ shown: compareStore.get().shown + COMPARE_PAGE_SIZE }),
        }),
    ]),
  );
}

function render(): void {
  const ui = uiStore.get();
  const onboarding = isOnboarding();
  const isSettings = ui.screen === 'settings';
  const data = syncStore.get();
  // Pastille « Activité » : vérifications + synchros abandonnées + séries à noter (à traiter par l'utilisateur)
  const pending = connectedServices().length > 0 ? data.reviews.length + queueCounts().failed + ratingsStore.get().items.length : 0;

  preserveFocus(root, () => {
    headerSlot.replaceChildren(renderHeader({ isSettings, onSettings: toggleSettings, onOpenPanel: panelTabId === null ? null : openPanel }));
    barSlot.replaceChildren(
      ...nodes([
        isSettings
          ? renderSettingsBar(goBack, settingsScreen.status)
          : !onboarding && renderNav({ screen: ui.screen === 'activity' ? 'activity' : 'watching', pending, onNavigate: navigate }),
      ]),
    );

    hostAccessSlot.replaceChildren(...nodes([renderHostAccessBanner({ state: hostAccessStore.get(), onAllow: allowHostAccess })]));

    watchingSlot.hidden = isSettings || onboarding || ui.screen !== 'watching';
    activityScreen.hidden = isSettings || onboarding || ui.screen !== 'activity';
    settingsScreen.element.hidden = !isSettings;
    onboardingSlot.hidden = isSettings || !onboarding;

    if (!watchingSlot.hidden) renderWatching();
    if (!onboardingSlot.hidden) {
      onboardingSlot.replaceChildren(
        renderOnboarding({ anilist: anilistStore.get(), mal: malStore.get(), onLogin: (service) => void login(service) }),
      );
    }

    queueSlot.replaceChildren(
      ...nodes([
        connectedServices().length > 0 &&
          renderQueueSection({
            queue: queueStore.get(),
            now,
            onRetry: (id) => void retryQueued(id),
            onAbandon: (id) => void abandonQueued(id),
          }),
      ]),
    );
    renderRatings();
    renderCompare();
    reviewSection.update(connectedServices().length > 0 ? data.reviews : []);
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

    settingsScreen.updateAccounts({
      anilist: anilistStore.get(),
      mal: malStore.get(),
      onLogin: (service) => void login(service),
      onLogout: (service) => void logout(service),
      onRetry: (service) => void refreshAccount(service),
    });

    footerSlot.replaceChildren(
      renderFooter({
        version,
        chips: footerChips(),
        status: footerStatus(),
        onOpenSettings: () => navigate('settings'),
        onOpenActivity: () => navigate('activity'),
        onReconnect: (service) => void login(service),
      }),
    );
  });
}

// ─── Accès aux sites (Firefox) ──────────────────────────────────────────────

async function checkHostAccess(): Promise<void> {
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

// ─── Comptes (AniList, MyAnimeList) ─────────────────────────────────────────

/** Rafraîchit le profil depuis l'API (stale-while-revalidate : le cache reste affiché). */
async function refreshAccount(service: TrackerId): Promise<void> {
  let result: ViewerResult | MalViewerResult;
  try {
    result = service === 'anilist' ? await sendMessage('GET_VIEWER', null) : await sendMessage('GET_MAL_VIEWER', null);
  } catch (error: unknown) {
    log.error('Service worker injoignable :', error);
    result = { ok: false, code: 'NETWORK', message: swUnreachable() };
  }

  if (!result.ok && AUTH_ERRORS.has(result.code)) {
    markExpired(service);
    return;
  }

  if (service === 'anilist') {
    const current = anilistStore.get();
    if (current.status !== 'logged-in') return; // Déconnecté entre-temps
    anilistStore.set(result.ok && isAniListViewer(result.data) ? { ...current, viewer: result.data, error: null } : { ...current, error: result.ok ? null : result.message });
  } else {
    const current = malStore.get();
    if (current.status !== 'logged-in') return;
    malStore.set(result.ok && isMalViewer(result.data) ? { ...current, viewer: result.data, error: null } : { ...current, error: result.ok ? null : result.message });
  }
}

function markExpired(service: TrackerId): void {
  accountStore(service).set({ ...LOGGED_OUT, expired: true });
}

async function loadCachedViewer(service: TrackerId): Promise<void> {
  if (service === 'anilist') anilistStore.set({ status: 'logged-in', viewer: await getCachedViewer(), error: null });
  else malStore.set({ status: 'logged-in', viewer: await getCachedMalViewer(), error: null });
}

async function login(service: TrackerId): Promise<void> {
  const store = accountStore(service);
  const before = store.get();
  const expired = before.status === 'logged-out' && before.expired;
  store.set({ status: 'logged-out', pending: true, error: null, expired });

  let result: AuthResult;
  try {
    result = await sendMessage(service === 'anilist' ? 'LOGIN_ANILIST' : 'LOGIN_MAL', null);
  } catch (error: unknown) {
    log.error('Service worker injoignable :', error);
    result = { ok: false, code: 'UNKNOWN', message: swUnreachable() };
  }

  if (!result.ok) {
    log.warn(`Échec de connexion ${TRACKER_LABELS[service]} :`, result.code, result.message);
    store.set({ status: 'logged-out', pending: false, error: result.message, expired });
    return;
  }

  // Le service worker a déjà préchargé le profil après l'OAuth
  await loadCachedViewer(service);
  const state = store.get();
  if (state.status === 'logged-in' && !state.viewer) await refreshAccount(service);
}

/** Après une déconnexion : plus aucun service connecté → effacement des données de l'utilisateur */
async function clearUserDataIfLastService(): Promise<void> {
  const [anilistToken, malToken] = await Promise.all([getValidToken(), getMalToken()]);
  if (!anilistToken && !malToken) await clearUserSyncData();
  await refreshReviewBadge();
}

async function logout(service: TrackerId): Promise<void> {
  const store = accountStore(service);
  try {
    await (service === 'anilist' ? clearAniListSession() : clearMalSession());
    await clearUserDataIfLastService();
    store.set(LOGGED_OUT);
  } catch (error: unknown) {
    log.error(`Échec de la déconnexion ${TRACKER_LABELS[service]} :`, error);
    const current = store.get();
    if (current.status === 'logged-in') store.set({ ...current, error: t('popup.logoutFailed') });
  }
}

/** Token AniList présent mais expiré : on propose « Reconnecter » plutôt que l'accueil */
async function hasExpiredAniListToken(): Promise<boolean> {
  const stored = await chrome.storage.local.get(STORAGE_KEYS.anilistToken);
  return isAniListToken(stored[STORAGE_KEYS.anilistToken]);
}

async function bootstrap(service: TrackerId): Promise<void> {
  const store = accountStore(service);
  try {
    // MAL : token présent, même expiré (le service worker le renouvellera)
    const token = service === 'anilist' ? await getValidToken() : await getMalToken();
    if (!token) {
      store.set({ ...LOGGED_OUT, expired: service === 'anilist' && (await hasExpiredAniListToken()) });
      return;
    }
    await loadCachedViewer(service);
    await refreshAccount(service);
  } catch (error: unknown) {
    log.error('Lecture du stockage impossible :', error);
    store.set({ ...LOGGED_OUT, error: t('popup.sessionReadFailed') });
  }
}

// ─── Liste « En cours » ─────────────────────────────────────────────────────

/** Service affiché : la source choisie si elle est connectée, sinon le seul service connecté */
function activeService(): TrackerId | null {
  const connected = connectedServices();
  const { source } = uiStore.get();
  return connected.includes(source) ? source : (connected[0] ?? null);
}

let loadedService: TrackerId | null = null;
/** Jeton de requête : une réponse arrivée après un changement de source est ignorée */
let watchingRequest = 0;

async function loadWatching(service: TrackerId): Promise<void> {
  const request = ++watchingRequest;
  const current = watchingStore.get();

  // 1. Cache immédiat (ou liste déjà affichée pour ce service), sinon skeleton
  const cached = current.status === 'ready' && current.service === service ? current.list : await getCachedWatching(service).catch(() => null);
  if (request !== watchingRequest) return;
  watchingStore.set(cached ? { status: 'ready', service, list: cached, refreshing: true, error: null } : { status: 'loading', service });

  // 2. Revalidation par le service worker
  let result: WatchingResult;
  try {
    result = await sendMessage('GET_WATCHING', { service });
  } catch (error: unknown) {
    log.error('Service worker injoignable :', error);
    result = { ok: false, code: 'NETWORK', message: swUnreachable() };
  }
  if (request !== watchingRequest) return;

  if (result.ok) {
    watchingStore.set({ status: 'ready', service, list: result.data, refreshing: false, error: null });
    return;
  }
  if (AUTH_ERRORS.has(result.code)) {
    // markExpired re-résout la source (nouvelle requête) : cette réponse devient obsolète
    markExpired(service);
    if (request !== watchingRequest) return;
  }
  watchingStore.set(cached ? { status: 'ready', service, list: cached, refreshing: false, error: result.message } : { status: 'error', service, message: result.message });
}

function reloadWatching(): Promise<void> {
  const service = activeService();
  return service ? loadWatching(service) : Promise.resolve();
}

/** Recharge la liste quand le service affiché change (connexion, déconnexion, choix de source) */
function syncWatchingSource(): void {
  // Comptes encore en lecture : attendre les deux évite de charger (et d'afficher) la mauvaise liste
  if (TRACKER_IDS.some((id) => accountStore(id).get().status === 'loading')) return;
  const service = activeService();
  if (service === loadedService) return;
  loadedService = service;
  if (service) startPageMedia();
  if (service) {
    void loadWatching(service);
  } else {
    watchingRequest++;
    watchingStore.set({ status: 'idle' });
  }
}

// ─── Actions sur une série (+1, −1, exclusion) ──────────────────────────────

const entryFeedbackTimers = new Map<string, ReturnType<typeof setTimeout>>();

function setEntryAction(key: string, action: EntryAction | null): void {
  const next = new Map(entryActionsStore.get());
  if (action) next.set(key, action);
  else next.delete(key);
  entryActionsStore.set(next);
}

/** Retour bref (~3 s) à la place de la pastille d'état de la série */
function flashEntryFeedback(key: string, feedback: InlineFeedback): void {
  clearTimeout(entryFeedbackTimers.get(key));
  setEntryAction(key, { phase: 'done', feedback });
  entryFeedbackTimers.set(
    key,
    setTimeout(() => {
      entryFeedbackTimers.delete(key);
      setEntryAction(key, null);
    }, ENTRY_FEEDBACK_MS),
  );
}

/** Liens de séries appris pendant que le popup est ouvert : ajoutés aux séries affichées */
function applyLearnedLinks(value: unknown): void {
  const shown = watchingStore.get();
  if (shown.status !== 'ready') return;
  const entries = withLearnedLinks(shown.list.entries, parsePlatformLinkStore(value));
  if (entries) watchingStore.set({ ...shown, list: { ...shown.list, entries } });
}

/** Mise à jour optimiste de la progression affichée (avant la revalidation de la liste) */
function patchWatchingProgress(entry: WatchingEntry, outcome: SyncOutcome): void {
  const shown = watchingStore.get();
  if (shown.status !== 'ready' || outcome.status !== 'synced') return;
  const result = outcome.results.find((r) => r.service === shown.service)?.outcome;
  if (result?.status !== 'updated' && result?.status !== 'up-to-date') return;
  const key = entryKey(entry);
  const entries = shown.list.entries.map((e) => (entryKey(e) === key ? { ...e, progress: result.progress } : e));
  watchingStore.set({ ...shown, list: { ...shown.list, entries } });
}

async function adjustProgress(entry: WatchingEntry, delta: 1 | -1): Promise<void> {
  const key = entryKey(entry);
  if (entryActionsStore.get().get(key)?.phase === 'pending') return;
  clearTimeout(entryFeedbackTimers.get(key));
  setEntryAction(key, { phase: 'pending', kind: 'adjust' });

  let outcome: SyncOutcome;
  try {
    outcome = await sendMessage('ADJUST_PROGRESS', { mediaId: entry.mediaId, malId: entry.malId, delta });
  } catch (error: unknown) {
    log.error('Service worker injoignable :', error);
    outcome = { status: 'error', message: swUnreachable() };
  }
  patchWatchingProgress(entry, outcome);
  flashEntryFeedback(key, adjustFeedback(outcome, delta));
  // Revalidation silencieuse : la liste reflète ensuite l'état réel des services
  scheduleWatchingRevalidation();
}

let watchingNoticeTimer: ReturnType<typeof setTimeout> | undefined;

function showWatchingNotice(notice: InlineFeedback): void {
  clearTimeout(watchingNoticeTimer);
  watchingNoticeStore.set(notice);
  // Bandeau en haut de la liste : ramené dans la zone visible si la série était plus bas
  watchingSlot.querySelector('[data-watching-notice]')?.scrollIntoView({ block: 'nearest' });
  // Un échec reste affiché plus longtemps (texte à lire)
  watchingNoticeTimer = setTimeout(() => watchingNoticeStore.set(null), notice.tone === 'success' ? QUEUE_NOTICE_MS : QUEUE_NOTICE_MS * 2);
}

/** Retire la série de la liste affichée (elle n'est plus « en cours » sur ce service) */
function removeFromWatching(key: string): void {
  const shown = watchingStore.get();
  if (shown.status !== 'ready') return;
  watchingStore.set({ ...shown, list: { ...shown.list, entries: shown.list.entries.filter((e) => entryKey(e) !== key) } });
}

/** En pause / Abandonner / Terminé : écrit sur tous les services connectés, la série quitte « En cours » */
async function setEntryStatus(entry: WatchingEntry, status: ListStatusChange): Promise<void> {
  const key = entryKey(entry);
  if (entryActionsStore.get().get(key)?.phase === 'pending') return;
  clearTimeout(entryFeedbackTimers.get(key));
  setEntryAction(key, { phase: 'pending', kind: 'status' });

  let outcome: SyncOutcome;
  try {
    // Affiche de la carte « À noter » : https uniquement (refusée sinon par la validation du message)
    const coverUrl = entry.coverUrl?.startsWith('https://') && entry.coverUrl.length <= 2000 ? entry.coverUrl : null;
    outcome = await sendMessage('SET_LIST_STATUS', { mediaId: entry.mediaId, malId: entry.malId, status, coverUrl });
  } catch (error: unknown) {
    log.error('Service worker injoignable :', error);
    outcome = { status: 'error', message: swUnreachable() };
  }

  const feedback = statusFeedback(outcome, status);
  // La série quitte la liste si le service affiché a bien changé de statut (ou l'avait déjà)
  const shown = watchingStore.get();
  const shownResult = outcome.status === 'synced' && shown.status === 'ready' ? outcome.results.find((r) => r.service === shown.service)?.outcome : undefined;
  if (shownResult?.status === 'updated' || shownResult?.status === 'up-to-date') removeFromWatching(key);
  // Bandeau en haut de l'écran (texte complet, y compris les erreurs) : la ligne a pu disparaître
  setEntryAction(key, null);
  showWatchingNotice(feedback);
  scheduleWatchingRevalidation();
}

async function excludeEntry(entry: WatchingEntry): Promise<void> {
  if (entry.mediaId === null) return;
  const key = entryKey(entry);
  try {
    // Aucune clé plateforme dérivable depuis la liste : l'exclusion porte sur la fiche AniList
    await excludeSeries({ platformKey: null, mediaId: entry.mediaId, label: entry.title });
    flashEntryFeedback(key, { tone: 'info', text: t('popup.syncDisabled'), detail: t('popup.syncDisabledDetail') });
  } catch (error: unknown) {
    log.error('Exclusion de la série impossible :', error);
    flashEntryFeedback(key, errorFeedback(t('popup.excludeFailed')));
  }
  await loadExclusions();
}

async function includeEntry(entry: WatchingEntry): Promise<void> {
  const exclusions = exclusionsStore.get();
  if (exclusions.status !== 'ready' || entry.mediaId === null) return;
  const key = entryKey(entry);
  try {
    const matches = exclusions.items.filter((e) => e.mediaId === entry.mediaId);
    for (const match of matches) await includeSeries(match.id);
    flashEntryFeedback(key, { tone: 'success', text: t('popup.syncEnabled'), detail: t('popup.syncEnabledDetail') });
  } catch (error: unknown) {
    log.error('Réactivation de la série impossible :', error);
    flashEntryFeedback(key, errorFeedback(t('popup.includeFailed')));
  }
  await loadExclusions();
}

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
  syncStore.set({ ...syncStore.get(), recentError: error });
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
// Le content script de l'onglet actif décrit la page ; le service worker résout la fiche AniList.
// Tout est asynchrone : sans réponse (autre site, onglet ouvert avant le rechargement de
// l'extension), la carte « Reprendre » reste affichée.

/** Délai maximal de réponse du content script (un script orphelin ne répond jamais) */
const PAGE_DETECT_TIMEOUT_MS = 1_500;
const PAGE_FEEDBACK_MS = 4_000;

/** Onglet actif vu par le popup : page reconnue et présence du script de contenu (donc Crunchyroll / ADN) */
interface ActiveTabProbe {
  tabId: number | null;
  /** Le script de contenu a répondu : l'onglet est une page Crunchyroll / ADN */
  reachable: boolean;
  /** URL visible seulement avec une permission d'hôte sur le site */
  url: string | undefined;
  page: PageMediaInfo | null;
}

/** Série ou épisode de l'onglet actif (null hors page reconnue ou content script injoignable) */
async function probeActiveTab(): Promise<ActiveTabProbe> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let tab: chrome.tabs.Tab | undefined;
  try {
    // L'id de l'onglet ne requiert pas la permission "tabs"
    [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id === undefined) return { tabId: null, reachable: false, url: undefined, page: null };
    const message: ContentMessage = { type: 'GET_PAGE_MEDIA' };
    const timeout = new Promise<undefined>((resolve) => {
      timer = setTimeout(() => resolve(undefined), PAGE_DETECT_TIMEOUT_MS);
    });
    const response: unknown = await Promise.race([chrome.tabs.sendMessage(tab.id, message), timeout]);
    const reachable = isPageMediaResponse(response);
    return { tabId: tab.id, reachable, url: tab.url, page: reachable ? response : null };
  } catch {
    // « Receiving end does not exist » : onglet hors Crunchyroll/ADN, ou script de contenu absent
    return { tabId: tab?.id ?? null, reachable: false, url: tab?.url, page: null };
  } finally {
    clearTimeout(timer);
  }
}

/** Lancée dès l'ouverture du popup, en parallèle de la lecture des comptes */
const activeTab: Promise<ActiveTabProbe> = probeActiveTab();
const activePage: Promise<PageMediaInfo | null> = activeTab.then((probe) => probe.page);

// ─── Panneau latéral : bouton d'en-tête, seulement sur Crunchyroll / ADN ───

/** Onglet Crunchyroll / ADN actif pour lequel le bouton « Ouvrir le panneau » est proposé */
let panelTabId: number | null = null;

void activeTab.then((probe) => {
  // Script de contenu joignable, ou URL reconnue (onglet ouvert avant l'installation : script absent)
  if (probe.tabId === null || sidePanelKind() === null || !(probe.reachable || isTargetPage(probe.url))) return;
  panelTabId = probe.tabId;
  render();
});

/** Clic : aucun `await` avant l'ouverture (geste utilisateur requis par sidePanel.open / sidebarAction.open) */
function openPanel(): void {
  if (panelTabId === null) return;
  openSidePanel(panelTabId).then(
    () => window.close(),
    (error: unknown) => log.warn('Ouverture du panneau impossible :', error),
  );
}
let pageRequest = 0;
let pageStarted = false;
/** Saison choisie dans le sélecteur : conservée pour les relectures après une action */
let pageManualId: number | null = null;
let pageFeedbackTimer: ReturnType<typeof setTimeout> | undefined;

function patchPageCard(patch: Partial<PageCardState>): void {
  pageCardStore.set({ ...pageCardStore.get(), ...patch });
}

/** Résout la fiche de la page ; `silent` : relecture sans skeleton (après une action, choix de saison) */
async function loadPageMedia(silent = false): Promise<void> {
  const page = await activePage;
  if (!page) return;
  const request = ++pageRequest;
  const current = pageCardStore.get().media;
  if (silent && current.status === 'ready') patchPageCard({ media: { ...current, refreshing: true } });
  else patchPageCard({ media: { status: 'loading', page } });

  let result: PageMediaResult;
  try {
    result = await sendMessage('RESOLVE_PAGE_MEDIA', { page, mediaId: pageManualId });
  } catch (error: unknown) {
    log.error('Service worker injoignable :', error);
    result = { ok: false, code: 'NETWORK', message: swUnreachable() };
  }
  if (request !== pageRequest) return;

  if (result.ok) {
    patchPageCard({ media: { status: 'ready', page, view: result.data, refreshing: false } });
  } else if (silent && current.status === 'ready') {
    // Relecture en échec : la fiche précédente reste affichée, l'erreur passe en retour d'action
    patchPageCard({ media: { ...current, refreshing: false } });
    showPageFeedback(errorFeedback(result.message));
  } else {
    patchPageCard({ media: { status: 'error', page, message: result.message } });
  }
}

/** Premier chargement, dès qu'un service est connecté (l'écran « En cours » devient visible) */
function startPageMedia(): void {
  if (pageStarted) return;
  pageStarted = true;
  void loadPageMedia();
}

function showPageFeedback(feedback: InlineFeedback): void {
  clearTimeout(pageFeedbackTimer);
  patchPageCard({ feedback });
  // Un échec reste affiché plus longtemps (texte à lire)
  pageFeedbackTimer = setTimeout(() => patchPageCard({ feedback: null }), feedback.tone === 'success' ? PAGE_FEEDBACK_MS : PAGE_FEEDBACK_MS * 2);
}

/** Exécute une action de la carte (une à la fois), affiche son retour puis relit la fiche et « En cours » */
async function runPageAction(request: MediaActionRequest): Promise<void> {
  const card = pageCardStore.get();
  if (card.busy !== null || card.media.status !== 'ready') return;
  patchPageCard({ busy: mediaActionKey(request), confirm: null });
  const feedback = await runMediaAction(request, card.media.view, (error) => log.error('Service worker injoignable :', error));
  patchPageCard({ busy: null });
  showPageFeedback(feedback);
  scheduleWatchingRevalidation();
  await loadPageMedia(true);
}


/**
 * Confirmation Abandonner / Terminé de la carte. Ouverture : focus sur « Non » (une action
 * irréversible ne se valide pas d'un double Entrée) ; annulation : focus rendu au bouton d'origine.
 */
function setPageConfirm(status: ListStatusChange | null): void {
  const card = pageCardStore.get();
  if (card.busy !== null || card.confirm === status) return;
  const previous = card.confirm;
  patchPageCard({ confirm: status });
  if (status !== null) focusInWatching('[data-focus="confirm-no-page"]');
  else if (previous !== null) focusInWatching(`[data-focus="page-status-${previous}"]`);
}

function pickPageSeason(mediaId: number): void {
  if (pageCardStore.get().busy !== null) return;
  pageManualId = mediaId;
  patchPageCard({ confirm: null, feedback: null });
  void loadPageMedia(true);
}

// ─── File de synchro (Activité › Synchros en attente) ──────────────────────

let queueNoticeTimer: ReturnType<typeof setTimeout> | undefined;

function setQueueBusy(id: string, busy: boolean): void {
  const current = queueStore.get();
  const busyIds = new Set(current.busyIds);
  if (busy) busyIds.add(id);
  else busyIds.delete(id);
  queueStore.set({ ...current, busyIds });
}

function showQueueNotice(notice: InlineFeedback): void {
  clearTimeout(queueNoticeTimer);
  queueStore.set({ ...queueStore.get(), notice });
  queueNoticeTimer = setTimeout(() => queueStore.set({ ...queueStore.get(), notice: null }), QUEUE_NOTICE_MS);
}

async function retryQueued(id: string): Promise<void> {
  if (queueStore.get().busyIds.has(id)) return;
  setQueueBusy(id, true);
  let outcome: SyncOutcome;
  try {
    outcome = await sendMessage('RETRY_QUEUED', { id });
  } catch (error: unknown) {
    log.error('Service worker injoignable :', error);
    outcome = { status: 'error', message: swUnreachable() };
  }
  setQueueBusy(id, false);
  showQueueNotice(retryFeedback(outcome));
  await loadQueue();
}

async function abandonQueued(id: string): Promise<void> {
  if (queueStore.get().busyIds.has(id)) return;
  setQueueBusy(id, true);
  let error: string | null = null;
  try {
    await removeQueueItem(id);
  } catch (e: unknown) {
    log.error('Suppression de la synchro en attente impossible :', e);
    error = t('popup.abandonFailed');
  }
  setQueueBusy(id, false);
  await loadQueue();
  if (error) queueStore.set({ ...queueStore.get(), error });
}

async function loadQueue(): Promise<void> {
  try {
    const items = await getSyncQueue();
    queueStore.set({ ...queueStore.get(), items, error: null });
  } catch (error: unknown) {
    log.error('Lecture de la file de synchro impossible :', error);
    queueStore.set({ ...queueStore.get(), error: t('popup.queueReadFailed') });
  }
}

// ─── Notes reportées (Activité › À noter) ──────────────────────────────────

let ratingNoticeTimer: ReturnType<typeof setTimeout> | undefined;

function patchRatings(patch: Partial<RatingsState>): void {
  ratingsStore.set({ ...ratingsStore.get(), ...patch });
}

function withBusy(id: string, busy: boolean): ReadonlySet<string> {
  const next = new Set(ratingsStore.get().busyIds);
  if (busy) next.add(id);
  else next.delete(id);
  return next;
}

function withError(id: string, error: string | null): ReadonlyMap<string, string> {
  const next = new Map(ratingsStore.get().errors);
  if (error) next.set(id, error);
  else next.delete(id);
  return next;
}

async function rateMedia(item: PendingRating, value: number): Promise<void> {
  if (ratingsStore.get().busyIds.has(item.id)) return;
  patchRatings({ busyIds: withBusy(item.id, true), errors: withError(item.id, null) });
  let outcome: SyncOutcome;
  try {
    outcome = await sendMessage('RATE_MEDIA', { media: { mediaId: item.mediaId, malId: item.malId, title: item.title }, score: value });
  } catch (error: unknown) {
    log.error('Service worker injoignable :', error);
    outcome = { status: 'error', message: swUnreachable() };
  }
  const feedback = ratingFeedback(outcome, formatStarValue(value), item.title);
  if (!feedback.ok) {
    patchRatings({ busyIds: withBusy(item.id, false), errors: withError(item.id, feedback.text) });
    return;
  }
  // Le service worker retire la carte du stockage ; elle disparaît tout de suite de l'affichage
  clearTimeout(ratingNoticeTimer);
  const current = ratingsStore.get();
  patchRatings({ items: current.items.filter((i) => i.id !== item.id), busyIds: withBusy(item.id, false), notice: feedback });
  ratingNoticeTimer = setTimeout(() => patchRatings({ notice: null }), QUEUE_NOTICE_MS);
}

async function ignoreRating(item: PendingRating): Promise<void> {
  try {
    await removePendingRating(item.id);
    patchRatings({ error: null });
  } catch (error: unknown) {
    log.error('Suppression de la note en attente impossible :', error);
    patchRatings({ error: t('popup.ignoreFailed') });
  }
}

async function loadRatings(): Promise<void> {
  try {
    const items = await getPendingRatings();
    const current = ratingsStore.get();
    // Cartes en cours d'envoi conservées : le service worker les retire seulement après l'écriture
    const busy = current.items.filter((i) => current.busyIds.has(i.id) && !items.some((n) => n.id === i.id));
    patchRatings({ items: [...busy, ...items], error: null });
  } catch (error: unknown) {
    log.error('Lecture des notes en attente impossible :', error);
    patchRatings({ error: t('popup.ratingsReadFailed') });
  }
}

// ─── Écarts AniList ↔ MAL (Activité) ───────────────────────────────────────

function patchCompare(patch: Partial<CompareState>): void {
  compareStore.set({ ...compareStore.get(), ...patch });
}

/** Dernière analyse (stockage) : affichée à la réouverture du popup */
function setComparison(value: unknown): void {
  patchCompare({ result: isComparisonResult(value) ? value : null });
}

/** Tâche en cours (progression) ou bilan du dernier alignement ; un alignement qui se termine relit « En cours » */
function setCompareJob(value: unknown): void {
  const previous = compareStore.get().job;
  const job = isCompareJob(value) ? value : null;
  patchCompare({ job });
  const finished = previous?.status === 'running' && job !== null && job.kind === 'apply' && job.status !== 'running';
  if (finished && job.updated > 0) void reloadWatching();
}

async function loadComparison(): Promise<void> {
  try {
    const stored = await chrome.storage.local.get([COMPARE_STORAGE_KEY, COMPARE_JOB_KEY]);
    setComparison(stored[COMPARE_STORAGE_KEY]);
    setCompareJob(stored[COMPARE_JOB_KEY]);
  } catch (error: unknown) {
    log.warn('Lecture de la dernière comparaison impossible :', error);
  }
}

async function analyzeLists(): Promise<void> {
  if (compareStore.get().requesting !== null) return;
  patchCompare({ requesting: 'analyze', error: null, confirm: null });
  let result: CompareResult;
  try {
    result = await sendMessage('COMPARE_LISTS', null);
  } catch (error: unknown) {
    log.error('Service worker injoignable :', error);
    result = { ok: false, code: 'NETWORK', message: swUnreachable() };
  }
  if (result.ok) patchCompare({ requesting: null, result: result.data, shown: COMPARE_PAGE_SIZE });
  else patchCompare({ requesting: null, error: result.message });
}

/** Lance l'alignement (une série ou un lot) : le service worker le traite en arrière-plan, la progression arrive par le stockage */
async function applyDiffs(diffs: readonly ListDiff[], source: TrackerId): Promise<void> {
  if (diffs.length === 0 || compareStore.get().requesting !== null) return;
  patchCompare({ requesting: 'apply', confirm: null, error: null });
  let result: ApplyResult;
  try {
    result = await sendMessage('APPLY_DIFFS', { items: diffs.map((d) => ({ mediaId: d.mediaId, malId: d.malId })), source });
  } catch (error: unknown) {
    log.error('Service worker injoignable :', error);
    result = { ok: false, code: 'NETWORK', message: swUnreachable() };
  }
  // Tâche acceptée : affichée tout de suite (le changement du stockage suit)
  if (result.ok) patchCompare({ requesting: null, job: result.data });
  else patchCompare({ requesting: null, error: result.message });
}

async function cancelCompareJob(): Promise<void> {
  const job = compareStore.get().job;
  if (job) patchCompare({ job: { ...job, cancelled: true } });
  try {
    await sendMessage('CANCEL_COMPARE_JOB', null);
  } catch (error: unknown) {
    log.error('Service worker injoignable :', error);
    patchCompare({ error: swUnreachable() });
  }
}

/** « OK » sur le bilan : la tâche terminée est retirée du stockage (jamais une tâche en cours) */
async function dismissCompareJob(): Promise<void> {
  try {
    await withStorageLock(async () => {
      const stored = await chrome.storage.local.get(COMPARE_JOB_KEY);
      const job: unknown = stored[COMPARE_JOB_KEY];
      if (!isCompareJob(job) || job.status !== 'running') await chrome.storage.local.remove(COMPARE_JOB_KEY);
    });
  } catch (error: unknown) {
    log.warn('Suppression du bilan d’alignement impossible :', error);
  }
}

// ─── Données de synchro ───────────────────────────────────────────────────

/** "Corriger" : le service worker recharge les fiches candidates et rouvre une carte. */
async function handleCorrect(key: string): Promise<void> {
  syncStore.set({ ...syncStore.get(), busyKey: key, recentError: null });
  let error: string | null = null;
  try {
    const result = await sendMessage('REOPEN_REVIEW', { key });
    if (!result.ok) error = result.message;
    else navigate('activity');
  } catch (e: unknown) {
    log.error('Service worker injoignable :', e);
    error = swUnreachable();
  }
  syncStore.set({ ...syncStore.get(), busyKey: null, recentError: error });
}

async function loadSyncData(): Promise<void> {
  const [reviews, recentSyncs] = await Promise.all([getPendingReviews(), getRecentSyncs()]);
  syncStore.set({ ...syncStore.get(), reviews, recentSyncs });
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

function onTokenChange(service: TrackerId, change: chrome.storage.StorageChange | undefined): void {
  if (!change) return;
  const store = accountStore(service);
  const state = store.get();
  const hasToken = change.newValue !== undefined;
  if (!hasToken && state.status === 'logged-in') store.set(LOGGED_OUT);
  else if (hasToken && state.status === 'logged-out' && !state.pending) void bootstrap(service);
}

chrome.storage.onChanged.addListener((changes, areaName): void => {
  if (areaName !== 'local') return;

  onTokenChange('anilist', changes[STORAGE_KEYS.anilistToken]);
  onTokenChange('mal', changes[STORAGE_KEYS.malToken]);

  const viewerChange = changes[STORAGE_KEYS.anilistViewer];
  const anilist = anilistStore.get();
  if (viewerChange && anilist.status === 'logged-in' && isAniListViewer(viewerChange.newValue)) {
    anilistStore.set({ ...anilist, viewer: viewerChange.newValue });
  }

  const malViewerChange = changes[STORAGE_KEYS.malViewer];
  const mal = malStore.get();
  if (malViewerChange && mal.status === 'logged-in' && isMalViewer(malViewerChange.newValue)) {
    malStore.set({ ...mal, viewer: malViewerChange.newValue });
  }

  if (changes[STORAGE_KEYS.pendingReviews] || changes[STORAGE_KEYS.recentSyncs]) void loadSyncData();
  if (changes[PENDING_RATINGS_KEY]) void loadRatings();
  const compareChange = changes[COMPARE_STORAGE_KEY];
  if (compareChange) setComparison(compareChange.newValue);
  const compareJobChange = changes[COMPARE_JOB_KEY];
  if (compareJobChange) setCompareJob(compareJobChange.newValue);

  const settingsChange = changes[SETTINGS_STORAGE_KEY];
  if (settingsChange) settingsStore.set({ status: 'ready', settings: normalizeSettings(settingsChange.newValue) });

  if (changes[STORAGE_KEYS.mediaMappings]) void settingsScreen.refreshMappings();
  if (changes[EXCLUDED_SERIES_KEY]) void loadExclusions();
  if (changes[SYNC_QUEUE_KEY]) void loadQueue();
  const airingChange = changes[AIRING_RESULT_KEY];
  if (airingChange) setAiringResult(airingChange.newValue);

  // Lien de série appris (page visitée) : « Ouvrir » et la pastille de plateforme suivent sans requête
  const linksChange = changes[PLATFORM_LINKS_KEY];
  if (linksChange) applyLearnedLinks(linksChange.newValue);

  // Synchro dans un onglet : le service worker ne met pas le cache « En cours » à jour → revalidation
  if (changes[STORAGE_KEYS.recentSyncs]) scheduleWatchingRevalidation();
});

// ─── Alertes de sortie : dernier résumé de vérification ───────────────────

let airingResult: AiringCheckResult | null = null;

function setAiringResult(value: unknown): void {
  airingResult = isAiringCheckResult(value) ? value : null;
  settingsScreen.updateAiring(airingResult, Date.now());
}

async function loadAiringResult(): Promise<void> {
  try {
    const stored = await chrome.storage.local.get(AIRING_RESULT_KEY);
    setAiringResult(stored[AIRING_RESULT_KEY]);
  } catch (error: unknown) {
    log.warn('Lecture du résumé des alertes impossible :', error);
  }
}

const REVALIDATE_DEBOUNCE_MS = 1_000;
let revalidateTimer: ReturnType<typeof setTimeout> | undefined;

/** Revalidation silencieuse (liste actuelle conservée, pas de skeleton), regroupée sur ~1 s */
function scheduleWatchingRevalidation(): void {
  clearTimeout(revalidateTimer);
  revalidateTimer = setTimeout(() => {
    revalidateTimer = undefined;
    const shown = watchingStore.get();
    if (shown.status === 'ready' && shown.service === activeService()) void loadWatching(shown.service);
  }, REVALIDATE_DEBOUNCE_MS);
}

// ─── Démarrage ────────────────────────────────────────────────────────────

anilistStore.subscribe(syncWatchingSource);
malStore.subscribe(syncWatchingSource);
uiStore.subscribe(syncWatchingSource);
uiStore.subscribe(syncMenuListeners);
for (const store of [anilistStore, malStore, syncStore, uiStore, watchingStore, entryActionsStore, watchingNoticeStore, queueStore, ratingsStore, pageCardStore, compareStore, hostAccessStore]) store.subscribe(render);
// Accès accordé ou retiré pendant que le popup est ouvert (about:addons, autre fenêtre)
chrome.permissions?.onAdded?.addListener(() => void checkHostAccess());
chrome.permissions?.onRemoved?.addListener(() => void checkHostAccess());
exclusionsStore.subscribe((state) => {
  settingsScreen.updateExclusions(state);
  render();
});
let pendingScroll: number | null = reopen?.scroll ?? null;

settingsStore.subscribe((state) => {
  settingsScreen.updateSettings(state);
  render();
  // Après un changement de langue : défilement restauré une fois le formulaire dessiné
  if (state.status === 'ready' && pendingScroll !== null) {
    main.scrollTop = pendingScroll;
    pendingScroll = null;
  }
});

// Nouvelle langue : le popup est rechargé (toutes les vues reconstruites) en revenant au même écran
onLocaleChange(() => {
  try {
    sessionStorage.setItem(REOPEN_KEY, JSON.stringify({ screen: uiStore.get().screen, scroll: main.scrollTop }));
  } catch {
    // Stockage de session indisponible : retour à l'écran d'accueil du popup
  }
  location.reload();
});

// Pause d'alignement (limite de requêtes, service lent) : compte à rebours rafraîchi chaque seconde
setInterval(() => {
  const job = compareStore.get().job;
  if (job?.status === 'running' && job.pausedUntil !== null && job.pauseReason !== 'resume') {
    compareClock++;
    render();
  }
}, 1_000);

// Les comptes à rebours et « il y a… » vieillissent tant que le popup reste ouvert
setInterval(() => {
  now = Date.now();
  render();
  settingsScreen.updateAiring(airingResult, now);
}, CLOCK_TICK_MS);

void checkHostAccess();
void loadSettings();
void loadSyncData();
void loadExclusions();
void loadQueue();
void loadRatings();
void loadComparison();
void loadAiringResult();
void settingsScreen.refreshMappings();
// La source préférée est lue avant les comptes : évite de charger la mauvaise liste puis de basculer
void loadPrefs().then(() => Promise.all([bootstrap('anilist'), bootstrap('mal')]));
