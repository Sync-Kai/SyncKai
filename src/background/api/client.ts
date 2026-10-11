import { t } from '../../i18n';
import { isRecord } from '../../shared/guards';
import { endSessionIfToken } from '../../shared/session-end';
import { getValidToken } from '../../shared/storage';
import { ApiError, isTimeoutError, REQUEST_TIMEOUT_MS } from './errors';
import { aniListBudget, MAX_RETRY_WAIT_MS, readRateLimitHeaders, retryDelayMs, sleep, type RequestLane } from './rate-limit';
import { createLogger } from '../../shared/logger';

const log = createLogger('anilist');

const ANILIST_GRAPHQL_URL = 'https://graphql.anilist.co';

/** "required" : compte AniList indispensable ; "optional" : catalogue public, token joint s'il existe */
type AuthMode = 'required' | 'optional';

async function request<T>(
  query: string,
  isData: (data: unknown) => data is T,
  variables: Record<string, unknown>,
  auth: AuthMode,
  isRetry: boolean,
  lane: RequestLane,
): Promise<T> {
  const token = await getValidToken();
  if (!token && auth === 'required') throw new ApiError('NOT_AUTHENTICATED', t('api.notAuthenticated', { service: 'AniList' }));

  // Pénalité 429 en cours : une requête interactive attend si c'est court, échoue aussitôt sinon (erreur visible)
  if (lane === 'interactive') {
    const cooldown = aniListBudget.cooldownLeft();
    if (cooldown > MAX_RETRY_WAIT_MS) throw new ApiError('RATE_LIMITED', t('api.rateLimited', { service: 'AniList' }));
    if (cooldown > 0) await sleep(cooldown);
  }
  // Budget partagé : les tâches de fond attendent leur tour, les requêtes interactives passent en priorité
  const release = await aniListBudget.acquire(lane);
  let response: Response;
  try {
    response = await fetch(ANILIST_GRAPHQL_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...(token ? { Authorization: `Bearer ${token.accessToken}` } : {}),
      },
      body: JSON.stringify({ query, variables }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (error: unknown) {
    if (isTimeoutError(error)) throw new ApiError('NETWORK', t('api.timeout', { service: 'AniList' }), { timedOut: true });
    throw new ApiError('NETWORK', t('api.network', { service: 'AniList' }));
  } finally {
    release();
  }
  aniListBudget.observe(readRateLimitHeaders(response.headers));

  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    // Corps non JSON (page d'erreur proxy…) : traité plus bas via le statut HTTP
  }

  const errors: unknown[] = isRecord(body) && Array.isArray(body.errors) ? body.errors : [];

  // AniList répond souvent 400 + "Invalid token" (et pas 401) pour un token révoqué
  const isTokenInvalid =
    token !== null &&
    (response.status === 401 ||
      errors.some((e) => isRecord(e) && typeof e.message === 'string' && /invalid token/i.test(e.message)));
  if (isTokenInvalid) {
    // Session fermée seulement si le token refusé est toujours celui enregistré (AUTH-02) : sinon reconnexion ou
    // déconnexion pendant la requête, rejouée avec le token actuel
    const ended = await endSessionIfToken('anilist', token.accessToken);
    // Catalogue public : on rejoue la requête sans token plutôt que d'échouer
    if (!ended || auth === 'optional') return request(query, isData, variables, auth, isRetry, lane);
    throw new ApiError('TOKEN_INVALID', t('api.sessionExpired', { service: 'AniList' }));
  }

  if (response.status === 429) {
    // Pénalité commune (au moins 5 s : `Retry-After: 0` relancerait aussitôt), puis une seule nouvelle tentative
    // si l'attente est courte (requête non traitée : sans risque). Les tâches de fond attendent aussi.
    const delay = retryDelayMs(response.headers.get('Retry-After'), Date.now(), response.headers.get('X-RateLimit-Reset'));
    aniListBudget.penalize(delay ?? 60_000);
    if (delay !== null && !isRetry) {
      log.warn(`Limite de requêtes AniList atteinte, nouvelle tentative dans ${Math.ceil(delay / 1000)} s`);
      return request(query, isData, variables, auth, true, lane);
    }
    throw new ApiError('RATE_LIMITED', t('api.rateLimited', { service: 'AniList' }));
  }

  if (!response.ok || errors.length > 0) {
    log.error('Erreur API AniList :', response.status, errors);
    throw new ApiError('API_ERROR', t('api.httpError', { service: 'AniList', status: response.status }), { httpStatus: response.status });
  }

  const data: unknown = isRecord(body) ? body.data : undefined;
  if (!isData(data)) {
    log.error('Réponse AniList inattendue :', body);
    throw new ApiError('INVALID_RESPONSE', t('api.invalidResponse.anilist'));
  }
  return data;
}

/** Requête authentifiée (liste de l'utilisateur, mutations). Lève une ApiError typée. */
export function anilistQuery<T>(
  query: string,
  isData: (data: unknown) => data is T,
  variables: Record<string, unknown> = {},
  lane: RequestLane = 'interactive',
): Promise<T> {
  return request(query, isData, variables, 'required', false, lane);
}

/**
 * Requête sur le catalogue public : fonctionne sans compte AniList (ex : utilisateur MyAnimeList seul).
 * Le token est joint s'il existe, pour des titres conformes aux préférences de l'utilisateur.
 */
export function anilistPublicQuery<T>(
  query: string,
  isData: (data: unknown) => data is T,
  variables: Record<string, unknown> = {},
  lane: RequestLane = 'interactive',
): Promise<T> {
  return request(query, isData, variables, 'optional', false, lane);
}
