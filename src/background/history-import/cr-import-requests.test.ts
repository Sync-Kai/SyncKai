import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { HistorySeason } from '../../platforms/crunchyroll/history';
import { CR_IMPORT_KEYS, isCrImportJob, isCrImportPlan, type CrImportJob, type CrImportPlan } from '../../shared/cr-import';
import { STORAGE_KEYS } from '../../protocol/storage-keys';
import { installFakeChrome } from '../../test/fake-chrome';
import type { TrackerService } from '../ports/tracker';
import type { MediaMapping } from '../../shared/sync.types';
import { mappingKey } from '../../platforms/series-identity';

// Requêtes AniList de l'analyse d'un historique Crunchyroll (PERF-10) : vraie analyse (cr-import), vrai résolveur, vrai
// catalogue (cache, recherches groupées) ; seules les réponses d'AniList sont simulées, et comptées par opération.
// Même analyse avec et sans pré-chargement des recherches : aperçus identiques, beaucoup moins de requêtes.

const prefetch = vi.hoisted(() => ({ enabled: true, revalidate: true, cachedKeys: new Set<string>() }));
vi.mock('../sync/resolver', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../sync/resolver')>();
  return {
    ...actual,
    // Sans revalidation, les saisons à correspondance en cache ne sont pas pré-chargées (willSearch d'avant 1-D10)
    prefetchCandidates: (...[episodes, lane]: Parameters<typeof actual.prefetchCandidates>) =>
      prefetch.enabled ? actual.prefetchCandidates(prefetch.revalidate ? episodes : episodes.filter((e) => !prefetch.cachedKeys.has(mappingKey(e))), lane) : Promise.resolve(),
    // Sans revalidation (comportement d'avant 1-D10) : correspondance en cache appliquée sans requête
    resolveEpisode: (...[episode, options]: Parameters<typeof actual.resolveEpisode>) => actual.resolveEpisode(episode, prefetch.revalidate ? options : { ...options, revalidateCache: false }),
  };
});

// ─── Faux catalogue AniList ───────────────────────────────────────────────
// Série i : fiche 10000+i liée à la série Crunchyroll ; i % 4 = 0 : suite 20000+i (absente de la recherche du titre,
// trouvée par la recherche « série + saison » ou par les relations) ; i % 5 = 0 : titre accentué sur Crunchyroll (la
// recherche accentuée ne trouve rien, celle sans accents trouve la fiche) ; i % 7 = 0 : fiche sans lien (titre seul,
// slug cherché en dernier).

const sent: string[] = [];
const operationOf = (query: string): string => /(?:query|mutation)\s+(\w+)/.exec(query)?.[1] ?? 'anonymous';

const seriesId = (i: number): string => `GRS${String(i).padStart(4, '0')}`;
const crTitle = (i: number): string => (i % 5 === 0 ? `Séries ${i}` : `Series ${i}`);

function rawMedia(id: number): Record<string, unknown> | null {
  const i = id % 10_000;
  const sequel = id >= 20_000;
  if (i === 0 || (sequel && i % 4 !== 0)) return null;
  return {
    id,
    idMal: id + 1,
    format: 'TV',
    episodes: 12,
    startDate: { year: sequel ? 2016 : 2014, month: 1, day: 1 },
    seasonYear: sequel ? 2016 : 2014,
    coverImage: { medium: null },
    title: { romaji: sequel ? `Series ${i} Season 2` : `Series ${i}`, english: null, native: null, userPreferred: sequel ? `Series ${i} Season 2` : `Series ${i}` },
    synonyms: [],
    externalLinks: !sequel && i % 7 !== 0 ? [{ url: `https://www.crunchyroll.com/series/${seriesId(i)}` }] : [],
    relations: { edges: i % 4 === 0 ? [{ relationType: sequel ? 'PREQUEL' : 'SEQUEL', node: { id: sequel ? 10_000 + i : 20_000 + i, type: 'ANIME', format: 'TV' } }] : [] },
    duration: 24,
    countryOfOrigin: 'JP',
    status: 'FINISHED',
    endDate: { year: sequel ? 2016 : 2014, month: 3, day: 30 },
  };
}

/** Résultats d'une recherche : titre exact de la série (sans accents) ou « série + Season 2 » */
function search(text: string): Record<string, unknown>[] {
  const season2 = /^series (\d+) season 2$/i.exec(text);
  if (season2) return [rawMedia(20_000 + Number(season2[1]))].filter((m) => m !== null);
  const series = /^series (\d+)$/i.exec(text);
  return series ? [rawMedia(10_000 + Number(series[1]))].filter((m) => m !== null) : [];
}

function answer(query: string, variables: Record<string, unknown>): unknown {
  const operation = operationOf(query);
  sent.push(operation);
  if (operation === 'SearchAnime' && typeof variables.search === 'string') return { Page: { media: search(variables.search) } };
  if (operation === 'SearchAnimeBatch') return Object.fromEntries(Object.entries(variables).map(([alias, text]) => [alias, { media: typeof text === 'string' ? search(text) : [] }]));
  if (operation === 'AnimeByIds' && Array.isArray(variables.ids)) return { Page: { media: variables.ids.flatMap((id) => (typeof id === 'number' ? (rawMedia(id) ?? []) : [])) } };
  throw new Error(`Requête AniList inattendue : ${operation} ${JSON.stringify(variables)}`);
}

const reply = (query: string, isData: (data: unknown) => boolean, variables: Record<string, unknown> = {}): Promise<unknown> => {
  const data = answer(query, variables);
  return isData(data) ? Promise.resolve(data) : Promise.reject(new Error(`Réponse simulée refusée : ${operationOf(query)}`));
};

vi.mock('../anilist/client', () => ({ anilistPublicQuery: reply, anilistQuery: reply }));
const connected = vi.hoisted(() => ({ trackers: [] as TrackerService[] }));
vi.mock('../trackers', () => ({ getConnectedTrackers: async (): Promise<TrackerService[]> => connected.trackers }));
vi.mock('../anilist/full-list', () => ({ fetchAniListFullList: async () => [] }));
vi.mock('../mal/full-list', () => ({ fetchMalFullList: async () => [] }));
vi.mock('../../browser/badge', () => ({ refreshReviewBadge: async () => undefined }));

const fake = installFakeChrome();
const { startCrAnalyze } = await import('./cr-import');
const { clearCatalogCache } = await import('../anilist/media');

const OPEN_SESSIONS = { [STORAGE_KEYS.anilistToken]: { accessToken: 'anilist', expiresAt: Number.MAX_SAFE_INTEGER } };

// ─── Historique ───────────────────────────────────────────────────────────

function historySeason(i: number, seasonNumber: number): HistorySeason {
  return {
    seriesId: seriesId(i),
    seriesTitle: crTitle(i),
    seriesSlug: i % 7 === 0 ? `series-${i}-slug` : null,
    seasonId: `GSS${String(i).padStart(4, '0')}${seasonNumber}`,
    seasonNumber,
    seasonTitle: seasonNumber === 2 ? 'Season 2' : crTitle(i),
    episodeId: `GES${String(i).padStart(4, '0')}${seasonNumber}`,
    episodeTitle: null,
    episodeNumber: 3,
    seasonEpisodeNumber: 3,
    watchedCount: 3,
    lastPlayedAt: 1,
  };
}

/** `series` séries distinctes ; une sur trois avec aussi sa saison 2 */
function history(series: number): HistorySeason[] {
  return Array.from({ length: series }, (_, k) => k + 1).flatMap((i) => (i % 3 === 0 ? [historySeason(i, 1), historySeason(i, 2)] : [historySeason(i, 1)]));
}

function storedJob(): CrImportJob | null {
  const value = fake.local.peek(CR_IMPORT_KEYS.job);
  return isCrImportJob(value) ? value : null;
}

async function analyze(seasons: HistorySeason[], mappings: Record<string, MediaMapping> = {}): Promise<{ plan: CrImportPlan; requests: Record<string, number> }> {
  fake.reset({ ...OPEN_SESSIONS, ...(Object.keys(mappings).length > 0 ? { [STORAGE_KEYS.mediaMappings]: mappings } : {}) });
  clearCatalogCache();
  sent.length = 0;
  const started = await startCrAnalyze({ history: { seasons, stats: { items: seasons.length, pages: 1, partial: false } }, platform: 'crunchyroll' });
  expect(started.ok).toBe(true);
  await vi.waitFor(() => expect(storedJob()?.status).toBe('done'), { timeout: 20_000 });
  const plan = fake.local.peek(CR_IMPORT_KEYS.plan);
  if (!isCrImportPlan(plan)) throw new Error('aperçu absent');
  const requests: Record<string, number> = {};
  for (const operation of sent) requests[operation] = (requests[operation] ?? 0) + 1;
  return { plan: { ...plan, builtAt: 0 }, requests };
}

const total = (requests: Record<string, number>): number => Object.values(requests).reduce((sum, n) => sum + n, 0);

beforeEach(() => {
  connected.trackers = [{ id: 'anilist', isConnected: async () => true } as TrackerService];
  vi.spyOn(console, 'info').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  prefetch.enabled = true;
  prefetch.revalidate = true;
  prefetch.cachedKeys = new Set();
  vi.restoreAllMocks();
});

describe('analyse de l’historique Crunchyroll : recherches AniList groupées (PERF-10)', () => {
  // 30 séries = 40 saisons, 120 séries = 160 saisons. Sans pré-chargement : une requête par recherche distincte (titre,
  // « série + Season 2 », titre sans accents, slug) et une par suite manquante. Avec : les recherches de chaque étape d'une
  // tranche de 30 saisons réunies par 10 (≈ recherches / 10, plus une requête partielle par étape et par tranche), les suites
  // manquantes d'une étape en une requête.
  it.each([
    { series: 30, single: { SearchAnime: 51, AnimeByIds: 6 }, batched: { SearchAnimeBatch: 6, AnimeByIds: 2 } },
    { series: 120, single: { SearchAnime: 202, AnimeByIds: 26 }, batched: { SearchAnimeBatch: 25, AnimeByIds: 12 } },
  ])('$series séries distinctes : mêmes correspondances, recherches réunies par 10 au lieu d’une requête chacune', async ({ series, single, batched }) => {
    prefetch.enabled = false;
    const before = await analyze(history(series));
    prefetch.enabled = true;
    const after = await analyze(history(series));

    // Aperçu identique (éléments, à vérifier, échecs) : le pré-chargement ne change aucune décision
    expect(after.plan).toEqual(before.plan);
    expect(before.plan.items.length).toBeGreaterThan(series / 2);
    expect(before.requests).toEqual(single);
    // Plus aucune recherche seule : toutes servies par le cache rempli par les lots
    expect(after.requests).toEqual(batched);
    expect(batched.SearchAnimeBatch).toBeLessThanOrEqual(Math.ceil(single.SearchAnime / 10) + 4);
    expect(total(after.requests)).toBeLessThan(total(before.requests) / 5);
  }, 30_000);
});

describe('analyse avec correspondances en cache : revalidation (1-D10)', () => {
  // Deuxième import du même historique : chaque saison sûre a sa correspondance apprise. Avant 1-D10 : appliquée sans aucune
  // requête (seules les saisons sans correspondance cherchent) ; depuis : nouvelle résolution de chaque saison, recherches
  // réunies par lots avec les autres, comme une première analyse.
  it('30 séries déjà importées : même aperçu, coût d’une première analyse (8 requêtes au lieu de 7)', async () => {
    const first = await analyze(history(30));
    const mappings = Object.fromEntries(first.plan.items.flatMap((item) => item.mappings.map(({ key, mapping }) => [key, mapping] as const)));
    expect(Object.keys(mappings).length).toBeGreaterThan(20);

    prefetch.revalidate = false;
    prefetch.cachedKeys = new Set(Object.keys(mappings));
    const before = await analyze(history(30), mappings);
    prefetch.revalidate = true;
    const after = await analyze(history(30), mappings);

    expect(after.plan).toEqual(before.plan);
    expect(after.plan.items.flatMap((item) => item.mappings.filter((m) => m.replaces !== undefined))).toEqual([]);
    // Saisons « À vérifier » (sans correspondance) cherchées dans les deux cas : la revalidation ajoute une requête par identifiants
    expect(before.requests).toEqual({ SearchAnimeBatch: 6, AnimeByIds: 1 });
    expect(after.requests).toEqual({ SearchAnimeBatch: 6, AnimeByIds: 2 });
    expect(after.requests).toEqual(first.requests);
  }, 30_000);
});