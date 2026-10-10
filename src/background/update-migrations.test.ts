import { beforeEach, describe, expect, it, vi } from 'vitest';
import { isRecord } from '../shared/guards';
import { STORAGE_KEYS, saveMediaMapping } from '../shared/storage';
import { STORAGE_LOCK } from '../shared/storage-lock-core';
import type { MediaMapping } from '../shared/sync.types';
import { compareVersions, runUpdateMigrations } from './update-migrations';

// chrome.storage.local minimal et verrou Web Locks en file (comme navigator.locks : une tâche à la fois)
let store: Record<string, unknown> = {};
vi.stubGlobal('chrome', {
  storage: {
    local: {
      get: async (key: string) => ({ [key]: store[key] }),
      set: async (items: Record<string, unknown>) => {
        store = { ...store, ...items };
      },
    },
  },
});
let queue: Promise<unknown> = Promise.resolve();
const request = vi.fn(<T>(_name: string, task: () => Promise<T>): Promise<T> => {
  const run = queue.then(task);
  queue = run.catch(() => undefined);
  return run;
});
vi.stubGlobal('navigator', { locks: { request } });

const mapping = (mediaId: number): MediaMapping => ({ mediaId, numbering: 'season', offset: 0, episodes: 12 });
const mappingKeys = (): string[] => {
  const mappings = store[STORAGE_KEYS.mediaMappings];
  return isRecord(mappings) ? Object.keys(mappings).sort() : [];
};

beforeEach(() => {
  request.mockClear();
  store = {
    [STORAGE_KEYS.mediaMappings]: {
      'netflix:80987039:s1': mapping(1),
      'netflix:81000001:s0': mapping(2),
      'crunchyroll:GRMG8ZQZR:s24': mapping(21),
      'adn:1311:s1': mapping(3),
    },
  };
});

describe('compareVersions', () => {
  it('compare numériquement chaque composante', () => {
    expect(compareVersions('2.1.0', '2.1.1')).toBeLessThan(0);
    expect(compareVersions('2.10.0', '2.9.9')).toBeGreaterThan(0);
    expect(compareVersions('2.1', '2.1.0')).toBe(0);
    expect(compareVersions('abc', '2.1.1')).toBeNaN();
  });
});

describe('runUpdateMigrations', () => {
  it('depuis la 2.1.0 : oublie toutes les correspondances Netflix sous le verrou, garde les autres', async () => {
    await runUpdateMigrations('2.1.0');
    expect(mappingKeys()).toEqual(['adn:1311:s1', 'crunchyroll:GRMG8ZQZR:s24']);
    expect(request).toHaveBeenCalledWith(STORAGE_LOCK, expect.any(Function));
  });

  it('une écriture concurrente pendant la purge n’est pas perdue (lecture-écriture sous verrou)', async () => {
    await Promise.all([runUpdateMigrations('2.1.0'), saveMediaMapping('crunchyroll:GY9VWW3XY:s1', mapping(20))]);
    expect(mappingKeys()).toEqual(['adn:1311:s1', 'crunchyroll:GRMG8ZQZR:s24', 'crunchyroll:GY9VWW3XY:s1']);
  });

  it('depuis la 2.1.1 ou plus, ou version inconnue : rien n’est supprimé', async () => {
    for (const version of ['2.1.1', '2.2.0', '10.0.0', 'inconnue', undefined]) {
      await runUpdateMigrations(version);
    }
    expect(mappingKeys()).toHaveLength(4);
    expect(request).not.toHaveBeenCalled();
  });

  it('aucune correspondance Netflix : stockage non réécrit', async () => {
    store = { [STORAGE_KEYS.mediaMappings]: { 'adn:1311:s1': mapping(3) } };
    const before = store;
    await runUpdateMigrations('2.0.0');
    expect(store).toBe(before);
  });
});
