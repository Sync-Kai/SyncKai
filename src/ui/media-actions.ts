import { t } from '../i18n';
import type { PageListState, PageMediaView } from '../shared/page-media.types';
import type { AddListStatus, ListStatusChange } from '../shared/sync.types';
import { TRACKER_LABELS } from '../shared/tracker.types';
import { TONE_CHIP } from '../popup/feedback';
import { displayScore, hasMissingList, listStatusLabel, primaryList, progressText, seasonOptionLabel, type InListState } from '../popup/page-media-view';
import type { InlineFeedback } from '../popup/state';
import { STAR_CLASSES } from '../popup/components/rating-section';
import { needsConfirm, renderStatusConfirm, STATUS_ICONS, STATUS_LABELS } from '../popup/components/status-actions';
import { SERVICE_CHIPS } from '../popup/components/ui';
import { h, nodes, type Child } from './dom';
import { icon, playIcon } from './icons';
import { createStarRating } from './star-rating';

// Actions sur la fiche d'une série (ajout, −1 / +1, statut, note, saison) : partagées par la carte
// « Sur cette page » du popup et l'onglet « En lecture » du panneau latéral.

/** Action en cours (une seule à la fois) */
export type MediaAction = `add-${AddListStatus}` | 'minus' | 'plus' | `status-${ListStatusChange}` | 'rate' | 'season';

export interface MediaActionsState {
  busy: MediaAction | null;
  /** Confirmation affichée (Abandonner, Terminé), null sinon */
  confirm: ListStatusChange | null;
  /** Retour de la dernière action (affiché quelques secondes) */
  feedback: InlineFeedback | null;
}

export interface MediaActionHandlers {
  onAdd: (status: AddListStatus) => void;
  onAdjust: (delta: 1 | -1) => void;
  /** Ouvre (Abandonner, Terminé) ou annule (null) la confirmation */
  onConfirm: (status: ListStatusChange | null) => void;
  onSetStatus: (status: ListStatusChange) => void;
  onRate: (value: number) => void;
  onPickSeason: (mediaId: number) => void;
}

const ICON_BTN =
  'flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-full bg-surface text-[12px] font-extrabold tabular-nums transition hover:brightness-125 disabled:cursor-default disabled:opacity-50 disabled:hover:brightness-100';
const SMALL_BTN =
  'inline-flex h-7 min-w-0 cursor-pointer items-center justify-center gap-1 rounded-full border border-line bg-surface px-2 text-[11px] font-bold text-ink transition-colors hover:border-lavender disabled:cursor-default disabled:opacity-50 disabled:hover:border-line';

const spinner = (): SVGSVGElement => icon('spinner', 'h-3.5 w-3.5 shrink-0 motion-safe:animate-spin');

/** Une ligne par service connecté : statut + progression (et note), absence de la liste, ou erreur */
export function renderListLine(list: PageListState, episodes: number | null, withScore = false): HTMLElement {
  const chip = SERVICE_CHIPS[list.service];
  const score = withScore && list.state === 'in-list' && list.score !== null ? ` · ★ ${list.score}/10` : '';
  const text =
    list.state === 'in-list'
      ? `${listStatusLabel(list.status)} · ${progressText(list.progress, episodes)}${score}`
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

/** État dans chaque liste connectée */
export function renderListLines(view: PageMediaView, withScore = false): HTMLElement {
  return h(
    'ul',
    { class: 'm-0 flex list-none flex-col gap-1 p-0', attrs: { 'aria-label': t('page.listsAria') } },
    ...view.lists.map((l) => renderListLine(l, view.media.episodes, withScore)),
  );
}

/** Sélecteur de saison (plusieurs saisons) et avertissement si la fiche a été devinée */
export function renderSeasonPicker(view: PageMediaView, disabled: boolean, onPick: (mediaId: number) => void): HTMLElement | null {
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
function renderAddButtons(busy: MediaAction | null, disabled: boolean, onAdd: (status: AddListStatus) => void): HTMLElement {
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
function renderStepper(view: PageMediaView, primary: InListState, busy: MediaAction | null, disabled: boolean, onAdjust: (delta: 1 | -1) => void): HTMLElement {
  const total = view.media.episodes;
  const atEnd = total !== null && primary.progress >= total;
  const step = (delta: 1 | -1): HTMLElement => {
    const action: MediaAction = delta === 1 ? 'plus' : 'minus';
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
          ...(busy === action ? { 'aria-busy': 'true' } : {}),
        },
        on: { click: () => onAdjust(delta) },
      },
      busy === action ? spinner() : delta === 1 ? '+1' : '−1',
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
function renderStatusRow(primary: InListState, state: MediaActionsState, disabled: boolean, handlers: MediaActionHandlers): HTMLElement {
  if (state.confirm !== null && needsConfirm(state.confirm)) {
    const status = state.confirm;
    return renderStatusConfirm({ status, focusKey: 'page', inMenu: false, onYes: () => handlers.onSetStatus(status), onNo: () => handlers.onConfirm(null) });
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
          on: { click: () => (needsConfirm(status) ? handlers.onConfirm(status) : handlers.onSetStatus(status)) },
        },
        state.busy === `status-${status}` ? spinner() : STATUS_ICONS[status](),
        h('span', { class: 'truncate' }, t(`page.action.${status}`)),
      ),
    ),
  );
}

/** Retour de la dernière action */
export function renderActionFeedback(feedback: InlineFeedback | null): HTMLElement | null {
  if (!feedback) return null;
  return h(
    'p',
    { class: `m-0 flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-bold ${TONE_CHIP[feedback.tone]}`, attrs: { role: 'status', title: feedback.detail } },
    feedback.tone === 'success' ? icon('check', 'h-3 w-3 shrink-0', '3') : icon('alert', 'h-3 w-3 shrink-0'),
    h('span', { class: 'min-w-0 flex-1 break-words' }, feedback.text),
  );
}

function renderStars(view: PageMediaView, busy: MediaAction | null, disabled: boolean, onRate: (value: number) => void): HTMLElement {
  const stars = createStarRating({
    label: t('rating.groupLabel', { title: view.media.title }),
    classes: STAR_CLASSES,
    focusKey: 'page-rate',
    disabled,
    value: displayScore(view.lists) ?? 0,
    onConfirm: onRate,
  });
  if (busy === 'rate') stars.classList.add('opacity-50');
  return stars;
}

export interface MediaActionsProps {
  view: PageMediaView;
  state: MediaActionsState;
  /** Fiche en cours de relecture : actions désactivées */
  refreshing: boolean;
  handlers: MediaActionHandlers;
  /** Lignes d'état par service : `auto` = masquées pour un seul service déjà dans la liste (le contrôle suffit) */
  lines: 'auto' | 'always' | 'never';
  /** Note affichée dans les lignes d'état */
  linesWithScore?: boolean;
}

/**
 * Bloc d'actions de la fiche : sélecteur de saison, état des listes, retour, ajout ou −1/+1, statut et note.
 * Retourne des nœuds à insérer dans le conteneur de l'appelant.
 */
export function renderMediaActions({ view, state, refreshing, handlers, lines, linesWithScore = false }: MediaActionsProps): Child[] {
  const disabled = state.busy !== null || refreshing;
  const primary = primaryList(view.lists);
  const showLines = view.lists.length > 0 && (lines === 'always' || (lines === 'auto' && !(view.lists.length === 1 && primary !== null)));
  return [
    renderSeasonPicker(view, disabled, handlers.onPickSeason),
    showLines && renderListLines(view, linesWithScore),
    renderActionFeedback(state.feedback),
    hasMissingList(view.lists) && renderAddButtons(state.busy, disabled, handlers.onAdd),
    primary && renderStepper(view, primary, state.busy, disabled, handlers.onAdjust),
    primary && renderStatusRow(primary, state, disabled, handlers),
    primary && renderStars(view, state.busy, disabled, handlers.onRate),
  ];
}
