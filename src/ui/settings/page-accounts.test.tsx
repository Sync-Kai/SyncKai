// @vitest-environment happy-dom
import { render } from 'preact';
import { act } from 'preact/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getLocale, setLocale, t } from '../../i18n';
import { DEFAULT_SETTINGS } from '../../shared/settings';
import type { AccountsController } from '../accounts';
import { createStore, LOGGED_OUT, type AniListState, type MalState } from '../state';
import type { SettingsContext, SettingsData } from './context';
import { AccountsPage, accountRowKind } from './page-accounts';

vi.mock('../../browser/storage/viewer-cache', () => ({
  getCachedViewer: vi.fn(async () => null),
  getCachedMalViewer: vi.fn(async () => ({ id: 7, name: 'Kai_mal', pictureUrl: null })),
}));

describe('accountRowKind', () => {
  it('chargement, ou connecté sans profil ni erreur : squelette', () => {
    expect(accountRowKind({ status: 'loading' })).toBe('skeleton');
    expect(accountRowKind({ status: 'logged-in', viewer: null, error: null })).toBe('skeleton');
  });

  it('UI-04 : connecté, profil jamais chargé et lecture en échec : erreur (Réessayer), pas de squelette sans fin', () => {
    expect(accountRowKind({ status: 'logged-in', viewer: null, error: 'Réseau indisponible' })).toBe('profile-error');
  });

  it('profil chargé (avec ou sans erreur de rafraîchissement) ; déconnecté', () => {
    expect(accountRowKind({ status: 'logged-in', viewer: { name: 'Kai' }, error: null })).toBe('profile');
    expect(accountRowKind({ status: 'logged-in', viewer: { name: 'Kai' }, error: 'Réseau indisponible' })).toBe('profile');
    expect(accountRowKind(LOGGED_OUT)).toBe('logged-out');
  });
});

const ANILIST_VIEWER = { id: 1, name: 'Kai_fan', siteUrl: 'https://anilist.co/user/Kai_fan', avatarUrl: null };
const MAL_VIEWER = { id: 7, name: 'Kai_mal', pictureUrl: null };

describe('AccountsPage (maquettes Comptes, ComptesConnexion)', () => {
  const initial = getLocale();
  let container: HTMLElement;
  let anilist: ReturnType<typeof createStore<AniListState>>;
  let mal: ReturnType<typeof createStore<MalState>>;
  const login = vi.fn(async () => undefined);
  const logout = vi.fn(async () => undefined);
  const refresh = vi.fn(async () => undefined);
  const update = vi.fn(async () => undefined);

  const $ = <T extends Element = HTMLElement>(selector: string): T | null => container.querySelector<T>(selector);
  const card = (service: string): HTMLElement | null => $(`[data-account-card="${service}"]`);

  async function mount(): Promise<void> {
    const accounts = { anilist, mal, login, logout, refresh } as Partial<AccountsController> as AccountsController;
    const data: SettingsData = {
      settings: DEFAULT_SETTINGS,
      settingsError: false,
      mappings: null,
      mappingsError: null,
      exclusions: { status: 'loading' },
      journalCount: null,
      airing: null,
      platformAccess: [],
    };
    const host = { accounts } as Partial<SettingsContext['host']> as SettingsContext['host'];
    const ctx = { host, state: createStore(data), update } as Partial<SettingsContext> as SettingsContext;
    await act(() => render(<AccountsPage ctx={ctx} />, container));
  }

  beforeEach(() => {
    setLocale('fr');
    container = document.createElement('div');
    document.body.append(container);
    anilist = createStore<AniListState>({ status: 'logged-in', viewer: ANILIST_VIEWER, error: null });
    mal = createStore<MalState>({ status: 'logged-in', viewer: MAL_VIEWER, error: null });
    for (const fn of [login, logout, refresh, update]) fn.mockClear();
  });

  afterEach(async () => {
    await act(() => render(null, container));
    container.remove();
    setLocale(initial);
  });

  it('deux comptes connectés : pseudo, « Voir mon profil » vers le profil, « Déconnecter » ; choix de la fiche actif', async () => {
    await mount();
    expect(card('anilist')?.textContent).toContain(t('accountMenu.connectedAs', { name: 'Kai_fan' }));
    expect($<HTMLAnchorElement>('[data-focus="profile-anilist"]')?.getAttribute('href')).toBe('https://anilist.co/user/Kai_fan');
    expect($('[data-focus="profile-mal"]')?.getAttribute('href')).toBe('https://myanimelist.net/profile/Kai_mal');
    await act(() => $('[data-focus="logout-mal"]')?.click());
    expect(logout).toHaveBeenCalledWith('mal');
    expect($('[data-focus="entry-service-anilist"]')?.getAttribute('aria-checked')).toBe('true');
    expect($('[data-focus="entry-service-mal"]')?.hasAttribute('disabled')).toBe(false);
    expect($('[data-entry-unavailable]')).toBeNull();
    await act(() => $('[data-focus="entry-service-mal"]')?.click());
    expect(update).toHaveBeenCalledWith({ entryService: 'mal' });
    expect(container.textContent).toContain(t('settings.accounts.privacy'));
  });

  it('session expirée : « Session expirée », « Reconnecter » (principal), explication avec l’autre service, profil en cache', async () => {
    mal.set({ ...LOGGED_OUT, expired: true });
    await mount();
    const expired = card('mal');
    expect(expired?.className).toContain('border-danger/30');
    expect(expired?.querySelector('[data-account-status="error"]')?.textContent).toBe(t('common.sessionExpired'));
    const reconnect = $('[data-focus="login-mal"]');
    expect(reconnect?.getAttribute('data-variant')).toBe('primary');
    expect(reconnect?.textContent).toBe(t('common.reconnect'));
    expect(reconnect?.getAttribute('aria-label')).toBe(t('common.reconnectService', { service: 'MyAnimeList' }));
    expect(expired?.textContent).toContain(t('settings.account.expiredHelp', { service: 'MyAnimeList' }));
    expect(expired?.textContent).toContain(t('settings.account.otherStillSynced', { service: 'AniList' }));
    await act(async () => {
      await Promise.resolve();
    });
    expect($('[data-focus="profile-mal"]')?.getAttribute('href')).toBe('https://myanimelist.net/profile/Kai_mal');
    expect($('[data-focus="logout-mal"]')).not.toBeNull();
    await act(() => reconnect?.click());
    expect(login).toHaveBeenCalledWith('mal');
    // Un seul compte connecté : choix de la fiche désactivé et expliqué
    expect($('[data-focus="entry-service-mal"]')?.hasAttribute('disabled')).toBe(true);
    expect($('[data-entry-unavailable]')?.textContent).toBe(t('settings.entry.unavailable'));
  });

  it('non connecté : « Non connecté », « Connecter » ; connexion en cours : « Connexion… » occupé ; erreur sous l’en-tête', async () => {
    anilist.set(LOGGED_OUT);
    await mount();
    expect(card('anilist')?.querySelector('[data-account-status="muted"]')?.textContent).toBe(t('settings.account.notConnected'));
    expect($('[data-focus="login-anilist"]')?.textContent).toBe(t('common.connect'));
    expect($('[data-focus="logout-anilist"]')).toBeNull();
    expect(card('anilist')?.querySelector('[data-avatar]')?.getAttribute('data-avatar')).toBe('disconnected');

    await act(() => anilist.set({ ...LOGGED_OUT, pending: true }));
    expect($('[data-focus="login-anilist"]')?.textContent).toBe(t('common.connecting'));
    expect($('[data-focus="login-anilist"]')?.getAttribute('aria-busy')).toBe('true');

    await act(() => anilist.set({ ...LOGGED_OUT, error: t('auth.cancelled') }));
    expect(card('anilist')?.querySelector('[data-alert]')?.getAttribute('data-alert')).toBe(t('auth.cancelled'));
    expect(card('anilist')?.querySelector('[data-alert] button')).toBeNull();
  });

  it('chargement : squelette nommé ; connecté sans profil et lecture en échec : alerte « Réessayer » et déconnexion', async () => {
    anilist.set({ status: 'loading' });
    mal.set({ status: 'logged-in', viewer: null, error: 'MyAnimeList injoignable' });
    await mount();
    expect(card('anilist')?.querySelector('[aria-busy="true"]')?.getAttribute('aria-label')).toBe(t('settings.account.loading', { service: 'AniList' }));
    const alert = card('mal')?.querySelector('[data-alert]');
    expect(alert?.getAttribute('data-alert')).toBe('MyAnimeList injoignable');
    expect(card('mal')?.textContent).toContain(t('settings.account.connected', { service: 'MyAnimeList' }));
    await act(() => alert?.querySelector('button')?.click());
    expect(refresh).toHaveBeenCalledWith('mal');
    expect($('[data-focus="logout-mal"]')).not.toBeNull();
    expect($('[data-focus="profile-mal"]')).toBeNull();
  });
});
