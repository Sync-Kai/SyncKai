import { isRecord } from './guards';
import { getTokenKey } from './token-key-store';
import type { TrackerId } from './tracker.types';

// Chiffrement des tokens OAuth au repos (SEC-01) : AES-GCM 256 bits, IV aléatoire de 96 bits à chaque écriture, clé non
// extractible de token-key-store.ts. Le service (anilist / mal) est lié au chiffré (données authentifiées) : un token
// recopié sous la clé de l'autre service ne se déchiffre pas.

export const SEALED_TOKEN_VERSION = 1;

/** Token chiffré tel qu'enregistré dans storage.local (iv et data en base64) */
export interface SealedToken {
  v: typeof SEALED_TOKEN_VERSION;
  iv: string;
  data: string;
  /**
   * Expiration de l'access token (ms), en clair : non secrète, elle permet aux pages de l'extension de savoir si la
   * session est valide sans rien déchiffrer. Le token déchiffré reste la référence.
   */
  expiresAt: number;
}

const IV_BYTES = 12;
/** Taille maximale d'un chiffré accepté (les tokens AniList font environ 1 Ko) */
const MAX_DATA_LENGTH = 16_384;

export function isSealedToken(value: unknown): value is SealedToken {
  return (
    isRecord(value) &&
    value.v === SEALED_TOKEN_VERSION &&
    typeof value.iv === 'string' &&
    value.iv.length > 0 &&
    typeof value.data === 'string' &&
    value.data.length > 0 &&
    value.data.length <= MAX_DATA_LENGTH &&
    typeof value.expiresAt === 'number' &&
    Number.isFinite(value.expiresAt)
  );
}

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function fromBase64(text: string): Uint8Array<ArrayBuffer> | null {
  try {
    return Uint8Array.from(atob(text), (char) => char.charCodeAt(0));
  } catch {
    return null;
  }
}

const additionalData = (service: TrackerId): Uint8Array<ArrayBuffer> => new TextEncoder().encode(`synckai:${service}-token:v${SEALED_TOKEN_VERSION}`);

/** Chiffre un token (clé créée au premier chiffrement). Lève une erreur si la clé est inaccessible : rien n'est écrit en clair. */
export async function sealToken(service: TrackerId, token: { expiresAt: number }): Promise<SealedToken> {
  const key = await getTokenKey(true);
  if (!key) throw new Error('Clé de chiffrement des tokens indisponible');
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const plain = new TextEncoder().encode(JSON.stringify(token));
  const data = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: additionalData(service) }, key, plain));
  return { v: SEALED_TOKEN_VERSION, iv: toBase64(iv), data: toBase64(data), expiresAt: token.expiresAt };
}

export type OpenedToken = { ok: true; value: unknown } | { ok: false };

/**
 * Déchiffre un token. `{ ok: false }` : clé absente (IndexedDB vidée), chiffré altéré ou d'une autre clé, contenu
 * illisible ; la session ne peut plus être utilisée. Lève une erreur seulement si IndexedDB est inaccessible (passager).
 */
export async function openToken(service: TrackerId, sealed: SealedToken): Promise<OpenedToken> {
  const key = await getTokenKey(false);
  const iv = fromBase64(sealed.iv);
  const data = fromBase64(sealed.data);
  if (!key || !iv || iv.length !== IV_BYTES || !data) return { ok: false };
  try {
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv, additionalData: additionalData(service) }, key, data);
    const value: unknown = JSON.parse(new TextDecoder().decode(plain));
    return { ok: true, value };
  } catch {
    return { ok: false };
  }
}
