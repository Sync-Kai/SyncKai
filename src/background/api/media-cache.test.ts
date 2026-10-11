import { beforeEach, describe, expect, it, vi } from 'vitest';

// Cache du catalogue AniList (fiches publiques) : une recherche répétée par la fiche de la page, la lecture puis la
// synchro (One Piece parcouru arc par arc sur Netflix) ne coûte qu'une requête ; une seule requête en vol par clé.
const client = vi.hoisted(() => ({ anilistPublicQuery: vi.fn() }));
vi.mock('./client', () => client);

const { CATALOG_CACHE_TTL_MS, clearCatalogCache, getAnimeByIds, searchAnime } = await import('./media');

const page = { Page: { media: [] } };

beforeEach(() => {
  vi.useRealTimers();
  clearCatalogCache();
  client.anilistPublicQuery.mockReset();
  client.anilistPublicQuery.mockResolvedValue(page);
});

describe('cache du catalogue', () => {
  it('même recherche interactive répétée, ou simultanée : une seule requête ; casse ignorée', async () => {
    await Promise.all([searchAnime('One Piece'), searchAnime('one piece')]);
    await searchAnime('ONE PIECE');
    expect(client.anilistPublicQuery).toHaveBeenCalledTimes(1);
    await getAnimeByIds([2, 1]);
    await getAnimeByIds([1, 2]);
    expect(client.anilistPublicQuery).toHaveBeenCalledTimes(2);
  });

  it('expiré (5 min en interactif) : nouvelle requête', async () => {
    vi.useFakeTimers();
    await searchAnime('One Piece');
    vi.advanceTimersByTime(CATALOG_CACHE_TTL_MS.interactive + 1);
    await searchAnime('One Piece');
    expect(client.anilistPublicQuery).toHaveBeenCalledTimes(2);
  });

  it('échec : rien en cache, la requête suivante repart', async () => {
    client.anilistPublicQuery.mockRejectedValueOnce(new Error('réseau'));
    await expect(searchAnime('One Piece')).rejects.toThrow('réseau');
    await searchAnime('One Piece');
    expect(client.anilistPublicQuery).toHaveBeenCalledTimes(2);
  });
});
