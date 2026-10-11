import { afterEach, describe, expect, it, vi } from 'vitest';

// Verrou du stockage immédiat (Web Locks absent sous Node)
vi.mock('./storage-lock', () => ({ withStorageLock: <T>(task: () => Promise<T>): Promise<T> => task() }));

const { effectivePreferredPlayer, hasNetflixAccess, removeNetflixAccess, requestNetflixAccess, resetRevokedNetflixPlayer } = await import('./netflix-access');
const { DEFAULT_SETTINGS, SETTINGS_STORAGE_KEY } = await import('./settings');

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('accès Netflix (permission optionnelle)', () => {
  it('lit, demande et retire la seule origine netflix.com', async () => {
    const contains = vi.fn(() => Promise.resolve(true));
    const request = vi.fn(() => Promise.resolve(false));
    const remove = vi.fn(() => Promise.resolve(true));
    vi.stubGlobal('chrome', { permissions: { contains, request, remove } });
    const origins = { origins: ['*://*.netflix.com/*'] };

    expect(await hasNetflixAccess()).toBe(true);
    expect(contains).toHaveBeenCalledWith(origins);
    expect(await requestNetflixAccess()).toBe(false);
    expect(request).toHaveBeenCalledWith(origins);
    expect(await removeNetflixAccess()).toBe(true);
    expect(remove).toHaveBeenCalledWith(origins);
  });

  it('API absente ou en échec : accès considéré comme non accordé', async () => {
    vi.stubGlobal('chrome', {});
    expect(await hasNetflixAccess()).toBe(false);
    vi.stubGlobal('chrome', { permissions: { contains: () => Promise.reject(new Error('x')) } });
    expect(await hasNetflixAccess()).toBe(false);
  });
});

/** Faux navigateur : réglages en mémoire, permission Netflix fixée */
function fakeBrowser(granted: boolean, settings: Record<string, unknown>): { stored: Record<string, unknown>; contains: ReturnType<typeof vi.fn> } {
  const stored: Record<string, unknown> = { [SETTINGS_STORAGE_KEY]: settings };
  const contains = vi.fn(() => Promise.resolve(granted));
  vi.stubGlobal('chrome', {
    permissions: { contains },
    storage: {
      local: {
        get: (key: string) => Promise.resolve(key in stored ? { [key]: stored[key] } : {}),
        set: (items: Record<string, unknown>) => {
          Object.assign(stored, items);
          return Promise.resolve();
        },
      },
    },
  });
  return { stored, contains };
}

describe('lecteur préféré « Netflix » et accès retiré', () => {
  it('effectivePreferredPlayer : Netflix seulement avec l’accès ; la permission n’est lue que pour Netflix', async () => {
    const { contains } = fakeBrowser(false, {});
    expect(await effectivePreferredPlayer('netflix')).toBe(DEFAULT_SETTINGS.preferredPlayer);
    expect(await effectivePreferredPlayer('adn')).toBe('adn');
    expect(contains).toHaveBeenCalledOnce();
    fakeBrowser(true, {});
    expect(await effectivePreferredPlayer('netflix')).toBe('netflix');
  });

  it('accès retiré (permissions.onRemoved, démarrage) : lecteur Netflix remis à la valeur par défaut, autres réglages gardés', async () => {
    const { stored } = fakeBrowser(false, { ...DEFAULT_SETTINGS, preferredPlayer: 'netflix', completionPercentage: 90 });
    expect(await resetRevokedNetflixPlayer()).toBe(true);
    expect(stored[SETTINGS_STORAGE_KEY]).toEqual({ ...DEFAULT_SETTINGS, preferredPlayer: DEFAULT_SETTINGS.preferredPlayer, completionPercentage: 90 });
  });

  it('accès accordé, ou autre lecteur : rien n’est écrit', async () => {
    const granted = fakeBrowser(true, { ...DEFAULT_SETTINGS, preferredPlayer: 'netflix' });
    expect(await resetRevokedNetflixPlayer()).toBe(false);
    expect(granted.stored[SETTINGS_STORAGE_KEY]).toEqual({ ...DEFAULT_SETTINGS, preferredPlayer: 'netflix' });
    const other = fakeBrowser(false, { ...DEFAULT_SETTINGS, preferredPlayer: 'adn' });
    expect(await resetRevokedNetflixPlayer()).toBe(false);
    expect(other.stored[SETTINGS_STORAGE_KEY]).toEqual({ ...DEFAULT_SETTINGS, preferredPlayer: 'adn' });
    expect(other.contains).not.toHaveBeenCalled();
  });
});
