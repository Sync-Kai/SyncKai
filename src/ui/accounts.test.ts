import { beforeEach, describe, expect, it, vi } from 'vitest';

// Indicateur « Session expirée » (AUTH-03) : chrome.storage.local simulé par une Map qui émet storage.onChanged comme
// Chrome, verrous Web Locks en file, service worker simulé par runtime.sendMessage.

vi.mock('../shared/badge', () => ({ refreshReviewBadge: async () => undefined }));

type Changes = Record<string, chrome.storage.StorageChange>;
type ChangeListener = (changes: Changes, areaName: string) => void;

const store = new Map<string, unknown>();
const listeners = new Set<ChangeListener>();
const sendMessage = vi.fn<(message: { type: string }) => Promise<unknown>>();

/** Écriture suivie de l'événement storage.onChanged correspondant */
function write(apply: () => Changes): void {
  const changes = apply();
  if (Object.keys(changes).length === 0) return;
  for (const listener of listeners) listener(changes, 'local');
}

vi.stubGlobal('chrome', {
  runtime: { id: 'khokcmigioggannjoojambdgioigdceb', sendMessage },
  storage: {
    local: {
      get: async (keys: string | string[] | null): Promise<Record<string, unknown>> => {
        const wanted = keys === null ? [...store.keys()] : Array.isArray(keys) ? keys : [keys];
        return Object.fromEntries(wanted.filter((key) => store.has(key)).map((key) => [key, structuredClone(store.get(key))]));
      },
      set: async (items: Record<string, unknown>): Promise<void> => {
        write(() => {
          const changes: Changes = {};
          for (const [key, value] of Object.entries(items)) {
            changes[key] = { oldValue: store.get(key), newValue: value };
            store.set(key, structuredClone(value));
          }
          return changes;
        });
      },
      remove: async (keys: string | string[]): Promise<void> => {
        write(() => {
          const changes: Changes = {};
          for (const key of Array.isArray(keys) ? keys : [keys]) {
            if (!store.has(key)) continue;
            changes[key] = { oldValue: store.get(key) };
            store.delete(key);
          }
          return changes;
        });
      },
    },
    onChanged: { addListener: (listener: ChangeListener): void => void listeners.add(listener) },
  },
});
const queues = new Map<string, Promise<unknown>>();
vi.stubGlobal('navigator', {
  language: 'fr',
  locks: {
    request: <T>(name: string, task: () => Promise<T>): Promise<T> => {
      const run = (queues.get(name) ?? Promise.resolve()).then(task);
      queues.set(name, run.catch(() => undefined));
      return run;
    },
  },
});

const { createAccountsController } = await import('./accounts');
const { endSessionIfToken } = await import('../shared/session-end');

/** Session MAL ouverte (token X), profil renvoyé par le service worker */
function openMalSession(): void {
  store.set('malToken', { accessToken: 'X', refreshToken: 'RX', expiresAt: Number.MAX_SAFE_INTEGER });
  store.set('sessionEpoch', { mal: 0 });
  sendMessage.mockResolvedValue({ ok: true, data: { id: 1, name: 'Kai', pictureUrl: null } });
}

beforeEach(() => {
  store.clear();
  listeners.clear();
  queues.clear();
  sendMessage.mockReset();
});

describe('comptes : « Session expirée » après une invalidation en arrière-plan (AUTH-03)', () => {
  it('ouverture de la vue : indicateur sessionExpired:<service> → expired: true', async () => {
    store.set('sessionExpired:mal', true);
    const accounts = createAccountsController();
    await accounts.bootstrapAll();

    expect(accounts.mal.get()).toMatchObject({ status: 'logged-out', expired: true });
    // Aucun indicateur pour AniList : « Non connecté »
    expect(accounts.anilist.get()).toMatchObject({ status: 'logged-out', expired: false });
  });

  it('vue ouverte : token refusé par le service worker → « Session expirée »', async () => {
    openMalSession();
    const accounts = createAccountsController();
    await accounts.bootstrapAll();
    expect(accounts.mal.get()).toMatchObject({ status: 'logged-in' });

    // Comme le service worker après un 400 sur le renouvellement ou un 401 répété
    await expect(endSessionIfToken('mal', 'X')).resolves.toBe(true);

    await vi.waitFor(() => expect(accounts.mal.get()).toMatchObject({ status: 'logged-out', expired: true }));
  });

  it('déconnexion volontaire : « Non connecté », indicateur absent', async () => {
    openMalSession();
    store.set('sessionExpired:mal', true); // Résidu d'une invalidation précédente
    const accounts = createAccountsController();
    await accounts.bootstrapAll();

    await accounts.logout('mal');
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(accounts.mal.get()).toMatchObject({ status: 'logged-out', expired: false });
    expect(store.has('sessionExpired:mal')).toBe(false);
  });
});
