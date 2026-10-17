// @vitest-environment happy-dom
import { act } from 'preact/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setLocale, t, tp } from '../i18n';
import type { AniListViewer } from '../shared/anilist.types';
import type { TrackerId } from '../shared/tracker.types';
import type { AccountMenuData } from './account-menu';
import { formatRelativeTime } from '../shared/watching';
import { createStore, LOGGED_OUT, type AccountState, type Store } from './state';
import { mountStatusBar, type StatusBarHostDeps } from './status-bar-host';
import type { StatusBarData, StatusBarSource } from './status-bar-source';

// Barre d'état montée par le popup et le panneau : état choisi par le modèle, « J'ai vu, masquer », navigation au clic,
// clés de focus suivies par les tests de bout en bout, menu du compte, démontage

const NOW = 1_800_000_000_000;
const MIN = 60_000;

const IN: AccountState<unknown> = { status: 'logged-in', viewer: null, error: null };
const EXPIRED: AccountState<unknown> = { ...LOGGED_OUT, expired: true };

const EMPTY: StatusBarData = {
  reviews: 0,
  queue: { failed: 0, pending: 0 },
  toRate: 0,
  recentSyncs: [],
  syncsSeenAt: null,
  importSeenAt: null,
  importJob: null,
  alignJob: null,
  syncStartedAt: null,
};

const recent = (n: number, syncedAt: number) => ({
  key: `crunchyroll:G${n}:s1`,
  episode: {
    platform: 'crunchyroll' as const,
    episodeId: `EP${n}`,
    seriesId: `G${n}`,
    seriesSlug: 'serie',
    animeTitle: 'Série',
    seasonNumber: 1,
    seasonTitle: null,
    seasonEpisodeNumber: n,
    displayedEpisodeNumber: n,
    episodeTitle: null,
    url: `https://www.crunchyroll.com/watch/EP${n}`,
  },
  mediaId: n,
  mediaTitle: 'Frieren',
  progress: 6,
  syncedAt,
});

let container: HTMLElement;
let accounts: Record<TrackerId, Store<AccountState<unknown>>>;
let data: Store<StatusBarData>;
let markSeen: ReturnType<typeof vi.fn<StatusBarSource['markSeen']>>;
let deps: StatusBarHostDeps;
let menuData: { [K in keyof AccountMenuData]: ReturnType<typeof vi.fn<AccountMenuData[K]>> };
let refresh: ReturnType<typeof vi.fn<(service: TrackerId) => Promise<void>>>;
let dispose: (() => void) | null;

const $ = <T extends HTMLElement = HTMLElement>(selector: string): T | null => container.querySelector<T>(selector);
const statusText = (): string => $('[role="status"]')?.textContent ?? '';

async function mount(patch: Partial<StatusBarHostDeps> = {}): Promise<void> {
  await act(() => {
    dispose = mountStatusBar(container, { ...deps, ...patch }).dispose;
  });
}
const update = (next: Partial<StatusBarData>): Promise<void> => act(() => data.set({ ...data.get(), ...next }));

beforeEach(() => {
  setLocale('fr');
  container = document.createElement('div');
  document.body.append(container);
  accounts = { anilist: createStore<AccountState<unknown>>(IN), mal: createStore<AccountState<unknown>>(IN) };
  data = createStore(EMPTY);
  markSeen = vi.fn<StatusBarSource['markSeen']>(async () => undefined);
  menuData = {
    weeklySyncs: vi.fn<AccountMenuData['weeklySyncs']>(async () => 9),
    // Profil lu il y a 5 min : aucune relecture à l'ouverture
    viewerFetchedAt: vi.fn<AccountMenuData['viewerFetchedAt']>(async () => NOW - 5 * MIN),
    cachedViewer: vi.fn<AccountMenuData['cachedViewer']>(async () => null),
  };
  refresh = vi.fn<(service: TrackerId) => Promise<void>>(async () => undefined);
  deps = {
    accounts: { store: (service) => accounts[service], login: vi.fn(async () => undefined), logout: vi.fn(async () => undefined), refresh },
    menuData,
    source: { store: data, load: async () => undefined, markSeen, dispose: vi.fn() },
    openActivity: vi.fn(),
    openImport: vi.fn(),
    now: () => NOW,
  };
  dispose = null;
});

afterEach(async () => {
  await act(() => dispose?.());
  container.remove();
});

describe('mountStatusBar', () => {
  it('« à jour » : date relative visible, « Tout est synchronisé » lu par le lecteur d’écran et en infobulle ; logos : menu du compte', async () => {
    data.set({ ...EMPTY, recentSyncs: [recent(1, NOW - 5 * 24 * 60 * MIN)] });
    await mount();
    const message = $('[data-status-message]');
    expect(message?.getAttribute('title')).toBe(t('footer.allSynced'));
    expect(statusText()).toContain(formatRelativeTime(NOW - 5 * 24 * 60 * MIN, NOW));
    expect($('[role="status"] .sr-only')?.textContent).toBe(`${t('footer.allSynced')} · ${formatRelativeTime(NOW - 5 * 24 * 60 * MIN, NOW)}`);
    const chip = $<HTMLButtonElement>('[data-focus="chip-anilist"]');
    expect(chip?.getAttribute('aria-label')).toBe(t('accountMenu.label', { service: 'AniList' }));
    expect(chip?.getAttribute('aria-haspopup')).toBe('menu');
    expect(chip?.getAttribute('aria-expanded')).toBe('false');
    // Version : plus dans la barre (Réglages › Aide et à propos)
    expect(container.textContent).not.toMatch(/v\d+\.\d+/);
  });

  it('synchro terminée non vue : série sur la 1re ligne ; × la marque vue ; clic : vue puis Activité', async () => {
    data.set({ ...EMPTY, recentSyncs: [recent(1, NOW - MIN)] });
    await mount();
    expect($('[data-status-series]')?.textContent).toBe('Frieren');
    expect($('[data-status-line]')?.textContent).toBe(t('footer.syncedEpisode', { episode: 6 }));
    $<HTMLButtonElement>('[data-focus="footer-dismiss"]')?.click();
    expect(markSeen).toHaveBeenCalledWith('syncs', NOW);
    $<HTMLButtonElement>('[data-focus="footer-synced"]')?.click();
    expect(markSeen).toHaveBeenCalledTimes(2);
    expect(deps.openActivity).toHaveBeenCalledTimes(1);
    // Plusieurs synchros : compte au pluriel
    await update({ recentSyncs: [{ ...recent(1, NOW - MIN), earlierSyncs: [NOW - 2 * MIN] }] });
    expect($('[data-status-line]')?.textContent).toBe(tp('footer.syncedEpisodes', 2));
  });

  it('sans Activité (panneau sans popup ouvrable) : message en texte, × toujours là', async () => {
    data.set({ ...EMPTY, recentSyncs: [recent(1, NOW - MIN)], reviews: 0 });
    await mount({ openActivity: null });
    expect($('[data-status-message]')?.tagName).toBe('SPAN');
    expect($('[data-focus="footer-dismiss"]')).not.toBeNull();
  });

  it('file et vérifications : bouton vers Activité (clés footer-queue, footer-pending), nom accessible « — voir l’activité »', async () => {
    data.set({ ...EMPTY, queue: { failed: 2, pending: 0 } });
    await mount();
    const queue = $<HTMLButtonElement>('[data-focus="footer-queue"]');
    const label = tp('footer.queueFailed', 2);
    expect(queue?.getAttribute('aria-label')).toBe(t('footer.seeActivity', { label }));
    queue?.click();
    expect(deps.openActivity).toHaveBeenCalledTimes(1);
    await update({ queue: { failed: 0, pending: 1 }, reviews: 2 });
    expect($('[data-focus="footer-pending"]')?.textContent).toContain(`${tp('footer.toReview', 2)} · ${tp('footer.queuePending', 1)}`);
  });

  it('session expirée : logo grisé, « Reconnecter » (footer-reconnect) relance la connexion du service', async () => {
    accounts.mal.set(EXPIRED);
    await mount();
    expect($('[data-focus="chip-mal"]')?.getAttribute('aria-label')).toBe(t('accountMenu.labelExpired', { service: 'MyAnimeList' }));
    expect(statusText()).toContain(t('common.sessionExpired'));
    const reconnect = $<HTMLButtonElement>('[data-focus="footer-reconnect"]');
    expect(reconnect?.getAttribute('aria-label')).toBe(t('common.reconnectService', { service: 'MyAnimeList' }));
    reconnect?.click();
    expect(deps.accounts.login).toHaveBeenCalledWith('mal');
  });

  it('aucun compte : aucun logo, rien de cliquable', async () => {
    accounts.anilist.set(LOGGED_OUT);
    accounts.mal.set(LOGGED_OUT);
    await mount();
    expect(container.querySelectorAll('button')).toHaveLength(0);
    expect(statusText()).toBe(t('feedback.notConnected.title'));
  });

  it('import en cours : progression et page d’import de la plateforme ; terminé : × marque l’import vu', async () => {
    data.set({ ...EMPTY, importJob: { phase: 'apply', status: 'running', done: 42, total: 120, updated: 0, updatedAt: NOW - MIN, platform: 'adn', planItems: null } });
    await mount();
    expect(statusText()).toContain(t('footer.importProgress', { platform: 'ADN', done: 42, total: 120 }));
    expect($<HTMLElement>('[data-status-progress] span')?.style.width).toBe('35%');
    $<HTMLButtonElement>('[data-focus="footer-job"]')?.click();
    expect(deps.openImport).toHaveBeenCalledWith('adn');
    await update({ importJob: { phase: 'apply', status: 'done', done: 120, total: 120, updated: 36, updatedAt: NOW - MIN, platform: 'adn', planItems: null } });
    expect(statusText()).toContain(tp('footer.importDone', 36));
    expect($('[data-status-progress]')).toBeNull();
    $<HTMLButtonElement>('[data-focus="footer-dismiss"]')?.click();
    expect(markSeen).toHaveBeenCalledWith('import', NOW);
  });

  it('alignement en cours : Activité', async () => {
    data.set({ ...EMPTY, alignJob: { status: 'running', done: 3, total: 10, updatedAt: NOW - MIN } });
    await mount();
    expect(statusText()).toContain(t('compare.bulk.running', { done: 3, total: 10 }));
    $<HTMLButtonElement>('[data-focus="footer-job"]')?.click();
    expect(deps.openActivity).toHaveBeenCalledTimes(1);
  });

  it('nouvelle langue : texte retraduit sans remontage', async () => {
    await mount();
    expect($('[data-status-message]')?.textContent).toContain(t('footer.allSynced'));
    await act(() => setLocale('en'));
    expect($('[data-status-message]')?.textContent).toContain('Everything is synced');
  });

  it('dispose : arbre démonté, source libérée', async () => {
    await mount();
    await act(() => dispose?.());
    dispose = null;
    expect(container.childElementCount).toBe(0);
    expect(deps.source?.dispose).toHaveBeenCalledTimes(1);
  });
});

// ─── Menu du compte ───────────────────────────────────────────────────────

const STATS = { animeCount: 142, episodes: 3210, days: 54.3 };
const VIEWER: AniListViewer = { id: 5, name: 'Kai_fan', siteUrl: 'https://anilist.co/user/Kai_fan', avatarUrl: null, stats: STATS };
const menu = (): HTMLElement | null => $('[role="menu"]');
const items = (): HTMLElement[] => [...(menu()?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])];
const chip = (service: TrackerId): HTMLButtonElement | null => $<HTMLButtonElement>(`[data-focus="chip-${service}"]`);
/** Clic sur le logo, puis lectures de l'ouverture (stockage simulé) */
async function openMenu(service: TrackerId): Promise<void> {
  await act(() => chip(service)?.click());
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}
const key = (name: string): Promise<void> => act(() => void document.activeElement?.dispatchEvent(new KeyboardEvent('keydown', { key: name, bubbles: true })));

describe('menu du compte', () => {
  beforeEach(() => accounts.anilist.set({ status: 'logged-in', viewer: VIEWER, error: null }));

  it('connecté : nom, statistiques et synchros de la semaine ; focus sur « Voir mon profil », flèches entre les options', async () => {
    await mount();
    await openMenu('anilist');
    expect(chip('anilist')?.getAttribute('aria-expanded')).toBe('true');
    expect(menu()?.getAttribute('aria-label')).toBe(t('accountMenu.label', { service: 'AniList' }));
    expect($('[data-account-status]')?.textContent).toBe(t('accountMenu.connectedAs', { name: 'Kai_fan' }));
    const tiles = [...container.querySelectorAll('[data-stat]')].map((tile) => tile.textContent);
    const n = new Intl.NumberFormat('fr');
    expect(tiles).toEqual([
      `${n.format(142)}${tp('accountMenu.stats.anime', 142)}`,
      `${n.format(3210)}${tp('accountMenu.stats.episodes', 3210)}`,
      `${t('accountMenu.stats.daysValue', { days: '54' })}${tp('accountMenu.stats.days', 54)}`,
    ]);
    expect($('[data-week] [title]')?.getAttribute('title')).toBe(t('accountMenu.week.title'));
    expect($('[data-week-value]')?.textContent).toBe(tp('accountMenu.week.value', 9));
    expect(menuData.weeklySyncs).toHaveBeenCalledWith('anilist');
    // Profil récent : aucune requête
    expect(refresh).not.toHaveBeenCalled();
    const [profile, logout] = items();
    expect(profile?.getAttribute('href')).toBe('https://anilist.co/user/Kai_fan');
    expect(profile?.getAttribute('target')).toBe('_blank');
    expect(document.activeElement).toBe(profile);
    await key('ArrowDown');
    expect(document.activeElement).toBe(logout);
    expect(logout?.textContent).toBe(t('settings.account.logout'));
  });

  it('Échap ferme et rend le focus au logo ; clic dehors ferme ; nouveau clic sur le logo : fermé', async () => {
    await mount();
    await openMenu('anilist');
    await key('Escape');
    expect(menu()).toBeNull();
    expect(document.activeElement).toBe(chip('anilist'));
    expect(chip('anilist')?.getAttribute('aria-expanded')).toBe('false');
    await openMenu('anilist');
    await act(() => void document.body.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true })));
    expect(menu()).toBeNull();
    await openMenu('anilist');
    await act(() => chip('anilist')?.click());
    expect(menu()).toBeNull();
  });

  it('profil lu il y a plus d’une heure : une relecture, squelette des tuiles sans statistiques ; illisibles : tuiles masquées, le reste gardé', async () => {
    accounts.anilist.set({ status: 'logged-in', viewer: { ...VIEWER, stats: null }, error: null });
    menuData.viewerFetchedAt.mockResolvedValue(NOW - 2 * 60 * MIN);
    let finish = (): void => undefined;
    refresh.mockImplementation(() => new Promise<void>((resolve) => (finish = resolve)));
    await mount();
    await openMenu('anilist');
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(refresh).toHaveBeenCalledWith('anilist');
    expect(container.querySelectorAll('[data-stat] [data-skeleton]')).toHaveLength(3);
    await act(async () => finish());
    expect($('[data-stats]')).toBeNull();
    expect($('[data-week-value]')?.textContent).toBe(tp('accountMenu.week.value', 9));
    expect(items()).toHaveLength(2);
  });

  it('profil en cours de lecture : squelettes, puis tuiles affichées à son arrivée sans rouvrir', async () => {
    accounts.anilist.set({ status: 'logged-in', viewer: null, error: null });
    await mount();
    await openMenu('anilist');
    expect($('[data-account-status]')).toBeNull();
    expect(container.querySelectorAll('[data-stat] [data-skeleton]')).toHaveLength(3);
    expect(refresh).not.toHaveBeenCalled();
    await act(() => accounts.anilist.set({ status: 'logged-in', viewer: VIEWER, error: null }));
    expect(container.querySelectorAll('[data-skeleton]')).toHaveLength(0);
    expect(container.querySelectorAll('[data-stat]')).toHaveLength(3);
  });

  it('session expirée : point rouge, « Reconnecter » d’abord, profil en cache, aucune statistique', async () => {
    accounts.mal.set(EXPIRED);
    menuData.cachedViewer.mockResolvedValue({ id: 7, name: 'Kai fan', pictureUrl: null });
    await mount();
    await openMenu('mal');
    expect(menu()?.getAttribute('aria-label')).toBe(t('accountMenu.labelExpired', { service: 'MyAnimeList' }));
    expect($('[data-account-status="expired"]')?.textContent).toBe(t('common.sessionExpired'));
    expect($('[data-stats]')).toBeNull();
    expect($('[data-week]')).toBeNull();
    const [reconnect, profile, logout] = items();
    expect(reconnect?.textContent).toBe(t('common.reconnect'));
    expect(profile?.getAttribute('href')).toBe('https://myanimelist.net/profile/Kai%20fan');
    expect(logout?.dataset.danger).toBe('');
    await act(() => reconnect?.click());
    expect(deps.accounts.login).toHaveBeenCalledWith('mal');
    expect(menu()).toBeNull();
  });

  it('« Se déconnecter » : déconnexion du service, menu fermé avec le logo', async () => {
    await mount();
    await openMenu('anilist');
    await act(() => items()[1]?.click());
    expect(deps.accounts.logout).toHaveBeenCalledWith('anilist');
    await act(() => accounts.anilist.set(LOGGED_OUT));
    expect(menu()).toBeNull();
    expect(chip('anilist')).toBeNull();
  });
});
