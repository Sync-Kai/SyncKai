import { t } from '../../i18n';
import { isRecord } from '../../shared/guards';
import { toSafeImageUrl, toSafeUrl } from '../../shared/url';
import { anilistPublicQuery } from './client';
import type { RequestLane } from './rate-limit';
import { ApiError } from './errors';
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
 * Résultats des requêtes de fond gardés quelques minutes : l'analyse de l'historique Crunchyroll interroge la
 * même série pour chacune de ses saisons (One Piece : 20 saisons → une seule recherche « One Piece »).
 * Les requêtes interactives restent toujours fraîches.
 */
const BACKGROUND_CACHE_TTL_MS = 10 * 60_000;
const BACKGROUND_CACHE_MAX = 300;
const backgroundCache = new Map<string, { at: number; media: AniListMedia[] }>();

async function cachedPage(key: string, lane: RequestLane, load: () => Promise<AniListMedia[]>): Promise<AniListMedia[]> {
  if (lane !== 'background') return load();
  const now = Date.now();
  const hit = backgroundCache.get(key);
  if (hit && now - hit.at < BACKGROUND_CACHE_TTL_MS) return hit.media;
  const media = await load();
  backgroundCache.delete(key);
  backgroundCache.set(key, { at: now, media });
  // Plus ancienne entrée retirée au-delà de la limite (ordre d'insertion de la Map)
  if (backgroundCache.size > BACKGROUND_CACHE_MAX) backgroundCache.delete(backgroundCache.keys().next().value ?? '');
  return media;
}

/** `lane` : 'background' pour les tâches de fond (budget limité et cache court, voir rate-limit.ts) */
export async function searchAnime(search: string, lane: RequestLane = 'interactive'): Promise<AniListMedia[]> {
  return cachedPage(`search:${search.toLowerCase()}`, lane, async () => parsePage(await anilistPublicQuery(SEARCH_QUERY, isPageData, { search }, lane)));
}

export async function getAnimeByIds(ids: readonly number[], lane: RequestLane = 'interactive'): Promise<AniListMedia[]> {
  if (ids.length === 0) return [];
  const key = `ids:${[...ids].sort((a, b) => a - b).join(',')}`;
  return cachedPage(key, lane, async () => parsePage(await anilistPublicQuery(BY_IDS_QUERY, isPageData, { ids }, lane)));
}

const BY_ID_QUERY = /* GraphQL */ `
  query AnimeById($id: Int!) {
    Media(id: $id, type: ANIME) { ${MEDIA_FIELDS} }
  }
`;

function isMediaData(data: unknown): data is { Media: unknown } {
  return isRecord(data) && isRecord(data.Media);
}

/** Fiche du catalogue par identifiant AniList (sans compte requis). */
export async function getAnimeById(id: number): Promise<AniListMedia> {
  const media = parseMedia((await anilistPublicQuery(BY_ID_QUERY, isMediaData, { id })).Media);
  if (!media) throw new ApiError('INVALID_RESPONSE', t('api.invalidResponse.anilist'));
  return media;
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
