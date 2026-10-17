import type { AniListErrorCode } from './anilist.types';
import { isAccountStats, type AccountStats } from './account-stats';
import { isRecord } from './guards';
import type { Result } from './result';

/** Token OAuth2 MyAnimeList (Authorization Code + PKCE, renouvelable) */
export interface MalToken {
  accessToken: string;
  refreshToken: string;
  /** Timestamp (ms) d'expiration de l'access token */
  expiresAt: number;
}

export function isMalToken(value: unknown): value is MalToken {
  return (
    isRecord(value) &&
    typeof value.accessToken === 'string' &&
    typeof value.refreshToken === 'string' &&
    typeof value.expiresAt === 'number'
  );
}

/** Profil MyAnimeList normalisé, affiché dans le popup (et mis en cache) */
export interface MalViewer {
  id: number;
  name: string;
  pictureUrl: string | null;
  /** Statistiques du menu du compte, lues avec le profil ; null : illisibles ; absentes : profil enregistré avant elles */
  stats?: AccountStats | null;
}

export function isMalViewer(value: unknown): value is MalViewer {
  return (
    isRecord(value) &&
    typeof value.id === 'number' &&
    typeof value.name === 'string' &&
    (value.pictureUrl === null || typeof value.pictureUrl === 'string') &&
    (value.stats === undefined || value.stats === null || isAccountStats(value.stats))
  );
}

export type MalViewerResult = Result<MalViewer, AniListErrorCode>;
