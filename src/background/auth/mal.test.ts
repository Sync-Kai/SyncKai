import { beforeEach, describe, expect, it, vi } from 'vitest';
import { setLocale } from '../../i18n';
import type { MalToken } from '../../shared/mal.types';

// Renouvellement du token MyAnimeList (AUTH-01, AUTH-08) : chrome.storage.local simulé par une Map, verrous Web Locks
// en file par nom (comme navigator.locks), endpoint de token et API MAL simulés par fetch.

vi.mock('../../shared/badge', () => ({ refreshReviewBadge: async () => undefined }));

const store = new Map<string, unknown>();
vi.stubGlobal('chrome', {
  runtime: { id: 'khokcmigioggannjoojambdgioigdceb' },
  identity: { getRedirectURL: () => 'https://khokcmigioggannjoojambdgioigdceb.chromiumapp.org/' },
  storage: {
    local: {
      get: async (keys: string | string[] | null): Promise<Record<string, unknown>> => {
        const wanted = keys === null ? [...store.keys()] : Array.isArray(keys) ? keys : [keys];
        return Object.fromEntries(wanted.filter((key) => store.has(key)).map((key) => [key, structuredClone(store.get(key))]));
      },
      set: async (items: Record<string, unknown>): Promise<void> => {
        for (const [key, value] of Object.entries(items)) store.set(key, structuredClone(value));
      },
      remove: async (keys: string | string[]): Promise<void> => {
        for (const key of Array.isArray(keys) ? keys : [keys]) store.delete(key);
      },
    },
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

const { getMalAccessToken } = await import('./mal');
const { malRequest } = await import('../api/mal');
const { endSession } = await import('../../shared/session-end');

setLocale('fr');

const TOKEN_URL = 'https://myanimelist.net/v1/oauth2/token';
const FAR = Number.MAX_SAFE_INTEGER;
const json = (status: number, body: unknown): Response => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const tokenBody = (n: number): Record<string, unknown> => ({ access_token: `T${n}`, refresh_token: `R${n}`, expires_in: 3600 });
const isUser = (data: unknown): data is { id: number } => typeof data === 'object' && data !== null && 'id' in data;
const storedToken = (): MalToken | undefined => store.get('malToken') as MalToken | undefined;

/** Réponse retenue jusqu'à ce que le test la libère */
function deferred(): { promise: Promise<Response>; resolve: (response: Response) => void } {
  let resolve: (response: Response) => void = () => undefined;
  const promise = new Promise<Response>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

beforeEach(() => {
  store.clear();
  queues.clear();
});

describe('renouvellement du token MAL', () => {
  it('déconnexion pendant la requête de renouvellement : token abandonné, la session reste fermée (AUTH-01)', async () => {
    store.set('malToken', { accessToken: 'X', refreshToken: 'RX', expiresAt: Date.now() + 60_000 });
    store.set('sessionEpoch', { mal: 0 });
    const refresh = deferred();
    const fetchMock = vi.fn<typeof fetch>(() => refresh.promise);
    vi.stubGlobal('fetch', fetchMock);

    const pending = getMalAccessToken();
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    await endSession('mal');
    refresh.resolve(json(200, tokenBody(1)));

    expect(await pending).toBeNull();
    expect(store.has('malToken')).toBe(false);
    expect(store.get('sessionEpoch')).toEqual({ mal: 1 });
  });

  it('trois 401 avec le même token : un seul renouvellement, les suivants reprennent le nouveau token (AUTH-08)', async () => {
    store.set('malToken', { accessToken: 'X', refreshToken: 'RX', expiresAt: FAR });
    store.set('sessionEpoch', { mal: 0 });
    let refreshes = 0;
    const held: Array<(response: Response) => void> = [];
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>((input, init) => {
        if (String(input) === TOKEN_URL) return Promise.resolve(json(200, tokenBody(++refreshes)));
        // Requêtes parties avec X : retenues, puis refusées (401) une à une
        if (new Headers(init?.headers).get('Authorization') === 'Bearer X') {
          const response = deferred();
          held.push(response.resolve);
          return response.promise;
        }
        return Promise.resolve(json(200, { id: 1 }));
      }),
    );

    const requests = [1, 2, 3].map(() => malRequest('/users/@me', isUser));
    await vi.waitFor(() => expect(held).toHaveLength(3));
    // Le premier 401 renouvelle (T1) ; les deux autres n'arrivent qu'après l'écriture de T1
    held[0]?.(new Response(null, { status: 401 }));
    await expect(requests[0]).resolves.toEqual({ id: 1 });
    held[1]?.(new Response(null, { status: 401 }));
    held[2]?.(new Response(null, { status: 401 }));

    await expect(Promise.all(requests)).resolves.toEqual([{ id: 1 }, { id: 1 }, { id: 1 }]);
    expect(refreshes).toBe(1);
    expect(storedToken()?.accessToken).toBe('T1');
  });
});
