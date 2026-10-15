/** Caractères autorisés dans un code_verifier PKCE (RFC 7636, "unreserved") */
const VERIFIER_CHARSET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
export const VERIFIER_LENGTH = 64; // RFC : 43 à 128 caractères

/**
 * Génère un code_verifier à partir d'octets aléatoires (injectés pour les tests).
 * Le modulo sur 66 caractères introduit un biais négligeable, sans impact sur la sécurité ici.
 */
export function createCodeVerifier(randomBytes: Uint8Array = crypto.getRandomValues(new Uint8Array(VERIFIER_LENGTH))): string {
  return Array.from(randomBytes.slice(0, VERIFIER_LENGTH), (byte) => VERIFIER_CHARSET[byte % VERIFIER_CHARSET.length]).join('');
}

/** Valeur "state" anti-CSRF : vérifiée au retour de la redirection OAuth */
export function createState(): string {
  return createCodeVerifier(crypto.getRandomValues(new Uint8Array(VERIFIER_LENGTH))).slice(0, 32);
}
