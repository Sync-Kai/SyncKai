// Vue Réglages autonome, montée par le popup et par le panneau latéral : accueil par catégories
// (résumé de chaque réglage, interrupteurs rapides) et sous-pages. Elle lit et suit elle-même le stockage ;
// tout comportement propre à l'hôte passe par `SettingsHost`.
import { getLocale, onLocaleChange, t, type MessageKey } from '../../i18n';
import { AIRING_RESULT_KEY, isAiringCheckResult } from '../../shared/airing.types';
import { DIAGNOSTICS_LOG_KEY, readJournal } from '../../shared/error-journal';
import { EXCLUDED_SERIES_KEY, getExcludedSeries } from '../../shared/exclusions';
import { createLogger } from '../../shared/logger';
import { hasNetflixAccess } from '../../shared/netflix-access';
import { getSettings, normalizeSettings, saveSettings, SETTINGS_STORAGE_KEY, type LanguageSetting, type SyncSettings } from '../../shared/settings';
import { getMediaMappings, STORAGE_KEYS } from '../../shared/storage';
import { CARD, kanaLabel, segmented } from '../../popup/components/ui';
import { h, nodes, preserveFocus } from '../dom';
import { icon, type IconName } from '../icons';
import type { SettingsContext, SettingsData, SettingsHost, SettingsPageView } from './context';
import { INITIAL_SETTINGS_NAV, settingsNavReducer, type SettingsCategory, type SettingsNavAction, type SettingsPage } from './navigation';
import { createAccountsPage } from './page-accounts';
import { createDataPage } from './page-data';
import { createHelpPage } from './page-help';
import { createNotificationsPage } from './page-notifications';
import { createSyncPage, settingsPlaceholder } from './page-sync';
import { HELP_TEXT, navRow, rowsCard, settingsSection, toggleRow, type RowTint } from './rows';
import { accountLink, accountsSummary, dataSummary, helpSummary, languageSummary, notificationsSummary, syncSummary } from './summary';

const log = createLogger('settings');

const SAVED_BADGE_MS = 1_500;
const CLOCK_TICK_MS = 60_000;

export interface SettingsView {
  /** Barre (retour, titre, état d'enregistrement) : placée par l'hôte au-dessus de sa zone défilante */
  readonly bar: HTMLElement;
  /** Contenu de la page affichée : placé par l'hôte dans sa zone défilante */
  readonly element: HTMLElement;
  /** Page affichée */
  page(): SettingsPage;
  /** Entrée dans les Réglages : accueil, ou directement une sous-page (pastille de compte, rechargement) */
  show(page?: SettingsPage, options?: { focus?: boolean }): void;
  /** Réglages lus et page dessinée (restauration du défilement après un rechargement) */
  readonly ready: Promise<void>;
}

interface CategoryCopy {
  title: MessageKey;
  icon: IconName;
  tint: RowTint;
}

const CATEGORY_COPY: Record<SettingsCategory, CategoryCopy> = {
  accounts: { title: 'settings.section.accounts', icon: 'user', tint: 'anilist' },
  sync: { title: 'settings.cat.sync', icon: 'sync', tint: 'sakura' },
  notifications: { title: 'settings.cat.notifications', icon: 'bell', tint: 'butter' },
  data: { title: 'settings.cat.data', icon: 'folder', tint: 'lavender' },
  language: { title: 'settings.section.language', icon: 'globe', tint: 'mint' },
  help: { title: 'settings.cat.help', icon: 'help', tint: 'muted' },
};

/** Langues proposées : chacune dans sa propre langue, sauf « Automatique » (langue active) */
function languageOptions(): { value: LanguageSetting; label: string }[] {
  return [
    { value: 'auto', label: t('settings.language.auto') },
    { value: 'fr', label: 'Français' },
    { value: 'en', label: 'English' },
    { value: 'de', label: 'Deutsch' },
  ];
}

export function createSettingsView(host: SettingsHost): SettingsView {
  const version = chrome.runtime.getManifest().version;
  let nav = INITIAL_SETTINGS_NAV;
  /** Défilement de l'accueil, retrouvé au retour d'une sous-page */
  let homeScroll = 0;

  const data: SettingsData = {
    settings: null,
    settingsError: false,
    mappings: null,
    mappingsError: null,
    exclusions: { status: 'loading' },
    journalCount: null,
    airing: null,
    shortcut: undefined,
    netflixAccess: undefined,
  };

  // ─── Coque : barre + contenu ───
  const status = h('span', { class: 'flex h-9 items-center gap-1 bg-ground pl-2 text-[11px] font-bold opacity-0 transition-opacity', attrs: { 'aria-live': 'polite' } });
  const bar = h('div', { class: 'relative flex h-11 shrink-0 items-start gap-2 px-4' });
  const element = h('div', { class: 'flex flex-col gap-4 pb-3' });
  let badgeTimer: ReturnType<typeof setTimeout> | undefined;

  function showStatus(ok: boolean): void {
    clearTimeout(badgeTimer);
    status.className = `flex h-9 items-center gap-1 bg-ground pl-2 text-[11px] font-bold transition-opacity ${ok ? 'text-mint' : 'text-danger'}`;
    status.replaceChildren(icon(ok ? 'check' : 'alert', 'h-3 w-3', ok ? '3' : '2'), ok ? t('settings.status.saved') : t('settings.status.failed'));
    status.title = ok ? '' : t('settings.status.failedTitle');
    // L'erreur reste affichée : l'interface ne reflète plus le stockage
    if (ok) badgeTimer = setTimeout(() => status.classList.add('opacity-0'), SAVED_BADGE_MS);
  }

  function drawBar(): void {
    const page = nav.page;
    const home = page === 'home';
    const title = page === 'home' ? t('nav.settings') : t(CATEGORY_COPY[page].title);
    preserveFocus(bar, () =>
      bar.replaceChildren(
        ...nodes([
          h(
            'button',
            {
              class: `flex h-9 shrink-0 cursor-pointer items-center gap-1 rounded-full bg-surface pr-3 pl-2 text-[13px] font-bold text-ink transition-colors hover:bg-raised ${home ? 'min-w-[76px]' : 'max-w-[45%]'}`,
              attrs: { type: 'button', 'data-focus': home ? 'back' : 'settings-home', ...(home ? {} : { 'aria-label': t('settings.backHomeAria') }) },
              on: { click: () => dispatch({ type: 'back' }) },
            },
            icon('back', 'h-4 w-4', '2.4'),
            h('span', { class: 'truncate' }, home ? t('nav.back') : t('nav.settings')),
          ),
          h(
            'div',
            { class: 'flex h-9 min-w-0 flex-1 items-center justify-center gap-1.5' },
            h(
              'h1',
              {
                class: `m-0 truncate font-display font-extrabold outline-none ${home ? 'text-[15px]' : 'text-[14px]'}`,
                attrs: { id: 'sk-settings-title', tabindex: '-1', 'data-focus': 'settings-heading' },
              },
              title,
            ),
            home && kanaLabel('セッテイ', 'shrink-0 text-sakura max-[360px]:hidden'),
          ),
          // Accueil : espace symétrique du bouton Retour (titre centré). Sous-page : le titre prend toute la place,
          // l'état d'enregistrement s'affiche par-dessus le temps de sa présence (panneau étroit, allemand)
          home && h('div', { class: 'h-9 w-[76px] shrink-0 max-[360px]:hidden' }),
          h('div', { class: 'pointer-events-none absolute top-0 right-4 flex h-9 items-center' }, status),
        ]),
      ),
    );
  }

  // ─── Contexte des pages ───

  async function update(patch: Partial<SyncSettings>, redrawPage = false): Promise<void> {
    if (!data.settings) return;
    data.settings = { ...data.settings, ...patch };
    // Accueil : les résumés suivent chaque changement
    if (redrawPage || nav.page === 'home') drawPage();
    try {
      await saveSettings(data.settings);
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
    redraw(['home', 'data']);
  }

  async function refreshJournal(): Promise<void> {
    try {
      data.journalCount = (await readJournal()).length;
    } catch {
      data.journalCount = null;
    }
    redraw(['home', 'help']);
  }

  async function loadExclusions(): Promise<void> {
    try {
      data.exclusions = { status: 'ready', items: await getExcludedSeries() };
    } catch (error: unknown) {
      log.error('Lecture des séries exclues impossible :', error);
      data.exclusions = { status: 'error' };
    }
    redraw(['home', 'data']);
  }

  async function loadShortcut(): Promise<void> {
    try {
      const commands = await chrome.commands.getAll();
      data.shortcut = commands.find((c) => c.name === 'complete-episode')?.shortcut ?? '';
    } catch (error: unknown) {
      log.warn('Lecture du raccourci impossible :', error);
      data.shortcut = '';
    }
    redraw(['sync']);
  }

  /** Accès Netflix relu (ouverture, ou permission changée ici ou dans chrome://extensions) */
  async function loadNetflixAccess(): Promise<void> {
    data.netflixAccess = await hasNetflixAccess();
    redraw(['home', 'sync']);
  }

  async function loadSettings(): Promise<void> {
    try {
      data.settings = await getSettings();
      data.settingsError = false;
    } catch (error: unknown) {
      log.error('Lecture des réglages impossible :', error);
      data.settingsError = true;
    }
    redraw();
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
    notifications.drawAiring(Date.now());
  }

  const ctx: SettingsContext = { host, data, update, redraw, refreshMappings, refreshJournal, refreshNetflixAccess: loadNetflixAccess };

  // ─── Pages ───

  const notifications = createNotificationsPage(ctx);
  const pages: Record<SettingsCategory, SettingsPageView> = {
    accounts: createAccountsPage(ctx),
    sync: createSyncPage(ctx),
    notifications,
    data: createDataPage(ctx),
    language: { render: renderLanguage },
    help: createHelpPage(ctx),
  };

  function renderLanguage(): Node[] {
    const s = data.settings;
    if (!s) return settingsPlaceholder(ctx);
    return [
      h(
        'section',
        { class: 'flex flex-col gap-2' },
        h('h2', { class: 'm-0 text-[11px] font-bold tracking-[0.06em] text-muted uppercase', attrs: { id: 'sk-language-label' } }, t('settings.section.language')),
        h(
          'div',
          { class: `${CARD} flex flex-col gap-2 p-3` },
          segmented({
            options: languageOptions(),
            current: s.language,
            // Enregistré tout de suite : la vue se redessine dans la nouvelle langue (storage.onChanged)
            onPick: (value) => void update({ language: value }, true),
            attrs: { 'aria-labelledby': 'sk-language-label', 'aria-describedby': 'sk-language-help' },
            focusKey: 'language',
            activeClass: 'bg-sakura',
            trackClass: 'bg-ground self-start',
          }),
          h('span', { class: HELP_TEXT, attrs: { id: 'sk-language-help' } }, t('settings.language.help')),
        ),
      ),
    ];
  }

  function categoryRow(category: SettingsCategory, summary: { text: string; tone: 'muted' | 'danger' }, divider: boolean): HTMLElement {
    const copy = CATEGORY_COPY[category];
    return navRow({
      focusKey: `settings-cat-${category}`,
      iconName: copy.icon,
      tint: copy.tint,
      title: t(copy.title),
      summary: summary.text,
      summaryTone: summary.tone,
      onClick: () => dispatch({ type: 'open', category }),
      divider,
    });
  }

  function renderHome(): Node[] {
    const s = data.settings;
    const muted = (text: string): { text: string; tone: 'muted' } => ({ text, tone: 'muted' });
    const loading = t('settings.summary.loading');
    const excluded = data.exclusions.status === 'ready' ? data.exclusions.items.length : null;
    const { accounts } = host;

    return nodes([
      s
        ? settingsSection(
            t('settings.group.quick'),
            rowsCard(
              toggleRow({ id: 'sk-quick-auto', label: t('settings.autoSync.label'), help: t(s.autoSync ? 'settings.autoSync.helpOn' : 'settings.autoSync.helpOff'), checked: s.autoSync, onChange: (checked) => void update({ autoSync: checked }) }),
              toggleRow({
                id: 'sk-quick-airing',
                label: t('settings.quick.airing.label'),
                help: t('settings.quick.airing.help'),
                checked: s.airingAlerts,
                onChange: (checked) => void update({ airingAlerts: checked }),
                divider: true,
              }),
            ),
          )
        : settingsPlaceholder(ctx)[0],
      rowsCard(categoryRow('accounts', accountsSummary({ anilist: accountLink(accounts.anilist.get()), mal: accountLink(accounts.mal.get()) }), false)),
      settingsSection(
        t('settings.group.daily'),
        rowsCard(
          categoryRow('sync', muted(s ? syncSummary(s, data.netflixAccess) : loading), false),
          categoryRow('notifications', muted(s ? notificationsSummary(s) : loading), true),
        ),
      ),
      settingsSection(
        t('settings.group.more'),
        rowsCard(
          categoryRow('data', muted(dataSummary(data.mappings?.length ?? null, excluded)), false),
          categoryRow('language', muted(s ? languageSummary(s.language, getLocale()) : loading), true),
          categoryRow('help', muted(helpSummary(version, data.journalCount)), true),
        ),
      ),
    ]).filter((child): child is Node => typeof child !== 'string');
  }

  function drawPage(): void {
    preserveFocus(element, () => element.replaceChildren(...(nav.page === 'home' ? renderHome() : pages[nav.page].render())));
  }

  function redraw(only?: readonly SettingsPage[]): void {
    if (!only || only.includes(nav.page)) drawPage();
  }

  // ─── Navigation ───

  function scroller(): HTMLElement | null {
    return element.closest<HTMLElement>('.sk-scroll');
  }

  function dispatch(action: SettingsNavAction, focus = true): void {
    const from = nav.page;
    const { state, effect } = settingsNavReducer(nav, action);
    if (effect.kind === 'exit') {
      host.navigateBack();
      return;
    }
    const container = scroller();
    if (from === 'home' && state.page !== 'home' && container) homeScroll = container.scrollTop;
    nav = state;
    if (state.page === from) return;
    drawBar();
    drawPage();
    if (container) container.scrollTop = state.page === 'home' ? homeScroll : 0;
    if (!focus) return;
    if (effect.kind === 'focus-heading') bar.querySelector<HTMLElement>('[data-focus="settings-heading"]')?.focus({ preventScroll: true });
    if (effect.kind === 'focus-row') {
      const row = element.querySelector<HTMLElement>(`[data-focus="settings-cat-${effect.category}"]`);
      row?.focus({ preventScroll: true });
      row?.scrollIntoView({ block: 'nearest' });
    }
  }

  /** Échap : retour (sous-page → accueil, accueil → sortie des Réglages) sans fermer le popup */
  function onKeyDown(event: KeyboardEvent): void {
    if (event.key !== 'Escape' || event.defaultPrevented) return;
    event.preventDefault();
    event.stopPropagation();
    dispatch({ type: 'back' });
  }
  bar.addEventListener('keydown', onKeyDown);
  element.addEventListener('keydown', onKeyDown);

  // ─── Suivi du stockage et de la langue ───

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    const settingsChange = changes[SETTINGS_STORAGE_KEY];
    if (settingsChange) {
      // Nos propres enregistrements reviennent ici : pas de nouveau rendu s'ils sont identiques
      const next = normalizeSettings(settingsChange.newValue);
      if (!data.settings || JSON.stringify(normalizeSettings(data.settings)) !== JSON.stringify(next)) {
        data.settings = next;
        data.settingsError = false;
        redraw(['home', 'sync', 'notifications', 'language']);
      }
    }
    if (changes[STORAGE_KEYS.mediaMappings]) void refreshMappings();
    if (changes[EXCLUDED_SERIES_KEY]) void loadExclusions();
    if (changes[DIAGNOSTICS_LOG_KEY]) void refreshJournal();
    const airingChange = changes[AIRING_RESULT_KEY];
    if (airingChange) setAiring(airingChange.newValue);
  });

  // Accès Netflix accordé ou retiré ailleurs (chrome://extensions, autre vue) : interrupteur et lecteur préféré suivent
  if (typeof chrome.permissions?.onAdded?.addListener === 'function') {
    chrome.permissions.onAdded.addListener(() => void loadNetflixAccess());
    chrome.permissions.onRemoved.addListener(() => void loadNetflixAccess());
  }

  // Comptes connectés ou déconnectés (ici ou ailleurs) : carte Comptes et résumé de l'accueil
  host.accounts.anilist.subscribe(() => redraw(['home', 'accounts']));
  host.accounts.mal.subscribe(() => redraw(['home', 'accounts']));

  // Langue changée sans rechargement (panneau latéral) : tout est retraduit
  onLocaleChange(() => {
    drawBar();
    drawPage();
  });

  // « Dernière vérification il y a… » vieillit tant que la vue reste ouverte
  setInterval(() => {
    if (nav.page === 'notifications') notifications.drawAiring(Date.now());
  }, CLOCK_TICK_MS);

  drawBar();
  drawPage();
  const ready = loadSettings();
  void refreshMappings();
  void loadExclusions();
  void refreshJournal();
  void loadAiring();
  void loadShortcut();
  void loadNetflixAccess();

  return {
    bar,
    element,
    page: () => nav.page,
    show(page = 'home', options = {}) {
      // Nouvelle entrée : l'accueil repart du haut
      homeScroll = 0;
      dispatch({ type: 'reset' });
      // Le reset ne redessine pas si l'on était déjà sur l'accueil : rendu explicite
      drawBar();
      drawPage();
      if (page !== 'home') dispatch({ type: 'open', category: page }, options.focus ?? true);
    },
    ready,
  };
}
