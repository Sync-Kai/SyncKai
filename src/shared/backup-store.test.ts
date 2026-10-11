import { afterEach, describe, expect, it, vi } from 'vitest';

// Import d'une sauvegarde : stockage en mémoire, verrou immédiat, accès Netflix piloté.
vi.mock('./storage-lock', () => ({ withStorageLock: <T>(task: () => Promise<T>): Promise<T> => task() }));
vi.mock('./badge', () => ({ refreshReviewBadge: () => Promise.resolve() }));

const { applyBackup } = await import('./backup-store');
const { buildBackup } = await import('./backup');
const { DEFAULT_SETTINGS, SETTINGS_STORAGE_KEY } = await import('./settings');

afterEach(() => {
  vi.unstubAllGlobals();
});

/** Faux navigateur : stockage local en mémoire, permission Netflix fixée */
function fakeBrowser(netflixGranted: boolean, initial: Record<string, unknown> = {}): Record<string, unknown> {
  const stored: Record<string, unknown> = { ...initial };
  vi.stubGlobal('chrome', {
    runtime: { getManifest: () => ({ version: '2.1.1' }) },
    permissions: { contains: () => Promise.resolve(netflixGranted) },
    storage: {
      local: {
        get: (keys: string[]) => Promise.resolve(Object.fromEntries(keys.filter((key) => key in stored).map((key) => [key, stored[key]]))),
        set: (items: Record<string, unknown>) => {
          Object.assign(stored, items);
          return Promise.resolve();
        },
      },
    },
  });
  return stored;
}

const NETFLIX_BACKUP = buildBackup({ settings: { ...DEFAULT_SETTINGS, preferredPlayer: 'netflix', completionPercentage: 90 } }, '2.1.0', new Date()).data;

describe('applyBackup — lecteur préféré Netflix', () => {
  it('réglages importés sur un profil sans l’accès Netflix : lecteur par défaut, autres réglages repris', async () => {
    const stored = fakeBrowser(false);
    await applyBackup(NETFLIX_BACKUP, 'merge', true);
    expect(stored[SETTINGS_STORAGE_KEY]).toEqual({ ...DEFAULT_SETTINGS, completionPercentage: 90 });
  });

  it('accès Netflix accordé : lecteur Netflix conservé', async () => {
    const stored = fakeBrowser(true);
    await applyBackup(NETFLIX_BACKUP, 'replace', true);
    expect(stored[SETTINGS_STORAGE_KEY]).toEqual({ ...DEFAULT_SETTINGS, preferredPlayer: 'netflix', completionPercentage: 90 });
  });
});
