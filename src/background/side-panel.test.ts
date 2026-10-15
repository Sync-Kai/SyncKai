import { afterEach, describe, expect, it, vi } from 'vitest';
import { PANEL_TOGGLE_MESSAGE, type PanelToggleMessage } from '../protocol/panel-toggle';
import { SIDE_PANEL_PATH } from '../platforms/target-pages';
import { resetSidePanel, togglePanelFromCommand } from './side-panel';

afterEach(() => {
  vi.unstubAllGlobals();
});

interface SidePanelStub {
  /** Appels dans l'ordre, enregistrés de façon synchrone */
  calls: string[];
  /** Termine le dernier `open()` (résolu, ou refusé avec `error`) */
  settle: (error?: Error) => void;
}

/** `chrome.sidePanel` factice : `open()` reste en attente jusqu'à `settle` (ordre ouverture → avis vérifiable) */
function stubSidePanel(): SidePanelStub {
  const calls: string[] = [];
  let pending: { resolve: () => void; reject: (error: Error) => void } | null = null;
  const setOptions = vi.fn((options: { tabId?: number; enabled?: boolean; path?: string }): Promise<void> => {
    calls.push(`setOptions:${options.tabId}:${options.enabled}:${options.path}`);
    // Jamais résolu : prouve qu'open n'attend pas setOptions
    return new Promise<void>(() => undefined);
  });
  const open = vi.fn(
    (options: { tabId?: number; windowId?: number }): Promise<void> =>
      new Promise<void>((resolve, reject) => {
        calls.push(`open:tab=${options.tabId}:window=${options.windowId}`);
        pending = { resolve, reject };
      }),
  );
  vi.stubGlobal('chrome', { sidePanel: { setOptions, open } });
  return {
    calls,
    settle: (error) => {
      if (error) pending?.reject(error);
      else pending?.resolve();
    },
  };
}

/** Laisse passer les microtâches (suites de `open()`) */
const flush = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

describe('togglePanelFromCommand (raccourci, Chrome)', () => {
  it('n’importe quel onglet : panneau global activé puis ouvert dans la fenêtre, dans le même appel synchrone', () => {
    const { calls } = stubSidePanel();
    expect(togglePanelFromCommand({ windowId: 3 }, { notify: vi.fn() })).toBe('opened');
    // Aucun await avant open (geste utilisateur) ; option globale (sans tabId) : un seul panneau pour tous les onglets
    expect(calls).toEqual([`setOptions:undefined:true:${SIDE_PANEL_PATH}`, 'open:tab=undefined:window=3']);
  });

  it('avis SIDE_PANEL_TOGGLE (fenêtre visée) diffusé seulement une fois open() terminé : un panneau qui se ferme n’est jamais rouvert', async () => {
    const { settle } = stubSidePanel();
    const notify = vi.fn();
    togglePanelFromCommand({ windowId: 3 }, { notify, commandAt: 1_000 });
    await flush();
    expect(notify).not.toHaveBeenCalled();
    // Panneau déjà ouvert : open() ne fait rien et se résout ; le panneau se fermera à la réception de l'avis
    settle();
    await flush();
    expect(notify).toHaveBeenCalledExactlyOnceWith({ type: PANEL_TOGGLE_MESSAGE, windowId: 3, commandAt: 1_000 });
  });

  it('aucun état côté service worker : chaque commande ouvre puis avise (panneau ouvert ou fermé, service worker réveillé ou non)', async () => {
    const { calls, settle } = stubSidePanel();
    const notify = vi.fn<(message: PanelToggleMessage) => void>();
    for (const commandAt of [1, 2]) {
      togglePanelFromCommand({ windowId: 5 }, { notify, commandAt });
      settle();
      await flush();
    }
    expect(calls.filter((call) => call.startsWith('open'))).toEqual(['open:tab=undefined:window=5', 'open:tab=undefined:window=5']);
    expect(notify.mock.calls.map(([message]) => message.commandAt)).toEqual([1, 2]);
  });

  it('refus de Chrome absorbé, avis quand même', async () => {
    const { settle } = stubSidePanel();
    const notify = vi.fn();
    togglePanelFromCommand({ windowId: 6 }, { notify, commandAt: 5 });
    // Rejet intercepté (sinon : rejet non géré, signalé par Vitest)
    settle(new Error('No active side panel'));
    await flush();
    expect(notify).toHaveBeenCalledExactlyOnceWith({ type: PANEL_TOGGLE_MESSAGE, windowId: 6, commandAt: 5 });
  });

  it('diffusion par défaut : runtime.sendMessage, « aucun destinataire » absorbé', async () => {
    const { settle } = stubSidePanel();
    const sendMessage = vi.fn(() => Promise.reject(new Error('Could not establish connection. Receiving end does not exist.')));
    vi.stubGlobal('chrome', { sidePanel: Reflect.get(chrome, 'sidePanel'), runtime: { sendMessage } });
    togglePanelFromCommand({ windowId: 7 }, { commandAt: 9 });
    settle();
    await flush();
    expect(sendMessage).toHaveBeenCalledExactlyOnceWith({ type: PANEL_TOGGLE_MESSAGE, windowId: 7, commandAt: 9 });
  });

  it('sans onglet, sans fenêtre (id -1) ou sans API sidePanel (Firefox) : rien', () => {
    const { calls } = stubSidePanel();
    const notify = vi.fn();
    expect(togglePanelFromCommand(undefined, { notify })).toBe('unavailable');
    expect(togglePanelFromCommand({ windowId: -1 }, { notify })).toBe('unavailable');
    expect(togglePanelFromCommand({}, { notify })).toBe('unavailable');
    expect(calls).toEqual([]);
    vi.stubGlobal('chrome', {});
    expect(togglePanelFromCommand({ windowId: 9 }, { notify })).toBe('unavailable');
    expect(notify).not.toHaveBeenCalled();
  });
});

describe('resetSidePanel', () => {
  it('installation, démarrage : panneau du manifeste activé partout (option globale, aucun onglet visé)', () => {
    const { calls } = stubSidePanel();
    resetSidePanel();
    expect(calls).toEqual([`setOptions:undefined:true:${SIDE_PANEL_PATH}`]);
  });
});
