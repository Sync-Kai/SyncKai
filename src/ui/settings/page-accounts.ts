// Réglages › Comptes : cartes AniList / MyAnimeList (connexion, déconnexion, reconnexion).
import { t } from '../../i18n';
import type { AniListViewer } from '../../shared/anilist.types';
import type { MalViewer } from '../../shared/mal.types';
import { TRACKER_IDS, TRACKER_LABELS, type TrackerId } from '../../shared/tracker.types';
import { renderAlert } from '../alert';
import { BTN_GHOST, CARD, serviceAvatar } from '../kit';
import type { AccountState } from '../state';
import { serviceIcon } from '../brand-icons';
import { busyAttrs, h, nodes, type Child } from '../dom';
import { icon } from '../icons';
import type { SettingsContext, SettingsPageView } from './context';
import { DIVIDER } from './rows';

function viewerAvatar(service: TrackerId, url: string | null): HTMLElement {
  if (!url) return serviceAvatar(service, 'ok');
  const img = h('img', { class: 'h-8 w-8 rounded-full object-cover', attrs: { src: url, alt: '', referrerpolicy: 'no-referrer' } });
  img.addEventListener('error', () => img.replaceWith(serviceIcon(service, 'h-5 w-5 rounded-[4px]', { decorative: true })), { once: true });
  return serviceAvatar(service, 'ok', img);
}

/** Affichage d'une carte de compte ; `profile-error` : connecté, profil jamais chargé et lecture en échec (UI-04) */
export type AccountRowKind = 'skeleton' | 'logged-out' | 'profile' | 'profile-error';

export function accountRowKind(state: AccountState<unknown>): AccountRowKind {
  if (state.status === 'loading') return 'skeleton';
  if (state.status === 'logged-out') return 'logged-out';
  if (state.viewer) return 'profile';
  // Squelette seulement pendant le chargement : une erreur sans profil en cache doit rester visible
  return state.error === null ? 'skeleton' : 'profile-error';
}

function accountRow(ctx: SettingsContext, service: TrackerId, state: AccountState<AniListViewer | MalViewer>, first: boolean): Child[] {
  const { accounts } = ctx.host;
  const label = TRACKER_LABELS[service];
  const row = (...children: Child[]): HTMLElement => h('div', { class: `flex min-h-[52px] items-center gap-3 ${first ? '' : DIVIDER}` }, ...children);
  const text = (title: Child, sub: string, subClass = 'text-muted'): HTMLElement =>
    h(
      'div',
      { class: 'flex min-w-0 flex-1 flex-col gap-0.5' },
      h('span', { class: 'truncate text-[13px] font-bold' }, title),
      h('span', { class: `text-[11px] font-semibold ${subClass}` }, sub),
    );
  const logoutButton = (): HTMLElement =>
    h(
      'button',
      {
        class: `${BTN_GHOST} text-danger`,
        attrs: { type: 'button', 'aria-label': t('settings.account.logoutAria', { service: label }), 'data-focus': `logout-${service}` },
        on: { click: () => void accounts.logout(service) },
      },
      t('settings.account.logout'),
    );
  const errorAlert = (message: string): HTMLElement =>
    h('div', { class: 'pr-2 pb-2' }, renderAlert({ message, action: { label: t('common.retry'), onClick: () => void accounts.refresh(service) } }));

  if (accountRowKind(state) === 'skeleton') {
    return [
      row(
        h('span', { class: 'h-8 w-8 shrink-0 rounded-full bg-raised motion-safe:animate-pulse' }),
        h(
          'div',
          { class: 'flex flex-1 flex-col gap-1.5 motion-safe:animate-pulse', attrs: { 'aria-busy': 'true', 'aria-label': t('settings.account.loading', { service: label }) } },
          h('span', { class: 'h-3 w-24 rounded bg-raised' }),
          h('span', { class: 'h-2.5 w-20 rounded bg-raised' }),
        ),
      ),
    ];
  }

  if (state.status === 'logged-out') {
    return [
      row(
        serviceAvatar(service, state.expired ? 'expired' : null),
        text(label, state.expired ? t('common.sessionExpired') : t('settings.account.notConnected'), state.expired ? 'text-danger' : 'text-muted'),
        h(
          'button',
          {
            class: `${BTN_GHOST} text-sakura`,
            attrs: {
              type: 'button',
              'aria-label': t(state.expired ? 'common.reconnectService' : 'common.connectService', { service: label }),
              'data-focus': `login-${service}`,
              ...busyAttrs(state.pending, true),
            },
            on: { click: () => void accounts.login(service) },
          },
          state.pending && icon('spinner', 'h-3.5 w-3.5 motion-safe:animate-spin'),
          state.pending ? t('common.connecting') : state.expired ? t('common.reconnect') : t('common.connect'),
        ),
      ),
      state.error && h('div', { class: 'pr-2 pb-2' }, renderAlert({ message: state.error })),
    ];
  }

  if (state.status !== 'logged-in') return []; // Garde de type : chargement couvert par le squelette
  const viewer = state.viewer;
  if (!viewer) {
    // Profil jamais chargé et lecture en échec : service connecté, erreur avec « Réessayer », déconnexion possible
    return [row(serviceAvatar(service, 'ok'), text(label, t('settings.account.connected', { service: label })), logoutButton()), state.error && errorAlert(state.error)];
  }
  const avatarUrl = 'avatarUrl' in viewer ? viewer.avatarUrl : viewer.pictureUrl;
  const profileUrl = 'siteUrl' in viewer ? viewer.siteUrl : `https://myanimelist.net/profile/${encodeURIComponent(viewer.name)}`;

  return [
    row(
      viewerAvatar(service, avatarUrl),
      text(
        h('a', { class: 'text-ink hover:underline', attrs: { href: profileUrl, target: '_blank', rel: 'noopener noreferrer', title: t('settings.account.openProfile', { service: label }) } }, viewer.name),
        t('settings.account.connected', { service: label }),
      ),
      logoutButton(),
    ),
    state.error && errorAlert(state.error),
  ];
}

export function createAccountsPage(ctx: SettingsContext): SettingsPageView {
  return {
    render: () => [
      h(
        'div',
        { class: `${CARD} flex flex-col py-1 pr-1 pl-3` },
        ...nodes(TRACKER_IDS.flatMap((service, i) => accountRow(ctx, service, (service === 'anilist' ? ctx.host.accounts.anilist : ctx.host.accounts.mal).get(), i === 0))),
      ),
    ],
  };
}
