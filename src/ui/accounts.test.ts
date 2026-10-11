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

const { createAccountsController, isProfileFresh, PROFILE_TTL_MS } = await import('./accounts');
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

describe('profil en cache (PERF-04)', () => {
  it('lu il y a moins de 6 h : affiché sans requête ; plus ancien ou date inconnue : relu', async () => {
    openMalSession();
    store.set('malViewer', { id: 1, name: 'Kai', pictureUrl: null });
    store.set('malViewerAt', Date.now() - 60_000);
    await createAccountsController().bootstrapAll();
    expect(sendMessage).not.toHaveBeenCalled();

    store.set('malViewerAt', Date.now() - PROFILE_TTL_MS);
    await createAccountsController().bootstrapAll();
    expect(sendMessage).toHaveBeenCalledTimes(1);

    store.delete('malViewerAt');
    await createAccountsController().bootstrapAll();
    expect(sendMessage).toHaveBeenCalledTimes(2);
  });

  it('isProfileFresh : bornes', () => {
    const now = 1_800_000_000_000;
    expect(isProfileFresh(now - PROFILE_TTL_MS + 1, now)).toBe(true);
    expect(isProfileFresh(now - PROFILE_TTL_MS, now)).toBe(false);
    expect(isProfileFresh(null, now)).toBe(false);
    expect(isProfileFresh(now + 1, now)).toBe(false);
  });
});

describe('profil jamais chargé (UI-04)', () => {
  it('lecture en échec sans cache : erreur gardée ; « Réessayer » repasse en chargement puis affiche le profil', async () => {
    openMalSession();
    sendMessage.mockResolvedValueOnce({ ok: false, code: 'NETWORK', message: 'MyAnimeList injoignable' });
    const accounts = createAccountsController();
    await accounts.bootstrapAll();
    expect(accounts.mal.get()).toEqual({ status: 'logged-in', viewer: null, error: 'MyAnimeList injoignable' });

    const states: unknown[] = [];
    accounts.mal.subscribe(() => states.push(accounts.mal.get()));
    await accounts.refresh('mal');
    // states[0] : état courant remis à l'abonnement ; states[1] : pendant la requête
    expect(states[1]).toEqual({ status: 'logged-in', viewer: null, error: null });
    expect(accounts.mal.get()).toMatchObject({ status: 'logged-in', viewer: { name: 'Kai' }, error: null });
  });
});
