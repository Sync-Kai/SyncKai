import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../errors';

// Requête AniList et empreinte du compte simulées : le cache des amis est testé seul (le client l'est dans client.test.ts)
const deps = vi.hoisted(() => ({
  anilistQuery: vi.fn<(query: string, isData: (data: unknown) => boolean, variables?: Record<string, unknown>, lane?: string) => Promise<unknown>>(),
  accountFingerprint: vi.fn<(service: string) => Promise<string | null>>(),
}));
vi.mock('./client', () => ({ anilistQuery: deps.anilistQuery }));
vi.mock('../../browser/storage/sessions', async (importOriginal) => ({ ...(await importOriginal<typeof import('../../browser/storage/sessions')>()), accountFingerprint: deps.accountFingerprint }));

const { clearFriendsCache, FRIENDS_CACHE_TTL_MS, FRIENDS_ERROR_TTL_MS, friendsResponse, getAniListFriends, MAX_FRIENDS_KEYS } = await import('./friends');

const DATA = { Page: { pageInfo: { total: 2 }, mediaList: [
  { status: 'COMPLETED', progress: 12, score: 8, user: { id: 1, name: 'Aki', avatar: { medium: null } } },
  { status: 'CURRENT', progress: 4, score: 9, user: { id: 2, name: 'Mei', avatar: null } },
] } };

/** Réponse validée par la garde de la requête, comme le ferait le client */
function answer(data: unknown = DATA): void {
  deps.anilistQuery.mockImplementation(async (_query, isData) => {
    if (!isData(data)) throw new Error('garde refusée');
    return data;
  });
}

describe('getAniListFriends (amis AniList qui ont la série, cache 10 min en mémoire)', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-08T12:00:00Z'));
    clearFriendsCache();
    deps.anilistQuery.mockReset();
    deps.accountFingerprint.mockReset();
    deps.accountFingerprint.mockResolvedValue('3:token-a');
    answer();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('requête de la spec (§5.4), file interactive, identifiant de la série en variable', async () => {
    await expect(getAniListFriends(21)).resolves.toMatchObject({ total: 2, averageScore: 8.5, scoredCount: 2 });
    expect(deps.anilistQuery).toHaveBeenCalledTimes(1);
    const [query, , variables, lane] = deps.anilistQuery.mock.calls[0] ?? [];
    expect(query).toMatch(/Page\(perPage:\s*50\)/);
    expect(query).toMatch(/pageInfo\s*\{\s*total\s*\}/);
    expect(query).toMatch(/mediaList\(mediaId:\s*\$id,\s*isFollowing:\s*true,\s*sort:\s*\[STATUS,\s*SCORE_DESC\]\)/);
    expect(query).toMatch(/score\(format:\s*POINT_10_DECIMAL\)/);
    expect(query).toMatch(/user\s*\{\s*id\s+name\s+avatar\s*\{\s*medium\s*\}\s*\}/);
    expect(variables).toEqual({ id: 21 });
    expect(lane).toBe('interactive');
  });

  it('sans session AniList : null, aucune requête', async () => {
    deps.accountFingerprint.mockResolvedValue(null);
    await expect(getAniListFriends(21)).resolves.toBeNull();
    expect(deps.anilistQuery).not.toHaveBeenCalled();
  });

  it('deuxième appel dans les 10 min : aucune requête ; au-delà, relu', async () => {
    await getAniListFriends(21);
    vi.setSystemTime(Date.now() + FRIENDS_CACHE_TTL_MS - 1000);
    await expect(getAniListFriends(21)).resolves.toMatchObject({ total: 2 });
    expect(deps.anilistQuery).toHaveBeenCalledTimes(1);
    vi.setSystemTime(Date.now() + 2000);
    await getAniListFriends(21);
    expect(deps.anilistQuery).toHaveBeenCalledTimes(2);
  });

  it('autre empreinte de compte (autre compte, reconnexion) : nouvelle requête', async () => {
    await getAniListFriends(21);
    deps.accountFingerprint.mockResolvedValue('4:token-b');
    await getAniListFriends(21);
    expect(deps.anilistQuery).toHaveBeenCalledTimes(2);
    // Retour à l'ancien compte : cache vidé au changement de compte (une déconnexion l'efface)
    deps.accountFingerprint.mockResolvedValue('3:token-a');
    await getAniListFriends(21);
    expect(deps.anilistQuery).toHaveBeenCalledTimes(3);
  });

  it('session changée pendant la requête : rien gardé, null (données de l’ancien compte)', async () => {
    deps.accountFingerprint.mockResolvedValueOnce('3:token-a').mockResolvedValue('4:token-b');
    await expect(getAniListFriends(21)).resolves.toBeNull();
    await getAniListFriends(21);
    expect(deps.anilistQuery).toHaveBeenCalledTimes(2);
  });

  it('appels simultanés pour la même série : une seule requête', async () => {
    const [a, b] = await Promise.all([getAniListFriends(21), getAniListFriends(21)]);
    expect(a).toEqual(b);
    expect(deps.anilistQuery).toHaveBeenCalledTimes(1);
  });

  it(`au plus ${100} clés : la plus ancienne oubliée`, async () => {
    expect(MAX_FRIENDS_KEYS).toBe(100);
    for (let id = 1; id <= MAX_FRIENDS_KEYS + 1; id++) await getAniListFriends(id);
    expect(deps.anilistQuery).toHaveBeenCalledTimes(MAX_FRIENDS_KEYS + 1);
    await getAniListFriends(MAX_FRIENDS_KEYS + 1);
    expect(deps.anilistQuery).toHaveBeenCalledTimes(MAX_FRIENDS_KEYS + 1);
    await getAniListFriends(1);
    expect(deps.anilistQuery).toHaveBeenCalledTimes(MAX_FRIENDS_KEYS + 2);
  });
});

describe('friendsResponse (message GET_ANILIST_FRIENDS)', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-08T12:00:00Z'));
    clearFriendsCache();
    deps.anilistQuery.mockReset();
    deps.accountFingerprint.mockReset();
    deps.accountFingerprint.mockResolvedValue('3:token-a');
    answer();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('amis trouvés : ok + résumé ; aucun ami ou aucune session : none', async () => {
    await expect(friendsResponse(21)).resolves.toMatchObject({ status: 'ok', summary: { total: 2 } });
    answer({ Page: { pageInfo: { total: 0 }, mediaList: [] } });
    await expect(friendsResponse(22)).resolves.toEqual({ status: 'none' });
    deps.accountFingerprint.mockResolvedValue(null);
    await expect(friendsResponse(23)).resolves.toEqual({ status: 'none' });
  });

  it('TOKEN_INVALID : erreur, puis aucune requête pendant 10 s pour cette série (pas de boucle de relance)', async () => {
    deps.anilistQuery.mockRejectedValue(new ApiError('TOKEN_INVALID', 'Session AniList expirée'));
    await expect(friendsResponse(21)).resolves.toEqual({ status: 'error', message: 'Session AniList expirée' });
    expect(deps.anilistQuery).toHaveBeenCalledTimes(1);
    vi.setSystemTime(Date.now() + FRIENDS_ERROR_TTL_MS - 1000);
    await expect(friendsResponse(21)).resolves.toEqual({ status: 'error', message: 'Session AniList expirée' });
    expect(deps.anilistQuery).toHaveBeenCalledTimes(1);
    expect(FRIENDS_ERROR_TTL_MS).toBe(10_000);
    // Passé le délai : nouvelle tentative possible (« Réessayer »)
    vi.setSystemTime(Date.now() + 2000);
    answer();
    await expect(friendsResponse(21)).resolves.toMatchObject({ status: 'ok' });
    expect(deps.anilistQuery).toHaveBeenCalledTimes(2);
  });

  it('erreur inattendue (hors ApiError) : erreur générique, pas d’exception', async () => {
    deps.anilistQuery.mockRejectedValue(new TypeError('boom'));
    await expect(friendsResponse(21)).resolves.toMatchObject({ status: 'error' });
  });
});
