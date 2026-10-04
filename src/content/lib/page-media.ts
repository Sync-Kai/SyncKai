import type { EpisodeInfo } from '../../shared/episode.types';
import type { PageMediaInfo } from '../../shared/page-media.types';
import type { SeriesPageInfo, StreamingAdapter } from '../adapters/adapter';

/** Longueur maximale acceptée par la validation du message (isPageMediaInfo) */
const MAX_TEXT = 300;

const clamp = (text: string | null): string | null => (text ? text.slice(0, MAX_TEXT) : null);
/** Numéro de saison exploitable (entier positif raisonnable), sinon null */
const seasonOrNull = (n: number | null): number | null => (n !== null && Number.isInteger(n) && n >= 0 && n < 1000 ? n : null);

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
export function pageMediaFromSeries(platform: StreamingAdapter['platform'], series: SeriesPageInfo): PageMediaInfo {
  return {
    platform,
    kind: 'series',
    seriesId: clamp(series.seriesId),
    seriesSlug: clamp(series.seriesSlug),
    seriesTitle: series.seriesTitle.slice(0, MAX_TEXT),
    seasonNumber: seasonOrNull(series.seasonNumber),
    seasonTitle: clamp(series.seasonTitle),
    episode: null,
  };
}

/**
 * Série ou épisode affiché, lu à la demande du popup (aucun écouteur posé).
 * Page de lecture : mêmes métadonnées que la synchro ; null si le DOM n'est pas encore prêt.
 */
export function detectPageMedia(adapter: StreamingAdapter, url: URL): PageMediaInfo | null {
  if (adapter.getEpisodeId(url) !== null) {
    const episode = adapter.extractEpisodeInfo(url);
    return episode ? pageMediaFromEpisode(episode) : null;
  }
  const series = adapter.detectSeries(url);
  return series ? pageMediaFromSeries(adapter.platform, series) : null;
}
