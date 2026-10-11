import { beforeEach, describe, expect, it, vi } from 'vitest';
import { setLocale } from '../../i18n';

// Connexion AniList par-dessus un token expiré (AUTH-06) : la session de l'ancien compte est fermée avant la nouvelle.

let store: Record<string, unknown> = {};
vi.stubGlobal('chrome', {
  runtime: { id: 'khokcmigioggannjoojambdgioigdceb' },
  identity: {
    getRedirectURL: () => 'https://khokcmigioggannjoojambdgioigdceb.chromiumapp.org/',
    launchWebAuthFlow: async () => 'https://khokcmigioggannjoojambdgioigdceb.chromiumapp.org/#access_token=NEW&token_type=Bearer&expires_in=31536000',
  },
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

const { loginWithAniList } = await import('./anilist');

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
    expect(store.anilistToken).toMatchObject({ accessToken: 'NEW' });
    expect(store.sessionEpoch).toEqual({ anilist: 3 });
    for (const key of ['anilistViewer', 'compare:last', 'crImport:plan', 'syncQueue']) expect(store, key).not.toHaveProperty(key);
    expect(store.watchingCache).toEqual({});
    expect(store.platformLinks).toEqual({ '1': [] });
  });

  it('première connexion : aucune session à fermer, génération inchangée', async () => {
    store = { sessionEpoch: { anilist: 2 } };
    expect(await loginWithAniList()).toEqual({ ok: true, data: null });
    expect(store.sessionEpoch).toEqual({ anilist: 2 });
    expect(store.anilistToken).toMatchObject({ accessToken: 'NEW' });
  });
});
