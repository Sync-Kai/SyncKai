import type { AniListErrorCode } from '../../shared/anilist.types';

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
