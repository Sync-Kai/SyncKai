import { t } from '../../i18n';
import type { PageMediaInfo, PageMediaView } from '../../shared/page-media.types';
import { TRACKER_LABELS } from '../../shared/tracker.types';
import { h, nodes, type Child } from '../../ui/dom';
import { icon } from '../../ui/icons';
import { renderMediaActions, type MediaActionHandlers } from '../../ui/media-actions';
import { formatAiringDate, mediaMetaParts, pageBadge } from '../page-media-view';
import type { PageCardState } from '../state';
import { renderAlert } from './alert';
import { kanaLabel, renderCover, SERVICE_CHIPS } from './ui';
import { BADGE_CLASSES } from './watching-screen';

// Carte « Sur cette page » (#23) : fiche AniList de la série ouverte dans l'onglet actif.
// Remplace la carte « Reprendre » ; chargée de façon asynchrone, elle ne bloque jamais le popup.
// Les actions (ajout, −1/+1, statut, note, saison) sont partagées avec le panneau latéral (ui/media-actions).

export interface PageMediaCardProps extends MediaActionHandlers {
  card: PageCardState;
  now: number;
  onRetry: () => void;
}

const CARD_CLASS = 'flex shrink-0 flex-col gap-2 rounded-card bg-raised p-3 shadow-pop';

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

function renderReady(view: PageMediaView, refreshing: boolean, props: PageMediaCardProps): HTMLElement {
  const { card, now } = props;
  const { media } = view;
  const meta = mediaMetaParts(view);

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
    ...nodes(renderMediaActions({ view, state: card, refreshing, handlers: props, lines: 'auto' })),
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
