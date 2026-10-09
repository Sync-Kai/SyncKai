import type { EpisodeInfo } from '../../shared/episode.types';
import { createLogger } from '../../shared/logger';
import { createNetflixBridgeClient, type NetflixBridgeClient } from '../netflix/bridge-client';
import type { NetflixSeasonMetadata, NetflixShowMetadata } from '../netflix/bridge-protocol';
import type { StreamingAdapter } from './adapter';
import { meaningfulSeasonTitle } from './parsing';

const log = createLogger('netflix');

/** /watch/{id} (le paramètre trackId de la query est ignoré). Vérifié le 2026-10-09 : /watch/81402901 */
const WATCH_PATH_REGEX = /^\/watch\/(\d{1,12})\/?$/;

const SELECTORS = {
  playerVideo: '.watch-video video',
  anyVideo: 'video',
} as const;

export function parseNetflixWatchId(pathname: string): string | null {
  return WATCH_PATH_REGEX.exec(pathname)?.[1] ?? null;
}

/**
 * Numéro « absolu » de l'épisode : épisodes des saisons précédentes (seq inférieur) + numéro dans la saison.
 * Null si une saison précédente est vide (liste incomplète : le total serait faux).
 */
export function absoluteEpisodeNumber(seasons: readonly NetflixSeasonMetadata[], seasonSeq: number, episodeSeq: number): number | null {
  let before = 0;
  for (const season of seasons) {
    if (season.seq >= seasonSeq) continue;
    if (season.episodes.length === 0) return null;
    before += season.episodes.length;
  }
  return before + episodeSeq;
}

const watchUrl = (movieId: string): string => `https://www.netflix.com/watch/${movieId}`;

/**
 * Épisode correspondant à la vidéo `movieId` dans les métadonnées réduites, null s'il n'y figure pas.
 * Film : saison inconnue, épisode 1 (clé de correspondance `s0`).
 */
export function episodeInfoFromMetadata(show: NetflixShowMetadata, movieId: string): EpisodeInfo | null {
  const base = { platform: 'netflix', episodeId: movieId, seriesId: show.showId, seriesSlug: null, animeTitle: show.title, url: watchUrl(movieId) } as const;
  if (show.type === 'movie') {
    if (show.showId !== movieId) return null;
    return { ...base, seasonNumber: null, seasonTitle: null, seasonEpisodeNumber: 1, displayedEpisodeNumber: 1, episodeTitle: null };
  }
  for (const season of show.seasons) {
    const episode = season.episodes.find((e) => e.id === movieId);
    if (!episode) continue;
    return {
      ...base,
      seasonNumber: season.seq,
      seasonTitle: meaningfulSeasonTitle(season.title),
      seasonEpisodeNumber: episode.seq,
      displayedEpisodeNumber: absoluteEpisodeNumber(show.seasons, season.seq, episode.seq),
      episodeTitle: episode.title,
    };
  }
  return null;
}

/** Début du générique de fin (s) : creditsOffset s'il est > 0 et antérieur à la fin, sinon null */
export function creditsStartFromMetadata(show: NetflixShowMetadata | null, movieId: string): number | null {
  if (!show) return null;
  const timing =
    show.type === 'movie'
      ? show.showId === movieId
        ? { runtime: show.runtime, creditsOffset: show.creditsOffset }
        : null
      : (show.seasons.flatMap((season) => season.episodes).find((episode) => episode.id === movieId) ?? null);
  if (!timing || timing.creditsOffset === null || timing.runtime === null) return null;
  return timing.creditsOffset > 0 && timing.creditsOffset < timing.runtime ? timing.creditsOffset : null;
}

/** Créé à la première utilisation : le module est aussi importé hors navigateur (tests) */
let client: NetflixBridgeClient | null = null;
function bridge(): NetflixBridgeClient {
  client ??= createNetflixBridgeClient({ target: document, messages: window, origin: location.origin });
  return client;
}

export const netflixAdapter: StreamingAdapter = {
  platform: 'netflix',
  // Catalogue généraliste : pas de toast pour une vidéo qui n'est probablement pas un anime
  quiet: true,

  supportsHost(hostname) {
    return hostname === 'netflix.com' || hostname.endsWith('.netflix.com');
  },

  getEpisodeId(url) {
    return parseNetflixWatchId(url.pathname);
  },

  // Synchrone : lecture du cache rempli par loadEpisodeInfo (aucune métadonnée dans le DOM de Netflix)
  extractEpisodeInfo(url) {
    const movieId = parseNetflixWatchId(url.pathname);
    const show = movieId ? bridge().peek(movieId) : null;
    return movieId && show ? episodeInfoFromMetadata(show, movieId) : null;
  },

  async loadEpisodeInfo(episodeId, signal) {
    const show = await bridge().load(episodeId, signal);
    if (!show) return null;
    const episode = episodeInfoFromMetadata(show, episodeId);
    if (!episode) log.info(`Vidéo ${episodeId} absente des métadonnées de « ${show.title} » (bande-annonce, bonus…)`);
    return episode;
  },

  // Pages de série Netflix (/title/…) non gérées en v1
  detectSeries() {
    return null;
  },

  findVideo() {
    return (
      document.querySelector<HTMLVideoElement>(SELECTORS.playerVideo) ?? document.querySelector<HTMLVideoElement>(SELECTORS.anyVideo)
    );
  },

  // Même requête que loadEpisodeInfo (cache ou requête en vol partagée)
  async getCreditsStart(episodeId, signal) {
    const start = creditsStartFromMetadata(await bridge().load(episodeId, signal), episodeId);
    log.info(start !== null ? `Générique de fin annoncé à ${start} s` : 'Pas de début de générique exploitable');
    return start;
  },
};
