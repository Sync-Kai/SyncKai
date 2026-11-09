import { beforeEach, describe, expect, it, vi } from 'vitest';
import { installFakeChrome } from '../../test/fake-chrome';
import type { AniListListEntry, MalListEntry } from '../../shared/compare';
import { sequelCandidates } from '../../shared/sequels';

// Lectures de la vérification des suites : listes et relations simulées, requêtes comptées par file.

const fakes = vi.hoisted(() => ({
  calls: [] as { query: string; ids: number[]; lane: string | undefined }[],
  catalog: new Map<number, number>(),
  edges: new Map<number, { id: number; idMal: number | null }[]>(),
  siteUrls: new Map<number, unknown>(),
  anilist: [] as unknown[],
  mal: [] as unknown[],
}));

vi.mock('../anilist/client', () => ({
  anilistPublicQuery: async (query: string, _guard: unknown, variables: { ids: number[] }, lane?: string) => {
    fakes.calls.push({ query, ids: variables.ids, lane });
    if (query.includes('idMal_in')) return { Page: { media: variables.ids.flatMap((idMal) => (fakes.catalog.has(idMal) ? [{ id: fakes.catalog.get(idMal), idMal }] : [])) } };
    return {
      Page: {
        media: variables.ids.map((id) => ({
          id,
          title: { userPreferred: `Série ${id}` },
          relations: { edges: (fakes.edges.get(id) ?? []).map((node) => ({ relationType: 'SEQUEL', node: { ...node, type: 'ANIME', format: 'TV', status: 'NOT_YET_RELEASED', title: { userPreferred: `Suite ${node.id}` }, coverImage: null, siteUrl: fakes.siteUrls.has(node.id) ? fakes.siteUrls.get(node.id) : `https://anilist.co/anime/${node.id}`, startDate: { year: 2027, month: null, day: null }, season: null, seasonYear: null } })) },
        })),
      },
    };
  },
}));
vi.mock('../anilist/full-list', () => ({ fetchAniListFullList: async () => fakes.anilist }));
vi.mock('../mal/full-list', () => ({ fetchMalFullList: async () => fakes.mal }));

installFakeChrome();
const { fetchSequelRelations, readSourceSeries } = await import('./fetch');

const ani = (mediaId: number, malId: number | null, status: AniListListEntry['status']): AniListListEntry => ({ mediaId, malId, title: `A${mediaId}`, coverUrl: null, status, progress: 0, score: null, repeat: 0 });
const mal = (malId: number, status: MalListEntry['status']): MalListEntry => ({ malId, mediaId: null, title: `M${malId}`, coverUrl: null, status, progress: 0, score: null, repeat: 0 });

beforeEach(() => {
  fakes.calls.length = 0;
  fakes.catalog.clear();
  fakes.edges.clear();
  fakes.siteUrls.clear();
  fakes.anilist = [];
  fakes.mal = [];
});

describe('fetchSequelRelations', () => {
  it('demande 120 séries en lots de 50, 50 et 20, en file de fond', async () => {
    const result = await fetchSequelRelations(Array.from({ length: 120 }, (_, i) => i + 1));
    expect(fakes.calls.map((call) => call.ids.length)).toEqual([50, 50, 20]);
    expect(fakes.calls.every((call) => call.lane === 'background')).toBe(true);
    expect(result.size).toBe(120);
  });
});

describe('fetchSequelRelations › siteUrl', () => {
  it('URL javascript:, hôte étranger ou absente : repli sur la fiche AniList par id', async () => {
    fakes.edges.set(1, [{ id: 20, idMal: null }, { id: 21, idMal: null }, { id: 22, idMal: null }, { id: 23, idMal: null }]);
    fakes.siteUrls.set(20, 'javascript:alert(1)');
    fakes.siteUrls.set(21, 'https://evil.example/x');
    fakes.siteUrls.set(22, null);
    const edges = (await fetchSequelRelations([1])).get(1)?.edges ?? [];
    expect(edges.map((edge) => edge.node.siteUrl)).toEqual([
      'https://anilist.co/anime/20', 'https://anilist.co/anime/21', 'https://anilist.co/anime/22', 'https://anilist.co/anime/23',
    ]);
  });
});

describe('readSourceSeries', () => {
  it('garde COMPLETED, CURRENT, REPEATING et recense toutes les entrées', async () => {
    fakes.anilist = [ani(1, 11, 'COMPLETED'), ani(2, null, 'PLANNING'), ani(3, null, 'DROPPED'), ani(4, null, 'CURRENT')];
    const { sources, inLists } = await readSourceSeries(['anilist']);
    expect(sources.map((s) => s.id)).toEqual([1, 4]);
    expect([...inLists.ids]).toEqual([1, 2, 3, 4]);
    expect([...inLists.malIds]).toEqual([11]);
  });

  it('rapproche une série MAL seule par idMal et la garde dans inLists.malIds', async () => {
    fakes.catalog.set(500, 900);
    fakes.mal = [mal(500, 'COMPLETED'), mal(501, 'PLANNING')];
    const { sources, inLists } = await readSourceSeries(['mal']);
    expect(sources).toEqual([{ id: 900, title: 'M500', services: ['mal'] }]);
    expect(inLists.malIds.has(501)).toBe(true);
    expect(inLists.malIds.has(500)).toBe(true);
  });

  it('une série sur les deux services a les deux services, sans requête de catalogue', async () => {
    fakes.anilist = [ani(1, 11, 'COMPLETED')];
    fakes.mal = [mal(11, 'COMPLETED')];
    const { sources } = await readSourceSeries(['anilist', 'mal']);
    expect(sources).toEqual([{ id: 1, title: 'A1', services: ['anilist', 'mal'] }]);
    expect(fakes.calls).toHaveLength(0);
  });

  it('ignore les séries exclues', async () => {
    fakes.anilist = [ani(1, null, 'COMPLETED'), ani(2, null, 'COMPLETED')];
    await chrome.storage.local.set({ excludedSeries: [{ id: 'anilist:2', platformKey: null, mediaId: 2, label: 'A2', excludedAt: 1 }] });
    expect((await readSourceSeries(['anilist'])).sources.map((s) => s.id)).toEqual([1]);
  });

  it('une suite déjà dans la liste MAL (par idMal) n’est pas candidate, de bout en bout', async () => {
    fakes.catalog.set(500, 900);
    fakes.mal = [mal(500, 'COMPLETED'), mal(501, 'PLANNING')];
    // La suite 10 (idMal 501) est déjà planifiée sur MAL ; la suite 11 (idMal 777) ne l'est pas
    fakes.edges.set(900, [{ id: 10, idMal: 501 }, { id: 11, idMal: 777 }]);
    const { sources, inLists } = await readSourceSeries(['mal']);
    const relations = await fetchSequelRelations(sources.map((source) => source.id));
    const candidates = sequelCandidates(sources.map((source) => ({ source, edges: relations.get(source.id)?.edges ?? [] })), inLists);
    expect(candidates.map((candidate) => candidate.snapshot.id)).toEqual([11]);
  });
});
