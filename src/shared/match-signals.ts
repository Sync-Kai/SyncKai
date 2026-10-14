import { isRecord } from './guards';

// Signaux de la plateforme pour choisir la fiche AniList (feature/match-signals) : données lues sur la page (année,
// nombre d'épisodes, durée, format…), comparées aux fiches par background/sync/concordance.ts. Module pur, sans i18n :
// importable par les scripts de contenu.

/** Nature de l'œuvre selon la plateforme (Netflix `type`, Disney+ `programType`, Prime Video `titleType`) */
export type PlatformFormat = 'series' | 'movie' | 'special';

/**
 * Signaux facultatifs : chacun absent si la plateforme ne le donne pas. Aucun signal = comportement d'avant
 * (correspondance par le titre et les liens AniList seulement).
 */
export interface PlatformSignals {
  /** Année de DÉBUT d'origine de la saison affichée (Netflix `seasons[].year`, Prime Video `releaseYear`) */
  seasonYear?: number;
  /** Année de début de la SÉRIE entière (Disney+ `releaseYearRange.startYear`, Crunchyroll, ADN) */
  seriesYear?: number;
  /** Nombre d'épisodes de la saison sur la plateforme */
  seasonEpisodeCount?: number;
  /** Saison encore en cours de diffusion sur la plateforme (épisodes à venir) */
  airing?: boolean;
  /** Durée médiane d'un épisode de la saison (minutes) */
  episodeMinutes?: number;
  format?: PlatformFormat;
  /** Titre original de la série (natif ou romaji), tel que la plateforme l'écrit */
  originalTitle?: string;
  /** Pays d'origine (ISO 3166-1 alpha-2 : JP, CN, KR…) */
  country?: string;
}

const MIN_YEAR = 1900;
const MAX_YEAR = 2100;
const MAX_EPISODES = 10_000;
const MAX_MINUTES = 600;
const MAX_TITLE = 200;

const isYear = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v >= MIN_YEAR && v <= MAX_YEAR;
const isOptional = <T>(v: unknown, guard: (value: unknown) => value is T): boolean => v === undefined || guard(v);
const isCount = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 1 && v <= MAX_EPISODES;
const isMinutes = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v > 0 && v <= MAX_MINUTES;
const isFormat = (v: unknown): v is PlatformFormat => v === 'series' || v === 'movie' || v === 'special';
const isTitle = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0 && v.length <= MAX_TITLE;
const isCountry = (v: unknown): v is string => typeof v === 'string' && /^[A-Z]{2}$/.test(v);
const isBoolean = (v: unknown): v is boolean => typeof v === 'boolean';

/** Signaux venant d'un message ou du stockage : nombres bornés, textes courts (valeurs d'une page tierce) */
export function isPlatformSignals(value: unknown): value is PlatformSignals {
  return (
    isRecord(value) &&
    !Array.isArray(value) &&
    isOptional(value.seasonYear, isYear) &&
    isOptional(value.seriesYear, isYear) &&
    isOptional(value.seasonEpisodeCount, isCount) &&
    isOptional(value.airing, isBoolean) &&
    isOptional(value.episodeMinutes, isMinutes) &&
    isOptional(value.format, isFormat) &&
    isOptional(value.originalTitle, isTitle) &&
    isOptional(value.country, isCountry)
  );
}

/** Au moins un signal comparable (`airing` seul ne dit rien de la fiche) */
export function hasSignals(signals: PlatformSignals | undefined): signals is PlatformSignals {
  if (!signals) return false;
  const { seasonYear, seriesYear, seasonEpisodeCount, episodeMinutes, format, originalTitle, country } = signals;
  return [seasonYear, seriesYear, seasonEpisodeCount, episodeMinutes, format, originalTitle, country].some((value) => value !== undefined);
}
