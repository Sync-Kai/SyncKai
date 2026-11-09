import { describe, expect, it } from 'vitest';
import aot from './__fixtures__/franchise/aot.json';
import gundam from './__fixtures__/franchise/gundam.json';
import monogatari from './__fixtures__/franchise/monogatari.json';
import mushoku from './__fixtures__/franchise/mushoku.json';
import {
  franchiseProgress,
  MAX_EXTRAS,
  MAX_MAIN,
  mergeRound,
  newFranchiseGraph,
  releaseOrder,
  shortTitle,
  type FranchiseGraph,
  type FranchiseNode,
  type ListState,
  type RawMedia,
} from './franchise';

interface Fixture {
  rounds: RawMedia[][];
}

/** Rejoue une capture réelle tour par tour, comme le chargeur : chaque page doit répondre exactement à la frontière précédente */
function walk(fixture: Fixture, startId: number): { graph: FranchiseGraph; requested: number[][] } {
  let graph = newFranchiseGraph(startId);
  let frontier = [startId];
  const requested: number[][] = [];
  for (const page of fixture.rounds) {
    requested.push(frontier);
    expect([...page.map((m) => m.id)].sort()).toEqual([...frontier].sort());
    const merged = mergeRound(graph, page);
    graph = merged.graph;
    frontier = merged.frontier;
  }
  expect(frontier).toEqual([]);
  return { graph, requested };
}

const titles = (graph: FranchiseGraph, ids: readonly number[]): string[] => ids.map((id) => graph.nodes[id]?.title ?? '?');

// Fabrique d'entrées synthétiques (forme de la réponse AniList)
function raw(id: number, over: Partial<RawMedia> = {}, edges: { relationType: string; node: Partial<RawMedia> & { id: number } }[] = []): RawMedia {
  return {
    id,
    idMal: id,
    type: 'ANIME',
    format: 'TV',
    status: 'FINISHED',
    episodes: 12,
    duration: 24,
    title: { userPreferred: `Titre ${id}` },
    coverImage: { medium: null },
    siteUrl: `https://anilist.co/anime/${id}`,
    startDate: { year: 2000 + (id % 20), month: 1, day: 1 },
    season: null,
    seasonYear: null,
    externalLinks: [],
    ...over,
    relations: { edges: edges.map((e) => ({ relationType: e.relationType, node: { ...raw(e.node.id), ...e.node, relations: { edges: [] } } })) },
  };
}

function node(id: number, over: Partial<FranchiseNode> = {}): FranchiseNode {
  return {
    id, idMal: id, title: `N${id}`, format: 'TV', status: 'FINISHED', episodes: 12, duration: 24, coverUrl: null, siteUrl: `https://anilist.co/anime/${id}`,
    year: 2000 + id, month: 1, day: 1, season: null, seasonYear: null, platforms: [], ...over,
  };
}

describe('mergeRound sur des captures réelles', () => {
  it('AoT : la chaîne principale est dans l\'ordre de sortie (No Regrets, PREQUEL en histoire, sorti en 2014 : après la saison 1)', () => {
    const { graph } = walk(aot, 16498);
    const ordered = releaseOrder(graph, 'main');
    expect(titles(graph, ordered.map((n) => n.id))).toEqual([
      'Shingeki no Kyojin',
      'Shingeki no Kyojin Gaiden: Kuinaki Sentaku',
      'Shingeki no Kyojin Season 2',
      'Shingeki no Kyojin Season 3',
      'Shingeki no Kyojin Season 3 Part 2',
      'Shingeki no Kyojin: The Final Season',
      'Shingeki no Kyojin: The Final Season Part 2',
      'Shingeki no Kyojin: The Final Season - Kanketsu-hen Zenpen',
      'Shingeki no Kyojin: The Final Season - Kanketsu-hen Kouhen',
    ]);
    expect(graph.capped).toBe(false);
  });

  it('AoT : les spéciaux et résumés n\'apparaissent qu\'en mode Tout, en un saut depuis la chaîne', () => {
    const { graph } = walk(aot, 16498);
    const all = releaseOrder(graph, 'all');
    expect(all.length).toBeGreaterThan(9);
    expect(graph.extras.length).toBeLessThanOrEqual(MAX_EXTRAS);
    for (const e of graph.extras) {
      expect(graph.main).toContain(e.from);
      expect(graph.main).not.toContain(e.id);
      expect(['SIDE_STORY', 'SPIN_OFF', 'ALTERNATIVE', 'SUMMARY', 'PARENT']).toContain(e.relation);
    }
    // OTHER (ex. 19391) ne passe jamais
    expect(graph.extras.map((e) => e.id)).not.toContain(19391);
    expect(new Set(graph.extras.map((e) => e.id)).size).toBe(graph.extras.length);
  });

  it('la frontière se vide quand la chaîne se ferme et aucun tour ne relit une entrée', () => {
    const { requested } = walk(aot, 16498);
    const flat = requested.flat();
    expect(new Set(flat).size).toBe(flat.length);
  });

  it('Monogatari : le crossover Nisekoi (OTHER) n\'entre jamais dans le graphe', () => {
    const { graph } = walk(monogatari, 5081);
    const everyTitle = Object.values(graph.nodes).map((n) => n.title.toLowerCase());
    expect(everyTitle.some((t) => t.includes('nisekoi'))).toBe(false);
    const main = releaseOrder(graph, 'main');
    expect(main[0]?.title).toBe('Bakemonogatari');
    expect(main.length).toBe(14);
  });

  it('Monogatari : une entrée au format inconnu reste affichable', () => {
    const { graph } = walk(monogatari, 5081);
    expect(graph.nodes[195448]?.format).toBeNull();
  });

  it('Mushoku Tensei : les parties se suivent et la dernière annoncée est en fin de liste', () => {
    const { graph } = walk(mushoku, 108465);
    const ordered = releaseOrder(graph, 'main');
    expect(ordered.map((n) => n.id)).toEqual([108465, 127720, 146065, 166873, 178789, 217434]);
    expect(ordered[5]?.status).toBe('NOT_YET_RELEASED');
  });

  it('Gundam : ne garde que la composante connectée du départ, sans MANGA ni lien OTHER, et le plafond est réel (23 < MAX_MAIN)', () => {
    const { graph } = walk(gundam, 80);
    const edges = (gundam as Fixture).rounds.flat().flatMap((m) => m.relations?.edges ?? []);
    const mangaIds = new Set(edges.filter((e) => e.node.type !== 'ANIME').map((e) => e.node.id));
    const otherIds = new Set(edges.filter((e) => e.relationType === 'OTHER').map((e) => e.node.id));
    expect(mangaIds.size).toBeGreaterThan(0);
    expect(graph.main.length).toBe(23);
    expect(graph.main.length).toBeLessThan(MAX_MAIN);
    expect(graph.capped).toBe(false);
    expect(graph.main).toContain(6336);
    for (const id of mangaIds) expect(graph.nodes[id]).toBeUndefined();
    for (const id of graph.main) expect(otherIds.has(id) && !edges.some((e) => e.node.id === id && ['SEQUEL', 'PREQUEL'].includes(e.relationType))).toBe(false);
    expect(graph.extras.length).toBeLessThanOrEqual(MAX_EXTRAS);
  });
});

describe('mergeRound sur des cas synthétiques', () => {
  it('un cycle de suites termine avec des identifiants uniques', () => {
    let graph = newFranchiseGraph(1);
    const pages: Record<number, RawMedia> = {
      1: raw(1, {}, [{ relationType: 'SEQUEL', node: { id: 2 } }, { relationType: 'PREQUEL', node: { id: 3 } }]),
      2: raw(2, {}, [{ relationType: 'PREQUEL', node: { id: 1 } }, { relationType: 'SEQUEL', node: { id: 3 } }]),
      3: raw(3, {}, [{ relationType: 'PREQUEL', node: { id: 2 } }, { relationType: 'SEQUEL', node: { id: 1 } }]),
    };
    let frontier = [1];
    let rounds = 0;
    while (frontier.length && rounds < 10) {
      const merged = mergeRound(graph, frontier.map((id) => pages[id]));
      graph = merged.graph;
      frontier = merged.frontier;
      rounds += 1;
    }
    expect(frontier).toEqual([]);
    expect(rounds).toBeLessThan(10);
    expect([...graph.main].sort()).toEqual([1, 2, 3]);
    expect(new Set(graph.main).size).toBe(graph.main.length);
  });

  it('une chaîne de plus de MAX_MAIN entrées est coupée avec capped, sans frontière', () => {
    let graph = newFranchiseGraph(1);
    let frontier = [1];
    let rounds = 0;
    while (frontier.length && rounds < 100) {
      const page = frontier.map((id) => raw(id, {}, [{ relationType: 'SEQUEL', node: { id: id + 1 } }]));
      const merged = mergeRound(graph, page);
      graph = merged.graph;
      frontier = merged.frontier;
      rounds += 1;
    }
    expect(graph.main.length).toBe(MAX_MAIN);
    expect(graph.capped).toBe(true);
    expect(frontier).toEqual([]);
  });

  it('une entrée de départ qui est un SIDE_STORY de la chaîne donne cette chaîne, le départ étant dans extras', () => {
    const pages: Record<number, RawMedia> = {
      10: raw(10, { format: 'OVA' }, [{ relationType: 'PARENT', node: { id: 20 } }]),
      20: raw(20, {}, [{ relationType: 'SIDE_STORY', node: { id: 10, format: 'OVA' } }, { relationType: 'SEQUEL', node: { id: 21 } }]),
      21: raw(21, {}, [{ relationType: 'PREQUEL', node: { id: 20 } }]),
    };
    let graph = newFranchiseGraph(10);
    let frontier = [10];
    let guard = 0;
    while (frontier.length && guard++ < 10) {
      const merged = mergeRound(graph, frontier.map((id) => pages[id]));
      graph = merged.graph;
      frontier = merged.frontier;
    }
    expect([...graph.main].sort()).toEqual([20, 21]);
    expect(graph.extras).toEqual([{ id: 10, relation: 'SIDE_STORY', from: 20 }]);
    expect(graph.startId).toBe(10);
    expect(releaseOrder(graph, 'main').map((n) => n.id)).not.toContain(10);
    expect(releaseOrder(graph, 'all').map((n) => n.id)).toContain(10);
  });

  it('MUSIC et les entrées de 5 minutes ou moins n\'apparaissent jamais, ni dans la chaîne ni dans les extras', () => {
    const page = raw(1, {}, [
      { relationType: 'SEQUEL', node: { id: 2, format: 'MUSIC' } },
      { relationType: 'SEQUEL', node: { id: 3, duration: 5 } },
      { relationType: 'SEQUEL', node: { id: 4, format: 'ONA', duration: 3 } },
      { relationType: 'SIDE_STORY', node: { id: 5, format: 'MUSIC' } },
      { relationType: 'SIDE_STORY', node: { id: 6, duration: 4 } },
      { relationType: 'SIDE_STORY', node: { id: 7, type: 'MANGA' } },
      { relationType: 'SIDE_STORY', node: { id: 8, duration: null } },
      { relationType: 'SEQUEL', node: { id: 9 } },
    ]);
    const { graph, frontier } = mergeRound(newFranchiseGraph(1), [page]);
    expect([...graph.main].sort()).toEqual([1, 9]);
    expect(graph.extras.map((e) => e.id)).toEqual([8]);
    expect(frontier).toEqual([9]);
    for (const id of [2, 3, 4, 5, 6, 7]) expect(graph.nodes[id]).toBeUndefined();
  });

  it('plafonne les extras à MAX_EXTRAS', () => {
    const edges = Array.from({ length: MAX_EXTRAS + 10 }, (_, i) => ({ relationType: 'SIDE_STORY', node: { id: 100 + i } }));
    const { graph } = mergeRound(newFranchiseGraph(1), [raw(1, {}, edges)]);
    expect(graph.extras.length).toBe(MAX_EXTRAS);
  });

  it('les plateformes restent vides (remplies par le chargeur) et les liens externes ne sont pas conservés dans les nœuds', () => {
    const { graph } = mergeRound(newFranchiseGraph(1), [raw(1, { externalLinks: [{ url: 'https://www.crunchyroll.com/series/X' }] })]);
    expect(graph.nodes[1]?.platforms).toEqual([]);
  });

  it('refuse une image ou une page hors des hôtes autorisés', () => {
    const { graph } = mergeRound(newFranchiseGraph(1), [raw(1, { coverImage: { medium: 'https://evil.example/x.jpg' }, siteUrl: 'https://evil.example/a' })]);
    expect(graph.nodes[1]?.coverUrl).toBeNull();
    expect(graph.nodes[1]?.siteUrl).toBe('https://anilist.co/anime/1');
  });
});

describe('releaseOrder', () => {
  it('place les dates inconnues en dernier (ordre d\'arrivée conservé) et les annoncées à leur date', () => {
    const nodes: Record<number, FranchiseNode> = {
      1: node(1, { year: 2020 }),
      2: node(2, { year: null, month: null, day: null }),
      3: node(3, { year: 2027, month: null, day: null, status: 'NOT_YET_RELEASED' }),
      4: node(4, { year: 2018, month: 6, day: 3 }),
      5: node(5, { year: null, month: null, day: null }),
      6: node(6, { year: 2020, month: 1, day: 1 }),
    };
    const graph: FranchiseGraph = { startId: 1, nodes, main: [1, 2, 3, 4, 5, 6], extras: [], capped: false, expanded: [] };
    expect(releaseOrder(graph, 'main').map((n) => n.id)).toEqual([4, 1, 6, 3, 2, 5]);
  });

  it('mode all fusionne les extras par date', () => {
    const nodes: Record<number, FranchiseNode> = { 1: node(1, { year: 2010 }), 2: node(2, { year: 2012 }), 3: node(3, { year: 2011 }) };
    const graph: FranchiseGraph = { startId: 1, nodes, main: [1, 2], extras: [{ id: 3, relation: 'SIDE_STORY', from: 1 }], capped: false, expanded: [] };
    expect(releaseOrder(graph, 'all').map((n) => n.id)).toEqual([1, 3, 2]);
    expect(releaseOrder(graph, 'main').map((n) => n.id)).toEqual([1, 2]);
  });
});

describe('franchiseProgress', () => {
  const main = [node(1), node(2), node(3), node(4, { status: 'NOT_YET_RELEASED', year: 2099 })];
  const states = (entries: [number, ListState | 'notOnMal'][]): ReadonlyMap<number, ListState | 'notOnMal'> => new Map(entries);
  const watched: ListState = { kind: 'watched', progress: 12 };

  it('rien de vu : la première entrée sortie est « Ensuite »', () => {
    const r = franchiseProgress(main, states([]));
    expect(r).toMatchObject({ watched: 0, total: 3, allWatched: false });
    expect(r.next?.id).toBe(1);
  });

  it('un OVA précédent sauté derrière la dernière entrée vue n\'est pas « Ensuite »', () => {
    const r = franchiseProgress(main, states([[2, watched]]));
    expect(r.watched).toBe(1);
    expect(r.next?.id).toBe(3);
  });

  it('une entrée en cours compte comme la plus avancée', () => {
    const r = franchiseProgress(main, states([[1, watched], [2, { kind: 'inProgress', progress: 4 }]]));
    expect(r.next?.id).toBe(3);
  });

  it('la dernière entrée sortie en cours avec une annonce derrière : pas de « Ensuite » (jamais l\'annonce tant que tout n\'est pas vu)', () => {
    const r = franchiseProgress(main, states([[1, watched], [2, watched], [3, { kind: 'inProgress', progress: 4 }]]));
    expect(r).toMatchObject({ watched: 2, total: 3, allWatched: false });
    expect(r.next).toBeNull();
  });

  it('RELEASING compte comme sortie', () => {
    const m = [node(1), node(2, { status: 'RELEASING' })];
    const r = franchiseProgress(m, states([[1, watched]]));
    expect(r.total).toBe(2);
    expect(r.next?.id).toBe(2);
  });

  it('tout vu : allWatched, et « Ensuite » est l\'entrée annoncée', () => {
    const r = franchiseProgress(main, states([[1, watched], [2, watched], [3, watched]]));
    expect(r).toMatchObject({ watched: 3, total: 3, allWatched: true });
    expect(r.next?.id).toBe(4);
  });

  it('tout vu sans annonce : next est null', () => {
    const r = franchiseProgress(main.slice(0, 3), states([[1, watched], [2, watched], [3, watched]]));
    expect(r.allWatched).toBe(true);
    expect(r.next).toBeNull();
  });

  it('les entrées absentes de MyAnimeList sortent du total et ne sont jamais « Ensuite »', () => {
    const r = franchiseProgress(main, states([[1, 'notOnMal'], [2, watched], [3, 'notOnMal']]));
    expect(r.total).toBe(1);
    expect(r.watched).toBe(1);
    expect(r.allWatched).toBe(true);
    const r2 = franchiseProgress(main, states([[1, 'notOnMal']]));
    expect(r2.total).toBe(2);
    expect(r2.next?.id).toBe(2);
  });
});

describe('shortTitle', () => {
  it('retire le titre racine quand il préfixe le titre', () => {
    expect(shortTitle('Shingeki no Kyojin', 'Shingeki no Kyojin Season 2')).toBe('Season 2');
    expect(shortTitle('Shingeki no Kyojin', 'Shingeki no Kyojin: The Final Season')).toBe('The Final Season');
  });

  it('laisse le titre inchangé s\'il n\'est pas préfixé (Mushoku Tensei) ou si le préfixe coupe un mot', () => {
    expect(shortTitle('Mushoku Tensei: Isekai Ittara Honki Dasu', 'Mushoku Tensei II: Isekai Ittara Honki Dasu')).toBe('Mushoku Tensei II: Isekai Ittara Honki Dasu');
    expect(shortTitle('Naru', 'Naruto')).toBe('Naruto');
  });

  it('ne renvoie jamais une chaîne vide', () => {
    expect(shortTitle('Gundam', 'Gundam')).toBe('Gundam');
  });
});
