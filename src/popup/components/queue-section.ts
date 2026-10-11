import { t, tp } from '../../i18n';
import type { EpisodeInfo } from '../../shared/episode.types';
import type { SyncQueueItem } from '../../shared/queue.types';
import { TRACKER_LABELS } from '../../shared/tracker.types';
import { busyAttrs, h, nodes } from '../../ui/dom';
import { icon } from '../../ui/icons';
import { TONE_CHIP } from '../../ui/feedback';
import type { QueueState } from '../state';
import { renderAlert } from '../../ui/alert';
import { BTN_GHOST, PLATFORM_LABELS, sectionTitle } from '../../ui/kit';

interface QueueSectionProps {
  queue: QueueState;
  now: number;
  onRetry: (id: string) => void;
  onAbandon: (id: string) => void;
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** Délai avant la prochaine tentative : « dans 5 min », « dans 2 h »… */
function formatUntil(timestamp: number, now: number): string {
  const diff = timestamp - now;
  if (diff < MINUTE) return t('queue.until.imminent');
  if (diff < HOUR) return t('queue.until.minutes', { count: Math.ceil(diff / MINUTE) });
  if (diff < DAY) return t('queue.until.hours', { count: Math.round(diff / HOUR) });
  return tp('queue.until.days', Math.round(diff / DAY));
}

function episodeLabel(episode: EpisodeInfo): string {
  const parts = [
    episode.seasonNumber !== null ? `S${episode.seasonNumber}` : null,
    episode.seasonEpisodeNumber !== null ? `E${episode.seasonEpisodeNumber}` : episode.displayedEpisodeNumber !== null ? `E${episode.displayedEpisodeNumber}` : null,
  ].filter((p): p is string => p !== null);
  return parts.join(' ');
}

function servicesLabel(item: SyncQueueItem): string {
  return item.services === null ? 'AniList · MyAnimeList' : item.services.map((s) => TRACKER_LABELS[s]).join(' · ');
}

function renderItem(item: SyncQueueItem, { queue, now, onRetry, onAbandon }: QueueSectionProps): HTMLElement {
  const failed = item.status === 'failed';
  const busy = queue.busyIds.has(item.id);
  const episode = episodeLabel(item.episode);
  const title = episode ? `${item.episode.animeTitle} · ${episode}` : item.episode.animeTitle;

  return h(
    'li',
    { class: `flex flex-col gap-1.5 rounded-lg bg-surface px-3 py-2 ${failed ? 'shadow-[inset_3px_0_0_var(--color-danger)]' : 'shadow-[inset_3px_0_0_var(--color-lavender)]'}` },
    h(
      'div',
      { class: 'flex min-w-0 flex-col gap-0.5' },
      h('span', { class: 'truncate text-[13px] font-bold', attrs: { title } }, title),
      h('span', { class: 'truncate text-[11px] font-semibold text-muted' }, `${PLATFORM_LABELS[item.episode.platform]} → ${servicesLabel(item)}`),
      item.lastError && h('span', { class: 'line-clamp-2 text-[11px] text-muted/80', attrs: { title: item.lastError } }, item.lastError),
    ),
    h(
      'div',
      { class: 'flex items-center justify-between gap-2' },
      failed
        ? h('span', { class: 'flex min-w-0 items-center gap-1 text-[11px] font-bold text-danger' }, icon('alert', 'h-3 w-3'), h('span', { class: 'truncate' }, t('queue.failed')))
        : h(
            'span',
            { class: 'flex min-w-0 items-center gap-1 text-[11px] font-bold text-lavender' },
            icon('clock', 'h-3 w-3'),
            h('span', { class: 'truncate' }, t('queue.nextAttempt', { when: formatUntil(item.nextAttemptAt, now) })),
          ),
      h(
        'div',
        { class: 'flex shrink-0 items-center gap-1' },
        h(
          'button',
          {
            class: `${BTN_GHOST} px-2.5 text-muted`,
            attrs: { type: 'button', 'aria-label': t('queue.abandonAria', { title }), 'data-focus': `queue-drop-${item.id}`, ...busyAttrs(busy) },
            on: { click: () => onAbandon(item.id) },
          },
          t('queue.abandon'),
        ),
        h(
          'button',
          {
            class: `${BTN_GHOST} px-2.5 text-sakura`,
            attrs: { type: 'button', 'aria-label': t('queue.retryAria', { title }), 'data-focus': `queue-retry-${item.id}`, ...busyAttrs(busy, true) },
            on: { click: () => onRetry(item.id) },
          },
          busy ? icon('spinner', 'h-3 w-3 motion-safe:animate-spin') : icon('retry', 'h-3 w-3', '2.4'),
          t('common.retry'),
        ),
      ),
    ),
  );
}

/** Activité › « Synchros en attente » : rien n'est affiché tant que la file est vide (sauf un résultat à lire) */
export function renderQueueSection(props: QueueSectionProps): HTMLElement | null {
  const { items, notice, error } = props.queue;
  if (items.length === 0 && !notice && !error) return null;

  return h(
    'section',
    { class: 'flex flex-col gap-2', attrs: { 'aria-label': t('queue.section') } },
    ...nodes([
      sectionTitle(t('queue.sectionTitle', { count: items.length }), { text: 'マチ', class: 'text-lavender' }),
      notice &&
        h(
          'p',
          { class: `m-0 rounded-lg border px-2.5 py-2 text-[11px] font-bold ${TONE_CHIP[notice.tone]}`, attrs: { role: 'status', title: notice.detail } },
          notice.text,
        ),
      error && renderAlert({ message: error }),
      items.length > 0 && h('ul', { class: 'm-0 flex list-none flex-col gap-1 p-0' }, ...items.map((item) => renderItem(item, props))),
    ]),
  );
}
