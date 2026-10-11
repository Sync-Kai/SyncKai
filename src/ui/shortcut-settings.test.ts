import { afterEach, describe, expect, it, vi } from 'vitest';
import { CHROME_SHORTCUTS_URL, openShortcutSettings } from './shortcut-settings';

afterEach(() => vi.unstubAllGlobals());

describe('openShortcutSettings (BRW-02)', () => {
  it('Chrome, Edge, Brave : onglet chrome://extensions/shortcuts', async () => {
    const create = vi.fn(() => Promise.resolve({}));
    vi.stubGlobal('chrome', { tabs: { create }, commands: {} });
    await openShortcutSettings('chrome');
    expect(create).toHaveBeenCalledWith({ url: CHROME_SHORTCUTS_URL });
  });

  it('Firefox : commands.openShortcutSettings(), jamais d’URL chrome://', async () => {
    const create = vi.fn(() => Promise.resolve({}));
    const commands = { getAll: vi.fn(), openShortcutSettings: vi.fn(() => Promise.resolve()) };
    vi.stubGlobal('chrome', { tabs: { create }, commands });
    await openShortcutSettings('firefox');
    expect(commands.openShortcutSettings).toHaveBeenCalledTimes(1);
    expect(create).not.toHaveBeenCalled();
  });

  it('Firefox sans l’API (version trop ancienne) : rejet, pour afficher la marche à suivre', async () => {
    const create = vi.fn(() => Promise.resolve({}));
    vi.stubGlobal('chrome', { tabs: { create }, commands: { getAll: vi.fn() } });
    await expect(openShortcutSettings('firefox')).rejects.toThrow();
    expect(create).not.toHaveBeenCalled();
  });

  it('onglet refusé : le rejet remonte à l’appelant', async () => {
    vi.stubGlobal('chrome', { tabs: { create: () => Promise.reject(new Error('Illegal URL')) }, commands: {} });
    await expect(openShortcutSettings('chrome')).rejects.toThrow('Illegal URL');
  });
});
