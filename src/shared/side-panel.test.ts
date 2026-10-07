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
      open: (options: { tabId?: number }) => {
        calls.push(`open:${options.tabId}`);
        return Promise.resolve();
      },
    },
  });
  return { calls };
}

describe('openSidePanel', () => {
  it('Chrome : active le panneau de l’onglet puis l’ouvre, sans attente entre les deux (geste utilisateur)', () => {
    const { calls } = stubChromeSidePanel();
    void openSidePanel(42);
    // Les deux appels partent de façon synchrone, dans l'ordre
    expect(calls).toEqual(['setOptions:42:true', 'open:42']);
    expect(sidePanelKind()).toBe('chrome');
  });

  it('Firefox : browser.sidebarAction.open()', async () => {
    const open = vi.fn(() => Promise.resolve());
    vi.stubGlobal('chrome', {});
    vi.stubGlobal('browser', { sidebarAction: { open, close: () => Promise.resolve(), setPanel: () => Promise.resolve() } });
    expect(sidePanelKind()).toBe('firefox');
    await openSidePanel(1);
    expect(open).toHaveBeenCalledOnce();
  });

  it('aucune API → refus, bouton masqué', async () => {
    vi.stubGlobal('chrome', {});
    expect(sidePanelKind()).toBeNull();
    expect(getSidebarAction()).toBeNull();
    await expect(openSidePanel(1)).rejects.toThrow();
  });
});
