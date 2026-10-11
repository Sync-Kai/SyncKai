import { isEpisodeInfo, type EpisodeInfo } from './episode.types';
import { isRecord } from './guards';
import { isSessionEpochs, type SessionEpochs } from './session-epochs';

/** Fiche AniList résumée pour l'affichage dans une carte de vérification */
export interface CandidateSummary {
  id: number;
  title: string;
  format: string | null;
  episodes: number | null;
  year: number | null;
  coverUrl: string | null;
}

/** Épisode en attente d'un choix manuel de fiche AniList (une carte par saison). */
export interface PendingReview {
  /** Clé de saison, identique à celle du cache des correspondances */
  key: string;
  episode: EpisodeInfo;
  reason: string;
  suggestion: { mediaId: number; progress: number } | null;
  candidates: CandidateSummary[];
  /** Renseigné pour une correction : fiche sur laquelle la synchro a déjà écrit */
  previous: { mediaId: number; title: string; progress: number } | null;
  /** Correction : sessions de la synchro corrigée, seules à pouvoir être corrigées (absent : vérification simple) */
  epochs?: SessionEpochs;
  createdAt: number;
}

/** Synchronisation effectuée, corrigeable depuis le popup. */
export interface RecentSync {
  key: string;
  episode: EpisodeInfo;
  mediaId: number;
  mediaTitle: string;
  progress: number;
  syncedAt: number;
  /** Sessions ouvertes lors de l'écriture : « Corriger » ne vaut que pour elles (absent : antérieure à la 2.2.0) */
  epochs?: SessionEpochs;
}

const isNullableNumber = (v: unknown): v is number | null => v === null || typeof v === 'number';
const isNullableString = (v: unknown): v is string | null => v === null || typeof v === 'string';

export function isCandidateSummary(value: unknown): value is CandidateSummary {
  return (
    isRecord(value) &&
    typeof value.id === 'number' &&
    typeof value.title === 'string' &&
    isNullableString(value.format) &&
    isNullableNumber(value.episodes) &&
    isNullableNumber(value.year) &&
    isNullableString(value.coverUrl)
  );
}

function isMediaProgress(value: unknown): value is { mediaId: number; progress: number } {
  return isRecord(value) && typeof value.mediaId === 'number' && typeof value.progress === 'number';
}

function isPreviousSync(value: unknown): value is { mediaId: number; title: string; progress: number } {
  return isRecord(value) && typeof value.mediaId === 'number' && typeof value.progress === 'number' && typeof value.title === 'string';
}

export function isPendingReview(value: unknown): value is PendingReview {
  return (
    isRecord(value) &&
    typeof value.key === 'string' &&
    isEpisodeInfo(value.episode) &&
    typeof value.reason === 'string' &&
    (value.suggestion === null || isMediaProgress(value.suggestion)) &&
    Array.isArray(value.candidates) &&
    value.candidates.every(isCandidateSummary) &&
    (value.previous === null || isPreviousSync(value.previous)) &&
    (value.epochs === undefined || isSessionEpochs(value.epochs)) &&
    typeof value.createdAt === 'number'
  );
}

export function isRecentSync(value: unknown): value is RecentSync {
  return (
    isRecord(value) &&
    typeof value.key === 'string' &&
    isEpisodeInfo(value.episode) &&
    typeof value.mediaId === 'number' &&
    typeof value.mediaTitle === 'string' &&
    typeof value.progress === 'number' &&
    typeof value.syncedAt === 'number' &&
    (value.epochs === undefined || isSessionEpochs(value.epochs))
  );
}
