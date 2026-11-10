import type { AniListErrorCode } from './anilist.types';
import { isStreamingPlatform } from './episode.types';
import { isRecord } from './guards';
import type { Result } from './result';
import type { AiringStatus, NextEpisode, PlatformLink } from './watching.types';

// Fiche complète affichée dans l'onglet « En lecture » du panneau latéral (catalogue AniList public).

/** Relations affichées dans le panneau, dans l'ordre d'affichage */
export const PANEL_RELATION_TYPES = ['PREQUEL', 'SEQUEL', 'PARENT', 'SIDE_STORY', 'SPIN_OFF'] as const;
export type PanelRelationType = (typeof PANEL_RELATION_TYPES)[number];

export function isPanelRelationType(value: unknown): value is PanelRelationType {
  return PANEL_RELATION_TYPES.some((type) => type === value);
}

export type MediaSeason = 'WINTER' | 'SPRING' | 'SUMMER' | 'FALL';
const MEDIA_SEASONS: readonly MediaSeason[] = ['WINTER', 'SPRING', 'SUMMER', 'FALL'];

export function isMediaSeason(value: unknown): value is MediaSeason {
  return MEDIA_SEASONS.some((season) => season === value);
}

export interface PanelRelation {
  relationType: PanelRelationType;
  mediaId: number;
  /** Fiche MyAnimeList équivalente (lien du titre quand MyAnimeList est préférée), null si inconnue */
  idMal: number | null;
  title: string;
  format: string | null;
  coverUrl: string | null;
  siteUrl: string;
  /** Pages Crunchyroll / ADN de la relation (liens AniList, puis historique SyncKai), une par plateforme */
  platforms: PlatformLink[];
  /** Statut de diffusion et date de début (badge « Annoncée » des suites) ; null si inconnus */
  status: AiringStatus | null;
  startYear: number | null;
  startMonth: number | null;
  startDay: number | null;
  season: MediaSeason | null;
  seasonYear: number | null;
}

/** Série voisine proposée par AniList (« Dans le même esprit ») : au plus 8 par fiche, 5 montrées */
export interface PanelRecommendation {
  mediaId: number;
  idMal: number | null;
  title: string;
  format: string | null;
  startYear: number | null;
  coverUrl: string | null;
  siteUrl: string;
  /** Votes de la communauté AniList pour cette recommandation (le texte « N fans de … ») */
  rating: number;
  /** Pages Crunchyroll / ADN d'après les liens AniList */
  platforms: PlatformLink[];
  /** Préquels directs : une suite dont le préquel n'est ni vu ni en cours n'est pas proposée */
  prequelIds: number[];
  /** Ids MyAnimeList de ces préquels, même ordre que `prequelIds` (null : pas d'équivalent connu) */
  prequelMalIds: (number | null)[];
}

export interface PanelMedia {
  mediaId: number;
  idMal: number | null;
  siteUrl: string;
  /** Titre préféré de l'utilisateur (réglage AniList) */
  title: string;
  /** Titre romaji (recherche des discussions Reddit) */
  romajiTitle: string | null;
  englishTitle: string | null;
  bannerUrl: string | null;
  coverUrl: string | null;
  /** Couleur dominante de l'affiche (#rrggbb), fond de repli de la bannière */
  coverColor: string | null;
  /** Synopsis en texte brut (balises retirées, entités décodées, spoilers masqués) */
  description: string | null;
  genres: string[];
  /** Note moyenne AniList (0-100) */
  averageScore: number | null;
  season: MediaSeason | null;
  seasonYear: number | null;
  format: string | null;
  episodes: number | null;
  airingStatus: AiringStatus | null;
  nextEpisode: NextEpisode | null;
  studio: { name: string; siteUrl: string | null } | null;
  relations: PanelRelation[];
  recommendations: PanelRecommendation[];
}

export type PanelMediaResult = Result<PanelMedia, AniListErrorCode>;

const AIRING_STATUSES: readonly AiringStatus[] = ['RELEASING', 'FINISHED', 'NOT_YET_RELEASED', 'HIATUS', 'CANCELLED'];
const isNullableString = (v: unknown): v is string | null => v === null || typeof v === 'string';
const isNullableNumber = (v: unknown): v is number | null => v === null || (typeof v === 'number' && Number.isFinite(v));
const isPositiveInt = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 1;

const isPlatformLink = (v: unknown): v is PlatformLink =>
  isRecord(v) && isStreamingPlatform(v.platform) && typeof v.url === 'string';

function isPanelRelation(value: unknown): value is PanelRelation {
  return (
    isRecord(value) &&
    isPanelRelationType(value.relationType) &&
    isPositiveInt(value.mediaId) &&
    (value.idMal === null || isPositiveInt(value.idMal)) &&
    typeof value.title === 'string' &&
    isNullableString(value.format) &&
    isNullableString(value.coverUrl) &&
    typeof value.siteUrl === 'string' &&
    Array.isArray(value.platforms) &&
    value.platforms.every(isPlatformLink) &&
    (value.status === null || AIRING_STATUSES.some((s) => s === value.status)) &&
    isNullableNumber(value.startYear) &&
    isNullableNumber(value.startMonth) &&
    isNullableNumber(value.startDay) &&
    (value.season === null || isMediaSeason(value.season)) &&
    isNullableNumber(value.seasonYear)
  );
}

function isPanelRecommendation(value: unknown): value is PanelRecommendation {
  return (
    isRecord(value) &&
    isPositiveInt(value.mediaId) &&
    (value.idMal === null || isPositiveInt(value.idMal)) &&
    typeof value.title === 'string' &&
    isNullableString(value.format) &&
    isNullableNumber(value.startYear) &&
    isNullableString(value.coverUrl) &&
    typeof value.siteUrl === 'string' &&
    typeof value.rating === 'number' &&
    Number.isFinite(value.rating) &&
    Array.isArray(value.platforms) &&
    value.platforms.every(isPlatformLink) &&
    Array.isArray(value.prequelIds) &&
    value.prequelIds.every(isPositiveInt) &&
    Array.isArray(value.prequelMalIds) &&
    value.prequelMalIds.length === value.prequelIds.length &&
    value.prequelMalIds.every((id) => id === null || isPositiveInt(id))
  );
}

/** Garde d'une fiche relue du cache de session (format d'une version précédente → ignorée) */
export function isPanelMedia(value: unknown): value is PanelMedia {
  if (!isRecord(value)) return false;
  const { studio, nextEpisode } = value;
  return (
    isPositiveInt(value.mediaId) &&
    (value.idMal === null || isPositiveInt(value.idMal)) &&
    typeof value.siteUrl === 'string' &&
    typeof value.title === 'string' &&
    isNullableString(value.romajiTitle) &&
    isNullableString(value.englishTitle) &&
    isNullableString(value.bannerUrl) &&
    isNullableString(value.coverUrl) &&
    isNullableString(value.coverColor) &&
    isNullableString(value.description) &&
    Array.isArray(value.genres) &&
    value.genres.every((g) => typeof g === 'string') &&
    isNullableNumber(value.averageScore) &&
    (value.season === null || isMediaSeason(value.season)) &&
    isNullableNumber(value.seasonYear) &&
    isNullableString(value.format) &&
    isNullableNumber(value.episodes) &&
    (value.airingStatus === null || AIRING_STATUSES.some((s) => s === value.airingStatus)) &&
    (nextEpisode === null || (isRecord(nextEpisode) && typeof nextEpisode.episode === 'number' && typeof nextEpisode.airingAt === 'number')) &&
    (studio === null || (isRecord(studio) && typeof studio.name === 'string' && isNullableString(studio.siteUrl))) &&
    Array.isArray(value.relations) &&
    value.relations.every(isPanelRelation) &&
    Array.isArray(value.recommendations) &&
    value.recommendations.every(isPanelRecommendation)
  );
}
