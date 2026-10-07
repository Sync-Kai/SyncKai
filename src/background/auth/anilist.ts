import { t } from '../../i18n';
import type { AniListToken, AuthResult } from '../../shared/auth.types';
import { saveToken } from '../../shared/storage';
import { createLogger } from '../../shared/logger';
import { classifyAuthFlowError, getOAuthClients } from './oauth-clients';

const log = createLogger('auth');

const ANILIST_AUTHORIZE_URL = 'https://anilist.co/api/v2/oauth/authorize';

/**
 * Lance le flux OAuth2 Implicit Grant d'AniList et stocke le token obtenu.
 * Ne lève jamais : toute erreur est convertie en AuthResult.
 */
export async function loginWithAniList(): Promise<AuthResult> {
  const redirectUri = chrome.identity.getRedirectURL();
  const clients = getOAuthClients();
  if (!clients) {
    // ID d'extension sans client AniList enregistré : la redirection serait rejetée par AniList
    log.warn('Aucun client AniList pour cet ID d’extension | redirect_uri à enregistrer :', redirectUri);
    return { ok: false, code: 'AUTH_FLOW_FAILED', message: t('auth.notConfigured', { url: redirectUri }) };
  }

  const authUrl = new URL(ANILIST_AUTHORIZE_URL);
  authUrl.searchParams.set('client_id', clients.anilistClientId);
  authUrl.searchParams.set('response_type', 'token');
  // Pas de redirect_uri : AniList redirige vers l'URL enregistrée sur le client (= redirectUri),
  // ce qui évite un rejet sur une différence mineure (slash final…).

  let responseUrl: string | undefined;
  try {
    responseUrl = await chrome.identity.launchWebAuthFlow({ url: authUrl.toString(), interactive: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    log.error('launchWebAuthFlow a échoué :', message, '| redirect_uri :', redirectUri);

    const kind = classifyAuthFlowError(message);
    // Fenêtre fermée ou accès refusé par l'utilisateur (libellés Chrome et Firefox)
    if (kind === 'cancelled') {
      return { ok: false, code: 'USER_CANCELLED', message: t('auth.cancelled') };
    }
    // Page d'auth en erreur (client_id invalide, redirect_uri non enregistrée chez AniList…)
    if (kind === 'rejected') {
      return {
        ok: false,
        code: 'AUTH_FLOW_FAILED',
        message: t('auth.rejected.anilist', { url: redirectUri }),
      };
    }
    return { ok: false, code: 'AUTH_FLOW_FAILED', message: t('auth.failed', { message }) };
  }

  if (!responseUrl) {
    return { ok: false, code: 'INVALID_RESPONSE', message: t('auth.noResponse.anilist') };
  }

  // Implicit Grant : le token est dans le fragment (#access_token=...&expires_in=...).
  // Une erreur (refus) peut arriver dans le fragment ou la query string.
  const url = new URL(responseUrl);
  const fragment = new URLSearchParams(url.hash.slice(1));
  const error = fragment.get('error') ?? url.searchParams.get('error');
  if (error) {
    log.warn('AniList a refusé l’accès :', error);
    return { ok: false, code: 'ACCESS_DENIED', message: t('auth.denied', { service: 'AniList' }) };
  }

  const accessToken = fragment.get('access_token');
  const expiresIn = Number(fragment.get('expires_in'));
  if (!accessToken || !Number.isFinite(expiresIn) || expiresIn <= 0) {
    log.error('Réponse OAuth invalide :', url.origin + url.pathname);
    return { ok: false, code: 'INVALID_RESPONSE', message: t('auth.invalidResponse.anilist') };
  }

  const token: AniListToken = { accessToken, expiresAt: Date.now() + expiresIn * 1000 };
  try {
    await saveToken(token);
  } catch (storageError: unknown) {
    log.error('Échec de la sauvegarde du token :', storageError);
    return { ok: false, code: 'UNKNOWN', message: t('auth.saveFailed') };
  }

  return { ok: true, data: null };
}
