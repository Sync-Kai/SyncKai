// @vitest-environment happy-dom
import { act } from 'preact/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setLocale, t, tp } from '../i18n';
import type { TrackerId } from '../shared/tracker.types';
import { formatRelativeTime } from '../shared/watching';
import { createStore, LOGGED_OUT, type AccountState, type Store } from './state';
import { mountStatusBar, type StatusBarHostDeps } from './status-bar-host';
import type { StatusBarData, StatusBarSource } from './status-bar-source';

// Barre d'état montée par le popup et le panneau : état choisi par le modèle, « J'ai vu, masquer », navigation au clic,
// clés de focus suivies par les tests de bout en bout, démontage

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
  deps = {
    accounts: { store: (service) => accounts[service], login: vi.fn(async () => undefined) },
    source: { store: data, load: async () => undefined, markSeen, dispose: vi.fn() },
    openActivity: vi.fn(),
    openAccounts: vi.fn(),
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
  it('« à jour » : date relative visible, « Tout est synchronisé » lu par le lecteur d’écran et en infobulle ; logos vers Réglages › Comptes', async () => {
    data.set({ ...EMPTY, recentSyncs: [recent(1, NOW - 5 * 24 * 60 * MIN)] });
    await mount();
    const message = $('[data-status-message]');
    expect(message?.getAttribute('title')).toBe(t('footer.allSynced'));
    expect(statusText()).toContain(formatRelativeTime(NOW - 5 * 24 * 60 * MIN, NOW));
    expect($('[role="status"] .sr-only')?.textContent).toBe(`${t('footer.allSynced')} · ${formatRelativeTime(NOW - 5 * 24 * 60 * MIN, NOW)}`);
    const chip = $<HTMLButtonElement>('[data-focus="chip-anilist"]');
    expect(chip?.getAttribute('aria-label')).toBe(t('footer.chip.ok', { service: 'AniList' }));
    expect(chip?.hasAttribute('aria-haspopup')).toBe(false);
    chip?.click();
    expect(deps.openAccounts).toHaveBeenCalledTimes(1);
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
    expect($('[data-focus="chip-mal"]')?.getAttribute('aria-label')).toBe(t('footer.chip.expired', { service: 'MyAnimeList' }));
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
