import { t } from '../../i18n';
import type { PageListState, PageMediaInfo, PageMediaView } from '../../shared/page-media.types';
import type { AddListStatus, ListStatusChange } from '../../shared/sync.types';
import { TRACKER_LABELS } from '../../shared/tracker.types';
import { h, nodes, type Child } from '../../ui/dom';
import { icon, playIcon } from '../../ui/icons';
import { createStarRating } from '../../ui/star-rating';
import { TONE_CHIP } from '../feedback';
import {
  displayScore,
  formatAiringDate,
  hasMissingList,
  listStatusLabel,
  mediaMetaParts,
  pageBadge,
  primaryList,
  progressText,
  seasonOptionLabel,
  type InListState,
} from '../page-media-view';
import type { PageCardAction, PageCardState } from '../state';
import { renderAlert } from './alert';
import { STAR_CLASSES } from './rating-section';
import { needsConfirm, renderStatusConfirm, STATUS_ICONS, STATUS_LABELS } from './status-actions';
import { kanaLabel, renderCover, SERVICE_CHIPS } from './ui';
import { BADGE_CLASSES } from './watching-screen';

// Carte « Sur cette page » (#23) : fiche AniList de la série ouverte dans l'onglet actif.
// Remplace la carte « Reprendre » ; chargée de façon asynchrone, elle ne bloque jamais le popup.

export interface PageMediaCardProps {
  card: PageCardState;
  now: number;
  onRetry: () => void;
  onAdd: (status: AddListStatus) => void;
  onAdjust: (delta: 1 | -1) => void;
  /** Ouvre (Abandonner, Terminé) ou annule (null) la confirmation */
  onConfirm: (status: ListStatusChange | null) => void;
  onSetStatus: (status: ListStatusChange) => void;
  onRate: (value: number) => void;
  onPickSeason: (mediaId: number) => void;
}

const CARD_CLASS = 'flex shrink-0 flex-col gap-2 rounded-card bg-raised p-3 shadow-pop';
const ICON_BTN =
  'flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-full bg-surface text-[12px] font-extrabold tabular-nums transition hover:brightness-125 disabled:cursor-default disabled:opacity-50 disabled:hover:brightness-100';
const SMALL_BTN =
  'inline-flex h-7 min-w-0 cursor-pointer items-center justify-center gap-1 rounded-full border border-line bg-surface px-2 text-[11px] font-bold text-ink transition-colors hover:border-lavender disabled:cursor-default disabled:opacity-50 disabled:hover:border-line';

const spinner = (): SVGSVGElement => icon('spinner', 'h-3.5 w-3.5 shrink-0 motion-safe:animate-spin');

/** Libellé « Sur cette page » + katakana décoratif, avec contenu optionnel à droite (liens) */
function cardHeader(right: Child = null): HTMLElement {
  return h(
    'div',
    { class: 'flex items-center justify-between gap-2' },
    h('div', { class: 'flex min-w-0 items-baseline gap-1.5' }, kanaLabel('ページ', 'text-lavender'), h('span', { class: 'text-[11px] font-semibold text-muted' }, t('page.title'))),
    right,
  );
}

// ─── États de chargement / erreur ─────────────────────────────────────────

function renderSkeleton(page: PageMediaInfo): HTMLElement {
  return h(
    'section',
    { class: `${CARD_CLASS} motion-safe:animate-pulse`, attrs: { 'aria-busy': 'true', 'aria-label': t('page.loading', { title: page.seriesTitle }) } },
    h(
      'div',
      { class: 'flex gap-3' },
      h('div', { class: 'h-[78px] w-14 shrink-0 rounded-lg bg-surface' }),
      h(
        'div',
        { class: 'flex min-w-0 flex-1 flex-col gap-2 pt-1' },
        cardHeader(),
        h('span', { class: 'truncate text-[13px] font-bold text-muted' }, page.seriesTitle),
        h('div', { class: 'h-3 w-32 rounded bg-surface' }),
        h('div', { class: 'h-[18px] w-24 rounded-full bg-surface' }),
      ),
    ),
  );
}

function renderError(page: PageMediaInfo, message: string, onRetry: () => void): HTMLElement {
  return h(
    'section',
    { class: CARD_CLASS, attrs: { 'aria-label': t('page.title') } },
    cardHeader(),
    h('span', { class: 'truncate text-[13px] font-bold', attrs: { title: page.seriesTitle } }, page.seriesTitle),
    renderAlert({ message, action: { label: t('common.retry'), onClick: onRetry } }),
  );
}

// ─── Fiche ────────────────────────────────────────────────────────────────

/** Liens vers la fiche AniList et MyAnimeList */
function renderLinks(view: PageMediaView): HTMLElement {
  const links = [
    { service: 'anilist' as const, url: view.media.siteUrl },
    ...(view.media.idMal !== null ? [{ service: 'mal' as const, url: `https://myanimelist.net/anime/${view.media.idMal}` }] : []),
  ];
  return h(
    'div',
    { class: 'flex shrink-0 items-center gap-1' },
    ...links.map(({ service, url }) =>
      h(
        'a',
        {
          class: 'inline-flex h-6 items-center gap-0.5 rounded-full border border-line px-1.5 text-[10px] font-bold text-muted no-underline transition-colors hover:border-sakura hover:text-ink',
          attrs: { href: url, target: '_blank', rel: 'noopener noreferrer', 'aria-label': t('page.openOn', { service: TRACKER_LABELS[service] }) },
        },
        SERVICE_CHIPS[service].short,
        icon('external', 'h-2.5 w-2.5'),
      ),
    ),
  );
}

/** Pastille de diffusion + date du prochain épisode */
function renderAiring(view: PageMediaView, now: number): HTMLElement {
  const badge = pageBadge(view, now);
  const next = view.media.nextEpisode;
  return h(
    'div',
    { class: 'flex min-w-0 items-center gap-1.5' },
    h('span', { class: `inline-flex h-[18px] shrink-0 items-center rounded-full border px-2 text-[11px] leading-4 font-bold whitespace-nowrap ${BADGE_CLASSES[badge.kind]}` }, badge.label),
    next && next.airingAt > now && h('span', { class: 'min-w-0 truncate text-[11px] font-semibold text-muted' }, formatAiringDate(next.airingAt)),
  );
}

/** Une ligne par service connecté : statut + progression, absence de la liste, ou erreur */
function renderListLine(list: PageListState, episodes: number | null): HTMLElement {
  const chip = SERVICE_CHIPS[list.service];
  const text =
    list.state === 'in-list'
      ? `${listStatusLabel(list.status)} · ${progressText(list.progress, episodes)}`
      : list.state === 'not-in-list'
        ? t('page.notInList')
        : list.state === 'unavailable'
          ? t('page.unavailable')
          : list.message;
  return h(
    'li',
    { class: 'flex min-w-0 items-center gap-1.5 text-[11px] font-semibold' },
    h('span', { class: `inline-flex h-4 shrink-0 items-center rounded-[4px] px-1 text-[9px] leading-none font-bold text-on-fill ${chip.class}`, attrs: { title: TRACKER_LABELS[list.service] } }, chip.short),
    h('span', { class: `min-w-0 truncate ${list.state === 'error' ? 'text-danger' : list.state === 'in-list' ? 'text-ink' : 'text-muted'}`, attrs: { title: text } }, text),
  );
}

/** Sélecteur de saison (plusieurs saisons) et avertissement si la fiche a été devinée */
function renderSeasonPicker(view: PageMediaView, disabled: boolean, onPick: (mediaId: number) => void): HTMLElement | null {
  const uncertain = view.confidence === 'uncertain';
  if (view.seasons.length < 2 && !uncertain) return null;
  const options = view.seasons.some((s) => s.id === view.media.mediaId)
    ? view.seasons
    : [{ id: view.media.mediaId, title: view.media.title, year: view.media.year, slot: null }, ...view.seasons];

  const select = h(
    'select',
    {
      class: 'h-7 min-w-0 flex-1 cursor-pointer rounded-full border border-line bg-surface px-2 text-[11px] font-semibold text-ink disabled:cursor-default disabled:opacity-50',
      attrs: { 'data-focus': 'page-season', 'aria-label': t('page.seasonPickerAria'), ...(disabled ? { disabled: '' } : {}) },
    },
    ...options.map((s) =>
      h('option', { attrs: { value: String(s.id), ...(s.id === view.media.mediaId ? { selected: '' } : {}) } }, seasonOptionLabel(s)),
    ),
  );
  select.addEventListener('change', () => {
    const id = Number(select.value);
    if (Number.isInteger(id) && id > 0 && id !== view.media.mediaId) onPick(id);
  });

  return h(
    'div',
    { class: 'flex flex-col gap-1' },
    ...nodes([
      uncertain &&
        h('p', { class: 'm-0 flex items-center gap-1 text-[11px] font-bold text-butter', attrs: { role: 'note' } }, icon('alert', 'h-3 w-3 shrink-0'), t('page.uncertain')),
      options.length > 1 && h('label', { class: 'flex min-w-0 items-center gap-2 text-[11px] font-semibold text-muted' }, t('page.seasonPicker'), select),
    ]),
  );
}

/** « Ajouter à À regarder » / « Ajouter à En cours » (services où la série manque) */
function renderAddButtons(busy: PageCardAction | null, disabled: boolean, onAdd: (status: AddListStatus) => void): HTMLElement {
  const button = (status: AddListStatus, label: string, iconEl: SVGSVGElement, tone: string): HTMLElement =>
    h(
      'button',
      {
        class: `inline-flex h-8 min-w-0 flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-full px-2 text-[11px] font-bold transition hover:brightness-110 disabled:cursor-default disabled:opacity-50 disabled:hover:brightness-100 ${tone}`,
        attrs: { type: 'button', title: label, 'data-focus': `page-add-${status}`, ...(disabled ? { disabled: '' } : {}), ...(busy === `add-${status}` ? { 'aria-busy': 'true' } : {}) },
        on: { click: () => onAdd(status) },
      },
      busy === `add-${status}` ? spinner() : iconEl,
      h('span', { class: 'truncate' }, label),
    );
  return h(
    'div',
    { class: 'flex gap-2' },
    button('PLANNING', t('page.addPlanning'), icon('plus', 'h-3.5 w-3.5 shrink-0', '2.6'), 'border border-line bg-surface text-ink'),
    button('CURRENT', t('page.addCurrent'), playIcon('h-3 w-3 shrink-0'), 'bg-sakura text-on-fill shadow-pop'),
  );
}

/** −1 / progression / +1, avec le statut de la liste de référence */
function renderStepper(view: PageMediaView, primary: InListState, card: PageCardState, disabled: boolean, onAdjust: (delta: 1 | -1) => void): HTMLElement {
  const total = view.media.episodes;
  const atEnd = total !== null && primary.progress >= total;
  const step = (delta: 1 | -1): HTMLElement => {
    const action: PageCardAction = delta === 1 ? 'plus' : 'minus';
    const off = disabled || (delta === -1 ? primary.progress <= 0 : atEnd);
    return h(
      'button',
      {
        class: `${ICON_BTN} ${delta === 1 ? 'text-mint' : 'text-muted'}`,
        attrs: {
          type: 'button',
          'data-focus': `page-${action}`,
          'aria-label': t(delta === 1 ? 'watching.plusOneAria' : 'page.minusOneAria', { title: view.media.title }),
          title: delta === 1 ? (atEnd ? t('watching.allWatched') : t('watching.nextWatched')) : t('watching.minusOne'),
          ...(off ? { disabled: '' } : {}),
          ...(card.busy === action ? { 'aria-busy': 'true' } : {}),
        },
        on: { click: () => onAdjust(delta) },
      },
      card.busy === action ? spinner() : delta === 1 ? '+1' : '−1',
    );
  };
  return h(
    'div',
    { class: 'flex items-center gap-2' },
    step(-1),
    h('span', { class: 'min-w-0 text-center text-[12px] font-bold tabular-nums', attrs: { 'aria-live': 'polite' } }, progressText(primary.progress, total)),
    step(1),
    h('span', { class: 'flex-1' }),
    h('span', { class: 'inline-flex h-[18px] min-w-0 items-center truncate rounded-full border border-line px-2 text-[11px] leading-4 font-bold text-ink' }, listStatusLabel(primary.status)),
  );
}

/** En pause / Abandonner / Terminé (confirmation en ligne pour les deux derniers, comme dans « En cours ») */
function renderStatusRow(primary: InListState, card: PageCardState, disabled: boolean, props: PageMediaCardProps): HTMLElement {
  if (card.confirm !== null && needsConfirm(card.confirm)) {
    const status = card.confirm;
    return renderStatusConfirm({ status, focusKey: 'page', inMenu: false, onYes: () => props.onSetStatus(status), onNo: () => props.onConfirm(null) });
  }
  const statuses: readonly ListStatusChange[] = ['PAUSED', 'DROPPED', 'COMPLETED'];
  return h(
    'div',
    { class: 'grid grid-cols-3 gap-1.5' },
    ...statuses.map((status) =>
      h(
        'button',
        {
          class: SMALL_BTN,
          attrs: {
            type: 'button',
            'data-focus': `page-status-${status}`,
            'aria-label': t(STATUS_LABELS[status]),
            title: t(STATUS_LABELS[status]),
            ...(disabled || primary.status === status ? { disabled: '' } : {}),
          },
          on: { click: () => (needsConfirm(status) ? props.onConfirm(status) : props.onSetStatus(status)) },
        },
        card.busy === `status-${status}` ? spinner() : STATUS_ICONS[status](),
        h('span', { class: 'truncate' }, t(`page.action.${status}`)),
      ),
    ),
  );
}

function renderFeedback(card: PageCardState): HTMLElement | null {
  const { feedback } = card;
  if (!feedback) return null;
  return h(
    'p',
    { class: `m-0 flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-bold ${TONE_CHIP[feedback.tone]}`, attrs: { role: 'status', title: feedback.detail } },
    feedback.tone === 'success' ? icon('check', 'h-3 w-3 shrink-0', '3') : icon('alert', 'h-3 w-3 shrink-0'),
    h('span', { class: 'min-w-0 flex-1 break-words' }, feedback.text),
  );
}

function renderReady(view: PageMediaView, refreshing: boolean, props: PageMediaCardProps): HTMLElement {
  const { card, now } = props;
  const { media } = view;
  const disabled = card.busy !== null || refreshing;
  const primary = primaryList(view.lists);
  const meta = mediaMetaParts(view);
  // Lignes par service inutiles pour un seul service déjà dans la liste (le contrôle de progression suffit)
  const showLines = !(view.lists.length === 1 && primary !== null);

  return h(
    'section',
    { class: CARD_CLASS, attrs: { 'aria-label': t('page.title'), 'aria-busy': String(refreshing || card.busy !== null) } },
    h(
      'div',
      { class: 'flex gap-3' },
      renderCover(media.title, media.coverUrl, 'h-[78px] w-14', 'text-[16px]'),
      h(
        'div',
        { class: 'flex min-w-0 flex-1 flex-col gap-1' },
        cardHeader(renderLinks(view)),
        h('span', { class: 'line-clamp-2 text-[14px] leading-[18px] font-bold break-words', attrs: { title: media.title } }, media.title),
        meta.length > 0 && h('span', { class: 'truncate text-[11px] font-semibold text-muted', attrs: { title: meta.join(' · ') } }, meta.join(' · ')),
        renderAiring(view, now),
      ),
    ),
    ...nodes([
      renderSeasonPicker(view, disabled, props.onPickSeason),
      showLines && view.lists.length > 0 && h('ul', { class: 'm-0 flex list-none flex-col gap-1 p-0', attrs: { 'aria-label': t('page.listsAria') } }, ...view.lists.map((l) => renderListLine(l, media.episodes))),
      renderFeedback(card),
      hasMissingList(view.lists) && renderAddButtons(card.busy, disabled, props.onAdd),
      primary && renderStepper(view, primary, card, disabled, props.onAdjust),
      primary && renderStatusRow(primary, card, disabled, props),
      primary &&
        (() => {
          const stars = createStarRating({
            label: t('rating.groupLabel', { title: media.title }),
            classes: STAR_CLASSES,
            focusKey: 'page-rate',
            disabled,
            value: displayScore(view.lists) ?? 0,
            onConfirm: props.onRate,
          });
          if (card.busy === 'rate') stars.classList.add('opacity-50');
          return stars;
        })(),
    ]),
  );
}

/** Carte « Sur cette page », ou null hors page de série / d'épisode reconnue */
export function renderPageMediaCard(props: PageMediaCardProps): HTMLElement | null {
  const { media } = props.card;
  switch (media.status) {
    case 'none':
      return null;
    case 'loading':
      return renderSkeleton(media.page);
    case 'error':
      return renderError(media.page, media.message, props.onRetry);
    case 'ready':
      return renderReady(media.view, media.refreshing, props);
  }
}
