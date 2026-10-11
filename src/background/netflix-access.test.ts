import { beforeEach, describe, expect, it, vi } from 'vitest';

// Écouteurs du service worker : chemins `?script` du build remplacés, API chrome simulée (événements relevés).
vi.mock('../content/netflix/page-bridge.iife.ts?script', () => ({ default: 'bridge.js' }));
vi.mock('../content/netflix/content-netflix.iife.ts?script', () => ({ default: 'content.js' }));
const mocks = vi.hoisted(() => ({ resetRevokedNetflixPlayer: vi.fn() }));
vi.mock('../shared/netflix-access', () => mocks);

type Listener = (permissions: { origins?: string[] }) => void;
type InstalledListener = (details: { reason: string }) => void;
const listeners = { added: [] as Listener[], removed: [] as Listener[], installed: [] as InstalledListener[], startup: [] as (() => void)[] };
const unregister = vi.fn(() => Promise.resolve());
const contains = vi.fn(() => Promise.resolve(false));
const query = vi.fn(() => Promise.resolve([{ id: 7 }]));
const executeScript = vi.fn((_injection: { target: { tabId: number }; files: string[]; world?: string }) => Promise.resolve([]));

vi.stubGlobal('chrome', {
  permissions: {
    contains,
    onAdded: { addListener: (fn: Listener) => listeners.added.push(fn) },
    onRemoved: { addListener: (fn: Listener) => listeners.removed.push(fn) },
  },
  runtime: {
    onInstalled: { addListener: (fn: InstalledListener) => listeners.installed.push(fn) },
    onStartup: { addListener: (fn: () => void) => listeners.startup.push(fn) },
  },
  scripting: {
    getRegisteredContentScripts: () => Promise.resolve([{ id: 'synckai-netflix-bridge' }, { id: 'synckai-netflix-content' }]),
    registerContentScripts: () => Promise.resolve(),
    unregisterContentScripts: unregister,
    executeScript,
  },
  tabs: { query },
});

const { listenNetflixAccess } = await import('./netflix-access');
listenNetflixAccess();

const flush = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.resetRevokedNetflixPlayer.mockResolvedValue(true);
  contains.mockResolvedValue(false);
});

describe('listenNetflixAccess', () => {
  it('accès Netflix retiré (chrome://extensions, about:addons) : scripts retirés et lecteur préféré corrigé', async () => {
    for (const listener of listeners.removed) listener({ origins: ['*://*.netflix.com/*'] });
    await flush();
    expect(mocks.resetRevokedNetflixPlayer).toHaveBeenCalledOnce();
    expect(unregister).toHaveBeenCalledWith({ ids: ['synckai-netflix-bridge', 'synckai-netflix-content'] });
  });

  it('autre permission retirée : rien', async () => {
    for (const listener of listeners.removed) listener({ origins: ['*://*.crunchyroll.com/*'] });
    await flush();
    expect(mocks.resetRevokedNetflixPlayer).not.toHaveBeenCalled();
  });

  it('démarrage du navigateur et mise à jour : lecteur préféré revérifié', async () => {
    for (const listener of listeners.startup) listener();
    for (const listener of listeners.installed) listener({ reason: 'update' });
    await flush();
    expect(mocks.resetRevokedNetflixPlayer).toHaveBeenCalledTimes(2);
  });
});

describe('listenNetflixAccess — mise à jour de l’extension', () => {
  const injected = (): [number, string, string | undefined][] =>
    executeScript.mock.calls.map(([injection]) => [injection.target.tabId, injection.files[0] ?? '', injection.world]);

  it('accès accordé : scripts réenregistrés puis exécutés dans les onglets Netflix ouverts, pont MAIN d’abord', async () => {
    contains.mockResolvedValue(true);
    for (const listener of listeners.installed) listener({ reason: 'update' });
    await flush();
    expect(injected()).toEqual([
      [7, 'bridge.js', 'MAIN'],
      [7, 'content.js', 'ISOLATED'],
    ]);
  });

  it('accès non accordé : rien n’est exécuté', async () => {
    for (const listener of listeners.installed) listener({ reason: 'update' });
    await flush();
    expect(executeScript).not.toHaveBeenCalled();
  });

  it('mise à jour du navigateur : onglets rechargés avec leurs scripts, rien n’est exécuté', async () => {
    contains.mockResolvedValue(true);
    for (const listener of listeners.installed) listener({ reason: 'chrome_update' });
    await flush();
    expect(executeScript).not.toHaveBeenCalled();
  });
});