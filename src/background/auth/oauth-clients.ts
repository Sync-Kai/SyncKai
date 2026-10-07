// Clients OAuth par navigateur. Chaque navigateur attribue son propre ID d'extension, donc sa propre
// URL de redirection (chrome.identity.getRedirectURL()). AniList n'accepte qu'une URL par client (et on
// n'envoie jamais redirect_uri) : il faut un client AniList et une app MAL par navigateur.
// Identifiants publics uniquement (Implicit Grant / PKCE) : aucun secret ici.

export interface OAuthClients {
  /** Client AniList (Implicit Grant) dont la Redirect URL correspond à ce navigateur */
  anilistClientId: string;
  /** App MyAnimeList de type "other" (PKCE, sans secret) dont l'App Redirect URL correspond à ce navigateur */
  malClientId: string;
}

/** ID Chrome Web Store, fixé par la clé publique `key` du manifest (build local inclus) */
export const CHROME_EXTENSION_ID = 'khokcmigioggannjoojambdgioigdceb';

/** ID Firefox (browser_specific_settings.gecko.id) : c'est aussi chrome.runtime.id sous Firefox */
export const FIREFOX_ADDON_ID = 'synckai@sync-kai.github.io';

// Map plutôt qu'objet : un ID inattendu (« toString », « __proto__ ») ne remonte jamais le prototype
const OAUTH_CLIENTS: ReadonlyMap<string, OAuthClients> = new Map<string, OAuthClients>([
  [CHROME_EXTENSION_ID, { anilistClientId: '52346', malClientId: '84d05521c007a529cc458421bd0940c5' }],
  // Redirect URL : https://01497c3a0de229567af456487a2af9d686551088.extensions.allizom.org/
  // (SHA-1 de FIREFOX_ADDON_ID, vérifiée le 2026-10-07 via chrome.identity.getRedirectURL())
  [FIREFOX_ADDON_ID, { anilistClientId: '52509', malClientId: '1846238e6ea67a5109899f5311a51d15' }],
]);

/**
 * Clients OAuth du navigateur courant, ou null si l'ID n'est pas enregistré
 * (build non empaqueté sans `key`, navigateur dont les clients ne sont pas encore créés).
 */
export function getOAuthClients(runtimeId: string = chrome.runtime.id): OAuthClients | null {
  return OAUTH_CLIENTS.get(runtimeId) ?? null;
}

/** Issue d'un échec de launchWebAuthFlow */
export type AuthFlowErrorKind = 'cancelled' | 'rejected' | 'failed';

/**
 * Classe le message d'erreur de launchWebAuthFlow (fonction pure).
 * - rejected : la page d'autorisation n'a pas pu être chargée (client_id invalide, redirection non enregistrée) ;
 * - cancelled : fenêtre fermée ou accès refusé par l'utilisateur
 *   (Chrome : « The user did not approve access. », Firefox : « User cancelled or denied access. ») ;
 * - failed : tout le reste.
 * « could not be loaded » est testé en premier : c'est une erreur de configuration, jamais une annulation.
 */
export function classifyAuthFlowError(message: string): AuthFlowErrorKind {
  if (/could not be loaded/i.test(message)) return 'rejected';
  if (/did not approve|cancel|denied/i.test(message)) return 'cancelled';
  return 'failed';
}
