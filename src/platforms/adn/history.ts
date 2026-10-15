import { MAX_ADN_HISTORY_ITEMS, type AdnHistoryPortMessage, type AdnHistoryRead } from '../../protocol/adn-history';
import { CR_HISTORY_ERROR_CODES, isHistoryStats, isSeriesSlug, MAX_HISTORY_SEASONS, type CrHistoryResult, type HistorySeason } from '../crunchyroll/history';
import { isRecord } from '../../shared/guards';

// Historique ADN → une ligne par saison (pur, testé), dans la page d'import : même forme que l'historique Crunchyroll
// (HistorySeason), analysée par le même pipeline. Mêmes clés et numéros que la synchro en direct d'ADN
// (content/adn/adapter.ts : seriesId = identifiant de la série dans /video/{id}-{slug}, saison, numéro d'épisode).

/**
 * Élément de GET gw.api.animationdigitalnetwork.com/viewing/history (structure vérifiée le 2026-10-12, réduite par
 * le script de contenu) : { id: 29932, name, shortNumber: "1", season: "1", type: "EPS", duration: 1421,
 * urlPath: "/video/1331-slug/29932-episode-1", user: { stoptime: 1299, watchDate: "2026-…", isFullyWatched: true },
 * show: { id: 1331, title, urlPath: "/video/1331-slug" } }
 */
export interface AdnHistoryEpisode {
  episodeId: string;
  showId: string;
  showTitle: string;
  /** Slug de la série (« hero-without-a-class-who-even-needs-skills ») : liens AniList /video/{id}-{slug} */
  showSlug: string | null;
  seasonNumber: number | null;
  /** Numéro de l'épisode (`shortNumber`) ; null pour un spécial non numéroté (« OAV », « 12.5 ») */
  episodeNumber: number | null;
  episodeTitle: string | null;
  fullyWatched: boolean;
  /** Position de lecture (s) */
  stoptime: number;
  /** Durée (s), null si inconnue */
  duration: number | null;
  watchedAt: number | null;
}

const ID = /^\d{1,12}$/;
const id = (v: unknown): string | null => {
  const value = typeof v === 'number' && Number.isSafeInteger(v) ? String(v) : v;
  return typeof value === 'string' && ID.test(value) ? value : null;
};
const text = (v: unknown, max: number): string | null => {
  const value = typeof v === 'string' ? v.replace(/\s+/g, ' ').trim() : '';
  return value.length > 0 && value.length <= max ? value : null;
};
const finite = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
/** "12" ou 12 → 12 ; "12.5", "OAV", 0 → null */
const positiveInt = (v: unknown): number | null => {
  const value = typeof v === 'string' && /^\d{1,5}$/.test(v.trim()) ? Number(v.trim()) : v;
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 ? value : null;
};

/** Slug de /video/{showId}-{slug}[/…] (préfixe de langue toléré), seulement pour la série attendue */
export function adnSlugFromPath(path: unknown, showId: string): string | null {
  const match = typeof path === 'string' ? /^\/(?:[a-z]{2}\/)?video\/(\d+)-([^/?#]+)/i.exec(path) : null;
  if (!match || match[1] !== showId) return null;
  const slug = (match[2] ?? '').toLowerCase();
  return isSeriesSlug(slug) ? slug : null;
}

export function parseAdnVideo(raw: unknown): AdnHistoryEpisode | null {
  if (!isRecord(raw) || !isRecord(raw.show)) return null;
  const show = raw.show;
  const user = isRecord(raw.user) ? raw.user : {};
  const episodeId = id(raw.id);
  const showId = id(show.id);
  const showTitle = text(show.title, 300);
  if (!episodeId || !showId || !showTitle) return null;
  const duration = finite(raw.duration);
  const watchedAt = typeof user.watchDate === 'string' ? Date.parse(user.watchDate) : Number.NaN;
  const season = typeof raw.season === 'string' && /^\d{1,3}$/.test(raw.season.trim()) ? Number(raw.season.trim()) : finite(raw.season);
  return {
    episodeId,
    showId,
    showTitle,
    showSlug: adnSlugFromPath(show.urlPath, showId) ?? adnSlugFromPath(raw.urlPath, showId),
    seasonNumber: season !== null && Number.isInteger(season) && season >= 0 ? season : null,
    episodeNumber: positiveInt(raw.shortNumber),
    episodeTitle: text(raw.name, 500),
    fullyWatched: user.isFullyWatched === true,
    stoptime: Math.max(0, finite(user.stoptime) ?? 0),
    duration: duration !== null && duration > 0 ? duration : null,
    watchedAt: Number.isFinite(watchedAt) ? watchedAt : null,
  };
}

/**
 * Épisode compté comme vu : marqué terminé par ADN, ou position ≥ seuil de fin réglé dans SyncKai (le même que la
 * synchro en direct sur ADN, qui n'a pas de générique connu : pourcentage de la durée). Un épisode commencé seulement
 * n'est jamais importé.
 */
export function isAdnWatched(episode: Pick<AdnHistoryEpisode, 'fullyWatched' | 'stoptime' | 'duration'>, completionPercentage: number): boolean {
  if (episode.fullyWatched) return true;
  if (episode.duration === null) return false;
  return episode.stoptime / episode.duration >= completionPercentage / 100;
}

/**
 * Une ligne par (série, saison) : l'épisode vu le plus avancé, le nombre d'épisodes vus et le dernier visionnage.
 * Spéciaux non numérotés, épisodes non terminés et éléments illisibles ignorés. Tri : visionnage le plus récent d'abord.
 * Aucun filtre de genre (donghua, manhwa…) : la correspondance AniList décide, et une correspondance incertaine
 * n'est jamais appliquée.
 */
export function reduceAdnHistory(read: AdnHistoryRead, completionPercentage: number): CrHistoryResult {
  const bySeason = new Map<string, { best: AdnHistoryEpisode & { episodeNumber: number }; watched: Set<string>; lastPlayedAt: number | null }>();
  for (const raw of read.videos) {
    const episode = parseAdnVideo(raw);
    if (!episode || !isAdnWatched(episode, completionPercentage)) continue;
    const { episodeNumber } = episode;
    if (episodeNumber === null) continue;
    const numbered = { ...episode, episodeNumber };
    const key = `${episode.showId}:s${episode.seasonNumber ?? 0}`;
    const entry = bySeason.get(key);
    if (!entry) {
      bySeason.set(key, { best: numbered, watched: new Set([episode.episodeId]), lastPlayedAt: episode.watchedAt });
      continue;
    }
    entry.watched.add(episode.episodeId);
    if (episodeNumber > entry.best.episodeNumber) entry.best = numbered;
    if (episode.watchedAt !== null && (entry.lastPlayedAt === null || episode.watchedAt > entry.lastPlayedAt)) entry.lastPlayedAt = episode.watchedAt;
  }
  const all = [...bySeason.values()]
    .sort((a, b) => (b.lastPlayedAt ?? 0) - (a.lastPlayedAt ?? 0))
    .map(({ best, watched, lastPlayedAt }): HistorySeason => ({
      seriesId: best.showId,
      seriesTitle: best.showTitle,
      seriesSlug: best.showSlug,
      seasonId: `${best.showId}-s${best.seasonNumber ?? 0}`,
      seasonNumber: best.seasonNumber,
      // ADN ne nomme pas ses saisons dans l'historique ; la synchro en direct ignore aussi « Saison 1 »
      seasonTitle: null,
      episodeId: best.episodeId,
      episodeTitle: best.episodeTitle,
      // Numéro dans la saison ADN, comme sur la page de lecture (JSON-LD episodeNumber)
      episodeNumber: best.episodeNumber,
      seasonEpisodeNumber: best.episodeNumber,
      watchedCount: watched.size,
      lastPlayedAt,
    }));
  return {
    seasons: all.slice(0, MAX_HISTORY_SEASONS),
    stats: { ...read.stats, partial: read.stats.partial || all.length > MAX_HISTORY_SEASONS },
  };
}

// ─── Messages du port (reçus par la page d'import) ─────────────────────────

const isCount = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 0;

export function isAdnHistoryRead(value: unknown): value is AdnHistoryRead {
  return isRecord(value) && Array.isArray(value.videos) && value.videos.length <= MAX_ADN_HISTORY_ITEMS && isHistoryStats(value.stats);
}

export function isAdnHistoryPortMessage(value: unknown): value is AdnHistoryPortMessage {
  if (!isRecord(value)) return false;
  switch (value.type) {
    case 'progress':
      return isCount(value.pages) && isCount(value.items);
    case 'done':
      return isAdnHistoryRead(value.result);
    case 'error':
      return CR_HISTORY_ERROR_CODES.some((c) => c === value.code);
    default:
      return false;
  }
}
