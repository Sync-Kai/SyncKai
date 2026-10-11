import { t } from '../../i18n';
import type { AuthResult } from '../../shared/auth.types';
import { isRecord } from '../../shared/guards';
import type { MalToken } from '../../shared/mal.types';
import { endSession } from '../../shared/session-end';
import { getMalToken, saveMalToken } from '../../shared/storage';
import { ApiError } from '../api/errors';
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

/** POST sur l'endpoint de token (échange de code ou renouvellement). */
async function requestToken(params: Record<string, string>): Promise<MalToken> {
  const clients = getOAuthClients();
  if (!clients) {
    // Aucune app MAL pour ce navigateur : la session ne peut pas être renouvelée → reconnexion requise
    const redirectUri = chrome.identity.getRedirectURL();
    log.warn('Aucune app MyAnimeList pour cet ID d’extension | redirect_uri à enregistrer :', redirectUri);
    throw new ApiError('TOKEN_INVALID', t('auth.notConfigured', { url: redirectUri }));
  }
  let response: Response;
  try {
    response = await fetch(MAL_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: clients.malClientId, ...params }),
    });
  } catch {
    throw new ApiError('NETWORK', t('api.network', { service: 'MyAnimeList' }));
  }

  // 400/401 : code expiré, refresh token révoqué… → une nouvelle connexion est nécessaire
  if (response.status === 400 || response.status === 401) {
    throw new ApiError('TOKEN_INVALID', t('api.sessionExpired', { service: 'MyAnimeList' }));
  }
  if (!response.ok) throw new ApiError('API_ERROR', t('api.httpError', { service: 'MyAnimeList', status: response.status }), { httpStatus: response.status });

  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    // traité ci-dessous
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
    log.error('Échange du code MyAnimeList impossible :', error);
    return { ok: false, code: 'UNKNOWN', message: error instanceof ApiError ? error.message : t('auth.finalizeFailed') };
  }
}

/**
 * Access token MAL valide, renouvelé si nécessaire (ou si `forceRefresh`, après un 401).
 * Retourne null si l'utilisateur n'est pas connecté ou si la session ne peut plus être renouvelée.
 * Le verrou évite deux renouvellements simultanés (le premier invaliderait le refresh token du second).
 */
export async function getMalAccessToken(forceRefresh = false): Promise<string | null> {
  const token = await getMalToken();
  if (!token) return null;
  if (!forceRefresh && token.expiresAt - REFRESH_MARGIN_MS > Date.now()) return token.accessToken;

  return navigator.locks.request(REFRESH_LOCK, async () => {
    const current = await getMalToken();
    if (!current) return null;
    // Renouvelé par un autre appel pendant l'attente du verrou
    if (current.accessToken !== token.accessToken && current.expiresAt - REFRESH_MARGIN_MS > Date.now()) return current.accessToken;

    try {
      const refreshed = await requestToken({ grant_type: 'refresh_token', refresh_token: current.refreshToken });
      await saveMalToken(refreshed);
      return refreshed.accessToken;
    } catch (error: unknown) {
      if (error instanceof ApiError && error.code === 'TOKEN_INVALID') {
        await endSession('mal');
        return null;
      }
      throw error; // Réseau : la session reste valide, on réessaiera plus tard
    }
  });
}
