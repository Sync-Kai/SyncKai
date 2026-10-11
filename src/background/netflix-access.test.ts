import { beforeEach, describe, expect, it, vi } from 'vitest';

// Écouteurs du service worker : chemins `?script` du build remplacés, API chrome simulée (événements relevés).
vi.mock('../content/netflix/page-bridge.iife.ts?script', () => ({ default: 'bridge.js' }));
vi.mock('../content/netflix/content-netflix.iife.ts?script', () => ({ default: 'content.js' }));
const mocks = vi.hoisted(() => ({ resetRevokedNetflixPlayer: vi.fn() }));
vi.mock('../shared/netflix-access', () => mocks);

type Listener = (permissions: { origins?: string[] }) => void;
const listeners = { added: [] as Listener[], removed: [] as Listener[], installed: [] as (() => void)[], startup: [] as (() => void)[] };
const unregister = vi.fn(() => Promise.resolve());

vi.stubGlobal('chrome', {
  permissions: {
    contains: () => Promise.resolve(false),
    onAdded: { addListener: (fn: Listener) => listeners.added.push(fn) },
    onRemoved: { addListener: (fn: Listener) => listeners.removed.push(fn) },
  },
  runtime: {
    onInstalled: { addListener: (fn: () => void) => listeners.installed.push(fn) },
    onStartup: { addListener: (fn: () => void) => listeners.startup.push(fn) },
  },
  scripting: {
    getRegisteredContentScripts: () => Promise.resolve([{ id: 'synckai-netflix-bridge' }, { id: 'synckai-netflix-content' }]),
    registerContentScripts: () => Promise.resolve(),
    unregisterContentScripts: unregister,
  },
  tabs: { query: () => Promise.resolve([]) },
});

const { listenNetflixAccess } = await import('./netflix-access');
listenNetflixAccess();

const flush = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.resetRevokedNetflixPlayer.mockResolvedValue(true);
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
    for (const listener of [...listeners.startup, ...listeners.installed]) listener();
    await flush();
    expect(mocks.resetRevokedNetflixPlayer).toHaveBeenCalledTimes(2);
  });
});
