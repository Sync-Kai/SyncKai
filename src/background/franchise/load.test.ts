import { beforeEach, describe, expect, it, vi } from 'vitest';
import aot from '../../shared/__fixtures__/franchise/aot.json';
import gundam from '../../shared/__fixtures__/franchise/gundam.json';
import { FRANCHISE_CACHE_TTL_MS, franchiseCacheKey, franchiseRecordKey } from '../../browser/storage/session-cache';
import { installFakeChrome } from '../../test/fake-chrome';
import { franchiseProgress, releaseOrder, type FranchiseGraph, type ListState, type RawMedia } from '../../shared/franchise';
import { PLATFORM_LINKS_KEY } from '../../platforms/links';
import { choosePlatformLink } from '../../shared/watching';

const deps = vi.hoisted(() => ({ anilistPublicQuery: vi.fn() }));
vi.mock('../anilist/client', () => ({ anilistPublicQuery: deps.anilistPublicQuery }));

const fake = installFakeChrome();
const { ApiError } = await import('../errors');
const { loadFranchise } = await import('./load');

interface Fixture {
  rounds: RawMedia[][];
}
const AOT_START = 16498;
const GUNDAM_START = 80;

/** Sert la capture réelle tour par tour : chaque requête doit demander exactement les identifiants du tour */
function serve(fixture: Fixture, gate: (round: number) => Promise<void> = () => Promise.resolve()): void {
  let round = 0;
  deps.anilistPublicQuery.mockImplementation((_query: string, _guard: unknown, variables: { ids: number[] }) => {
    const page = fixture.rounds[round];
    const held = gate(round);
    round += 1;
    expect([...variables.ids].sort()).toEqual(page?.map((m) => m.id).sort());
    return held.then(() => ({ Page: { media: page } }));
  });
}

/** Sert la capture à la demande, quel que soit le départ : chaque entrée demandée y a été lue avec ses relations */
function serveAnyStart(fixture: Fixture): void {
  const byId = new Map(fixture.rounds.flat().map((media) => [media.id, media]));
  deps.anilistPublicQuery.mockImplementation((_query: string, _guard: unknown, variables: { ids: number[] }) => {
    expect(variables.ids.filter((id) => !byId.has(id))).toEqual([]);
    return Promise.resolve({ Page: { media: variables.ids.map((id) => byId.get(id)) } });
  });
}

beforeEach(() => {
  fake.reset();
  deps.anilistPublicQuery.mockReset();
  vi.useRealTimers();
});

describe('loadFranchise', () => {
  it('charge L\'Attaque des Titans en autant de requêtes que de tours, toutes en voie « background »', async () => {
    serve(aot);
    const result = await loadFranchise(AOT_START);
    expect(result.ok).toBe(true);
    expect(deps.anilistPublicQuery).toHaveBeenCalledTimes(aot.rounds.length);
    for (const call of deps.anilistPublicQuery.mock.calls) expect(call[3]).toBe('background');
    if (result.ok) {
      expect(result.graph.capped).toBe(false);
      expect(result.graph.main.length).toBeGreaterThan(3);
    }
  });

  it('la requête porte le complément du premier niveau et perPage 50', async () => {
    serve(aot);
    await loadFranchise(AOT_START);
    const query = deps.anilistPublicQuery.mock.calls[0]?.[0] as string;
    expect(query).toContain('Page(perPage: 50)');
    expect(query).toContain('externalLinks { url }');
    expect(query).toContain('relations { edges { relationType node {');
    // Un seul saut par requête : le niveau imbriqué ne revient jamais rempli, il n'est pas demandé
    expect(query).not.toContain('node { id type }');
  });

  it('une relation dont le nœud est null (permis par le schéma AniList) est ignorée sans faire échouer le parcours', async () => {
    const start = { id: 1, type: 'ANIME', format: 'TV', duration: 24, title: { userPreferred: 'A' }, relations: { edges: [{ relationType: 'SEQUEL', node: null }, { relationType: 'SIDE_STORY', node: { id: 2, type: 'ANIME', format: 'OVA', duration: 24, title: { userPreferred: 'B' } } }] } };
    deps.anilistPublicQuery.mockResolvedValue({ Page: { media: [start] } });
    const result = await loadFranchise(1);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.graph.extras.map((e) => e.id)).toEqual([2]);
  });

  it('une autre entrée de la même franchise est servie par le cache (0 requête)', async () => {
    serve(aot);
    const first = await loadFranchise(AOT_START);
    if (!first.ok) throw new Error('chargement attendu');
    const other = first.graph.main.find((id) => id !== AOT_START);
    if (other === undefined) throw new Error('fixture');
    deps.anilistPublicQuery.mockClear();
    const second = await loadFranchise(other);
    expect(deps.anilistPublicQuery).not.toHaveBeenCalled();
    expect(second).toEqual({ ok: true, graph: first.graph });
  });

  it('un graphe plafonné par les tours est marqué capped et gardé sous l\'identifiant de départ seulement', async () => {
    serve(gundam);
    const result = await loadFranchise(GUNDAM_START, 3);
    if (!result.ok) throw new Error('chargement attendu');
    expect(deps.anilistPublicQuery).toHaveBeenCalledTimes(3);
    expect(result.graph.capped).toBe(true);
    const keys = [...fake.session.data.keys()].filter((k) => k.startsWith('franchise:')).sort();
    expect(keys).toEqual([franchiseCacheKey(GUNDAM_START), franchiseRecordKey(GUNDAM_START)].sort());
  });

  it('Gundam réel : 9 tours, sous le plafond de tours par défaut, graphe complet', async () => {
    serve(gundam);
    const result = await loadFranchise(GUNDAM_START);
    expect(deps.anilistPublicQuery).toHaveBeenCalledTimes(gundam.rounds.length);
    expect(result.ok && result.graph.capped).toBe(false);
  });

  it('ORD-03 : la page du film Gundam III (racine gardée bien que déclarée SUMMARY) ne remplace pas le graphe en cache de Ζ Gundam', async () => {
    const ZETA = 85;
    const GUNDAM_III = 1092;
    serveAnyStart(gundam);
    const watchedTv = new Map<number, ListState>([[GUNDAM_START, { kind: 'watched', progress: null }]]);
    const next = (graph: FranchiseGraph): number | undefined => franchiseProgress(releaseOrder(graph, 'main'), watchedTv).next?.id;
    const zeta = await loadFranchise(ZETA);
    if (!zeta.ok) throw new Error('chargement attendu');
    expect(next(zeta.graph)).toBe(ZETA);
    expect((await loadFranchise(GUNDAM_III)).ok).toBe(true);
    deps.anilistPublicQuery.mockClear();
    const again = await loadFranchise(ZETA);
    if (!again.ok) throw new Error('chargement attendu');
    expect(deps.anilistPublicQuery).not.toHaveBeenCalled();
    expect(again.graph.startId).toBe(ZETA);
    expect(next(again.graph)).toBe(ZETA);
  });

  it('plafond de tours atteint avec la frontière non vide : le départ dérivé que le parent ne déclare pas reste dans les extras', async () => {
    const media = (id: number, format: string, edges: { relationType: string; node: { id: number; type: string; format: string; duration: number; title: { userPreferred: string } } }[]): RawMedia => ({ id, type: 'ANIME', format, duration: 24, title: { userPreferred: `T${id}` }, relations: { edges } });
    const node = (id: number, format: string): { id: number; type: string; format: string; duration: number; title: { userPreferred: string } } => ({ id, type: 'ANIME', format, duration: 24, title: { userPreferred: `T${id}` } });
    // 10 (OVA) n'a que son PARENT 1 ; 1 ne déclare pas 10 mais a une suite 2 : après 2 tours la frontière est [2]
    serve({ rounds: [[media(10, 'OVA', [{ relationType: 'PARENT', node: node(1, 'TV') }])], [media(1, 'TV', [{ relationType: 'SEQUEL', node: node(2, 'TV') }])]] });
    const result = await loadFranchise(10, 2);
    if (!result.ok) throw new Error('chargement attendu');
    expect(result.graph.capped).toBe(true);
    expect(result.graph.main).toEqual([1, 2]);
    expect(result.graph.extras).toEqual([{ id: 10, relation: 'SIDE_STORY', from: 1 }]);
  });

  it('deux appels simultanés pour des entrées d\'une même franchise : un seul parcours', async () => {
    // Le parcours est retenu avant son troisième tour : les identifiants des deux premiers sont déjà lus
    let release = (): void => undefined;
    serve(aot, (round) => (round === 2 ? new Promise<void>((resolve) => (release = resolve)) : Promise.resolve()));
    const second = aot.rounds[1]?.[0]?.id;
    if (second === undefined) throw new Error('fixture');
    const a = loadFranchise(AOT_START);
    await vi.waitFor(() => expect(deps.anilistPublicQuery).toHaveBeenCalledTimes(3));
    const b = loadFranchise(second);
    release();
    const [ra, rb] = await Promise.all([a, b]);
    expect(deps.anilistPublicQuery).toHaveBeenCalledTimes(aot.rounds.length);
    expect(rb).toEqual(ra);
  });

  it('une entrée sur le point d\'être lue (frontière du tour en cours) rejoint aussi le parcours', async () => {
    let release = (): void => undefined;
    serve(aot, (round) => (round === 1 ? new Promise<void>((resolve) => (release = resolve)) : Promise.resolve()));
    const next = aot.rounds[1]?.[0]?.id;
    if (next === undefined) throw new Error('fixture');
    const a = loadFranchise(AOT_START);
    await vi.waitFor(() => expect(deps.anilistPublicQuery).toHaveBeenCalledTimes(2));
    const b = loadFranchise(next);
    release();
    const [ra, rb] = await Promise.all([a, b]);
    expect(deps.anilistPublicQuery).toHaveBeenCalledTimes(aot.rounds.length);
    expect(rb).toEqual(ra);
  });

  it('les liens de plateformes sont remplis depuis externalLinks', async () => {
    const withLink = structuredClone(aot) as Fixture;
    const start = withLink.rounds[0]?.[0];
    if (!start) throw new Error('fixture');
    start.externalLinks = [{ url: 'https://www.crunchyroll.com/series/GR751KNZY/attack-on-titan' }, { url: 'javascript:alert(1)' }];
    serve(withLink);
    const result = await loadFranchise(AOT_START);
    if (!result.ok) throw new Error('chargement attendu');
    expect(result.graph.nodes[AOT_START]?.platforms).toEqual([{ platform: 'crunchyroll', url: 'https://www.crunchyroll.com/series/GR751KNZY/attack-on-titan' }]);
  });

});

describe('loadFranchise : liens appris, identifiant disparu et extras (ORD)', () => {
  it('ORD-01 : un lien ADN appris pour une entrée du graphe sert « Regarder », après un parcours et depuis le cache, sans entrer dans le cache', async () => {
    const S2 = 20958;
    const learnedAdn = 'https://animationdigitalnetwork.com/video/42-l-attaque-des-titans-saison-2';
    fake.local.seed({ [PLATFORM_LINKS_KEY]: { [S2]: { links: { adn: learnedAdn }, updatedAt: 1 } } });
    serve(aot);
    const walked = await loadFranchise(AOT_START);
    if (!walked.ok) throw new Error('chargement attendu');
    expect(choosePlatformLink(walked.graph.nodes[S2] ?? { platforms: [] }, 'adn')?.url).toBe(learnedAdn);
    const cached = await loadFranchise(S2);
    if (!cached.ok) throw new Error('cache attendu');
    expect(deps.anilistPublicQuery).toHaveBeenCalledTimes(aot.rounds.length);
    expect(choosePlatformLink(cached.graph.nodes[S2] ?? { platforms: [] }, 'adn')?.url).toBe(learnedAdn);
    expect(JSON.stringify([...fake.session.data.values()])).not.toContain('animationdigitalnetwork');
  });

  it('ORD-05 : un identifiant qu\'AniList ne renvoie plus (page vide) coûte une requête et échoue', async () => {
    deps.anilistPublicQuery.mockResolvedValue({ Page: { media: [] } });
    const result = await loadFranchise(424242);
    expect(deps.anilistPublicQuery).toHaveBeenCalledTimes(1);
    expect(result.ok).toBe(false);
    expect([...fake.session.data.keys()].filter((k) => k.startsWith('franchise:'))).toEqual([]);
  });

  it('ORD-04 : un extra de L\'Attaque des Titans (OVA) dont la franchise est en cache coûte une requête', async () => {
    const OVA = 18397;
    serve(aot);
    const first = await loadFranchise(AOT_START);
    if (!first.ok) throw new Error('chargement attendu');
    expect(first.graph.extras.some((e) => e.id === OVA)).toBe(true);
    const start = aot.rounds[0]?.[0];
    const ova = start?.relations?.edges?.find((e) => e.node.id === OVA)?.node;
    if (!start || !ova) throw new Error('fixture');
    // Page de l'OVA : seule relation, son PARENT (la saison 1)
    const parent: RawMedia = { ...start, relations: { edges: [] } };
    deps.anilistPublicQuery.mockReset();
    deps.anilistPublicQuery.mockResolvedValue({ Page: { media: [{ ...ova, relations: { edges: [{ relationType: 'PARENT', node: parent }] } }] } });
    const extra = await loadFranchise(OVA);
    expect(deps.anilistPublicQuery).toHaveBeenCalledTimes(1);
    expect(extra.ok && extra.graph.main).toEqual(first.graph.main);
    deps.anilistPublicQuery.mockClear();
    expect((await loadFranchise(OVA)).ok).toBe(true);
    expect(deps.anilistPublicQuery).not.toHaveBeenCalled();
  });

  it('ORD-04 : ouvrir un extra ne prolonge pas le cache de la franchise (graphe à T, extra à T+23 h, relu à T+24 h + 1 min)', async () => {
    const OVA = 18397;
    const T = 1_800_000_000_000;
    const HOUR = 3_600_000;
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(T);
    const start = aot.rounds[0]?.[0];
    const ova = start?.relations?.edges?.find((e) => e.node.id === OVA)?.node;
    if (!start || !ova) throw new Error('fixture');
    const withOva: Fixture = { rounds: [...aot.rounds, [{ ...ova, relations: { edges: [{ relationType: 'PARENT', node: { ...start, relations: { edges: [] } } }] } }]] };
    serveAnyStart(withOva);
    expect((await loadFranchise(AOT_START)).ok).toBe(true);
    vi.setSystemTime(T + 23 * HOUR);
    deps.anilistPublicQuery.mockClear();
    expect((await loadFranchise(OVA)).ok).toBe(true);
    expect(deps.anilistPublicQuery).toHaveBeenCalledTimes(1);
    vi.setSystemTime(T + FRANCHISE_CACHE_TTL_MS + 60_000);
    deps.anilistPublicQuery.mockClear();
    expect((await loadFranchise(OVA)).ok).toBe(true);
    expect(deps.anilistPublicQuery.mock.calls.length).toBeGreaterThan(1);
  });

});

describe('loadFranchise : erreurs et expiration', () => {
  it('requête refusée : { ok: false } avec le message de l\'erreur, rien en cache', async () => {
    deps.anilistPublicQuery.mockRejectedValue(new ApiError('RATE_LIMITED', 'Trop de requêtes'));
    expect(await loadFranchise(AOT_START)).toEqual({ ok: false, message: 'Trop de requêtes' });
    expect([...fake.session.data.keys()].filter((k) => k.startsWith('franchise:'))).toEqual([]);
  });

  it('erreur inattendue : message traduit du panneau, rien en cache', async () => {
    deps.anilistPublicQuery.mockRejectedValue(new TypeError('boom'));
    const result = await loadFranchise(AOT_START);
    expect(result).toEqual({ ok: false, message: expect.stringContaining('watch order') });
    expect(fake.session.data.size).toBe(0);
  });

  it('une entrée expirée est relue', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(1_800_000_000_000);
    serve(aot);
    await loadFranchise(AOT_START);
    deps.anilistPublicQuery.mockClear();
    vi.setSystemTime(1_800_000_000_000 + FRANCHISE_CACHE_TTL_MS + 1);
    serve(aot);
    await loadFranchise(AOT_START);
    expect(deps.anilistPublicQuery).toHaveBeenCalledTimes(aot.rounds.length);
  });
});

describe('cache de la franchise', () => {
  const franchiseKeys = (): string[] => [...fake.session.data.keys()].filter((k) => k.startsWith('franchise:')).sort();

  it('un seul enregistrement du graphe, un pointeur par entrée principale', async () => {
    serve(aot);
    const result = await loadFranchise(AOT_START);
    if (!result.ok) throw new Error('chargement attendu');
    const main = [...new Set([AOT_START, ...result.graph.main])];
    expect(franchiseKeys()).toEqual([...main.map(franchiseCacheKey), franchiseRecordKey(AOT_START)].sort());
    expect(fake.session.peek(franchiseCacheKey(main[1]))).toEqual({ at: expect.any(Number), graphId: AOT_START });
    expect(JSON.stringify([...fake.session.data.values()]).split('"nodes"').length - 1).toBe(1);
  });

  it('un enregistrement tronqué ou illisible : échec de lecture, nouveau parcours', async () => {
    serve(aot);
    await loadFranchise(AOT_START);
    fake.session.data.set(franchiseRecordKey(AOT_START), { at: Date.now(), value: { startId: AOT_START } });
    deps.anilistPublicQuery.mockClear();
    serve(aot);
    const result = await loadFranchise(AOT_START);
    expect(result.ok).toBe(true);
    expect(deps.anilistPublicQuery).toHaveBeenCalledTimes(aot.rounds.length);
  });

  it('un pointeur sans enregistrement : échec de lecture', async () => {
    fake.session.data.set(franchiseCacheKey(AOT_START), { at: Date.now(), graphId: AOT_START });
    serve(aot);
    expect((await loadFranchise(AOT_START)).ok).toBe(true);
    expect(deps.anilistPublicQuery).toHaveBeenCalledTimes(aot.rounds.length);
  });

  it('écriture refusée (quota) : la réponse du parcours est tout de même renvoyée', async () => {
    vi.spyOn(fake.session, 'set').mockRejectedValueOnce(new Error('QUOTA_BYTES'));
    serve(aot);
    const result = await loadFranchise(AOT_START);
    expect(result.ok).toBe(true);
    expect(franchiseKeys()).toEqual([]);
  });

  it('sans storage.session : cache mémoire du service worker', async () => {
    const session = Reflect.get(chrome.storage, 'session') as unknown;
    Reflect.deleteProperty(chrome.storage, 'session');
    try {
      serve(aot);
      const first = await loadFranchise(AOT_START);
      deps.anilistPublicQuery.mockClear();
      const second = await loadFranchise(AOT_START);
      expect(deps.anilistPublicQuery).not.toHaveBeenCalled();
      expect(second).toEqual(first);
    } finally {
      Reflect.set(chrome.storage, 'session', session);
    }
  });
});
