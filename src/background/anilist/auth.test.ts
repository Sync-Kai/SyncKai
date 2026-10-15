import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setLocale } from '../../i18n';
import { FakeAlarms } from '../../test/fake-chrome';
import { revealToken } from '../../test/tokens';

// Connexion AniList par-dessus un token expiré (AUTH-06) : la session de l'ancien compte est fermée avant la nouvelle.
// Alarme des sorties créée à la connexion (PERF-17).

const REDIRECT = 'https://khokcmigioggannjoojambdgioigdceb.chromiumapp.org/';
const GRANTED = `${REDIRECT}#access_token=NEW&token_type=Bearer&expires_in=31536000`;
let store: Record<string, unknown> = {};
const runtime = { id: 'khokcmigioggannjoojambdgioigdceb' };
const launchWebAuthFlow = vi.fn<(details: { url: string; interactive: boolean }) => Promise<string | undefined>>();
const alarms = new FakeAlarms();
vi.stubGlobal('chrome', {
  runtime,
  alarms,
  identity: { getRedirectURL: () => REDIRECT, launchWebAuthFlow },
  storage: {
    local: {
      get: async (keys: string | string[]): Promise<Record<string, unknown>> =>
        Object.fromEntries((Array.isArray(keys) ? keys : [keys]).filter((k) => k in store).map((k) => [k, store[k]])),
      set: async (items: Record<string, unknown>): Promise<void> => void Object.assign(store, items),
      remove: async (keys: string | string[]): Promise<void> => {
        for (const k of Array.isArray(keys) ? keys : [keys]) delete store[k];
      },
    },
  },
});
vi.stubGlobal('navigator', { language: 'fr', locks: { request: <T>(_name: string, task: () => Promise<T>): Promise<T> => task() } });

const { loginWithAniList } = await import('./auth');

setLocale('fr');

const EPISODE = {
  platform: 'crunchyroll',
  episodeId: 'EP5',
  seriesId: 'GSERIES',
  seriesSlug: 'serie',
  animeTitle: 'Série',
  seasonNumber: 1,
  seasonTitle: null,
  seasonEpisodeNumber: 5,
  displayedEpisodeNumber: 5,
  episodeTitle: null,
  url: 'https://www.crunchyroll.com/watch/EP5',
};

beforeEach(() => {
  store = {};
  void alarms.clearAll();
  runtime.id = 'khokcmigioggannjoojambdgioigdceb';
  launchWebAuthFlow.mockReset();
  launchWebAuthFlow.mockResolvedValue(GRANTED);
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('loginWithAniList (AUTH-06)', () => {
  it('token expiré encore enregistré : profil, cache et aperçu de l’ancien compte effacés, nouvelle génération', async () => {
    store = {
      anilistToken: { accessToken: 'OLD', expiresAt: 1 },
      anilistViewer: { id: 1, name: 'A' },
      watchingCache: { anilist: { service: 'anilist' } },
      'compare:last': {},
      'crImport:plan': {},
      sessionEpoch: { anilist: 2 },
      syncQueue: [{ id: 'crunchyroll:EP5', episode: EPISODE, services: ['anilist'], epochs: { anilist: 2 }, attempts: 1, status: 'pending', nextAttemptAt: 0, firstFailedAt: 0, lastError: 'x' }],
      // Données de l'utilisateur hors compte : conservées (un token seulement expiré n'est pas une déconnexion, DATA-06)
      platformLinks: { '1': [] },
    };
    expect(await loginWithAniList()).toEqual({ ok: true, data: null });
    expect(await revealToken('anilist', store.anilistToken)).toMatchObject({ accessToken: 'NEW' });
    expect(store.sessionEpoch).toEqual({ anilist: 3 });
    for (const key of ['anilistViewer', 'compare:last', 'crImport:plan', 'syncQueue']) expect(store, key).not.toHaveProperty(key);
    expect(store.watchingCache).toEqual({});
    expect(store.platformLinks).toEqual({ '1': [] });
  });

  it('première connexion : aucune session à fermer, génération inchangée', async () => {
    store = { sessionEpoch: { anilist: 2 } };
    expect(await loginWithAniList()).toEqual({ ok: true, data: null });
    expect(store.sessionEpoch).toEqual({ anilist: 2 });
    expect(await revealToken('anilist', store.anilistToken)).toMatchObject({ accessToken: 'NEW' });
  });

  it('connexion réussie, alertes actives : alarme des sorties créée sans attendre un autre réveil (PERF-17)', async () => {
    expect(await loginWithAniList()).toEqual({ ok: true, data: null });
    expect(await alarms.get('synckai:airing')).toMatchObject({ periodInMinutes: 60 });
  });

  it('connexion réussie, alertes coupées : aucune alarme', async () => {
    store = { settings: { airingAlerts: false } };
    expect(await loginWithAniList()).toEqual({ ok: true, data: null });
    expect(await alarms.get('synckai:airing')).toBeUndefined();
  });
});

describe('loginWithAniList, branches d’échec', () => {
  it('requête d’autorisation : client AniList du navigateur, Implicit Grant, jamais de redirect_uri', async () => {
    await loginWithAniList();
    const call = launchWebAuthFlow.mock.calls[0]?.[0];
    expect(call?.interactive).toBe(true);
    const url = new URL(call?.url ?? '');
    expect(`${url.origin}${url.pathname}`).toBe('https://anilist.co/api/v2/oauth/authorize');
    expect(url.searchParams.get('client_id')).toBe('52346');
    expect(url.searchParams.get('response_type')).toBe('token');
    expect(url.searchParams.has('redirect_uri')).toBe(false);
  });

  it('ID d’extension sans client enregistré : refusé avant toute fenêtre, URL à enregistrer affichée', async () => {
    runtime.id = 'toString';
    const result = await loginWithAniList();
    expect(launchWebAuthFlow).not.toHaveBeenCalled();
    expect(result).toEqual({ ok: false, code: 'AUTH_FLOW_FAILED', message: expect.stringContaining(REDIRECT) as unknown });
    expect(store).not.toHaveProperty('anilistToken');
  });

  it('fenêtre fermée ou accès refusé (libellés Chrome et Firefox) : USER_CANCELLED', async () => {
    for (const message of ['The user did not approve access.', 'User cancelled or denied access.']) {
      launchWebAuthFlow.mockRejectedValueOnce(new Error(message));
      expect(await loginWithAniList(), message).toMatchObject({ ok: false, code: 'USER_CANCELLED' });
    }
    expect(store).not.toHaveProperty('anilistToken');
  });

  it('page d’autorisation non chargée (client ou redirection invalide) : AUTH_FLOW_FAILED avec l’URL à vérifier', async () => {
    launchWebAuthFlow.mockRejectedValueOnce(new Error('Authorization page could not be loaded.'));
    expect(await loginWithAniList()).toEqual({ ok: false, code: 'AUTH_FLOW_FAILED', message: expect.stringContaining(REDIRECT) as unknown });
  });

  it('autre erreur du flux (ou valeur non Error) : AUTH_FLOW_FAILED avec le message', async () => {
    launchWebAuthFlow.mockRejectedValueOnce(new Error('network down'));
    expect(await loginWithAniList()).toEqual({ ok: false, code: 'AUTH_FLOW_FAILED', message: expect.stringContaining('network down') as unknown });
    launchWebAuthFlow.mockRejectedValueOnce('chaîne');
    expect(await loginWithAniList()).toMatchObject({ ok: false, code: 'AUTH_FLOW_FAILED', message: expect.stringContaining('chaîne') as unknown });
  });

  it('aucune URL de retour : INVALID_RESPONSE', async () => {
    launchWebAuthFlow.mockResolvedValueOnce(undefined);
    expect(await loginWithAniList()).toMatchObject({ ok: false, code: 'INVALID_RESPONSE' });
    launchWebAuthFlow.mockResolvedValueOnce('');
    expect(await loginWithAniList()).toMatchObject({ ok: false, code: 'INVALID_RESPONSE' });
  });

  it('refus d’AniList dans le fragment ou dans la query : ACCESS_DENIED, rien d’enregistré', async () => {
    for (const response of [`${REDIRECT}#error=access_denied`, `${REDIRECT}?error=access_denied`]) {
      launchWebAuthFlow.mockResolvedValueOnce(response);
      expect(await loginWithAniList(), response).toMatchObject({ ok: false, code: 'ACCESS_DENIED' });
    }
    expect(store).not.toHaveProperty('anilistToken');
  });

  it('token ou durée manquants ou invalides : INVALID_RESPONSE, rien d’enregistré', async () => {
    const responses = [
      `${REDIRECT}#expires_in=3600`,
      `${REDIRECT}#access_token=T`,
      `${REDIRECT}#access_token=T&expires_in=abc`,
      `${REDIRECT}#access_token=T&expires_in=0`,
      `${REDIRECT}#access_token=T&expires_in=-5`,
      `${REDIRECT}#access_token=&expires_in=3600`,
      REDIRECT,
    ];
    for (const response of responses) {
      launchWebAuthFlow.mockResolvedValueOnce(response);
      expect(await loginWithAniList(), response).toMatchObject({ ok: false, code: 'INVALID_RESPONSE' });
    }
    expect(store).not.toHaveProperty('anilistToken');
  });

  it('une erreur dans la query ne masque pas un token valide absent : l’erreur prime', async () => {
    launchWebAuthFlow.mockResolvedValueOnce(`${REDIRECT}?error=server_error#access_token=T&expires_in=3600`);
    expect(await loginWithAniList()).toMatchObject({ ok: false, code: 'ACCESS_DENIED' });
    expect(store).not.toHaveProperty('anilistToken');
  });

  it('stockage en échec : UNKNOWN, jamais d’exception', async () => {
    const chromeStub = globalThis.chrome as unknown as { storage: { local: { set: (items: Record<string, unknown>) => Promise<void> } } };
    const set = chromeStub.storage.local.set;
    chromeStub.storage.local.set = () => Promise.reject(new Error('quota'));
    try {
      expect(await loginWithAniList()).toMatchObject({ ok: false, code: 'UNKNOWN' });
    } finally {
      chromeStub.storage.local.set = set;
    }
  });
});
