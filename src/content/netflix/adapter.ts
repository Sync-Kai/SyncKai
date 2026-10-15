import type { EpisodeInfo } from '../../shared/episode.types';
import type { SeriesPageInfo } from '../../shared/page-media.types';
import { createLogger } from '../../browser/logger';
import { createNetflixBridgeClient, type NetflixBridgeClient } from './bridge-client';
import { episodeNumbers, netflixSignals, platformSeasonsOf, type NetflixSeasonMetadata, type NetflixShowMetadata } from '../../platforms/netflix/metadata';
import type { PlatformSignals } from '../../shared/match-signals';
import { findPlayerVideo } from '../lib/find-video';
import { watchElementText } from '../lib/season-watch';
import type { StreamingAdapter } from '../lib/adapter';
import { meaningfulSeasonTitle } from '../lib/parsing';

// Numérotation partagée avec l'import de l'historique (platforms/netflix/metadata.ts) : mêmes numéros des deux côtés
export { absoluteEpisodeNumber, episodeNumbers, platformSeasonsOf } from '../../platforms/netflix/metadata';

const log = createLogger('netflix');

/** /watch/{id} (le paramètre trackId de la query est ignoré). Vérifié le 2026-10-09 : /watch/81402901 */
const WATCH_PATH_REGEX = /^\/watch\/(\d{1,12})\/?$/;

/** Page de série : /title/{id}, éventuellement précédé du pays (/be-fr/title/{id}) */
const TITLE_PATH_REGEX = /^\/(?:[a-z]{2}(?:-[a-z]{2})?\/)?title\/(\d{1,12})\/?$/i;
/** Fenêtre de détail ouverte sur n'importe quelle page (accueil, recherche…) : ?jbv={id} */
const JBV_REGEX = /^\d{1,12}$/;

const SELECTORS = {
  playerVideo: '.watch-video video',
  /**
   * Menu des saisons de la fenêtre de détail (série à plusieurs saisons) : bouton affichant la saison choisie,
   * libellé localisé (« Season 2 », « Saison 2 », « Staffel 2 » ou nom de la saison). Non relevé sur une page réelle.
   */
  seasonToggle:
    '.episodeSelector-dropdown [data-uia="dropdown-toggle"], .episodeSelector [data-uia="dropdown-toggle"], .previewModal--container [data-uia="dropdown-toggle"], [data-uia="season-selector"]',
} as const;

export function parseNetflixWatchId(pathname: string): string | null {
  return WATCH_PATH_REGEX.exec(pathname)?.[1] ?? null;
}

/**
 * Série affichée hors page de lecture : fenêtre de détail `?jbv={id}` (prioritaire : ouverte par-dessus la page,
 * /title/{id} compris), sinon page /title/{id}. Null ailleurs, et sur une page de lecture (qui l'emporte).
 */
export function parseNetflixSeriesId(url: URL): string | null {
  if (parseNetflixWatchId(url.pathname) !== null) return null;
  const jbv = url.searchParams.get('jbv');
  if (jbv !== null && JBV_REGEX.test(jbv)) return jbv;
  return TITLE_PATH_REGEX.exec(url.pathname)?.[1] ?? null;
}

const watchUrl = (movieId: string): string => `https://www.netflix.com/watch/${movieId}`;

/** Signaux de la saison (ou du film), propriété absente sans signal */
const withSignals = (signals: PlatformSignals | undefined): { signals?: PlatformSignals } => (signals ? { signals } : {});

/**
 * Épisode correspondant à la vidéo `movieId` dans les métadonnées réduites, null s'il n'y figure pas.
 * Film : saison inconnue, épisode 1 (clé de correspondance `s0`). Signaux de la saison en lecture (netflixSignals).
 */
export function episodeInfoFromMetadata(show: NetflixShowMetadata, movieId: string): EpisodeInfo | null {
  const base = { platform: 'netflix', episodeId: movieId, seriesId: show.showId, seriesSlug: null, animeTitle: show.title, url: watchUrl(movieId) } as const;
  if (show.type === 'movie') {
    if (show.showId !== movieId) return null;
    return { ...base, seasonNumber: null, seasonTitle: null, seasonEpisodeNumber: 1, displayedEpisodeNumber: 1, episodeTitle: null, ...withSignals(netflixSignals(show, null)) };
  }
  for (const season of show.seasons) {
    const episode = season.episodes.find((e) => e.id === movieId);
    if (!episode) continue;
    return {
      ...base,
      seasonNumber: season.seq,
      seasonTitle: meaningfulSeasonTitle(season.title),
      ...episodeNumbers(show.seasons, season, episode),
      episodeTitle: episode.title,
      platformSeasons: platformSeasonsOf(show),
      ...withSignals(netflixSignals(show, season)),
    };
  }
  return null;
}

/** Numéro du libellé du menu des saisons (« Saison 2 » → 2, « Staffel 10 » → 10), null sans nombre */
export function seasonNumberFromLabel(label: string | null): number | null {
  const match = label ? /(?:^|\D)(\d{1,3})(?!\d)/.exec(label) : null;
  return match ? Number(match[1]) : null;
}

/**
 * Saison affichée sur la page de série : la seule saison ; sinon celle du menu des saisons (libellé identique au nom de
 * la saison, sinon son numéro rapproché de `seq`) ; sinon null (toute la série : la fiche choisit la saison).
 */
export function pickNetflixSeason(seasons: readonly NetflixSeasonMetadata[], label: string | null): NetflixSeasonMetadata | null {
  if (seasons.length === 1) return seasons[0] ?? null;
  if (!label) return null;
  const key = label.trim().toLowerCase();
  const named = seasons.find((season) => season.title?.toLowerCase() === key);
  if (named) return named;
  const number = seasonNumberFromLabel(label);
  return number === null ? null : (seasons.find((season) => season.seq === number) ?? null);
}

/**
 * Page de série (ou de film) Netflix à partir des métadonnées de la série : identifiant et titre (anglais) de la série,
 * saison affichée (voir pickNetflixSeason). Numéro de saison = `seq`, comme les clés de correspondance de la lecture
 * (`netflix:{showId}:s{seq}`). Film : ni saison ni nombre d'épisodes.
 */
export function seriesInfoFromMetadata(show: NetflixShowMetadata, seasonLabel: string | null): SeriesPageInfo {
  const base = { seriesId: show.showId, seriesSlug: null, seriesTitle: show.title } as const;
  if (show.type === 'movie') return { ...base, seasonNumber: null, seasonTitle: null, seasonEpisodeCount: null, ...withSignals(netflixSignals(show, null)) };
  const platformSeasons = platformSeasonsOf(show);
  const season = pickNetflixSeason(show.seasons, seasonLabel);
  if (!season) return { ...base, seasonNumber: null, seasonTitle: null, seasonEpisodeCount: null, platformSeasons };
  return {
    ...base,
    seasonNumber: season.seq,
    seasonTitle: meaningfulSeasonTitle(season.title),
    seasonEpisodeCount: season.episodes.length || null,
    platformSeasons,
    ...withSignals(netflixSignals(show, season)),
  };
}

/** Libellé du menu des saisons de la fenêtre de détail, null s'il est absent (une saison, film, DOM différent) */
function readSeasonLabel(): string | null {
  const text = document.querySelector(SELECTORS.seasonToggle)?.textContent?.replace(/\s+/g, ' ').trim();
  return text ? text.slice(0, 100) : null;
}

/** Page de série affichée, avec la saison choisie dans le menu au moment de la demande */
function seriesInfo(show: NetflixShowMetadata): SeriesPageInfo {
  const label = show.type === 'show' && show.seasons.length > 1 ? readSeasonLabel() : null;
  const info = seriesInfoFromMetadata(show, label);
  // Diagnostic (build de développement seulement : retiré du script publié, budget de taille)
  if (__SYNCKAI_DEBUG__) log.debug(`Page de série « ${show.title} » (${show.showId}) : saison ${info.seasonNumber ?? 'non déterminée'}${label ? ` (menu « ${label} »)` : ''}`);
  return info;
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

/** Créé à la première utilisation : le module est aussi importé hors navigateur (tests). Partagé avec l'import (history.ts) */
let client: NetflixBridgeClient | null = null;
export function bridge(): NetflixBridgeClient {
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
    if (__SYNCKAI_DEBUG__ && !episode) log.info(`Vidéo ${episodeId} absente des métadonnées de « ${show.title} » (bande-annonce, bonus…)`);
    return episode;
  },

  // Synchrone : lecture du cache rempli par loadSeries (ou par une lecture de la même série)
  detectSeries(url) {
    const showId = parseNetflixSeriesId(url);
    const show = showId ? bridge().peekShow(showId) : null;
    return show ? seriesInfo(show) : null;
  },

  // Menu des saisons de la fenêtre de détail (son texte est la saison choisie)
  watchSeason(url, onChange) {
    return parseNetflixSeriesId(url) ? watchElementText(SELECTORS.seasonToggle, onChange) : null;
  },

  // Même requête que la lecture, avec l'identifiant de la série (cache et requête en vol partagés)
  async loadSeries(url, signal) {
    const showId = parseNetflixSeriesId(url);
    if (!showId) return null;
    const show = await bridge().loadShow(showId, signal);
    if (__SYNCKAI_DEBUG__ && !show) log.debug(`Métadonnées de la série ${showId} indisponibles`);
    return show ? seriesInfo(show) : null;
  },

  findVideo() {
    return findPlayerVideo(SELECTORS.playerVideo);
  },

  // Même requête que loadEpisodeInfo (cache ou requête en vol partagée)
  async getCreditsStart(episodeId, signal) {
    const start = creditsStartFromMetadata(await bridge().load(episodeId, signal), episodeId);
    if (__SYNCKAI_DEBUG__) log.info(start !== null ? `Générique de fin annoncé à ${start} s` : 'Pas de début de générique exploitable');
    return start;
  },
};
