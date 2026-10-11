import { t } from '../../i18n';
import type { EpisodeInfo, StreamingPlatform } from '../../shared/episode.types';
import type { MediaMapping, NumberingMode } from '../../shared/sync.types';
import { groupSeasons, stripCourMarker } from './season-groups';

/** Formats AniList considérés comme des "saisons" (exclut films, OVA, spéciaux, clips) */
export const SERIES_FORMATS: ReadonlySet<string> = new Set(['TV', 'TV_SHORT', 'ONA']);

/** Formats AniList d'un épisode spécial, d'un OVA ou d'un film (saisons « spéciales » de la plateforme) */
export const SPECIAL_FORMATS: ReadonlySet<string> = new Set(['OVA', 'ONA', 'SPECIAL', 'MOVIE']);

/**
 * Lien entre une fiche AniList et la série de la plateforme :
 * - id       : externalLink vers /series/{seriesId} (fiable)
 * - slug     : ancien format d'URL crunchyroll.com/{slug}
 * - relation : suite/préquelle d'une fiche liée (même franchise)
 * - episode  : externalLink vers la page de lecture de l'épisode lui-même (/watch/{episodeId}),
 *              fréquent pour un spécial rangé dans une saison de la série (ex : ONE PIECE HEROINES)
 * - other    : externalLink vers une AUTRE série de la même plateforme (Naruto pour la page Naruto Shippuden) :
 *              jamais une saison de la série, ni un relais de propagation des relations (voir linksToOtherSeries)
 * - other-slug : comme `other`, mais désignée par un ancien slug différent (crunchyroll.com/naruto sur la page
 *              naruto-shippuden) : signal faible, un slug a pu être renommé (voir linksToOtherSeriesBySlug)
 */
export type LinkKind = 'id' | 'slug' | 'relation' | 'episode' | 'other' | 'other-slug' | null;

/** Fiche liée seulement à une autre série de la plateforme (identifiant ou ancien slug différent) */
export const isOtherSeries = (candidate: Pick<MediaCandidate, 'link'>): boolean => candidate.link === 'other' || candidate.link === 'other-slug';

/** Fiche rattachée à la série de la plateforme (lien direct, épisode ou suite/préquelle d'une fiche liée) */
export const isLinked = (candidate: Pick<MediaCandidate, 'link'>): boolean => candidate.link !== null && !isOtherSeries(candidate);

/** Fiche liée directement à la série ou à l'épisode (hors rattachement par relation) */
const isDirectlyLinked = (candidate: Pick<MediaCandidate, 'link'>): boolean => candidate.link === 'id' || candidate.link === 'slug' || candidate.link === 'episode';

export interface MediaCandidate {
  id: number;
  format: string | null;
  episodes: number | null;
  /** Date de début triable (AAAAMMJJ), null si inconnue */
  startDate: number | null;
  titles: string[];
  link: LinkKind;
}

export type EpisodeNumbers = Pick<
  EpisodeInfo,
  'animeTitle' | 'seasonTitle' | 'seasonNumber' | 'seasonEpisodeNumber' | 'displayedEpisodeNumber'
>;

export interface SyncTarget extends MediaMapping {
  progress: number;
  confidence: 'high' | 'low';
  /** Explication lisible du choix (logs / toast "à vérifier") */
  reason: string;
  /** Correspondance lue dans le cache (à revalider avec le catalogue avant d'écrire, voir syncEpisode) */
  fromCache?: true;
}

/** `ignored` : série hors du périmètre de la plateforme (Netflix sans fiche AniList liée ni au même titre), ignorée en silence */
export type ResolveResult = { ok: true; target: SyncTarget } | { ok: false; reason: string; ignored?: true };

// ─── Helpers ──────────────────────────────────────────────────────────────

/** "Shingeki no Kyojin: Season 2" → "shingeki no kyojin season 2" (accents et ponctuation retirés) */
export function normalizeTitle(title: string): string {
  return title
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function toSortableDate(date: { year: number | null; month: number | null; day: number | null } | null): number | null {
  if (!date?.year) return null;
  // Mois/jour inconnus : placés en fin de période pour ne pas passer devant une date précise
  return date.year * 10_000 + (date.month ?? 12) * 100 + (date.day ?? 31);
}

export function matchCrunchyrollLink(url: string, seriesId: string | null, seriesSlug: string | null): LinkKind {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (!/(^|\.)crunchyroll\.com$/i.test(parsed.hostname)) return null;

  const segments = parsed.pathname.toLowerCase().split('/').filter(Boolean);
  const seriesIndex = segments.indexOf('series');
  if (seriesIndex !== -1) {
    return seriesId && segments[seriesIndex + 1] === seriesId.toLowerCase() ? 'id' : null;
  }
  // Ancien format : /{slug} ou /{langue}/{slug}
  return seriesSlug && segments.length <= 2 && segments.at(-1) === seriesSlug ? 'slug' : null;
}

/** Libellé lisible d'une saison : "One Piece · S24 (Elbaph)" */
export function seasonLabel(episode: Pick<EpisodeInfo, 'animeTitle' | 'seasonNumber' | 'seasonTitle'>): string {
  const season = episode.seasonNumber !== null ? ` · S${episode.seasonNumber}` : '';
  const hasDistinctTitle = episode.seasonTitle && normalizeTitle(episode.seasonTitle) !== normalizeTitle(episode.animeTitle);
  return `${episode.animeTitle}${season}${hasDistinctTitle ? ` (${episode.seasonTitle})` : ''}`;
}

/**
 * Lien ADN : /video/{seriesId}-{slug} (actuel) ou /video/{slug} (ancien format),
 * sur animationdigitalnetwork.com / .fr / .de.
 */
export function matchAdnLink(url: string, seriesId: string | null, seriesSlug: string | null): LinkKind {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (!/(^|\.)animationdigitalnetwork\.(com|fr|de)$/i.test(parsed.hostname)) return null;

  const segments = parsed.pathname.toLowerCase().split('/').filter(Boolean);
  const series = segments[segments.indexOf('video') + 1];
  if (!segments.includes('video') || !series) return null;
  const [, linkedId, linkedSlug] = /^(?:(\d+)-)?(.+)$/.exec(series) ?? [];
  if (linkedId !== undefined) {
    // Identifiant explicite : il fait foi (un slug identique avec un autre identifiant est une autre série)
    return seriesId !== null && linkedId === seriesId ? 'id' : null;
  }
  // Ancien format sans identifiant : comparaison du slug
  return seriesSlug && linkedSlug === seriesSlug ? 'slug' : null;
}

/**
 * Lien Netflix vers la fiche de la série : /title/{seriesId}, éventuellement précédé du pays
 * (/be-fr/title/{id}, /us/title/{id}). Les pages de lecture (/watch/{id}) ne désignent pas la série.
 */
export function matchNetflixLink(url: string, seriesId: string | null): LinkKind {
  if (!seriesId) return null;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (!/(^|\.)netflix\.com$/i.test(parsed.hostname)) return null;
  const match = /^\/(?:[a-z]{2}(?:-[a-z]{2})?\/)?title\/(\d+)\/?$/i.exec(parsed.pathname);
  return match?.[1] === seriesId ? 'id' : null;
}

/** Lien Crunchyroll vers la page de lecture d'un épisode précis : /watch/{episodeId}[/slug] */
export function matchCrunchyrollEpisodeLink(url: string, episodeId: string | null): boolean {
  if (!episodeId) return false;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (!/(^|\.)crunchyroll\.com$/i.test(parsed.hostname)) return false;
  const segments = parsed.pathname.toLowerCase().split('/').filter(Boolean);
  const watchIndex = segments.indexOf('watch');
  return watchIndex !== -1 && segments[watchIndex + 1] === episodeId.toLowerCase();
}

/**
 * Lien d'une fiche AniList vers la série de la plateforme de l'épisode, ou vers l'épisode lui-même
 * (`episodeId` : page de lecture uniquement).
 */
export function matchPlatformLink(
  url: string,
  platform: StreamingPlatform,
  seriesId: string | null,
  seriesSlug: string | null,
  episodeId: string | null = null,
): LinkKind {
  switch (platform) {
    case 'crunchyroll':
      return matchCrunchyrollEpisodeLink(url, episodeId) ? 'episode' : matchCrunchyrollLink(url, seriesId, seriesSlug);
    case 'adn':
      return matchAdnLink(url, seriesId, seriesSlug);
    case 'netflix':
      return matchNetflixLink(url, seriesId);
  }
}

/**
 * Identifiant de série explicite d'un lien de la plateforme : /series/{id} (Crunchyroll), /video/{id}-{slug} (ADN),
 * /title/{id} (Netflix). null pour un autre site, une page de lecture ou l'ancien format Crunchyroll par slug.
 */
function seriesIdInLink(url: string, platform: StreamingPlatform): string | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  const segments = parsed.pathname.toLowerCase().split('/').filter(Boolean);
  switch (platform) {
    case 'crunchyroll': {
      if (!/(^|\.)crunchyroll\.com$/i.test(parsed.hostname)) return null;
      const index = segments.indexOf('series');
      return index === -1 ? null : (segments[index + 1] ?? null);
    }
    case 'adn': {
      if (!/(^|\.)animationdigitalnetwork\.(com|fr|de)$/i.test(parsed.hostname)) return null;
      const index = segments.indexOf('video');
      return index === -1 ? null : (/^(\d+)-/.exec(segments[index + 1] ?? '')?.[1] ?? null);
    }
    case 'netflix': {
      if (!/(^|\.)netflix\.com$/i.test(parsed.hostname)) return null;
      return /^\/(?:[a-z]{2}(?:-[a-z]{2})?\/)?title\/(\d+)\/?$/i.exec(parsed.pathname)?.[1] ?? null;
    }
  }
}

/**
 * Lien vers une AUTRE série de la même plateforme, désignée par son identifiant (Naruto → /series/{id de Naruto}
 * sur la page Naruto Shippuden). Un slug seul (ancien format Crunchyroll) ne suffit pas : les slugs ont pu être
 * renommés ou fusionnés, et exclure à tort une saison décalerait toutes les suivantes.
 */
export function linksToOtherSeries(url: string, platform: StreamingPlatform, seriesId: string | null): boolean {
  if (!seriesId) return false;
  const linkedId = seriesIdInLink(url, platform);
  return linkedId !== null && linkedId !== seriesId.toLowerCase();
}

/**
 * Même série sur l'ancien site Crunchyroll : même slug, ou sa page de version doublée
 * (« attack-on-titan-dubs », fréquente dans les liens AniList à côté de la page principale).
 */
function isSameCrunchyrollSlug(linkedSlug: string, slug: string): boolean {
  return linkedSlug === slug || linkedSlug === `${slug}-dubs` || linkedSlug === `${slug}-dub`;
}

/**
 * Ancien lien sans identifiant vers une AUTRE série de la plateforme : crunchyroll.com/{slug} (ou /{langue}/{slug}),
 * animationdigitalnetwork.fr/video/{slug}, slug différent de celui de la série. Signal faible (slug renommé ou
 * ancienne page par saison possible) : la fiche est écartée, mais la confiance du résultat est plafonnée
 * (voir resolveTarget).
 */
export function linksToOtherSeriesBySlug(url: string, platform: StreamingPlatform, seriesSlug: string | null): boolean {
  if (!seriesSlug) return false;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  const segments = parsed.pathname.toLowerCase().split('/').filter(Boolean);
  const slug = seriesSlug.toLowerCase();
  switch (platform) {
    case 'crunchyroll': {
      if (!/(^|\.)crunchyroll\.com$/i.test(parsed.hostname)) return false;
      // Page de série de l'ancien site uniquement : /{slug} ou /{langue}/{slug} (pas /{slug}/episode-…, /series/…, /watch/…)
      const isSeriesPage = segments.length === 1 || (segments.length === 2 && /^[a-z]{2}(?:-[a-z]{2})?$/.test(segments[0] ?? ''));
      const linkedSlug = segments.at(-1);
      return isSeriesPage && linkedSlug !== undefined && !['series', 'watch'].includes(linkedSlug) && !isSameCrunchyrollSlug(linkedSlug, slug);
    }
    case 'adn': {
      if (!/(^|\.)animationdigitalnetwork\.(com|fr|de)$/i.test(parsed.hostname)) return false;
      const index = segments.indexOf('video');
      const linkedSlug = index === -1 ? undefined : segments[index + 1];
      // Avec identifiant (/video/{id}-{slug}) : signal fort, traité par linksToOtherSeries
      return linkedSlug !== undefined && !/^\d+-/.test(linkedSlug) && linkedSlug !== slug;
    }
    case 'netflix':
      return false;
  }
}

/** Clé de cache d'une saison : "crunchyroll:GRMG8ZQZR:s24" */
export function mappingKey(episode: Pick<EpisodeInfo, 'platform' | 'seriesId' | 'animeTitle' | 'seasonNumber'>): string {
  const series = episode.seriesId ?? `title:${normalizeTitle(episode.animeTitle)}`;
  return `${episode.platform}:${series}:s${episode.seasonNumber ?? 0}`;
}

/** Applique une correspondance en cache ; null si elle ne s'applique plus (ex : saison suivante). */
export function applyMapping(episode: EpisodeNumbers, mapping: MediaMapping): number | null {
  const base =
    mapping.numbering === 'displayed'
      ? episode.displayedEpisodeNumber
      : (episode.seasonEpisodeNumber ?? episode.displayedEpisodeNumber);
  if (base === null) return null;
  const progress = base - mapping.offset;
  return isValidProgress(progress, mapping.episodes) ? progress : null;
}

/**
 * Déduit une correspondance d'un choix manuel (fiche + épisode AniList confirmé par l'utilisateur).
 * Ex : Crunchyroll affiche E28, l'utilisateur confirme l'épisode 4 → numbering "displayed", offset 24,
 * donc E29 donnera 5. Retourne null si la progression est invalide pour la fiche.
 */
export function mappingFromManualChoice(
  episode: EpisodeNumbers,
  mediaId: number,
  progress: number,
  episodes: number | null,
): MediaMapping | null {
  if (!isValidProgress(progress, episodes)) return null;
  const { seasonEpisodeNumber: season, displayedEpisodeNumber: displayed } = episode;

  // Numéro dans la saison identique : correspondance la plus simple et la plus stable
  if (season !== null && progress === season) return { mediaId, numbering: 'season', offset: 0, episodes };
  if (displayed !== null) return { mediaId, numbering: 'displayed', offset: displayed - progress, episodes };
  if (season !== null) return { mediaId, numbering: 'season', offset: season - progress, episodes };
  return null;
}

function isValidProgress(progress: number, episodes: number | null): boolean {
  return Number.isInteger(progress) && progress >= 1 && (episodes === null || progress <= episodes);
}

const fits = (candidate: MediaCandidate, progress: number): boolean => isValidProgress(progress, candidate.episodes);

const byStartDate = (a: MediaCandidate, b: MediaCandidate): number =>
  (a.startDate ?? Number.MAX_SAFE_INTEGER) - (b.startDate ?? Number.MAX_SAFE_INTEGER);

/**
 * Répartit un numéro sur des saisons consécutives à partir de `startIndex`
 * (ex : épisode 30 avec des saisons de 25 et 12 épisodes → 2e saison, épisode 5).
 */
function walkSeasons(seasons: MediaCandidate[], startIndex: number, episode: number): { index: number; progress: number } | null {
  let remaining = episode;
  for (let i = startIndex; i < seasons.length; i++) {
    const { episodes } = seasons[i];
    // Nombre d'épisodes inconnu = saison en cours de diffusion (ex : One Piece) : elle absorbe le reste,
    // même si des fiches plus récentes existent (saison annoncée, refonte "Log" liée à la même série…)
    if (episodes === null || remaining <= episodes) return { index: i, progress: remaining };
    remaining -= episodes;
  }
  return null;
}

// ─── Résolution ───────────────────────────────────────────────────────────

/**
 * Saisons de la série, dans l'ordre de diffusion : fiches séries liées à la plateforme,
 * ou à défaut fiches séries au titre identique. Partagé par la synchro et la fiche de la page.
 */
/** Titre (normalisé) terminé par un mot de spécial : « … season 5 ova », « … specials », « … recap » */
const SPECIAL_TITLE_END = / (?:ovas?|oads?|specials?|recaps?)$/;

export function seasonPool(candidates: readonly MediaCandidate[], animeTitle: string): MediaCandidate[] {
  // Fiche liée à une autre série de la plateforme (préquelle Naruto de Naruto Shippuden) : jamais une saison
  const formats = candidates.filter((c) => c.format !== null && SERIES_FORMATS.has(c.format) && !isOtherSeries(c));
  // ONA titrée comme un spécial (« My Hero Academia Season 5 OVA ») : pas une saison, elle décalerait les suivantes
  const regular = formats.filter((c) => !c.titles.some((title) => SPECIAL_TITLE_END.test(normalizeTitle(title))));
  const seasons = (regular.length > 0 ? regular : formats).sort(byStartDate);
  const linked = seasons.filter(isLinked);
  if (linked.length > 0) return linked;
  // Sans lien vers la plateforme, repli sur un titre identique, parties (« Moriarty the Patriot Part 2 ») et
  // saisons numérotées (« Kaiju No. 8 Season 2 ») comprises
  const animeKey = normalizeTitle(animeTitle);
  return seasons.filter((c) => titleSeasonOf(c.titles, animeKey) !== null);
}

/** « kaiju no 8 season 2 » → { base: « kaiju no 8 », season: 2 } (titre normalisé) ; null sans numéro de saison final */
function seasonMarker(key: string): { base: string; season: number } | null {
  const match = / (?:season|saison|staffel) (\d{1,2})$/.exec(key) ?? / (\d{1,2})(?:st|nd|rd|th) season$/.exec(key);
  const season = match ? Number(match[1]) : 0;
  return match && season >= 1 ? { base: key.slice(0, match.index), season } : null;
}

/**
 * Saison désignée par le titre d'une fiche, pour une série sans lien vers la plateforme : 1 pour le titre de la
 * série (ou l'une de ses parties « Part 2 »), N pour « Série Season N » / « Série 2nd Season » (parties comprises),
 * null si la fiche ne porte pas le titre de la série.
 */
export function titleSeasonOf(titles: readonly string[], animeKey: string): number | null {
  let numbered: number | null = null;
  for (const title of titles) {
    const key = normalizeTitle(title);
    const part = stripCourMarker(title);
    if (key === animeKey || part?.base === animeKey) return 1;
    const marker = seasonMarker(part?.base ?? key);
    if (marker && marker.base === animeKey) numbered ??= marker.season;
  }
  return numbered;
}

/**
 * Numéro de saison écrit dans le titre de saison : « Season 2 », « Saison 2 », « Staffel 2 », « 2nd Season ».
 * Crunchyroll compte parfois une saison spéciale dans `season_number` (Kaiju No. 8 : S3 « Season 2 »).
 * « Part N » n'est pas un numéro de saison (JoJo « Part 3 », cours d'une même saison).
 */
export function seasonNumberFromTitle(seasonTitle: string | null): number | null {
  if (!seasonTitle) return null;
  const match = /\b(?:season|saison|staffel|temporada)\s*(\d{1,2})\b/i.exec(seasonTitle) ?? /\b(\d{1,2})\s*(?:st|nd|rd|th)\s+season\b/i.exec(seasonTitle);
  const value = match ? Number(match[1]) : null;
  return value !== null && value >= 1 ? value : null;
}

/** Numéro de saison retenu pour choisir la fiche : celui du titre de saison s'il en contient un, sinon celui de la plateforme */
export function effectiveSeasonNumber(episode: Pick<EpisodeNumbers, 'seasonNumber' | 'seasonTitle'>): number | null {
  return seasonNumberFromTitle(episode.seasonTitle) ?? episode.seasonNumber;
}

/** Mots qui désignent une saison spéciale dans son titre (« OVA Season 1 », « Extras », « Specials », « Movie »…) */
const SPECIAL_SEASON = /\b(?:ovas?|oads?|extras?|specials?|speciaux|movies?|films?|recaps?)\b/;

/**
 * Saison spéciale de la plateforme : saison 0, ou titre de saison (hors titre de la série) désignant des
 * OVA, des extras, des spéciaux ou un film. Ses épisodes ne sont jamais ceux de la N-ième saison AniList.
 */
export function isSpecialSeason(episode: Pick<EpisodeNumbers, 'animeTitle' | 'seasonTitle' | 'seasonNumber'>): boolean {
  if (episode.seasonNumber === 0) return true;
  if (!episode.seasonTitle) return false;
  const animeKey = normalizeTitle(episode.animeTitle);
  let key = normalizeTitle(episode.seasonTitle);
  if (!key || key === animeKey) return false;
  if (key.startsWith(`${animeKey} `)) key = key.slice(animeKey.length + 1);
  return SPECIAL_SEASON.test(key);
}

/**
 * Recherche AniList complémentaire pour un titre de saison distinct de la série : « One Piece HEROINES ».
 * Un titre de saison qui reprend déjà la série ("Attack on Titan Season 2") est cherché tel quel.
 * null : pas de titre de saison, ou identique à la série.
 */
export function seasonSearchQuery(animeTitle: string, seasonTitle: string | null): string | null {
  if (!seasonTitle) return null;
  const animeKey = normalizeTitle(animeTitle);
  const seasonKey = normalizeTitle(seasonTitle);
  if (!seasonKey || seasonKey === animeKey) return null;
  return seasonKey.startsWith(`${animeKey} `) ? seasonTitle : `${animeTitle} ${seasonTitle}`;
}

/** Fiche dédiée à l'épisode ou à sa saison, hors des saisons de la série (spécial, film, fiche non liée…) */
interface DedicatedEntry {
  candidate: MediaCandidate;
  progress: number;
  confident: boolean;
  reason: string;
}

/** Mots du titre de saison retrouvés tels quels dans un titre normalisé ("heroines" ⊂ "one piece heroines") */
const containsWords = (key: string, words: string): boolean => ` ${key} `.includes(` ${words} `);

/**
 * Fiche hors des saisons de la série désignant précisément l'épisode (numérotation relative uniquement) :
 * a) fiche liée à la page de lecture de l'épisode (/watch/{episodeId}) ;
 * b) fiche dont le titre est celui de la saison ("HEROINES" → « ONE PIECE HEROINES », spécial rangé
 *    en saison 30 de One Piece sur Crunchyroll) : titre exact, « série + saison », ou titre commençant par
 *    la série et contenant le titre de saison ; une seule fiche doit correspondre ;
 * c) aucune saison série : fiche unique au titre exact de la série (ex : spécial publié comme série à part).
 */
function dedicatedEntry(
  episode: EpisodeNumbers,
  candidates: readonly MediaCandidate[],
  pool: readonly MediaCandidate[],
  relative: number,
): DedicatedEntry | null {
  const poolIds = new Set(pool.map((c) => c.id));
  const outside = candidates.filter((c) => c.format !== 'MUSIC' && !poolIds.has(c.id));
  if (outside.length === 0) return null;

  // a) Lien vers l'épisode : une fiche à épisode unique (spécial, film) absorbe l'épisode quel que soit son numéro
  const byEpisode = outside.filter((c) => c.link === 'episode');
  if (byEpisode.length === 1) {
    const [only] = byEpisode;
    const progress = fits(only, relative) ? relative : only.episodes === 1 ? 1 : null;
    if (progress !== null) return { candidate: only, progress, confident: true, reason: t('match.episodeLink') };
  }

  // a') Épisode sans saison (film Netflix) et aucune saison série liée : fiche film / spécial liée à la série
  //     elle-même. Elle prime sur une série TV homonyme non liée (« Bubble » TV contre le film « Bubble »).
  const hasLinkedSeries = candidates.some((c) => isLinked(c) && c.format !== null && SERIES_FORMATS.has(c.format));
  if (episode.seasonNumber === null && !hasLinkedSeries) {
    const direct = outside.filter((c) => (c.link === 'id' || c.link === 'slug') && c.format !== null && !SERIES_FORMATS.has(c.format));
    if (direct.length === 1 && fits(direct[0], relative)) {
      return { candidate: direct[0], progress: relative, confident: true, reason: t('match.linkedEntry') };
    }
  }

  const animeKey = normalizeTitle(episode.animeTitle);
  const seasonKey = episode.seasonTitle ? normalizeTitle(episode.seasonTitle) : '';
  const keysOf = (c: MediaCandidate): string[] => c.titles.map(normalizeTitle);
  // Une saison de la série porte déjà ce titre (« Attack on Titan Season 2 ») : l'étape 3 s'en charge,
  // un OVA « … Season 2 OVA » ne doit pas lui voler l'épisode
  const isPoolSeason = pool.some((c) => keysOf(c).some((k) => containsWords(k, seasonKey)));
  if (seasonKey.length >= 3 && seasonKey !== animeKey && !isPoolSeason) {
    const compound = seasonKey.startsWith(`${animeKey} `) ? seasonKey : `${animeKey} ${seasonKey}`;
    const exact = outside.filter((c) => keysOf(c).some((k) => k === compound || k === seasonKey));
    const loose = outside.filter((c) => keysOf(c).some((k) => k.startsWith(`${animeKey} `) && containsWords(k, seasonKey)));
    const matches = exact.length > 0 ? exact : loose;
    if (matches.length === 1 && fits(matches[0], relative)) {
      const [only] = matches;
      // Titre « série + saison » ou fiche liée : fiable ; titre de saison seul ou simplement inclus : à vérifier
      const confident = isLinked(only) || keysOf(only).includes(compound);
      return { candidate: only, progress: relative, confident, reason: t('match.dedicatedSeason', { title: episode.seasonTitle ?? '' }) };
    }
  }

  if (pool.length === 0) {
    const sameTitle = outside.filter((c) => c.titles.some((title) => normalizeTitle(title) === animeKey));
    if (sameTitle.length === 1 && fits(sameTitle[0], relative)) {
      const [only] = sameTitle;
      return { candidate: only, progress: relative, confident: isLinked(only), reason: t('match.dedicatedSeries') };
    }
  }
  return null;
}

/** « ova season 1 » → « ova » : la 1re saison d'OVA porte souvent le titre AniList « … OVA » */
const withoutFirstSeason = (key: string): string => key.replace(/ (?:season 1|saison 1|staffel 1|1st season)$/, '');

/**
 * Fiche d'une saison spéciale (OVA, spéciaux, film) : fiche unique au titre exact parmi les formats spéciaux.
 * Titres acceptés : celui de la saison, « série + saison » (sans « Season 1 »), ou celui de la série pour une
 * saison sans titre propre (JUJUTSU KAISEN 0 · S0 → film « Jujutsu Kaisen 0 »). null si aucune ou plusieurs.
 */
function specialEntry(episode: EpisodeNumbers, candidates: readonly MediaCandidate[], relative: number): MediaCandidate | null {
  const animeKey = normalizeTitle(episode.animeTitle);
  const seasonKey = episode.seasonTitle ? normalizeTitle(episode.seasonTitle) : '';
  const wanted = new Set<string>();
  if (!seasonKey || seasonKey === animeKey) {
    wanted.add(animeKey);
  } else {
    const compound = seasonKey.startsWith(`${animeKey} `) ? seasonKey : `${animeKey} ${seasonKey}`;
    for (const key of [seasonKey, compound]) {
      wanted.add(key);
      wanted.add(withoutFirstSeason(key));
    }
    // Titre réduit à celui de la série une fois « Season 1 » retiré : ce n'est plus le titre d'un spécial
    wanted.delete(animeKey);
  }
  const matches = candidates.filter((c) => c.format !== null && SPECIAL_FORMATS.has(c.format) && c.titles.some((title) => wanted.has(normalizeTitle(title))));
  return matches.length === 1 && fits(matches[0], relative) ? matches[0] : null;
}

/** Choisit la fiche AniList et la progression correspondant à un épisode. */
export function resolveTarget(episode: EpisodeNumbers, candidates: MediaCandidate[]): ResolveResult {
  const linked = candidates.filter((c) => isLinked(c) && c.format !== null && SERIES_FORMATS.has(c.format));
  const animeKey = normalizeTitle(episode.animeTitle);
  const pool = seasonPool(candidates, episode.animeTitle);
  const noEntry: ResolveResult = { ok: false, reason: t('match.noEntry', { title: episode.animeTitle }) };

  const seasonNumber = effectiveSeasonNumber(episode);
  // Titre seul jugé fiable uniquement s'il désigne UNE saison (une fiche, ou ses parties « Part 2 ») et qu'il
  // s'agit de la 1re saison (fréquent sur ADN, rarement lié sur AniList). Remakes au même titre → plusieurs saisons → à vérifier.
  // Sans lien : fiches au titre de la série (saison 1), hors « Série Season N »
  const basePool = linked.length > 0 ? pool : pool.filter((c) => titleSeasonOf(c.titles, animeKey) === 1);
  const isSoleSeason = basePool.length > 0 && groupSeasons(basePool).length === 1;
  const isTrustedTitleMatch = linked.length === 0 && isSoleSeason && (seasonNumber ?? 1) === 1;
  const level = (isConfident: boolean): 'high' | 'low' => (isConfident && (linked.length > 0 || isTrustedTitleMatch) ? 'high' : 'low');

  const displayed = episode.displayedEpisodeNumber;
  const relative = episode.seasonEpisodeNumber ?? displayed;
  if (relative === null) return pool.length === 0 ? noEntry : { ok: false, reason: t('match.noNumber') };
  if (!Number.isInteger(relative) || (displayed !== null && !Number.isInteger(displayed))) {
    return pool.length === 0 ? noEntry : { ok: false, reason: t('match.special') };
  }
  // Ex. One Piece : "E1180" affiché pour le 25e épisode de la saison 24
  const isAbsolute = displayed !== null && episode.seasonEpisodeNumber !== null && displayed > episode.seasonEpisodeNumber;

  // Fiche écartée sur un ancien slug différent : ce peut être une vraie saison dont la page a été renommée
  // (ancienne page par saison). Les saisons suivantes seraient alors décalées d'un cran (épisode de S2 compté sur
  // la fiche de S3) : seul un choix lié directement à la série ou à l'épisode reste fiable, le reste passe en
  // vérification (jamais mis en cache).
  const hasWeakExclusion = candidates.some((c) => c.link === 'other-slug');

  const target = (
    candidate: MediaCandidate,
    base: number,
    progress: number,
    numbering: NumberingMode,
    confidence: 'high' | 'low',
    reason: string,
    trustedReason: string = t('match.titleOnlyTrusted'),
  ): ResolveResult => {
    const isCapped = confidence === 'high' && hasWeakExclusion && !isDirectlyLinked(candidate);
    return {
      ok: true,
      target: {
        mediaId: candidate.id,
        numbering,
        offset: base - progress,
        episodes: candidate.episodes,
        progress,
        confidence: isCapped ? 'low' : confidence,
        reason: isCapped
          ? t('match.otherSeriesExcluded')
          : linked.length === 0 && !isLinked(candidate)
            ? confidence === 'high'
              ? trustedReason
              : // Sans lien plateforme, c'est l'absence de lien (et non la règle appliquée) qui rend le choix incertain
                t('match.titleOnly')
            : reason,
      },
    };
  };

  // Saison spéciale (OVA, extras, spéciaux, film) : jamais la N-ième saison de la série. Fiche liée à l'épisode
  // ou dédiée à la saison, sinon fiche spéciale unique au titre exact, sinon à choisir.
  if (isSpecialSeason(episode)) {
    const own = dedicatedEntry(episode, candidates, pool, relative);
    if (own?.confident) return target(own.candidate, relative, own.progress, 'season', 'high', own.reason, own.reason);
    const special = specialEntry(episode, candidates, relative);
    if (special) return target(special, relative, relative, 'season', 'high', t('match.specialTitle'), t('match.specialTitle'));
    if (own) return target(own.candidate, relative, own.progress, 'season', 'low', own.reason);
    return { ok: false, reason: t('match.specialSeason') };
  }

  // 0. Fiche dédiée à l'épisode ou à sa saison (spécial rangé dans une saison de la série) : prime sur la
  //    fiche unique, qui avalerait sinon l'épisode 1 de « saison 30 » comme épisode 1 de One Piece.
  //    Jamais en numérotation absolue (One Piece E1180 reste sur la fiche principale).
  if (!isAbsolute) {
    const own = dedicatedEntry(episode, candidates, pool, relative);
    if (own) return target(own.candidate, relative, own.progress, 'season', own.confident ? 'high' : 'low', own.reason);
  }
  if (pool.length === 0) return noEntry;

  // 1. Fiche unique (ex : One Piece, une seule entrée AniList)
  if (pool.length === 1) {
    const only = pool[0];
    if (isAbsolute && displayed !== null && fits(only, displayed)) {
      // Numérotation absolue qui tient dans la seule fiche au titre de la série (One Piece E1180) : fiable
      // même sans lien plateforme, quelle que soit la saison
      return target(only, displayed, displayed, 'displayed', 'high', t('match.singleAbsolute'), t('match.titleOnlyAbsolute'));
    }
    if (fits(only, relative)) {
      // Saison > 1 mais une seule fiche : la suite n'est peut-être pas liée sur AniList
      const isLaterSeason = !isAbsolute && (seasonNumber ?? 1) > 1;
      return target(only, relative, relative, 'season', level(!isLaterSeason), isLaterSeason
        ? t('match.singleLaterSeason', { season: seasonNumber ?? '?' })
        : t('match.single'));
    }
    return { ok: false, reason: t('match.beyondAniList', { episode: displayed ?? relative, total: only.episodes ?? '?' }) };
  }

  // 2. Plusieurs saisons, numérotation absolue : répartition cumulative
  if (isAbsolute && displayed !== null) {
    const hit = walkSeasons(pool, 0, displayed);
    if (hit && fits(pool[hit.index], hit.progress)) {
      // Sans lien : sûr si la fiche atteinte porte le numéro de la saison (« Kaiju No. 8 Season 2 » pour « Season 2 ») :
      // la numérotation absolue et le titre concordent
      const agrees = seasonNumber !== null && titleSeasonOf(pool[hit.index].titles, animeKey) === seasonNumber;
      return target(pool[hit.index], displayed, hit.progress, 'displayed', agrees ? 'high' : level(true), t('match.absoluteSplit', { count: pool.length }), t('match.titleOnlySeason', { season: seasonNumber ?? '?' }));
    }
  }

  // 3. Numérotation relative : saison identifiée par son titre…
  const seasonKey = episode.seasonTitle ? normalizeTitle(episode.seasonTitle) : '';
  if (seasonKey && seasonKey !== animeKey) {
    const exact = pool.filter((c) => c.titles.some((t) => normalizeTitle(t) === seasonKey));
    const matches = exact.length > 0 ? exact : pool.filter((c) => c.titles.some((t) => normalizeTitle(t).includes(seasonKey)));
    if (matches.length === 1 && fits(matches[0], relative)) {
      return target(matches[0], relative, relative, 'season', level(true), t('match.seasonByTitle', { title: episode.seasonTitle ?? '' }));
    }
  }

  const groups = groupSeasons(pool);
  const season = seasonNumber ?? (isSoleSeason ? 1 : null);

  // 3b. Numéro affiché au-delà de la saison N alors que la numérotation n'a pas été reconnue comme absolue
  //     (position dans la saison inconnue ou faussée : Attack on Titan S4 E87, Kaiju No. 8 « Season 2 » E23) :
  //     cumul depuis la 1re saison, retenu seulement s'il tombe dans la saison N.
  if (!isAbsolute && displayed !== null && season !== null && season >= 1 && season <= groups.length) {
    const group = groups[season - 1];
    const groupTotal = group.every((c) => c.episodes !== null) ? group.reduce((sum, c) => sum + (c.episodes ?? 0), 0) : Number.POSITIVE_INFINITY;
    const hit = displayed > groupTotal ? walkSeasons(pool, 0, displayed) : null;
    if (hit && group.includes(pool[hit.index]) && fits(pool[hit.index], hit.progress)) {
      const agrees = seasonNumber !== null && titleSeasonOf(pool[hit.index].titles, animeKey) === seasonNumber;
      return target(pool[hit.index], displayed, hit.progress, 'displayed', agrees ? 'high' : level(true), t('match.absoluteSplit', { count: pool.length }), t('match.titleOnlySeason', { season: seasonNumber ?? '?' }));
    }
  }

  // 4. …ou par son numéro. AniList découpe souvent une saison en plusieurs fiches (« Part 2 », « Cour 2 ») que
  //    la plateforme réunit : la saison N est le N-ième groupe de fiches (voir groupSeasons), avec report sur
  //    la partie suivante quand le numéro dépasse la première.
  //    Numéro du titre de saison prioritaire (« Season 2 » rangée en S3 par Crunchyroll) ; sans numéro, une série
  //    dont les fiches forment une seule saison est la saison 1.
  if (season !== null && season >= 1) {
    const isGrouped = groups.length < pool.length;

    if (isGrouped && season <= groups.length) {
      const group = groups[season - 1];
      const start = pool.indexOf(group[0]);
      const hit = walkSeasons(pool, start, relative);
      if (!hit || !fits(pool[hit.index], hit.progress)) return { ok: false, reason: t('match.undetermined') };
      // Fiable seulement si l'épisode reste dans le groupe de la saison N (sinon il déborde sur la saison suivante)
      const part = group.indexOf(pool[hit.index]);
      const groupTotal = group.reduce((sum, c) => sum + (c.episodes ?? 0), 0);
      const reason =
        part === -1
          ? t('match.beyondSeason', { episode: relative, season, total: groupTotal })
          : group.length > 1
            ? t('match.seasonGroup', { season, part: part + 1, parts: group.length })
            : t('match.seasonExact', { season, index: start + 1 });
      return target(pool[hit.index], relative, hit.progress, 'season', level(part !== -1), reason);
    }

    // Aucune partie regroupée (saison N = N-ième fiche), ou saison au-delà des groupes détectés :
    // repli sur l'index des fiches, toujours à vérifier dans ce dernier cas
    const index = season - 1;
    const hit = walkSeasons(pool, index, relative);
    if (hit && fits(pool[hit.index], hit.progress)) {
      const isExact = hit.index === index;
      return target(pool[hit.index], relative, hit.progress, 'season', level(isExact && !isGrouped), isExact
        ? t('match.seasonExact', { season, index: index + 1 })
        : t('match.seasonSplit', { season }));
    }
  }

  return { ok: false, reason: t('match.undetermined') };
}

// ─── Plateformes généralistes ─────────────────────────────────────────────

/**
 * Plateformes au catalogue généraliste (Netflix) : une série n'est traitée comme un anime que si une fiche
 * AniList y renvoie, ou à défaut porte le même titre (à vérifier). Crunchyroll et ADN ne sont pas concernés.
 */
export const LINK_REQUIRED_PLATFORMS: ReadonlySet<StreamingPlatform> = new Set<StreamingPlatform>(['netflix']);

/**
 * Filtre « anime » d'une plateforme généraliste, appliqué au résultat de resolveTarget :
 * 1. une fiche liée à la série (lien plateforme ou suite/préquelle d'une fiche liée) → résultat inchangé, mais
 *    confiance basse si la fiche choisie n'est pas elle-même liée (série TV homonyme d'un film lié) ;
 * 2. sinon, des fiches au titre de la série → correspondance jamais fiable (carte « à vérifier »), échec inchangé ;
 * 3. sinon → série ignorée (probablement pas un anime : ni carte de vérification ni toast).
 */
export function gateByPlatformLink(
  episode: Pick<EpisodeInfo, 'platform' | 'animeTitle'>,
  candidates: readonly MediaCandidate[],
  result: ResolveResult,
): ResolveResult {
  if (!LINK_REQUIRED_PLATFORMS.has(episode.platform)) return result;
  if (candidates.some(isLinked)) {
    if (!result.ok || result.target.confidence !== 'high') return result;
    const { mediaId } = result.target;
    if (candidates.some((c) => c.id === mediaId && isLinked(c))) return result;
    return { ok: true, target: { ...result.target, confidence: 'low', reason: t('match.netflixUnlinkedEntry') } };
  }

  const animeKey = normalizeTitle(episode.animeTitle);
  const isTitleMatch = seasonPool(candidates, episode.animeTitle).length > 0 || candidates.some((c) => c.titles.some((title) => normalizeTitle(title) === animeKey));
  if (isTitleMatch) {
    return result.ok ? { ok: true, target: { ...result.target, confidence: 'low', reason: t('match.netflixTitleOnly') } } : result;
  }
  return ignoredResult(episode);
}

/** Verdict « série ignorée » (filtre ci-dessus, ou verdict mémorisé : voir ignored-series.ts) */
export function ignoredResult(episode: Pick<EpisodeInfo, 'animeTitle'>): ResolveResult {
  return { ok: false, reason: t('match.noEntry', { title: episode.animeTitle }), ignored: true };
}
