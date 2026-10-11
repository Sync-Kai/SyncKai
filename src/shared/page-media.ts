import type { EpisodeInfo, StreamingPlatform } from './episode.types';
import type { PageMediaInfo, SeriesPageInfo } from './page-media.types';

// Fiche de la page construite à partir d'un épisode ou d'une page de série (pur : script de contenu et service worker)

/** Longueur maximale acceptée par la validation du message (isPageMediaInfo) */
const MAX_TEXT = 300;

const clamp = (text: string | null): string | null => (text ? text.slice(0, MAX_TEXT) : null);
/** Numéro de saison exploitable (entier positif raisonnable), sinon null */
const seasonOrNull = (n: number | null): number | null => (n !== null && Number.isInteger(n) && n >= 0 && n < 1000 ? n : null);

/** Nombre d'épisodes exploitable (entier positif raisonnable), sinon null */
const countOrNull = (n: number | null): number | null => (n !== null && Number.isInteger(n) && n >= 1 && n < 10_000 ? n : null);

/** Fiche de la page à partir d'un épisode détecté (page de lecture). Pur, testable. */
export function pageMediaFromEpisode(episode: EpisodeInfo): PageMediaInfo {
  return {
    platform: episode.platform,
    kind: 'episode',
    seriesId: clamp(episode.seriesId),
    seriesSlug: clamp(episode.seriesSlug),
    seriesTitle: episode.animeTitle.slice(0, MAX_TEXT),
    seasonNumber: seasonOrNull(episode.seasonNumber),
    seasonTitle: clamp(episode.seasonTitle),
    episode,
  };
}

/** Fiche de la page à partir d'une page de série. Pur, testable. */
export function pageMediaFromSeries(platform: StreamingPlatform, series: SeriesPageInfo): PageMediaInfo {
  return {
    platform,
    kind: 'series',
    seriesId: clamp(series.seriesId),
    seriesSlug: clamp(series.seriesSlug),
    seriesTitle: series.seriesTitle.slice(0, MAX_TEXT),
    seasonNumber: seasonOrNull(series.seasonNumber),
    seasonTitle: clamp(series.seasonTitle),
    seasonEpisodeCount: countOrNull(series.seasonEpisodeCount ?? null),
    episode: null,
  };
}
