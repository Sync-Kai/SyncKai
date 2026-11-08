// Section « Amis sur AniList » (panneau « En lecture » : section repliable après « Note et commentaire » ; popup :
// dernière partie des détails de « Sur cette page ») : bande de comparaison (moyenne des amis, ta note), 5 amis au plus
// (avatar, nom vers son profil AniList dans un nouvel onglet, pastille et statut à la troisième personne, « Ép. x / y »,
// note ou « — »), « Voir les N autres » sur place, « Tout voir sur AniList », mention de confidentialité. Chargement :
// squelette (aria-busy) ; erreur : « Indisponible » et « Réessayer » ; sans ami ni session : rien (l'hôte ne la monte pas).
import { useLayoutEffect, useRef, useState } from 'preact/hooks';
import { t, tp } from '../../i18n';
import type { FriendEntry, FriendsSummary } from '../../shared/friends';
import type { PageListState } from '../../shared/page-media.types';
import type { ListStatus } from '../../shared/sync.types';
import { progressText } from '../page-media-view';
import type { FriendsState, FriendsView } from '../preact/use-friends';
import { formatStarValue } from '../rating';
import { Alert } from './alert';
import { FriendAvatar } from './friends-summary';
import { Icon } from './icon';

/** Amis montrés avant « Voir les N autres » */
export const FRIENDS_SHOWN = 5;

/** Pastille du statut d'un ami (ton par la pastille, texte `muted`) */
const STATUS_DOTS: Readonly<Record<ListStatus, string>> = {
  CURRENT: 'bg-lavender',
  REPEATING: 'bg-lavender',
  COMPLETED: 'bg-mint',
  PLANNING: 'bg-field',
  PAUSED: 'bg-butter',
  DROPPED: 'bg-danger',
};

/** Amis demandés seulement avec une session AniList (un état de liste AniList dans la fiche) */
export function friendsEnabled(lists: readonly PageListState[]): boolean {
  return lists.some((list) => list.service === 'anilist');
}

/** Ta note AniList (sur 10) pour la bande de comparaison ; null hors liste ou non notée */
export function aniListScore(lists: readonly PageListState[]): number | null {
  const list = lists.find((l) => l.service === 'anilist');
  return list?.state === 'in-list' ? list.score : null;
}

/**
 * Section montée : amis lus ou erreur ; en chargement seulement si elle est déjà ouverte (squelette visible), pour
 * qu'une ligne repliée n'apparaisse pas puis ne disparaisse aussitôt quand aucun ami n'a la série (le cas courant)
 */
export function showsFriendsSection(state: FriendsState, open: boolean): boolean {
  return state === 'ok' || state === 'error' || (state === 'loading' && open);
}

const profileUrl = (name: string): string => `https://anilist.co/user/${encodeURIComponent(name)}/`;
const newTab = (label: string): string => t('panel.nowPlaying.newTab', { label });

function BandCell({ label, value }: { label: string; value: number | null }) {
  return (
    <div class="flex min-w-0 flex-col gap-0.5 rounded-panel bg-raised px-3 py-2">
      <span class="text-secondary font-bold break-words text-muted">{label}</span>
      <span class="text-stat font-extrabold text-ink tabular-nums">
        {value === null ? (
          <>
            <span aria-hidden="true">—</span>
            <span class="sr-only">{t('friends.noScore')}</span>
          </>
        ) : (
          <>
            <span class="text-butter" aria-hidden="true">
              ★{' '}
            </span>
            {formatStarValue(value)}
          </>
        )}
      </span>
    </div>
  );
}

function FriendRow({ friend, episodes }: { friend: FriendEntry; episodes: number | null }) {
  // Prévu sans épisode vu : pas de « Ép. 0 / 12 »
  const progress = friend.status === 'PLANNING' && friend.progress === 0 ? null : progressText(friend.progress, episodes);
  return (
    <li class="flex min-w-0 items-center gap-2.5" data-friend={friend.id}>
      <FriendAvatar name={friend.name} url={friend.avatar} size="md" />
      <div class="flex min-w-0 flex-1 flex-col">
        <a
          class="min-w-0 self-start truncate text-secondary font-extrabold text-ink no-underline underline-offset-2 hover:underline"
          href={profileUrl(friend.name)}
          target="_blank"
          rel="noopener noreferrer"
          title={friend.name}
          aria-label={newTab(t('friends.profileAria', { name: friend.name }))}
          data-focus={`friends-profile-${friend.id}`}
        >
          {friend.name}
        </a>
        <span class="flex min-w-0 flex-wrap items-center gap-x-1.5 text-secondary text-muted">
          <span class={`size-2 shrink-0 rounded-pill ${STATUS_DOTS[friend.status]}`} aria-hidden="true" />
          <span class="break-words">{t(`friends.status.${friend.status}`)}</span>
          {progress !== null && (
            <>
              <span aria-hidden="true">·</span>
              <span class="tabular-nums">{progress}</span>
            </>
          )}
        </span>
      </div>
      <span class="shrink-0 text-secondary font-extrabold text-ink tabular-nums" aria-hidden="true" data-friend-score="">
        {friend.score === null ? '—' : `★ ${formatStarValue(friend.score)}`}
      </span>
      <span class="sr-only">{friend.score === null ? t('friends.noScore') : t('friends.scoreAria', { score: formatStarValue(friend.score) })}</span>
    </li>
  );
}

function FriendsList({ summary, yourScore, episodes, siteUrl }: { summary: FriendsSummary; yourScore: number | null; episodes: number | null; siteUrl: string }) {
  const [expanded, setExpanded] = useState(false);
  const list = useRef<HTMLUListElement>(null);
  const refocus = useRef(false);
  const hidden = expanded ? 0 : Math.max(0, summary.friends.length - FRIENDS_SHOWN);
  const shown = expanded ? summary.friends : summary.friends.slice(0, FRIENDS_SHOWN);
  // « Voir les N autres » disparaît : focus sur le premier ami ajouté
  useLayoutEffect(() => {
    if (!expanded || !refocus.current) return;
    refocus.current = false;
    list.current?.querySelectorAll<HTMLElement>('[data-focus^="friends-profile-"]')[FRIENDS_SHOWN]?.focus({ preventScroll: true });
  }, [expanded]);
  return (
    <>
      {summary.averageScore !== null && (
        <div class="grid grid-cols-2 gap-2" data-friends-band="">
          <BandCell label={t('friends.average')} value={summary.averageScore} />
          <BandCell label={t('friends.yourScore')} value={yourScore} />
        </div>
      )}
      <ul ref={list} class="m-0 flex list-none flex-col gap-2 p-0" aria-label={t('friends.listAria')}>
        {shown.map((friend) => (
          <FriendRow key={friend.id} friend={friend} episodes={episodes} />
        ))}
      </ul>
      {hidden > 0 && (
        <button
          type="button"
          class="cursor-pointer self-start border-0 bg-transparent p-0 text-secondary font-extrabold text-sakura underline underline-offset-2"
          data-focus="friends-more"
          onClick={() => {
            refocus.current = true;
            setExpanded(true);
          }}
        >
          {tp('friends.more', hidden)}
        </button>
      )}
      <a
        class="inline-flex min-h-8 min-w-0 items-center gap-1.5 self-start rounded-pill border border-line bg-raised px-3 text-secondary font-extrabold text-ink no-underline transition-colors hover:border-field"
        href={siteUrl}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={newTab(t('friends.allOnAniList'))}
        data-focus="friends-all"
      >
        <span class="min-w-0 break-words">{t('friends.allOnAniList')}</span>
        <Icon name="external" class="size-3 shrink-0" />
      </a>
      <p class="m-0 text-secondary text-muted">{t('friends.privacy')}</p>
    </>
  );
}

function FriendsSkeleton() {
  return (
    <div class="flex flex-col gap-2 motion-safe:animate-pulse" role="status" aria-busy="true" aria-label={t('friends.loading')} data-friends-loading="">
      {[0, 1, 2].map((row) => (
        <span key={row} class="flex items-center gap-2.5" aria-hidden="true">
          <span class="size-7 shrink-0 rounded-pill bg-raised" />
          <span class="flex flex-1 flex-col gap-1.5">
            <span class="h-2.5 w-24 rounded-pill bg-raised" />
            <span class="h-2 w-36 max-w-full rounded-pill bg-raised" />
          </span>
        </span>
      ))}
    </div>
  );
}

export interface FriendsSectionProps {
  friends: FriendsView;
  /** Ta note AniList (bande de comparaison) */
  yourScore: number | null;
  /** Épisodes de la fiche (« Ép. x / y ») */
  episodes: number | null;
  /** Page AniList de la série (« Tout voir sur AniList ») */
  siteUrl: string;
  /** Titre en tête (popup) ; absent : l'en-tête de la section repliable de l'hôte le porte (panneau) */
  title?: string;
}

export function FriendsSection({ friends, yourScore, episodes, siteUrl, title }: FriendsSectionProps) {
  let body;
  if (friends.state === 'error') body = <Alert message={t('friends.unavailable')} action={{ label: t('common.retry'), onClick: friends.retry, focusKey: 'friends-retry' }} />;
  else if (friends.state === 'ok' && friends.summary !== null) body = <FriendsList summary={friends.summary} yourScore={yourScore} episodes={episodes} siteUrl={siteUrl} />;
  else body = <FriendsSkeleton />;
  return (
    <div class="flex min-w-0 flex-col gap-2.5" tabIndex={-1} data-friends-section="">
      {title !== undefined && <h3 class="m-0 text-section text-muted uppercase">{title}</h3>}
      {body}
    </div>
  );
}
