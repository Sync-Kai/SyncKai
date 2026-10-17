// @vitest-environment happy-dom
import { render } from 'preact';
import { act } from 'preact/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getLocale, setLocale, t } from '../../i18n';
import type { StreamingPlatform } from '../../platforms/registry';
import { DEFAULT_SETTINGS, type SyncSettings } from '../../shared/settings';
import type { PlatformAccessStore } from '../platform-access-store';
import { createStore } from '../state';
import type { SettingsContext, SettingsData } from './context';
import { PlatformsPage } from './page-platforms';

const access = vi.hoisted(() => ({
  request: vi.fn<(platform: string) => Promise<boolean>>(async () => true),
  remove: vi.fn<(platform: string) => Promise<boolean>>(async () => true),
  hostGranted: true,
}));

vi.mock('../platform-access-store', () => ({ requestPlatformAccessFromClick: (platform: string) => access.request(platform) }));
vi.mock('../../browser/platform-access', () => ({ removePlatformAccess: (platform: string) => access.remove(platform) }));
vi.mock('../../browser/host-access', () => ({
  requiredOrigins: () => ['https://*.crunchyroll.com/*'],
  hasHostAccess: async () => access.hostGranted,
  requestHostAccess: async () => false,
}));

describe('PlatformsPage (maquettes Plateformes, PlateformesLecteur, PlateformesAcces)', () => {
  const initial = getLocale();
  let container: HTMLElement;
  const update = vi.fn(async (_patch: Partial<SyncSettings>) => undefined);

  const $ = <T extends Element = HTMLElement>(selector: string): T | null => container.querySelector<T>(selector);
  const flush = (): Promise<void> => act(async () => new Promise((resolve) => setTimeout(resolve, 0)));

  async function mount({ granted = [] as StreamingPlatform[], settings = DEFAULT_SETTINGS, hostAccessBanner = false } = {}): Promise<void> {
    const data: SettingsData = {
      settings,
      settingsError: false,
      mappings: null,
      mappingsError: null,
      exclusions: { status: 'loading' },
      journalCount: null,
      airing: null,
      platformAccess: granted,
    };
    const platformAccess = { refresh: vi.fn(async () => granted), onPermissionsChange: () => () => undefined } as Partial<PlatformAccessStore> as PlatformAccessStore;
    const host = { platformAccess, hostAccessBanner } as Partial<SettingsContext['host']> as SettingsContext['host'];
    const ctx = { host, data, state: createStore(data), update } as Partial<SettingsContext> as SettingsContext;
    await act(() => render(<PlatformsPage ctx={ctx} notices={createStore({ netflix: null, disney: null, prime: null })} />, container));
    await flush();
  }

  async function playerOptions(): Promise<Record<string, string>> {
    await act(() => $<HTMLButtonElement>('[data-focus="player"]')?.click());
    const options = [...container.querySelectorAll('[role="option"]')];
    return Object.fromEntries(options.map((option) => [option.getAttribute('data-focus') ?? '', option.getAttribute('aria-disabled') === 'true' ? 'disabled' : 'offered']));
  }

  beforeEach(() => {
    // Manifeste lu pour les origines des sites (requiredOrigins est simulé)
    vi.stubGlobal('chrome', { runtime: { getManifest: () => ({}) } });
    setLocale('fr');
    container = document.createElement('div');
    document.body.append(container);
    access.hostGranted = true;
    access.request.mockClear();
    access.remove.mockClear();
    update.mockClear();
  });

  afterEach(async () => {
    await act(() => render(null, container));
    container.remove();
    setLocale(initial);
    vi.unstubAllGlobals();
  });

  it('Crunchyroll et ADN inclus ; lecteur préféré : plateforme accordée proposée, non accordée grisée « Activer d’abord », jamais Disney+', async () => {
    await mount({ granted: ['netflix'] });
    expect([...container.querySelectorAll('[data-platform-state]')].map((el) => el.textContent)).toEqual([t('settings.platforms.included'), t('settings.platforms.included')]);
    expect(await playerOptions()).toEqual({ 'player-crunchyroll': 'offered', 'player-adn': 'offered', 'player-netflix': 'offered', 'player-prime': 'disabled' });
    expect($('[data-focus="player-prime"]')?.textContent).toContain(t('settings.player.enableFirst'));
  });

  it('activation : demande envoyée dans le clic ; refus affiché sous l’interrupteur', async () => {
    access.request.mockResolvedValueOnce(false);
    await mount();
    await act(() => $<HTMLButtonElement>('[data-focus="sk-prime"]')?.click());
    expect(access.request).toHaveBeenCalledWith('prime');
    await flush();
    expect($('[data-platform-notice="denied"]')?.textContent).toBe(t('settings.prime.denied'));
  });

  it('retrait de Netflix, lecteur préféré : le lecteur repasse sur Crunchyroll', async () => {
    await mount({ granted: ['netflix'], settings: { ...DEFAULT_SETTINGS, preferredPlayer: 'netflix' } });
    expect($('[data-focus="player"] [data-select-value]')?.textContent).toBe('Netflix');
    await act(() => $<HTMLButtonElement>('[data-focus="sk-netflix"]')?.click());
    await flush();
    expect(access.remove).toHaveBeenCalledWith('netflix');
    expect(update).toHaveBeenCalledWith({ preferredPlayer: 'crunchyroll' });
  });

  it('accès aux sites retiré (Firefox) : « Accès manquant » et bandeau « Autoriser l’accès », sauf si l’hôte a déjà le sien', async () => {
    access.hostGranted = false;
    await mount();
    expect([...container.querySelectorAll('[data-platform-state]')].map((el) => el.getAttribute('data-platform-state'))).toEqual(['missing', 'missing']);
    expect($('[data-host-access]')?.textContent).toContain(t('popup.hostAccessAllow'));

    await act(() => render(null, container));
    await mount({ hostAccessBanner: true });
    expect($('[data-host-access]')).toBeNull();
    expect($('[data-platform-state]')?.getAttribute('data-platform-state')).toBe('missing');
  });

  it('heure de sortie : cinq plateformes, + enregistre le délai de la plateforme seule', async () => {
    await mount();
    expect(container.querySelectorAll('[data-offset-row]')).toHaveLength(5);
    await act(() => $<HTMLButtonElement>('[data-focus="offset-disney-plus"]')?.click());
    expect(update).toHaveBeenCalledWith({ platformOffsets: { ...DEFAULT_SETTINGS.platformOffsets, disney: 75 } });
  });
});
