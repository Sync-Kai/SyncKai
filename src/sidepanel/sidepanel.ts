import { initI18n, joinSentences, onLocaleChange, t, type MessageKey } from '../i18n';
import { kanaLabel } from '../ui/kit';
import { createLogger } from '../browser/logger';
import type { StreamingPlatform } from '../shared/episode.types';
import { activePlatforms, grantedOptionalPlatforms, requestPlatformAccess } from '../browser/platform-access';
import { isOptionalPlatform, PLATFORMS, STREAMING_PLATFORMS } from '../platforms/registry';
import { getSettings } from '../browser/storage/settings-access';
import { sidePanelKind } from '../browser/side-panel';
import { createAccountsController } from '../ui/accounts';
import { formatPlatformList } from '../ui/platform-list';
import { settingsPath } from '../ui/settings/navigation';
import { createSettingsView, type SettingsView } from '../ui/settings/settings-view';
import { h, preserveFocus } from '../ui/dom';
import { icon, kai, type IconName } from '../ui/icons';
import { createNowPlaying } from './components/now-playing';
import { createAgenda, type AgendaView } from './components/agenda';
import { watchPanelContext, type PanelContext } from './presence';
import { listenPanelToggle } from './toggle';
import { followPageContext, initialPanelTab, isTabEntering, nextTabIndex, PANEL_LAST_TAB_KEY, PANEL_TABS, type PanelTab } from './tabs';

const log = createLogger('sidepanel');

// Coque du panneau latéral : en-tête (bouton Réglages) + onglets « En lecture » / « Agenda ».
// Les Réglages sont la même vue que dans le popup (src/ui/settings), affichée à la place des onglets.

interface TabCopy {
  label: MessageKey;
  icon: IconName;
}

const TAB_COPY: Record<PanelTab, TabCopy> = {
  nowPlaying: { label: 'panel.tab.nowPlaying', icon: 'screen' },
  agenda: { label: 'panel.tab.agenda', icon: 'calendar' },
};

let context: PanelContext = { status: 'checking' };
let selected: PanelTab = 'nowPlaying';
/** Agenda choisi par le panneau lui-même (onglet suivi hors streaming) : « En lecture » revient sur une page de streaming */
let autoSelected = false;

const app = document.getElementById('app');
const nowPlaying = createNowPlaying(() => render());

/** Choix de l'utilisateur (clic, clavier) : seul mémorisé comme « dernier onglet » */
function selectTab(tab: PanelTab, focus: boolean): void {
  const changed = tab !== selected;
  selected = tab;
  autoSelected = false;
  render();
  if (focus) document.getElementById(`sk-tab-${tab}`)?.focus();
  // Mémorisé pour le réglage « Onglet à l'ouverture : Dernier ouvert »
  if (changed) chrome.storage.local.set({ [PANEL_LAST_TAB_KEY]: tab }).catch((error: unknown) => log.debug('Dernier onglet non mémorisé :', error));
}

// ─── Réglages (même vue que le popup) ───

let settingsOpen = false;
let settingsView: SettingsView | null = null;
/** Zone défilante des Réglages (jamais retirée du DOM pendant l'affichage : défilement conservé) */
const settingsScroll = h('main', { class: 'sk-scroll min-h-0 flex-1 overflow-y-auto px-4 pt-1 pb-3' });

/** Créée à la première ouverture : comptes lus seulement si l'utilisateur ouvre les Réglages */
function getSettingsView(): SettingsView {
  if (settingsView) return settingsView;
  const accounts = createAccountsController();
  void accounts.bootstrapAll();
  settingsView = createSettingsView({
    navigateBack: () => setSettingsOpen(false),
    openTab: (url) => void chrome.tabs.create({ url }),
    closesOnBlur: false,
    accounts,
  });
  settingsScroll.append(settingsView.element);
  return settingsView;
}

function setSettingsOpen(open: boolean): void {
  if (open === settingsOpen) return;
  settingsOpen = open;
  if (open) getSettingsView().show();
  render();
  // Fermeture : focus rendu au bouton Réglages de l'en-tête
  if (!open) gearButton.focus({ preventScroll: true });
}

const gearButton = h('button', {
  class: 'ml-auto flex h-8 w-8 cursor-pointer items-center justify-center rounded-full transition-colors hover:bg-raised',
  attrs: { type: 'button', 'data-focus': 'gear' },
  on: { click: () => setSettingsOpen(!settingsOpen) },
});
gearButton.append(icon('gear', 'h-[18px] w-[18px]'));

/** État du bouton Réglages (libellé traduit, enfoncé quand les Réglages sont affichés) */
function syncGearButton(): void {
  gearButton.setAttribute('aria-label', t('nav.settings'));
  gearButton.title = t('nav.settings');
  gearButton.setAttribute('aria-pressed', String(settingsOpen));
  gearButton.classList.toggle('bg-raised', settingsOpen);
  gearButton.classList.toggle('text-sakura', settingsOpen);
  gearButton.classList.toggle('bg-surface', !settingsOpen);
  gearButton.classList.toggle('text-muted', !settingsOpen);
}

function renderHeader(): HTMLElement {
  return h(
    'header',
    { class: 'flex h-14 shrink-0 items-center gap-2 px-4' },
    kai('h-6 w-6', { size: 'small', tile: true }),
    h(
      'div',
      { class: 'flex items-baseline gap-1.5' },
      h('h1', { class: 'm-0 font-display text-[15px] font-extrabold tracking-[0.2px]' }, 'SyncKai'),
      kanaLabel('シンカイ'),
    ),
    gearButton,
  );
}

/** Liste d'onglets ARIA : flèches, Début/Fin, un seul onglet atteignable par Tab (tabindex itinérant) */
function renderTabList(): HTMLElement {
  return h(
    'div',
    { class: 'flex flex-1 gap-1 rounded-full bg-surface p-0.5', attrs: { role: 'tablist', 'aria-label': t('panel.tabs') } },
    ...PANEL_TABS.map((tab, index) => {
      const on = tab === selected;
      return h(
        'button',
        {
          class: `flex h-9 min-w-0 flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-full text-[13px] transition-colors ${on ? 'bg-sakura font-bold text-on-fill' : 'font-semibold text-muted hover:text-ink'}`,
          attrs: {
            type: 'button',
            role: 'tab',
            id: `sk-tab-${tab}`,
            'aria-selected': String(on),
            'aria-controls': `sk-tabpanel-${tab}`,
            tabindex: on ? '0' : '-1',
            'data-focus': `tab-${tab}`,
          },
          on: {
            click: () => selectTab(tab, false),
            keydown: (event) => {
              const next = nextTabIndex(index, event.key, PANEL_TABS.length);
              if (next === null) return;
              event.preventDefault();
              selectTab(PANEL_TABS[next], true);
            },
          },
        },
        icon(TAB_COPY[tab].icon, 'h-4 w-4 shrink-0'),
        h('span', { class: 'truncate' }, t(TAB_COPY[tab].label)),
      );
    }),
  );
}

// Coque persistante : seuls les contenus sont recréés. Le conteneur de défilement n'est jamais retiré du DOM
// (un élément détaché perd sa position de défilement : le panneau remontait en haut à chaque action).
const header = renderHeader();
const tabBar = h('div', { class: 'flex h-11 shrink-0 items-start px-4' });
const tabPanel = h('section', { class: 'sk-scroll min-h-0 flex-1 overflow-y-auto px-4 pt-1 pb-3', attrs: { role: 'tabpanel', tabindex: '0' } });
/** Position de défilement de chaque onglet, restaurée au retour sur l'onglet */
const scrollByTab: Partial<Record<PanelTab, number>> = {};
let shownTab: PanelTab | null = null;

function fillTabPanel(): void {
  const entering = isTabEntering(shownTab, selected);
  if (shownTab !== null && entering) scrollByTab[shownTab] = tabPanel.scrollTop;
  tabPanel.id = `sk-tabpanel-${selected}`;
  tabPanel.setAttribute('aria-labelledby', `sk-tab-${selected}`);
  tabPanel.replaceChildren(renderTabContent(entering));
  if (entering) tabPanel.scrollTop = scrollByTab[selected] ?? 0;
  shownTab = selected;
}

/** Remplace les enfants de #app seulement si la structure change (sinon les nœuds restent en place) */
function mount(container: HTMLElement, children: readonly HTMLElement[]): void {
  const current = container.children;
  if (current.length === children.length && children.every((child, i) => current[i] === child)) return;
  container.replaceChildren(...children);
}

/** Contenu de l'onglet sélectionné ; `entering` : l'onglet devient visible (pas un simple nouveau rendu) */
function renderTabContent(entering: boolean): HTMLElement {
  if (selected === 'agenda') return mountAgenda(entering);
  return context.status === 'off' ? renderNotice(offTargetText(), false, disabledPlatforms().map(renderEnableButton), true) : nowPlaying.render();
}

/**
 * Onglet « Agenda » : créé au premier affichage puis conservé (semaine affichée, cache en mémoire).
 * Activé seulement quand il devient visible : les rendus dus à « En lecture » (détection, relecture, réglage)
 * relançaient le chargement et jetaient la réponse GET_AGENDA en cours, erreur comprise.
 */
let agenda: AgendaView | null = null;
function mountAgenda(entering: boolean): HTMLElement {
  agenda ??= createAgenda();
  if (entering) agenda.activate();
  return agenda.element;
}

/**
 * Ligne neutre : vérification de l'onglet à l'ouverture (panneau entier), ou « En lecture » hors page de streaming
 * (`inTab` : dans l'onglet, sous la barre d'onglets)
 */
function renderNotice(text: string, busy: boolean, actions: readonly HTMLElement[] = [], inTab = false): HTMLElement {
  return h(
    'div',
    { class: `flex flex-col items-center gap-3 text-center text-muted ${inTab ? 'rounded-card bg-surface px-4 py-6' : 'flex-1 justify-center px-4'}`, attrs: inTab ? { 'data-off-target': '' } : {} },
    h(
      'div',
      { class: 'flex items-center justify-center gap-2', attrs: { role: 'status' } },
      busy && icon('spinner', 'h-3.5 w-3.5 shrink-0 motion-safe:animate-spin'),
      h('p', { class: 'm-0' }, text),
    ),
    actions.length > 0 && h('div', { class: 'flex flex-wrap justify-center gap-2' }, ...actions),
  );
}

function render(): void {
  if (!app) return;
  syncGearButton();
  preserveFocus(app, () => {
    if (settingsOpen && settingsView) {
      // Réglages affichés quel que soit l'onglet suivi ; l'onglet du panneau reprendra sa position au retour
      if (shownTab !== null) scrollByTab[shownTab] = tabPanel.scrollTop;
      shownTab = null;
      mount(app, [header, settingsView.bar, settingsScroll]);
    } else if (context.status !== 'checking') {
      // Page de streaming ou non : mêmes onglets ; hors streaming, « En lecture » affiche la ligne neutre
      mount(app, [header, tabBar, tabPanel]);
      tabBar.replaceChildren(renderTabList());
      fillTabPanel();
    } else {
      // Première vérification de l'onglet (l'onglet affiché en dépend) ; le panneau d'onglet quitte le DOM
      shownTab = null;
      app.replaceChildren(header, renderNotice(t('panel.checking'), true));
    }
  });
}

/** Plateformes à accès optionnel accordées (Netflix, Disney+), relues à chaque passage hors page cible */
let optionalPlatforms: readonly StreamingPlatform[] = [];

/** Ligne hors page cible (onglet « En lecture ») : plateformes réellement suivies (UX-05), puis celles qui restent à activer (ex. Disney+ si seul Netflix l'est) */
function offTargetText(): string {
  const active = t('panel.offTargetPlatforms', { platforms: formatPlatformList(activePlatforms(optionalPlatforms), 'conjunction') });
  const disabled = disabledPlatforms();
  if (disabled.length === 0) return active;
  return joinSentences([active, t('panel.offTargetEnable', { platforms: formatPlatformList(disabled, 'conjunction'), path: settingsPath('sync') })]);
}

/** Plateformes à accès optionnel encore désactivées (ordre de STREAMING_PLATFORMS) */
function disabledPlatforms(): StreamingPlatform[] {
  return STREAMING_PLATFORMS.filter((platform) => isOptionalPlatform(platform) && !optionalPlatforms.includes(platform));
}

/**
 * Bouton « Activer Disney+ » : même demande d'accès que l'interrupteur des Réglages. permissions.request est appelé
 * directement dans le gestionnaire (geste utilisateur exigé, aucun await avant) ; le panneau est redessiné à la réponse.
 */
function renderEnableButton(platform: StreamingPlatform): HTMLElement {
  const { label } = PLATFORMS[platform];
  return h(
    'button',
    {
      class: 'inline-flex h-9 cursor-pointer items-center rounded-full border border-line px-4 text-[13px] font-bold text-ink transition hover:bg-surface',
      attrs: { type: 'button', 'data-enable-platform': platform },
      on: {
        click: () => {
          requestPlatformAccess(platform).then(refreshOptionalPlatforms, (error: unknown) => log.warn(`Demande d’accès à ${label} impossible :`, error));
        },
      },
    },
    t('panel.enablePlatform', { platform: label }),
  );
}

/** Accès optionnels relus (hors page cible seulement) ; redessine si la liste a changé */
function refreshOptionalPlatforms(): void {
  if (context.status !== 'off') return;
  void grantedOptionalPlatforms().then((granted) => {
    if (granted.join() === optionalPlatforms.join()) return;
    optionalPlatforms = granted;
    render();
  });
}

function setContext(next: PanelContext): void {
  // Statut de la page changé (ouverture, ou passage d'une page de streaming à une autre page) : l'onglet suit
  if (next.status !== 'checking' && next.status !== context.status) {
    const follow = followPageContext({ tab: selected, auto: autoSelected }, next.status === 'target');
    selected = follow.tab;
    autoSelected = follow.auto;
  }
  context = next;
  nowPlaying.setTab(next.status === 'target' ? next.tabId : null);
  render();
  refreshOptionalPlatforms();
}

/**
 * Onglet à l'ouverture : réglage « Onglet à l'ouverture » (dernier onglet consulté par défaut). Hors page de streaming,
 * « En lecture » cède ensuite la place à l'Agenda (setContext).
 */
async function loadInitialTab(): Promise<void> {
  try {
    const [settings, stored] = await Promise.all([getSettings(), chrome.storage.local.get(PANEL_LAST_TAB_KEY)]);
    selected = initialPanelTab(settings.panelDefaultTab, stored[PANEL_LAST_TAB_KEY]);
  } catch (error: unknown) {
    log.debug('Onglet initial illisible :', error);
  }
}

async function main(): Promise<void> {
  // Raccourci « ouvrir ou fermer » (Chrome) : écoute posée avant tout await (instant de chargement au plus tôt)
  if (sidePanelKind() === 'chrome') listenPanelToggle();
  await Promise.all([initI18n(), loadInitialTab()]);
  // Accès accordé ou retiré (bouton ci-dessous, Réglages, about:addons) : la ligne hors page cible suit
  chrome.permissions?.onAdded?.addListener(refreshOptionalPlatforms);
  chrome.permissions?.onRemoved?.addListener(refreshOptionalPlatforms);
  onLocaleChange(() => {
    // Agenda affiché : textes et premier jour de la semaine à jour (il n'est plus réactivé à chaque rendu)
    if (shownTab === 'agenda') agenda?.activate();
    render();
  });
  render();
  if (!sidePanelKind()) {
    setContext({ status: 'off' });
    return;
  }
  try {
    await watchPanelContext(setContext);
  } catch (error: unknown) {
    log.warn('Onglet du panneau illisible :', error);
    setContext({ status: 'off' });
  }
}

void main();
