import { beforeEach, describe, expect, it, vi } from 'vitest';
import fixture from '../../shared/__fixtures__/recommendations/seeds.json';
import { installFakeChrome } from '../../test/fake-chrome';
import { STORAGE_KEYS } from '../../protocol/storage-keys';
import type { RecoBatch, RecoResult } from '../../shared/recommendations';

const deps = vi.hoisted(() => ({
  anilistPublicQuery: vi.fn(),
  fetchAniListFullList: vi.fn(),
  fetchMalFullList: vi.fn(),
  aniListIdsByMal: vi.fn(),
  getScoreFormat: vi.fn(),
  getOpenSessions: vi.fn(),
  writeIfSessions: vi.fn(),
}));
vi.mock('../anilist/client', async (importOriginal) => ({ ...(await importOriginal<typeof import('../anilist/client')>()), anilistPublicQuery: deps.anilistPublicQuery }));
vi.mock('../anilist/full-list', () => ({ fetchAniListFullList: deps.fetchAniListFullList }));
vi.mock('../mal/full-list', () => ({ fetchMalFullList: deps.fetchMalFullList }));
vi.mock('../anilist/by-mal', () => ({ aniListIdsByMal: deps.aniListIdsByMal }));
vi.mock('../anilist/list', async (importOriginal) => ({ ...(await importOriginal<typeof import('../anilist/list')>()), getScoreFormat: deps.getScoreFormat }));
vi.mock('../../browser/storage/sessions', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../browser/storage/sessions')>()),
  getOpenSessions: deps.getOpenSessions,
  writeIfSessions: deps.writeIfSessions,
}));

const fake = installFakeChrome();
const NOW = Date.UTC(2026, 10, 9, 12);
const DAY = 24 * 3600_000;

type FixtureMedia = (typeof fixture.media)[number];
const SEED_IDS = fixture.media.map((m) => m.id);
const seedMedia = (id: number): FixtureMedia | undefined => fixture.media.find((m) => m.id === id);

/** Fiche brute minimale d'une suggestion */
const rawMedia = (id: number, extra: Record<string, unknown> = {}): Record<string, unknown> => ({
  id, idMal: null, isAdult: false, format: 'TV', status: 'FINISHED', episodes: 12, duration: 24, averageScore: 80, genres: ['Action'], tags: [],
  title: { userPreferred: `Anime ${id}` }, coverImage: { large: 'https://s4.anilist.co/l.jpg', medium: 'https://s4.anilist.co/m.jpg', color: null }, bannerImage: null,
  siteUrl: `https://anilist.co/anime/${id}`, startDate: { year: 2020 }, season: null, seasonYear: null, externalLinks: [], relations: { edges: [] }, ...extra,
});
const seedNode = (id: number, recs: Record<string, unknown>[]): Record<string, unknown> => ({
  id, genres: ['Action'], tags: [], recommendations: { nodes: recs.map((r) => ({ rating: 10, mediaRecommendation: r })) },
});

const entry = (mediaId: number, status: string, score: number | null, malId: number | null = null): Record<string, unknown> => ({ mediaId, malId, title: `T${mediaId}`, status, progress: 0, score, repeat: 0 });

/** AniList : graines de la vraie réponse (id_in), saison pour le démarrage à froid */
function answerCatalog(season: Record<string, unknown>[] = []): void {
  deps.anilistPublicQuery.mockImplementation(async (query: string, _guard: unknown, variables: { ids?: number[] }) => {
    if (query.includes('RecoSeason')) return { Page: { media: season } };
    return { Page: { media: (variables.ids ?? []).map(seedMedia).filter((m) => m !== undefined) } };
  });
}

const aniListOnly = (): unknown => deps.getOpenSessions.mockResolvedValue({ anilist: 7 });
const batchOf = (result: RecoResult): RecoBatch => {
  if (!result.ok) throw new Error(result.message);
  return result.batch;
};

let getRecommendations: typeof import('./batch').getRecommendations;

beforeEach(async () => {
  fake.reset();
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  for (const mock of Object.values(deps)) mock.mockReset();
  deps.writeIfSessions.mockResolvedValue(true);
  deps.getScoreFormat.mockResolvedValue('POINT_10_DECIMAL');
  deps.aniListIdsByMal.mockResolvedValue(new Map());
  deps.fetchMalFullList.mockResolvedValue([]);
  aniListOnly();
  answerCatalog();
  ({ getRecommendations } = await import('./batch'));
});

describe('getRecommendations › construction', () => {
  it('lit chaque liste une fois, une requête de recommandations par lot de 25 graines, file de fond, session relevée avant', async () => {
    deps.fetchAniListFullList.mockResolvedValue(SEED_IDS.map((id) => entry(id, 'COMPLETED', 9)));
    const batch = batchOf(await getRecommendations(false));
    expect(deps.fetchAniListFullList).toHaveBeenCalledTimes(1);
    expect(deps.fetchMalFullList).not.toHaveBeenCalled();
    expect(deps.anilistPublicQuery).toHaveBeenCalledTimes(1);
    expect(deps.anilistPublicQuery.mock.calls[0]?.[0]).toContain('RecoSeeds');
    expect(deps.anilistPublicQuery.mock.calls[0]?.[3]).toBe('background');
    expect(deps.getScoreFormat).toHaveBeenCalledWith('background');
    expect(deps.getOpenSessions.mock.invocationCallOrder[0]).toBeLessThan(deps.fetchAniListFullList.mock.invocationCallOrder[0] ?? 0);
    expect(deps.getOpenSessions.mock.invocationCallOrder[0]).toBeLessThan(deps.anilistPublicQuery.mock.invocationCallOrder[0] ?? 0);
    expect(batch.cold).toBe(false);
    expect(batch.computedAt).toBe(NOW);
    expect(batch.seedCount).toBe(SEED_IDS.length);
    expect(batch.items.length).toBeGreaterThan(10);
    // Rien de ce qui est déjà dans la liste n'est proposé
    expect(batch.items.some((i) => SEED_IDS.includes(i.card.id))).toBe(false);
    // Les liens externes AniList donnent les plateformes
    expect(batch.items.some((i) => i.card.platforms.length > 0)).toBe(true);
  });

  it('plus de 25 graines : ⌈graines / 25⌉ lectures de recommandations', async () => {
    const ids = Array.from({ length: 30 }, (_, i) => 1000 + i);
    deps.fetchAniListFullList.mockResolvedValue(ids.map((id) => entry(id, 'COMPLETED', 9)));
    deps.anilistPublicQuery.mockImplementation(async (_q: string, _g: unknown, v: { ids: number[] }) => ({ Page: { media: v.ids.map((id) => seedNode(id, [rawMedia(id + 5000)])) } }));
    const batch = batchOf(await getRecommendations(false));
    expect(deps.anilistPublicQuery).toHaveBeenCalledTimes(2);
    expect(deps.anilistPublicQuery.mock.calls.every((c) => c[3] === 'background')).toBe(true);
    expect(batch.items).toHaveLength(30);
  });

  it('écrit avec writeIfSessions sous les sessions relevées avant les requêtes ; session fermée pendant : rien servi ni écrit', async () => {
    deps.fetchAniListFullList.mockResolvedValue(SEED_IDS.map((id) => entry(id, 'COMPLETED', 9)));
    const ok = await getRecommendations(false);
    expect(deps.writeIfSessions).toHaveBeenCalledTimes(1);
    expect(deps.writeIfSessions.mock.calls[0]?.[0]).toEqual({ anilist: 7 });
    expect(deps.writeIfSessions.mock.calls[0]?.[1]).toEqual({ [STORAGE_KEYS.recoBatch]: batchOf(ok) });

    deps.writeIfSessions.mockResolvedValue(false);
    const refused = await getRecommendations(true);
    expect(refused.ok).toBe(false);
  });

  it('jamais de fiche adulte, ni d’écartée, ni de série déjà dans une liste (id AniList ou MAL)', async () => {
    deps.fetchAniListFullList.mockResolvedValue([entry(1, 'COMPLETED', 9), entry(2, 'PLANNING', null, 222), entry(3, 'COMPLETED', 9), entry(4, 'COMPLETED', 9)]);
    fake.local.seed({ [STORAGE_KEYS.recoDismissed]: [14] });
    deps.anilistPublicQuery.mockImplementation(async (_q: string, _g: unknown, v: { ids: number[] }) => ({
      Page: { media: v.ids.map((id) => seedNode(id, [rawMedia(10), rawMedia(11, { isAdult: true }), rawMedia(12), rawMedia(13, { idMal: 222 }), rawMedia(14)])) },
    }));
    const ids = batchOf(await getRecommendations(false)).items.map((i) => i.card.id).sort();
    expect(ids).toEqual([10, 12]);
  });

  it('une suite dont le préquel est terminé reste proposée (ids vus = terminé, en cours, revisionnage, graines comprises)', async () => {
    deps.fetchAniListFullList.mockResolvedValue([entry(1, 'COMPLETED', 9), entry(2, 'COMPLETED', 9), entry(4, 'COMPLETED', 9), entry(3, 'CURRENT', null)]);
    const sequel = (prequel: number): Record<string, unknown> => rawMedia(100 + prequel, { relations: { edges: [{ relationType: 'PREQUEL', node: { id: prequel } }] } });
    deps.anilistPublicQuery.mockImplementation(async (_q: string, _g: unknown, v: { ids: number[] }) => ({
      Page: { media: v.ids.map((id) => seedNode(id, [sequel(1), sequel(3), sequel(99)])) },
    }));
    const ids = batchOf(await getRecommendations(false)).items.map((i) => i.card.id).sort();
    expect(ids).toEqual([101, 103]);
  });

  it('notes AniList converties sur 10 selon le format du profil (POINT_100 : 85 → 8,5 passe le seuil de 7)', async () => {
    deps.getScoreFormat.mockResolvedValue('POINT_100');
    deps.fetchAniListFullList.mockResolvedValue([entry(1, 'COMPLETED', 85), entry(2, 'COMPLETED', 85), entry(3, 'COMPLETED', 85), entry(4, 'COMPLETED', 30)]);
    deps.anilistPublicQuery.mockImplementation(async (_q: string, _g: unknown, v: { ids: number[] }) => ({ Page: { media: v.ids.map((id) => seedNode(id, [rawMedia(10)])) } }));
    const batch = batchOf(await getRecommendations(false));
    expect(batch.seedCount).toBe(3);
    expect(deps.anilistPublicQuery.mock.calls[0]?.[2]).toEqual({ ids: [1, 2, 3] });
  });
});

describe('getRecommendations › MyAnimeList seul', () => {
  it('malOnly, ids MAL convertis en ids AniList, notes MAL sur 10, aucune lecture de la liste AniList', async () => {
    deps.getOpenSessions.mockResolvedValue({ mal: 3 });
    deps.fetchMalFullList.mockResolvedValue([
      { malId: 10, mediaId: null, status: 'COMPLETED', score: 9 },
      { malId: 11, mediaId: null, status: 'COMPLETED', score: 8 },
      { malId: 12, mediaId: null, status: 'COMPLETED', score: 7 },
      { malId: 13, mediaId: null, status: 'COMPLETED', score: 9 },
    ]);
    deps.aniListIdsByMal.mockResolvedValue(new Map([[10, 1], [11, 2], [12, 3]]));
    deps.anilistPublicQuery.mockImplementation(async (_q: string, _g: unknown, v: { ids: number[] }) => ({ Page: { media: v.ids.map((id) => seedNode(id, [rawMedia(50)])) } }));
    const result = await getRecommendations(false);
    expect(result.ok && result.malOnly).toBe(true);
    expect(deps.fetchAniListFullList).not.toHaveBeenCalled();
    expect(deps.getScoreFormat).not.toHaveBeenCalled();
    expect(deps.aniListIdsByMal).toHaveBeenCalledWith([10, 11, 12, 13]);
    expect(deps.anilistPublicQuery.mock.calls[0]?.[2]).toEqual({ ids: [1, 2, 3] });
    expect(deps.writeIfSessions.mock.calls[0]?.[0]).toEqual({ mal: 3 });
    expect(batchOf(result).items.map((i) => i.card.id)).toEqual([50]);
  });

  it('deux comptes : malOnly faux, une série des deux listes compte une fois, les ids MAL déjà connus d’AniList ne sont pas relus', async () => {
    deps.getOpenSessions.mockResolvedValue({ anilist: 7, mal: 3 });
    deps.fetchAniListFullList.mockResolvedValue([entry(1, 'COMPLETED', 9, 10), entry(2, 'COMPLETED', 9)]);
    deps.fetchMalFullList.mockResolvedValue([
      { malId: 10, mediaId: null, status: 'COMPLETED', score: 9 },
      { malId: 20, mediaId: null, status: 'COMPLETED', score: 9 },
    ]);
    deps.aniListIdsByMal.mockResolvedValue(new Map([[20, 3]]));
    deps.anilistPublicQuery.mockImplementation(async (_q: string, _g: unknown, v: { ids: number[] }) => ({ Page: { media: v.ids.map((id) => seedNode(id, [rawMedia(50)])) } }));
    const result = await getRecommendations(false);
    expect(result.ok && result.malOnly).toBe(false);
    expect(deps.aniListIdsByMal).toHaveBeenCalledWith([20]);
    expect(deps.anilistPublicQuery.mock.calls[0]?.[2]).toEqual({ ids: [1, 2, 3] });
    expect(deps.writeIfSessions.mock.calls[0]?.[0]).toEqual({ anilist: 7, mal: 3 });
  });
});

describe('getRecommendations › démarrage à froid', () => {
  it('moins de 3 séries terminées : tops de la saison, cold, sans adulte ni série déjà en liste', async () => {
    deps.fetchAniListFullList.mockResolvedValue([entry(1, 'COMPLETED', 9), entry(5, 'PLANNING', null)]);
    answerCatalog([rawMedia(5), rawMedia(6), rawMedia(7, { isAdult: true }), rawMedia(8, { averageScore: 90 })]);
    const batch = batchOf(await getRecommendations(false));
    const calls = deps.anilistPublicQuery.mock.calls;
    expect(calls).toHaveLength(1);
    expect(calls[0]?.[0]).toContain('RecoSeason');
    expect(calls[0]?.[2]).toEqual({ season: 'FALL', year: 2026 });
    expect(calls[0]?.[3]).toBe('background');
    expect(batch.cold).toBe(true);
    expect(batch.items.map((i) => i.card.id)).toEqual([8, 6]);
    expect(batch.items.every((i) => i.reason === null)).toBe(true);
  });
});

describe('getRecommendations › cache de 24 h', () => {
  const stored = (computedAt: number): RecoBatch => ({ items: [], computedAt, seedCount: 3, cold: false });

  it('lot plus récent que 24 h : servi sans aucune requête', async () => {
    fake.local.seed({ [STORAGE_KEYS.recoBatch]: stored(NOW - DAY + 1000) });
    const result = await getRecommendations(false);
    expect(batchOf(result).computedAt).toBe(NOW - DAY + 1000);
    expect(deps.fetchAniListFullList).not.toHaveBeenCalled();
    expect(deps.anilistPublicQuery).not.toHaveBeenCalled();
    expect(deps.writeIfSessions).not.toHaveBeenCalled();
  });

  it('lot plus vieux que 24 h, ou force : recalculé', async () => {
    deps.fetchAniListFullList.mockResolvedValue(SEED_IDS.map((id) => entry(id, 'COMPLETED', 9)));
    fake.local.seed({ [STORAGE_KEYS.recoBatch]: stored(NOW - DAY - 1) });
    expect(batchOf(await getRecommendations(false)).computedAt).toBe(NOW);
    fake.local.seed({ [STORAGE_KEYS.recoBatch]: stored(NOW - 1000) });
    expect(batchOf(await getRecommendations(true)).computedAt).toBe(NOW);
    expect(deps.fetchAniListFullList).toHaveBeenCalledTimes(2);
  });

  it('autre compte connecté (lot du compte effacé) : un nouveau lot est construit', async () => {
    deps.fetchAniListFullList.mockResolvedValue(SEED_IDS.map((id) => entry(id, 'COMPLETED', 9)));
    fake.local.seed({});
    await getRecommendations(false);
    expect(deps.fetchAniListFullList).toHaveBeenCalledTimes(1);
  });

  it('valeur stockée illisible : ignorée, lot reconstruit', async () => {
    deps.fetchAniListFullList.mockResolvedValue(SEED_IDS.map((id) => entry(id, 'COMPLETED', 9)));
    fake.local.seed({ [STORAGE_KEYS.recoBatch]: { items: 'x' } });
    expect(batchOf(await getRecommendations(false)).items.length).toBeGreaterThan(0);
  });

  it('aucun service connecté : message, aucune requête', async () => {
    deps.getOpenSessions.mockResolvedValue({});
    const result = await getRecommendations(false);
    expect(result.ok).toBe(false);
    expect(deps.anilistPublicQuery).not.toHaveBeenCalled();
  });

  it('erreur d’API : message de l’erreur, ne lève pas', async () => {
    const { ApiError } = await import('../errors');
    deps.fetchAniListFullList.mockRejectedValue(new ApiError('NETWORK', 'AniList injoignable'));
    expect(await getRecommendations(false)).toEqual({ ok: false, message: 'AniList injoignable' });
  });
});
