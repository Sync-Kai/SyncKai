import type { AniListErrorCode } from '../shared/anilist.types';

/** Codes d'erreur communs aux API des services de suivi (AniList, MyAnimeList) */
export type ApiErrorCode = AniListErrorCode;

/** Délai maximal d'une requête : au-delà, elle est abandonnée (un service surchargé peut ne jamais répondre) */
export const REQUEST_TIMEOUT_MS = 20_000;

interface ApiErrorDetails {
  /** Statut HTTP de la réponse en erreur (5xx : service surchargé, erreur passagère) */
  httpStatus?: number;
  /** Requête abandonnée faute de réponse dans le délai */
  timedOut?: boolean;
}

/** Erreur typée levée par les clients d'API ; convertie en résultat affichable par les handlers. */
export class ApiError extends Error {
  readonly code: ApiErrorCode;
  readonly httpStatus: number | null;
  readonly timedOut: boolean;

  constructor(code: ApiErrorCode, message: string, details: ApiErrorDetails = {}) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.httpStatus = details.httpStatus ?? null;
    this.timedOut = details.timedOut ?? false;
  }
}

/** Requête abandonnée par AbortSignal.timeout */
export function isTimeoutError(error: unknown): boolean {
  return error instanceof DOMException && (error.name === 'TimeoutError' || error.name === 'AbortError');
}

/** Statuts HTTP retentés par les tâches de fond (surcharge, passerelle) : 501 et 505 sont définitifs pour elles */
export const JOB_RETRY_STATUSES: readonly number[] = [500, 502, 503, 504];

/**
 * Statut HTTP d'une erreur serveur passagère. `only` : liste précise (tâches de fond, JOB_RETRY_STATUSES) ; absent : toute
 * la plage 5xx (file de synchro, qui relance aussi 501 et 505). Les deux ensembles diffèrent à dessein : les unifier
 * changerait ce qui est retenté (audit 6-D8).
 */
export function isRetryableStatus(httpStatus: number, only?: readonly number[]): boolean {
  return only === undefined ? httpStatus >= 500 : only.includes(httpStatus);
}
