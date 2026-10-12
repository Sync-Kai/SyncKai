import { beforeEach, describe, expect, it, vi } from 'vitest';

// Cache du catalogue AniList (fiches publiques) : une recherche répétée par la fiche de la page, la lecture puis la
// synchro (One Piece parcouru arc par arc sur Netflix) ne coûte qu'une requête ; une seule requête en vol par clé.
const client = vi.hoisted(() => ({ anilistPublicQuery: vi.fn() }));
vi.mock('./client', () => client);

const { CATALOG_CACHE_TTL_MS, clearCatalogCache, getAnimeByIds, MAX_SEARCH_BATCH, searchAnime, searchAnimeBatch } = await import('./media');

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

describe('recherches réunies (import de l’historique Netflix)', () => {
  const media = (id: number, title: string) => ({ id, title: { romaji: title }, externalLinks: [{ url: `https://www.netflix.com/title/${id}` }] });

  it('une requête GraphQL à alias pour 10 titres, résultats rangés par titre et servis ensuite par le cache de searchAnime', async () => {
    const titles = Array.from({ length: 12 }, (_, i) => `Titre ${i}`);
    client.anilistPublicQuery.mockImplementation((query: string, isData: (data: unknown) => boolean, variables: Record<string, unknown>) => {
      const count = Object.keys(variables).length;
      const data = Object.fromEntries(Array.from({ length: count }, (_, i) => [`s${i}`, { media: [media(100 + i, String(variables[`s${i}`]))] }]));
      expect(isData(data)).toBe(true);
      expect(isData({ s0: { media: [] } })).toBe(count === 1);
      expect(query.match(/Page\(perPage: 20\)/g)).toHaveLength(count);
      return Promise.resolve(data);
    });
    const results = await searchAnimeBatch(titles, 'background');
    expect(client.anilistPublicQuery).toHaveBeenCalledTimes(2);
    expect(client.anilistPublicQuery.mock.calls.map((call) => Object.keys(call[2] as Record<string, unknown>).length)).toEqual([MAX_SEARCH_BATCH, 2]);
    expect(client.anilistPublicQuery.mock.calls.every((call) => call[3] === 'background')).toBe(true);
    expect(results.get('Titre 0')?.map((m) => m.titles[0])).toEqual(['Titre 0']);
    expect(results.get('Titre 11')?.map((m) => m.externalLinkUrls)).toEqual([['https://www.netflix.com/title/101']]);
    // L'analyse cherche ensuite le même titre : aucune nouvelle requête ; un nouveau lot ne redemande pas les titres connus
    await searchAnime('titre 3', 'background');
    await searchAnimeBatch(['Titre 1', 'Autre'], 'background');
    expect(client.anilistPublicQuery).toHaveBeenCalledTimes(3);
    expect(client.anilistPublicQuery.mock.calls[2]?.[2]).toEqual({ s0: 'Autre' });
  });

  it('titres déjà en cache : aucune requête ; échec du lot : rien en cache', async () => {
    await searchAnime('One Piece', 'background');
    client.anilistPublicQuery.mockClear();
    expect((await searchAnimeBatch(['One Piece', 'one piece'], 'background')).size).toBe(2);
    expect(client.anilistPublicQuery).not.toHaveBeenCalled();
    client.anilistPublicQuery.mockRejectedValueOnce(new Error('réseau'));
    await expect(searchAnimeBatch(['Naruto'], 'background')).rejects.toThrow('réseau');
    await searchAnimeBatch(['Naruto'], 'background');
    expect(client.anilistPublicQuery).toHaveBeenCalledTimes(2);
  });
});
