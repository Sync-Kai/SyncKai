import { describe, expect, it } from 'vitest';
import fixture from './__fixtures__/recommendations/seeds.json';
import {
  BATCH_SIZE,
  MAX_SEEDS,
  buildBatch,
  drawNext,
  pickSeeds,
  withoutItem,
  type RawRecoMedia,
  type RecoBatch,
  type RecoItem,
  type Seed,
} from './recommendations';

interface FixtureMedia {
  id: number;
  genres: string[];
  tags: { name: string; rank: number; isMediaSpoiler: boolean }[];
  recommendations: { nodes: { rating: number; mediaRecommendation: RawRecoMedia | null }[] };
}

const media = (fixture as { media: FixtureMedia[] }).media;
const titles: Record<number, string> = { 154587: 'Frieren', 108465: 'Mushoku Tensei', 101348: 'Vinland Saga', 140960: 'Spy x Family' };
const seedOf = (m: FixtureMedia, score10: number): Seed => ({ id: m.id, rated: true, title: titles[m.id] ?? String(m.id), score10, genres: m.genres, tags: m.tags.filter((t) => t.rank >= 60 && !t.isMediaSpoiler).map((t) => t.name) });
const recsOf = (m: FixtureMedia): { rating: number; media: RawRecoMedia }[] => m.recommendations.nodes.flatMap((n) => (n.mediaRecommendation ? [{ rating: n.rating, media: n.mediaRecommendation }] : []));
const byId = (id: number): FixtureMedia => media.find((m) => m.id === id) as FixtureMedia;

const emptyExclude = () => ({ ids: new Set<number>(), malIds: new Set<number>(), dismissed: new Set<number>(), watchedOrCurrent: new Set<number>() });
const allSeeds = (): Seed[] => [seedOf(byId(154587), 10), seedOf(byId(108465), 9), seedOf(byId(101348), 8), seedOf(byId(140960), 7)];
const allRecs = (): Map<number, { rating: number; media: RawRecoMedia }[]> => new Map(media.map((m) => [m.id, recsOf(m)]));
const NOW = 1_700_000_000_000;

describe('pickSeeds', () => {
  const e = (id: number, status: string, score10: number | null, title = `T${id}`) => ({ id, title, status, score10 });

  it('ne garde que les terminées notées ≥ 7, meilleures d\'abord', () => {
    const { seeds, cold } = pickSeeds([e(1, 'COMPLETED', 7), e(2, 'COMPLETED', 9.5), e(3, 'REPEATING', 8), e(4, 'COMPLETED', 6.5), e(5, 'CURRENT', 10), e(6, 'PLANNING', 9)]);
    expect(seeds.map((s) => s.id)).toEqual([2, 3, 1]);
    expect(seeds[0]).toEqual({ id: 2, title: 'T2', score10: 9.5, rated: true });
    expect(cold).toBe(false);
  });

  it('garde au plus MAX_SEEDS graines', () => {
    const entries = Array.from({ length: 80 }, (_, i) => e(i + 1, 'COMPLETED', 7 + (i % 4) * 0.5));
    expect(pickSeeds(entries).seeds).toHaveLength(MAX_SEEDS);
  });

  it('fusionne deux comptes en gardant la meilleure note', () => {
    const { seeds } = pickSeeds([e(1, 'COMPLETED', 7), e(1, 'COMPLETED', 9), e(2, 'COMPLETED', 8), e(3, 'COMPLETED', 8)]);
    expect(seeds.find((s) => s.id === 1)?.score10).toBe(9);
    expect(seeds.filter((s) => s.id === 1)).toHaveLength(1);
  });

  it('complète avec des terminées non notées (poids 6) jusqu\'à 3', () => {
    const { seeds, cold } = pickSeeds([e(1, 'COMPLETED', 8), e(2, 'COMPLETED', null), e(3, 'COMPLETED', null), e(4, 'COMPLETED', null), e(5, 'COMPLETED', 5)]);
    expect(seeds.map((s) => [s.id, s.score10])).toEqual([[1, 8], [2, 6], [3, 6]]);
    expect(cold).toBe(false);
  });

  it('seule la note est marquée : une graine non notée n\'est pas « rated » (poids 6 gardé pour le score)', () => {
    const { seeds } = pickSeeds([e(1, 'COMPLETED', 8), e(2, 'COMPLETED', null), e(3, 'COMPLETED', null)]);
    expect(seeds.map((s) => [s.id, s.rated])).toEqual([[1, true], [2, false], [3, false]]);
  });

  it('3 terminées toutes notées < 7 : démarrage à froid, pas de lot vide mis en cache', () => {
    const { seeds, cold } = pickSeeds([e(1, 'COMPLETED', 5), e(2, 'COMPLETED', 6), e(3, 'COMPLETED', 4)]);
    expect(seeds).toEqual([]);
    expect(cold).toBe(true);
  });

  it('démarrage à froid avec moins de 3 séries terminées', () => {
    expect(pickSeeds([e(1, 'COMPLETED', 9), e(2, 'COMPLETED', 8), e(3, 'CURRENT', 9)]).cold).toBe(true);
    expect(pickSeeds([]).cold).toBe(true);
  });
});

describe('buildBatch sur la vraie capture AniList', () => {
  it('ne propose jamais une entrée exclue (id, idMal, écartée) ni un titre adulte', () => {
    const exclude = emptyExclude();
    exclude.ids.add(21827);
    exclude.malIds.add(41025);
    exclude.dismissed.add(153518);
    const adult = recsOf(byId(154587));
    const poisoned = new Map(allRecs());
    poisoned.set(154587, [...adult, { rating: 99999, media: { ...adult[0].media, id: 777777, idMal: 777, isAdult: true } }]);
    const ids = buildBatch(allSeeds(), poisoned, exclude, NOW).items.map((i) => i.card.id);
    expect(ids).not.toContain(21827);
    expect(ids).not.toContain(114535);
    expect(ids).not.toContain(153518);
    expect(ids).not.toContain(777777);
    expect(ids).toContain(457);
  });

  it('écarte un candidat dont la suite n\'a pas son préquel vu ou en cours', () => {
    // 108511 (Slime S2) a pour préquel 161802 ; 125367 (Kaguya Ultra Romantic) a pour préquel 112641
    const before = buildBatch(allSeeds(), allRecs(), emptyExclude(), NOW).items.map((i) => i.card.id);
    expect(before).not.toContain(108511);
    expect(before).not.toContain(125367);
    const seen = emptyExclude();
    seen.watchedOrCurrent.add(161802);
    const after = buildBatch(allSeeds(), allRecs(), seen, NOW).items.map((i) => i.card.id);
    expect(after).toContain(108511);
    expect(after).not.toContain(125367);
    // un candidat sans préquel reste proposé
    expect(before).toContain(101280);
  });

  it('un candidat recommandé par deux graines apparaît une fois, score cumulé, raison = plus grosse contribution', () => {
    // Fumetsu no Anata e (114535) est recommandé par Frieren (426 fans) et Vinland Saga (141 fans)
    const batch = buildBatch(allSeeds(), allRecs(), emptyExclude(), NOW);
    const hits = batch.items.filter((i) => i.card.id === 114535);
    expect(hits).toHaveLength(1);
    const alone = buildBatch([seedOf(byId(154587), 10)], new Map([[154587, recsOf(byId(154587))]]), emptyExclude(), NOW).items.find((i) => i.card.id === 114535) as RecoItem;
    expect(hits[0].score).toBeGreaterThan(alone.score);
    expect(hits[0].reason?.seedId).toBe(154587);
    expect(hits[0].reason?.seedTitle).toBe('Frieren');
    expect(hits[0].reason?.seedScore).toBe(10);
    expect(hits[0].reason?.rated).toBe(true);
  });

  it('plus de 60 candidats : 60 gardés, triés par score décroissant', () => {
    const many = Array.from({ length: 80 }, (_, i) => ({ rating: 100 + i, media: { ...recsOf(byId(154587))[0].media, id: 900000 + i, idMal: 900000 + i } }));
    const batch = buildBatch([seedOf(byId(154587), 10)], new Map([[154587, many]]), emptyExclude(), NOW);
    expect(batch.items).toHaveLength(BATCH_SIZE);
    const scores = batch.items.map((i) => i.score);
    expect(scores).toEqual([...scores].sort((a, b) => b - a));
    expect(batch).toMatchObject({ computedAt: NOW, seedCount: 1, cold: false });
  });

  it('raison : au plus 4 éléments communs, genres d\'abord, carte sans plateformes', () => {
    const batch = buildBatch(allSeeds(), allRecs(), emptyExclude(), NOW);
    for (const item of batch.items) {
      const matched = item.reason?.matched ?? [];
      expect(matched.length).toBeLessThanOrEqual(4);
      const genres = matched.filter((m) => item.card.genres.includes(m));
      expect(matched.slice(0, genres.length)).toEqual(genres);
    }
    const card = batch.items[0].card;
    expect(card.platforms).toEqual([]);
    expect(card.title).toBeTruthy();
    expect(card.siteUrl).toMatch(/^https:\/\/anilist\.co\//);
  });
});

describe('drawNext / withoutItem', () => {
  const item = (id: number, score: number): RecoItem => ({ card: { id, idMal: null, title: `T${id}`, format: null, year: null, episodes: null, averageScore: null, genres: [], tags: [], coverUrl: null, coverLarge: null, color: null, bannerUrl: null, siteUrl: '', platforms: [] }, score, reason: null });
  const batch: RecoBatch = { items: [item(1, 10), item(2, 30), item(3, 60)], computedAt: 0, seedCount: 1, cold: false };

  it('ne tire jamais un élément de skip et renvoie null quand tout est épuisé', () => {
    for (const r of [0, 0.3, 0.7, 0.999]) expect(drawNext(batch, new Set([3]), () => r)?.card.id).not.toBe(3);
    expect(drawNext(batch, new Set([1, 2, 3]), () => 0.5)).toBeNull();
    expect(drawNext({ ...batch, items: [] }, new Set(), () => 0.5)).toBeNull();
  });

  it('pondère par le score', () => {
    expect(drawNext(batch, new Set(), () => 0)?.card.id).toBe(1);
    expect(drawNext(batch, new Set(), () => 0.15)?.card.id).toBe(2);
    expect(drawNext(batch, new Set(), () => 0.5)?.card.id).toBe(3);
    expect(drawNext(batch, new Set(), () => 0.9999)?.card.id).toBe(3);
  });

  it('withoutItem retire un seul id sans muter', () => {
    const next = withoutItem(batch, 2);
    expect(next.items.map((i) => i.card.id)).toEqual([1, 3]);
    expect(batch.items).toHaveLength(3);
    expect(next.computedAt).toBe(batch.computedAt);
  });
});
