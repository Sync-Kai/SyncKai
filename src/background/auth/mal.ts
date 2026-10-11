import { t } from '../../i18n';
import type { AuthResult } from '../../shared/auth.types';
import { isRecord } from '../../shared/guards';
import type { MalToken } from '../../shared/mal.types';
import { endSessionIfToken } from '../../shared/session-end';
import { getOpenSessions, saveMalToken, saveRefreshedMalToken } from '../../shared/storage';
import { getMalToken } from '../../shared/token-access';
import { ApiError, isTimeoutError, REQUEST_TIMEOUT_MS } from '../api/errors';
import { classifyAuthFlowError, getOAuthClients } from './oauth-clients';
import { createCodeVerifier, createState } from './pkce';
import { createLogger } from '../../shared/logger';

const log = createLogger('auth');

// Client public (type "other" sur MAL, un par navigateur : voir oauth-clients.ts) : PKCE, aucun secret
const MAL_AUTHORIZE_URL = 'https://myanimelist.net/v1/oauth2/authorize';
const MAL_TOKEN_URL = 'https://myanimelist.net/v1/oauth2/token';
/** Renouvellement anticipé : évite qu'un token expire au milieu d'une synchronisation */
const REFRESH_MARGIN_MS = 5 * 60_000;
const REFRESH_LOCK = 'synckai:mal-refresh';

function toMalToken(value: unknown): MalToken | null {
  if (!isRecord(value)) return null;
  const { access_token, refresh_token, expires_in } = value;
  if (typeof access_token !== 'string' || typeof refresh_token !== 'string' || typeof expires_in !== 'number') return null;
  return { accessToken: access_token, refreshToken: refresh_token, expiresAt: Date.now() + expires_in * 1000 };
}

/**
 * POST sur l'endpoint de token (échange de code ou renouvellement). Erreurs : TOKEN_INVALID (400/401, nouvelle
 * connexion nécessaire), RATE_LIMITED (429), NETWORK (avec `timedOut` après le délai), API_ERROR avec `httpStatus`
 * (5xx : passager, retenté par les tâches de fond), INVALID_RESPONSE.
 */
async function requestToken(params: Record<string, string>): Promise<MalToken> {
  const clients = getOAuthClients();
  if (!clients) {
    // Aucune app MAL pour ce navigateur : la session ne peut pas être renouvelée → reconnexion requise
    const redirectUri = chrome.identity.getRedirectURL();
    log.warn('Aucune app MyAnimeList pour cet ID d’extension | redirect_uri à enregistrer :', redirectUri);
    throw new ApiError('TOKEN_INVALID', t('auth.notConfigured', { url: redirectUri }));
  }
  const timeout = (): ApiError => new ApiError('NETWORK', t('api.timeout', { service: 'MyAnimeList' }), { timedOut: true });
  let response: Response;
  try {
    response = await fetch(MAL_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: clients.malClientId, ...params }),
      // Appelé sous le verrou de renouvellement : sans délai, un MAL qui ne répond pas bloquerait toutes les requêtes MAL (AUTH-05)
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (error: unknown) {
    if (isTimeoutError(error)) throw timeout();
    throw new ApiError('NETWORK', t('api.network', { service: 'MyAnimeList' }));
  }

  // 400/401 : code expiré, refresh token révoqué… → une nouvelle connexion est nécessaire
  if (response.status === 400 || response.status === 401) {
    throw new ApiError('TOKEN_INVALID', t('api.sessionExpired', { service: 'MyAnimeList' }));
  }
  // 429 et 5xx : passagers, la session reste valide (AUTH-07)
  if (response.status === 429) throw new ApiError('RATE_LIMITED', t('api.rateLimited', { service: 'MyAnimeList' }));
  if (!response.ok) throw new ApiError('API_ERROR', t('api.httpError', { service: 'MyAnimeList', status: response.status }), { httpStatus: response.status });

  let body: unknown = null;
  try {
    body = await response.json();
  } catch (error: unknown) {
    // Le délai couvre aussi la lecture du corps : c'est un délai dépassé, pas une réponse invalide (AUTH-09)
    if (isTimeoutError(error)) throw timeout();
  }
  const token = toMalToken(body);
  if (!token) throw new ApiError('INVALID_RESPONSE', t('api.invalidResponse.mal'));
  return token;
}

/**
 * Connexion MyAnimeList : Authorization Code + PKCE via chrome.identity.
 * MAL n'accepte que code_challenge_method=plain (le challenge est donc le verifier lui-même).
 */
export async function loginWithMal(): Promise<AuthResult> {
  const redirectUri = chrome.identity.getRedirectURL();
  const clients = getOAuthClients();
  if (!clients) {
    // ID d'extension sans app MAL enregistrée : la redirection serait rejetée par MyAnimeList
    log.warn('Aucune app MyAnimeList pour cet ID d’extension | redirect_uri à enregistrer :', redirectUri);
    return { ok: false, code: 'AUTH_FLOW_FAILED', message: t('auth.notConfigured', { url: redirectUri }) };
  }
  const codeVerifier = createCodeVerifier();
  const state = createState();

  const authUrl = new URL(MAL_AUTHORIZE_URL);
  authUrl.search = new URLSearchParams({
    response_type: 'code',
    client_id: clients.malClientId,
    code_challenge: codeVerifier,
    code_challenge_method: 'plain',
    state,
    redirect_uri: redirectUri,
  }).toString();

  let responseUrl: string | undefined;
  try {
    responseUrl = await chrome.identity.launchWebAuthFlow({ url: authUrl.toString(), interactive: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    log.error('Connexion MyAnimeList interrompue :', message, '| redirect_uri :', redirectUri);
    const kind = classifyAuthFlowError(message);
    if (kind === 'cancelled') return { ok: false, code: 'USER_CANCELLED', message: t('auth.cancelled') };
    if (kind === 'rejected') {
      return {
        ok: false,
        code: 'AUTH_FLOW_FAILED',
        message: t('auth.rejected.mal', { url: redirectUri }),
      };
    }
    return { ok: false, code: 'AUTH_FLOW_FAILED', message: t('auth.failed', { message }) };
  }
  if (!responseUrl) return { ok: false, code: 'INVALID_RESPONSE', message: t('auth.noResponse.mal') };

  const params = new URL(responseUrl).searchParams;
  if (params.get('error')) {
    log.warn('MyAnimeList a refusé l’accès :', params.get('error'));
    return { ok: false, code: 'ACCESS_DENIED', message: t('auth.denied', { service: 'MyAnimeList' }) };
  }
  const code = params.get('code');
  // "state" différent : réponse qui ne correspond pas à cette demande (CSRF) → rejetée
  if (!code || params.get('state') !== state) {
    return { ok: false, code: 'INVALID_RESPONSE', message: t('auth.invalidResponse.mal') };
  }

  try {
    const token = await requestToken({ grant_type: 'authorization_code', code, code_verifier: codeVerifier, redirect_uri: redirectUri });
    await saveMalToken(token);
    return { ok: true, data: null };
  } catch (error: unknown) {
    log.error('Échange du code MyAnimeList impossible :', error, '| redirect_uri :', redirectUri);
    // Code refusé (expiré, code_verifier ou redirect_uri différents de l'app MAL) : aucune session n'existait encore,
    // ce n'est pas une « session expirée » (AUTH-10)
    if (error instanceof ApiError && error.code === 'TOKEN_INVALID') {
      return { ok: false, code: 'AUTH_FLOW_FAILED', message: t('auth.exchangeFailed.mal', { url: redirectUri }) };
    }
    return { ok: false, code: 'UNKNOWN', message: error instanceof ApiError ? error.message : t('auth.finalizeFailed') };
  }
}

interface AccessTokenOptions {
  /** Token refusé par l'API (401) : renouvelé seulement s'il est toujours le token enregistré (AUTH-08) */
  rejected?: string;
}

/** Token à renouveler : expiré ou dans la marge de renouvellement anticipé */
function isExpiring(token: MalToken): boolean {
  return token.expiresAt - REFRESH_MARGIN_MS <= Date.now();
}

/**
 * Access token MAL valide, renouvelé si nécessaire (ou si `rejected` est toujours le token enregistré, après un 401).
 * Retourne null si l'utilisateur n'est pas connecté, si la session ne peut plus être renouvelée, ou si elle a été
 * fermée pendant le renouvellement.
 * Le verrou évite deux renouvellements simultanés (le premier invaliderait le refresh token du second). Ordre des
 * verrous : renouvellement MAL → stockage (voir sync/entry-lock.ts).
 */
export async function getMalAccessToken({ rejected }: AccessTokenOptions = {}): Promise<string | null> {
  const token = await getMalToken();
  if (!token) return null;
  if (token.accessToken !== rejected && !isExpiring(token)) return token.accessToken;

  return navigator.locks.request(REFRESH_LOCK, async () => {
    const current = await getMalToken();
    // Session relevée APRÈS le token : une déconnexion entre les deux lectures donne undefined
    const epoch = (await getOpenSessions()).mal;
    if (!current || epoch === undefined) return null;
    // Renouvelé par un autre appel (pendant l'attente du verrou, ou depuis le 401) : comparé au token refusé, pas au
    // token relu, sinon chaque 401 concurrent relancerait un renouvellement (AUTH-08)
    if (current.accessToken !== rejected && !isExpiring(current)) return current.accessToken;

    try {
      const refreshed = await requestToken({ grant_type: 'refresh_token', refresh_token: current.refreshToken });
      // Déconnexion (ou autre compte) pendant la requête : le token renouvelé est abandonné, la session reste fermée (AUTH-01)
      if (await saveRefreshedMalToken(current.accessToken, refreshed, epoch)) return refreshed.accessToken;
      log.warn('Session MyAnimeList fermée pendant le renouvellement : token abandonné');
      return null;
    } catch (error: unknown) {
      if (error instanceof ApiError && error.code === 'TOKEN_INVALID') {
        // Session fermée seulement si ce token est toujours enregistré : une reconnexion entre-temps est conservée (AUTH-02)
        await endSessionIfToken('mal', current.accessToken);
        return null;
      }
      throw error; // Réseau : la session reste valide, on réessaiera plus tard
    }
  });
}
