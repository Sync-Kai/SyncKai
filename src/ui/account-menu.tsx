// Menu du compte (maquette MenuCompte), ouvert au-dessus du logo AniList / MyAnimeList de la barre d'état du popup et du
// panneau latéral : avatar, nom, état de la session, statistiques du profil (animes, épisodes, jours), « Synchro cette
// semaine », puis « Voir mon profil » et « Se déconnecter » (session expirée : « Reconnecter » d'abord, sans
// statistiques). Profil et statistiques : cache du profil, relu une fois à l'ouverture s'il date de plus d'une heure
// (ui/account-menu-model.ts) ; compteur de la semaine : browser/storage/weekly-syncs.ts.
import type { RefObject } from 'preact';
import { useEffect, useId, useState } from 'preact/hooks';
import { getLocale, t, tp } from '../i18n';
import type { AccountStats } from '../shared/account-stats';
import { isAniListViewer, type AniListViewer } from '../shared/anilist.types';
import { isMalViewer, type MalViewer } from '../shared/mal.types';
import { TRACKER_LABELS, type TrackerId } from '../shared/tracker.types';
import { toImageSrc } from '../shared/url';
import { createLogger } from '../browser/logger';
import { getCachedMalViewer, getCachedViewer, getViewerFetchedAt } from '../browser/storage/viewer-cache';
import { getWeeklySyncCount } from '../browser/storage/weekly-syncs';
import type { AccountsController } from './accounts';
import { formatStatDays, menuNeedsRefresh, profileUrl, statsView } from './account-menu-model';
import { Icon } from './components/icon';
import { MenuItem, MenuPopup, MenuSeparator } from './components/menu';
import { ServiceLogo } from './components/service-logo';
import { useLocale, useStore } from './preact/hooks';
import type { AccountState } from './state';

const log = createLogger('account-menu');

type Viewer = AniListViewer | MalViewer;

/** Lectures du stockage faites à l'ouverture (remplacées dans les tests) */
export interface AccountMenuData {
  weeklySyncs(service: TrackerId): Promise<number>;
  viewerFetchedAt(service: TrackerId): Promise<number | null>;
  /** Profil en cache (session expirée : lien « Voir mon profil » si le profil est encore connu) */
  cachedViewer(service: TrackerId): Promise<Viewer | null>;
}

export const STORAGE_MENU_DATA: AccountMenuData = {
  weeklySyncs: (service) => getWeeklySyncCount(service),
  viewerFetchedAt: getViewerFetchedAt,
  cachedViewer: (service) => (service === 'anilist' ? getCachedViewer() : getCachedMalViewer()),
};

export interface AccountMenuProps {
  service: TrackerId;
  accounts: Pick<AccountsController, 'store' | 'login' | 'logout' | 'refresh'>;
  /** Zone qui contient les logos (et ce menu) : un pointeur enfoncé ailleurs ferme le menu */
  root: RefObject<HTMLElement | null>;
  /** Fermeture ; `restore` : focus rendu au logo */
  onClose: (restore: boolean) => void;
  data?: AccountMenuData;
  now?: () => number;
}

/** État du store avec un profil validé (le store générique des comptes porte un profil `unknown`) */
function typedState(state: AccountState<unknown>): AccountState<Viewer> {
  if (state.status !== 'logged-in') return state;
  const viewer = isAniListViewer(state.viewer) || isMalViewer(state.viewer) ? state.viewer : null;
  return { ...state, viewer };
}

const avatarOf = (viewer: Viewer | null): string | null => toImageSrc(viewer === null ? null : 'avatarUrl' in viewer ? viewer.avatarUrl : viewer.pictureUrl);

/** Fond de l'avatar sans image : dégradé de la marque du service */
const AVATAR_GRADIENT: Readonly<Record<TrackerId, string>> = { anilist: 'from-lavender to-sakura', mal: 'from-mint to-mal' };

function Avatar({ service, url, dimmed }: { service: TrackerId; url: string | null; dimmed: boolean }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [url]);
  return (
    <span class="relative block size-9 shrink-0" data-avatar="">
      {url && !failed ? (
        <img class={`block size-9 rounded-pill object-cover ${dimmed ? 'opacity-55' : ''}`} src={url} alt="" referrerpolicy="no-referrer" onError={() => setFailed(true)} />
      ) : (
        <span class={`flex size-9 items-end justify-center overflow-hidden rounded-pill bg-linear-135 text-ink ${AVATAR_GRADIENT[service]} ${dimmed ? 'opacity-55' : ''}`} aria-hidden="true">
          <Icon name="user" class="size-7 opacity-90" strokeWidth="2.2" />
        </span>
      )}
      <span class="absolute -right-0.75 -bottom-0.75 flex rounded-logo border-2 border-raised bg-raised">
        <ServiceLogo id={service} size="sm" />
      </span>
    </span>
  );
}

/** Texte remplacé par un pavé de même hauteur pendant la lecture (aucun saut à l'arrivée des données) */
function Placeholder({ width }: { width: string }) {
  return (
    <span class={`inline-block ${width} rounded-control bg-line text-transparent motion-safe:animate-pulse`} aria-hidden="true" data-skeleton="">
      0
    </span>
  );
}

function StatTile({ value, label }: { value: string | null; label: string }) {
  return (
    <div class="flex min-w-0 flex-col items-center rounded-control bg-surface px-1 py-1.5" data-stat="">
      <span class="font-display text-stat whitespace-nowrap text-ink tabular-nums">{value ?? <Placeholder width="w-10" />}</span>
      <span class="max-w-full truncate text-section font-semibold tracking-normal text-muted" title={label}>
        {label}
      </span>
    </div>
  );
}

function StatTiles({ stats }: { stats: AccountStats | 'loading' }) {
  const locale = getLocale();
  const count = new Intl.NumberFormat(locale);
  const ready = stats === 'loading' ? null : stats;
  const days = ready ? Math.round(ready.days) : 0;
  return (
    <div class="grid grid-cols-3 gap-1 px-1.5 py-1" aria-busy={ready ? undefined : 'true'} data-stats="">
      <StatTile value={ready ? count.format(ready.animeCount) : null} label={tp('accountMenu.stats.anime', ready?.animeCount ?? 0)} />
      <StatTile value={ready ? count.format(ready.episodes) : null} label={tp('accountMenu.stats.episodes', ready?.episodes ?? 0)} />
      <StatTile value={ready ? t('accountMenu.stats.daysValue', { days: formatStatDays(ready.days, locale) }) : null} label={tp('accountMenu.stats.days', days)} />
    </div>
  );
}

/** « Synchro cette semaine … 9 épisodes » : le libellé se tronque (infobulle complète), la valeur ne passe jamais à la ligne */
function WeekRow({ count }: { count: number | null }) {
  const title = t('accountMenu.week.title');
  return (
    <div class="flex items-center gap-1.5 px-2.5 pt-1 pb-1.5 text-secondary text-muted" data-week="">
      <span class="flex shrink-0 text-mint">
        <Icon name="check" class="size-3" strokeWidth="2.6" />
      </span>
      <span class="min-w-0 flex-1 truncate" title={title}>
        {t('accountMenu.week.label')}
      </span>
      <span class="shrink-0 font-bold whitespace-nowrap text-ink tabular-nums" data-week-value="">
        {count === null ? <Placeholder width="w-14" /> : tp('accountMenu.week.value', count)}
      </span>
    </div>
  );
}

const DIVIDER = <div class="mx-1.5 my-1 h-px shrink-0 bg-line" aria-hidden="true" />;

export function AccountMenu({ service, accounts, root, onClose, data = STORAGE_MENU_DATA, now = Date.now }: AccountMenuProps) {
  useLocale();
  const state = typedState(useStore(accounts.store(service)));
  const [refreshing, setRefreshing] = useState(false);
  const [weekly, setWeekly] = useState<number | 'hidden' | null>(null);
  const [cached, setCached] = useState<Viewer | null>(null);
  const infoId = useId();

  // Ouverture : compteur de la semaine, profil en cache (session expirée), une relecture du profil au plus
  useEffect(() => {
    let live = true;
    data.weeklySyncs(service).then(
      (count) => live && setWeekly(count),
      (error: unknown) => {
        log.warn('Compteur de la semaine illisible :', error);
        if (live) setWeekly('hidden');
      },
    );
    const open = async (): Promise<void> => {
      const current = typedState(accounts.store(service).get());
      if (current.status === 'logged-out' && current.expired) {
        const viewer = await data.cachedViewer(service);
        if (live) setCached(viewer);
        return;
      }
      if (!menuNeedsRefresh(current, await data.viewerFetchedAt(service), now())) return;
      if (live) setRefreshing(true);
      try {
        await accounts.refresh(service);
      } finally {
        if (live) setRefreshing(false);
      }
    };
    open().catch((error: unknown) => log.warn('Profil du menu illisible :', error));
    return () => {
      live = false;
    };
  }, [service]);

  const label = TRACKER_LABELS[service];
  const expired = state.status === 'logged-out' && state.expired;
  const viewer = state.status === 'logged-in' ? state.viewer : expired ? cached : null;
  const stats = statsView(state, refreshing);
  const nameLoading = state.status === 'logged-in' && state.viewer === null && (state.error === null || refreshing);

  let status;
  if (expired) {
    status = (
      <span class="flex items-center gap-1.5 text-secondary text-danger" data-account-status="expired">
        <span class="size-1.5 shrink-0 rounded-pill bg-danger" aria-hidden="true" />
        <span class="truncate">{t('common.sessionExpired')}</span>
      </span>
    );
  } else if (nameLoading) {
    status = (
      <span class="flex text-secondary" aria-busy="true" aria-label={t('settings.account.loading', { service: label })}>
        <Placeholder width="w-28" />
      </span>
    );
  } else {
    const text = viewer ? t('accountMenu.connectedAs', { name: viewer.name }) : t('accountMenu.connected');
    status = (
      <span class="flex items-center gap-1.5 text-secondary text-muted" data-account-status="connected">
        <span class="size-1.5 shrink-0 rounded-pill bg-mint" aria-hidden="true" />
        <span class="truncate" title={text}>
          {text}
        </span>
      </span>
    );
  }

  const profile = viewer && (
    <MenuItem icon="user" href={profileUrl(viewer)}>
      {t('accountMenu.profile')}
    </MenuItem>
  );
  const logout = (
    <MenuItem icon="logout" danger onSelect={() => void accounts.logout(service)}>
      {t('settings.account.logout')}
    </MenuItem>
  );

  return (
    <MenuPopup
      label={t(expired ? 'accountMenu.labelExpired' : 'accountMenu.label', { service: label })}
      align="start"
      // Au-dessus de la barre d'état, à 12 px du bord ; largeur du contenu entre 288 et 376 px (jamais plus que la page)
      placement="bottom-full left-3 mb-2 w-max min-w-72 max-w-[min(23.5rem,calc(100vw-1.5rem))]"
      describedBy={infoId}
      root={root}
      onClose={onClose}
    >
      <div id={infoId} data-account-menu={service}>
        <div class="flex items-center gap-2.5 px-2.5 py-2">
          <Avatar service={service} url={avatarOf(viewer)} dimmed={expired} />
          <span class="flex min-w-0 flex-1 flex-col">
            <span class="truncate font-extrabold text-ink">{label}</span>
            {status}
          </span>
        </div>
        {DIVIDER}
        {!expired && stats !== 'hidden' && <StatTiles stats={stats} />}
        {!expired && weekly !== 'hidden' && <WeekRow count={weekly} />}
      </div>
      {!expired && <MenuSeparator />}
      {expired && (
        <MenuItem icon="retry" emphasis onSelect={() => void accounts.login(service)}>
          {t('common.reconnect')}
        </MenuItem>
      )}
      {profile}
      {logout}
    </MenuPopup>
  );
}
