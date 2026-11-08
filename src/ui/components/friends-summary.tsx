// Amis AniList, ligne de résumé de « Ta liste » (carte « Sur cette page » du popup, carte « Ta liste » du panneau) :
// trois avatars empilés puis « 7 amis · ★ 8,6 », un bouton qui ouvre la section « Amis sur AniList » et l'amène dans la
// vue (pas de seconde liste). Absente sans ami qui a la série. Avatars masqués sous 220 px de conteneur (panneau étroit).
import { useEffect, useState } from 'preact/hooks';
import { t, tp } from '../../i18n';
import type { FriendsSummary } from '../../shared/friends';
import { toImageSrc } from '../../shared/url';
import { formatStarValue } from '../rating';

/** Avatars de la ligne de résumé */
const SUMMARY_AVATARS = 3;

/** Avatar d'un ami : image AniList (hôtes d'IMAGE_HOSTS), sinon initiale sur fond `raised` ; toujours décoratif */
export function FriendAvatar({ name, url, size = 'sm' }: { name: string; url: string | null; size?: 'sm' | 'md' }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [url]);
  const src = toImageSrc(url);
  const box = size === 'md' ? 'size-7' : 'size-5';
  if (src && !failed) {
    return <img class={`block ${box} shrink-0 rounded-pill object-cover`} src={src} alt="" referrerpolicy="no-referrer" aria-hidden="true" data-friend-avatar="" onError={() => setFailed(true)} />;
  }
  return (
    <span class={`flex ${box} shrink-0 items-center justify-center rounded-pill bg-raised text-overline font-extrabold text-muted`} aria-hidden="true" data-friend-avatar="">
      {name.charAt(0).toUpperCase()}
    </span>
  );
}

/**
 * Section des amis ouverte par la ligne de résumé : après le rendu qui la monte (détails du popup ou section du panneau
 * tout juste ouverts), l'élément `data-focus` `focus` (en-tête de la section repliable du panneau, centré) ou la section
 * elle-même (popup, `tabIndex=-1`) est amené dans la vue et reçoit le focus
 */
export function revealFriendsSection(focus?: string): void {
  requestAnimationFrame(() => {
    const target = document.querySelector<HTMLElement>(focus ? `[data-focus="${focus}"]` : '[data-friends-section]');
    if (!target) return;
    const smooth = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    target.scrollIntoView({ block: focus ? 'center' : 'nearest', behavior: smooth ? 'smooth' : 'auto' });
    target.focus({ preventScroll: true });
  });
}

export interface FriendsSummaryLineProps {
  summary: FriendsSummary;
  onOpen: () => void;
  focusKey?: string;
}

export function FriendsSummaryLine({ summary, onOpen, focusKey }: FriendsSummaryLineProps) {
  const average = summary.averageScore;
  return (
    <div class="@container min-w-0">
      <button
        type="button"
        class="flex min-h-8 w-full min-w-0 cursor-pointer items-center gap-2 rounded-panel border border-line bg-raised/40 px-2.5 py-1 text-left text-secondary font-extrabold text-ink transition-colors hover:border-field"
        data-focus={focusKey}
        data-friends-summary=""
        onClick={onOpen}
      >
        <span class="flex shrink-0 -space-x-1.5 @max-[220px]:hidden" aria-hidden="true">
          {summary.friends.slice(0, SUMMARY_AVATARS).map((friend) => (
            <span key={friend.id} class="flex rounded-pill ring-2 ring-surface">
              <FriendAvatar name={friend.name} url={friend.avatar} />
            </span>
          ))}
        </span>
        <span class="min-w-0 flex-1 break-words">
          {tp('friends.summary', summary.total)}
          {average !== null && (
            <>
              <span aria-hidden="true"> · ★ {formatStarValue(average)}</span>
              <span class="sr-only">{` ${t('friends.averageAria', { score: formatStarValue(average) })}`}</span>
            </>
          )}
        </span>
      </button>
    </div>
  );
}
