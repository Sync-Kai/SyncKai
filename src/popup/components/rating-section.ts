import { t } from '../../i18n';
import type { PendingRating } from '../../shared/engagement.types';
import { formatRelativeTime } from '../../shared/watching';
import { h, nodes } from '../../ui/dom';
import { icon } from '../../ui/icons';
import { createStarRating } from '../../ui/star-rating';
import { TONE_CHIP } from '../../ui/feedback';
import type { RatingsState } from '../state';
import { renderAlert } from '../../ui/alert';
import { alertAttrs } from '../../ui/live-region';
import { BTN_GHOST, CARD, renderCover, sectionTitle, STAR_CLASSES } from '../../ui/kit';

interface RatingSectionProps {
  ratings: RatingsState;
  now: number;
  onRate: (item: PendingRating, value: number) => void;
  onIgnore: (item: PendingRating) => void;
}

function renderItem(item: PendingRating, { ratings, now, onRate, onIgnore }: RatingSectionProps): HTMLElement {
  const busy = ratings.busyIds.has(item.id);
  const error = ratings.errors.get(item.id);
  const stars = createStarRating({
    label: t('rating.groupLabel', { title: item.title }),
    classes: STAR_CLASSES,
    focusKey: `rate-${item.id}`,
    disabled: busy,
    onConfirm: (value) => onRate(item, value),
  });
  if (busy) stars.classList.add('opacity-50');

  return h(
    'li',
    { class: `${CARD} flex items-center gap-3 px-3 py-2 shadow-[inset_3px_0_0_var(--color-sakura)]`, attrs: { 'aria-busy': String(busy) } },
    renderCover(item.title, item.coverUrl, 'h-14 w-10', 'text-[12px]'),
    h(
      'div',
      { class: 'flex min-w-0 flex-1 flex-col gap-0.5' },
      h('span', { class: 'truncate text-[13px] font-bold', attrs: { title: item.title } }, item.title),
      h('span', { class: 'truncate text-[11px] font-semibold text-muted' }, t('ratings.completed', { relative: formatRelativeTime(item.completedAt, now) })),
      h(
        'div',
        { class: 'flex items-center justify-between gap-1' },
        stars,
        busy
          ? h('span', { class: 'flex h-8 items-center px-2 text-muted', attrs: { role: 'status', 'aria-label': t('prompt.rating.saving') } }, icon('spinner', 'h-3.5 w-3.5 motion-safe:animate-spin'))
          : h(
              'button',
              {
                class: `${BTN_GHOST} px-2.5 text-muted`,
                attrs: { type: 'button', 'aria-label': t('ratings.ignoreAria', { title: item.title }), 'data-focus': `rate-ignore-${item.id}` },
                on: { click: () => onIgnore(item) },
              },
              t('common.ignore'),
            ),
      ),
      error && h('span', { class: 'flex items-start gap-1 text-[11px] font-bold text-danger', attrs: alertAttrs(error) }, icon('alert', 'mt-px h-3 w-3'), error),
    ),
  );
}

/** Activité › « À noter » : séries terminées dont la note a été reportée (rien tant que la liste est vide) */
export function renderRatingSection(props: RatingSectionProps): HTMLElement | null {
  const { items, notice, error } = props.ratings;
  if (items.length === 0 && !notice && !error) return null;

  return h(
    'section',
    { class: 'flex flex-col gap-2', attrs: { 'aria-label': t('ratings.section') } },
    ...nodes([
      sectionTitle(t('ratings.sectionTitle', { count: items.length }), { text: 'ヒョウカ', class: 'text-sakura' }),
      notice &&
        h(
          'p',
          { class: `m-0 flex items-center gap-1.5 rounded-lg border px-2.5 py-2 text-[11px] font-bold ${TONE_CHIP[notice.tone]}`, attrs: { role: 'status', title: notice.detail } },
          notice.tone === 'success' && icon('check', 'h-3 w-3', '3'),
          notice.text,
        ),
      error && renderAlert({ message: error }),
      items.length > 0 && h('ul', { class: 'm-0 flex list-none flex-col gap-1 p-0' }, ...items.map((item) => renderItem(item, props))),
    ]),
  );
}
