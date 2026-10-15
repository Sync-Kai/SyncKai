// Jetons OAuth enregistrés (chiffrés au repos), indicateur de session expirée.
import { isAniListToken, type AniListToken } from '../../shared/auth.types';
import { isSealedToken, openToken, sealToken, type SealedToken } from '../tokens/crypto';
import { isMalToken, type MalToken } from '../../shared/mal.types';
import { TRACKER_IDS, type TrackerId } from '../../shared/tracker.types';
import { SESSION_EXPIRED_KEYS, STORAGE_KEYS } from '../../protocol/storage-keys';
import { withStorageLock } from './lock';

/** Session du service invalidée en arrière-plan depuis la dernière connexion (voir SESSION_EXPIRED_KEYS) */
export async function isSessionExpired(service: TrackerId): Promise<boolean> {
  const key = SESSION_EXPIRED_KEYS[service];
  return (await chrome.storage.local.get(key))[key] === true;
}

/** Pose (invalidation) ou retire (déconnexion volontaire, connexion) l'indicateur de session expirée */
export async function setSessionExpired(service: TrackerId, expired: boolean): Promise<void> {
  const key = SESSION_EXPIRED_KEYS[service];
  if (expired) await chrome.storage.local.set({ [key]: true });
  else await chrome.storage.local.remove(key);
}

// ─── Tokens OAuth (chiffrés au repos, SEC-01) ─────────────────────────────
// Enregistrés chiffrés (token-crypto.ts) : seul un contexte de l'origine de l'extension peut les lire. Le service
// worker les déchiffre (token-access.ts) ; les pages de l'extension n'ont besoin que de leur présence et de leur
// expiration, lisibles sans déchiffrement. Un token en clair (avant la 2.2.0) est chiffré au premier accès ou à la
// mise à jour (encryptLegacyTokens).

/** Token déchiffré de chaque service */
export interface TokenOf {
  anilist: AniListToken;
  mal: MalToken;
}

const TOKEN_STORAGE: { [S in TrackerId]: { key: string; guard: (value: unknown) => value is TokenOf[S] } } = {
  anilist: { key: STORAGE_KEYS.anilistToken, guard: isAniListToken },
  mal: { key: STORAGE_KEYS.malToken, guard: isMalToken },
};

/** Lecture d'un token enregistré */
export type StoredTokenRead<T> =
  | { kind: 'none' }
  /** Ancien format en clair, à chiffrer */
  | { kind: 'plain'; token: T }
  | { kind: 'sealed'; token: T; sealed: SealedToken }
  /** Chiffré indéchiffrable (clé perdue, contenu altéré) : session inutilisable */
  | { kind: 'unreadable'; sealed: SealedToken };

/** Un token est enregistré (chiffré ou ancien format en clair), sans le déchiffrer */
export function isStoredToken(service: TrackerId, value: unknown): boolean {
  return isSealedToken(value) || TOKEN_STORAGE[service].guard(value);
}

/** Expiration d'un token enregistré, sans le déchiffrer ; null si absent */
function storedExpiry(service: TrackerId, value: unknown): number | null {
  if (isSealedToken(value)) return value.expiresAt;
  const guard = TOKEN_STORAGE[service].guard;
  return guard(value) ? value.expiresAt : null;
}

export async function readRawToken(service: TrackerId): Promise<unknown> {
  const key = TOKEN_STORAGE[service].key;
  return (await chrome.storage.local.get(key))[key];
}

/**
 * Token du service, déchiffré, sans verrou ni effet de bord (ni migration, ni déconnexion : voir token-access.ts).
 * Lève une erreur seulement si la clé est inaccessible (IndexedDB indisponible).
 */
export async function readStoredToken<S extends TrackerId>(service: S): Promise<StoredTokenRead<TokenOf[S]>> {
  const { guard } = TOKEN_STORAGE[service];
  const raw = await readRawToken(service);
  if (guard(raw)) return { kind: 'plain', token: raw };
  if (!isSealedToken(raw)) return { kind: 'none' };
  const opened = await openToken(service, raw);
  return opened.ok && guard(opened.value) ? { kind: 'sealed', token: opened.value, sealed: raw } : { kind: 'unreadable', sealed: raw };
}

/** Token lisible d'une lecture (déchiffré ou ancien format), sinon null */
export function tokenOf<T>(read: StoredTokenRead<T>): T | null {
  return read.kind === 'plain' || read.kind === 'sealed' ? read.token : null;
}

/** Token AniList enregistré, même expiré (« Reconnecter ») : la session reste ouverte jusqu'à la déconnexion. */
export async function hasAniListToken(): Promise<boolean> {
  return isStoredToken('anilist', await readRawToken('anilist'));
}

/** Token AniList enregistré et non expiré (pages de l'extension : connecté, sans déchiffrement) */
export async function hasValidAniListToken(): Promise<boolean> {
  const expiresAt = storedExpiry('anilist', await readRawToken('anilist'));
  return expiresAt !== null && expiresAt > Date.now();
}

/** Token MAL enregistré, même expiré : le refresh token permet de le renouveler. */
export async function hasMalToken(): Promise<boolean> {
  return isStoredToken('mal', await readRawToken('mal'));
}

/** Connexion AniList réussie : nouveau token (chiffré), indicateur « Session expirée » retiré */
export async function saveToken(token: AniListToken): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEYS.anilistToken]: await sealToken('anilist', token) });
  await setSessionExpired('anilist', false);
}

/**
 * Migration (mise à jour vers la 2.2.0, ou premier accès) : chiffre les tokens encore en clair, sous le verrou du
 * stockage. Lève une erreur si la clé est inaccessible (les tokens restent alors lisibles en clair, nouvel essai au
 * prochain accès). Retourne le nombre de tokens chiffrés.
 */
export function encryptLegacyTokens(): Promise<number> {
  return withStorageLock(async () => {
    let sealed = 0;
    for (const service of TRACKER_IDS) {
      const { key, guard } = TOKEN_STORAGE[service];
      const raw = await readRawToken(service);
      if (!guard(raw)) continue;
      await chrome.storage.local.set({ [key]: await sealToken(service, raw) });
      sealed++;
    }
    return sealed;
  });
}

/** Connexion MAL (nouvelle session, token chiffré), indicateur « Session expirée » retiré. Un renouvellement passe par saveRefreshedMalToken. */
export async function saveMalToken(token: MalToken): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEYS.malToken]: await sealToken('mal', token) });
  await setSessionExpired('mal', false);
}
