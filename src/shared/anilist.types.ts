import { isRecord } from './guards';
import type { Result } from './result';

/**
 * Recherches AniList réunies dans UNE requête GraphQL (un alias par recherche, background/anilist/media.ts ›
 * searchAnimeBatch). Complexité mesurée le 2026-10-14 : 35 par recherche, plafond AniList 500 → 14 au plus, 10 gardé (350).
 * Une seule valeur pour le filtre de l'import Netflix (titres par message) et le pré-chargement de l'analyse Crunchyroll / ADN.
 */
export const ANILIST_SEARCHES_PER_REQUEST = 10;

/** Profil AniList normalisé, tel que consommé par le popup (et mis en cache). */
export interface AniListViewer {
  id: number;
  name: string;
  siteUrl: string;
  avatarUrl: string | null;
}

export function isAniListViewer(value: unknown): value is AniListViewer {
  return (
    isRecord(value) &&
    typeof value.id === 'number' &&
    typeof value.name === 'string' &&
    typeof value.siteUrl === 'string' &&
    (value.avatarUrl === null || typeof value.avatarUrl === 'string')
  );
}

/** Erreurs communes à toutes les requêtes AniList */
export type AniListErrorCode =
  | 'NOT_AUTHENTICATED'
  | 'TOKEN_INVALID'
  | 'RATE_LIMITED'
  | 'NETWORK'
  | 'API_ERROR'
  | 'INVALID_RESPONSE';

export type ViewerErrorCode = AniListErrorCode;

export type ViewerResult = Result<AniListViewer, ViewerErrorCode>;

/** Champ `data` brut de la requête GraphQL `Viewer`. */
export interface ViewerQueryData {
  Viewer: {
    id: number;
    name: string;
    siteUrl: string;
    avatar?: { medium: string | null } | null;
  };
}

export function isViewerQueryData(value: unknown): value is ViewerQueryData {
  if (!isRecord(value) || !isRecord(value.Viewer)) return false;
  const { id, name, siteUrl, avatar } = value.Viewer;
  const isAvatarValid =
    avatar === undefined ||
    avatar === null ||
    (isRecord(avatar) && (avatar.medium === null || typeof avatar.medium === 'string'));
  return typeof id === 'number' && typeof name === 'string' && typeof siteUrl === 'string' && isAvatarValid;
}
