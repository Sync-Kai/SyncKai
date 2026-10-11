import type { PageMediaView } from '../shared/page-media.types';
import type { NextEpisodeBadge } from '../shared/watching.types';
import { h } from './dom';
import { formatAiringDate, pageBadge } from './page-media-view';

/** Couleurs des pastilles de diffusion (« Mes séries », carte « Sur cette page », panneau latéral) */
export const BADGE_CLASSES: Record<NextEpisodeBadge['kind'], string> = {
  available: 'border-mint bg-mint text-on-fill',
  upcoming: 'border-lavender bg-lavender text-on-fill',
  finished: 'border-line bg-transparent text-muted',
  unknown: 'border-line bg-transparent text-muted',
};

/** Pastille de diffusion + date du prochain épisode */
export function renderAiring(view: PageMediaView, now: number): HTMLElement {
  const badge = pageBadge(view, now);
  const next = view.media.nextEpisode;
  return h(
    'div',
    { class: 'flex min-w-0 items-center gap-1.5' },
    h('span', { class: `inline-flex h-[18px] shrink-0 items-center rounded-full border px-2 text-[11px] leading-4 font-bold whitespace-nowrap ${BADGE_CLASSES[badge.kind]}` }, badge.label),
    next && next.airingAt > now && h('span', { class: 'min-w-0 truncate text-[11px] font-semibold text-muted' }, formatAiringDate(next.airingAt)),
  );
}
