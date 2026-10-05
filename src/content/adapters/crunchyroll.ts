import type { EpisodeInfo } from '../../shared/episode.types';
import { isRecord } from '../../shared/guards';
import { createLogger } from '../../shared/logger';
import {
  cleanPageTitle,
  cleanText,
  createLabelGuard,
  labelKey,
  readJsonLdNodes,
  readMetaContent,
  slugToTitle,
  stripAudioTag,
  stripCtaPrefix,
  toNumber,
} from './parsing';
import type { SeriesPageInfo, StreamingAdapter } from './adapter';

const log = createLogger('crunchyroll');

/**
 * /watch/{episodeId}/{slug}, avec préfixe de langue optionnel (/fr/watch/…).
 * Le slug est le titre de l'ÉPISODE, pas celui de l'anime : il ne sert pas à l'identification.
 */
const WATCH_PATH_REGEX = /^\/(?:[a-z]{2}(?:-[a-z]{2})?\/)?watch\/([A-Z0-9]+)(?:\/|$)/i;

/** /series/{seriesId}/{slug} (présent dans le JSON-LD et le lien vers la série) */
const SERIES_PATH_REGEX = /\/series\/([A-Z0-9]+)(?:\/([^/?#]+))?/i;

/**
 * Numéro + titre affichés par Crunchyroll, avec préfixe de saison optionnel :
 * - h1       : "E1180 - Le désespoir envahit Elbaph !"
 * - JSON-LD  : "Elbaph | E1180 - Le désespoir envahit Elbaph !"
 */
const EPISODE_LABEL_REGEX = /(?:^|\|)\s*E(\d+(?:\.\d+)?)\s*[-–—]\s*(.+)$/;

/** Horodatages intro / générique de fin par épisode (même source que le lecteur Crunchyroll) */
const SKIP_EVENTS_URL = 'https://static.crunchyroll.com/skip-events/production';

// ⚠️ Sélecteurs DOM (repli si le JSON-LD est absent) à valider sur le site réel :
// Crunchyroll modifie régulièrement ses classes CSS ; les attributs data-t sont plus stables.
const SELECTORS = {
  // Deux sélecteurs interrogés dans l'ordre (une liste "a, b" renverrait le premier dans le DOM)
  playerVideo: 'video[id^="bitmovinplayer-video"]',
  anyVideo: 'video',
  seriesLink: '[data-t="show-title-link"], a.show-title-link',
  episodeHeading: 'h1.title, [data-t="episode-title"], h1',
} as const;

type ExtractedFields = Omit<EpisodeInfo, 'platform' | 'episodeId' | 'url'>;

/** Évite d'attribuer au nouvel épisode le DOM de l'épisode précédent (voir createLabelGuard) */
const labels = createLabelGuard();

// ─── Helpers de parsing ────────────────────────────────────────────────────

function parseEpisodeLabel(label: string | null): { number: number | null; title: string | null } {
  const match = label ? EPISODE_LABEL_REGEX.exec(label) : null;
  return match ? { number: toNumber(match[1]), title: cleanText(match[2]) } : { number: null, title: label };
}

function parseSeries(url: unknown): { seriesId: string | null; seriesSlug: string | null } {
  const match = typeof url === 'string' ? SERIES_PATH_REGEX.exec(url) : null;
  return { seriesId: match?.[1] ?? null, seriesSlug: match?.[2]?.toLowerCase() ?? null };
}

// ─── Stratégies d'extraction (de la plus fiable à la moins fiable) ─────────

/**
 * 1. Données structurées schema.org (TVEpisode). Structure vérifiée le 2026-09-29 :
 *    { name: "Elbaph | E1180 - …", episodeNumber: 25,
 *      partOfSeason: { name: "Elbaph", seasonNumber: 24 },
 *      partOfSeries: { name: "One Piece", "@id": ".../series/GRMG8ZQZR/one-piece" } }
 */
function extractFromJsonLd(episodeId: string): ExtractedFields | null {
  for (const node of readJsonLdNodes('TVEpisode')) {
    // En SPA, le JSON-LD peut rester celui de l'épisode précédent : on vérifie qu'il correspond
    const nodeUrl = cleanText(node.url) ?? cleanText(node['@id']);
    if (nodeUrl && !nodeUrl.includes(episodeId)) continue;

    const series = isRecord(node.partOfSeries) ? node.partOfSeries : {};
    const season = isRecord(node.partOfSeason) ? node.partOfSeason : {};
    const animeTitle = cleanText(series.name);
    if (!animeTitle) continue;

    const label = parseEpisodeLabel(cleanText(node.name));
    return {
      ...parseSeries(series['@id']),
      animeTitle,
      seasonNumber: toNumber(season.seasonNumber),
      seasonTitle: cleanText(season.name),
      seasonEpisodeNumber: toNumber(node.episodeNumber),
      displayedEpisodeNumber: label.number,
      episodeTitle: label.title,
    };
  }
  return null;
}

/** 2. DOM de la page de lecture (moins riche : pas de saison ni de numéro relatif). */
function extractFromDom(episodeId: string): ExtractedFields | null {
  const seriesLink = document.querySelector<HTMLElement>(SELECTORS.seriesLink);
  const animeTitle = cleanText(seriesLink?.textContent);
  if (!animeTitle) return null;

  const label = parseEpisodeLabel(cleanText(document.querySelector(SELECTORS.episodeHeading)?.textContent));
  if (labels.isStale(episodeId, labelKey(label.number, label.title))) return null; // DOM de l'épisode précédent

  return {
    ...parseSeries(seriesLink?.closest('a')?.href),
    animeTitle,
    seasonNumber: null,
    seasonTitle: null,
    seasonEpisodeNumber: null,
    displayedEpisodeNumber: label.number,
    episodeTitle: label.title,
  };
}

// document.title volontairement exclu : en FR il contient le nom de la saison ("Elbaph …"),
// pas celui de l'anime, ce qui produirait une correspondance AniList erronée.
const STRATEGIES = [
  { name: 'JSON-LD', run: extractFromJsonLd },
  { name: 'DOM', run: extractFromDom },
] as const;


// ─── Page de série (fiche « Sur cette page ») ──────────────────────────────

/** /series/{seriesId}/{slug}, préfixe de langue optionnel : page de série uniquement (pas de sous-page) */
const SERIES_PAGE_REGEX = /^\/(?:[a-z]{2}(?:-[a-z]{2})?\/)?series\/([A-Z0-9]+)(?:\/([^/?#]+))?\/?$/i;

/**
 * Libellé de saison du sélecteur de la page de série, avec mention audio optionnelle :
 * "S2: Black Clover", "S1 : Elbaph (VF)" ; ou générique : "Saison 2", "Season 2", "Staffel 2".
 */
const SEASON_LABEL_REGEX = /^S(\d+)\s*[:：.-]\s*(.+)$/i;
// (?!\d) plutôt que \b : le sélecteur réel répète son libellé ("Season 1Season 1", vérifié le 2026-10-05)
const GENERIC_SEASON_LABEL_REGEX = /^(?:saison|season|staffel|temporada|stagione)\s+(\d+)(?!\d)/i;

// ⚠️ Sélecteurs de la page de série (non vérifiés hors ligne, à valider sur le site réel) :
// - titre : <h1> du bandeau de la série ;
// - saison : bouton du menu déroulant des saisons (texte "S2: …"), ou libellé seul s'il n'y a qu'une saison.
// Interrogés dans l'ordre ; le premier texte reconnu comme libellé de saison est retenu.
const SERIES_SELECTORS = {
  title: ['[data-t="series-hero-title"]', '.hero-heading-line h1', 'main h1', 'h1'],
  season: [
    '[data-t="seasons-select"]',
    '[data-t="seasons-dropdown"] [aria-expanded]',
    '[data-t="seasons-dropdown"]',
    '[data-t="season-select"]',
    '.seasons-select button',
    '.seasons-select',
    '[class*="seasons-select"] button',
    '[class*="season-info"]',
    '.season-info',
  ],
  // Entrées du menu des saisons ("Season 1" / "24 Episodes"), souvent rendues seulement menu ouvert
  seasonOptions: [
    '[data-t="seasons-select"] ~ * [role="option"]',
    '[data-t="seasons-dropdown"] [role="option"]',
    '[data-t="season-item"]',
    '[class*="seasons-select"] [role="option"]',
    '[role="listbox"] [role="option"]',
    '[class*="dropdown-content"] [role="option"]',
  ],
} as const;

const PLATFORM_NAME = /crunchyroll/i;

export function parseCrunchyrollSeriesPath(pathname: string): { seriesId: string; seriesSlug: string | null } | null {
  const match = SERIES_PAGE_REGEX.exec(pathname);
  return match ? { seriesId: match[1], seriesSlug: match[2]?.toLowerCase() ?? null } : null;
}

/** Libellé de saison → numéro + nom (null si le texte n'est pas un libellé de saison) */
export function parseCrunchyrollSeasonLabel(text: string | null): { number: number | null; title: string | null } | null {
  const label = cleanText(text);
  if (!label || label.length > 200) return null;
  const named = SEASON_LABEL_REGEX.exec(label);
  if (named) return { number: toNumber(named[1]), title: cleanText(stripAudioTag(named[2])) };
  const generic = GENERIC_SEASON_LABEL_REGEX.exec(label);
  return generic ? { number: toNumber(generic[1]), title: null } : null;
}

/**
 * Titre de la série dans le JSON-LD (TVSeries). Hypothèse non vérifiée hors ligne :
 * { "@type": "TVSeries", name: "Black Clover", url: ".../series/GRVN8MNQY/black-clover" }.
 * En SPA, un nœud dont l'URL désigne une autre série est ignoré.
 */
export function seriesTitleFromJsonLd(nodes: readonly Record<string, unknown>[], seriesId: string): string | null {
  for (const node of nodes) {
    if (node['@type'] !== 'TVSeries') continue;
    const urls = [node.url, node['@id']].map(cleanText).filter((u): u is string => u !== null);
    if (urls.length > 0 && !urls.some((u) => u.toLowerCase().includes(`/series/${seriesId.toLowerCase()}`))) continue;
    // Le nom réel est préfixé d'un appel à l'action ("Watch TOUGEN ANKI", vérifié le 2026-10-05)
    const name = cleanText(typeof node.name === 'string' ? stripCtaPrefix(node.name) : null);
    if (name) return name;
  }
  return null;
}

/** "25 Episodes", "24 épisodes", "12 Folgen" → nombre d'épisodes, sinon null */
const EPISODE_COUNT_REGEX = /(\d{1,4})\s*(?:[ée]pisodes?|folgen?|episodios?|epis[óo]dios?|episodi)(?![a-z])/i;

export function parseEpisodeCount(text: string | null): number | null {
  const match = text ? EPISODE_COUNT_REGEX.exec(text) : null;
  const count = match ? toNumber(match[1]) : null;
  return count !== null && count >= 1 ? count : null;
}

/**
 * Entrée du menu des saisons → numéro de saison + nombre d'épisodes. `parts` : textes des éléments
 * feuilles de l'entrée (le texte concaténé "Season 124 Episodes" serait ambigu), dans l'ordre du DOM.
 */
export function parseSeasonOption(parts: readonly string[]): { number: number; episodes: number | null } | null {
  let number: number | null = null;
  let episodes: number | null = null;
  for (const part of parts) {
    // Une même feuille peut porter les deux : "Season 2 · 25 Episodes"
    for (const piece of part.split(/[·•|/]/)) {
      episodes ??= parseEpisodeCount(piece);
      if (number === null && parseEpisodeCount(piece) === null) number = parseCrunchyrollSeasonLabel(piece)?.number ?? null;
    }
  }
  return number !== null ? { number, episodes } : null;
}

/** Nombre d'épisodes d'une saison dans le JSON-LD (TVSeries.containsSeason[].numberOfEpisodes), si présent */
export function seasonEpisodeCountFromJsonLd(nodes: readonly Record<string, unknown>[], seasonNumber: number): number | null {
  for (const node of nodes) {
    const seasons = Array.isArray(node.containsSeason) ? node.containsSeason : [node.containsSeason];
    for (const season of seasons) {
      if (!isRecord(season) || toNumber(season.seasonNumber) !== seasonNumber) continue;
      const count = toNumber(season.numberOfEpisodes);
      if (count !== null && Number.isInteger(count) && count >= 1) return count;
    }
  }
  return null;
}

/** Textes des éléments feuilles d'une entrée de menu (ou son propre texte) */
function leafTexts(el: Element): string[] {
  const leaves = [...el.querySelectorAll('*')].filter((child) => child.childElementCount === 0);
  return (leaves.length > 0 ? leaves : [el]).map((leaf) => cleanText(leaf.textContent)).filter((text): text is string => text !== null);
}

/** Nombre d'épisodes de la saison sélectionnée : JSON-LD, sinon entrée correspondante du menu des saisons */
function readSeasonEpisodeCount(seasonNumber: number | null): number | null {
  if (seasonNumber === null) return null;
  const fromJsonLd = seasonEpisodeCountFromJsonLd(readJsonLdNodes('TVSeries'), seasonNumber);
  if (fromJsonLd !== null) return fromJsonLd;
  for (const selector of SERIES_SELECTORS.seasonOptions) {
    for (const el of document.querySelectorAll(selector)) {
      const option = parseSeasonOption(leafTexts(el));
      if (option?.number === seasonNumber && option.episodes !== null) return option.episodes;
    }
  }
  return null;
}

function firstText(selectors: readonly string[], accept: (text: string) => boolean): string | null {
  for (const selector of selectors) {
    for (const el of document.querySelectorAll<HTMLElement>(selector)) {
      const text = cleanText(el.textContent);
      if (text && accept(text)) return text;
    }
  }
  return null;
}

/** Page de série : titre (JSON-LD → <h1> → og:title → slug) et saison sélectionnée si lisible */
function detectCrunchyrollSeries(url: URL): SeriesPageInfo | null {
  const path = parseCrunchyrollSeriesPath(url.pathname);
  if (!path) return null;

  const seriesTitle =
    seriesTitleFromJsonLd(readJsonLdNodes('TVSeries'), path.seriesId) ??
    firstText(SERIES_SELECTORS.title, (text) => text.length <= 200) ??
    cleanPageTitle(readMetaContent('og:title'), PLATFORM_NAME) ??
    slugToTitle(path.seriesSlug);
  if (!seriesTitle) return null;

  const seasonText = firstText(SERIES_SELECTORS.season, (text) => parseCrunchyrollSeasonLabel(text) !== null);
  const season = parseCrunchyrollSeasonLabel(seasonText);
  return {
    seriesId: path.seriesId,
    seriesSlug: path.seriesSlug,
    seriesTitle,
    seasonNumber: season?.number ?? null,
    seasonTitle: season?.title ?? null,
    seasonEpisodeCount: readSeasonEpisodeCount(season?.number ?? null),
  };
}

// ─── Adapter ──────────────────────────────────────────────────────────────

export const crunchyrollAdapter: StreamingAdapter = {
  platform: 'crunchyroll',

  supportsHost(hostname) {
    return hostname === 'crunchyroll.com' || hostname.endsWith('.crunchyroll.com');
  },

  getEpisodeId(url) {
    return WATCH_PATH_REGEX.exec(url.pathname)?.[1] ?? null;
  },

  extractEpisodeInfo(url) {
    const episodeId = this.getEpisodeId(url);
    if (!episodeId) return null;

    for (const strategy of STRATEGIES) {
      const fields = strategy.run(episodeId);
      if (fields) {
        labels.remember(episodeId, labelKey(fields.displayedEpisodeNumber, fields.episodeTitle));
        log.info(`Métadonnées extraites via ${strategy.name}`);
        return { platform: 'crunchyroll', episodeId, url: url.href, ...fields };
      }
    }
    return null;
  },

  detectSeries(url) {
    return detectCrunchyrollSeries(url);
  },

  findVideo() {
    return (
      document.querySelector<HTMLVideoElement>(SELECTORS.playerVideo) ?? document.querySelector<HTMLVideoElement>(SELECTORS.anyVideo)
    );
  },

  /**
   * Horodatages "skip events" (ceux du bouton "Passer le générique"). Structure vérifiée le 2026-09-29 :
   * { intro: { start: 111, end: 199 }, credits: { start: 1344, end: 1437 }, mediaId: "GE00374365JAJP" }
   * Absent pour certains épisodes (404) : le tracker se replie alors sur le pourcentage.
   */
  async getCreditsStart(episodeId, signal) {
    const url = `${SKIP_EVENTS_URL}/${encodeURIComponent(episodeId)}.json`;
    try {
      const response = await fetch(url, { signal, credentials: 'omit' });
      if (!response.ok) {
        log.info(`Pas de données de générique pour cet épisode (HTTP ${response.status})`);
        return null;
      }
      const data: unknown = await response.json();
      const start = isRecord(data) && isRecord(data.credits) ? toNumber(data.credits.start) : null;
      log.info(start !== null ? `Générique de fin annoncé à ${start} s` : 'Données de générique sans début de générique de fin');
      return start;
    } catch (error: unknown) {
      if (!signal.aborted) log.warn('Données de générique indisponibles :', error);
      return null;
    }
  },
};
