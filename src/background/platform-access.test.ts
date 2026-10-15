import { beforeEach, describe, expect, it, vi } from 'vitest';

// Écouteurs du service worker : chemins `?script` du build remplacés, API chrome simulée (événements relevés).
vi.mock('../content/netflix/page-bridge.iife.ts?script', () => ({ default: 'bridge.js' }));
vi.mock('../content/netflix/content-netflix.iife.ts?script', () => ({ default: 'content.js' }));
vi.mock('../content/disney/page-bridge.iife.ts?script', () => ({ default: 'disney-bridge.js' }));
vi.mock('../content/disney/content-disney.iife.ts?script', () => ({ default: 'disney-content.js' }));
vi.mock('../content/prime/page-bridge.iife.ts?script', () => ({ default: 'prime-bridge.js' }));
vi.mock('../content/prime/content-prime.iife.ts?script', () => ({ default: 'prime-content.js' }));
const mocks = vi.hoisted(() => ({ resetRevokedPlayer: vi.fn() }));
vi.mock('../shared/preferred-player', () => mocks);

const NETFLIX = '*://*.netflix.com/*';
const DISNEY = '*://*.disneyplus.com/*';
const PRIME = '*://*.primevideo.com/*';

type Listener = (permissions: { origins?: string[] }) => void;
type InstalledListener = (details: { reason: string }) => void;
const listeners = { added: [] as Listener[], removed: [] as Listener[], installed: [] as InstalledListener[], startup: [] as (() => void)[] };
const unregister = vi.fn((_filter: { ids: string[] }) => Promise.resolve());
const register = vi.fn((_scripts: { id: string }[]) => Promise.resolve());
/** Origines accordées (permission optionnelle de chaque plateforme) */
let granted: string[] = [];
const ALL_IDS = ['synckai-netflix-bridge', 'synckai-netflix-content', 'synckai-disney-bridge', 'synckai-disney-content', 'synckai-prime-bridge', 'synckai-prime-content'];
/** Scripts déjà enregistrés */
let registered: string[] = ALL_IDS;
const contains = vi.fn((query: { origins: string[] }) => Promise.resolve(query.origins.every((origin) => granted.includes(origin))));
const query = vi.fn((filter: { url: string[] }) => Promise.resolve(filter.url.includes(DISNEY) ? [{ id: 8 }] : filter.url.includes(PRIME) ? [{ id: 9 }] : [{ id: 7 }]));
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
    getRegisteredContentScripts: () => Promise.resolve(registered.map((id) => ({ id }))),
    registerContentScripts: register,
    unregisterContentScripts: unregister,
    executeScript,
  },
  tabs: { query },
});

const { listenPlatformAccess } = await import('./platform-access');
listenPlatformAccess();

const flush = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.resetRevokedPlayer.mockResolvedValue(true);
  granted = [];
  registered = ALL_IDS;
});

describe('listenPlatformAccess', () => {
  it('accès Netflix retiré (chrome://extensions, about:addons) : scripts retirés et lecteur préféré corrigé', async () => {
    for (const listener of listeners.removed) listener({ origins: [NETFLIX] });
    await flush();
    expect(mocks.resetRevokedPlayer).toHaveBeenCalledOnce();
    expect(unregister).toHaveBeenCalledWith({ ids: ['synckai-netflix-bridge', 'synckai-netflix-content'] });
  });

  it('accès Disney+ retiré : seuls ses scripts sont retirés, lecteur préféré non concerné', async () => {
    for (const listener of listeners.removed) listener({ origins: [DISNEY] });
    await flush();
    expect(mocks.resetRevokedPlayer).not.toHaveBeenCalled();
    expect(unregister.mock.calls).toEqual([[{ ids: ['synckai-disney-bridge', 'synckai-disney-content'] }]]);
  });

  it('autre permission retirée : rien', async () => {
    for (const listener of listeners.removed) listener({ origins: ['*://*.crunchyroll.com/*'] });
    await flush();
    expect(mocks.resetRevokedPlayer).not.toHaveBeenCalled();
    expect(unregister).not.toHaveBeenCalled();
  });

  it('démarrage du navigateur et mise à jour : lecteur préféré revérifié', async () => {
    for (const listener of listeners.startup) listener();
    for (const listener of listeners.installed) listener({ reason: 'update' });
    await flush();
    expect(mocks.resetRevokedPlayer).toHaveBeenCalledTimes(2);
  });

  it('accès Disney+ accordé : ses scripts réenregistrés puis exécutés dans les onglets Disney+ ouverts', async () => {
    granted = [DISNEY];
    registered = [...ALL_IDS.slice(0, 2), ...ALL_IDS.slice(4)];
    for (const listener of listeners.added) listener({ origins: [DISNEY] });
    await flush();
    expect(register.mock.calls.map(([scripts]) => scripts.map((script) => script.id))).toEqual([['synckai-disney-bridge', 'synckai-disney-content']]);
    expect(executeScript.mock.calls.map(([injection]) => [injection.target.tabId, injection.files[0], injection.world])).toEqual([
      [8, 'disney-bridge.js', 'MAIN'],
      [8, 'disney-content.js', 'ISOLATED'],
    ]);
  });

  it('accès Prime Video accordé puis retiré : seuls ses scripts, dans ses onglets', async () => {
    granted = [PRIME];
    registered = ALL_IDS.slice(0, 4);
    for (const listener of listeners.added) listener({ origins: [PRIME] });
    await flush();
    expect(register.mock.calls.map(([scripts]) => scripts.map((script) => script.id))).toEqual([['synckai-prime-bridge', 'synckai-prime-content']]);
    expect(executeScript.mock.calls.map(([injection]) => [injection.target.tabId, injection.files[0], injection.world])).toEqual([
      [9, 'prime-bridge.js', 'MAIN'],
      [9, 'prime-content.js', 'ISOLATED'],
    ]);
    granted = [];
    registered = ALL_IDS;
    for (const listener of listeners.removed) listener({ origins: [PRIME] });
    await flush();
    expect(unregister.mock.calls.at(-1)).toEqual([{ ids: ['synckai-prime-bridge', 'synckai-prime-content'] }]);
    // Prime Video peut être le lecteur préféré, comme Netflix : réglage corrigé s'il le désignait
    expect(mocks.resetRevokedPlayer).toHaveBeenCalledOnce();
  });
});

describe('listenPlatformAccess — mise à jour de l’extension', () => {
  const injected = (): [number, string, string | undefined][] =>
    executeScript.mock.calls.map(([injection]) => [injection.target.tabId, injection.files[0] ?? '', injection.world]);

  it('accès accordé : scripts réenregistrés puis exécutés dans les onglets Netflix ouverts, pont MAIN d’abord', async () => {
    granted = [NETFLIX];
    for (const listener of listeners.installed) listener({ reason: 'update' });
    await flush();
    expect(injected()).toEqual([
      [7, 'bridge.js', 'MAIN'],
      [7, 'content.js', 'ISOLATED'],
    ]);
  });

  it('deux plateformes accordées : chacune reprise dans ses onglets', async () => {
    granted = [NETFLIX, DISNEY];
    for (const listener of listeners.installed) listener({ reason: 'update' });
    await flush();
    expect(injected()).toEqual([
      [7, 'bridge.js', 'MAIN'],
      [7, 'content.js', 'ISOLATED'],
      [8, 'disney-bridge.js', 'MAIN'],
      [8, 'disney-content.js', 'ISOLATED'],
    ]);
  });

  it('accès non accordé : rien n’est exécuté', async () => {
    for (const listener of listeners.installed) listener({ reason: 'update' });
    await flush();
    expect(executeScript).not.toHaveBeenCalled();
  });

  it('mise à jour du navigateur : onglets rechargés avec leurs scripts, rien n’est exécuté', async () => {
    granted = [NETFLIX, DISNEY];
    for (const listener of listeners.installed) listener({ reason: 'chrome_update' });
    await flush();
    expect(executeScript).not.toHaveBeenCalled();
  });
});
