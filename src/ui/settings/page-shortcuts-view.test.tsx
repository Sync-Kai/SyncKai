// @vitest-environment happy-dom
import { render } from 'preact';
import { act } from 'preact/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getLocale, setLocale, t } from '../../i18n';
import { createStore, type Store } from '../state';
import type { SettingsContext, ShortcutKeys } from './context';
import { createShortcutsPage, ShortcutsPage, type ShortcutKind } from './page-shortcuts';

// Page Réglages › Raccourcis rendue par Preact dans un vrai DOM (happy-dom) : structure attendue par les e2e,
// mise à jour en place (focus conservé, nœuds gardés par Preact), langue suivie, montage / démontage par la vue.

const initial = getLocale();
const KEYS: ShortcutKeys = { shortcut: 'Alt+Shift+K', panelShortcut: 'Alt+Shift+1' };

let container: HTMLElement;
let keys: Store<ShortcutKeys>;
let manual: Store<ShortcutKind | null>;
const create = vi.fn<(props: { url: string }) => Promise<unknown>>();

const $ = (selector: string): HTMLElement | null => container.querySelector<HTMLElement>(selector);
const text = (selector: string): string | null => $(selector)?.textContent ?? null;

function mount(): Promise<void> {
  return act(() => render(<ShortcutsPage keys={keys} manual={manual} />, container));
}

beforeEach(() => {
  setLocale('fr');
  container = document.createElement('div');
  document.body.append(container);
  keys = createStore<ShortcutKeys>(KEYS);
  manual = createStore<ShortcutKind | null>(null);
  create.mockReset().mockResolvedValue({});
  vi.stubGlobal('chrome', { tabs: { create } });
});

afterEach(async () => {
  await act(() => render(null, container));
  container.remove();
  vi.unstubAllGlobals();
  setLocale(initial);
});

describe('ShortcutsPage (Preact)', () => {
  it('même structure que la version DOM : touches, indication AZERTY, libellés, repères de focus et noms accessibles', async () => {
    await mount();
    expect(text('kbd[data-shortcut-key="episode"]')).toBe('Alt+Maj+K');
    expect(text('kbd[data-shortcut-key="panel"]')).toBe('Alt+Maj+1');
    expect(text('[data-shortcut-hint="panel"]')).toBe('touche &');
    expect($('[data-shortcut-hint="episode"]')).toBeNull();
    expect(text('#sk-shortcut-episode')).toBe(t('settings.shortcuts.episode'));
    expect(text('[data-shortcuts-help]')).toBe(t('settings.shortcuts.help'));
    const edit = $('[data-focus="panel-shortcut"]');
    expect(edit?.getAttribute('type')).toBe('button');
    expect(edit?.getAttribute('aria-label')).toBe(t('settings.shortcut.panelEditAria'));
    expect(edit?.getAttribute('aria-describedby')).toBe('sk-shortcut-panel');
    expect(edit?.textContent).toBe(t('settings.shortcut.edit'));
    // Une carte par commande, sous le titre de sa section (maquette Raccourcis)
    expect([...container.querySelectorAll('section > h2')].map((h2) => h2.textContent)).toEqual([t('settings.shortcuts.duringPlayback'), t('settings.shortcuts.navigation')]);
    expect([...container.querySelectorAll('section [data-shortcut-card]')].map((card) => card.getAttribute('data-shortcut-card'))).toEqual(['episode', 'panel']);
  });

  it('touches relues : mise à jour en place, le bouton focalisé reste le même nœud et garde le focus', async () => {
    keys.set({ shortcut: 'Alt+Shift+J', panelShortcut: undefined });
    await mount();
    // Touche en lecture : « Chargement… », bouton désactivé
    expect(text('[data-shortcut-key="panel"]')).toBe(t('settings.summary.loading'));
    expect($('[data-focus="panel-shortcut"]')?.hasAttribute('disabled')).toBe(true);
    const button = $('[data-focus="shortcut"]');
    button?.focus();
    await act(() => keys.set({ shortcut: 'Alt+Shift+K', panelShortcut: '' }));
    expect(text('kbd[data-shortcut-key="episode"]')).toBe('Alt+Maj+K');
    expect(text('[data-shortcut-key="panel"]')).toBe(t('settings.shortcuts.unset'));
    expect(text('[data-focus="panel-shortcut"]')).toBe(t('settings.shortcut.set'));
    expect($('[data-focus="shortcut"]')).toBe(button);
    expect(document.activeElement).toBe(button);
  });

  it('langue changée : textes retraduits en place', async () => {
    await mount();
    await act(() => setLocale('en'));
    expect(text('kbd[data-shortcut-key="panel"]')).toBe('Alt+Shift+1');
    expect($('[data-shortcut-hint="panel"]')).toBeNull();
    expect(text('[data-focus="shortcut"]')).toBe('Change');
  });

  it('« Modifier » ouvre chrome://extensions/shortcuts ; en échec, la marche à suivre s’affiche sous la ligne utilisée', async () => {
    await mount();
    $('[data-focus="shortcut"]')?.click();
    expect(create).toHaveBeenCalledWith({ url: 'chrome://extensions/shortcuts' });
    expect($('[data-shortcut-manual]')).toBeNull();

    create.mockRejectedValueOnce(new Error('refusé'));
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    await act(async () => {
      $('[data-focus="panel-shortcut"]')?.click();
      await Promise.resolve();
    });
    const notice = $('[data-shortcut-manual="panel"]');
    expect(notice?.getAttribute('role')).toBe('status');
    expect(notice?.textContent).toBe(t('settings.shortcut.manual'));
    expect($('[data-shortcut-manual="episode"]')).toBeNull();
  });
});

describe('createShortcutsPage (montage par la vue Réglages)', () => {
  it('démontage : contenu retiré et abonnement retiré ; la marche à suivre survit à une nouvelle visite', async () => {
    // Store compté : abonnements actifs de la page
    let active = 0;
    const shortcuts: Store<ShortcutKeys> = {
      ...keys,
      subscribe(listener) {
        active += 1;
        const off = keys.subscribe(listener);
        return () => {
          active -= 1;
          off();
        };
      },
    };
    const page = createShortcutsPage({ shortcuts } as Partial<SettingsContext> as SettingsContext);
    let unmount = (): void => undefined;
    await act(() => {
      unmount = page.mount(container);
    });
    expect(text('kbd[data-shortcut-key="episode"]')).toBe('Alt+Maj+K');
    expect(active).toBe(1);

    create.mockRejectedValueOnce(new Error('refusé'));
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    await act(async () => {
      $('[data-focus="shortcut"]')?.click();
      await Promise.resolve();
    });
    expect($('[data-shortcut-manual="episode"]')).not.toBeNull();

    await act(() => unmount());
    expect(container.childNodes).toHaveLength(0);
    expect(active).toBe(0);

    await act(() => {
      unmount = page.mount(container);
    });
    expect($('[data-shortcut-manual="episode"]')).not.toBeNull();
    await act(() => unmount());
    expect(active).toBe(0);
  });
});
