import { afterEach, describe, expect, it, vi } from 'vitest';
import manifest from '../../manifest.json';
import { PANEL_TOGGLE_MESSAGE, type PanelToggleMessage } from '../shared/panel-toggle';
import { OPTIONAL_PLATFORM_MATCHES } from '../shared/platforms';
import { contentScriptMatches, SIDE_PANEL_PATH } from '../shared/target-pages';
import { panelTabFromSender, togglePanelFromCommand } from './side-panel';

const patterns = contentScriptMatches(manifest);

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('panelTabFromSender', () => {
  it('cadre principal d’une page Crunchyroll / ADN → onglet', () => {
    expect(panelTabFromSender({ url: 'https://www.crunchyroll.com/watch/x', frameId: 0, tab: { id: 7 } }, patterns)).toBe(7);
    expect(panelTabFromSender({ url: 'https://animationdigitalnetwork.com/video/1', frameId: 0, tab: { id: 3 } }, patterns)).toBe(3);
  });

  it('autre site, sous-cadre ou expéditeur sans onglet → null', () => {
    expect(panelTabFromSender({ url: 'https://example.com/', frameId: 0, tab: { id: 7 } }, patterns)).toBeNull();
    expect(panelTabFromSender({ url: 'https://www.crunchyroll.com/watch/x', frameId: 2, tab: { id: 7 } }, patterns)).toBeNull();
    expect(panelTabFromSender({ url: 'https://www.crunchyroll.com/watch/x', frameId: 0 }, patterns)).toBeNull();
    expect(panelTabFromSender({ url: 'https://www.crunchyroll.com/watch/x', frameId: 0, tab: { id: -1 } }, patterns)).toBeNull();
    expect(panelTabFromSender({ frameId: 0, tab: { id: 7 } }, patterns)).toBeNull();
  });
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
    (options: { tabId?: number }): Promise<void> =>
      new Promise<void>((resolve, reject) => {
        calls.push(`open:${options.tabId}`);
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

const CR_URL = 'https://www.crunchyroll.com/fr/watch/G4VUQ1ZKW/x';

describe('togglePanelFromCommand (raccourci, Chrome)', () => {
  it('page Crunchyroll : panneau activé pour l’onglet puis ouvert, dans le même appel synchrone', () => {
    const { calls } = stubSidePanel();
    expect(togglePanelFromCommand({ id: 12, url: CR_URL }, { patterns, notify: vi.fn() })).toBe('opened');
    // Aucun await avant open (geste utilisateur) : les deux appels sont déjà partis au retour de la fonction
    expect(calls).toEqual([`setOptions:12:true:${SIDE_PANEL_PATH}`, 'open:12']);
  });

  it('avis SIDE_PANEL_TOGGLE diffusé seulement une fois open() terminé : un panneau qui se ferme n’est jamais rouvert', async () => {
    const { settle } = stubSidePanel();
    const notify = vi.fn();
    togglePanelFromCommand({ id: 12, url: CR_URL }, { patterns, notify, commandAt: 1_000 });
    await flush();
    expect(notify).not.toHaveBeenCalled();
    // Panneau déjà ouvert : open() ne fait rien et se résout ; le panneau se fermera à la réception de l'avis
    settle();
    await flush();
    expect(notify).toHaveBeenCalledExactlyOnceWith({ type: PANEL_TOGGLE_MESSAGE, tabId: 12, commandAt: 1_000 });
  });

  it('aucun état côté service worker : chaque commande ouvre puis avise (panneau ouvert ou fermé, service worker réveillé ou non)', async () => {
    const { calls, settle } = stubSidePanel();
    const notify = vi.fn<(message: PanelToggleMessage) => void>();
    for (const commandAt of [1, 2]) {
      togglePanelFromCommand({ id: 3, url: CR_URL }, { patterns, notify, commandAt });
      settle();
      await flush();
    }
    expect(calls.filter((call) => call.startsWith('open'))).toEqual(['open:3', 'open:3']);
    expect(notify.mock.calls.map(([message]) => message.commandAt)).toEqual([1, 2]);
  });

  it('ADN, Netflix et Disney+ (accès accordé : URL lisible) : ouverts aussi', () => {
    const all = [...patterns, ...OPTIONAL_PLATFORM_MATCHES];
    const { calls } = stubSidePanel();
    expect(togglePanelFromCommand({ id: 1, url: 'https://animationdigitalnetwork.com/video/1' }, { patterns: all, notify: vi.fn() })).toBe('opened');
    expect(togglePanelFromCommand({ id: 2, url: 'https://www.netflix.com/watch/81402901' }, { patterns: all, notify: vi.fn() })).toBe('opened');
    expect(togglePanelFromCommand({ id: 3, url: 'https://www.disneyplus.com/fr-fr/play/eaccaafa' }, { patterns: all, notify: vi.fn() })).toBe('opened');
    expect(calls.filter((call) => call.startsWith('open'))).toEqual(['open:1', 'open:2', 'open:3']);
  });

  it('URL en cours de chargement (pendingUrl) reconnue', () => {
    const { calls } = stubSidePanel();
    expect(togglePanelFromCommand({ id: 4, url: '', pendingUrl: CR_URL }, { patterns, notify: vi.fn() })).toBe('opened');
    expect(calls).toContain('open:4');
  });

  it('autre site (URL lisible) : rien n’est fait, aucun avis', async () => {
    const { calls } = stubSidePanel();
    const notify = vi.fn();
    expect(togglePanelFromCommand({ id: 5, url: 'https://www.youtube.com/watch?v=x' }, { patterns, notify })).toBe('unsupported');
    expect(togglePanelFromCommand({ id: 5, url: 'chrome://extensions/' }, { patterns, notify })).toBe('unsupported');
    await flush();
    expect(calls).toEqual([]);
    expect(notify).not.toHaveBeenCalled();
  });

  it('URL masquée : open seul (jamais activé sans page reconnue) ; refus de Chrome absorbé, avis quand même', async () => {
    const { calls, settle } = stubSidePanel();
    const notify = vi.fn();
    expect(togglePanelFromCommand({ id: 6 }, { patterns, notify, commandAt: 5 })).toBe('open-if-enabled');
    expect(calls).toEqual(['open:6']);
    // Rejet intercepté (sinon : rejet non géré, signalé par Vitest)
    settle(new Error('No active side panel for tabId: 6'));
    await flush();
    expect(notify).toHaveBeenCalledExactlyOnceWith({ type: PANEL_TOGGLE_MESSAGE, tabId: 6, commandAt: 5 });
  });

  it('diffusion par défaut : runtime.sendMessage, « aucun destinataire » absorbé', async () => {
    const { settle } = stubSidePanel();
    const sendMessage = vi.fn(() => Promise.reject(new Error('Could not establish connection. Receiving end does not exist.')));
    vi.stubGlobal('chrome', { sidePanel: Reflect.get(chrome, 'sidePanel'), runtime: { sendMessage } });
    togglePanelFromCommand({ id: 7, url: CR_URL }, { patterns, commandAt: 9 });
    settle();
    await flush();
    expect(sendMessage).toHaveBeenCalledExactlyOnceWith({ type: PANEL_TOGGLE_MESSAGE, tabId: 7, commandAt: 9 });
  });

  it('sans onglet, onglet hors navigateur (id -1) ou sans API sidePanel (Firefox) : rien', () => {
    const { calls } = stubSidePanel();
    const notify = vi.fn();
    expect(togglePanelFromCommand(undefined, { patterns, notify })).toBe('unavailable');
    expect(togglePanelFromCommand({ id: -1, url: CR_URL }, { patterns, notify })).toBe('unavailable');
    expect(calls).toEqual([]);
    vi.stubGlobal('chrome', {});
    expect(togglePanelFromCommand({ id: 9, url: CR_URL }, { patterns, notify })).toBe('unavailable');
    expect(notify).not.toHaveBeenCalled();
  });
});
