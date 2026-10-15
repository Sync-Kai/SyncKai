import type { EpisodeInfo } from '../../shared/episode.types';
import { isRecord } from '../../shared/guards';
import { createLogger } from '../../browser/logger';
import { toPlatformSignals, type PlatformSignals } from '../../shared/match-signals';
import { findPlayerVideo } from '../lib/find-video';
import type { StreamingAdapter } from '../lib/adapter';
import type { SeriesPageInfo } from '../../shared/page-media.types';
import {
  cleanPageTitle,
  cleanText,
  createLabelGuard,
  labelKey,
  meaningfulSeasonTitle,
  readJsonLdNodes,
  readMetaContent,
  slugToTitle,
  toNumber,
  type LabelGuard,
} from '../lib/parsing';

const log = createLogger('adn');

/**
 * /video/{seriesId}-{seriesSlug}/{episodeId}-{episodeSlug}, préfixe de langue optionnel (/de/…).
 * Ex : /video/1311-tougen-anki/29344-episode-1 (vérifié le 2026-09-30).
 */
const WATCH_PATH_REGEX = /^\/(?:[a-z]{2}\/)?video\/(\d+)-([^/]+)\/(\d+)(?:-[^/?#]*)?\/?$/i;

/**
 * Numéro + titre d'épisode, avec préfixe de série optionnel :
 * - JSON-LD : "TOUGEN ANKI - Épisode 1 : Sang d'Oni"
 * - lecteur : "Épisode 1 : Sang d'Oni"
 */
const EPISODE_LABEL_REGEX = /(?:^|\s[-–—]\s)(?:Épisode|Episode|Folge)\s+(\d+(?:[.,]\d+)?)(?:\s*:\s*(.+))?$/i;

// Classes du lecteur video.js d'ADN (plus stables que les classes générées styled-components)
const SELECTORS = {
  playerVideo: 'video.vjs-tech',
  seriesTitle: '.vjs-meta-title',
  episodeSubtitle: '.vjs-meta-subtitle',
} as const;

/** Champs lus sur la page de lecture (l'adapter ajoute plateforme, identifiants tirés de l'URL et URL) */
export type AdnEpisodeFields = Omit<EpisodeInfo, 'platform' | 'episodeId' | 'url' | 'seriesId' | 'seriesSlug'>;

const labels = createLabelGuard();

export interface AdnWatchPath {
  seriesId: string;
  seriesSlug: string;
  episodeId: string;
}

export function parseAdnWatchPath(pathname: string): AdnWatchPath | null {
  const match = WATCH_PATH_REGEX.exec(pathname);
  return match ? { seriesId: match[1], seriesSlug: match[2].toLowerCase(), episodeId: match[3] } : null;
}

export function parseAdnEpisodeLabel(label: string | null): { number: number | null; title: string | null } {
  const match = label ? EPISODE_LABEL_REGEX.exec(label) : null;
  if (!match) return { number: null, title: label };
  return { number: toNumber(match[1]), title: cleanText(match[2]) };
}

// ─── Stratégies d'extraction ──────────────────────────────────────────────

/**
 * 1. JSON-LD schema.org. Structure vérifiée le 2026-09-30 :
 *    { "@type": "TVEpisode", name: "TOUGEN ANKI - Épisode 1 : Sang d'Oni", episodeNumber: "1",
 *      video: { url: ".../29344-episode-1" }, partOfSeries: { name: "TOUGEN ANKI" },
 *      partOfSeason: { name: "Saison 1", seasonNumber: "1" } }
 */
export function adnEpisodeFromJsonLdNodes(nodes: readonly Record<string, unknown>[], episodeId: string): AdnEpisodeFields | null {
  for (const node of nodes) {
    if (node['@type'] !== 'TVEpisode') continue;
    // Navigation SPA : le JSON-LD peut encore décrire l'épisode précédent, vérifié via ses URLs
    const video = isRecord(node.video) ? node.video : {};
    const urls = [node.url, node['@id'], video.url].map(cleanText).filter((u): u is string => u !== null);
    if (urls.length > 0 && !urls.some((u) => u.includes(`/${episodeId}-`) || u.endsWith(`/${episodeId}`))) continue;

    const series = isRecord(node.partOfSeries) ? node.partOfSeries : {};
    const season = isRecord(node.partOfSeason) ? node.partOfSeason : {};
    const animeTitle = cleanText(series.name);
    if (!animeTitle) continue;

    const episodeNumber = toNumber(node.episodeNumber);
    const label = parseAdnEpisodeLabel(cleanText(node.name));
    return {
      animeTitle,
      seasonNumber: toNumber(season.seasonNumber),
      seasonTitle: meaningfulSeasonTitle(cleanText(season.name)),
      seasonEpisodeNumber: episodeNumber,
      displayedEpisodeNumber: label.number ?? episodeNumber,
      episodeTitle: label.title,
    };
  }
  return null;
}

/** Textes de la surcouche du lecteur video.js : titre de la série et "Épisode 1 : …" */
export interface AdnPlayerOverlay {
  seriesTitle: string | null;
  subtitle: string | null;
}

/** 2. Surcouche du lecteur (pas de saison ni de numéro relatif). */
export function adnEpisodeFromPlayer(overlay: AdnPlayerOverlay, episodeId: string, guard: LabelGuard): AdnEpisodeFields | null {
  const animeTitle = cleanText(overlay.seriesTitle);
  if (!animeTitle) return null;

  const label = parseAdnEpisodeLabel(cleanText(overlay.subtitle));
  if (guard.isStale(episodeId, labelKey(label.number, label.title))) return null; // Épisode précédent encore affiché

  return {
    animeTitle,
    seasonNumber: null,
    seasonTitle: null,
    seasonEpisodeNumber: null,
    displayedEpisodeNumber: label.number,
    episodeTitle: label.title,
  };
}

function extractFromJsonLd(episodeId: string): AdnEpisodeFields | null {
  return adnEpisodeFromJsonLdNodes(readJsonLdNodes('TVEpisode'), episodeId);
}

function extractFromPlayer(episodeId: string): AdnEpisodeFields | null {
  const overlay = {
    seriesTitle: document.querySelector(SELECTORS.seriesTitle)?.textContent ?? null,
    subtitle: document.querySelector(SELECTORS.episodeSubtitle)?.textContent ?? null,
  };
  return adnEpisodeFromPlayer(overlay, episodeId, labels);
}

const STRATEGIES = [
  { name: 'JSON-LD', run: extractFromJsonLd },
  { name: 'lecteur', run: extractFromPlayer },
] as const;


// ─── Page de série (fiche « Sur cette page ») ──────────────────────────────

/** /video/{seriesId}-{seriesSlug}, sans segment d'épisode (préfixe de langue optionnel) */
const SERIES_PAGE_REGEX = /^\/(?:[a-z]{2}\/)?video\/(\d+)-([^/?#]+)\/?$/i;

const PLATFORM_NAME = /\bADN\b|animation\s*digital\s*network/i;

// ⚠️ Titre de la page de série (non vérifié hors ligne, à valider sur le site réel) : <h1> du bandeau.
const SERIES_TITLE_SELECTORS = ['main h1', 'h1'] as const;

export function parseAdnSeriesPath(pathname: string): { seriesId: string; seriesSlug: string } | null {
  const match = SERIES_PAGE_REGEX.exec(pathname);
  return match ? { seriesId: match[1], seriesSlug: match[2].toLowerCase() } : null;
}

/**
 * Nœud JSON-LD de la série (TVSeries, ou Movie pour un film) de la page de série. Hypothèse non vérifiée hors ligne :
 * { "@type": "TVSeries", name: "TOUGEN ANKI", url: ".../video/1311-tougen-anki" }.
 * Un nœud dont l'URL désigne une autre série (navigation SPA) est ignoré ; un nœud sans nom aussi.
 */
export function adnSeriesNode(nodes: readonly Record<string, unknown>[], seriesId: string): Record<string, unknown> | null {
  for (const node of nodes) {
    if (node['@type'] !== 'TVSeries' && node['@type'] !== 'Movie') continue;
    const urls = [node.url, node['@id']].map(cleanText).filter((u): u is string => u !== null);
    if (urls.length > 0 && !urls.some((u) => u.includes(`/video/${seriesId}-`))) continue;
    if (cleanText(node.name)) return node;
  }
  return null;
}

/** Titre de la série dans le JSON-LD (voir adnSeriesNode) */
export function adnSeriesTitleFromJsonLd(nodes: readonly Record<string, unknown>[], seriesId: string): string | null {
  return cleanText(adnSeriesNode(nodes, seriesId)?.name);
}

/** Pays d'origine du JSON-LD ADN (`countryOfOrigin.name` « Japon », relevé le 2026-10-14) → code ISO ; autres : ignorés */
const COUNTRIES: Readonly<Record<string, string>> = { japon: 'JP', japan: 'JP', 'corée du sud': 'KR', 'south korea': 'KR', südkorea: 'KR', chine: 'CN', china: 'CN' };

/**
 * Signaux de la série d'après son JSON-LD (page de série seulement : la page de lecture n'en porte pas, son
 * `partOfSeries` n'a que le nom ; relevé le 2026-10-14) : `@type` (série ou film), `datePublished` (« 2025 ») = année de
 * début de la SÉRIE, `alternativeHeadline` = titre original (« 桃源暗鬼 »), `countryOfOrigin.name`, et `numberOfEpisodes`
 * de la seule saison de `containsSeason` (aucune saison choisie sur la page ; plusieurs saisons : nombre non envoyé).
 * Saison en cours : nombre partiel, plus court qu'AniList, jamais une contradiction (aucun indice « en cours » lu).
 */
export function adnSeriesSignals(node: Record<string, unknown>): PlatformSignals | undefined {
  const published = node.datePublished;
  const year = /^\d{4}/.exec(typeof published === 'string' || typeof published === 'number' ? String(published).trim() : '')?.[0];
  const country = cleanText(isRecord(node.countryOfOrigin) ? node.countryOfOrigin.name : node.countryOfOrigin)?.toLowerCase();
  const seasons: unknown[] = Array.isArray(node.containsSeason) ? node.containsSeason : [];
  const [only] = seasons;
  return toPlatformSignals({
    format: node['@type'] === 'Movie' ? 'movie' : 'series',
    seriesYear: year !== undefined ? Number(year) : undefined,
    originalTitle: cleanText(node.alternativeHeadline),
    country: country !== undefined ? COUNTRIES[country] : undefined,
    seasonEpisodeCount: seasons.length === 1 && isRecord(only) ? toNumber(only.numberOfEpisodes) : undefined,
  });
}

/** Page de série : titre (JSON-LD → <h1> → og:title → slug) et signaux du JSON-LD. Saison non lisible : choisie par le service worker. */
function detectAdnSeries(url: URL): SeriesPageInfo | null {
  const path = parseAdnSeriesPath(url.pathname);
  if (!path) return null;

  const node = adnSeriesNode([...readJsonLdNodes('TVSeries'), ...readJsonLdNodes('Movie')], path.seriesId);
  const signals = node ? adnSeriesSignals(node) : undefined;
  const heading = SERIES_TITLE_SELECTORS.map((s) => cleanText(document.querySelector(s)?.textContent)).find(
    (text): text is string => text !== null && text.length <= 200,
  );
  const seriesTitle =
    cleanText(node?.name) ??
    heading ??
    cleanPageTitle(readMetaContent('og:title'), PLATFORM_NAME) ??
    slugToTitle(path.seriesSlug);
  if (!seriesTitle) return null;
  return { seriesId: path.seriesId, seriesSlug: path.seriesSlug, seriesTitle, seasonNumber: null, seasonTitle: null, ...(signals ? { signals } : {}) };
}

// ─── Adapter ──────────────────────────────────────────────────────────────

export const adnAdapter: StreamingAdapter = {
  platform: 'adn',

  supportsHost(hostname) {
    return hostname === 'animationdigitalnetwork.com' || hostname.endsWith('.animationdigitalnetwork.com');
  },

  getEpisodeId(url) {
    return parseAdnWatchPath(url.pathname)?.episodeId ?? null;
  },

  extractEpisodeInfo(url) {
    const path = parseAdnWatchPath(url.pathname);
    if (!path) return null;

    for (const strategy of STRATEGIES) {
      const fields = strategy.run(path.episodeId);
      if (fields) {
        labels.remember(path.episodeId, labelKey(fields.displayedEpisodeNumber, fields.episodeTitle));
        log.info(`Métadonnées extraites via ${strategy.name}`);
        return { platform: 'adn', episodeId: path.episodeId, seriesId: path.seriesId, seriesSlug: path.seriesSlug, url: url.href, ...fields };
      }
    }
    return null;
  },

  detectSeries(url) {
    return detectAdnSeries(url);
  },

  findVideo() {
    return findPlayerVideo(SELECTORS.playerVideo);
  },

  // Pas de données de générique connues chez ADN : complétion au pourcentage (réglable dans les options)
};
