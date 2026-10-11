import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setLocale } from '../../i18n';
import type { MalToken } from '../../shared/mal.types';
import { revealToken } from '../../test/tokens';

// Renouvellement du token MyAnimeList (AUTH-01, AUTH-05, AUTH-07, AUTH-08, TEST-02) et connexion (AUTH-10) :
// chrome.storage.local simulé par une Map, verrous Web Locks en file par nom (comme navigator.locks), endpoint de
// token et API MAL simulés par fetch, page d'autorisation par launchWebAuthFlow.

vi.mock('../../shared/badge', () => ({ refreshReviewBadge: async () => undefined }));

const REDIRECT_URL = 'https://khokcmigioggannjoojambdgioigdceb.chromiumapp.org/';
const store = new Map<string, unknown>();
const launchWebAuthFlow = vi.fn<(details: { url: string; interactive?: boolean }) => Promise<string | undefined>>();
vi.stubGlobal('chrome', {
  runtime: { id: 'khokcmigioggannjoojambdgioigdceb' },
  identity: { getRedirectURL: () => REDIRECT_URL, launchWebAuthFlow },
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

const { getMalAccessToken, loginWithMal } = await import('./mal');
const { ApiError, REQUEST_TIMEOUT_MS } = await import('../api/errors');
const { malRequest } = await import('../api/mal');
const { endSession } = await import('../../shared/session-end');

setLocale('fr');

const TOKEN_URL = 'https://myanimelist.net/v1/oauth2/token';
const FAR = Number.MAX_SAFE_INTEGER;
const json = (status: number, body: unknown): Response => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const tokenBody = (n: number): Record<string, unknown> => ({ access_token: `T${n}`, refresh_token: `R${n}`, expires_in: 3600 });
const isUser = (data: unknown): data is { id: number } => typeof data === 'object' && data !== null && 'id' in data;
/** Token MAL enregistré, déchiffré */
const storedToken = async (): Promise<MalToken | undefined> => (await revealToken('mal', store.get('malToken'))) as MalToken | undefined;

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
  launchWebAuthFlow.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

/** Session MAL ouverte avec le token X, à renouveler (dans la marge de renouvellement anticipé) */
function expiringSession(): void {
  store.set('malToken', { accessToken: 'X', refreshToken: 'RX', expiresAt: Date.now() + 60_000 });
  store.set('sessionEpoch', { mal: 0 });
}

/** Erreur levée par la promesse (échoue si elle est résolue) */
async function rejection(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise;
  } catch (error: unknown) {
    return error;
  }
  throw new Error('promesse résolue au lieu d’être rejetée');
}

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
    expect((await storedToken())?.accessToken).toBe('T1');
  });
});

describe('renouvellement du token MAL : verrou et erreurs (TEST-02)', () => {
  it('token encore valide : aucune requête', async () => {
    store.set('malToken', { accessToken: 'X', refreshToken: 'RX', expiresAt: FAR });
    store.set('sessionEpoch', { mal: 0 });
    const fetchMock = vi.fn<typeof fetch>();
    vi.stubGlobal('fetch', fetchMock);

    await expect(getMalAccessToken()).resolves.toBe('X');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('deux appels concurrents sur un token à renouveler : un seul POST, le second reprend le nouveau token', async () => {
    expiringSession();
    const refresh = deferred();
    const fetchMock = vi.fn<typeof fetch>(() => refresh.promise);
    vi.stubGlobal('fetch', fetchMock);

    const calls = [getMalAccessToken(), getMalAccessToken()];
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    refresh.resolve(json(200, tokenBody(1)));

    await expect(Promise.all(calls)).resolves.toEqual(['T1', 'T1']);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe(TOKEN_URL);
    expect((await storedToken())).toMatchObject({ accessToken: 'T1', refreshToken: 'R1' });
  });

  it('400 au renouvellement : session fermée et marquée expirée (AUTH-03)', async () => {
    expiringSession();
    vi.stubGlobal('fetch', vi.fn<typeof fetch>(() => Promise.resolve(json(400, { error: 'invalid_grant' }))));

    await expect(getMalAccessToken()).resolves.toBeNull();
    expect(store.has('malToken')).toBe(false);
    expect(store.get('sessionEpoch')).toEqual({ mal: 1 });
    expect(store.get('sessionExpired:mal')).toBe(true);
  });

  it('503 au renouvellement : erreur passagère avec le statut HTTP, session intacte (AUTH-07)', async () => {
    expiringSession();
    vi.stubGlobal('fetch', vi.fn<typeof fetch>(() => Promise.resolve(new Response('Service Unavailable', { status: 503 }))));

    const error = await rejection(getMalAccessToken());
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ code: 'API_ERROR', httpStatus: 503 });
    expect((await storedToken())?.accessToken).toBe('X');
    expect(store.has('sessionExpired:mal')).toBe(false);
  });

  it('429 au renouvellement : RATE_LIMITED, session intacte (AUTH-07)', async () => {
    expiringSession();
    vi.stubGlobal('fetch', vi.fn<typeof fetch>(() => Promise.resolve(new Response(null, { status: 429 }))));

    expect(await rejection(getMalAccessToken())).toMatchObject({ code: 'RATE_LIMITED' });
    expect((await storedToken())?.accessToken).toBe('X');
  });

  it('endpoint de token muet : abandon après le délai, verrou libéré, session intacte (AUTH-05)', async () => {
    expiringSession();
    const timeouts: Array<{ ms: number; controller: AbortController }> = [];
    vi.spyOn(AbortSignal, 'timeout').mockImplementation((ms: number) => {
      const controller = new AbortController();
      timeouts.push({ ms, controller });
      return controller.signal;
    });
    let calls = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>((_input, init) => {
        if (++calls > 1) return Promise.resolve(json(200, tokenBody(1)));
        // Première requête : MAL ne répond jamais, seul le délai l'interrompt
        return new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(new DOMException('signal timed out', 'TimeoutError')));
        });
      }),
    );

    const pending = getMalAccessToken();
    await vi.waitFor(() => expect(timeouts).toHaveLength(1));
    expect(timeouts[0]?.ms).toBe(REQUEST_TIMEOUT_MS);
    timeouts[0]?.controller.abort();

    expect(await rejection(pending)).toMatchObject({ code: 'NETWORK', timedOut: true });
    expect((await storedToken())?.accessToken).toBe('X');
    // Verrou libéré : l'appel suivant renouvelle
    await expect(getMalAccessToken()).resolves.toBe('T1');
  });

  it('délai dépassé pendant la lecture du corps : NETWORK avec timedOut, pas « réponse invalide » (AUTH-09)', async () => {
    expiringSession();
    const response = json(200, tokenBody(1));
    response.json = (): Promise<never> => Promise.reject(new DOMException('signal timed out', 'TimeoutError'));
    vi.stubGlobal('fetch', vi.fn<typeof fetch>(() => Promise.resolve(response)));

    expect(await rejection(getMalAccessToken())).toMatchObject({ code: 'NETWORK', timedOut: true });
    expect((await storedToken())?.accessToken).toBe('X');
  });

  it('déconnexion volontaire : indicateur « Session expirée » retiré (AUTH-03)', async () => {
    expiringSession();
    store.set('sessionExpired:mal', true);
    await endSession('mal');
    expect(store.has('sessionExpired:mal')).toBe(false);
  });
});

describe('connexion MyAnimeList (TEST-02, AUTH-10)', () => {
  /** Paramètres de la page d'autorisation demandée par loginWithMal */
  const authParams = (): URLSearchParams => new URL(launchWebAuthFlow.mock.calls[0]?.[0].url ?? '').searchParams;
  /** Retour de la page d'autorisation avec le bon « state » */
  const authorize = async (): Promise<string> => `${REDIRECT_URL}?code=C&state=${authParams().get('state') ?? ''}`;

  it('« state » différent : INVALID_RESPONSE, aucun échange de code', async () => {
    launchWebAuthFlow.mockResolvedValue(`${REDIRECT_URL}?code=C&state=autre`);
    const fetchMock = vi.fn<typeof fetch>();
    vi.stubGlobal('fetch', fetchMock);

    await expect(loginWithMal()).resolves.toMatchObject({ ok: false, code: 'INVALID_RESPONSE' });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(store.has('malToken')).toBe(false);
  });

  it('code refusé à l’échange (400) : message de configuration avec l’URL de redirection, pas « session expirée »', async () => {
    launchWebAuthFlow.mockImplementation(authorize);
    vi.stubGlobal('fetch', vi.fn<typeof fetch>(() => Promise.resolve(json(400, { error: 'invalid_grant' }))));

    const result = await loginWithMal();
    expect(result).toMatchObject({ ok: false, code: 'AUTH_FLOW_FAILED' });
    const message = result.ok ? '' : result.message;
    expect(message).toContain(REDIRECT_URL);
    expect(message).not.toMatch(/expirée/);
    expect(store.has('malToken')).toBe(false);
  });

  it('connexion réussie : token enregistré, indicateur « Session expirée » retiré (AUTH-03)', async () => {
    store.set('sessionExpired:mal', true);
    launchWebAuthFlow.mockImplementation(authorize);
    const fetchMock = vi.fn<typeof fetch>(() => Promise.resolve(json(200, tokenBody(1))));
    vi.stubGlobal('fetch', fetchMock);

    await expect(loginWithMal()).resolves.toEqual({ ok: true, data: null });
    const body = fetchMock.mock.calls[0]?.[1]?.body;
    const params = body instanceof URLSearchParams ? body : new URLSearchParams();
    expect(params.get('grant_type')).toBe('authorization_code');
    expect(params.get('code_verifier')).toBe(authParams().get('code_challenge'));
    expect((await storedToken())?.accessToken).toBe('T1');
    expect(store.has('sessionExpired:mal')).toBe(false);
  });
});
