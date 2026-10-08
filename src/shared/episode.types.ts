import { isRecord } from './guards';

export type StreamingPlatform = 'crunchyroll' | 'adn';

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
}

const PLATFORMS: Record<StreamingPlatform, true> = { crunchyroll: true, adn: true };

/** Plateforme de streaming connue de SyncKai (valeur venant d'un message ou du stockage) */
export function isStreamingPlatform(value: unknown): value is StreamingPlatform {
  return typeof value === 'string' && Object.hasOwn(PLATFORMS, value);
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
    typeof value.url === 'string'
  );
}
