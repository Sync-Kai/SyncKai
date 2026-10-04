import { t, tp, type MessageKey } from '../../i18n';
import type { StreamingPlatform } from '../../shared/episode.types';
import { TRACKER_LABELS, type TrackerId } from '../../shared/tracker.types';
import { choosePlatformLink, formatRelativeTime, nextEpisodeBadge, pickHeroEntry, sortWatchingBy } from '../../shared/watching';
import { WATCHING_SORTS, type NextEpisodeBadge, type WatchingEntry, type WatchingSort } from '../../shared/watching.types';
import { h, nodes } from '../../ui/dom';
import { icon, kai, playIcon, sparkIcon } from '../../ui/icons';
import { TONE_CHIP } from '../feedback';
import type { ListStatusChange } from '../../shared/sync.types';
import type { EntryAction, InlineFeedback, WatchingState } from '../state';
import { renderAlert } from './alert';
import { CARD, kanaLabel, PLATFORM_LABELS, platformChip, renderCover, sectionTitle, segmented } from './ui';

/** Actions par série (+1, menu « … ») : état fourni par le popup, il survit aux nouveaux rendus */
export interface EntryControls {
  actions: ReadonlyMap<string, EntryAction>;
  /** Fiches AniList exclues de la synchronisation */
  excludedMediaIds: ReadonlySet<number>;
  rowMenu: string | null;
  /** Confirmation affichée dans le menu ouvert (Abandonner, Terminé) */
  rowConfirm: ListStatusChange | null;
  onRowMenu: (key: string | null) => void;
  onRowConfirm: (status: ListStatusChange | null) => void;
  onAdjust: (entry: WatchingEntry, delta: 1 | -1) => void;
  onSetStatus: (entry: WatchingEntry, status: ListStatusChange) => void;
  onExclude: (entry: WatchingEntry) => void;
  onInclude: (entry: WatchingEntry) => void;
}

interface WatchingScreenProps {
  controls: EntryControls;
  /** Retour d'un changement de statut (la série a quitté la liste) : bandeau en haut de l'écran */
  notice: InlineFeedback | null;
  state: WatchingState;
  now: number;
  preferredPlayer: StreamingPlatform;
  /** Services connectés : le sélecteur de source n'apparaît que s'il y en a deux */
  services: readonly TrackerId[];
  onPickSource: (service: TrackerId) => void;
  sort: WatchingSort;
  sortMenuOpen: boolean;
  onSortMenu: (open: boolean) => void;
  onPickSort: (sort: WatchingSort) => void;
  onRetry: () => void;
}

const BADGE_CLASSES: Record<NextEpisodeBadge['kind'], string> = {
  available: 'border-mint bg-mint text-on-fill',
  upcoming: 'border-lavender bg-lavender text-on-fill',
  finished: 'border-line bg-transparent text-muted',
  unknown: 'border-line bg-transparent text-muted',
};

const SOURCE_OPTIONS = [
  { value: 'anilist', label: 'AniList', aria: 'AniList' },
  { value: 'mal', label: 'MAL', aria: 'MyAnimeList' },
] as const satisfies readonly { value: TrackerId; label: string; aria: string }[];

/** Pourcentage vu (null si le nombre total d'épisodes est inconnu : barre hachurée) */
function progressPercent(entry: WatchingEntry): number | null {
  if (entry.totalEpisodes === null || entry.totalEpisodes <= 0) return null;
  return Math.min(100, Math.max(3, Math.round((entry.progress / entry.totalEpisodes) * 100)));
}

function progressLabel(entry: WatchingEntry): string {
  return entry.totalEpisodes !== null ? `${entry.progress} / ${entry.totalEpisodes}` : t('watching.epShort', { progress: entry.progress });
}

/** Plateforme affichée en pastille : celle du lien « Ouvrir », sinon la dernière utilisée */
function displayPlatform(entry: WatchingEntry, preferred: StreamingPlatform): StreamingPlatform | null {
  return choosePlatformLink(entry, preferred)?.platform ?? entry.lastSync?.platform ?? null;
}

/** Clé stable d'une série de la liste (une fiche MAL peut ne pas avoir d'identifiant AniList) */
export function entryKey(entry: WatchingEntry): string {
  return `${entry.mediaId ?? '-'}:${entry.malId ?? '-'}`;
}

function isExcludedEntry(entry: WatchingEntry, controls: EntryControls): boolean {
  return entry.mediaId !== null && controls.excludedMediaIds.has(entry.mediaId);
}

const ICON_BTN =
  'flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-full transition hover:brightness-125 disabled:cursor-default disabled:opacity-60 disabled:hover:brightness-100';

/** « +1 » : marque l'épisode suivant comme vu (spinner pendant l'envoi) */
function renderPlusOne(entry: WatchingEntry, controls: EntryControls, bgClass: string): HTMLElement {
  const pending = controls.actions.get(entryKey(entry))?.phase === 'pending';
  const atEnd = entry.totalEpisodes !== null && entry.progress >= entry.totalEpisodes;
  return h(
    'button',
    {
      class: `${ICON_BTN} ${bgClass} text-[12px] font-extrabold text-mint tabular-nums`,
      attrs: {
        type: 'button',
        'aria-label': t('watching.plusOneAria', { title: entry.title }),
        title: atEnd ? t('watching.allWatched') : t('watching.nextWatched'),
        'data-focus': `plus-${entryKey(entry)}`,
        ...(pending ? { 'aria-busy': 'true' } : {}),
        ...(pending || atEnd ? { disabled: '' } : {}),
      },
      on: { click: () => controls.onAdjust(entry, 1) },
    },
    pending ? icon('spinner', 'h-3.5 w-3.5 motion-safe:animate-spin') : '+1',
  );
}

const MENU_ITEM =
  'flex min-h-8 w-full cursor-pointer items-center gap-2 rounded-lg px-2 text-left text-[12px] font-semibold text-ink no-underline transition-colors hover:bg-raised focus-visible:bg-raised disabled:cursor-default disabled:text-muted disabled:opacity-60 disabled:hover:bg-transparent';

function rowMenuId(key: string): string {
  return `sk-row-menu-${key.replace(/[^\w-]/g, '_')}`;
}

const STATUS_LABELS: Record<ListStatusChange, MessageKey> = {
  PAUSED: 'watching.status.PAUSED',
  DROPPED: 'watching.status.DROPPED',
  COMPLETED: 'watching.status.COMPLETED',
};

const STATUS_ICONS: Record<ListStatusChange, () => SVGSVGElement> = {
  PAUSED: () => icon('pause', 'h-3.5 w-3.5 text-butter', '2.6'),
  DROPPED: () => icon('xCircle', 'h-3.5 w-3.5 text-danger'),
  COMPLETED: () => icon('checkCircle', 'h-3.5 w-3.5 text-mint'),
};

/** Statuts confirmés dans le menu avant l'envoi (Abandonner retire la série, Terminé avance la progression) */
const CONFIRM_LABELS: Record<Exclude<ListStatusChange, 'PAUSED'>, MessageKey> = {
  DROPPED: 'watching.confirm.DROPPED',
  COMPLETED: 'watching.confirm.COMPLETED',
};

const CONFIRM_BTN = 'inline-flex h-7 shrink-0 cursor-pointer items-center rounded-full px-2.5 text-[11px] font-bold transition hover:brightness-110 focus-visible:outline-2';

/**
 * Confirmation en ligne dans le menu : « Abandonner ? Oui / Non ».
 * Oui / Non restent des `menuitem` : la navigation aux flèches du menu continue de fonctionner.
 */
function renderStatusConfirm(entry: WatchingEntry, controls: EntryControls, status: Exclude<ListStatusChange, 'PAUSED'>, close: () => void): HTMLElement {
  const key = entryKey(entry);
  const action = t(STATUS_LABELS[status]);
  return h(
    'div',
    { class: 'flex min-h-8 items-center gap-1.5 rounded-lg bg-raised px-2 py-0.5', attrs: { role: 'group', 'aria-label': action } },
    STATUS_ICONS[status](),
    h('span', { class: 'min-w-0 flex-1 truncate text-[12px] font-bold text-ink' }, t(CONFIRM_LABELS[status])),
    h(
      'button',
      {
        class: `${CONFIRM_BTN} ${status === 'DROPPED' ? 'bg-danger' : 'bg-mint'} text-on-fill`,
        attrs: { type: 'button', role: 'menuitem', tabindex: '-1', 'data-focus': `confirm-yes-${key}`, 'aria-label': t('watching.confirm.yesAria', { action }) },
        on: {
          click: () => {
            close();
            controls.onSetStatus(entry, status);
          },
        },
      },
      t('watching.confirm.yes'),
    ),
    h(
      'button',
      {
        class: `${CONFIRM_BTN} border border-line text-ink`,
        attrs: { type: 'button', role: 'menuitem', tabindex: '-1', 'data-focus': `confirm-no-${key}`, 'aria-label': t('watching.confirm.noAria', { action }) },
        on: { click: () => controls.onRowConfirm(null) },
      },
      t('watching.confirm.no'),
    ),
  );
}

/** Menu « … » d'une série : −1, statut (pause, abandon, terminé), exclusion / réactivation, fiche du service */
function renderRowMenu(entry: WatchingEntry, controls: EntryControls): HTMLElement {
  const key = entryKey(entry);
  const pending = controls.actions.get(key)?.phase === 'pending';
  const excluded = isExcludedEntry(entry, controls);
  const close = (): void => controls.onRowMenu(null);
  const item = (focus: string, label: string, iconEl: SVGSVGElement, onClick: () => void, disabled = false, danger = false): HTMLElement =>
    h(
      'button',
      {
        class: `${MENU_ITEM} ${danger ? 'text-danger' : ''}`,
        attrs: { type: 'button', role: 'menuitem', tabindex: '-1', 'data-focus': `${focus}-${key}`, ...(disabled ? { disabled: '' } : {}) },
        on: { click: onClick },
      },
      iconEl,
      label,
    );

  const menu: HTMLElement = h(
    'div',
    {
      class: 'absolute top-full right-0 z-30 mt-1 flex w-max max-w-[240px] min-w-[200px] flex-col gap-0.5 rounded-card border border-line bg-surface p-1 shadow-pop',
      attrs: { id: rowMenuId(key), role: 'menu', 'aria-label': t('watching.menuAria', { title: entry.title }) },
      on: { keydown: (event) => onMenuKeyDown(menu, event, close) },
    },
    item('minus', t('watching.minusOne'), icon('minus', 'h-3.5 w-3.5 text-muted', '2.6'), () => {
      close();
      controls.onAdjust(entry, -1);
    }, pending || entry.progress <= 0),
    item('PAUSED', t(STATUS_LABELS.PAUSED), STATUS_ICONS.PAUSED(), () => {
      close();
      controls.onSetStatus(entry, 'PAUSED');
    }, pending),
    ...(['DROPPED', 'COMPLETED'] as const).map((status) =>
      controls.rowConfirm === status && !pending
        ? renderStatusConfirm(entry, controls, status, close)
        : item(status, t(STATUS_LABELS[status]), STATUS_ICONS[status](), () => controls.onRowConfirm(status), pending),
    ),
    h('div', { class: 'mx-1 my-0.5 h-px bg-line', attrs: { role: 'separator' } }),
    excluded
      ? item('include', t('watching.resumeSync'), icon('retry', 'h-3.5 w-3.5 text-mint'), () => {
          close();
          controls.onInclude(entry);
        })
      : item('exclude', t('common.stopSyncSeries'), icon('ban', 'h-3.5 w-3.5'), () => {
          close();
          controls.onExclude(entry);
        }, entry.mediaId === null, true),
    h(
      'a',
      {
        class: MENU_ITEM,
        attrs: { href: entry.siteUrl, target: '_blank', rel: 'noopener noreferrer', role: 'menuitem', tabindex: '-1', 'data-focus': `site-${key}` },
        on: { click: close },
      },
      icon('external', 'h-3.5 w-3.5 text-muted'),
      t('watching.openEntry'),
    ),
  );
  return menu;
}

/** Bouton « … » + menu ; un seul menu ouvert à la fois (clé dans l'état du popup) */
function renderRowMenuControl(entry: WatchingEntry, controls: EntryControls, bgClass: string): HTMLElement {
  const key = entryKey(entry);
  const open = controls.rowMenu === key;
  const trigger = h(
    'button',
    {
      class: `${ICON_BTN} ${bgClass} ${open ? 'text-ink' : 'text-muted'}`,
      attrs: {
        type: 'button',
        'aria-haspopup': 'menu',
        'aria-expanded': String(open),
        'aria-controls': rowMenuId(key),
        'aria-label': t('watching.moreActions', { title: entry.title }),
        'data-focus': `more-${key}`,
      },
      on: {
        click: () => controls.onRowMenu(open ? null : key),
        keydown: (event) => {
          if (!open && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
            event.preventDefault();
            controls.onRowMenu(key);
          }
        },
      },
    },
    icon('more', 'h-4 w-4', '3.2'),
  );
  return h('div', { class: 'relative shrink-0', attrs: { 'data-menu-root': key } }, ...nodes([trigger, open && renderRowMenu(entry, controls)]));
}

/** Pastille de retour d'action (remplace brièvement la pastille d'état) */
function feedbackChip(controls: EntryControls, entry: WatchingEntry): HTMLElement | null {
  const action = controls.actions.get(entryKey(entry));
  // Changement de statut en cours : pastille de chargement (le +1 affiche déjà son propre spinner)
  if (action?.phase === 'pending' && action.kind === 'status') {
    return h(
      'span',
      {
        class: `inline-flex h-[18px] min-w-0 max-w-full items-center gap-1 overflow-hidden rounded-full border px-2 text-[11px] leading-4 font-bold whitespace-nowrap ${TONE_CHIP.info}`,
        attrs: { role: 'status' },
      },
      icon('spinner', 'h-2.5 w-2.5 shrink-0 motion-safe:animate-spin', '2.6'),
      h('span', { class: 'truncate' }, t('inline.saving')),
    );
  }
  if (action?.phase !== 'done') return null;
  const { feedback } = action;
  return h(
    'span',
    {
      class: `inline-block h-[18px] min-w-0 max-w-full truncate rounded-full border px-2 text-[11px] leading-4 font-bold whitespace-nowrap ${TONE_CHIP[feedback.tone]}`,
      attrs: { role: 'status', title: feedback.detail },
    },
    feedback.text,
  );
}

function excludedChip(): HTMLElement {
  return h(
    'span',
    { class: 'inline-flex h-[18px] shrink-0 items-center gap-1 rounded-full border border-line px-2 text-[11px] leading-4 font-bold text-muted', attrs: { title: t('common.excludedTitle') } },
    icon('ban', 'h-2.5 w-2.5', '2.6'),
    t('common.excluded'),
  );
}

/** Étincelle posée au bout de la barre de progression */
function spark(pct: number): SVGSVGElement {
  const el = sparkIcon('absolute -top-[3px] -ml-[7px] h-3.5 w-3.5');
  el.setAttribute('style', `left: ${pct}%`);
  return el;
}

// ─── Carte « Reprendre » ──────────────────────────────────────────────────

function renderHero(entry: WatchingEntry, now: number, preferred: StreamingPlatform, controls: EntryControls): HTMLElement {
  const excluded = isExcludedEntry(entry, controls);
  const feedback = feedbackChip(controls, entry);
  const link = choosePlatformLink(entry, preferred);
  const platform = displayPlatform(entry, preferred);
  const pct = progressPercent(entry);
  const meta = [platform && PLATFORM_LABELS[platform], entry.lastSync && formatRelativeTime(entry.lastSync.at, now)].filter(
    (part): part is string => typeof part === 'string' && part.length > 0,
  );

  return h(
    'section',
    { class: 'flex shrink-0 gap-3 rounded-card bg-raised p-3 shadow-pop', attrs: { 'aria-label': t('watching.resume') } },
    renderCover(entry.title, entry.coverUrl, 'h-[78px] w-14', 'text-[16px]', platform && platformChip(platform, 'right-[3px] bottom-[3px]')),
    h(
      'div',
      { class: 'flex min-w-0 flex-1 flex-col gap-1' },
      h(
        'div',
        { class: 'flex items-center justify-between gap-2' },
        h('div', { class: 'flex min-w-0 flex-col' }, kanaLabel('ツヅキ', 'text-sakura'), h('span', { class: 'text-[11px] font-semibold text-muted' }, t('watching.resume'))),
        link &&
          h(
            'a',
            {
              class: 'group inline-flex min-h-8 shrink-0 items-center',
              attrs: {
                href: link.url,
                target: '_blank',
                rel: 'noopener noreferrer',
                'aria-label': t('watching.openOnAria', { title: entry.title, platform: PLATFORM_LABELS[link.platform] }),
              },
            },
            h(
              'span',
              {
                class:
                  'inline-flex h-7 items-center gap-1.5 rounded-full border border-line px-2.5 text-[11px] font-bold text-sakura transition-colors group-hover:border-sakura group-hover:bg-surface',
              },
              playIcon('h-3 w-3'),
              t('watching.openOn', { platform: PLATFORM_LABELS[link.platform] }),
            ),
          ),
      ),
      h('span', { class: 'truncate text-[15px] leading-5 font-bold', attrs: { title: entry.title } }, entry.title),
      h(
        'div',
        { class: 'relative mt-1 h-2 rounded-full bg-surface', attrs: { 'aria-hidden': 'true' } },
        pct === null
          ? h('div', { class: 'h-2 w-full rounded-full bg-[repeating-linear-gradient(45deg,var(--color-lavender)_0_4px,transparent_4px_8px)]' })
          : h('div', { class: 'contents' }, h('div', { class: 'h-2 rounded-full bg-sakura', attrs: { style: `width: ${pct}%` } }), spark(pct)),
      ),
      h(
        'div',
        { class: 'flex items-center gap-1.5' },
        // Retour d'action prioritaire sur la ligne d'infos, le temps de l'afficher
        feedback ??
          h(
            'span',
            { class: 'min-w-0 flex-1 truncate text-[11px] font-semibold text-muted' },
            h(
              'span',
              { class: 'font-bold text-ink tabular-nums' },
              entry.totalEpisodes !== null
                ? t('watching.heroProgress', { progress: entry.progress, total: entry.totalEpisodes })
                : t('watching.heroProgressNoTotal', { progress: entry.progress }),
            ),
            meta.length > 0 && ` · ${meta.join(' · ')}`,
          ),
        feedback && h('span', { class: 'flex-1' }),
        excluded && excludedChip(),
        !excluded && renderPlusOne(entry, controls, 'bg-surface'),
        renderRowMenuControl(entry, controls, 'bg-surface'),
      ),
    ),
  );
}

// ─── Lignes « Mes séries » ────────────────────────────────────────────────

function renderRow(entry: WatchingEntry, now: number, preferred: StreamingPlatform, controls: EntryControls): HTMLElement {
  const badge = nextEpisodeBadge(entry, now);
  const link = choosePlatformLink(entry, preferred);
  const platform = displayPlatform(entry, preferred);
  const pct = progressPercent(entry);
  const excluded = isExcludedEntry(entry, controls);

  // Pas d'overflow-hidden sur la ligne : le menu « … » doit pouvoir déborder (la barre est rognée par son propre calque)
  return h(
    'li',
    { class: 'relative flex h-16 items-center gap-2 rounded-lg bg-surface px-2' },
    renderCover(entry.title, entry.coverUrl, 'h-11 w-8', 'text-[11px]', platform && platformChip(platform, '-right-[3px] -bottom-[3px]')),
    h(
      'div',
      { class: 'ml-1 flex min-w-0 flex-1 flex-col items-start gap-1' },
      h('span', { class: 'max-w-full truncate text-[13px] leading-[17px] font-bold', attrs: { title: entry.title } }, entry.title),
      h(
        'span',
        { class: 'flex max-w-full min-w-0 items-center gap-1' },
        feedbackChip(controls, entry) ??
          h(
            'span',
            { class: `inline-flex h-[18px] items-center rounded-full border px-2 text-[11px] leading-4 font-bold whitespace-nowrap ${BADGE_CLASSES[badge.kind]}` },
            badge.label,
          ),
        excluded && excludedChip(),
      ),
    ),
    h(
      'span',
      {
        class: 'shrink-0 text-right text-[11px] font-bold tabular-nums',
        attrs: {
          'aria-label':
            entry.totalEpisodes !== null ? tp('watching.seenOf', entry.progress, { total: entry.totalEpisodes }) : tp('watching.seen', entry.progress),
        },
      },
      progressLabel(entry),
    ),
    link &&
      h(
        'a',
        {
          class: 'flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-raised text-sakura transition hover:brightness-125',
          attrs: {
            href: link.url,
            target: '_blank',
            rel: 'noopener noreferrer',
            title: t('common.open'),
            'aria-label': t('watching.openOnAria', { title: entry.title, platform: PLATFORM_LABELS[link.platform] }),
          },
        },
        icon('screen', 'h-4 w-4'),
      ),
    !excluded && renderPlusOne(entry, controls, 'bg-raised'),
    renderRowMenuControl(entry, controls, 'bg-raised'),
    h(
      'div',
      { class: 'pointer-events-none absolute inset-0 overflow-hidden rounded-lg', attrs: { 'aria-hidden': 'true' } },
      h(
        'div',
        { class: 'absolute inset-x-0 bottom-0 h-[3px] bg-raised' },
        pct === null
          ? h('div', { class: 'h-[3px] w-full bg-[repeating-linear-gradient(45deg,var(--color-lavender)_0_4px,transparent_4px_8px)]' })
          : h('div', { class: 'h-[3px] bg-sakura', attrs: { style: `width: ${pct}%` } }),
      ),
    ),
  );
}

// ─── Tri « Mes séries » ───────────────────────────────────────────────────

const SORT_LABELS: Record<WatchingSort, MessageKey> = {
  'next-episode': 'watching.sort.nextEpisode',
  recent: 'watching.sort.recent',
  title: 'watching.sort.title',
  remaining: 'watching.sort.remaining',
};

/** Fin de l'aria-label de la liste (« Mes séries AniList, triées … ») */
const SORT_ARIA: Record<WatchingSort, MessageKey> = {
  'next-episode': 'watching.sortAria.nextEpisode',
  recent: 'watching.sortAria.recent',
  title: 'watching.sortAria.title',
  remaining: 'watching.sortAria.remaining',
};

const SORT_MENU_ID = 'sk-sort-menu';
const MENU_NAV_KEYS: ReadonlySet<string> = new Set(['ArrowDown', 'ArrowUp', 'Home', 'End']);

/** Déplace le focus clavier entre les options du menu (flèches en boucle, Début, Fin) */
function moveMenuFocus(menu: HTMLElement, key: string): void {
  const items = [...menu.querySelectorAll<HTMLElement>('[role^="menuitem"]:not(:disabled)')];
  const index = items.findIndex((item) => item === document.activeElement);
  const last = items.length - 1;
  const next = key === 'Home' ? 0 : key === 'End' ? last : key === 'ArrowDown' ? (index >= last ? 0 : index + 1) : index <= 0 ? last : index - 1;
  items[next]?.focus();
}

/** Clavier d'un menu : flèches / Début / Fin entre les options, Tab ferme (focus rendu au bouton) */
function onMenuKeyDown(menu: HTMLElement, event: KeyboardEvent, onClose: () => void): void {
  if (MENU_NAV_KEYS.has(event.key)) {
    event.preventDefault();
    moveMenuFocus(menu, event.key);
  } else if (event.key === 'Tab') {
    event.preventDefault();
    onClose();
  }
}

function renderSortMenu(sort: WatchingSort, onClose: () => void, onPick: (sort: WatchingSort) => void): HTMLElement {
  const menu: HTMLElement = h(
    'div',
    {
      class: 'absolute top-full right-0 z-30 mt-1 flex w-max max-w-[200px] min-w-[176px] flex-col gap-0.5 rounded-card border border-line bg-surface p-1 shadow-pop',
      attrs: { id: SORT_MENU_ID, role: 'menu', 'aria-label': t('watching.sortMenu') },
      on: { keydown: (event) => onMenuKeyDown(menu, event, onClose) },
    },
    ...WATCHING_SORTS.map((value) => {
      const checked = value === sort;
      return h(
        'button',
        {
          class: `flex min-h-8 w-full cursor-pointer items-center gap-2 rounded-lg px-2 text-left text-[12px] transition-colors hover:bg-raised hover:text-ink focus-visible:bg-raised ${checked ? 'font-bold text-ink' : 'font-semibold text-muted'}`,
          attrs: { type: 'button', role: 'menuitemradio', 'aria-checked': String(checked), tabindex: '-1', 'data-focus': `sort-${value}` },
          on: { click: () => onPick(value) },
        },
        checked ? icon('check', 'h-3.5 w-3.5 shrink-0 text-sakura', '2.6') : h('span', { class: 'h-3.5 w-3.5 shrink-0', attrs: { 'aria-hidden': 'true' } }),
        t(SORT_LABELS[value]),
      );
    }),
  );
  return menu;
}

/** Bouton de tri + menu déroulant ; l'état ouvert/fermé vient du popup (il survit aux nouveaux rendus) */
function renderSortControl(sort: WatchingSort, open: boolean, onSortMenu: (open: boolean) => void, onPick: (sort: WatchingSort) => void): HTMLElement {
  const trigger = h(
    'button',
    {
      class: `inline-flex h-8 cursor-pointer items-center gap-1 rounded-full px-1.5 text-[11px] font-semibold transition-colors hover:text-ink ${open ? 'text-ink' : 'text-muted'}`,
      attrs: {
        type: 'button',
        'aria-haspopup': 'menu',
        'aria-expanded': String(open),
        'aria-controls': SORT_MENU_ID,
        'aria-label': t('watching.sortTrigger', { label: t(SORT_LABELS[sort]) }),
        'data-focus': 'sort-trigger',
      },
      on: {
        click: () => onSortMenu(!open),
        keydown: (event) => {
          // Flèches sur le bouton fermé : ouverture directe du menu
          if (!open && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
            event.preventDefault();
            onSortMenu(true);
          }
        },
      },
    },
    icon('sortNext', 'h-3 w-3', '2.4'),
    t(SORT_LABELS[sort]),
  );
  return h(
    'div',
    { class: 'relative', attrs: { 'data-sort-root': '' } },
    ...nodes([trigger, open && renderSortMenu(sort, () => onSortMenu(false), onPick)]),
  );
}

// ─── États ────────────────────────────────────────────────────────────────

function renderSkeleton(): HTMLElement {
  const row = (): HTMLElement =>
    h('li', { class: 'flex h-16 items-center gap-3 rounded-lg bg-surface px-2' },
      h('div', { class: 'h-11 w-8 rounded-lg bg-raised' }),
      h('div', { class: 'flex flex-1 flex-col gap-2' }, h('div', { class: 'h-3 w-40 rounded bg-raised' }), h('div', { class: 'h-3 w-24 rounded-full bg-raised' })),
    );
  return h(
    'div',
    { class: 'flex flex-col gap-3 motion-safe:animate-pulse', attrs: { 'aria-busy': 'true', 'aria-label': t('watching.loading') } },
    h('div', { class: 'flex h-[102px] gap-3 rounded-card bg-raised p-3' }, h('div', { class: 'h-[78px] w-14 rounded-lg bg-surface' }), h('div', { class: 'flex flex-1 flex-col gap-2 pt-4' }, h('div', { class: 'h-3.5 w-32 rounded bg-surface' }), h('div', { class: 'h-2 w-full rounded-full bg-surface' }))),
    h('ul', { class: 'm-0 flex list-none flex-col gap-1 p-0' }, row(), row(), row(), row()),
  );
}

function renderEmpty(): HTMLElement {
  const pill = 'inline-flex h-9 items-center rounded-full px-4 text-[13px] font-bold transition';
  // Chemin « Réglages › Lecture » mis en gras au milieu de la phrase traduite
  const [tipBefore = '', tipAfter = ''] = t('watching.tip').split('{path}');
  return h(
    'div',
    { class: 'flex min-h-full flex-col gap-4 pb-1' },
    h(
      'section',
      { class: 'flex flex-1 flex-col items-center justify-center gap-2 text-center', attrs: { 'aria-labelledby': 'sk-empty-title' } },
      kai('h-12 w-12', { expression: 'sleep', size: 'large' }),
      h('h2', { class: 'm-0 mt-1 text-[15px] leading-5 font-bold', attrs: { id: 'sk-empty-title' } }, t('watching.empty.title')),
      h('p', { class: 'm-0 max-w-[300px] text-[12px] leading-[18px] font-semibold text-muted' }, t('watching.empty.text')),
      h(
        'div',
        { class: 'mt-2 flex gap-2' },
        h('a', { class: `${pill} bg-sakura text-on-fill shadow-pop motion-safe:hover:-translate-px`, attrs: { href: 'https://www.crunchyroll.com', target: '_blank', rel: 'noopener noreferrer' } }, t('watching.openPlatform', { platform: 'Crunchyroll' })),
        h('a', { class: `${pill} border border-line text-ink hover:bg-surface`, attrs: { href: 'https://animationdigitalnetwork.com', target: '_blank', rel: 'noopener noreferrer' } }, t('watching.openPlatform', { platform: 'ADN' })),
      ),
    ),
    h(
      'aside',
      { class: `${CARD} flex shrink-0 flex-col gap-1 p-3`, attrs: { 'aria-label': t('watching.tipTitle') } },
      h('div', { class: 'flex items-baseline gap-1.5' }, kanaLabel('ヒント', 'text-butter'), h('span', { class: 'text-[11px] font-bold' }, t('watching.tipTitle'))),
      h('p', { class: 'm-0 text-[12px] leading-[17px] font-semibold text-muted' }, tipBefore, h('span', { class: 'font-bold text-ink' }, t('watching.tipPath')), tipAfter),
    ),
  );
}

/** Bandeau de retour d'un changement de statut (même style que les avis d'Activité) */
function renderNotice(notice: InlineFeedback): HTMLElement {
  return h(
    'p',
    { class: `m-0 flex shrink-0 items-center gap-1.5 rounded-lg border px-2.5 py-2 text-[11px] font-bold ${TONE_CHIP[notice.tone]}`, attrs: { role: 'status', title: notice.detail, 'data-watching-notice': '' } },
    notice.tone === 'success' ? icon('check', 'h-3 w-3 shrink-0', '3') : icon('alert', 'h-3 w-3 shrink-0'),
    h('span', { class: 'min-w-0 flex-1 break-words' }, notice.text),
  );
}

// ─── Écran ────────────────────────────────────────────────────────────────

export function renderWatchingScreen(props: WatchingScreenProps): HTMLElement {
  const { state, now, preferredPlayer } = props;

  if (state.status === 'idle') return renderSkeleton();

  // Sélecteur présent dans tous les états : une source en échec ne doit jamais bloquer l'utilisateur
  const sourceSwitch =
    props.services.length > 1 &&
    segmented({
      options: SOURCE_OPTIONS,
      current: state.service,
      onPick: props.onPickSource,
      attrs: { 'aria-label': t('watching.source') },
      focusKey: 'source',
      activeClass: 'bg-lavender',
    });
  // Ligne dédiée (hors liste peuplée, où le sélecteur rejoint l'en-tête « Mes séries »)
  const switchRow = (): HTMLElement | false => sourceSwitch && h('div', { class: 'flex justify-end' }, sourceSwitch);

  if (state.status === 'loading') return h('div', { class: 'flex flex-col gap-3' }, ...nodes([switchRow(), renderSkeleton()]));
  if (state.status === 'error') {
    return h(
      'div',
      { class: 'flex flex-col gap-3' },
      ...nodes([switchRow(), renderAlert({ message: state.message, action: { label: t('common.retry'), onClick: props.onRetry } })]),
    );
  }

  const { list } = state;
  const errorAlert = state.error && renderAlert({ message: state.error, action: { label: t('common.retry'), onClick: props.onRetry } });
  const notice = props.notice && renderNotice(props.notice);

  if (list.entries.length === 0) {
    return h(
      'div',
      { class: 'flex min-h-full flex-col gap-3' },
      ...nodes([errorAlert, notice, switchRow(), renderEmpty()]),
    );
  }

  const hero = pickHeroEntry(list.entries);
  // La carte « Reprendre » reste hors tri : elle est simplement retirée de la liste triée
  const rows = sortWatchingBy(list.entries, props.sort, now).filter((entry) => entry !== hero);

  return h(
    'div',
    { class: 'flex flex-col gap-3', attrs: { 'aria-busy': String(state.refreshing) } },
    ...nodes([
      errorAlert,
      notice,
      hero && renderHero(hero, now, preferredPlayer, props.controls),
      h(
        'div',
        { class: 'flex shrink-0 items-center justify-between gap-2' },
        sectionTitle(t('watching.mySeries')),
        h(
          'div',
          { class: 'flex items-center gap-2' },
          ...nodes([rows.length > 1 && renderSortControl(props.sort, props.sortMenuOpen, props.onSortMenu, props.onPickSort), sourceSwitch]),
        ),
      ),
      rows.length > 0
        ? h(
            'ul',
            {
              class: 'm-0 flex list-none flex-col gap-1 p-0',
              attrs: { 'aria-label': t('watching.listAria', { service: TRACKER_LABELS[state.service], sort: t(SORT_ARIA[props.sort]) }) },
            },
            ...rows.map((entry) => renderRow(entry, now, preferredPlayer, props.controls)),
          )
        : h('p', { class: `${CARD} m-0 p-3 text-[12px] text-muted` }, t('watching.noOther')),
    ]),
  );
}
