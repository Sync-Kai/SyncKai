import { isRecord } from '../shared/guards';

/**
 * Pas une erreur à consigner : échec voulu par l'utilisateur, ou série ignorée sur Netflix (pas un anime :
 * fiche de la page sans objet, consignée en info par le handler)
 */
const IGNORED_CODES: ReadonlySet<string> = new Set(['USER_CANCELLED', 'NOT_TRACKED']);

/**
 * Erreur portée par une réponse du service worker, en texte court pour le journal, sinon null.
 * Les erreurs « prévues » (réseau, API, session expirée…) sont renvoyées au popup sans être loggées
 * par les handlers : elles sont consignées ici, en un seul point. Les échecs par service d'une
 * synchro (`status: 'synced'`) sont déjà loggés par les services eux-mêmes.
 * Formes reconnues : SyncOutcome `{ status: 'error' }`, Result `{ ok: false }`, AiringCheckResult `{ error }`.
 */
export function describeFailedResponse(response: unknown): string | null {
  if (!isRecord(response)) return null;
  const code = typeof response.code === 'string' ? response.code : null;
  if (code !== null && IGNORED_CODES.has(code)) return null;
  const message = typeof response.message === 'string' ? response.message : null;

  if (response.status === 'error' || response.ok === false) {
    return [code, message].filter((part): part is string => part !== null).join(' · ') || 'erreur sans message';
  }
  return typeof response.error === 'string' && response.error ? response.error : null;
}
