// Métadonnées Netflix réduites (forme qui quitte le monde MAIN, voir content/netflix/bridge-protocol.ts) : types,
// revalidation et numérotation des épisodes. Module PUR partagé par la synchro en direct (script de contenu Netflix)
// et l'import de l'historique (page d'import) : même numérotation, mêmes clés de correspondance des deux côtés.
import { isRecord } from './guards';
import { isSignalYear, medianMinutes, toPlatformSignals, type PlatformSignals } from './match-signals';

/** Identifiant de vidéo Netflix (/watch/{id}, /title/{id}) */
export const NETFLIX_MOVIE_ID_REGEX = /^\d{1,12}$/;

/** Bornes de la réduction : textes tronqués, nombre total d'épisodes et de saisons limité */
export const NETFLIX_MAX_TEXT = 300;
export const NETFLIX_MAX_EPISODES = 2000;
export const NETFLIX_MAX_SEASONS = 200;

/**
 * Point de lecture d'un épisode (ou d'un film) pour le profil Netflix : présent SEULEMENT dans les réponses demandées
 * par l'import de l'historique (`bookmarks`), jamais dans celles de la synchro en direct. Netflix ne garde que le
 * dernier point de lecture (un épisode revu depuis le début paraît non terminé).
 */
export interface NetflixBookmark {
  /** Position (s) du dernier visionnage */
  offset: number;
  /** Position (s) à partir de laquelle Netflix considère l'épisode vu jusqu'au bout ; null si inconnue */
  watchedToEndOffset: number | null;
}

export interface NetflixEpisodeMetadata {
  /** Identifiant de lecture (/watch/{id}) */
  id: string;
  /** Numéro dans la saison */
  seq: number;
  title: string | null;
  /** Durée (s) */
  runtime: number | null;
  /** Début du générique de fin (s) */
  creditsOffset: number | null;
  /** Import seulement : null = jamais regardé */
  bookmark?: NetflixBookmark | null;
}

export interface NetflixSeasonMetadata {
  seq: number;
  title: string | null;
  /**
   * `seasons[].year` : année de DÉBUT d'origine de la saison (vérifié le 2026-10-14 : One Piece East Blue 1999, Alabasta
   * 2001, Elbaph 2026 ; Mushoku Tensei S1 2021, S2 2023). Absente si illisible (protocole v3).
   */
  year?: number;
  episodes: NetflixEpisodeMetadata[];
}

/**
 * Métadonnées réduites d'une série ou d'un film : seuls ces champs quittent le monde MAIN.
 * Jamais d'authURL, d'artwork, de synopsis, de skipMarkers ni de donnée de compte.
 */
export interface NetflixShowMetadata {
  showId: string;
  type: 'show' | 'movie';
  title: string;
  /** Film : durée (s) ; série : null */
  runtime: number | null;
  /** Film : début du générique (s) ; série : null */
  creditsOffset: number | null;
  /** Film : [] */
  seasons: NetflixSeasonMetadata[];
  /** Film, import seulement : null = jamais regardé */
  bookmark?: NetflixBookmark | null;
}

// ─── Revalidation (la page, monde MAIN, peut émettre n'importe quoi) ──────

/** Durée en secondes (> 0), sinon null */
export function seconds(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null;
}

/** Numéro d'ordre (entier ≥ 0), sinon null */
export function sequence(value: unknown): number | null {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : null;
}

const isBoundedText = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && v.length <= NETFLIX_MAX_TEXT;
const isNullableText = (v: unknown): v is string | null => v === null || isBoundedText(v);
const isNullableSeconds = (v: unknown): v is number | null => v === null || seconds(v) !== null;
const isId = (v: unknown): v is string => typeof v === 'string' && NETFLIX_MOVIE_ID_REGEX.test(v);
const isBookmark = (v: unknown): boolean =>
  v === undefined || v === null || (isRecord(v) && typeof v.offset === 'number' && Number.isFinite(v.offset) && v.offset >= 0 && isNullableSeconds(v.watchedToEndOffset));

function isEpisodeMetadata(value: unknown): value is NetflixEpisodeMetadata {
  return (
    isRecord(value) &&
    isId(value.id) &&
    sequence(value.seq) !== null &&
    isNullableText(value.title) &&
    isNullableSeconds(value.runtime) &&
    isNullableSeconds(value.creditsOffset) &&
    isBookmark(value.bookmark)
  );
}

function isSeasonMetadata(value: unknown): value is NetflixSeasonMetadata {
  return (
    isRecord(value) &&
    sequence(value.seq) !== null &&
    isNullableText(value.title) &&
    (value.year === undefined || isSignalYear(value.year)) &&
    Array.isArray(value.episodes) &&
    value.episodes.every(isEpisodeMetadata)
  );
}

export function isNetflixShowMetadata(value: unknown): value is NetflixShowMetadata {
  if (
    !isRecord(value) ||
    !isId(value.showId) ||
    (value.type !== 'show' && value.type !== 'movie') ||
    !isBoundedText(value.title) ||
    !isNullableSeconds(value.runtime) ||
    !isNullableSeconds(value.creditsOffset) ||
    !Array.isArray(value.seasons) ||
    value.seasons.length > NETFLIX_MAX_SEASONS ||
    !value.seasons.every(isSeasonMetadata) ||
    !isBookmark(value.bookmark)
  ) {
    return false;
  }
  const seasons: NetflixSeasonMetadata[] = value.seasons;
  return seasons.reduce((total, season) => total + season.episodes.length, 0) <= NETFLIX_MAX_EPISODES;
}

// ─── Numérotation (synchro en direct et import) ───────────────────────────

/** Saison réduite à ce dont la numérotation a besoin */
type Numbered = Pick<NetflixSeasonMetadata, 'seq'> & { episodes: readonly Pick<NetflixEpisodeMetadata, 'seq'>[] };

/**
 * Numéro « absolu » de l'épisode : épisodes des saisons précédentes (seq inférieur) + numéro dans la saison.
 * Null si une saison précédente est vide (liste incomplète : le total serait faux).
 */
export function absoluteEpisodeNumber(seasons: readonly Numbered[], seasonSeq: number, episodeSeq: number): number | null {
  let before = 0;
  for (const season of seasons) {
    if (season.seq >= seasonSeq) continue;
    if (season.episodes.length === 0) return null;
    before += season.episodes.length;
  }
  return before + episodeSeq;
}

/**
 * Numéros de l'épisode : numéro dans la saison, et numéro « absolu » affiché.
 * - Numérotation par saison (chaque saison repart de 1 : Ranma1/2, Mushoku Tensei) : `seq` dans la saison, numéro absolu
 *   = épisodes des saisons précédentes + `seq` (absoluteEpisodeNumber).
 * - Numérotation déjà absolue (One Piece : saison 40 « Elbaph Arc » = E1156…E1180) : la saison ne commence pas à 1 et
 *   son premier numéro dépasse le nombre d'épisodes des saisons précédentes (Netflix n'en propose souvent qu'une
 *   partie). `seq` EST le numéro absolu (il ne faut rien y ajouter : 1180 devenait 1377) ; numéro dans la saison = rang
 *   de l'épisode dans la saison. Une saison qui commence à 2 (1er épisode absent) reste relative.
 */
export function episodeNumbers(
  seasons: readonly Numbered[],
  season: Numbered,
  episode: Pick<NetflixEpisodeMetadata, 'seq'>,
): { seasonEpisodeNumber: number; displayedEpisodeNumber: number | null } {
  const first = Math.min(...season.episodes.map((e) => e.seq));
  const before = seasons.filter((s) => s.seq < season.seq).reduce((sum, s) => sum + s.episodes.length, 0);
  if (first > 1 && first > before) {
    const rank = season.episodes.filter((e) => e.seq <= episode.seq).length;
    return { seasonEpisodeNumber: rank, displayedEpisodeNumber: episode.seq };
  }
  return { seasonEpisodeNumber: episode.seq, displayedEpisodeNumber: absoluteEpisodeNumber(seasons, season.seq, episode.seq) };
}

/** Épisodes de chaque saison, dans l'ordre des saisons (seq) : rapprochement des saisons avec les fiches AniList */
export function platformSeasonsOf(show: Pick<NetflixShowMetadata, 'seasons'>): number[] {
  return [...show.seasons].sort((a, b) => a.seq - b.seq).map((season) => season.episodes.length);
}

/**
 * Signaux de la saison `season` (lecture ou page de série) : année de début d'origine, nombre d'épisodes, durée médiane,
 * format. Film : format et durée. Saison inconnue (page de série sans saison) : aucun (l'année la plus ancienne des
 * saisons n'est pas celle de la série quand Netflix n'en propose qu'une partie).
 */
export function netflixSignals(show: Pick<NetflixShowMetadata, 'type' | 'runtime'>, season: Pick<NetflixSeasonMetadata, 'year' | 'episodes'> | null): PlatformSignals | undefined {
  if (show.type === 'movie') return toPlatformSignals({ format: 'movie', episodeMinutes: medianMinutes([show.runtime]) });
  if (!season) return undefined;
  return toPlatformSignals({
    seasonYear: season.year,
    seasonEpisodeCount: season.episodes.length,
    episodeMinutes: medianMinutes(season.episodes.map((episode) => episode.runtime)),
    format: 'series',
  });
}
