// Réglages › Aide › Trace de débogage (builds de dev seulement : créé sous `if (__SYNCKAI_DEBUG__)` par page-help.ts,
// absent des bundles publiés). Événements écrits par le service worker (background/debug-trace.ts) dans storage.session :
// les plus récents d'abord, filtre par catégorie ; « Copier la trace » donne toute la trace en JSON (à coller pour déboguer
// un cas réel), « Effacer » et le mode détaillé passent par le service worker.
import { getLocale, t } from '../../i18n';
import { clearTrace, readTraceEvents, readTraceVerbose, setTraceVerbose } from '../../browser/debug-trace-store';
import { DEBUG_TRACE_KEY, DEBUG_TRACE_VERBOSE_KEY } from '../../protocol/storage-keys';
import { TRACE_CATEGORIES, traceCapacity, type TraceCategory, type TraceEvent } from '../../shared/debug-trace';
import { createLogger } from '../../browser/logger';
import { BTN_GHOST, CARD } from '../kit';
import { h, type Child } from '../dom';
import { icon } from '../icons';
import { DIVIDER, HELP_TEXT, settingsSection, toggleRow } from './rows';

const COPIED_MS = 2_000;
/** Relecture regroupée : la trace change à chaque événement pendant qu'on la lit */
const RELOAD_DELAY_MS = 300;

export interface DebugTraceSection {
  render(): HTMLElement;
}

const isCategory = (value: string): value is TraceCategory => (TRACE_CATEGORIES as readonly string[]).includes(value);

/** Contexte d'un événement en une ligne : numéro, origine, onglet, plateforme */
function originLine(event: TraceEvent): string {
  return [`#${event.seq}`, event.source, event.tabId !== undefined && `tab ${event.tabId}`, event.platform].filter((part): part is string => typeof part === 'string').join(' · ');
}

export function createDebugTraceSection(redraw: () => void): DebugTraceSection {
  // Logger créé ici, pas au chargement du module : son appel resterait dans le bundle publié (module importé par page-help.ts)
  const log = createLogger('settings');
  let events: TraceEvent[] | null = null;
  let verbose = false;
  let filter: TraceCategory | 'all' = 'all';
  let copied = false;
  let copyFailed = false;
  let copyTimer: ReturnType<typeof setTimeout> | undefined;
  let reloadTimer: ReturnType<typeof setTimeout> | undefined;

  async function load(): Promise<void> {
    try {
      [events, verbose] = await Promise.all([readTraceEvents(), readTraceVerbose()]);
    } catch (error: unknown) {
      log.warn('Trace de débogage illisible :', error);
      events = [];
    }
    redraw();
  }

  async function copy(): Promise<void> {
    clearTimeout(copyTimer);
    try {
      // Toute la trace (ordre d'arrivée), avec la version et le build : de quoi rejouer le cas
      const exported = { exportedAt: new Date().toISOString(), version: chrome.runtime.getManifest().version, build: __SYNCKAI_BUILD__, verbose, events: await readTraceEvents() };
      await navigator.clipboard.writeText(JSON.stringify(exported, null, 2));
      copied = true;
      copyFailed = false;
      copyTimer = setTimeout(() => {
        copied = false;
        redraw();
      }, COPIED_MS);
    } catch (error: unknown) {
      log.warn('Copie de la trace impossible :', error);
      copyFailed = true;
    }
    redraw();
  }

  async function run(task: () => Promise<unknown>): Promise<void> {
    try {
      await task();
    } catch (error: unknown) {
      log.warn('Trace de débogage : service worker injoignable :', error);
    }
    await load();
  }

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'session' || (!changes[DEBUG_TRACE_KEY] && !changes[DEBUG_TRACE_VERBOSE_KEY])) return;
    clearTimeout(reloadTimer);
    reloadTimer = setTimeout(() => void load(), RELOAD_DELAY_MS);
  });
  void load();

  const time = (at: number): string =>
    new Date(at).toLocaleTimeString(getLocale(), { hour: '2-digit', minute: '2-digit', second: '2-digit', fractionalSecondDigits: 3 });

  function row(event: TraceEvent, index: number): HTMLElement {
    const data = JSON.stringify(event.data);
    return h(
      'li',
      { class: `flex min-w-0 flex-col gap-0.5 px-3 py-1.5 ${index > 0 ? DIVIDER : ''}` },
      h(
        'div',
        { class: 'flex min-w-0 items-center gap-2' },
        h('span', { class: 'min-w-0 flex-1 truncate text-[12px] font-bold' }, `${event.category} · ${event.type}`),
        h('span', { class: 'shrink-0 text-[10px] font-semibold text-muted tabular-nums' }, time(event.at)),
      ),
      h('span', { class: `min-w-0 break-words ${HELP_TEXT}` }, originLine(event)),
      // Classes déjà utilisées ailleurs : aucune règle CSS ajoutée aux styles publiés pour cette section de développement
      data !== '{}' && h('span', { class: 'min-w-0 text-[10px] break-all text-muted' }, data),
    );
  }

  function body(): Child[] {
    if (events === null) return [h('span', { class: `block px-3 py-2 ${HELP_TEXT}` }, icon('spinner', 'h-3 w-3 motion-safe:animate-spin'))];
    const shown = events.filter((event) => filter === 'all' || event.category === filter).reverse();
    if (shown.length === 0) return [h('span', { class: `block px-3 py-2 ${HELP_TEXT}`, attrs: { role: 'status' } }, t('settings.debugTrace.empty'))];
    return [h('ul', { class: 'm-0 flex list-none flex-col p-0' }, ...shown.map(row))];
  }

  function filterSelect(): HTMLElement {
    const select = h(
      'select',
      {
        class: 'h-7 min-w-0 flex-1 cursor-pointer rounded-full border border-line bg-surface px-2 text-[11px] font-semibold text-ink',
        attrs: { 'data-focus': 'debug-trace-filter', 'aria-label': t('settings.debugTrace.filterAria') },
      },
      h('option', { attrs: { value: 'all', ...(filter === 'all' ? { selected: '' } : {}) } }, t('settings.debugTrace.allCategories')),
      ...TRACE_CATEGORIES.map((category) => h('option', { attrs: { value: category, ...(filter === category ? { selected: '' } : {}) } }, category)),
    );
    select.addEventListener('change', () => {
      filter = isCategory(select.value) ? select.value : 'all';
      redraw();
    });
    return select;
  }

  return {
    render: () => {
      const empty = events === null || events.length === 0;
      const number = new Intl.NumberFormat(getLocale());
      return settingsSection(
        t('settings.debugTrace.title'),
        h(
          'div',
          { class: `${CARD} flex flex-col overflow-hidden` },
          h('p', { class: `m-0 px-3 pt-2 ${HELP_TEXT}` }, t('settings.debugTrace.text')),
          toggleRow({ id: 'debug-trace-verbose', label: t('settings.debugTrace.verbose'), checked: verbose, onChange: (checked) => void run(() => setTraceVerbose(checked)) }),
          h(
            'div',
            { class: 'flex flex-wrap items-center gap-2 px-3 pb-2' },
            filterSelect(),
            h(
              'button',
              {
                class: `${BTN_GHOST} shrink-0 border border-line px-2.5 text-[11px] ${copied ? 'text-mint' : 'text-ink'}`,
                attrs: { type: 'button', 'data-focus': 'debug-trace-copy', ...(empty ? { disabled: '' } : {}) },
                on: { click: () => void copy() },
              },
              copied && icon('check', 'h-3 w-3', '3'),
              copied ? t('settings.debugTrace.copied') : t('settings.debugTrace.copy'),
            ),
            h(
              'button',
              {
                class: `${BTN_GHOST} shrink-0 border border-line px-2.5 text-[11px] text-danger`,
                attrs: { type: 'button', 'data-focus': 'debug-trace-clear', ...(empty ? { disabled: '' } : {}) },
                on: { click: () => void run(clearTrace) },
              },
              t('settings.matchDiag.clear'),
            ),
          ),
          h(
            'span',
            { class: `px-3 pb-2 tabular-nums ${HELP_TEXT}` },
            t('settings.debugTrace.count', { count: number.format(events?.length ?? 0), max: number.format(traceCapacity(verbose)) }),
          ),
          copyFailed && h('span', { class: 'px-3 pb-2 text-[11px] font-bold text-danger', attrs: { role: 'status' } }, t('settings.debugTrace.copyFailed')),
          h('div', { class: DIVIDER }, ...body()),
        ),
      );
    },
  };
}
