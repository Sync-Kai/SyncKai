import { getLocale, t } from '../../i18n';
import { BTN_GHOST, CARD, PLATFORM_LABELS, renderCover } from '../../popup/components/ui';
import {
  airingWeekKey,
  buildAgendaDays,
  formatOffset,
  isWeekCacheFresh,
  mergeWatchingSeries,
  shiftWeek,
  weekRange,
  type AgendaDay,
  type AgendaRow,
  type AgendaSeries,
  type AiringWeekCache,
  type IsoWeekday,
  type WeekRange,
} from '../../shared/agenda';
import { agendaFirstDay, readWeekCache, saveSeriesOffset } from '../../shared/agenda-store';
import { EXCLUDED_SERIES_KEY, getExcludedSeries } from '../../shared/exclusions';
import type { StreamingPlatform } from '../../shared/episode.types';
import { createLogger } from '../../shared/logger';
import { sendMessage } from '../../shared/messages';
import { getSettings, OFFSET_RANGE, SETTINGS_STORAGE_KEY, type SyncSettings } from '../../shared/settings';
import { getCachedWatching, getMalToken, getValidToken, STORAGE_KEYS } from '../../shared/storage';
import { TRACKER_IDS, type TrackerId } from '../../shared/tracker.types';
import { h, nodes, preserveFocus, type Child } from '../../ui/dom';
import { icon } from '../../ui/icons';

// Onglet « Agenda » du panneau latéral : sorties de la semaine pour les séries en cours.
// Le cache `airingWeek:<date>` (alarme horaire ou requête précédente) est lu d'abord ;
// le service worker n'est sollicité (GET_AGENDA) que s'il manque ou a expiré.

const log = createLogger('agenda');

/** Navigation ‹ › : un seul chargement après une rafale de clics */
const NAV_DEBOUNCE_MS = 300;
/** Changements du stockage regroupés */
const STORAGE_DEBOUNCE_MS = 250;
/** Après une requête, pas de nouvelle requête automatique pour la même semaine avant ce délai (évite toute boucle) */
const REFETCH_GUARD_MS = 60_000;

const SHORT_PLATFORM: Record<StreamingPlatform, string> = { crunchyroll: 'CR', adn: 'ADN' };

type Status =
  | { kind: 'loading' }
  | { kind: 'not-connected' }
  | { kind: 'no-series' }
  | { kind: 'ready'; cache: AiringWeekCache; refreshing: boolean; error: string | null }
  | { kind: 'error'; message: string };

interface Editing {
  scheduleId: number;
  mediaId: number;
  value: string;
  invalid: boolean;
  saving: boolean;
  failed: boolean;
}

export interface AgendaView {
  element: HTMLElement;
  /** Onglet affiché : premier chargement, ou vérification de la fraîcheur du cache */
  activate(): void;
}

function timeFormat(): Intl.DateTimeFormat {
  return new Intl.DateTimeFormat(getLocale(), { hour: 'numeric', minute: '2-digit' });
}

function sameLocalDay(a: number, b: number): boolean {
  const [da, db] = [new Date(a), new Date(b)];
  return da.getFullYear() === db.getFullYear() && da.getMonth() === db.getMonth() && da.getDate() === db.getDate();
}

/** « 6 – 12 oct. » */
function weekLabel(range: WeekRange): string {
  const last = range.days[6] ?? range.start;
  const format = new Intl.DateTimeFormat(getLocale(), { day: 'numeric', month: 'short' });
  return format.formatRange(new Date(range.start), new Date(last));
}

export function createAgenda(): AgendaView {
  const element = h('div', { class: 'flex flex-col gap-3' });
  let firstDay: IsoWeekday = agendaFirstDay();
  let range: WeekRange = weekRange(Date.now(), firstDay);
  let status: Status = { kind: 'loading' };
  let settings: SyncSettings | null = null;
  let series = new Map<number, AgendaSeries>();
  let menuFor: number | null = null;
  let editing: Editing | null = null;
  let started = false;
  let run = 0;
  let loadTimer: ReturnType<typeof setTimeout> | undefined;
  let midnightTimer: ReturnType<typeof setTimeout> | undefined;
  /** Semaine → horodatage de la dernière requête GET_AGENDA de ce panneau */
  const lastFetch = new Map<string, number>();
  /** Services dont la liste « En cours » a déjà été demandée (cache vide à l'ouverture du panneau) */
  const watchingRequested = new Set<TrackerId>();

  function draw(): void {
    preserveFocus(element, () => element.replaceChildren(...nodes([renderNav(), ...renderBody()])));
  }

  function scheduleLoad(delay: number): void {
    clearTimeout(loadTimer);
    loadTimer = setTimeout(() => void load(false), delay);
  }

  function goTo(next: WeekRange): void {
    range = next;
    menuFor = null;
    editing = null;
    // Le cache de la nouvelle semaine est lu après la rafale de clics ; squelette en attendant
    status = { kind: 'loading' };
    draw();
    scheduleLoad(NAV_DEBOUNCE_MS);
  }

  /** Liste « En cours » jamais chargée (popup jamais ouvert) : demandée une fois au service worker */
  function requestMissingWatching(connected: readonly TrackerId[], cached: Record<TrackerId, boolean>): void {
    for (const service of connected) {
      if (cached[service] || watchingRequested.has(service)) continue;
      watchingRequested.add(service);
      // La réponse est enregistrée en cache par le service worker : storage.onChanged relance le chargement
      sendMessage('GET_WATCHING', { service }).catch((error: unknown) => log.warn('Liste en cours indisponible :', error));
    }
  }

  async function load(force: boolean): Promise<void> {
    const current = ++run;
    const target = range;
    try {
      const [nextSettings, anilistToken, malToken, anilist, mal, excluded, cache] = await Promise.all([
        getSettings(),
        getValidToken(),
        getMalToken(),
        getCachedWatching('anilist'),
        getCachedWatching('mal'),
        getExcludedSeries(),
        readWeekCache(target.key),
      ]);
      if (current !== run) return;
      settings = nextSettings;
      const connected = TRACKER_IDS.filter((id) => (id === 'anilist' ? anilistToken : malToken) !== null);
      if (connected.length === 0) {
        status = { kind: 'not-connected' };
        draw();
        return;
      }
      requestMissingWatching(connected, { anilist: anilist !== null, mal: mal !== null });
      const entries = [...(anilistToken ? (anilist?.entries ?? []) : []), ...(malToken ? (mal?.entries ?? []) : [])];
      series = mergeWatchingSeries(entries, excluded, nextSettings.preferredPlayer);
      if (series.size === 0) {
        status = { kind: 'no-series' };
        draw();
        return;
      }

      const now = Date.now();
      const fresh = cache !== null && isWeekCacheFresh(cache, target, now, series.keys());
      const recentlyFetched = now - (lastFetch.get(target.key) ?? 0) < REFETCH_GUARD_MS;
      if (cache && (fresh || (recentlyFetched && !force))) {
        status = { kind: 'ready', cache, refreshing: false, error: null };
        draw();
        return;
      }
      if (recentlyFetched && !force && status.kind === 'error') return;

      // Cache expiré : affiché tout de suite, rafraîchi en arrière-plan
      status = cache ? { kind: 'ready', cache, refreshing: true, error: null } : { kind: 'loading' };
      draw();
      lastFetch.set(target.key, now);
      const result = await sendMessage('GET_AGENDA', { weekStart: target.key });
      if (current !== run) return;
      if (result.ok) status = { kind: 'ready', cache: result.data, refreshing: false, error: null };
      else if (result.code === 'NOT_AUTHENTICATED') status = { kind: 'not-connected' };
      else status = cache ? { kind: 'ready', cache, refreshing: false, error: result.message } : { kind: 'error', message: result.message };
    } catch (error: unknown) {
      if (current !== run) return;
      log.warn('Agenda illisible :', error);
      const message = error instanceof Error && error.message ? error.message : t('error.unexpected');
      status = status.kind === 'ready' ? { ...status, refreshing: false, error: message } : { kind: 'error', message };
    }
    draw();
  }

  /** Redessine à minuit (« Aujourd'hui » change de jour) */
  function armMidnight(): void {
    clearTimeout(midnightTimer);
    const now = new Date();
    const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).getTime();
    midnightTimer = setTimeout(() => {
      draw();
      armMidnight();
    }, next - now.getTime() + 1_000);
  }

  // ─── Rendu ─────────────────────────────────────────────────────────────

  function navButton(direction: -1 | 1): HTMLElement {
    const label = t(direction < 0 ? 'agenda.prev' : 'agenda.next');
    return h(
      'button',
      {
        class: `${BTN_GHOST} w-8 px-0`,
        attrs: { type: 'button', 'aria-label': label, title: label, 'data-focus': direction < 0 ? 'agenda-prev' : 'agenda-next' },
        on: { click: () => goTo(shiftWeek(range, direction)) },
      },
      icon('chevronRight', `h-4 w-4 ${direction < 0 ? 'rotate-180' : ''}`),
    );
  }

  function renderNav(): HTMLElement {
    const isCurrent = Date.now() >= range.start && Date.now() < range.end;
    const refreshing = status.kind === 'ready' && status.refreshing;
    return h(
      'div',
      { class: 'flex items-center gap-1', attrs: { role: 'group', 'aria-label': t('agenda.nav') } },
      navButton(-1),
      h(
        'h2',
        { class: 'm-0 min-w-0 flex-1 truncate text-center text-[13px] font-bold tabular-nums', attrs: { 'aria-live': 'polite' } },
        weekLabel(range),
      ),
      refreshing && icon('spinner', 'h-3.5 w-3.5 shrink-0 text-muted motion-safe:animate-spin'),
      navButton(1),
      h(
        'button',
        {
          class: `${BTN_GHOST} bg-surface`,
          attrs: { type: 'button', 'data-focus': 'agenda-today', ...(isCurrent ? { disabled: '' } : {}) },
          on: { click: () => goTo(weekRange(Date.now(), firstDay)) },
        },
        t('agenda.today'),
      ),
    );
  }

  function message(text: string, tone: 'muted' | 'danger', action: Child = null): HTMLElement {
    return h(
      'div',
      { class: `${CARD} flex flex-col items-center gap-2 px-4 py-6 text-center`, attrs: { role: tone === 'danger' ? 'alert' : 'status' } },
      icon(tone === 'danger' ? 'alert' : 'calendar', `h-6 w-6 ${tone === 'danger' ? 'text-danger' : 'text-lavender'}`),
      h('p', { class: 'm-0 max-w-[280px] text-[12px] font-semibold text-muted' }, text),
      action,
    );
  }

  function retryButton(): HTMLElement {
    return h(
      'button',
      { class: `${BTN_GHOST} bg-raised`, attrs: { type: 'button', 'data-focus': 'agenda-retry' }, on: { click: () => void load(true) } },
      icon('retry', 'h-3.5 w-3.5'),
      t('common.retry'),
    );
  }

  function renderSkeleton(): HTMLElement {
    return h(
      'div',
      { class: 'flex flex-col gap-2', attrs: { 'aria-busy': 'true', role: 'status', 'aria-label': t('agenda.loading') } },
      ...[0, 1, 2].map(() =>
        h(
          'div',
          { class: `${CARD} flex flex-col gap-2 p-3 motion-safe:animate-pulse` },
          h('div', { class: 'h-3 w-24 rounded-full bg-raised' }),
          h('div', { class: 'flex items-center gap-2' }, h('div', { class: 'h-12 w-9 rounded-lg bg-raised' }), h('div', { class: 'h-3 flex-1 rounded-full bg-raised' })),
        ),
      ),
    );
  }

  function renderBody(): Child[] {
    switch (status.kind) {
      case 'loading':
        return [renderSkeleton()];
      case 'not-connected':
        return [message(t('agenda.notConnected'), 'muted')];
      case 'no-series':
        return [message(t('agenda.empty.noSeries'), 'muted')];
      case 'error':
        return [message(t('agenda.error', { error: status.message }), 'danger', retryButton())];
      case 'ready': {
        if (!settings) return [renderSkeleton()];
        const days = buildAgendaDays(status.cache.schedules, series, range, settings, Date.now());
        const staleLine =
          status.error !== null &&
          h(
            'div',
            { class: 'flex items-center justify-between gap-2 rounded-card bg-surface px-3 py-1.5', attrs: { role: 'alert' } },
            h('span', { class: 'min-w-0 text-[11px] font-semibold text-danger' }, t('agenda.stale', { error: status.error })),
            retryButton(),
          );
        if (days.every((day) => day.rows.length === 0)) return [staleLine, message(t('agenda.empty.week'), 'muted')];
        return [staleLine, ...days.map(renderDay)];
      }
    }
  }

  function renderDay(day: AgendaDay): HTMLElement {
    const label = new Intl.DateTimeFormat(getLocale(), { weekday: 'long', day: 'numeric', month: 'short' }).format(new Date(day.start));
    const header = h(
      'h3',
      { class: 'm-0 flex items-center gap-1.5 text-[12px] font-bold' },
      h('span', { class: day.isToday ? 'text-sakura' : '' }, label.charAt(0).toUpperCase() + label.slice(1)),
      day.isToday && h('span', { class: 'rounded-full bg-sakura px-1.5 py-px text-[10px] font-bold text-on-fill' }, t('agenda.day.today')),
    );
    if (day.rows.length === 0) {
      return h(
        'section',
        { class: 'flex items-baseline justify-between gap-2 px-1' },
        header,
        h('span', { class: 'text-[11px] font-semibold text-muted' }, t('agenda.day.none')),
      );
    }
    return h(
      'section',
      { class: 'flex flex-col gap-1.5' },
      h('div', { class: 'px-1' }, header),
      h(
        'ul',
        { class: `${CARD} m-0 flex list-none flex-col p-0 ${day.isToday ? 'ring-1 ring-sakura' : ''}` },
        ...day.rows.map((row, i) => renderRow(row, i === 0)),
      ),
    );
  }

  function renderTimes(row: AgendaRow): HTMLElement {
    const format = timeFormat();
    const jp = h('span', { attrs: { title: t('agenda.jp.title') } }, t('agenda.jp', { time: format.format(row.airingAt * 1000) }));
    let estimate: Child = null;
    if (row.estimateAt !== null && settings) {
      const at = row.estimateAt * 1000;
      // Sortie un autre jour que la diffusion : jour abrégé devant l'heure
      const time = sameLocalDay(at, row.airingAt * 1000)
        ? format.format(at)
        : new Intl.DateTimeFormat(getLocale(), { weekday: 'short', hour: 'numeric', minute: '2-digit' }).format(at);
      const platformLabel = row.platform ? PLATFORM_LABELS[row.platform] : '';
      const offset = row.customOffset ?? (row.platform ? settings.platformOffsets[row.platform] : 0);
      const title =
        row.customOffset !== null || !row.platform
          ? t('agenda.estimate.custom', { offset: formatOffset(offset) })
          : t('agenda.estimate.title', { platform: platformLabel, offset: formatOffset(offset) });
      // Libellé court affiché (« ≈ CR 18:30 »), nom complet pour les lecteurs d'écran
      const short = row.platform ? SHORT_PLATFORM[row.platform] : '';
      estimate = h(
        'span',
        {
          class: `cursor-help ${row.customOffset !== null ? 'text-lavender' : 'text-ink'}`,
          attrs: { title, 'aria-label': `${t('agenda.estimate', { platform: platformLabel, time })}. ${title}`.replace(/ {2,}/g, ' ') },
        },
        t('agenda.estimate', { platform: short, time }).replace(/ {2,}/g, ' '),
      );
    }
    return h('span', { class: 'flex flex-wrap items-center gap-x-2 text-[11px] font-semibold text-muted tabular-nums' }, jp, estimate);
  }

  function renderRow(row: AgendaRow, first: boolean): HTMLElement {
    const menuOpen = menuFor === row.scheduleId;
    const edit = editing?.scheduleId === row.scheduleId ? editing : null;
    const watchedMark =
      row.watched &&
      h(
        'span',
        { class: 'inline-flex items-center gap-0.5 text-mint', attrs: { title: t('agenda.watched') } },
        icon('check', 'h-3 w-3', '3'),
        h('span', { class: 'sr-only' }, t('agenda.watched')),
      );
    return h(
      'li',
      { class: `relative flex flex-col gap-2 px-3 py-2 ${first ? '' : 'border-t border-dotted border-line'}` },
      h(
        'div',
        { class: 'flex items-center gap-2.5' },
        renderCover(row.title, row.coverUrl, `h-12 w-9 ${row.watched ? 'opacity-60' : ''}`, 'text-[11px]'),
        h(
          'div',
          { class: 'flex min-w-0 flex-1 flex-col gap-0.5' },
          h('span', { class: `truncate text-[13px] font-bold ${row.watched ? 'text-muted' : ''}`, attrs: { title: row.title } }, row.title),
          h(
            'span',
            { class: 'flex items-center gap-1.5 text-[12px] font-bold' },
            t('agenda.episode', { episode: row.episode }),
            watchedMark,
          ),
          renderTimes(row),
        ),
        row.link &&
          h(
            'a',
            {
              class: `${BTN_GHOST} bg-raised px-2.5`,
              attrs: {
                href: row.link.url,
                target: '_blank',
                rel: 'noopener noreferrer',
                title: t('agenda.openTitle', { platform: PLATFORM_LABELS[row.link.platform] }),
                'data-focus': `agenda-open-${row.scheduleId}`,
              },
            },
            t('common.open'),
          ),
        h(
          'button',
          {
            class: `${BTN_GHOST} w-8 px-0`,
            attrs: {
              type: 'button',
              'aria-label': t('agenda.menu', { title: row.title }),
              'aria-haspopup': 'menu',
              'aria-expanded': String(menuOpen),
              'data-focus': `agenda-menu-${row.scheduleId}`,
              'data-agenda-menu': '',
            },
            on: {
              click: () => {
                menuFor = menuOpen ? null : row.scheduleId;
                draw();
              },
            },
          },
          icon('more', 'h-4 w-4'),
        ),
      ),
      menuOpen && renderMenu(row),
      edit && renderEditor(row, edit),
    );
  }

  function renderMenu(row: AgendaRow): HTMLElement {
    return h(
      'div',
      {
        class: 'absolute top-11 right-3 z-10 rounded-[10px] border border-line bg-raised p-1 shadow-pop',
        attrs: { role: 'menu', 'data-agenda-menu': '' },
        on: { keydown: (event) => event.key === 'Escape' && closeMenu(row.scheduleId) },
      },
      h(
        'button',
        {
          class: 'flex h-8 w-full cursor-pointer items-center gap-1.5 rounded-lg px-2.5 text-[12px] font-bold hover:bg-surface',
          attrs: { type: 'button', role: 'menuitem', 'data-focus': `agenda-adjust-${row.scheduleId}` },
          on: { click: () => openEditor(row) },
        },
        icon('clock', 'h-3.5 w-3.5'),
        t('agenda.adjust'),
      ),
    );
  }

  function closeMenu(scheduleId: number): void {
    menuFor = null;
    draw();
    element.querySelector<HTMLElement>(`[data-focus="agenda-menu-${scheduleId}"]`)?.focus();
  }

  function openEditor(row: AgendaRow): void {
    const current = row.customOffset ?? (row.platform && settings ? settings.platformOffsets[row.platform] : 60);
    menuFor = null;
    editing = { scheduleId: row.scheduleId, mediaId: row.mediaId, value: String(current), invalid: false, saving: false, failed: false };
    draw();
    element.querySelector<HTMLInputElement>(`#sk-offset-${row.scheduleId}`)?.focus();
  }

  async function saveOffset(edit: Editing, offset: number | null): Promise<void> {
    if (offset !== null && (!Number.isInteger(offset) || offset < OFFSET_RANGE.min || offset > OFFSET_RANGE.max)) {
      editing = { ...edit, invalid: true };
      draw();
      return;
    }
    editing = { ...edit, saving: true, invalid: false, failed: false };
    draw();
    try {
      await saveSeriesOffset(edit.mediaId, offset);
      // La mise à jour des réglages revient par storage.onChanged
      editing = null;
      settings = await getSettings();
      draw();
      element.querySelector<HTMLElement>(`[data-focus="agenda-menu-${edit.scheduleId}"]`)?.focus();
    } catch (error: unknown) {
      log.warn('Délai non enregistré :', error);
      editing = { ...edit, saving: false, failed: true };
      draw();
    }
  }

  function renderEditor(row: AgendaRow, edit: Editing): HTMLElement {
    const inputId = `sk-offset-${row.scheduleId}`;
    const helpId = `sk-offset-help-${row.scheduleId}`;
    const input = h('input', {
      class: `h-8 w-20 rounded-lg border bg-ground px-2 text-[12px] font-bold tabular-nums ${edit.invalid ? 'border-danger' : 'border-line'}`,
      attrs: {
        id: inputId,
        type: 'number',
        inputmode: 'numeric',
        step: '5',
        min: String(OFFSET_RANGE.min),
        max: String(OFFSET_RANGE.max),
        'aria-describedby': helpId,
        'aria-invalid': String(edit.invalid),
        'data-focus': `agenda-offset-${row.scheduleId}`,
      },
      on: {
        // Pas de nouveau rendu à la frappe (le curseur resterait en place)
        input: () => {
          if (editing) editing = { ...editing, value: input.value };
        },
        keydown: (event) => {
          if (event.key === 'Enter') void saveOffset({ ...edit, value: input.value }, Number(input.value));
          if (event.key === 'Escape') {
            editing = null;
            draw();
          }
        },
      },
    });
    input.value = edit.value;
    return h(
      'div',
      { class: 'flex flex-col gap-1 rounded-[10px] bg-ground p-2' },
      h('label', { class: 'text-[11px] font-bold', attrs: { for: inputId } }, t('agenda.adjust.label', { title: row.title })),
      h(
        'div',
        { class: 'flex flex-wrap items-center gap-1.5' },
        input,
        h('span', { class: 'text-[11px] font-semibold text-muted' }, t('settings.offsets.unit')),
        h(
          'button',
          {
            class: `${BTN_GHOST} bg-sakura text-on-fill hover:bg-sakura`,
            attrs: { type: 'button', 'data-focus': `agenda-save-${row.scheduleId}`, ...(edit.saving ? { disabled: '' } : {}) },
            on: { click: () => void saveOffset({ ...edit, value: input.value }, input.value.trim() === '' ? Number.NaN : Number(input.value)) },
          },
          edit.saving && icon('spinner', 'h-3 w-3 motion-safe:animate-spin'),
          t('agenda.adjust.save'),
        ),
        row.customOffset !== null &&
          h(
            'button',
            {
              class: BTN_GHOST,
              attrs: { type: 'button', 'data-focus': `agenda-reset-${row.scheduleId}`, ...(edit.saving ? { disabled: '' } : {}) },
              on: { click: () => void saveOffset(edit, null) },
            },
            t('agenda.adjust.reset'),
          ),
        h(
          'button',
          {
            class: BTN_GHOST,
            attrs: { type: 'button', 'data-focus': `agenda-cancel-${row.scheduleId}` },
            on: {
              click: () => {
                editing = null;
                draw();
              },
            },
          },
          t('common.cancel'),
        ),
      ),
      h(
        'span',
        { class: `text-[11px] font-semibold ${edit.invalid || edit.failed ? 'text-danger' : 'text-muted'}`, attrs: { id: helpId, role: edit.failed ? 'alert' : 'note' } },
        edit.failed ? t('agenda.adjust.saveFailed') : t('agenda.adjust.help', { min: OFFSET_RANGE.min, max: OFFSET_RANGE.max }),
      ),
    );
  }

  // ─── Écouteurs ─────────────────────────────────────────────────────────

  function start(): void {
    // Clic hors du menu : fermeture
    document.addEventListener('click', (event) => {
      if (menuFor === null) return;
      const target = event.target;
      if (target instanceof Element && target.closest('[data-agenda-menu]')) return;
      menuFor = null;
      draw();
    });
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== 'local') return;
      const relevant = [
        SETTINGS_STORAGE_KEY,
        STORAGE_KEYS.watchingCache,
        STORAGE_KEYS.anilistToken,
        STORAGE_KEYS.malToken,
        EXCLUDED_SERIES_KEY,
        airingWeekKey(range.key),
      ];
      if (relevant.some((key) => key in changes)) scheduleLoad(STORAGE_DEBOUNCE_MS);
    });
    armMidnight();
  }

  return {
    element,
    activate() {
      if (!started) {
        started = true;
        start();
      }
      // Langue changée depuis le dernier affichage : le premier jour de la semaine peut changer
      const nextFirstDay = agendaFirstDay();
      if (nextFirstDay !== firstDay) {
        firstDay = nextFirstDay;
        range = weekRange(range.start, firstDay);
      }
      draw();
      void load(false);
    },
  };
}
