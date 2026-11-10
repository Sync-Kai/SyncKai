import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PANEL_TAB_KEY } from '../protocol/storage-keys';
import { installFakeChrome } from '../test/fake-chrome';

// Popup → panneau latéral ouvert sur « Découvrir » : demande d'onglet à usage unique dans storage.session, lue et
// retirée par le panneau à son ouverture, ignorée au-delà de 10 s

const open = vi.fn<(options: unknown) => Promise<void>>();
const setOptions = vi.fn<(options: unknown) => Promise<void>>();
const fake = installFakeChrome({ extra: { sidePanel: { open, setOptions } } });
const { openPanelOn, PANEL_TAB_TTL_MS, takePanelTab } = await import('./panel-tab');

beforeEach(() => {
  fake.reset();
  open.mockReset().mockResolvedValue(undefined);
  setOptions.mockReset().mockResolvedValue(undefined);
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

describe('openPanelOn', () => {
  it('demande écrite dans storage.session (jamais local) et panneau ouvert dans le même tour', async () => {
    const opened = openPanelOn('discover', { windowId: 3 }, 1_000);
    expect(open).toHaveBeenCalledWith({ windowId: 3 });
    expect(await opened).toBe(true);
    expect(fake.session.peek(PANEL_TAB_KEY)).toEqual({ tab: 'discover', at: 1_000 });
    expect(fake.local.peek(PANEL_TAB_KEY)).toBeUndefined();
  });

  it('ouverture refusée : false, demande retirée', async () => {
    open.mockRejectedValue(new Error('refusé'));
    expect(await openPanelOn('discover', { windowId: 3 }, 1_000)).toBe(false);
    expect(fake.session.peek(PANEL_TAB_KEY)).toBeUndefined();
  });
});

describe('takePanelTab', () => {
  it('lit la demande une seule fois, dans le délai', async () => {
    await fake.session.set({ [PANEL_TAB_KEY]: { tab: 'discover', at: 1_000 } });
    expect(await takePanelTab(1_000 + PANEL_TAB_TTL_MS - 1)).toBe('discover');
    expect(await takePanelTab(1_000)).toBeNull();
  });

  it('demande périmée, inconnue ou absente : null, clé retirée', async () => {
    expect(await takePanelTab(5)).toBeNull();
    await fake.session.set({ [PANEL_TAB_KEY]: { tab: 'discover', at: 1_000 } });
    expect(await takePanelTab(1_000 + PANEL_TAB_TTL_MS)).toBeNull();
    expect(fake.session.peek(PANEL_TAB_KEY)).toBeUndefined();
    await fake.session.set({ [PANEL_TAB_KEY]: { tab: 'settings', at: 1_000 } });
    expect(await takePanelTab(1_001)).toBeNull();
  });
});
