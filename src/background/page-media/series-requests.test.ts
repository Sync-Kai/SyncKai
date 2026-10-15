import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PageMediaInfo } from '../../shared/page-media.types';
import type { PlatformSignals } from '../../shared/match-signals';
import { STORAGE_KEYS } from '../../protocol/storage-keys';
import { installFakeChrome } from '../../test/fake-chrome';
import { byIdsKey, CATALOG } from '../sync/__corpus__/snapshots';

// Budget de requêtes d'une page de série (bogue du 2026-10-15) : Attack on Titan sur Crunchyroll, panneau ouvert, saison
// changée plusieurs fois dans le menu de la page → « Trop de requêtes à AniList ». Vraie résolution (resolver, page-media,
// listes) sur l'instantané AniList du corpus ; seules les requêtes réseau sont simulées, et comptées par opération.

/** Opérations envoyées (nom de la requête GraphQL, `mal:anime` pour MyAnimeList) */
const sent: string[] = [];
/** Lecture groupée en échec (réseau, limite) */
let failBatch = false;
/** Liste AniList de l'utilisateur : statut par fiche */
const anilistList = new Map<number, 'COMPLETED' | 'CURRENT'>();

const operationOf = (query: string): string => /(?:query|mutation)\s+(\w+)/.exec(query)?.[1] ?? 'anonymous';

function raw(id: number): Record<string, unknown> | null {
  const entry = CATALOG.media.get(id);
  if (!entry) return null;
  const { signals, ...fields } = entry;
  return { ...fields, duration: signals.duration, countryOfOrigin: signals.countryOfOrigin, status: signals.status, endDate: signals.endDate };
}

const pageOf = (ids: readonly number[]): unknown => ({ Page: { media: ids.flatMap((id) => raw(id) ?? []) } });

function entryOf(id: number): Record<string, unknown> | null {
  const status = anilistList.get(id);
  return status ? { id: id * 10, status, progress: status === 'COMPLETED' ? (CATALOG.media.get(id)?.episodes ?? 1) : 1, repeat: 0, score: 0, notes: null } : null;
}

/** Fiche avec l'entrée de liste (MediaEntry, et chaque alias `m<i>` d'une lecture groupée) */
const mediaEntry = (id: number): unknown => ({ id, episodes: CATALOG.media.get(id)?.episodes ?? null, title: { userPreferred: `#${id}` }, mediaListEntry: entryOf(id) });

function answer(query: string, variables: Record<string, unknown>): unknown {
  const operation = operationOf(query);
  sent.push(operation);
  if (operation === 'PageMediaBatch' && failBatch) throw new Error('lot refusé');
  if (operation === 'PageMediaBatch' && Array.isArray(variables.ids)) {
    const withEntries = query.includes('mediaListEntry');
    const ids = variables.ids.filter((id): id is number => typeof id === 'number');
    return { Page: { media: ids.flatMap((id) => { const entry = raw(id); return entry ? [{ ...entry, siteUrl: `https://anilist.co/anime/${id}`, coverImage: null, nextAiringEpisode: null, ...(withEntries ? { mediaListEntry: entryOf(id) } : {}) }] : []; }) } };
  }
  if (operation === 'SaveProgress' && typeof variables.mediaId === 'number') {
    anilistList.set(variables.mediaId, variables.status === 'COMPLETED' ? 'COMPLETED' : 'CURRENT');
    return { SaveMediaListEntry: { status: variables.status, progress: variables.progress, repeat: 0 } };
  }
  if (typeof variables.search === 'string') return pageOf(CATALOG.searches.get(variables.search) ?? []);
  if (Array.isArray(variables.ids)) return pageOf(CATALOG.byIds.get(byIdsKey(variables.ids.filter((id): id is number => typeof id === 'number'))) ?? variables.ids.filter((id): id is number => typeof id === 'number'));
  if (operation === 'ScoreFormat') return { Viewer: { mediaListOptions: { scoreFormat: 'POINT_10' } } };
  if (operation === 'MediaEntry' && typeof variables.id === 'number') return { Media: mediaEntry(variables.id) };
  if (operation === 'MediaEntries') return Object.fromEntries(Object.entries(variables).flatMap(([alias, id]) => (typeof id === 'number' ? [[alias, mediaEntry(id)]] : [])));
  if (operation === 'PageMedia' && typeof variables.id === 'number') {
    const entry = raw(variables.id);
    return { Media: { ...entry, siteUrl: `https://anilist.co/anime/${variables.id}`, coverImage: null, nextAiringEpisode: null } };
  }
  throw new Error(`Requête AniList inattendue : ${operation} ${JSON.stringify(variables)}`);
}

const reply = (query: string, isData: (data: unknown) => boolean, variables: Record<string, unknown> = {}): Promise<unknown> => {
  const data = answer(query, variables);
  return isData(data) ? Promise.resolve(data) : Promise.reject(new Error(`Réponse simulée refusée : ${operationOf(query)} ${JSON.stringify(variables)}`));
};

vi.mock('../anilist/client', () => ({ anilistPublicQuery: reply, anilistQuery: reply }));
vi.mock('../mal/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../mal/client')>()),
  getMalAnime: (malId: number) => {
    sent.push('mal:anime');
    return Promise.resolve({ title: `#${malId}`, episodes: null, entry: null, notes: null });
  },
}));
vi.mock('../../browser/storage/tokens', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../browser/storage/tokens')>()),
  hasValidAniListToken: () => Promise.resolve(true),
  hasMalToken: () => Promise.resolve(true),
}));
vi.mock('../../browser/tokens/access', () => ({ getValidToken: () => Promise.resolve({ accessToken: 'token-a', expiresAt: Number.MAX_SAFE_INTEGER }) }));
vi.mock('../../browser/platform-access', () => ({ hasPlatformAccess: () => Promise.resolve(true) }));

const fake = installFakeChrome();
const { resolvePageMedia, forgetPageResolutions } = await import('./page-media');
const { clearCatalogCache } = await import('../anilist/media');
const { anilistTracker } = await import('../trackers');
const { clearEntryCache } = await import('../trackers/entry-cache');

const AOT = { platform: 'crunchyroll', seriesId: 'GR751KNZY', seriesSlug: 'attack-on-titan', seriesTitle: 'Attack on Titan', kind: 'series', episode: null } as const;
/** Signaux de la série lus par le pont Crunchyroll (année de lancement, durée), comme sur la vraie page */
const SERIES_SIGNALS: PlatformSignals = { seriesYear: 2013, episodeMinutes: 24, format: 'series' };

function season(seasonTitle: string, seasonNumber: number | null, signals: PlatformSignals = SERIES_SIGNALS): PageMediaInfo {
  return { ...AOT, seasonTitle, seasonNumber, signals };
}

/** Première vue (saison 1 affichée), puis les quatre choix du propriétaire dans le menu des saisons */
const FIRST_VIEW = season('Attack on Titan', 1, { ...SERIES_SIGNALS, seasonYear: 2013, seasonEpisodeCount: 27 });
const PICKS = [season('Attack on Titan Season 3', null), season('Attack on Titan Final Season', null), season('Attack on Titan', 1, FIRST_VIEW.signals), season('Attack on Titan: Last Attack', null)];

async function cost(page: PageMediaInfo): Promise<Record<string, number>> {
  const from = sent.length;
  const result = await resolvePageMedia({ page, mediaId: null });
  if (!result.ok) throw new Error(`${result.code} : ${result.message}`);
  return tally(sent.slice(from));
}

function tally(operations: readonly string[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const operation of operations) counts[operation] = (counts[operation] ?? 0) + 1;
  return counts;
}

const anilistRequests = (counts: Record<string, number>): number => Object.entries(counts).reduce((sum, [op, n]) => (op.startsWith('mal:') ? sum : sum + n), 0);

/** Tokens enregistrés (forme chiffrée, jamais déchiffrés ici) : la présence et l'empreinte du compte en dépendent */
const sealed = (data: string): unknown => ({ v: 1, iv: `iv-${data}`, data, expiresAt: Number.MAX_SAFE_INTEGER });

beforeEach(async () => {
  fake.reset();
  clearCatalogCache();
  clearEntryCache();
  forgetPageResolutions();
  sent.length = 0;
  failBatch = false;
  anilistList.clear();
  // Saisons 1 à 3 terminées : la première non terminée est la Final Season
  for (const id of [16498, 20958, 99147, 104578]) anilistList.set(id, 'COMPLETED');
  await chrome.storage.local.set({ [STORAGE_KEYS.anilistToken]: sealed('anilist-a'), [STORAGE_KEYS.malToken]: sealed('mal-a') });
});

const anilistState = (result: Awaited<ReturnType<typeof resolvePageMedia>>): unknown => (result.ok ? result.data.lists.find((list) => list.service === 'anilist') : null);

describe('page de série Attack on Titan : requêtes par changement de saison', () => {
  it('première vue puis quatre choix de saison dans le menu (cas du propriétaire) : 5 requêtes AniList au lieu de 17', async () => {
    // Avant : première vue { SearchAnime, PageMedia, MediaEntry } puis, par choix, recherche de la saison + PageMedia +
    // MediaEntry (3, 3), retour à la saison 1 (1), « Last Attack » sans fiche : recherche + 6 MediaEntry (statuts) = 17
    expect(await cost(FIRST_VIEW)).toEqual({ SearchAnime: 1, PageMediaBatch: 1, 'mal:anime': 1 });
    const picks = [];
    for (const page of PICKS) picks.push(await cost(page));
    // Seule la recherche « série + saison » d'un titre de saison encore jamais cherché part sur AniList
    expect(picks).toEqual([{ SearchAnime: 1, 'mal:anime': 1 }, { SearchAnime: 1, 'mal:anime': 1 }, {}, { SearchAnime: 1 }]);
    expect(anilistRequests(tally(sent))).toBe(5);
  });

  it('écriture sur AniList (synchro, action) : la fiche relue montre la liste à jour', async () => {
    const before = await resolvePageMedia({ page: PICKS[1], mediaId: null });
    expect(before.ok && before.data.media.mediaId).toBe(110277);
    expect(anilistState(before)).toMatchObject({ state: 'not-in-list' });
    await anilistTracker.saveProgress(110277, 5, 'CURRENT');
    const from = sent.length;
    const after = await resolvePageMedia({ page: PICKS[1], mediaId: null });
    expect(sent.slice(from)).toContain('PageMediaBatch');
    expect(anilistState(after)).toMatchObject({ state: 'in-list', status: 'CURRENT', progress: 1 });
  });

  it('autre compte AniList (token remplacé) : aucune entrée de l’ancien compte servie', async () => {
    await resolvePageMedia({ page: FIRST_VIEW, mediaId: null });
    await chrome.storage.local.set({ [STORAGE_KEYS.anilistToken]: sealed('anilist-b') });
    anilistList.clear();
    const from = sent.length;
    const other = await resolvePageMedia({ page: FIRST_VIEW, mediaId: null });
    expect(sent.slice(from)).toContain('PageMediaBatch');
    expect(anilistState(other)).toMatchObject({ state: 'not-in-list' });
  });

  it('lecture groupée refusée (réseau, limite) : la fiche est lue comme avant, une requête par lecture', async () => {
    failBatch = true;
    const result = await resolvePageMedia({ page: FIRST_VIEW, mediaId: null });
    expect(result.ok && result.data.media.mediaId).toBe(16498);
    // Lot tenté une fois (pas de nouvel essai pour la même fiche), puis l'entrée lue seule
    expect(tally(sent)).toMatchObject({ PageMediaBatch: 1, MediaEntry: 1 });
    expect(anilistState(result)).toMatchObject({ state: 'in-list', status: 'COMPLETED' });
  });
});
