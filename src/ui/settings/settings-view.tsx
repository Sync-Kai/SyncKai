// Vue Réglages autonome, montée par le popup et par le panneau latéral : accueil (carte Comptes, interrupteurs rapides,
// catégories) et pages, dont des pages de second niveau (Affichage › Langue). Coque en Preact : barre (retour, titre,
// état d'enregistrement) et contenu sont deux arbres rendus de façon synchrone à chaque changement (navigation, données,
// langue), puis le focus est placé. Chaque page (SettingsMountedPage) est montée à l'ouverture et démontée en quittant ;
// elle suit seule ses données (`ctx.state`, stores de l'hôte). La vue lit et suit elle-même le stockage ; tout
// comportement propre à l'hôte passe par `SettingsHost`.
import { render } from 'preact';
import { useLayoutEffect, useRef } from 'preact/hooks';
import { onLocaleChange, t } from '../../i18n';
import { AIRING_RESULT_KEY, isAiringCheckResult } from '../../shared/airing.types';
import { COMPLETE_EPISODE_COMMAND, panelCommandName } from '../../protocol/commands';
import { DIAGNOSTICS_LOG_KEY, readJournal } from '../../browser/error-journal';
import { EXCLUDED_SERIES_KEY, getExcludedSeries } from '../../shared/exclusions';
import { createLogger } from '../../browser/logger';
import { getSettings } from '../../browser/storage/settings-access';
import { normalizeSettings, SETTINGS_STORAGE_KEY, type SyncSettings } from '../../shared/settings';
import { updateSettings } from '../../browser/storage/settings-store';
import { getMediaMappings } from '../../browser/storage/mappings';
import { STORAGE_KEYS } from '../../protocol/storage-keys';
import { Icon } from '../components/icon';
import { createStore } from '../state';
import type { SettingsContext, SettingsData, SettingsHost, SettingsMountedPage, ShortcutKeys } from './context';
import { SettingsHome } from './home';
import {
  INITIAL_SETTINGS_NAV,
  SETTINGS_PAGE_PARENTS,
  settingsDepth,
  settingsNavReducer,
  settingsPageTitle,
  settingsRowFocus,
  type SettingsNavAction,
  type SettingsPage,
  type SettingsSubPage,
} from './navigation';
import { createAccountsPage } from './page-accounts';
import { createComparePage } from './page-compare';
import { createDataPage } from './page-data';
import { createDisplayPage } from './page-display';
import { createExclusionsPage } from './page-exclusions';
import { createHelpPage } from './page-help';
import { createLanguagePage } from './page-language';
import { createMappingsPage } from './page-mappings';
import { createNotificationsPage } from './page-notifications';
import { createPlatformsPage } from './page-platforms';
import { createShortcutsPage } from './page-shortcuts';
import { createSyncPage } from './page-sync';
import { accountLink } from './summary';

const log = createLogger('settings');

const SAVED_BADGE_MS = 1_500;

export interface SettingsView {
  /** Barre (retour, titre, état d'enregistrement) : placée par l'hôte au-dessus de sa zone défilante */
  readonly bar: HTMLElement;
  /** Contenu de la page affichée : placé par l'hôte dans sa zone défilante */
  readonly element: HTMLElement;
  /** Entrée dans les Réglages : accueil, ou directement une page (logo de compte → Comptes) */
  show(page?: SettingsPage): void;
  /** Écouteurs (stockage, accès, comptes, langue, focus), minuteries et arbres Preact retirés : vue recréée par l'hôte (4-R6) */
  dispose(): void;
}

/** Pastille d'enregistrement : « Enregistré » (effacée après SAVED_BADGE_MS) ou « Échec » (reste affichée) */
type SaveStatus = 'saved' | 'failed' | null;

interface SettingsBarProps {
  page: SettingsPage;
  status: SaveStatus;
  onBack: () => void;
}

/**
 * Barre : « ← Retour » (accueil) ou « ← parent », titre centré (sur trois lignes au plus, puis tronqué, quand la place
 * manque : « ← Synchronisierung » + « Ausgeschlossene Serien » à 320 px, à côté de l'engrenage du panneau latéral ; la
 * barre grandit alors), état d'enregistrement à droite.
 * Côtés de base nulle et de même croissance : le titre reste centré tant que le retour tient dans sa moitié.
 */
function SettingsBar({ page, status, onBack }: SettingsBarProps) {
  const home = page === 'home';
  const parent = home ? null : SETTINGS_PAGE_PARENTS[page];
  const backLabel = parent === null ? t('nav.back') : settingsPageTitle(parent);
  const backAria = parent === null ? undefined : parent === 'home' ? t('settings.backHomeAria') : t('settings.backToAria', { page: backLabel });
  return (
    <div class="flex min-h-11 shrink-0 items-center gap-2 px-3" data-settings-bar="">
      <div class="flex min-w-fit flex-1 basis-0">
        <button
          type="button"
          class="flex h-8 max-w-full cursor-pointer items-center gap-1 rounded-pill bg-transparent px-2 text-body font-bold text-muted transition-colors hover:bg-raised hover:text-ink"
          aria-label={backAria}
          data-focus={home ? 'back' : 'settings-home'}
          onClick={onBack}
        >
          <Icon name="back" class="size-3.5" strokeWidth="2.4" />
          <span class="truncate">{backLabel}</span>
        </button>
      </div>
      <h1 class="m-0 line-clamp-3 min-w-0 shrink text-center font-display text-stat leading-tight font-extrabold break-words outline-none" id="sk-settings-title" tabIndex={-1} data-focus="settings-heading">
        {settingsPageTitle(page)}
      </h1>
      <div class="flex min-w-0 flex-1 basis-0 justify-end">
        <span
          class={`flex min-w-0 items-center gap-1 text-secondary font-bold transition-opacity ${status === null ? 'opacity-0' : ''} ${status === 'failed' ? 'text-danger' : 'text-mint'}`}
          title={status === 'failed' ? t('settings.status.failedTitle') : undefined}
          aria-live="polite"
          data-save-status={status ?? ''}
        >
          {status !== null && <Icon name={status === 'saved' ? 'check' : 'alert'} class="size-3 shrink-0" strokeWidth={status === 'saved' ? '3' : '2'} />}
          {status !== null && <span class="truncate">{t(status === 'saved' ? 'settings.status.saved' : 'settings.status.failed')}</span>}
        </span>
      </div>
    </div>
  );
}

/** Page Preact : montée à l'apparition de l'hôte, démontée quand il disparaît (page quittée, vue fermée) */
function MountedPageHost({ view }: { view: SettingsMountedPage }) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    return el ? view.mount(el) : undefined;
  }, [view]);
  return <div ref={ref} class="contents" />;
}

export function createSettingsView(host: SettingsHost): SettingsView {
  const version = chrome.runtime.getManifest().version;
  let nav = INITIAL_SETTINGS_NAV;
  /** Défilement des pages parentes, retrouvé au retour d'une page enfant */
  const scrolls = new Map<SettingsPage, number>();
  let saveStatus: SaveStatus = null;

  const data: SettingsData = {
    settings: null,
    settingsError: false,
    mappings: null,
    mappingsError: null,
    exclusions: { status: 'loading' },
    journalCount: null,
    airing: null,
    platformAccess: host.platformAccess.get(),
  };
  /** Instantanés de `data` pour les pages Preact */
  const state = createStore<SettingsData>({ ...data });
  const shortcuts = createStore<ShortcutKeys>({ shortcut: undefined, panelShortcut: undefined });

  const bar = document.createElement('div');
  bar.className = 'contents';
  const element = document.createElement('div');
  element.className = 'flex flex-col gap-3 pb-3';
  let badgeTimer: ReturnType<typeof setTimeout> | undefined;
  let disposed = false;

  function showStatus(ok: boolean): void {
    clearTimeout(badgeTimer);
    saveStatus = ok ? 'saved' : 'failed';
    drawBar();
    // L'erreur reste affichée : l'interface ne reflète plus le stockage
    if (ok) {
      badgeTimer = setTimeout(() => {
        saveStatus = null;
        drawBar();
      }, SAVED_BADGE_MS);
    }
  }

  function drawBar(): void {
    if (disposed) return;
    render(<SettingsBar page={nav.page} status={saveStatus} onBack={() => dispatch({ type: 'back' })} />, bar);
  }

  // ─── Contexte des pages ───

  async function update(patch: Partial<SyncSettings>): Promise<void> {
    if (!data.settings) return;
    data.settings = { ...data.settings, ...patch };
    // Accueil : les résumés suivent chaque changement ; pages : nouvel instantané
    publish();
    try {
      // Champs modifiés seulement, sous verrou : une écriture concurrente (service worker, Agenda) n'est pas écrasée
      await updateSettings(patch);
      showStatus(true);
    } catch (error: unknown) {
      log.error('Enregistrement des réglages impossible :', error);
      showStatus(false);
    }
  }

  async function refreshMappings(): Promise<void> {
    try {
      data.mappings = Object.entries(await getMediaMappings()).sort(([a], [b]) => a.localeCompare(b));
      data.mappingsError = null;
    } catch (error: unknown) {
      log.error('Lecture des correspondances impossible :', error);
      data.mappingsError = t('settings.mappings.loadError');
    }
    publish();
  }

  async function refreshJournal(): Promise<void> {
    try {
      data.journalCount = (await readJournal()).length;
    } catch {
      data.journalCount = null;
    }
    publish();
  }

  async function loadExclusions(): Promise<void> {
    try {
      data.exclusions = { status: 'ready', items: await getExcludedSeries() };
    } catch (error: unknown) {
      log.error('Lecture des séries exclues impossible :', error);
      data.exclusions = { status: 'error' };
    }
    publish();
  }

  /**
   * Raccourcis « valider l'épisode » et « ouvrir le panneau » (nom propre à la cible : voir protocol/commands.ts). Relus
   * quand la vue reprend le focus : la touche a pu être changée dans la page des raccourcis du navigateur (panneau resté ouvert).
   */
  async function loadShortcuts(): Promise<void> {
    try {
      const commands = await chrome.commands.getAll();
      const shortcutOf = (name: string): string => commands.find((c) => c.name === name)?.shortcut ?? '';
      shortcuts.set({ shortcut: shortcutOf(COMPLETE_EPISODE_COMMAND), panelShortcut: shortcutOf(panelCommandName(__SYNCKAI_TARGET__)) });
    } catch (error: unknown) {
      log.warn('Lecture des raccourcis impossible :', error);
      shortcuts.set({ shortcut: '', panelShortcut: '' });
    }
  }

  async function loadSettings(): Promise<void> {
    try {
      data.settings = await getSettings();
      data.settingsError = false;
    } catch (error: unknown) {
      log.error('Lecture des réglages impossible :', error);
      data.settingsError = true;
    }
    publish();
  }

  async function loadAiring(): Promise<void> {
    try {
      const stored = await chrome.storage.local.get(AIRING_RESULT_KEY);
      setAiring(stored[AIRING_RESULT_KEY]);
    } catch (error: unknown) {
      log.warn('Lecture du résumé des alertes impossible :', error);
    }
  }

  function setAiring(value: unknown): void {
    data.airing = isAiringCheckResult(value) ? value : null;
    state.set({ ...data });
  }

  const ctx: SettingsContext = {
    host,
    data,
    state,
    shortcuts,
    update,
    refreshMappings,
    refreshJournal,
    openCategory: (page) => dispatch({ type: 'open', page }),
  };

  // ─── Pages ───

  const pages: Record<SettingsSubPage, SettingsMountedPage> = {
    accounts: createAccountsPage(ctx),
    sync: createSyncPage(ctx),
    platforms: createPlatformsPage(ctx),
    notifications: createNotificationsPage(ctx),
    display: createDisplayPage(ctx),
    data: createDataPage(ctx),
    help: createHelpPage(ctx),
    mappings: createMappingsPage(ctx),
    exclusions: createExclusionsPage(ctx),
    language: createLanguagePage(ctx),
    shortcuts: createShortcutsPage(ctx),
    compare: createComparePage(ctx),
  };

  /** Contenu de la page affichée ; `key` : changer de page démonte l'hôte de la précédente (page Preact démontée) */
  function Body() {
    const page = nav.page;
    if (page === 'home') {
      return (
        <SettingsHome
          data={data}
          accounts={{ anilist: accountLink(host.accounts.anilist.get()), mal: accountLink(host.accounts.mal.get()) }}
          version={version}
          onOpen={(category) => dispatch({ type: 'open', page: category })}
          onUpdate={(patch) => void update(patch)}
        />
      );
    }
    return <MountedPageHost key={page} view={pages[page]} />;
  }

  function drawPage(): void {
    if (disposed) return;
    render(<Body />, element);
  }

  /** Nouvel instantané pour les pages (`state`) ; l'accueil, rendu depuis `data`, est redessiné */
  function publish(): void {
    state.set({ ...data });
    if (nav.page === 'home') drawPage();
  }

  // ─── Navigation ───

  function scroller(): HTMLElement | null {
    return element.closest<HTMLElement>('.sk-scroll');
  }

  function dispatch(action: SettingsNavAction): void {
    const from = nav.page;
    const { state: next, effect } = settingsNavReducer(nav, action);
    if (effect.kind === 'exit') {
      host.navigateBack();
      return;
    }
    const container = scroller();
    // Page parente quittée vers une page plus profonde : son défilement est gardé pour le retour
    if (container && next.page !== 'home' && settingsDepth(next.page) > settingsDepth(from)) scrolls.set(from, container.scrollTop);
    nav = next;
    if (next.page === from) return;
    drawBar();
    drawPage();
    if (container) container.scrollTop = effect.kind === 'focus-row' ? (scrolls.get(next.page) ?? 0) : 0;
    if (effect.kind === 'focus-heading') focusOpenedPage(next.page);
    if (effect.kind === 'focus-row') {
      const row = element.querySelector<HTMLElement>(`[data-focus="${settingsRowFocus(effect.page)}"]`);
      if (row) {
        row.focus({ preventScroll: true });
        row.scrollIntoView({ block: 'nearest' });
      } else {
        focusHeading();
      }
    }
  }

  function focusHeading(): void {
    bar.querySelector<HTMLElement>('[data-focus="settings-heading"]')?.focus({ preventScroll: true });
  }

  /** Page ouverte : focus sur l'élément qu'elle désigne (champ de recherche), sinon sur son titre */
  function focusOpenedPage(page: SettingsPage): void {
    const key = page === 'home' ? null : (pages[page].initialFocus?.() ?? null);
    const target = key === null ? null : element.querySelector<HTMLElement>(`[data-focus="${key}"]`);
    if (target) target.focus({ preventScroll: true });
    else focusHeading();
  }

  /** Échap : retour (page → parent, accueil → sortie des Réglages) sans fermer le popup */
  function onKeyDown(event: KeyboardEvent): void {
    if (event.key !== 'Escape' || event.defaultPrevented) return;
    event.preventDefault();
    event.stopPropagation();
    dispatch({ type: 'back' });
  }
  bar.addEventListener('keydown', onKeyDown);
  element.addEventListener('keydown', onKeyDown);

  // ─── Suivi du stockage et de la langue ───

  /** Écouteurs et minuteries retirés par `dispose` */
  const cleanups: (() => void)[] = [];

  const onStorageChange = (changes: Record<string, chrome.storage.StorageChange>, area: string): void => {
    if (area !== 'local') return;
    const settingsChange = changes[SETTINGS_STORAGE_KEY];
    if (settingsChange) {
      // Nos propres enregistrements reviennent ici : pas de nouveau rendu s'ils sont identiques
      const next = normalizeSettings(settingsChange.newValue);
      if (!data.settings || JSON.stringify(normalizeSettings(data.settings)) !== JSON.stringify(next)) {
        data.settings = next;
        data.settingsError = false;
        publish();
      }
    }
    if (changes[STORAGE_KEYS.mediaMappings]) void refreshMappings();
    if (changes[EXCLUDED_SERIES_KEY]) void loadExclusions();
    if (changes[DIAGNOSTICS_LOG_KEY]) void refreshJournal();
    const airingChange = changes[AIRING_RESULT_KEY];
    if (airingChange) setAiring(airingChange.newValue);
  };
  chrome.storage.onChanged.addListener(onStorageChange);
  cleanups.push(() => chrome.storage.onChanged.removeListener(onStorageChange));

  // Accès Netflix / Disney+ / Prime Video accordé ou retiré (ici, chrome://extensions, autre vue) : résumé de l'accueil,
  // interrupteurs et lecteur préféré (page Plateformes, par `state`) suivent le store de l'hôte (une seule paire
  // d'écouteurs permissions.* par page)
  cleanups.push(
    host.platformAccess.subscribe((granted) => {
      if (granted === data.platformAccess) return;
      data.platformAccess = granted;
      publish();
    }),
  );

  // Comptes connectés ou déconnectés (ici ou ailleurs) : carte Comptes de l'accueil ; la page Comptes suit les stores
  cleanups.push(host.accounts.anilist.subscribe(() => publish()));
  cleanups.push(host.accounts.mal.subscribe(() => publish()));

  // Langue changée (popup, panneau latéral) : tout est retraduit en place, sans rechargement
  cleanups.push(
    onLocaleChange(() => {
      drawBar();
      publish();
    }),
  );

  drawBar();
  drawPage();
  void loadSettings();
  void refreshMappings();
  void loadExclusions();
  void refreshJournal();
  void loadAiring();
  void loadShortcuts();
  const onFocus = (): void => void loadShortcuts();
  window.addEventListener('focus', onFocus);
  cleanups.push(() => window.removeEventListener('focus', onFocus));

  return {
    bar,
    element,
    dispose() {
      for (const cleanup of cleanups.splice(0)) cleanup();
      clearTimeout(badgeTimer);
      // Arbres démontés : la page Preact encore montée retire ses abonnements (stores, langue)
      render(null, element);
      render(null, bar);
      disposed = true;
    },
    show(page = 'home') {
      // Nouvelle entrée : les pages repartent du haut
      scrolls.clear();
      dispatch({ type: 'reset' });
      // Le reset ne redessine pas si l'on était déjà sur l'accueil : rendu explicite
      drawBar();
      drawPage();
      if (page !== 'home') dispatch({ type: 'open', page });
    },
  };
}
