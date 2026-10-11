import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PAGE_MEDIA_ASYNC_TIMEOUT_MS } from '../../shared/content-messages';
import type { SeriesPageInfo } from '../../shared/page-media.types';
import type { StreamingAdapter } from '../adapters/adapter';
import { detectPageMedia, loadPageMedia, needsAsyncPageMedia } from './page-media';

// Réponse à GET_PAGE_MEDIA : lecture synchrone (Crunchyroll, ADN, cache du pont), ou chargement asynchrone borné d'une
// page de série dont les métadonnées viennent du pont du monde MAIN (Netflix, Disney+).

const SERIES: SeriesPageInfo = { seriesId: '80987039', seriesSlug: null, seriesTitle: 'Mushoku Tensei', seasonNumber: 2, seasonTitle: null, seasonEpisodeCount: 25 };
const SERIES_URL = new URL('https://www.netflix.com/browse?jbv=80987039');
const WATCH_URL = new URL('https://www.netflix.com/watch/81402901');

function adapter(overrides: Partial<StreamingAdapter> = {}): StreamingAdapter {
  return {
    platform: 'netflix',
    supportsHost: () => true,
    getEpisodeId: (url) => /\/watch\/(\d+)/.exec(url.pathname)?.[1] ?? null,
    extractEpisodeInfo: () => null,
    detectSeries: () => null,
    findVideo: () => null,
    ...overrides,
  };
}

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe('needsAsyncPageMedia', () => {
  it('page de série hors cache d’une plateforme à pont : réponse asynchrone', () => {
    const async = adapter({ loadSeries: () => Promise.resolve(SERIES) });
    expect(needsAsyncPageMedia(async, SERIES_URL, null)).toBe(true);
    // Déjà en cache (detectSeries), page de lecture, ou plateforme sans pont (Crunchyroll, ADN) : réponse immédiate
    expect(needsAsyncPageMedia(async, SERIES_URL, detectPageMedia(adapter({ detectSeries: () => SERIES }), SERIES_URL))).toBe(false);
    expect(needsAsyncPageMedia(async, WATCH_URL, null)).toBe(false);
    expect(needsAsyncPageMedia(adapter(), SERIES_URL, null)).toBe(false);
  });
});

describe('loadPageMedia', () => {
  it('métadonnées reçues à temps : fiche de la page de série', async () => {
    const loaded = loadPageMedia(adapter({ loadSeries: () => new Promise((resolve) => setTimeout(() => resolve(SERIES), 1_000)) }), SERIES_URL);
    await vi.advanceTimersByTimeAsync(1_000);
    expect(await loaded).toEqual({ platform: 'netflix', kind: 'series', ...SERIES, episode: null });
  });

  it('rien au-delà du délai : null (rien sur cette page), chargement annulé', async () => {
    let signal: AbortSignal | null = null;
    const loadSeries = (_url: URL, given: AbortSignal): Promise<SeriesPageInfo | null> => {
      signal = given;
      return new Promise(() => undefined);
    };
    const loaded = loadPageMedia(adapter({ loadSeries }), SERIES_URL);
    await vi.advanceTimersByTimeAsync(PAGE_MEDIA_ASYNC_TIMEOUT_MS - 1);
    expect((signal as AbortSignal | null)?.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(await loaded).toBeNull();
    expect((signal as AbortSignal | null)?.aborted).toBe(true);
  });

  it('erreur du chargement ou série introuvable : null', async () => {
    expect(await loadPageMedia(adapter({ loadSeries: () => Promise.reject(new Error('pont')) }), SERIES_URL)).toBeNull();
    expect(await loadPageMedia(adapter({ loadSeries: () => Promise.resolve(null) }), SERIES_URL)).toBeNull();
    expect(await loadPageMedia(adapter(), SERIES_URL)).toBeNull();
  });
});
