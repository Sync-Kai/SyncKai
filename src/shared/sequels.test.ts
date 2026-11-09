import { describe, expect, it } from 'vitest';
import {
  EMPTY_SEQUEL_STORE,
  MAX_KNOWN_SEQUELS,
  MAX_SEQUEL_RECORDS,
  groupSequelsByPeriod,
  isSequelStore,
  mergeSequelPass,
  sequelCandidates,
  setSequelStates,
  visibleSequels,
  type InLists,
  type RelationEdge,
  type SequelRecord,
  type SequelSnapshot,
  type SequelStore,
  type SourceSeries,
} from './sequels';

const NO_LISTS: InLists = { ids: new Set<number>(), malIds: new Set<number>() };

function edge(id: number, overrides: Partial<RelationEdge['node']> = {}, relationType = 'SEQUEL'): RelationEdge {
  return {
    relationType,
    node: {
      id, idMal: id + 10000, type: 'ANIME', format: 'TV', status: 'NOT_YET_RELEASED', title: `Anime ${id}`, coverUrl: null,
      siteUrl: `https://anilist.co/anime/${id}`, year: 2027, month: 1, day: null, season: 'WINTER', seasonYear: 2027, ...overrides,
    },
  };
}

function source(id: number, services: SourceSeries['services'] = ['anilist']): SourceSeries {
  return { id, title: `Source ${id}`, services };
}

function snapshot(id: number, overrides: Partial<SequelSnapshot> = {}): SequelSnapshot {
  return {
    id, idMal: null, title: `Anime ${id}`, format: 'TV', status: 'NOT_YET_RELEASED', coverUrl: null, siteUrl: `https://anilist.co/anime/${id}`,
    year: 2027, month: 1, day: null, season: 'WINTER', seasonYear: 2027, sourceId: 1, sourceTitle: 'Source 1', ...overrides,
  };
}

function record(id: number, state: SequelRecord['state'] = 'new', firstSeenAt = id): SequelRecord {
  return { snapshot: snapshot(id), state, firstSeenAt };
}

function candidate(id: number, services: SourceSeries['services'] = ['anilist'], overrides: Partial<SequelSnapshot> = {}): { snapshot: SequelSnapshot; services: SourceSeries['services'] } {
  return { snapshot: snapshot(id, overrides), services: [...services] };
}

function store(overrides: Partial<SequelStore> = {}): SequelStore {
  return { ...EMPTY_SEQUEL_STORE, ...overrides };
}

describe('sequelCandidates', () => {
  it('garde une suite ANIME TV pas encore sortie', () => {
    const result = sequelCandidates([{ source: source(1), edges: [edge(2)] }], NO_LISTS);
    expect(result).toHaveLength(1);
    expect(result[0]?.snapshot).toMatchObject({ id: 2, idMal: 10002, format: 'TV', status: 'NOT_YET_RELEASED', sourceId: 1, sourceTitle: 'Source 1', season: 'WINTER' });
    expect(result[0]?.services).toEqual(['anilist']);
  });

  it('écarte les relations, types, formats et statuts hors périmètre', () => {
    const edges = [
      edge(2, {}, 'PREQUEL'), edge(3, {}, 'SIDE_STORY'), edge(4, { type: 'MANGA' }), edge(5, { format: 'OVA' }), edge(6, { format: 'SPECIAL' }),
      edge(7, { format: 'MUSIC' }), edge(8, { status: 'FINISHED' }), edge(9, { status: 'CANCELLED' }), edge(10, { format: null }), edge(11, { status: null }),
    ];
    expect(sequelCandidates([{ source: source(1), edges }], NO_LISTS)).toEqual([]);
  });

  it('écarte une suite déjà dans les listes (id AniList ou id MAL)', () => {
    const inLists: InLists = { ids: new Set([2]), malIds: new Set([10003]) };
    const result = sequelCandidates([{ source: source(1), edges: [edge(2), edge(3), edge(4)] }], inLists);
    expect(result.map((c) => c.snapshot.id)).toEqual([4]);
  });

  it('fusionne deux sources atteignant la même suite : une candidate, services en union, première source retenue', () => {
    const result = sequelCandidates([
      { source: source(1, ['anilist']), edges: [edge(9)] },
      { source: source(2, ['mal']), edges: [edge(9)] },
    ], NO_LISTS);
    expect(result).toHaveLength(1);
    expect(result[0]?.services).toEqual(['anilist', 'mal']);
    expect(result[0]?.snapshot.sourceId).toBe(1);
    expect(result[0]?.snapshot.sourceTitle).toBe('Source 1');
  });
});

describe('mergeSequelPass', () => {
  it('première passe : enregistre sans notifier et amorce le service', () => {
    const { store: next, toNotify } = mergeSequelPass(EMPTY_SEQUEL_STORE, [candidate(2), candidate(3)], ['anilist'], 1000);
    expect(toNotify).toEqual([]);
    expect(next.records.map((r) => [r.snapshot.id, r.state, r.firstSeenAt])).toEqual([[2, 'new', 1000], [3, 'new', 1000]]);
    expect(next.seeded).toEqual(['anilist']);
    expect(next.known).toEqual([2, 3]);
    expect(next.lastCheck).toBe(1000);
  });

  it('seconde passe : notifie une nouvelle suite d’un service déjà amorcé', () => {
    const start = store({ records: [record(2)], known: [2], seeded: ['anilist'], lastCheck: 1 });
    const { store: next, toNotify } = mergeSequelPass(start, [candidate(2), candidate(3)], ['anilist'], 2000);
    expect(toNotify.map((s) => s.id)).toEqual([3]);
    expect(next.records.map((r) => r.snapshot.id).sort()).toEqual([2, 3]);
    expect(next.known).toEqual([2, 3]);
  });

  it('un service pas encore amorcé enregistre sans notifier, puis devient amorcé', () => {
    const start = store({ seeded: ['anilist'], lastCheck: 1 });
    const { store: next, toNotify } = mergeSequelPass(start, [candidate(5, ['mal'])], ['mal'], 2000);
    expect(toNotify).toEqual([]);
    expect(next.records[0]?.state).toBe('new');
    expect(next.seeded).toEqual(['anilist', 'mal']);
  });

  it('ne renotifie jamais un id connu dont l’enregistrement a disparu', () => {
    const start = store({ records: [record(2)], known: [2], seeded: ['anilist'], lastCheck: 1 });
    const pruned = mergeSequelPass(start, [], ['anilist'], 2000).store;
    expect(pruned.records).toEqual([]);
    expect(pruned.known).toEqual([2]);
    const again = mergeSequelPass(pruned, [candidate(2)], ['anilist'], 3000);
    expect(again.toNotify).toEqual([]);
    expect(again.store.records).toEqual([]);
    expect(again.store.known).toEqual([2]);
  });

  it('rafraîchit l’instantané sans changer l’état ni notifier', () => {
    const start = store({ records: [{ ...record(2, 'seen', 500) }], known: [2], seeded: ['anilist'], lastCheck: 1 });
    const { store: next, toNotify } = mergeSequelPass(start, [candidate(2, ['anilist'], { month: 4 })], ['anilist'], 2000);
    expect(toNotify).toEqual([]);
    expect(next.records).toHaveLength(1);
    expect(next.records[0]).toMatchObject({ state: 'seen', firstSeenAt: 500 });
    expect(next.records[0]?.snapshot.month).toBe(4);
  });

  it('retire de records une suite qui n’est plus candidate mais la garde dans known', () => {
    const start = store({ records: [record(2), record(3)], known: [2, 3], seeded: ['anilist'], lastCheck: 1 });
    const { store: next } = mergeSequelPass(start, [candidate(3)], ['anilist'], 2000);
    expect(next.records.map((r) => r.snapshot.id)).toEqual([3]);
    expect(next.known).toEqual([2, 3]);
  });

  it('plafonne records (dismissed d’abord, puis les plus anciens) et known (ids les plus récents)', () => {
    const records: SequelRecord[] = [];
    for (let id = 1; id <= 205; id++) records.push(record(id, id <= 3 ? 'dismissed' : id % 2 ? 'seen' : 'new', 1000 + id));
    const start = store({ records, known: records.map((r) => r.snapshot.id), seeded: ['anilist'], lastCheck: 1 });
    const candidates = records.map((r) => candidate(r.snapshot.id));
    const { store: next } = mergeSequelPass(start, candidates, ['anilist'], 5000);
    expect(next.records).toHaveLength(MAX_SEQUEL_RECORDS);
    const kept = new Set(next.records.map((r) => r.snapshot.id));
    expect([1, 2, 3].some((id) => kept.has(id))).toBe(false);
    // Les vues partent avant les nouvelles : 5 et 7 (les plus anciennes vues), pas 4
    expect(kept.has(4)).toBe(true);
    expect(kept.has(5)).toBe(false);
    expect(kept.has(7)).toBe(false);
    expect(kept.has(9)).toBe(true);

    const bigKnown = Array.from({ length: MAX_KNOWN_SEQUELS }, (_, i) => i + 1);
    const capped = mergeSequelPass(store({ known: bigKnown, seeded: ['anilist'] }), [candidate(9999)], ['anilist'], 5000).store;
    expect(capped.known).toHaveLength(MAX_KNOWN_SEQUELS);
    expect(capped.known[capped.known.length - 1]).toBe(9999);
    expect(capped.known).not.toContain(1);
  });
});

describe('plafond et notifications', () => {
  it('à plafond atteint, une vue récente part avant une nouvelle plus ancienne', () => {
    const records: SequelRecord[] = [record(1, 'new', 1)];
    for (let id = 2; id <= 201; id++) records.push(record(id, id === 201 ? 'seen' : 'new', 1000 + id));
    const start = store({ records, known: records.map((r) => r.snapshot.id), seeded: ['anilist'], lastCheck: 1 });
    const { store: next } = mergeSequelPass(start, records.map((r) => candidate(r.snapshot.id)), ['anilist'], 5000);
    const kept = new Set(next.records.map((r) => r.snapshot.id));
    expect(next.records).toHaveLength(MAX_SEQUEL_RECORDS);
    expect(kept.has(201)).toBe(false);
    expect(kept.has(1)).toBe(true);
  });

  it('ne notifie que les suites dont l’enregistrement survit au plafond', () => {
    const candidates = Array.from({ length: 250 }, (_, i) => candidate(i + 1));
    const { store: next, toNotify } = mergeSequelPass(store({ seeded: ['anilist'] }), candidates, ['anilist'], 5000);
    expect(next.records).toHaveLength(MAX_SEQUEL_RECORDS);
    const kept = new Set(next.records.map((r) => r.snapshot.id));
    expect(toNotify.length).toBeGreaterThan(0);
    expect(toNotify.every((s) => kept.has(s.id))).toBe(true);
  });
});

describe('visibleSequels', () => {
  it('liste new et seen, du plus récent au plus ancien', () => {
    const s = store({ records: [record(1, 'seen', 10), record(2, 'dismissed', 50), record(3, 'new', 30)] });
    expect(visibleSequels(s).map((r) => r.snapshot.id)).toEqual([3, 1]);
  });
});

describe('setSequelStates', () => {
  const base = store({ records: [record(1), record(2)], known: [1, 2] });

  it('change l’état des ids demandés seulement', () => {
    expect(setSequelStates(base, [1], 'seen').records.map((r) => r.state)).toEqual(['seen', 'new']);
    expect(setSequelStates(base, [2], 'dismissed').records.map((r) => r.state)).toEqual(['new', 'dismissed']);
  });

  it('removed retire l’enregistrement mais garde known', () => {
    const next = setSequelStates(base, [1], 'removed');
    expect(next.records.map((r) => r.snapshot.id)).toEqual([2]);
    expect(next.known).toEqual([1, 2]);
  });
});

describe('isSequelStore', () => {
  const valid = (): unknown => JSON.parse(JSON.stringify(store({ records: [record(1)], known: [1], seeded: ['anilist', 'mal'], lastCheck: 5 })));

  it('accepte un store valide et le store vide', () => {
    expect(isSequelStore(valid())).toBe(true);
    expect(isSequelStore(EMPTY_SEQUEL_STORE)).toBe(true);
  });

  it('rejette un id non numérique, un état inconnu et un service inconnu', () => {
    const badId = valid() as { records: { snapshot: { id: unknown } }[] };
    badId.records[0].snapshot.id = '1';
    expect(isSequelStore(badId)).toBe(false);
    const badState = valid() as { records: { state: unknown }[] };
    badState.records[0].state = 'archived';
    expect(isSequelStore(badState)).toBe(false);
    const badSeeded = valid() as { seeded: unknown[] };
    badSeeded.seeded.push('kitsu');
    expect(isSequelStore(badSeeded)).toBe(false);
    expect(isSequelStore(null)).toBe(false);
  });

  it('rejette NaN et Infinity dans les ids, sourceId, firstSeenAt et known', () => {
    for (const bad of [Number.NaN, Number.POSITIVE_INFINITY]) {
      const id = valid() as { records: { snapshot: { id: number } }[] };
      id.records[0].snapshot.id = bad;
      const sourceId = valid() as { records: { snapshot: { sourceId: number } }[] };
      sourceId.records[0].snapshot.sourceId = bad;
      const seen = valid() as { records: { firstSeenAt: number }[] };
      seen.records[0].firstSeenAt = bad;
      const known = valid() as { known: number[] };
      known.known.push(bad);
      for (const candidate of [id, sourceId, seen, known]) expect(isSequelStore(candidate)).toBe(false);
    }
  });
});

describe('groupSequelsByPeriod', () => {
  const rec = (id: number, patch: Partial<SequelSnapshot>, title = `Anime ${id}`): SequelRecord => ({ snapshot: snapshot(id, { title, ...patch }), state: 'new', firstSeenAt: id });
  const none = { year: null, month: null, day: null, season: null, seasonYear: null } as const;

  it('une date exacte ou un mois rejoint sa saison, comme une saison seule', () => {
    const groups = groupSequelsByPeriod([
      rec(1, { ...none, year: 2027, month: 1, day: 10 }),
      rec(2, { ...none, season: 'WINTER', seasonYear: 2027 }),
      rec(3, { ...none, year: 2027, month: 3 }),
      rec(4, { ...none, year: 2026, month: 12, day: 31 }),
    ]);
    expect(groups.map((g) => [g.key, g.season, g.year, g.records.map((r) => r.snapshot.id)])).toEqual([
      ['2026-FALL', 'FALL', 2026, [4]],
      ['2027-WINTER', 'WINTER', 2027, [1, 3, 2]],
    ]);
  });

  it('saisons dans l’ordre de l’année, l’année seule après ses saisons, l’inconnu en dernier', () => {
    const groups = groupSequelsByPeriod([
      rec(1, none),
      rec(2, { ...none, year: 2027 }),
      rec(3, { ...none, season: 'FALL', seasonYear: 2027 }),
      rec(4, { ...none, year: 2028, month: 4, day: 2 }),
      rec(5, { ...none, season: 'SUMMER', seasonYear: 2027 }),
    ]);
    expect(groups.map((g) => [g.key, g.season, g.year])).toEqual([
      ['2027-SUMMER', 'SUMMER', 2027],
      ['2027-FALL', 'FALL', 2027],
      ['2027', null, 2027],
      ['2028-SPRING', 'SPRING', 2028],
      ['unknown', null, null],
    ]);
  });

  it('dans un groupe : par date, puis par titre', () => {
    const groups = groupSequelsByPeriod([
      rec(1, { ...none, year: 2027, month: 2, day: 5 }, 'B'),
      rec(2, { ...none, year: 2027, month: 1, day: 20 }, 'Z'),
      rec(3, { ...none, year: 2027, month: 1, day: 20 }, 'A'),
    ]);
    expect(groups[0]?.records.map((r) => r.snapshot.id)).toEqual([3, 2, 1]);
  });

  it('aucune suite : aucun groupe', () => {
    expect(groupSequelsByPeriod([])).toEqual([]);
  });
});
