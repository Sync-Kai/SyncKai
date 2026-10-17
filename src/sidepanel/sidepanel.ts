import { initI18n, onLocaleChange } from '../i18n';
import { createLogger } from '../browser/logger';
import type { StreamingPlatform } from '../shared/episode.types';
import { PLATFORMS } from '../platforms/registry';
import { EXCLUDED_SERIES_KEY, getExcludedSeries } from '../shared/exclusions';
import { getSettings } from '../browser/storage/settings-access';
import { sidePanelKind } from '../browser/side-panel';
import { createAccountsController } from '../ui/accounts';
import { createCompareController, type CompareController } from '../ui/compare-controller';
import { PAGE_FEEDBACK_MS } from '../ui/page-media-controller';
import { excludePageSeries, includePageSeries } from '../ui/page-exclusion';
import { createPlatformAccessStore, requestPlatformAccessFromClick } from '../ui/platform-access-store';
import type { SettingsPage } from '../ui/settings/navigation';
import type { SettingsView } from '../ui/settings/settings-view';
import { importPageUrl } from '../ui/import-page';
import { mountStatusBar } from '../ui/status-bar-host';
import { createStore, patchStore, type ExclusionsState, type InlineFeedback } from '../ui/state';
import { canOpenPopup, openPopupOn } from '../browser/popup-screen';
import { CLOSED_SECTIONS, type PanelSectionsState } from './components/details-card';
import type { NowPlayingSnapshot } from './components/now-playing';
import { createNowPlayingController } from './components/now-playing-controller';
import { agendaSnapshot, type AgendaSnapshot } from './components/agenda';
import { createAgendaController, type AgendaController } from './agenda-controller';
import { mountPanelApp, type PanelShellState } from './panel-app';
import { watchPanelContext, type PanelContext } from './presence';
import { listenPanelToggle } from './toggle';
import { followPageContext, initialPanelTab, PANEL_LAST_TAB_KEY, type PanelTab } from './tabs';

const log = createLogger('sidepanel');

// Panneau latéral : état et logique de la coque (onglet suivi, bascule automatique « En lecture » / Agenda, Réglages
// chargés à la première ouverture, exclusion de la série affichée) ; le rendu est l'arbre Preact de panel-app.tsx.
// Les Réglages sont la même vue que dans le popup (src/ui/settings), affichée à la place des onglets.

const app = document.getElementById('app');
/** Accès Netflix / Disney+ / Prime Video de la page du panneau : un seul store, partagé par ses écrans (4-D6) */
const platformAccess = createPlatformAccessStore();
/** Comptes AniList / MAL : barre d'état (dès l'ouverture) et Réglages, un seul contrôleur pour la page */
const accounts = createAccountsController();

const shell = createStore<PanelShellState>({ context: { status: 'checking' }, tab: 'nowPlaying', auto: false, settingsOpen: false });
/** Vue des Réglages, chargée à la première ouverture */
const settingsViewStore = createStore<SettingsView | null>(null);
/** Sections repliables de « En lecture » (gardées pendant la vie du panneau, d'une fiche à l'autre) */
const sectionsStore = createStore<PanelSectionsState>(CLOSED_SECTIONS);

// ─── « En lecture » : contrôleur sans rendu, publié pour l'arbre Preact ───

/** Republication de l'instantané, branchée une fois le store créé (le contrôleur ne prévient jamais pendant sa création) */
let publishNowPlaying = (): void => undefined;
const nowPlayingCtl = createNowPlayingController(() => publishNowPlaying(), platformAccess);
const nowPlayingSnapshot = (): NowPlayingSnapshot => {
  const { content, actions, preferred, entryService, liveEnabled } = nowPlayingCtl;
  return { content, actions, preferred, entryService, liveEnabled };
};
const nowPlayingStore = createStore<NowPlayingSnapshot>(nowPlayingSnapshot());
publishNowPlaying = () => nowPlayingStore.set(nowPlayingSnapshot());

/** Séries exclues : « Ne plus synchroniser » / « Réactiver la synchro » du menu de « Ta liste » */
const exclusionsStore = createStore<ExclusionsState>({ status: 'loading' });
async function loadExclusions(): Promise<void> {
  try {
    exclusionsStore.set({ status: 'ready', items: await getExcludedSeries() });
  } catch (error: unknown) {
    log.error('Lecture des séries exclues impossible :', error);
    exclusionsStore.set({ status: 'error' });
  }
}

/** Retour propre au panneau sur « Ta liste » (exclusion, réactivation : stockage local, hors contrôleur de la fiche) */
const noticeStore = createStore<InlineFeedback | null>(null);
let noticeTimer: ReturnType<typeof setTimeout> | undefined;
function flashNotice(feedback: InlineFeedback): void {
  clearTimeout(noticeTimer);
  noticeStore.set(feedback);
  noticeTimer = setTimeout(() => noticeStore.set(null), feedback.tone === 'error' ? PAGE_FEEDBACK_MS * 2 : PAGE_FEEDBACK_MS);
}

async function excludeShown(): Promise<void> {
  const { content } = nowPlayingCtl;
  if (content.status !== 'ready') return;
  flashNotice(await excludePageSeries({ page: content.page, mediaId: content.view.media.mediaId }));
  await loadExclusions();
}

async function includeShown(): Promise<void> {
  const { content } = nowPlayingCtl;
  const exclusions = exclusionsStore.get();
  if (content.status !== 'ready' || exclusions.status !== 'ready') return;
  flashNotice(await includePageSeries({ page: content.page, mediaId: content.view.media.mediaId }, exclusions.items));
  await loadExclusions();
}

// ─── Onglets ───

/** Choix de l'utilisateur (clic, clavier) : seul mémorisé comme « dernier onglet » */
function selectTab(tab: PanelTab): void {
  const changed = tab !== shell.get().tab;
  patchStore(shell, { tab, auto: false });
  // Mémorisé pour le réglage « Onglet à l'ouverture : Dernier ouvert »
  if (changed) chrome.storage.local.set({ [PANEL_LAST_TAB_KEY]: tab }).catch((error: unknown) => log.debug('Dernier onglet non mémorisé :', error));
}

/**
 * Onglet « Agenda » : contrôleur créé au premier affichage puis conservé (semaine affichée, semaines reçues en mémoire),
 * son instantané publié pour l'arbre Preact. Activé seulement quand l'onglet devient visible : les rendus dus à
 * « En lecture » (détection, relecture, réglage) relançaient le chargement et jetaient la réponse GET_AGENDA en cours.
 */
let agenda: AgendaController | null = null;
const agendaStore = createStore<AgendaSnapshot | null>(null);
/** Onglet visible (null : Réglages affichés ou vérification de l'onglet) */
let shownTab: PanelTab | null = null;

function visibleTab(state: PanelShellState): PanelTab | null {
  if (state.settingsOpen && settingsViewStore.get() !== null) return null;
  return state.context.status === 'checking' ? null : state.tab;
}

/** Onglet devenu visible : l'Agenda est créé (premier affichage) et activé avant le rendu qui le monte */
function followShownTab(): void {
  const next = visibleTab(shell.get());
  if (next === shownTab) return;
  shownTab = next;
  if (next === 'agenda') {
    agenda ??= createAgendaController({
      platformAccess,
      onChange: () => {
        if (agenda) agendaStore.set(agendaSnapshot(agenda));
      },
    });
    agenda.activate();
  }
}
shell.subscribe(followShownTab);
settingsViewStore.subscribe(followShownTab);

// ─── Réglages (même vue que le popup) ───

let settingsLoad: Promise<SettingsView | null> | null = null;

/** Réglages › Mes données › Écarts AniList ↔ MAL : contrôleur créé et lu à la première ouverture de ces pages */
let compare: CompareController | null = null;
function compareController(): CompareController {
  if (!compare) {
    // Le panneau n'affiche pas les listes alignées (pas de « Mes séries ») : rien à relire après un alignement
    compare = createCompareController({ onApplied: () => undefined });
    void compare.load();
  }
  return compare;
}

/** Ouverture demandée pendant le premier chargement du module des Réglages (un second clic l'annule) */
let settingsPending = false;

/**
 * Créée à la première ouverture (mappings, journal, raccourcis lus seulement alors), avec les comptes de la barre d'état.
 * Module chargé à ce moment (import dynamique) : le code des Réglages reste hors du chargement initial du panneau
 */
function loadSettingsView(): Promise<SettingsView | null> {
  settingsLoad ??= import('../ui/settings/settings-view').then(
    ({ createSettingsView }) => {
      const view = createSettingsView({
        navigateBack: () => setSettingsOpen(false),
        openTab: (url) => void chrome.tabs.create({ url }),
        closesOnBlur: false,
        hostAccessBanner: false,
        accounts,
        platformAccess,
        compare: compareController,
      });
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

function setSettingsOpen(open: boolean, page: SettingsPage = 'home'): void {
  const view = settingsViewStore.get();
  const isOpen = shell.get().settingsOpen && view !== null;
  // Déjà ouverts : sous-page demandée (logo de compte de la barre d'état → Comptes)
  if (open && isOpen && page !== 'home') view.show(page);
  if (open === isOpen) return;
  // Première ouverture : onglets affichés le temps de charger le module (quelques millisecondes), puis même ouverture
  if (open && !view) {
    settingsPending = true;
    void loadSettingsView().then((loaded) => {
      if (!loaded || !settingsPending) return;
      settingsPending = false;
      loaded.show(page);
      patchStore(shell, { settingsOpen: true });
      settingsViewStore.set(loaded);
    });
    return;
  }
  settingsPending = false;
  if (open) view?.show(page);
  // Fermeture : focus rendu à l'engrenage par la coque
  patchStore(shell, { settingsOpen: open });
}

/** Bouton Réglages ; un second clic pendant le premier chargement du module annule l'ouverture */
function toggleSettings(): void {
  if (settingsPending) settingsPending = false;
  else setSettingsOpen(!(shell.get().settingsOpen && settingsViewStore.get() !== null));
}

// ─── Onglet suivi ───

/**
 * Bouton « Activer Disney+ » : même demande d'accès que l'interrupteur des Réglages. permissions.request est appelé
 * directement dans le gestionnaire (geste utilisateur exigé, aucun await avant) ; la notice suit le store des accès.
 */
function enablePlatform(platform: StreamingPlatform): void {
  requestPlatformAccessFromClick(platform, platformAccess).catch((error: unknown) => log.warn(`Demande d’accès à ${PLATFORMS[platform].label} impossible :`, error));
}

function setContext(next: PanelContext): void {
  const current = shell.get();
  let { tab, auto } = current;
  // Statut de la page changé (ouverture, ou passage d'une page de streaming à une autre page) : l'onglet suit
  if (next.status !== 'checking' && next.status !== current.context.status) ({ tab, auto } = followPageContext({ tab, auto }, next.status === 'target'));
  shell.set({ ...current, context: next, tab, auto });
  nowPlayingCtl.setTab(next.status === 'target' ? next.tabId : null);
  // Accès optionnels relus à chaque passage hors page cible (comme avant le store : filet si un événement manquait)
  if (next.status === 'off') void platformAccess.refresh();
}

/**
 * Onglet à l'ouverture : réglage « Onglet à l'ouverture » (dernier onglet consulté par défaut). Hors page de streaming,
 * « En lecture » cède ensuite la place à l'Agenda (setContext).
 */
async function loadInitialTab(): Promise<void> {
  try {
    const [settings, stored] = await Promise.all([getSettings(), chrome.storage.local.get(PANEL_LAST_TAB_KEY)]);
    patchStore(shell, { tab: initialPanelTab(settings.panelDefaultTab, stored[PANEL_LAST_TAB_KEY]) });
  } catch (error: unknown) {
    log.debug('Onglet initial illisible :', error);
  }
}

async function main(): Promise<void> {
  // Raccourci « ouvrir ou fermer » (Chrome) : écoute posée avant tout await (instant de chargement au plus tôt)
  if (sidePanelKind() === 'chrome') listenPanelToggle();
  await Promise.all([initI18n(), loadInitialTab()]);
  void accounts.bootstrapAll();
  void loadExclusions();
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes[EXCLUDED_SERIES_KEY]) void loadExclusions();
  });
  onLocaleChange(() => {
    // Agenda affiché : textes et premier jour de la semaine à jour (il n'est plus réactivé à chaque rendu)
    if (shownTab === 'agenda') agenda?.activate();
  });
  if (app) {
    mountPanelApp(app, {
      shell,
      settingsView: settingsViewStore,
      platformAccess,
      agenda: {
        state: agendaStore,
        onStep: (delta) => agenda?.step(delta),
        onChoose: (week) => agenda?.choose(week),
        onRetry: () => void agenda?.load(true),
        onSaveOffset: async (mediaId, offset) => {
          if (agenda) await agenda.saveOffset(mediaId, offset);
        },
      },
      // Barre d'état : Activité dans le popup (le panneau n'en a pas ; sans chrome.action.openPopup, messages en texte)
      mountFooter: (container) => {
        mountStatusBar(container, {
          accounts,
          openActivity: canOpenPopup() ? () => void openPopupOn('activity') : null,
          openCompare: () => setSettingsOpen(true, 'compare'),
          openImport: (platform) => void chrome.tabs.create({ url: importPageUrl(platform) }),
        });
      },
      nowPlaying: {
        state: nowPlayingStore,
        live: nowPlayingCtl.live.store,
        exclusions: exclusionsStore,
        notice: noticeStore,
        sections: sectionsStore,
        onToggleSection: (section, open) => sectionsStore.set({ ...sectionsStore.get(), [section]: open }),
        onRefresh: () => void nowPlayingCtl.refresh(true),
        onRetry: () => nowPlayingCtl.retry(),
        onAdd: (status) => void nowPlayingCtl.runAction({ kind: 'add', status }),
        onAdjust: (delta) => void nowPlayingCtl.runAction({ kind: 'adjust', delta }),
        onRetryAdjust: (retry) => void nowPlayingCtl.runAction({ kind: 'adjust', delta: retry.delta, retry }),
        onSetStatus: (status) => void nowPlayingCtl.runAction({ kind: 'status', status }),
        onRate: (value) => void nowPlayingCtl.runAction({ kind: 'rate', value }),
        onRemove: () => void nowPlayingCtl.runAction({ kind: 'remove' }),
        onSaveNotes: async (notes) => (await nowPlayingCtl.runAction({ kind: 'notes', notes }))?.tone === 'success',
        onPickSeason: (mediaId) => nowPlayingCtl.pickSeason(mediaId),
        onExclude: () => void excludeShown(),
        onInclude: () => void includeShown(),
        onOpenPlatformsSettings: () => setSettingsOpen(true, 'platforms'),
      },
      onSelectTab: selectTab,
      onToggleSettings: toggleSettings,
      onEnablePlatform: enablePlatform,
      onOpenPlatformsSettings: () => setSettingsOpen(true, 'platforms'),
    });
  }
  if (!sidePanelKind()) {
    setContext({ status: 'off' });
    return;
  }
  try {
    await watchPanelContext(setContext, platformAccess);
  } catch (error: unknown) {
    log.warn('Onglet du panneau illisible :', error);
    setContext({ status: 'off' });
  }
}

void main();
