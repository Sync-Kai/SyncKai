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
  /** Correction : épisode vu pendant que la carte attend, appliqué après la décision (validée ou ignorée) */
  deferred?: DeferredEpisode;
  createdAt: number;
}

/** Épisode mis de côté pendant une correction, avec les sessions de sa synchro (rejoué seulement sur elles) */
export interface DeferredEpisode {
  episode: EpisodeInfo;
  epochs: SessionEpochs;
}

/** Synchronisation effectuée, corrigeable depuis le popup. */
export interface RecentSync {
  key: string;
  episode: EpisodeInfo;
  mediaId: number;
  /** Fiche MyAnimeList de la fiche AniList (lien du titre), null sans équivalent ; absent : antérieure à son ajout */
  malId?: number | null;
  mediaTitle: string;
  progress: number;
  syncedAt: number;
  /** Sessions ouvertes lors de l'écriture : « Corriger » ne vaut que pour elles (absent : antérieure à la 2.2.0) */
  epochs?: SessionEpochs;
  /**
   * Dates des synchros précédentes de la même saison sur les dernières 24 h, la plus récente en premier (au plus
   * MAX_EARLIER_SYNCS) : la barre d'état compte chaque épisode synchronisé, pas seulement la dernière entrée de la saison
   */
  earlierSyncs?: number[];
}

/** Dates gardées dans `earlierSyncs` (fenêtre de la barre d'état : 24 h) */
export const EARLIER_SYNCS_WINDOW_MS = 24 * 60 * 60 * 1000;
export const MAX_EARLIER_SYNCS = 20;

/** Dates des synchros précédentes de la saison à garder sur la nouvelle entrée (pur) ; vide : champ omis */
export function earlierSyncsOf(previous: RecentSync | undefined, syncedAt: number): number[] {
  if (!previous) return [];
  return [previous.syncedAt, ...(previous.earlierSyncs ?? [])].filter((at) => at < syncedAt && syncedAt - at < EARLIER_SYNCS_WINDOW_MS).slice(0, MAX_EARLIER_SYNCS);
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

function isDeferredEpisode(value: unknown): value is DeferredEpisode {
  return isRecord(value) && isEpisodeInfo(value.episode) && isSessionEpochs(value.epochs);
}

/** Numéro de l'épisode mis de côté (affiché, sinon dans la saison) ; null si inconnu */
function deferredNumber({ episode }: DeferredEpisode): number | null {
  return episode.displayedEpisodeNumber ?? episode.seasonEpisodeNumber;
}

/**
 * Épisode à garder de côté sur une correction (pur) : le plus avancé ; à numéro égal ou inconnu, le plus récent.
 * Revoir un épisode antérieur pendant l'attente ne remplace donc pas l'épisode le plus loin.
 */
export function keepDeferred(current: DeferredEpisode | undefined, next: DeferredEpisode): DeferredEpisode {
  if (current === undefined) return next;
  const before = deferredNumber(current);
  const after = deferredNumber(next);
  return before !== null && after !== null && before > after ? current : next;
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
    (value.deferred === undefined || isDeferredEpisode(value.deferred)) &&
    typeof value.createdAt === 'number'
  );
}

export function isRecentSync(value: unknown): value is RecentSync {
  return (
    isRecord(value) &&
    typeof value.key === 'string' &&
    isEpisodeInfo(value.episode) &&
    typeof value.mediaId === 'number' &&
    (value.malId === undefined || isNullableNumber(value.malId)) &&
    typeof value.mediaTitle === 'string' &&
    typeof value.progress === 'number' &&
    typeof value.syncedAt === 'number' &&
    (value.epochs === undefined || isSessionEpochs(value.epochs)) &&
    (value.earlierSyncs === undefined || (Array.isArray(value.earlierSyncs) && value.earlierSyncs.length <= MAX_EARLIER_SYNCS && value.earlierSyncs.every((at) => typeof at === 'number')))
  );
}
