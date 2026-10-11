import { t } from '../../i18n';
import { isRecord } from '../../shared/guards';
import { learnedLinksFor, mergePlatformLinks, platformFromUrl, platformLinkFromExternal, withLearnedLinks, type PlatformLinkStore } from '../../shared/platform-links';
import { getPlatformLinks } from '../../shared/platform-links-store';
import type { RecentSync } from '../../shared/review.types';
import { getCachedViewer, getCachedWatching, getRecentSyncs, getSessionEpoch, saveCachedWatching } from '../../shared/storage';
import { TRACKER_LABELS, type TrackerId } from '../../shared/tracker.types';
import { toSafeUrl } from '../../shared/url';
import type {
  AiringStatus,
  NextEpisode,
  PlatformLink,
  WatchingEntry,
  WatchingList,
  WatchingResult,
} from '../../shared/watching.types';
import { isWatchingFresh, WATCHING_REVALIDATE_MS } from '../../shared/watching';
import { anilistPublicQuery, anilistQuery } from './client';
import { ApiError } from './errors';
import { malRequest } from './mal';
import { getViewer } from './viewer';
import { createLogger } from '../../shared/logger';

const log = createLogger('watching');

// ─── Parsing défensif ─────────────────────────────────────────────────────

const str = (v: unknown): string | null => (typeof v === 'string' ? v : null);
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

const AIRING_STATUSES: readonly AiringStatus[] = ['RELEASING', 'FINISHED', 'NOT_YET_RELEASED', 'HIATUS', 'CANCELLED'];

const MAL_AIRING_STATUS: Record<string, AiringStatus> = {
  currently_airing: 'RELEASING',
  finished_airing: 'FINISHED',
  not_yet_aired: 'NOT_YET_RELEASED',
};

export const toAiringStatus = (v: unknown): AiringStatus | null => AIRING_STATUSES.find((s) => s === v) ?? null;
const fromMalAiringStatus = (v: unknown): AiringStatus | null =>
  typeof v === 'string' && Object.hasOwn(MAL_AIRING_STATUS, v) ? MAL_AIRING_STATUS[v] : null;

/** nextAiringEpisode AniList (airingAt en secondes UNIX) → ms */
export function parseNextEpisode(value: unknown): NextEpisode | null {
  if (!isRecord(value)) return null;
  const episode = num(value.episode);
  const airingAt = num(value.airingAt);
  return episode !== null && airingAt !== null ? { episode, airingAt: airingAt * 1000 } : null;
}

// Déplacé dans shared/platform-links.ts, réexporté pour les modules existants
export { platformFromUrl };

/**
 * Liens de plateformes, un seul par plateforme, par ordre de priorité : liens AniList (externalLinks),
 * puis liens de séries appris en naviguant (AniList ne référence presque jamais ADN), puis historique SyncKai.
 */
export function buildPlatforms(externalLinks: unknown, syncs: readonly RecentSync[], learned: readonly PlatformLink[] = []): PlatformLink[] {
  const anilist = arr(externalLinks).flatMap((link): PlatformLink[] => {
    const parsed = platformLinkFromExternal(isRecord(link) ? str(link.url) : null);
    return parsed ? [parsed] : [];
  });
  const history = syncs.flatMap((sync): PlatformLink[] => {
    const url = toSafeUrl(sync.episode.url);
    return url ? [{ platform: sync.episode.platform, url }] : [];
  });
  return mergePlatformLinks(anilist, learned, history);
}

/** Synchros SyncKai de la fiche, la plus récente en premier (getRecentSyncs est déjà trié) */
const syncsFor = (mediaId: number | null, syncs: readonly RecentSync[]): RecentSync[] =>
  mediaId === null ? [] : syncs.filter((s) => s.mediaId === mediaId);

function toLastSync(syncs: readonly RecentSync[]): WatchingEntry['lastSync'] {
  const last = syncs[0];
  return last ? { platform: last.episode.platform, at: last.syncedAt, episodeUrl: last.episode.url } : null;
}

// ─── AniList ──────────────────────────────────────────────────────────────

const ANILIST_WATCHING_QUERY = /* GraphQL */ `
  query Watching($userId: Int) {
    MediaListCollection(userId: $userId, type: ANIME, status_in: [CURRENT, REPEATING]) {
      lists {
        entries {
          progress
          updatedAt
          media {
            id
            idMal
            siteUrl
            episodes
            status
            title { userPreferred }
            coverImage { medium }
            nextAiringEpisode { episode airingAt }
            externalLinks { url }
          }
        }
      }
    }
  }
`;

const isCollectionData = (data: unknown): data is { MediaListCollection: Record<string, unknown> } =>
  isRecord(data) && isRecord(data.MediaListCollection);

async function getAniListUserId(): Promise<number> {
  const cached = await getCachedViewer();
  if (cached) return cached.id;
  const result = await getViewer();
  if (!result.ok) throw new ApiError(result.code, result.message);
  return result.data.id;
}

async function fetchAniListEntries(syncs: readonly RecentSync[], learned: PlatformLinkStore): Promise<WatchingEntry[]> {
  const userId = await getAniListUserId();
  const { MediaListCollection } = await anilistQuery(ANILIST_WATCHING_QUERY, isCollectionData, { userId });

  const entries = new Map<number, WatchingEntry>();
  // Une fiche peut apparaître dans plusieurs listes (listes personnalisées) : dédoublonnage par id
  for (const list of arr(MediaListCollection.lists)) {
    for (const raw of arr(isRecord(list) ? list.entries : null)) {
      if (!isRecord(raw) || !isRecord(raw.media)) continue;
      const media = raw.media;
      const id = num(media.id);
      if (id === null || entries.has(id)) continue;

      const title = isRecord(media.title) ? str(media.title.userPreferred) : null;
      const cover = isRecord(media.coverImage) ? str(media.coverImage.medium) : null;
      const updatedAt = num(raw.updatedAt);
      const mediaSyncs = syncsFor(id, syncs);
      entries.set(id, {
        mediaId: id,
        malId: num(media.idMal),
        title: title ?? `#${id}`,
        coverUrl: toSafeUrl(cover),
        progress: num(raw.progress) ?? 0,
        totalEpisodes: num(media.episodes),
        updatedAt: updatedAt ? updatedAt * 1000 : null,
        nextEpisode: parseNextEpisode(media.nextAiringEpisode),
        airingStatus: toAiringStatus(media.status),
        platforms: buildPlatforms(media.externalLinks, mediaSyncs, learnedLinksFor(learned, id)),
        lastSync: toLastSync(mediaSyncs),
        siteUrl: toSafeUrl(str(media.siteUrl), 'anilist.co') ?? `https://anilist.co/anime/${id}`,
      });
    }
  }
  return [...entries.values()];
}

// ─── MyAnimeList (+ enrichissement par le catalogue public AniList) ───────

// limit=1000 = maximum de l'endpoint : une seule requête suffit pour une liste « en cours », pas de pagination.
// nsfw=true : sans lui, MAL omet silencieusement les fiches classées NSFW.
const MAL_WATCHING_PATH =
  '/users/@me/animelist?status=watching&sort=list_updated_at&limit=1000&nsfw=true&fields=list_status,num_episodes,main_picture,status';

const isMalListData = (data: unknown): data is { data: unknown[] } => isRecord(data) && Array.isArray(data.data);

const CATALOG_BY_MAL_QUERY = /* GraphQL */ `
  query CatalogByMal($ids: [Int]) {
    Page(perPage: 50) {
      media(idMal_in: $ids, type: ANIME) {
        id
        idMal
        episodes
        status
        nextAiringEpisode { episode airingAt }
        externalLinks { url }
      }
    }
  }
`;

const CATALOG_CHUNK = 50;

const isPageData = (data: unknown): data is { Page: { media: unknown[] } } =>
  isRecord(data) && isRecord(data.Page) && Array.isArray(data.Page.media);

/** Fiches AniList indexées par id MAL. Enrichissement facultatif : en cas d'échec, liste MAL seule. */
async function fetchCatalogByMalIds(malIds: readonly number[]): Promise<Map<number, Record<string, unknown>>> {
  const catalog = new Map<number, Record<string, unknown>>();
  try {
    for (let i = 0; i < malIds.length; i += CATALOG_CHUNK) {
      const ids = malIds.slice(i, i + CATALOG_CHUNK);
      const { Page } = await anilistPublicQuery(CATALOG_BY_MAL_QUERY, isPageData, { ids });
      for (const media of Page.media) {
        const idMal = isRecord(media) ? num(media.idMal) : null;
        if (isRecord(media) && idMal !== null && num(media.id) !== null && !catalog.has(idMal)) catalog.set(idMal, media);
      }
    }
  } catch (error: unknown) {
    log.warn('Catalogue AniList indisponible pour la liste MyAnimeList :', error);
  }
  return catalog;
}

async function fetchMalEntries(syncs: readonly RecentSync[], learned: PlatformLinkStore): Promise<WatchingEntry[]> {
  const { data } = await malRequest(MAL_WATCHING_PATH, isMalListData);
  const items = data.flatMap((item) => {
    if (!isRecord(item) || !isRecord(item.node)) return [];
    const id = num(item.node.id);
    const title = str(item.node.title);
    return id !== null && title !== null ? [{ id, title, node: item.node, listStatus: isRecord(item.list_status) ? item.list_status : {} }] : [];
  });

  const catalog = await fetchCatalogByMalIds(items.map((i) => i.id));

  return items.map(({ id, title, node, listStatus }): WatchingEntry => {
    const media = catalog.get(id);
    const mediaId = media ? num(media.id) : null;
    const picture = isRecord(node.main_picture) ? str(node.main_picture.medium) : null;
    const malEpisodes = num(node.num_episodes);
    const updated = str(listStatus.updated_at);
    const updatedAt = updated ? Date.parse(updated) : Number.NaN;
    const mediaSyncs = syncsFor(mediaId, syncs);
    return {
      mediaId,
      malId: id,
      title,
      coverUrl: toSafeUrl(picture),
      progress: num(listStatus.num_episodes_watched) ?? 0,
      // 0 = nombre d'épisodes inconnu côté MAL
      totalEpisodes: malEpisodes && malEpisodes > 0 ? malEpisodes : media ? num(media.episodes) : null,
      updatedAt: Number.isNaN(updatedAt) ? null : updatedAt,
      nextEpisode: media ? parseNextEpisode(media.nextAiringEpisode) : null,
      airingStatus: (media ? toAiringStatus(media.status) : null) ?? fromMalAiringStatus(node.status),
      platforms: buildPlatforms(media?.externalLinks, mediaSyncs, learnedLinksFor(learned, mediaId)),
      lastSync: toLastSync(mediaSyncs),
      siteUrl: `https://myanimelist.net/anime/${id}`,
    };
  });
}

// ─── Point d'entrée ───────────────────────────────────────────────────────

/**
 * Liste « en cours » du service demandé, mise en cache pour le popup. Sans `force`, une liste en cache de moins de
 * 90 s, sans synchro depuis, est renvoyée sans requête (ouvertures rapprochées du popup ou du panneau, PERF-04).
 * Ne lève jamais.
 */
export async function getWatchingList(service: TrackerId, force = false): Promise<WatchingResult> {
  try {
    if (!force) {
      const [cached, syncs] = await Promise.all([getCachedWatching(service), getRecentSyncs()]);
      const lastSyncAt = syncs.length > 0 ? Math.max(...syncs.map((sync) => sync.syncedAt)) : null;
      if (cached && isWatchingFresh(cached, Date.now(), WATCHING_REVALIDATE_MS, lastSyncAt)) {
        return { ok: true, data: { ...cached, entries: withLearnedLinks(cached.entries, await getPlatformLinks()) ?? cached.entries } };
      }
    }
    // Génération capturée avant la requête : une déconnexion pendant celle-ci la rend obsolète
    const epoch = await getSessionEpoch(service);
    const [syncs, learned] = await Promise.all([getRecentSyncs(), getPlatformLinks()]);
    const entries = service === 'anilist' ? await fetchAniListEntries(syncs, learned) : await fetchMalEntries(syncs, learned);
    // Lien appris pendant la requête (popup ouvert sur une page de série) : pas écrasé par cette liste
    const list: WatchingList = { service, entries: withLearnedLinks(entries, await getPlatformLinks()) ?? entries, fetchedAt: Date.now() };
    if (!(await saveCachedWatching(list, epoch))) {
      // Déconnecté pendant la requête : ni cache, ni liste de l'ancien compte renvoyée à l'interface
      return { ok: false, code: 'NOT_AUTHENTICATED', message: t('api.notAuthenticated', { service: TRACKER_LABELS[service] }) };
    }
    return { ok: true, data: list };
  } catch (error: unknown) {
    if (error instanceof ApiError) return { ok: false, code: error.code, message: error.message };
    log.error('Erreur inattendue (getWatchingList) :', error);
    return { ok: false, code: 'API_ERROR', message: t('api.listLoadFailed') };
  }
}
