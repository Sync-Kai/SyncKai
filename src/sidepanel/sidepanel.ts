import { initI18n, onLocaleChange, t, type MessageKey } from '../i18n';
import { kanaLabel } from '../ui/kit';
import { createLogger } from '../shared/logger';
import { getSettings } from '../shared/settings';
import { sidePanelKind } from '../shared/side-panel';
import { createAccountsController } from '../ui/accounts';
import { createSettingsView, type SettingsView } from '../ui/settings/settings-view';
import { h, preserveFocus } from '../ui/dom';
import { icon, kai, type IconName } from '../ui/icons';
import { createNowPlaying } from './components/now-playing';
import { createAgenda, type AgendaView } from './components/agenda';
import { watchPanelContext, type PanelContext } from './presence';
import { initialPanelTab, isTabEntering, nextTabIndex, PANEL_LAST_TAB_KEY, PANEL_TABS, type PanelTab } from './tabs';

const log = createLogger('sidepanel');

// Coque du panneau latéral : en-tête (bouton Réglages) + onglets « En lecture » / « Agenda ».
// Les Réglages sont la même vue que dans le popup (src/ui/settings), affichée à la place des onglets.

interface TabCopy {
  label: MessageKey;
  soon: MessageKey;
  icon: IconName;
}

const TAB_COPY: Record<PanelTab, TabCopy> = {
  nowPlaying: { label: 'panel.tab.nowPlaying', soon: 'panel.nowPlaying.soon', icon: 'screen' },
  agenda: { label: 'panel.tab.agenda', soon: 'panel.agenda.soon', icon: 'calendar' },
};

let context: PanelContext = { status: 'checking' };
let selected: PanelTab = 'nowPlaying';

const app = document.getElementById('app');
const nowPlaying = createNowPlaying(() => render());

function selectTab(tab: PanelTab, focus: boolean): void {
  const changed = tab !== selected;
  selected = tab;
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
  const copy = TAB_COPY[selected];
  return selected === 'nowPlaying'
    ? nowPlaying.render()
    : selected === 'agenda'
      ? mountAgenda(entering)
    : h(
        'div',
        { class: 'flex flex-col items-center gap-2 rounded-card bg-surface px-4 py-6 text-center' },
        icon(copy.icon, 'h-6 w-6 text-lavender'),
        h('span', { class: 'rounded-full bg-raised px-2 py-0.5 text-[11px] font-bold text-butter' }, t('panel.soon')),
        h('p', { class: 'm-0 max-w-[260px] text-muted' }, t(copy.soon)),
      );
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

/** Hors Crunchyroll / ADN (Firefox, ou Chrome juste avant la fermeture) : une seule ligne neutre */
function renderNotice(text: string, busy: boolean): HTMLElement {
  return h(
    'div',
    { class: 'flex flex-1 items-center justify-center gap-2 px-4 text-center text-muted', attrs: { role: 'status' } },
    busy && icon('spinner', 'h-3.5 w-3.5 shrink-0 motion-safe:animate-spin'),
    h('p', { class: 'm-0' }, text),
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
    } else if (context.status === 'target') {
      mount(app, [header, tabBar, tabPanel]);
      tabBar.replaceChildren(renderTabList());
      fillTabPanel();
    } else {
      // Le panneau d'onglet quitte le DOM : sa position sera perdue, on repartira du haut
      shownTab = null;
      app.replaceChildren(header, renderNotice(t(context.status === 'checking' ? 'panel.checking' : 'panel.offTarget'), context.status === 'checking'));
    }
  });
}

function setContext(next: PanelContext): void {
  context = next;
  nowPlaying.setTab(next.status === 'target' ? next.tabId : null);
  render();
}

/** Onglet à l'ouverture : réglage « Onglet à l'ouverture » (dernier onglet consulté par défaut) */
async function loadInitialTab(): Promise<void> {
  try {
    const [settings, stored] = await Promise.all([getSettings(), chrome.storage.local.get(PANEL_LAST_TAB_KEY)]);
    selected = initialPanelTab(settings.panelDefaultTab, stored[PANEL_LAST_TAB_KEY]);
  } catch (error: unknown) {
    log.debug('Onglet initial illisible :', error);
  }
}

async function main(): Promise<void> {
  await Promise.all([initI18n(), loadInitialTab()]);
  onLocaleChange(() => {
    // Agenda affiché : textes et premier jour de la semaine à jour (il n'est plus réactivé à chaque rendu)
    if (shownTab === 'agenda') agenda?.activate();
    render();
  });
  render();
  const kind = sidePanelKind();
  if (!kind) {
    setContext({ status: 'off' });
    return;
  }
  try {
    await watchPanelContext(kind, setContext);
  } catch (error: unknown) {
    log.warn('Onglet du panneau illisible :', error);
    setContext({ status: 'off' });
  }
}

void main();
