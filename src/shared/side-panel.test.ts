import { afterEach, describe, expect, it, vi } from 'vitest';
import { getSidebarAction, openSidePanel, sidePanelKind } from './side-panel';

afterEach(() => {
  vi.unstubAllGlobals();
});

function stubChromeSidePanel(): { calls: string[] } {
  const calls: string[] = [];
  vi.stubGlobal('chrome', {
    sidePanel: {
      setOptions: (options: { tabId?: number; enabled?: boolean }) => {
        calls.push(`setOptions:${options.tabId}:${options.enabled}`);
        return Promise.resolve();
      },
      open: (options: { tabId?: number; windowId?: number }) => {
        calls.push(`open:${options.tabId}:${options.windowId}`);
        return Promise.resolve();
      },
    },
  });
  return { calls };
}

describe('openSidePanel', () => {
  it('Chrome : active le panneau global puis l’ouvre dans la fenêtre, sans attente entre les deux (geste utilisateur)', () => {
    const { calls } = stubChromeSidePanel();
    void openSidePanel({ windowId: 3, tabId: 42 });
    // Les deux appels partent de façon synchrone, dans l'ordre ; jamais d'option propre à l'onglet
    expect(calls).toEqual(['setOptions:undefined:true', 'open:undefined:3']);
    expect(sidePanelKind()).toBe('chrome');
  });

  it('Chrome : fenêtre inconnue → onglet (panneau global ouvert dans sa fenêtre) ; ni l’un ni l’autre → refus', async () => {
    const { calls } = stubChromeSidePanel();
    void openSidePanel({ tabId: 42 });
    expect(calls).toEqual(['setOptions:undefined:true', 'open:42:undefined']);
    await expect(openSidePanel({})).rejects.toThrow();
  });

  it('Firefox : browser.sidebarAction.open()', async () => {
    const open = vi.fn(() => Promise.resolve());
    vi.stubGlobal('chrome', {});
    vi.stubGlobal('browser', { sidebarAction: { open, close: () => Promise.resolve(), setPanel: () => Promise.resolve() } });
    expect(sidePanelKind()).toBe('firefox');
    await openSidePanel({ windowId: 1 });
    expect(open).toHaveBeenCalledOnce();
  });

  it('aucune API → refus, bouton masqué', async () => {
    vi.stubGlobal('chrome', {});
    expect(sidePanelKind()).toBeNull();
    expect(getSidebarAction()).toBeNull();
    await expect(openSidePanel({ windowId: 1 })).rejects.toThrow();
  });
});
