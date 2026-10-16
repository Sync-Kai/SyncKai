import { isRecord } from './guards';
import { isPlatformSignals, type PlatformSignals } from './match-signals';
import { STREAMING_PLATFORMS, type StreamingPlatform } from '../platforms/ids';

export type { StreamingPlatform } from '../platforms/ids';

/**
 * Épisode détecté sur une plateforme de streaming.
 *
 * ⚠️ Numérotation : une plateforme découpe les séries en saisons qui ne correspondent pas
 * forcément aux entrées AniList. Ex (Crunchyroll, One Piece) : saison 24 "Elbaph",
 * seasonEpisodeNumber = 25, displayedEpisodeNumber = 1180. Aucun de ces numéros ne doit
 * être envoyé tel quel comme progression AniList sans étape de correspondance.
 */
export interface EpisodeInfo {
  platform: StreamingPlatform;
  /** Identifiant de l'épisode propre à la plateforme (ex : "GE00376431JAJP") */
  episodeId: string;
  /** Identifiant de la série propre à la plateforme (ex : "GRMG8ZQZR") */
  seriesId: string | null;
  /** Slug de la série (ex : "one-piece"), pour les anciens liens Crunchyroll sans identifiant */
  seriesSlug: string | null;
  animeTitle: string;
  seasonNumber: number | null;
  /** Nom de la saison / de l'arc (ex : "Elbaph") */
  seasonTitle: string | null;
  /** Numéro de l'épisode dans la saison de la plateforme */
  seasonEpisodeNumber: number | null;
  /** Numéro affiché à l'utilisateur ("E1180") : souvent relatif à la saison, absolu pour les longues séries */
  displayedEpisodeNumber: number | null;
  episodeTitle: string | null;
  url: string;
  /**
   * Nombre d'épisodes de chaque saison de la série sur la plateforme, dans l'ordre des saisons (Netflix : métadonnées de
   * la série). Sert à rapprocher les saisons de la plateforme des fiches AniList de la franchise (alignPlatformSeasons).
   * Absent si inconnu (Crunchyroll, ADN, Disney+, épisodes enregistrés avant la 2.3.0).
   */
  platformSeasons?: number[];
  /** Prime Video : verdict « anime » du script de contenu (voir PrimeAnimeVerdict). Absent ailleurs. */
  primeAnime?: SentPrimeAnimeVerdict;
  /** Signaux de la plateforme (année, épisodes, durée…) pour choisir la fiche, voir shared/match-signals.ts. Absent si aucun. */
  signals?: PlatformSignals;
}

/**
 * Prime Video, filtre « anime » du script de contenu (genres `av_genre_*` et pistes audio de la page de détail, voir
 * platforms/prime/metadata.ts › primeAnimeVerdict) :
 * - `anime` : genre `av_genre_anime` ;
 * - `animation-ja` : autre genre `av_genre_animation*` avec une piste audio japonaise (résolution normale, ignorée en
 *   silence sans fiche liée ni au titre de la série : voir background/sync/matching/policies/prime.ts › primeAnimeGate) ;
 * - `animation-exact-only` : autre genre d'animation sans piste japonaise : suivi seulement sur un titre AniList exact ;
 * - `ignored` : pas d'animation, ou genres illisibles : rien n'est envoyé (jamais dans un message).
 */
export type PrimeAnimeVerdict = 'anime' | 'animation-ja' | 'animation-exact-only' | 'ignored';
/** Verdict transmis au service worker (`ignored` ne quitte jamais le script de contenu) */
export type SentPrimeAnimeVerdict = Exclude<PrimeAnimeVerdict, 'ignored'>;

export function isSentPrimeAnimeVerdict(value: unknown): value is SentPrimeAnimeVerdict {
  return value === 'anime' || value === 'animation-ja' || value === 'animation-exact-only';
}

/** Saisons par série au plus, épisodes par saison au plus (validation d'un message ou du stockage) */
export const MAX_PLATFORM_SEASONS = 200;
const MAX_SEASON_EPISODES = 10_000;

/** Nombres d'épisodes par saison plausibles (entiers ≥ 0, bornés) */
export function isPlatformSeasons(value: unknown): value is number[] {
  return (
    Array.isArray(value) &&
    value.length <= MAX_PLATFORM_SEASONS &&
    value.every((count) => typeof count === 'number' && Number.isSafeInteger(count) && count >= 0 && count <= MAX_SEASON_EPISODES)
  );
}

/**
 * Disney+ : saison 99 = arc ou spécial publié comme une saison de la série (« Undead Unluck - s99e1 »), plusieurs
 * par série. L'épisode porte alors le titre de l'arc dans `seasonTitle` (voir mappingKey).
 */
export const DISNEY_ARC_SEASON = 99;

/** Plateforme de streaming connue de SyncKai (valeur venant d'un message ou du stockage) */
export function isStreamingPlatform(value: unknown): value is StreamingPlatform {
  return typeof value === 'string' && (STREAMING_PLATFORMS as readonly string[]).includes(value);
}

const isNullableNumber = (v: unknown): v is number | null => v === null || typeof v === 'number';
const isNullableString = (v: unknown): v is string | null => v === null || typeof v === 'string';

export function isEpisodeInfo(value: unknown): value is EpisodeInfo {
  return (
    isRecord(value) &&
    isStreamingPlatform(value.platform) &&
    typeof value.episodeId === 'string' &&
    isNullableString(value.seriesId) &&
    isNullableString(value.seriesSlug) &&
    typeof value.animeTitle === 'string' &&
    isNullableNumber(value.seasonNumber) &&
    isNullableString(value.seasonTitle) &&
    isNullableNumber(value.seasonEpisodeNumber) &&
    isNullableNumber(value.displayedEpisodeNumber) &&
    isNullableString(value.episodeTitle) &&
    typeof value.url === 'string' &&
    (value.platformSeasons === undefined || isPlatformSeasons(value.platformSeasons)) &&
    (value.primeAnime === undefined || isSentPrimeAnimeVerdict(value.primeAnime)) &&
    (value.signals === undefined || isPlatformSignals(value.signals))
  );
}
