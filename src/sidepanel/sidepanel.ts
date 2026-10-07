import { initI18n, onLocaleChange, t, type MessageKey } from '../i18n';
import { kanaLabel } from '../popup/components/ui';
import { createLogger } from '../shared/logger';
import { sidePanelKind } from '../shared/side-panel';
import { h, preserveFocus } from '../ui/dom';
import { icon, kai, type IconName } from '../ui/icons';
import { createNowPlaying } from './components/now-playing';
import { createAgenda, type AgendaView } from './components/agenda';
import { watchPanelContext, type PanelContext } from './presence';
import { nextTabIndex, PANEL_TABS, type PanelTab } from './tabs';

const log = createLogger('sidepanel');

// Coque du panneau latéral : en-tête + onglets « En lecture » / « Agenda ».
// Le contenu des onglets arrive dans les versions suivantes (épisode en cours, agenda des sorties).

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
  selected = tab;
  render();
  if (focus) document.getElementById(`sk-tab-${tab}`)?.focus();
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
  );
}

/** Liste d'onglets ARIA : flèches, Début/Fin, un seul onglet atteignable par Tab (tabindex itinérant) */
function renderTabList(): HTMLElement {
  return h(
    'div',
    { class: 'flex h-11 shrink-0 items-start px-4' },
    h(
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
    ),
  );
}

/** Contenu provisoire d'un onglet (rempli par les prochaines versions) */
function renderTabPanel(): HTMLElement {
  const copy = TAB_COPY[selected];
  return h(
    'section',
    {
      class: 'sk-scroll min-h-0 flex-1 overflow-y-auto px-4 pt-1 pb-3',
      attrs: { role: 'tabpanel', id: `sk-tabpanel-${selected}`, 'aria-labelledby': `sk-tab-${selected}`, tabindex: '0' },
    },
    selected === 'nowPlaying'
      ? nowPlaying.render()
      : selected === 'agenda'
        ? mountAgenda()
      : h(
          'div',
          { class: 'flex flex-col items-center gap-2 rounded-card bg-surface px-4 py-6 text-center' },
          icon(copy.icon, 'h-6 w-6 text-lavender'),
          h('span', { class: 'rounded-full bg-raised px-2 py-0.5 text-[11px] font-bold text-butter' }, t('panel.soon')),
          h('p', { class: 'm-0 max-w-[260px] text-muted' }, t(copy.soon)),
        ),
  );
}

/** Onglet « Agenda » : créé au premier affichage puis conservé (semaine affichée, cache en mémoire) */
let agenda: AgendaView | null = null;
function mountAgenda(): HTMLElement {
  agenda ??= createAgenda();
  agenda.activate();
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
  // Le contenu est recréé à chaque rendu : la position de défilement de l'onglet est conservée
  const previous = app.querySelector<HTMLElement>('[role="tabpanel"]');
  preserveFocus(app, () => {
    if (context.status === 'target') app.replaceChildren(renderHeader(), renderTabList(), renderTabPanel());
    else if (context.status === 'checking') app.replaceChildren(renderHeader(), renderNotice(t('panel.checking'), true));
    else app.replaceChildren(renderHeader(), renderNotice(t('panel.offTarget'), false));
  });
  const next = app.querySelector<HTMLElement>('[role="tabpanel"]');
  if (previous && next && previous.id === next.id) next.scrollTop = previous.scrollTop;
}

function setContext(next: PanelContext): void {
  context = next;
  nowPlaying.setTab(next.status === 'target' ? next.tabId : null);
  render();
}

async function main(): Promise<void> {
  await initI18n();
  onLocaleChange(render);
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
