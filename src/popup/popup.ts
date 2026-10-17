import { initI18n, t } from '../i18n';
import { mountPopupApp } from './popup-app';
import { afterRender } from './after-render';
import type { WatchingContext } from './components/watching-screen';
import { refreshReviewBadge } from '../browser/badge';
import type { EntryLinkContext } from '../shared/entry-link';
import { EXCLUDED_SERIES_KEY, getExcludedSeries, matchesExclusion } from '../shared/exclusions';
import { exclusionKey, pageExclusionKey } from '../platforms/series-identity';
import { excludeSeries, includeSeries } from '../browser/storage/exclusions-store';
import { sendMessage } from '../protocol/messages';
import { callWorker, networkFailure, outcomeFailure } from '../ui/worker-call';
import type { RecentSync } from '../shared/review.types';
import { DEFAULT_SETTINGS, effectivePlayer, normalizeSettings, SETTINGS_STORAGE_KEY } from '../shared/settings';
import { getSettings } from '../browser/storage/settings-access';
import { deletePendingReview, getPendingReviews, getRecentSyncs } from '../browser/storage/reviews';
import { STORAGE_KEYS } from '../protocol/storage-keys';
import type { PageMediaInfo } from '../shared/page-media.types';
import { TRACKER_IDS, type TrackerId } from '../shared/tracker.types';
import { entryKey } from '../shared/watching';
import type { WatchingEntry, WatchingSort } from '../shared/watching.types';
import { h } from '../ui/dom';
import { createPageMediaController, detectPageMedia, PAGE_FEEDBACK_MS } from '../ui/page-media-controller';
import { hasHostAccess, requestHostAccess, requiredOrigins } from '../browser/host-access';
import { createCompareController } from '../ui/compare-controller';
import { createQueueController } from './controllers/queue';
import { createRatingsController } from './controllers/ratings';
import { createWatchingController } from './controllers/watching';
import type { ReviewActions } from '../ui/review-card';
import type { HostAccessState, PageCardState, Screen, SettingsState, SyncData, UiState } from './state';
import { errorFeedback } from '../ui/feedback';
import { createStore, patchStore, type AccountState, type ExclusionsState, type InlineFeedback, type Store } from '../ui/state';
import { createLogger } from '../browser/logger';
import { openSidePanel, sidePanelKind, type PanelTarget } from '../browser/side-panel';
import { createAccountsController } from '../ui/accounts';
import type { SettingsPage } from '../ui/settings/navigation';
import type { SettingsView } from '../ui/settings/settings-view';
import { createPlatformAccessStore } from '../ui/platform-access-store';
import { importPageUrl } from '../ui/import-page';
import { mountStatusBar } from '../ui/status-bar-host';
import { takePopupScreen } from '../browser/popup-screen';

const log = createLogger('popup');

// Langue lue avant le premier rendu : toutes les vues sont construites directement dans la bonne langue
await initI18n();

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
const uiStore = createStore<UiState>({ screen: 'watching', previous: 'watching' });
const settingsStore = createStore<SettingsState>({ status: 'loading' });
const exclusionsStore = createStore<ExclusionsState>({ status: 'loading' });
/** Réglage « Fiche ouverte par défaut » : service de la liste « En cours » ; null tant que les réglages ne sont pas lus */
const preferredServiceStore = createStore<TrackerId | null>(null);
settingsStore.subscribe((state) => {
  const service = state.status === 'ready' ? state.settings.entryService : state.status === 'error' ? DEFAULT_SETTINGS.entryService : null;
  if (service !== preferredServiceStore.get()) preferredServiceStore.set(service);
});
/** Liste « En cours » (service, tri, actions sur une série, bandeau de retour) */
const watching = createWatchingController({
  accounts,
  preferredService: preferredServiceStore,
  exclusions: exclusionsStore,
  reloadExclusions: () => loadExclusions(),
  onServiceShown: () => startPageMedia(),
  // Bandeau en haut de la liste : ramené dans la zone visible si la série était plus bas
  onNoticeShown: () => afterRender(() => document.querySelector('[data-watching-notice]')?.scrollIntoView({ block: 'nearest' })),
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
 * undefined = pas encore lu. Store unique de la page (4-D6), partagé avec la carte « Sur cette page » et les Réglages
 */
const platformAccessStore = createPlatformAccessStore();

/** Lues au démarrage (synchrone) : la demande d'accès doit partir sans `await` dans le clic */
const hostOrigins = requiredOrigins(chrome.runtime.getManifest());
/** Vue des Réglages, chargée à la première ouverture */
const settingsViewStore = createStore<SettingsView | null>(null);
/** Pastille de l'onglet Activité */
const pendingStore = createStore(0);

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

/** Lecteur préféré effectif, accès optionnels accordés et liens de fiche : relus à chaque changement de leurs sources */
function watchingContext(): WatchingContext {
  const state = settingsStore.get();
  return {
    preferredPlayer: state.status === 'ready' ? effectivePlayer(state.settings.preferredPlayer, platformAccessStore.get()) : DEFAULT_SETTINGS.preferredPlayer,
    optionalPlatforms: platformAccessStore.get() ?? [],
    entryLinks: entryLinkContext(),
  };
}
const contextStore = createStore<WatchingContext>(watchingContext());

// ─── Actions des cartes "À vérifier" ────────────────────────────────────────

const reviewActions: ReviewActions = {
  search: (query) => callWorker('SEARCH_ANIME', { query }, networkFailure),
  confirm: (key, mediaId, progress) => callWorker('RESOLVE_REVIEW', { key, mediaId, progress }, outcomeFailure),
  // Service worker : l'épisode mis de côté pendant une correction est rejoué après le retrait de la carte
  async dismiss(key) {
    const result = await sendMessage('DISMISS_REVIEW', { key });
    if (!result.ok) throw new Error(result.message);
  },
  async exclude(review) {
    // Fiche suggérée volontairement ignorée (par définition incertaine) : seule une fiche déjà écrite est reprise
    await excludeSeries({ platformKey: exclusionKey(review.episode), mediaId: review.previous?.mediaId ?? null, label: review.episode.animeTitle });
    // Série exclue : simple suppression, aucun épisode mis de côté n'est rejoué
    await deletePendingReview(review.key);
    await refreshReviewBadge();
  },
};

// ─── Mise en page ───────────────────────────────────────────────────────────
// Coquille Preact (popup-app.tsx) : en-tête, onglets et barre d'état fixes, seule la zone centrale défile. Les écrans
// à état local (Activité, Réglages) sont masqués plutôt que recréés.

/** « Écarts AniList ↔ MAL » : compteur de la ligne de l'Activité, page des Réglages (même contrôleur) */
const compare = createCompareController({ onApplied: () => void watching.reload() });
/**
 * Créée à la première ouverture des Réglages (comme dans le panneau) : mappings, journal, raccourcis et accès ne sont lus
 * qu'alors. Module chargé à ce moment (import dynamique) : le code des Réglages reste hors du chargement initial
 */
let settingsLoad: Promise<SettingsView | null> | null = null;
function loadSettingsView(): Promise<SettingsView | null> {
  settingsLoad ??= import('../ui/settings/settings-view').then(
    ({ createSettingsView }) => {
      const view = createSettingsView({
        navigateBack: () => goBack(),
        // Le popup se ferme de lui-même quand le nouvel onglet prend le focus
        openTab: (url) => void chrome.tabs.create({ url }),
        closesOnBlur: true,
        hostAccessBanner: true,
        accounts,
        platformAccess: platformAccessStore,
        compare: () => compare,
      });
      // Montée par la coquille dans sa zone (masquée hors des Réglages : ouverture annulée pendant le chargement comprise)
      settingsViewStore.set(view);
      return view;
    },
    (error: unknown) => {
      // Nouvel essai à la prochaine ouverture
      settingsLoad = null;
      log.warn('Réglages non chargés :', error);
      return null;
    },
  );
  return settingsLoad;
}
/** Ouverture des Réglages en attente du premier chargement de leur module ; toute autre navigation l'annule */
let pendingSettings: { page: SettingsPage } | null = null;
/** Conteneur de la barre d'état (son propre arbre Preact), placé en pied par la coquille */
const footerSlot = h('div', { class: 'contents' });

/** Zone centrale qui défile (rendue par la coquille) */
function mainRegion(): HTMLElement | null {
  return document.querySelector<HTMLElement>('main.sk-scroll');
}

// ─── Navigation ───────────────────────────────────────────────────────────

function navigate(screen: Screen, settingsPage: SettingsPage = 'home'): void {
  const ui = uiStore.get();
  pendingSettings = null;
  if (ui.screen === screen) return;
  // Entrée dans les Réglages : accueil, ou sous-page demandée (pastille de compte → Comptes). Première ouverture : écran
  // inchangé le temps de charger le module (quelques millisecondes, lu dans le paquet), puis même navigation
  const settingsView = settingsViewStore.get();
  if (screen === 'settings') {
    if (!settingsView) {
      const request = { page: settingsPage };
      pendingSettings = request;
      void loadSettingsView().then((view) => {
        if (view && pendingSettings === request) navigate('settings', settingsPage);
      });
      return;
    }
    settingsView.show(settingsPage);
  }
  uiStore.set({ ...ui, screen, previous: ui.screen === 'settings' ? ui.previous : ui.screen });
  const main = mainRegion();
  if (main) main.scrollTop = 0;
}

function goBack(): void {
  navigate(uiStore.get().previous);
}

/** Page des Réglages (barre d'état « Alignement… » → Écarts), Réglages déjà ouverts ou non */
function openSettingsPage(page: SettingsPage): void {
  const settingsView = settingsViewStore.get();
  if (uiStore.get().screen === 'settings' && settingsView) settingsView.show(page);
  else navigate('settings', page);
}

function toggleSettings(): void {
  if (uiStore.get().screen === 'settings') goBack();
  // Second clic pendant le premier chargement des Réglages : ouverture annulée, comme un retour
  else if (pendingSettings) pendingSettings = null;
  else navigate('settings');
}

// ─── « En cours » : tri, commentaire d'une série ──────────────────────────────
// Menus « ⋯ » (ui/series-menu.tsx) et menu de tri : composants Preact qui gèrent seuls ouverture, focus et fermeture.

/** Focus dans « En cours » après le rendu Preact en attente (l'élément visé n'existe qu'ensuite) */
function focusInWatching(selector: string): void {
  afterRender(() => watchingRegion()?.querySelector<HTMLElement>(selector)?.focus({ preventScroll: true }));
}

function watchingRegion(): HTMLElement | null {
  return document.querySelector<HTMLElement>('main.sk-scroll > [role="tabpanel"]');
}

/** Choix du tri : enregistré, la liste est retriée (le menu Preact rend le focus à son bouton) */
function pickSort(sort: WatchingSort): void {
  void watching.pickSort(sort);
}

/** « Commentaire… » : éditeur ouvert sous la série (il prend le focus), ramené dans la zone visible */
function openNotes(entry: WatchingEntry): void {
  watching.openNotes(entry);
  afterRender(() => watchingRegion()?.querySelector(`[data-notes-row="${entryKey(entry)}"]`)?.scrollIntoView({ block: 'nearest' }));
}

/** Fermeture (Annuler, Échap, enregistré) : focus rendu au bouton « ⋯ » de la série */
function closeNotes(): void {
  const key = watching.notes.get()?.key;
  watching.closeNotes();
  if (key !== undefined) focusInWatching(`[data-focus="more-${key}"]`);
}

/** Enregistré : éditeur fermé (focus au bouton « ⋯ »), sinon il reste ouvert pour réessayer */
async function saveNotes(entry: WatchingEntry, text: string): Promise<boolean> {
  const ok = await watching.saveNotes(entry, text);
  if (ok && watching.notes.get()?.key === entryKey(entry)) closeNotes();
  return ok;
}

// ─── Pastille d'Activité et contexte de « En cours » ──────────────────────────
// Le reste suit ses stores dans l'arbre Preact (useStore) : seules ces deux valeurs dérivées sont calculées ici.

/** Pastille « Activité » : vérifications + synchros abandonnées + séries à noter (à traiter par l'utilisateur) */
function activityPending(): number {
  return connectedServices().length > 0 ? syncStore.get().reviews.length + queue.counts().failed + ratings.store.get().items.length : 0;
}

function refreshDerived(): void {
  const pending = activityPending();
  if (pending !== pendingStore.get()) pendingStore.set(pending);
  const context = watchingContext();
  const shown = contextStore.get();
  if (context.preferredPlayer !== shown.preferredPlayer || context.optionalPlatforms.join() !== shown.optionalPlatforms.join() || context.entryLinks.preferred !== shown.entryLinks.preferred || context.entryLinks.connected.join() !== shown.entryLinks.connected.join()) {
    contextStore.set(context);
  }
}

// ─── Accès aux sites (Firefox) et accès Netflix / Disney+ (optionnels) ─────

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

// ─── Exclusions (pastille « Exclue » des dernières synchros et de « En cours ») ───

async function excludeRecent(sync: RecentSync): Promise<void> {
  let error: string | null = null;
  try {
    await excludeSeries({ platformKey: exclusionKey(sync.episode), mediaId: sync.mediaId, label: sync.episode.animeTitle });
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
  platformAccess: platformAccessStore,
});

/** Retour propre au popup sur la carte (exclusion, réactivation : stockage local, hors contrôleur de la fiche) */
const pageNoticeStore = createStore<InlineFeedback | null>(null);
let pageNoticeTimer: ReturnType<typeof setTimeout> | undefined;

function flashPageNotice(feedback: InlineFeedback): void {
  clearTimeout(pageNoticeTimer);
  pageNoticeStore.set(feedback);
  pageNoticeTimer = setTimeout(() => pageNoticeStore.set(null), feedback.tone === 'error' ? PAGE_FEEDBACK_MS * 2 : PAGE_FEEDBACK_MS);
}

/**
 * « Ne plus synchroniser cette série » de la carte : clé de la page (vérifiée par la lecture de chaque épisode) et fiche
 * AniList affichée, comme l'exclusion depuis une vérification
 */
async function excludePage(): Promise<void> {
  const { content } = pageCtl;
  if (content.status !== 'ready') return;
  try {
    await excludeSeries({ platformKey: pageExclusionKey(content.page), mediaId: content.view.media.mediaId, label: content.page.seriesTitle });
    flashPageNotice({ tone: 'info', text: t('popup.syncDisabled'), detail: t('popup.syncDisabledDetail') });
  } catch (error: unknown) {
    log.error('Exclusion de la série impossible :', error);
    flashPageNotice(errorFeedback(t('popup.excludeFailed')));
  }
  await loadExclusions();
}

/** « Réactiver la synchro » : toutes les exclusions qui couvrent la série de la page */
async function includePage(): Promise<void> {
  const { content } = pageCtl;
  const exclusions = exclusionsStore.get();
  if (content.status !== 'ready' || exclusions.status !== 'ready') return;
  const query = { platformKey: pageExclusionKey(content.page), mediaId: content.view.media.mediaId };
  try {
    for (const match of exclusions.items.filter((e) => matchesExclusion(e, query))) await includeSeries(match.id);
    flashPageNotice({ tone: 'success', text: t('popup.syncEnabled'), detail: t('popup.syncEnabledDetail') });
  } catch (error: unknown) {
    log.error('Réactivation de la série impossible :', error);
    flashPageNotice(errorFeedback(t('popup.includeFailed')));
  }
  await loadExclusions();
}

// ─── Panneau latéral : bouton d'en-tête, sur toutes les pages ───
// Le panneau suit l'onglet actif : « En lecture » sur une page de streaming, Agenda ailleurs.

/** Onglet actif (et sa fenêtre) pour lequel le bouton « Ouvrir le panneau » est proposé ; null sans API de panneau */
let panelTarget: PanelTarget | null = null;
const panelAvailableStore = createStore(false);

void activeTab.then(({ tabId, windowId }) => {
  if (sidePanelKind() === null || (tabId === null && windowId === null)) return;
  panelTarget = { tabId: tabId ?? undefined, windowId: windowId ?? undefined };
  panelAvailableStore.set(true);
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

// ─── Données de synchro ───────────────────────────────────────────────────

/** "Corriger" : le service worker recharge les fiches candidates et rouvre une carte. */
async function handleCorrect(key: string): Promise<void> {
  patchStore(syncStore, { busyKey: key, recentError: null });
  const result = await callWorker('REOPEN_REVIEW', { key }, networkFailure);
  const error = result.ok ? null : result.message;
  if (result.ok) navigate('activity');
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
mountPopupApp(getRoot(), {
  ui: uiStore,
  accounts: { anilist: anilistStore, mal: malStore },
  pending: pendingStore,
  hostAccess: hostAccessStore,
  panelAvailable: panelAvailableStore,
  settingsView: settingsViewStore,
  activity: {
    accounts: { anilist: anilistStore, mal: malStore },
    sync: syncStore,
    queue: queue.store,
    ratings: ratings.store,
    exclusions: exclusionsStore,
    context: contextStore,
    compare: compare.store,
    reviewActions,
    onRetryQueued: (id) => void queue.retry(id),
    onAbandonQueued: (id) => void queue.abandon(id),
    onRate: (item, value) => void ratings.rate(item, value),
    onIgnoreRating: (item) => void ratings.ignore(item),
    onCorrect: (key) => void handleCorrect(key),
    onExcludeRecent: (sync) => void excludeRecent(sync),
    onOpenCompare: () => navigate('settings', 'compare'),
  },
  footer: footerSlot,
  watching: {
    state: watching.store,
    sort: watching.prefs,
    actions: watching.entryActions,
    notice: watching.notice,
    notes: watching.notes,
    exclusions: exclusionsStore,
    pageCard: pageCardStore,
    context: contextStore,
    pageNotice: pageNoticeStore,
    page: {
      onRetry: () => pageCtl.retry(),
      onAdd: (status) => void pageCtl.runAction({ kind: 'add', status }),
      onAdjust: (delta) => void pageCtl.runAction({ kind: 'adjust', delta }),
      onRetryAdjust: (retry) => void pageCtl.runAction({ kind: 'adjust', delta: retry.delta, retry }),
      onSetStatus: (status) => void pageCtl.runAction({ kind: 'status', status }),
      onRate: (value) => void pageCtl.runAction({ kind: 'rate', value }),
      onPickSeason: (mediaId) => pageCtl.pickSeason(mediaId),
      onSaveNotes: async (notes) => (await pageCtl.runAction({ kind: 'notes', notes }))?.tone === 'success',
      onExclude: () => void excludePage(),
      onInclude: () => void includePage(),
      onRemove: () => void pageCtl.runAction({ kind: 'remove' }),
      onOpenPlatformsSettings: () => navigate('settings', 'platforms'),
    },
    onAdjust: (entry, delta) => void watching.adjust(entry, delta),
    onSetStatus: (entry, status) => void watching.setStatus(entry, status),
    onExclude: (entry) => void watching.exclude(entry),
    onInclude: (entry) => void watching.include(entry),
    onRemove: (entry) => void watching.remove(entry),
    onOpenNotes: openNotes,
    onCloseNotes: closeNotes,
    onSaveNotes: saveNotes,
    onPickSort: pickSort,
    onRetry: () => void watching.reload(),
    onOpenPlatformsSettings: () => navigate('settings', 'platforms'),
  },
  onNavigate: (screen) => navigate(screen),
  onSettings: toggleSettings,
  onOpenPanel: openPanel,
  onAllowHostAccess: allowHostAccess,
  onLogin: (service) => void accounts.login(service),
  onOpenPlatformsSettings: () => navigate('settings', 'platforms'),
});
// Barre d'état (composant partagé avec le panneau latéral) : Activité, menu du compte (logos), page d'import
mountStatusBar(footerSlot, {
  accounts,
  openActivity: () => navigate('activity'),
  openCompare: () => openSettingsPage('compare'),
  // Le popup se ferme de lui-même quand le nouvel onglet prend le focus
  openImport: (platform) => void chrome.tabs.create({ url: importPageUrl(platform) }),
});
// Popup ouvert depuis la barre d'état du panneau latéral : écran Activité demandé
takePopupScreen().then(
  (screen) => {
    if (screen === 'activity') navigate('activity');
  },
  (error: unknown) => log.debug('Écran demandé illisible :', error),
);
// Pastille d'Activité et contexte de « En cours » ; l'arbre Preact suit ses stores lui-même (langue comprise : useLocale)
for (const store of [anilistStore, malStore, syncStore, queue.store, ratings.store, settingsStore, platformAccessStore]) store.subscribe(refreshDerived);
// Accès accordé ou retiré pendant que le popup est ouvert (about:addons, autre fenêtre) : accès optionnels relus par leur store
platformAccessStore.onPermissionsChange(() => void checkHostAccess());

void checkHostAccess();
void loadSettings();
void loadSyncData();
void loadExclusions();
void queue.load();
void ratings.load();
void compare.load();
void watching.loadPrefs();
// La liste attend les réglages (« Fiche ouverte par défaut ») et les comptes : jamais la mauvaise liste puis une bascule
void accounts.bootstrapAll();
