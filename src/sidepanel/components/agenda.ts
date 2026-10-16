import { getLocale, joinSentences, t, upperFirst } from '../../i18n';
import { BTN_GHOST, CARD, PLATFORM_LABELS, renderCover } from '../../ui/kit';
import { platformIcon } from '../../ui/brand-icons';
import { buildAgendaDays, formatOffset, shiftWeek, weekRange, type AgendaDay, type AgendaRow, type WeekRange } from '../../shared/agenda';
import { saveSeriesOffset } from '../../browser/storage/agenda-store';
import { entryLink } from '../../shared/entry-link';
import type { StreamingPlatform } from '../../shared/episode.types';
import { createLogger } from '../../browser/logger';
import { activePlatforms } from '../../browser/platform-access';
import { platformSearchUrl } from '../../platforms/links';
import { DEFAULT_SETTINGS, OFFSET_RANGE, parseOffsetInput } from '../../shared/settings';
import { busyAttrs, h, nodes, preserveFocus, type Child } from '../../ui/dom';
import { entryCover, entryTitle } from '../../ui/entry-link';
import { createMenuDismiss } from '../../ui/menu';
import { alertAttrs } from '../../ui/live-region';
import type { PlatformAccessStore } from '../../ui/platform-access-store';
import { formatPlatformList } from '../../ui/platform-list';
import { icon } from '../../ui/icons';
import { createAgendaController } from '../agenda-controller';

// Onglet « Agenda » du panneau latéral : sorties de la semaine pour les séries en cours. Données de la semaine (cache
// `airingWeek:<date>`, GET_AGENDA, requête en cours) : sidepanel/agenda-controller.ts ; ici le rendu, le menu « ⋯ » et
// l'éditeur de délai.

const log = createLogger('agenda');

const SHORT_PLATFORM: Record<StreamingPlatform, string> = { crunchyroll: 'CR', adn: 'ADN', netflix: 'NF', disney: 'D+', prime: 'PV' };

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
  /** Écouteurs (stockage, clic hors du menu) et minuteries retirés (4-R6) */
  dispose(): void;
}

function timeFormat(): Intl.DateTimeFormat {
  return new Intl.DateTimeFormat(getLocale(), { hour: 'numeric', minute: '2-digit' });
}

/** Entier dans le format de la langue : signe moins et séparateur de milliers (« -1,440 », « 10 080 ») */
function formatInteger(value: number): string {
  return new Intl.NumberFormat(getLocale()).format(value);
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

/** `platformAccess` : accès optionnels de la page du panneau (lecteur préféré, plateformes de « aucune série ») */
export function createAgenda(platformAccess: PlatformAccessStore): AgendaView {
  const element = h('div', { class: 'flex flex-col gap-3' });
  let menuFor: number | null = null;
  let editing: Editing | null = null;
  /** Données de la semaine (chargement, cache, requête en cours) : sidepanel/agenda-controller.ts */
  const ctl = createAgendaController({
    platformAccess,
    onChange: () => draw(),
    onWeekChange: () => {
      menuFor = null;
      editing = null;
    },
  });

  /** Clic hors du menu « ⋯ » : fermeture (écouteur présent seulement pendant l'ouverture) */
  const menuDismiss = createMenuDismiss({
    onClick(target) {
      if (menuFor === null || target?.closest('[data-agenda-menu]')) return;
      menuFor = null;
      draw();
    },
  });

  function draw(): void {
    preserveFocus(element, () => element.replaceChildren(...nodes([renderNav(), ...renderBody()])));
    menuDismiss.setOpen(menuFor !== null);
  }

  // ─── Rendu ─────────────────────────────────────────────────────────────

  function navButton(direction: -1 | 1): HTMLElement {
    const label = t(direction < 0 ? 'agenda.prev' : 'agenda.next');
    return h(
      'button',
      {
        class: `${BTN_GHOST} w-8 px-0`,
        attrs: { type: 'button', 'aria-label': label, title: label, 'data-focus': direction < 0 ? 'agenda-prev' : 'agenda-next' },
        on: { click: () => ctl.goTo(shiftWeek(ctl.range, direction)) },
      },
      icon('chevronRight', `h-4 w-4 ${direction < 0 ? 'rotate-180' : ''}`),
    );
  }

  function renderNav(): HTMLElement {
    const { range, status } = ctl;
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
          on: { click: () => ctl.goTo(weekRange(Date.now(), ctl.firstDay)) },
        },
        t('agenda.today'),
      ),
    );
  }

  function message(text: string, tone: 'muted' | 'danger', action: Child = null): HTMLElement {
    return h(
      'div',
      { class: `${CARD} flex flex-col items-center gap-2 px-4 py-6 text-center`, attrs: tone === 'danger' ? alertAttrs(text) : { role: 'status' } },
      icon(tone === 'danger' ? 'alert' : 'calendar', `h-6 w-6 ${tone === 'danger' ? 'text-danger' : 'text-lavender'}`),
      h('p', { class: 'm-0 max-w-[280px] text-[12px] font-semibold text-muted' }, text),
      action,
    );
  }

  function retryButton(): HTMLElement {
    return h(
      'button',
      { class: `${BTN_GHOST} bg-raised`, attrs: { type: 'button', 'data-focus': 'agenda-retry' }, on: { click: () => void ctl.load(true) } },
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
    const { status, settings, series, range } = ctl;
    switch (status.kind) {
      case 'loading':
        return [renderSkeleton()];
      case 'not-connected':
        return [message(t('agenda.notConnected'), 'muted')];
      case 'no-series':
        return [
          message(
            status.optional.length > 0
              ? t('agenda.empty.noSeriesPlatforms', { platforms: formatPlatformList(activePlatforms(status.optional), 'disjunction') })
              : t('agenda.empty.noSeries'),
            'muted',
          ),
        ];
      case 'error':
        return [message(t('agenda.error', { error: status.message }), 'danger', retryButton())];
      case 'ready': {
        if (!settings) return [renderSkeleton()];
        const days = buildAgendaDays(status.cache.schedules, series, range, settings, Date.now());
        const staleLine =
          status.error !== null &&
          h(
            'div',
            { class: 'flex items-center justify-between gap-2 rounded-card bg-surface px-3 py-1.5', attrs: alertAttrs(t('agenda.stale', { error: status.error })) },
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
      h('span', { class: day.isToday ? 'text-sakura' : '' }, upperFirst(label)),
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
    const { settings } = ctl;
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
      // Affiché : « ≈ [logo] 18:30 » (logo à la place du nom de plateforme, abréviation en infobulle) ;
      // nom complet pour les lecteurs d'écran via aria-label
      const MARK = '\u0000';
      const [before, after = ''] = t('agenda.estimate', { platform: row.platform ? MARK : '', time }).replace(/ {2,}/g, ' ').split(MARK);
      estimate = h(
        'span',
        {
          class: `inline-flex cursor-help items-center gap-1 ${row.customOffset !== null ? 'text-lavender' : 'text-ink'}`,
          attrs: { title, 'aria-label': joinSentences([t('agenda.estimate', { platform: platformLabel, time }).replace(/ {2,}/g, ' '), title]) },
        },
        before.trim(),
        row.platform && platformIcon(row.platform, 'h-3 w-3 rounded-[3px]', { title: SHORT_PLATFORM[row.platform] }),
        after.trim(),
      );
    }
    return h('span', { class: 'flex flex-wrap items-center gap-x-2 text-[11px] font-semibold text-muted tabular-nums' }, jp, estimate);
  }

  function renderRow(row: AgendaRow, first: boolean): HTMLElement {
    const menuOpen = menuFor === row.scheduleId;
    const edit = editing?.scheduleId === row.scheduleId ? editing : null;
    const site = entryLink(row, { connected: ctl.connected, preferred: ctl.settings?.entryService ?? DEFAULT_SETTINGS.entryService });
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
        entryCover(site, renderCover(row.title, row.coverUrl, `h-12 w-9 ${row.watched ? 'opacity-60' : ''}`, 'text-[11px]')),
        h(
          'div',
          { class: 'flex min-w-0 flex-1 flex-col gap-0.5' },
          h('span', { class: `truncate text-[13px] font-bold ${row.watched ? 'text-muted' : ''}`, attrs: { title: row.title } }, entryTitle(site, row.title, `agenda-entry-${row.scheduleId}`)),
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
    const { player } = ctl;
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
      // Plateformes sans lien connu : « Ouvrir » reste sur l'autre plateforme, la recherche est proposée ici
      ...[...row.searchPlatforms]
        .sort((a, b) => Number(b === player) - Number(a === player))
        .map((platform) =>
          h(
            'a',
            {
              class: 'flex h-8 w-full items-center gap-1.5 rounded-lg px-2.5 text-[12px] font-bold text-ink no-underline hover:bg-surface',
              attrs: {
                href: platformSearchUrl(platform, row.title),
                target: '_blank',
                rel: 'noopener noreferrer',
                role: 'menuitem',
                'aria-label': t('watching.searchOnAria', { title: row.title, platform: PLATFORM_LABELS[platform] }),
              },
              on: { click: () => closeMenu(row.scheduleId) },
            },
            icon('search', 'h-3.5 w-3.5'),
            t('watching.searchOn', { platform: PLATFORM_LABELS[platform] }),
          ),
        ),
    );
  }

  function closeMenu(scheduleId: number): void {
    menuFor = null;
    draw();
    element.querySelector<HTMLElement>(`[data-focus="agenda-menu-${scheduleId}"]`)?.focus();
  }

  function openEditor(row: AgendaRow): void {
    const { settings } = ctl;
    const current = row.customOffset ?? (row.platform && settings ? settings.platformOffsets[row.platform] : 60);
    menuFor = null;
    editing = { scheduleId: row.scheduleId, mediaId: row.mediaId, value: String(current), invalid: false, saving: false, failed: false };
    draw();
    element.querySelector<HTMLInputElement>(`#sk-offset-${row.scheduleId}`)?.focus();
  }

  async function saveOffset(edit: Editing, offset: number | null): Promise<void> {
    // Enregistrement en cours : Entrée ou second clic sans effet (un seul envoi)
    if (edit.saving) return;
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
      await ctl.reloadSettings();
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
          // Même lecture que « Enregistrer » : champ vide = invalide, jamais 0
          if (event.key === 'Enter') void saveOffset({ ...edit, value: input.value }, parseOffsetInput(input.value));
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
      // Annuler / Échap retirent l'éditeur : le focus revient au bouton « ⋯ » de la série (et non à la suivante), comme après l'enregistrement
      { class: 'flex flex-col gap-1 rounded-[10px] bg-ground p-2', attrs: { 'data-focus-fallback': `agenda-menu-${row.scheduleId}` } },
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
            attrs: { type: 'button', 'data-focus': `agenda-save-${row.scheduleId}`, ...busyAttrs(edit.saving, true) },
            on: { click: () => void saveOffset({ ...edit, value: input.value }, parseOffsetInput(input.value)) },
          },
          edit.saving && icon('spinner', 'h-3 w-3 motion-safe:animate-spin'),
          t('agenda.adjust.save'),
        ),
        row.customOffset !== null &&
          h(
            'button',
            {
              class: BTN_GHOST,
              attrs: { type: 'button', 'data-focus': `agenda-reset-${row.scheduleId}`, ...busyAttrs(edit.saving) },
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
        { class: `text-[11px] font-semibold ${edit.invalid || edit.failed ? 'text-danger' : 'text-muted'}`, attrs: { id: helpId, ...(edit.failed ? alertAttrs(t('agenda.adjust.saveFailed')) : { role: 'note' }) } },
        edit.failed ? t('agenda.adjust.saveFailed') : t('agenda.adjust.help', { min: formatInteger(OFFSET_RANGE.min), max: formatInteger(OFFSET_RANGE.max) }),
      ),
    );
  }

  return {
    element,
    activate: () => ctl.activate(),
    dispose() {
      ctl.dispose();
      menuDismiss.setOpen(false);
    },
  };
}
