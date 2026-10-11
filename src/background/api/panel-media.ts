import { t } from '../../i18n';
import { isRecord } from '../../shared/guards';
import { createLogger } from '../../shared/logger';
import { sanitizeDescription } from '../../shared/panel-media';
import { PANEL_MEDIA_CACHE_TTL_MS, PANEL_MEDIA_CACHE_VERSION, panelMediaCacheKey, purgeStaleSessionCaches, sessionArea } from '../../shared/session-cache';
import {
  isMediaSeason,
  isPanelMedia,
  isPanelRelationType,
  PANEL_RELATION_TYPES,
  type PanelMedia,
  type PanelMediaResult,
  type PanelRelation,
} from '../../shared/panel-media.types';
import { learnedLinksFor, mergePlatformLinks, type PlatformLinkStore } from '../../shared/platform-links';
import { getPlatformLinks } from '../../shared/platform-links-store';
import type { RecentSync } from '../../shared/review.types';
import { getRecentSyncs } from '../../shared/storage';
import { toSafeImageUrl, toSafeUrl } from '../../shared/url';
import { anilistPublicQuery } from './client';
import { ApiError } from './errors';
import { buildPlatforms, parseNextEpisode, toAiringStatus } from './watching';

// Fiche complète de l'onglet « En lecture » (panneau latéral) : une requête AniList, cache de session 6 h.

const log = createLogger('panel-media');

const PANEL_MEDIA_QUERY = /* GraphQL */ `
  query PanelMedia($id: Int!) {
    Media(id: $id, type: ANIME) {
      id
      idMal
      siteUrl
      bannerImage
      coverImage { extraLarge large color }
      description(asHtml: false)
      genres
      averageScore
      season
      seasonYear
      format
      episodes
      status
      nextAiringEpisode { episode airingAt }
      studios(isMain: true) { nodes { name siteUrl } }
      title { romaji english userPreferred }
      relations { edges { relationType node { id type format title { userPreferred } coverImage { medium } siteUrl externalLinks { url } } } }
    }
  }
`;

/** Relations affichées au plus (les franchises très longues en ont des dizaines) */
const MAX_RELATIONS = 12;
const MAX_GENRES = 8;

const str = (v: unknown): string | null => (typeof v === 'string' && v.length > 0 ? v : null);
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const anilistUrl = (v: unknown): string | null => toSafeUrl(str(v), 'anilist.co');

function parseRelation(edge: unknown): PanelRelation | null {
  if (!isRecord(edge) || !isPanelRelationType(edge.relationType) || !isRecord(edge.node)) return null;
  const { node } = edge;
  // Animes uniquement (les adaptations manga / light novel n'ont pas leur place ici)
  if (typeof node.id !== 'number' || node.type !== 'ANIME') return null;
  const title = isRecord(node.title) ? str(node.title.userPreferred) : null;
  const cover = isRecord(node.coverImage) ? node.coverImage : {};
  return {
    relationType: edge.relationType,
    mediaId: node.id,
    title: title ?? `#${node.id}`,
    format: str(node.format),
    coverUrl: toSafeImageUrl(str(cover.medium)),
    siteUrl: anilistUrl(node.siteUrl) ?? `https://anilist.co/anime/${node.id}`,
    platforms: buildPlatforms(node.externalLinks, []),
  };
}

/** Réponse brute → fiche normalisée (champs absents ou invalides → null / []) ; null sans identifiant */
export function parsePanelMedia(media: unknown): PanelMedia | null {
  if (!isRecord(media) || typeof media.id !== 'number' || !Number.isInteger(media.id) || media.id < 1) return null;
  const title = isRecord(media.title) ? media.title : {};
  const cover = isRecord(media.coverImage) ? media.coverImage : {};
  const color = str(cover.color);
  const studios = isRecord(media.studios) ? arr(media.studios.nodes) : [];
  const studio = studios.find((s): s is Record<string, unknown> => isRecord(s) && str(s.name) !== null);
  const order = (r: PanelRelation): number => PANEL_RELATION_TYPES.indexOf(r.relationType);
  const idMal = num(media.idMal);

  return {
    mediaId: media.id,
    idMal: idMal !== null && Number.isInteger(idMal) && idMal > 0 ? idMal : null,
    siteUrl: anilistUrl(media.siteUrl) ?? `https://anilist.co/anime/${media.id}`,
    title: str(title.userPreferred) ?? str(title.romaji) ?? str(title.english) ?? `#${media.id}`,
    romajiTitle: str(title.romaji),
    englishTitle: str(title.english),
    bannerUrl: toSafeImageUrl(str(media.bannerImage)),
    coverUrl: toSafeImageUrl(str(cover.extraLarge) ?? str(cover.large)),
    coverColor: color !== null && /^#[0-9a-f]{6}$/i.test(color) ? color : null,
    description: sanitizeDescription(str(media.description)),
    genres: arr(media.genres)
      .filter((g): g is string => typeof g === 'string' && g.length > 0 && g.length <= 40)
      .slice(0, MAX_GENRES),
    averageScore: num(media.averageScore),
    season: isMediaSeason(media.season) ? media.season : null,
    seasonYear: num(media.seasonYear),
    format: str(media.format),
    episodes: num(media.episodes),
    airingStatus: toAiringStatus(media.status),
    nextEpisode: parseNextEpisode(media.nextAiringEpisode),
    studio: studio ? { name: str(studio.name) ?? '', siteUrl: anilistUrl(studio.siteUrl) } : null,
    relations: arr(isRecord(media.relations) ? media.relations.edges : [])
      .map(parseRelation)
      .filter((r): r is PanelRelation => r !== null)
      // Tri stable : ordre d'AniList conservé dans chaque type de relation
      .sort((a, b) => order(a) - order(b))
      .slice(0, MAX_RELATIONS),
  };
}

function isMediaData(data: unknown): data is { Media: unknown } {
  return isRecord(data) && isRecord(data.Media);
}

// ─── Cache de session (6 h) ───────────────────────────────────────────────
// `storage.session` (voir shared/session-cache.ts) : vidé à la fermeture du navigateur et à la déconnexion, entrées
// expirées purgées à l'écriture. Indisponible : cache mémoire du service worker (perdu à sa mise en veille).

export { PANEL_MEDIA_CACHE_VERSION, panelMediaCacheKey };
const memory = new Map<number, { at: number; value: PanelMedia }>();

async function readCache(mediaId: number): Promise<PanelMedia | null> {
  const session = sessionArea();
  let hit: unknown = memory.get(mediaId);
  if (session) {
    try {
      const key = panelMediaCacheKey(mediaId);
      hit = (await session.get(key))[key];
    } catch (error: unknown) {
      log.debug('Cache de session illisible :', error);
    }
  }
  if (!isRecord(hit) || typeof hit.at !== 'number' || Date.now() - hit.at > PANEL_MEDIA_CACHE_TTL_MS || !isPanelMedia(hit.value)) return null;
  return hit.value;
}

async function writeCache(media: PanelMedia): Promise<void> {
  const entry = { at: Date.now(), value: media };
  const session = sessionArea();
  if (!session) {
    if (memory.size >= 30) memory.delete(memory.keys().next().value as number);
    memory.set(media.mediaId, entry);
    return;
  }
  try {
    await session.set({ [panelMediaCacheKey(media.mediaId)]: entry });
    await purgeStaleSessionCaches();
  } catch (error: unknown) {
    // Quota de session atteint, purge impossible : simple accélération perdue
    log.debug('Cache de session non écrit :', error);
  }
}

/**
 * Complète les liens de plateformes des relations avec les liens de séries appris en naviguant, puis
 * l'historique SyncKai (dernier épisode synchronisé), appliqué à la lecture : le cache ne garde que les liens AniList.
 */
export function withHistoryLinks(media: PanelMedia, syncs: readonly RecentSync[], learned: PlatformLinkStore = {}): PanelMedia {
  if (syncs.length === 0 && Object.keys(learned).length === 0) return media;
  return {
    ...media,
    relations: media.relations.map((relation) => {
      const extra = buildPlatforms([], syncs.filter((sync) => sync.mediaId === relation.mediaId), learnedLinksFor(learned, relation.mediaId));
      return extra.length === 0 ? relation : { ...relation, platforms: mergePlatformLinks(relation.platforms, extra) };
    }),
  };
}

async function recentSyncs(): Promise<RecentSync[]> {
  try {
    return await getRecentSyncs();
  } catch (error: unknown) {
    log.debug('Historique illisible :', error);
    return [];
  }
}

/** Liens appris et historique, lus à chaque affichage (le cache de la fiche ne garde que les liens AniList) */
async function withKnownLinks(media: PanelMedia): Promise<PanelMedia> {
  const [syncs, learned] = await Promise.all([recentSyncs(), getPlatformLinks()]);
  return withHistoryLinks(media, syncs, learned);
}

/** Fiche complète pour le panneau latéral (catalogue public, sans compte requis) */
export async function getPanelMedia(mediaId: number): Promise<PanelMediaResult> {
  try {
    const cached = await readCache(mediaId);
    if (cached) return { ok: true, data: await withKnownLinks(cached) };
    const { Media } = await anilistPublicQuery(PANEL_MEDIA_QUERY, isMediaData, { id: mediaId });
    const media = parsePanelMedia(Media);
    if (!media) throw new ApiError('INVALID_RESPONSE', t('api.invalidResponse.anilist'));
    await writeCache(media);
    return { ok: true, data: await withKnownLinks(media) };
  } catch (error: unknown) {
    if (error instanceof ApiError) return { ok: false, code: error.code, message: error.message };
    log.error('Erreur inattendue (fiche du panneau) :', error);
    return { ok: false, code: 'API_ERROR', message: t('error.unexpected') };
  }
}
