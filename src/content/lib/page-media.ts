import type { PageMediaInfo } from '../../shared/page-media.types';
import { pageMediaFromEpisode, pageMediaFromSeries } from '../../shared/page-media';
import type { StreamingAdapter } from '../adapters/adapter';

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
