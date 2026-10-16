import { isRecord } from './guards';

// Signaux de la plateforme pour choisir la fiche AniList (feature/match-signals) : données lues sur la page (année,
// nombre d'épisodes, durée, format…), comparées aux fiches par background/sync/matching/concordance.ts. Module pur, sans i18n :
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

/** Année plausible (entier de 1900 à 2100) : formes réduites des plateformes */
export const isSignalYear = isYear;

/** Valeurs lues sur la page (absentes : undefined ou null), avant contrôle */
export type RawSignals = { [K in keyof PlatformSignals]?: PlatformSignals[K] | null | undefined };

/**
 * Copie `raw[name]` si la garde de ce champ l'accepte (chaque valeur gardée est déjà bornée : rien à revalider ensuite) ;
 * true si elle est copiée
 */
function copySignal<K extends keyof PlatformSignals>(signals: PlatformSignals, raw: RawSignals, name: K, guard: (value: unknown) => value is NonNullable<PlatformSignals[K]>): boolean {
  const value: unknown = raw[name];
  if (!guard(value)) return false;
  signals[name] = value;
  return true;
}

/**
 * Signaux à envoyer : valeurs absentes ou hors bornes retirées une à une (une seule valeur invalide ferait refuser tout le
 * message par isEpisodeInfo) ; undefined sans signal comparable (même règle que hasSignals : `airing` seul ne compte pas).
 * Champs dans cet ordre fixe (les tables des ponts sont dédoublonnées par leur JSON). Ni isPlatformSignals ni hasSignals :
 * inutiles ici, ils alourdiraient les ponts du monde MAIN (budget).
 */
export function toPlatformSignals(raw: RawSignals): PlatformSignals | undefined {
  const signals: PlatformSignals = {};
  // Copie d'abord, puis `||` : chaque champ est copié, même après un signal comparable
  let comparable = copySignal(signals, raw, 'seasonYear', isYear);
  comparable = copySignal(signals, raw, 'seriesYear', isYear) || comparable;
  comparable = copySignal(signals, raw, 'seasonEpisodeCount', isCount) || comparable;
  copySignal(signals, raw, 'airing', isBoolean);
  comparable = copySignal(signals, raw, 'episodeMinutes', isMinutes) || comparable;
  comparable = copySignal(signals, raw, 'format', isFormat) || comparable;
  comparable = copySignal(signals, raw, 'originalTitle', isTitle) || comparable;
  comparable = copySignal(signals, raw, 'country', isCountry) || comparable;
  return comparable ? signals : undefined;
}

/** Propriété `signals` à étaler dans un épisode ou une page : absente sans signal (jamais `signals: undefined`) */
export function withSignals(signals: PlatformSignals | undefined): { signals?: PlatformSignals } {
  return signals ? { signals } : {};
}

/** Durée médiane (minutes, au dixième) de durées en secondes ; les valeurs absentes ou nulles sont ignorées */
export function medianMinutes(seconds: readonly (number | null | undefined)[]): number | undefined {
  const sorted = seconds.filter((s): s is number => typeof s === 'number' && Number.isFinite(s) && s > 0).sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  return median === undefined ? undefined : Math.round(median / 6) / 10;
}

/** Au moins un signal comparable (`airing` seul ne dit rien de la fiche) */
export function hasSignals(signals: PlatformSignals | undefined): signals is PlatformSignals {
  if (!signals) return false;
  const { seasonYear, seriesYear, seasonEpisodeCount, episodeMinutes, format, originalTitle, country } = signals;
  return [seasonYear, seriesYear, seasonEpisodeCount, episodeMinutes, format, originalTitle, country].some((value) => value !== undefined);
}
