import { PAGE_MEDIA_ASYNC_TIMEOUT_MS } from '../../protocol/content-messages';
import type { PageMediaInfo } from '../../shared/page-media.types';
import { pageMediaFromEpisode, pageMediaFromSeries } from '../../shared/page-media';
import type { StreamingAdapter } from './adapter';

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

/** Vrai si la réponse à GET_PAGE_MEDIA doit attendre `loadSeries` (page de série d'une plateforme à pont, hors cache) */
export function needsAsyncPageMedia(adapter: StreamingAdapter, url: URL, immediate: PageMediaInfo | null): boolean {
  return immediate === null && adapter.loadSeries !== undefined && adapter.getEpisodeId(url) === null;
}

/**
 * Page de série chargée de façon asynchrone (Netflix, Disney+), bornée à `timeoutMs` : null au-delà (rien sur cette
 * page), le chargement étant annulé. Le pont garde ce qu'il reçoit ensuite : une nouvelle demande le trouve en cache.
 */
export async function loadPageMedia(adapter: StreamingAdapter, url: URL, timeoutMs: number = PAGE_MEDIA_ASYNC_TIMEOUT_MS): Promise<PageMediaInfo | null> {
  if (!adapter.loadSeries) return null;
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<null>((resolve) => {
    timer = setTimeout(() => {
      controller.abort();
      resolve(null);
    }, timeoutMs);
  });
  try {
    const series = await Promise.race([adapter.loadSeries(url, controller.signal), timeout]);
    return series ? pageMediaFromSeries(adapter.platform, series) : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
