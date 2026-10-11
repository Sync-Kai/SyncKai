import type { AniListErrorCode } from './anilist.types';
import type { SyncPrompts } from './engagement.types';
import type { TrackerId } from './tracker.types';

/** Code d'erreur d'API (absent pour une erreur métier, ex : vérification introuvable) : décide de la relance automatique */
export type SyncErrorCode = AniListErrorCode;
import { isRecord } from './guards';

/** Numéro d'épisode utilisé pour calculer la progression AniList */
export type NumberingMode = 'displayed' | 'season';

/**
 * Correspondance résolue et mise en cache pour une saison d'une plateforme.
 * progression AniList = numéro (selon `numbering`) - `offset`
 */
export interface MediaMapping {
  mediaId: number;
  numbering: NumberingMode;
  offset: number;
  /** Nombre d'épisodes de la fiche au moment de la résolution (null = inconnu / en cours) */
  episodes: number | null;
  /** Affichage dans la page d'options (absents des correspondances enregistrées avant la 1.1) */
  seriesLabel?: string;
  mediaTitle?: string;
}

export function isMediaMapping(value: unknown): value is MediaMapping {
  return (
    isRecord(value) &&
    typeof value.mediaId === 'number' &&
    (value.numbering === 'displayed' || value.numbering === 'season') &&
    typeof value.offset === 'number' &&
    (value.episodes === null || typeof value.episodes === 'number') &&
    (value.seriesLabel === undefined || typeof value.seriesLabel === 'string') &&
    (value.mediaTitle === undefined || typeof value.mediaTitle === 'string')
  );
}

/** Résultat de l'écriture sur UN service de suivi */
export type ServiceOutcome =
  | { status: 'updated'; progress: number; completed: boolean }
  | { status: 'up-to-date'; progress: number }
  /** `code` : raison connue du popup (série absente de la liste de ce service) */
  | { status: 'skipped'; reason: string; code?: 'not-in-list' }
  /** `httpStatus` : statut HTTP de l'erreur d'API (5xx passager, 4xx définitif : voir queue-policy) */
  | { status: 'error'; message: string; code?: SyncErrorCode; httpStatus?: number };

export interface ServiceResult {
  service: TrackerId;
  outcome: ServiceOutcome;
}

/** Résultat d'une synchronisation, renvoyé au content script (toast) et au popup. */
export type SyncOutcome =
  /** Fiche identifiée : un résultat par service connecté (succès partiel possible) */
  /** `queued` : au moins un service en échec a été mis en file de relance automatique */
  | { status: 'synced'; mediaTitle: string; results: ServiceResult[]; queued?: boolean; prompts?: SyncPrompts }
  | { status: 'needs-review'; reason: string }
  | { status: 'not-connected' }
  /** Série exclue par l'utilisateur (Réglages › Séries exclues) : rien n'a été écrit */
  | { status: 'excluded'; mediaTitle: string }
  /**
   * Série hors du périmètre de la plateforme (Netflix sans fiche AniList liée : probablement pas un anime), ignorée en
   * silence. `noAccess` : accès Netflix retiré, l'onglet ouvert avant le retrait envoie encore ses épisodes (refusés
   * sans rien écrire, la série n'est pas retenue comme ignorée : l'accès peut être accordé de nouveau)
   */
  | { status: 'ignored'; noAccess?: true }
  | { status: 'error'; message: string; code?: SyncErrorCode; httpStatus?: number; queued?: boolean };

/** Services à relancer après un échec partiel ("Réessayer" ne réécrit pas les services déjà à jour) */
export function failedServices(outcome: SyncOutcome): TrackerId[] {
  return outcome.status === 'synced' ? outcome.results.filter((r) => r.outcome.status === 'error').map((r) => r.service) : [];
}

/**
 * Nouvel essai d'un +1 / −1 après un échec partiel : la progression ABSOLUE obtenue sur le service qui a réussi,
 * écrite sur les seuls services en échec (réappliquer le delta décalerait le service déjà à jour).
 */
export interface AdjustRetry {
  delta: 1 | -1;
  services: TrackerId[];
  progress: number;
}

/** Changement de statut manuel depuis le popup (menu « … » de « En cours ») */
export type ListStatusChange = 'PAUSED' | 'DROPPED' | 'COMPLETED';

export const LIST_STATUS_CHANGES: readonly ListStatusChange[] = ['PAUSED', 'DROPPED', 'COMPLETED'];

export function isListStatusChange(value: unknown): value is ListStatusChange {
  return typeof value === 'string' && (LIST_STATUS_CHANGES as readonly string[]).includes(value);
}

/** Statut d'une entrée de liste (noms de l'énumération AniList MediaListStatus) */
export type ListStatus = 'CURRENT' | 'PLANNING' | 'COMPLETED' | 'DROPPED' | 'PAUSED' | 'REPEATING';

/** Ajout d'une série absente de la liste depuis la fiche de la page (« À regarder » / « En cours ») */
export type AddListStatus = 'PLANNING' | 'CURRENT';

export const ADD_LIST_STATUSES: readonly AddListStatus[] = ['PLANNING', 'CURRENT'];

export function isAddListStatus(value: unknown): value is AddListStatus {
  return typeof value === 'string' && (ADD_LIST_STATUSES as readonly string[]).includes(value);
}

/** Statut écrit manuellement depuis le popup : changement de statut ou ajout à la liste */
export type ManualListStatus = ListStatusChange | AddListStatus;
