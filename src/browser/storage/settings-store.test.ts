import { beforeEach, describe, expect, it, vi } from 'vitest';

// Réglages écrits par champs sous verrou : vrai verrou sérialisé (file d'attente), stockage en mémoire asynchrone.

let store: Record<string, unknown> = {};
const tick = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));
vi.stubGlobal('chrome', {
  storage: {
    local: {
      get: async (keys: string | string[]): Promise<Record<string, unknown>> => {
        await tick();
        return Object.fromEntries((Array.isArray(keys) ? keys : [keys]).filter((k) => k in store).map((k) => [k, structuredClone(store[k])]));
      },
      set: async (values: Record<string, unknown>): Promise<void> => {
        await tick();
        Object.assign(store, structuredClone(values));
      },
    },
  },
});
let queue: Promise<unknown> = Promise.resolve();
vi.stubGlobal('navigator', {
  locks: {
    request: <T>(_name: string, task: () => Promise<T>): Promise<T> => {
      const run = queue.then(task, task);
      queue = run.catch(() => undefined);
      return run;
    },
  },
});

const { updateSettings } = await import('./settings-store');
const { saveSeriesOffset } = await import('./agenda-store');
const { DEFAULT_SETTINGS, SETTINGS_STORAGE_KEY } = await import('../../shared/settings');
const { getSettings } = await import('./settings-access');

beforeEach(() => {
  store = { [SETTINGS_STORAGE_KEY]: { ...DEFAULT_SETTINGS, preferredPlayer: 'netflix' } };
});

describe('updateSettings', () => {
  it('écrit les champs modifiés seulement : un réglage écrit ailleurs depuis la lecture de la vue est conservé', async () => {
    // Le service worker remet le lecteur par défaut (accès retiré) après que la vue a lu ses réglages
    store[SETTINGS_STORAGE_KEY] = { ...DEFAULT_SETTINGS, preferredPlayer: DEFAULT_SETTINGS.preferredPlayer };
    const saved = await updateSettings({ autoSync: false });
    expect(saved).toMatchObject({ autoSync: false, preferredPlayer: DEFAULT_SETTINGS.preferredPlayer });
    expect(await getSettings()).toEqual(saved);
  });

  it('concurrent avec le délai d’une série (Agenda) : aucune des deux écritures n’est perdue', async () => {
    await Promise.all([saveSeriesOffset(42, 90), updateSettings({ completionPercentage: 70 }), updateSettings({ ratingPrompt: false })]);
    const settings = await getSettings();
    expect(settings).toMatchObject({ completionPercentage: 70, ratingPrompt: false, preferredPlayer: 'netflix' });
    expect(settings.seriesOffsets['42']).toMatchObject({ minutes: 90 });
  });
});
