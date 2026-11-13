import { beforeEach, describe, expect, it, vi } from 'vitest';
import { setLocale } from '../../i18n';
import type { AniListViewer, ViewerResult } from '../../shared/anilist.types';
import type { MalViewerResult } from '../../shared/mal.types';
import { FakeAlarms } from '../../test/fake-chrome';
import { revealToken } from '../../test/tokens';

// Connexion par-dessus une session encore enregistrée (STO-01, décision 11 b du 2026-11-13) : les données « utilisateur »
// de l'ancien compte (cartes « À vérifier » simples, suggestions écartées, alertes, liens appris) sont effacées seulement
// si le compte connecté n'est pas celui du profil en cache. Vraie séquence de connexion AniList, profil simulé.

const mocks = vi.hoisted(() => ({
  getViewer: vi.fn<() => Promise<ViewerResult>>(),
  getMalViewer: vi.fn<() => Promise<MalViewerResult>>(),
  refreshReviewBadge: vi.fn(async () => undefined),
}));
vi.mock('../anilist/viewer', () => ({ getViewer: mocks.getViewer }));
vi.mock('../mal/client', () => ({ getMalViewer: mocks.getMalViewer }));
vi.mock('../../browser/badge', () => ({ refreshReviewBadge: mocks.refreshReviewBadge }));

const REDIRECT = 'https://khokcmigioggannjoojambdgioigdceb.chromiumapp.org/';
let store: Record<string, unknown> = {};
const launchWebAuthFlow = vi.fn(async (details: { url: string }): Promise<string> =>
  `${REDIRECT}#access_token=NEW&token_type=Bearer&expires_in=31536000&state=${new URL(details.url).searchParams.get('state') ?? ''}`);
vi.stubGlobal('chrome', {
  runtime: { id: 'khokcmigioggannjoojambdgioigdceb' },
  alarms: new FakeAlarms(),
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

const { signIn } = await import('./sign-in');

setLocale('fr');

const profile = (id: number): AniListViewer => ({ id, name: `U${id}`, siteUrl: `https://anilist.co/user/${id}`, avatarUrl: null });
const viewer = (id: number): ViewerResult => ({ ok: true, data: profile(id) });
/** Données « utilisateur » de l'ancien compte (scope `user` d'ACCOUNT_STORES) */
const USER_DATA = {
  pendingReviews: [{ key: 'simple' }],
  'reco:dismissed': [21],
  platformLinks: { '1': [] },
  airingNotified: [5],
};

beforeEach(() => {
  mocks.getViewer.mockReset();
  mocks.getMalViewer.mockReset();
  mocks.refreshReviewBadge.mockClear();
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  // Session AniList expirée (« Reconnecter ») de l'ancien compte, profil en cache
  store = { anilistToken: { accessToken: 'OLD', expiresAt: 1 }, anilistViewer: profile(1), sessionEpoch: { anilist: 2 }, ...structuredClone(USER_DATA) };
});

describe('signIn AniList par-dessus un jeton expiré (STO-01)', () => {
  it('un autre compte : données « utilisateur » de l’ancien compte effacées, badge mis à jour', async () => {
    mocks.getViewer.mockResolvedValue(viewer(2));
    expect(await signIn('anilist')).toEqual({ ok: true, data: null });
    expect(await revealToken('anilist', store.anilistToken)).toMatchObject({ accessToken: 'NEW' });
    for (const key of Object.keys(USER_DATA)) expect(store, key).not.toHaveProperty(key);
    expect(mocks.refreshReviewBadge).toHaveBeenCalled();
  });

  it('le même compte : ses données sont gardées', async () => {
    mocks.getViewer.mockResolvedValue(viewer(1));
    expect(await signIn('anilist')).toEqual({ ok: true, data: null });
    expect(store).toMatchObject(USER_DATA);
  });

  it('compte connecté inconnu (profil illisible après la connexion) : effacées, une autre personne ne reçoit rien', async () => {
    mocks.getViewer.mockResolvedValue({ ok: false, code: 'NETWORK', message: 'x' });
    expect(await signIn('anilist')).toEqual({ ok: true, data: null });
    for (const key of Object.keys(USER_DATA)) expect(store, key).not.toHaveProperty(key);
  });

  it('MyAnimeList encore connecté : rien n’est effacé (les données valent aussi pour lui)', async () => {
    store.malToken = { accessToken: 'mal', refreshToken: 'r', expiresAt: Number.MAX_SAFE_INTEGER };
    mocks.getViewer.mockResolvedValue(viewer(2));
    expect(await signIn('anilist')).toEqual({ ok: true, data: null });
    expect(store).toMatchObject(USER_DATA);
  });

  it('première connexion (aucun jeton enregistré) : rien n’est effacé, profil préchargé', async () => {
    delete store.anilistToken;
    delete store.anilistViewer;
    mocks.getViewer.mockResolvedValue(viewer(2));
    expect(await signIn('anilist')).toEqual({ ok: true, data: null });
    expect(store).toMatchObject(USER_DATA);
    expect(mocks.getViewer).toHaveBeenCalledTimes(1);
  });

  it('connexion refusée : profil non lu, rien n’est effacé', async () => {
    launchWebAuthFlow.mockRejectedValueOnce(new Error('The user did not approve access.'));
    expect(await signIn('anilist')).toMatchObject({ ok: false, code: 'USER_CANCELLED' });
    expect(mocks.getViewer).not.toHaveBeenCalled();
    expect(store).toMatchObject(USER_DATA);
  });
});
