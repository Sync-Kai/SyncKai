import { t } from '../../i18n';
import { isRecord } from '../../shared/guards';
import { toSafeImageUrl, toSafeUrl } from '../../shared/url';
import { anilistPublicQuery } from './client';
import type { RequestLane } from '../rate-limit';
import { ApiError } from '../errors';
import { parseNextEpisode, toAiringStatus } from './watching';
import type { PageMediaDetails } from '../../shared/page-media.types';

/** Fiche AniList normalisée (les champs absents de l'API deviennent null / []) */
export interface AniListMedia {
  id: number;
  /** Identifiant MyAnimeList de la même fiche (null si AniList ne le connaît pas) */
  idMal: number | null;
  format: string | null;
  episodes: number | null;
  startDate: { year: number | null; month: number | null; day: number | null } | null;
  /** Titre préféré de l'utilisateur (réglage AniList), pour l'affichage */
  displayTitle: string;
  titles: string[];
  year: number | null;
  coverUrl: string | null;
  externalLinkUrls: string[];
  relations: { relationType: string | null; id: number; type: string | null; format: string | null }[];
  // Signaux comparés à ceux de la plateforme (concordance.ts) ; toujours renseignés par parseMedia (null si absents),
  // facultatifs pour les fiches construites ailleurs (tests, anciennes données)
  /** Durée d'un épisode (minutes), null si inconnue */
  duration?: number | null;
  /** Pays d'origine (JP, CN, KR, TW…) */
  countryOfOrigin?: string | null;
  /** FINISHED, RELEASING, NOT_YET_RELEASED, CANCELLED, HIATUS */
  status?: string | null;
  endDate?: { year: number | null; month: number | null; day: number | null } | null;
}

const MEDIA_FIELDS = /* GraphQL */ `
  id
  idMal
  format
  episodes
  startDate { year month day }
  seasonYear
  coverImage { medium }
  title { romaji english native userPreferred }
  synonyms
  externalLinks { url }
  relations { edges { relationType node { id type format } } }
  duration
  countryOfOrigin
  status
  endDate { year month day }
`;

const SEARCH_QUERY = /* GraphQL */ `
  query SearchAnime($search: String!) {
    Page(perPage: 20) {
      media(search: $search, type: ANIME) { ${MEDIA_FIELDS} }
    }
  }
`;

const BY_IDS_QUERY = /* GraphQL */ `
  query AnimeByIds($ids: [Int]) {
    Page(perPage: 50) {
      media(id_in: $ids, type: ANIME) { ${MEDIA_FIELDS} }
    }
  }
`;

// ─── Parsing défensif de la réponse brute ─────────────────────────────────

const str = (v: unknown): string | null => (typeof v === 'string' ? v : null);
const num = (v: unknown): number | null => (typeof v === 'number' ? v : null);
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

function parseMedia(value: unknown): AniListMedia | null {
  if (!isRecord(value) || typeof value.id !== 'number') return null;

  const title = isRecord(value.title) ? value.title : {};
  const start = isRecord(value.startDate) ? value.startDate : null;
  const end = isRecord(value.endDate) ? value.endDate : null;
  const titles = [title.romaji, title.english, title.native, title.userPreferred, ...arr(value.synonyms)];
  const cover = isRecord(value.coverImage) ? value.coverImage : {};

  return {
    id: value.id,
    idMal: num(value.idMal),
    format: str(value.format),
    episodes: num(value.episodes),
    startDate: start ? { year: num(start.year), month: num(start.month), day: num(start.day) } : null,
    displayTitle: str(title.userPreferred) ?? str(title.romaji) ?? str(title.english) ?? `#${value.id}`,
    year: num(value.seasonYear) ?? (start ? num(start.year) : null),
    coverUrl: toSafeImageUrl(str(cover.medium)),
    titles: [...new Set(titles.filter((t): t is string => typeof t === 'string' && t.length > 0))],
    externalLinkUrls: arr(value.externalLinks).flatMap((l) => (isRecord(l) && typeof l.url === 'string' ? [l.url] : [])),
    relations: arr(isRecord(value.relations) ? value.relations.edges : []).flatMap((edge) => {
      if (!isRecord(edge) || !isRecord(edge.node) || typeof edge.node.id !== 'number') return [];
      return [{ relationType: str(edge.relationType), id: edge.node.id, type: str(edge.node.type), format: str(edge.node.format) }];
    }),
    duration: num(value.duration),
    countryOfOrigin: str(value.countryOfOrigin),
    status: str(value.status),
    endDate: end ? { year: num(end.year), month: num(end.month), day: num(end.day) } : null,
  };
}

interface PageData {
  Page: { media: unknown[] };
}

function isPageData(data: unknown): data is PageData {
  return isRecord(data) && isRecord(data.Page) && Array.isArray(data.Page.media);
}

function parsePage(data: PageData): AniListMedia[] {
  return data.Page.media.map(parseMedia).filter((m): m is AniListMedia => m !== null);
}

// ─── API ──────────────────────────────────────────────────────────────────

/**
 * Fiches du catalogue (recherche, fiches par identifiant, avec leurs liens et relations) gardées quelques minutes dans le
 * service worker, et une seule requête en vol par clé : l'analyse de l'historique Crunchyroll interroge la même série
 * pour chacune de ses saisons (One Piece : 20 saisons → une seule recherche « One Piece ») ; la fiche de la page
 * (popup, panneau, arcs de One Piece parcourus sur Netflix), la lecture puis la synchro d'un épisode relisent les mêmes
 * fiches. Données publiques du catalogue uniquement (jamais les listes de l'utilisateur, toujours lues fraîches).
 * Requêtes interactives : 5 min (un lien AniList ajouté est vu au plus tard 5 min après) ; de fond : 10 min.
 *
 * Deuxième niveau, par fiche (`mediaCache`) : toute fiche reçue, par une recherche comme par identifiant, y est rangée ;
 * `getAnimeByIds` ne demande à AniList que les identifiants qui manquent (un id absent de la réponse, fiche supprimée
 * ou fusionnée, est retenu comme absent pendant le même délai).
 */
export const CATALOG_CACHE_TTL_MS: Readonly<Record<RequestLane, number>> = { interactive: 5 * 60_000, background: 10 * 60_000 };
const CATALOG_CACHE_MAX = 300;
const catalogCache = new Map<string, { at: number; media: AniListMedia[] }>();
const catalogInFlight = new Map<string, Promise<AniListMedia[]>>();
const MEDIA_CACHE_MAX = 1500;
/** Fiches par identifiant ; `media: null` : identifiant absent du catalogue */
const mediaCache = new Map<number, { at: number; media: AniListMedia | null }>();

function rememberMedia(id: number, media: AniListMedia | null, at: number): void {
  mediaCache.delete(id);
  mediaCache.set(id, { at, media });
  // Plus ancienne fiche retirée au-delà de la limite (ordre d'insertion de la Map)
  if (mediaCache.size > MEDIA_CACHE_MAX) mediaCache.delete(mediaCache.keys().next().value ?? 0);
}

function isMediaCached(id: number, lane: RequestLane, now: number): boolean {
  const hit = mediaCache.get(id);
  return hit !== undefined && now - hit.at < CATALOG_CACHE_TTL_MS[lane];
}

/** Vide le cache du catalogue (tests) */
export function clearCatalogCache(): void {
  catalogCache.clear();
  catalogInFlight.clear();
  mediaCache.clear();
}

async function cachedPage(key: string, lane: RequestLane, load: () => Promise<AniListMedia[]>): Promise<AniListMedia[]> {
  const now = Date.now();
  const hit = catalogCache.get(key);
  if (hit && now - hit.at < CATALOG_CACHE_TTL_MS[lane]) return hit.media;
  const pending = catalogInFlight.get(key);
  if (pending) return pending;
  const request = load()
    .then((media) => {
      catalogCache.delete(key);
      const at = Date.now();
      catalogCache.set(key, { at, media });
      for (const item of media) rememberMedia(item.id, item, at);
      // Plus ancienne entrée retirée au-delà de la limite (ordre d'insertion de la Map)
      if (catalogCache.size > CATALOG_CACHE_MAX) catalogCache.delete(catalogCache.keys().next().value ?? '');
      return media;
    })
    .finally(() => catalogInFlight.delete(key));
  catalogInFlight.set(key, request);
  return request;
}

/** `lane` : 'background' pour les tâches de fond (budget limité et cache court, voir rate-limit.ts) */
export async function searchAnime(search: string, lane: RequestLane = 'interactive'): Promise<AniListMedia[]> {
  return cachedPage(`search:${search.toLowerCase()}`, lane, async () => parsePage(await anilistPublicQuery(SEARCH_QUERY, isPageData, { search }, lane)));
}

/**
 * Recherches réunies dans UNE requête GraphQL (un alias `s{i}` par titre, mêmes champs et même page de 20 résultats que
 * searchAnime) : import de l'historique Netflix, une recherche par titre de l'historique. Complexité mesurée le 2026-10-14
 * (avec duration, countryOfOrigin, status, endDate) : 35 par recherche (28 avant), plafond AniList 500 (18 alias :
 * « Max query complexity should be 500 but got 630 ») → 14 au plus, 10 gardé (350).
 */
export const MAX_SEARCH_BATCH = 10;

function batchQuery(count: number): string {
  const variables = Array.from({ length: count }, (_, i) => `$s${i}: String!`).join(', ');
  const pages = Array.from({ length: count }, (_, i) => `s${i}: Page(perPage: 20) { media(search: $s${i}, type: ANIME) { ${MEDIA_FIELDS} } }`).join('\n');
  return `query SearchAnimeBatch(${variables}) {\n${pages}\n}`;
}

function batchGuard(count: number): (data: unknown) => data is Record<string, PageData['Page']> {
  return (data: unknown): data is Record<string, PageData['Page']> =>
    isRecord(data) && Array.from({ length: count }, (_, i) => data[`s${i}`]).every((page) => isRecord(page) && Array.isArray(page.media));
}

/**
 * Résultats de searchAnime pour chaque titre (clé : titre tel que demandé), servis par le même cache : un titre déjà
 * cherché ne coûte rien, les autres partent par paquets de MAX_SEARCH_BATCH, et l'analyse qui recherche ensuite le même
 * titre (searchAnime) trouve le résultat en cache.
 */
export async function searchAnimeBatch(searches: readonly string[], lane: RequestLane = 'background'): Promise<Map<string, AniListMedia[]>> {
  const keyOf = (search: string): string => `search:${search.toLowerCase()}`;
  const now = Date.now();
  const unique = [...new Map(searches.map((search) => [keyOf(search), search])).values()];
  const missing = unique.filter((search) => {
    const hit = catalogCache.get(keyOf(search));
    return !(hit && now - hit.at < CATALOG_CACHE_TTL_MS[lane]) && !catalogInFlight.has(keyOf(search));
  });
  const pending = new Map<string, Promise<AniListMedia[]>>();
  for (let start = 0; start < missing.length; start += MAX_SEARCH_BATCH) {
    const chunk = missing.slice(start, start + MAX_SEARCH_BATCH);
    const variables = Object.fromEntries(chunk.map((search, i) => [`s${i}`, search]));
    const batch = anilistPublicQuery(batchQuery(chunk.length), batchGuard(chunk.length), variables, lane);
    chunk.forEach((search, i) => {
      // Même entrée de cache (et même requête en vol) que searchAnime(search)
      pending.set(keyOf(search), cachedPage(keyOf(search), lane, async () => parsePage({ Page: (await batch)[`s${i}`] ?? { media: [] } })));
    });
  }
  const results = await Promise.all(unique.map(async (search) => [keyOf(search), await (pending.get(keyOf(search)) ?? searchAnime(search, lane))] as const));
  const byKey = new Map(results);
  return new Map(searches.map((search) => [search, byKey.get(keyOf(search)) ?? []]));
}

/** Fiches par identifiant : celles déjà connues (recherches et lectures précédentes) ne sont pas redemandées */
export async function getAnimeByIds(ids: readonly number[], lane: RequestLane = 'interactive'): Promise<AniListMedia[]> {
  const wanted = [...new Set(ids)];
  if (wanted.length === 0) return [];
  const now = Date.now();
  const missing = wanted.filter((id) => !isMediaCached(id, lane, now));
  const key = `ids:${[...missing].sort((a, b) => a - b).join(',')}`;
  const fetched =
    missing.length === 0
      ? []
      : await cachedPage(key, lane, async () => {
          const media = parsePage(await anilistPublicQuery(BY_IDS_QUERY, isPageData, { ids: missing }, lane));
          // Absents de la réponse : fiches supprimées ou fusionnées, retenues comme telles (pas de nouvelle requête à chaque lecture)
          const found = new Set(media.map((item) => item.id));
          const at = Date.now();
          for (const id of missing) if (!found.has(id)) rememberMedia(id, null, at);
          return media;
        });
  const byId = new Map(fetched.map((item) => [item.id, item]));
  return wanted.flatMap((id) => {
    const media = byId.get(id) ?? mediaCache.get(id)?.media ?? null;
    return media ? [media] : [];
  });
}

function isMediaData(data: unknown): data is { Media: unknown } {
  return isRecord(data) && isRecord(data.Media);
}

// ─── Fiche de la page (carte « Sur cette page ») ──────────────────────────

const DETAILS_QUERY = /* GraphQL */ `
  query PageMedia($id: Int!) {
    Media(id: $id, type: ANIME) {
      id
      idMal
      siteUrl
      format
      episodes
      status
      seasonYear
      startDate { year }
      title { userPreferred romaji english }
      coverImage { large medium }
      nextAiringEpisode { episode airingAt }
    }
  }
`;

/** Fiche détaillée pour la carte « Sur cette page » (catalogue public, sans compte requis). */
export async function getPageMediaDetails(id: number): Promise<PageMediaDetails> {
  const { Media: media } = await anilistPublicQuery(DETAILS_QUERY, isMediaData, { id });
  if (!isRecord(media) || typeof media.id !== 'number') throw new ApiError('INVALID_RESPONSE', t('api.invalidResponse.anilist'));
  const title = isRecord(media.title) ? media.title : {};
  const cover = isRecord(media.coverImage) ? media.coverImage : {};
  const start = isRecord(media.startDate) ? media.startDate : {};
  return {
    mediaId: media.id,
    idMal: num(media.idMal),
    title: str(title.userPreferred) ?? str(title.romaji) ?? str(title.english) ?? `#${media.id}`,
    coverUrl: toSafeImageUrl(str(cover.large) ?? str(cover.medium)),
    episodes: num(media.episodes),
    format: str(media.format),
    year: num(media.seasonYear) ?? num(start.year),
    airingStatus: toAiringStatus(media.status),
    nextEpisode: parseNextEpisode(media.nextAiringEpisode),
    siteUrl: toSafeUrl(str(media.siteUrl), 'anilist.co') ?? `https://anilist.co/anime/${media.id}`,
  };
}
