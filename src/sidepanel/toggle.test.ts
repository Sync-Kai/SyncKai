import { afterEach, describe, expect, it, vi } from 'vitest';
import { PANEL_TOGGLE_MESSAGE } from '../protocol/panel-toggle';
import { closeSidePanel, listenPanelToggle, shouldCloseOnToggle } from './toggle';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

const toggle = (windowId: number, commandAt: number): unknown => ({ type: PANEL_TOGGLE_MESSAGE, windowId, commandAt });

describe('shouldCloseOnToggle', () => {
  const self = { windowId: 4, loadedAt: 1_000 };

  it('panneau de la fenêtre visée, chargé avant la commande : se ferme', () => {
    expect(shouldCloseOnToggle(toggle(4, 2_000), self)).toBe(true);
  });

  it('panneau ouvert par cette commande (chargé après) : reste ouvert', () => {
    expect(shouldCloseOnToggle(toggle(4, 900), self)).toBe(false);
  });

  it('autre fenêtre (chaque fenêtre a sa page de panneau) : ignoré', () => {
    expect(shouldCloseOnToggle(toggle(5, 2_000), self)).toBe(false);
  });

  it('fenêtre du panneau encore inconnue, autres messages : ignorés', () => {
    expect(shouldCloseOnToggle(toggle(4, 2_000), { windowId: null, loadedAt: 1_000 })).toBe(false);
    expect(shouldCloseOnToggle({ type: 'GET_AGENDA', payload: null }, self)).toBe(false);
    // Ancien format (onglet) : ignoré
    expect(shouldCloseOnToggle({ type: PANEL_TOGGLE_MESSAGE, tabId: 4, commandAt: 2_000 }, self)).toBe(false);
    expect(shouldCloseOnToggle({ type: PANEL_TOGGLE_MESSAGE, windowId: '4', commandAt: 2_000 }, self)).toBe(false);
    expect(shouldCloseOnToggle(null, self)).toBe(false);
  });
});

type Listener = (message: unknown, sender: chrome.runtime.MessageSender) => unknown;

/** Panneau chargé à t = 1 000 dans la fenêtre `windowId` */
async function mountPanel(windowId: number): Promise<{ deliver: Listener; close: ReturnType<typeof vi.fn> }> {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(1_000);
  let listener: Listener = () => undefined;
  vi.stubGlobal('chrome', {
    runtime: { id: 'synckai', onMessage: { addListener: (fn: Listener) => (listener = fn) } },
    windows: { getCurrent: () => Promise.resolve({ id: windowId }) },
  });
  const close = vi.fn();
  listenPanelToggle(close);
  await Promise.resolve();
  return { deliver: (message, sender) => listener(message, sender), close };
}

const fromWorker: chrome.runtime.MessageSender = { id: 'synckai' };

describe('listenPanelToggle', () => {
  it('avis du service worker pour sa fenêtre : ferme le panneau, sans garder le canal ouvert', async () => {
    const { deliver, close } = await mountPanel(4);
    expect(deliver(toggle(4, 2_000), fromWorker)).toBe(false);
    expect(close).toHaveBeenCalledExactlyOnceWith(4);
  });

  it('autre fenêtre, commande antérieure au chargement : ignorés', async () => {
    const { deliver, close } = await mountPanel(4);
    deliver(toggle(8, 2_000), fromWorker);
    deliver(toggle(4, 500), fromWorker);
    expect(close).not.toHaveBeenCalled();
  });

  it('messages d’un script de contenu ou d’une autre extension : ignorés', async () => {
    const { deliver, close } = await mountPanel(4);
    deliver(toggle(4, 2_000), { id: 'synckai', tab: { id: 4 } as chrome.tabs.Tab });
    deliver(toggle(4, 2_000), { id: 'other-extension' });
    expect(close).not.toHaveBeenCalled();
  });
});

describe('closeSidePanel', () => {
  it('sidePanel.close (Chrome 141+) pour la fenêtre du panneau', () => {
    const close = vi.fn(() => Promise.resolve());
    vi.stubGlobal('chrome', { sidePanel: { open: vi.fn(), setOptions: vi.fn(), close } });
    const windowClose = vi.fn();
    vi.stubGlobal('window', { close: windowClose });
    closeSidePanel(4);
    expect(close).toHaveBeenCalledExactlyOnceWith({ windowId: 4 });
    expect(windowClose).not.toHaveBeenCalled();
  });

  it('sans sidePanel.close (Chrome 116 à 140), ou refus : window.close()', async () => {
    const windowClose = vi.fn();
    vi.stubGlobal('window', { close: windowClose });
    vi.stubGlobal('chrome', { sidePanel: { open: vi.fn(), setOptions: vi.fn() } });
    closeSidePanel(4);
    expect(windowClose).toHaveBeenCalledOnce();

    vi.stubGlobal('chrome', { sidePanel: { open: vi.fn(), setOptions: vi.fn(), close: () => Promise.reject(new Error('no panel')) } });
    closeSidePanel(4);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(windowClose).toHaveBeenCalledTimes(2);
  });
});
