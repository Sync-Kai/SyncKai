import type { AniListToken } from './auth.types';
import { createLogger } from './logger';
import type { MalToken } from './mal.types';
import { endSessionIfUnreadable } from './session-end';
import { encryptLegacyTokens, readStoredToken, type TokenOf } from './storage';
import { TRACKER_IDS, type TrackerId } from './tracker.types';

// Lecture des tokens OAuth déchiffrés (SEC-01), réservée au service worker (requêtes AniList / MAL). Les pages de
// l'extension se contentent de la présence (storage.ts : hasValidAniListToken, hasMalToken). À ne jamais appeler sous
// le verrou du stockage : la migration et la déconnexion le prennent (ordre des verrous : sync/entry-lock.ts).

const log = createLogger('storage');

const LABELS: Record<TrackerId, string> = { anilist: 'AniList', mal: 'MyAnimeList' };

async function readToken<S extends TrackerId>(service: S): Promise<TokenOf[S] | null> {
  const read = await readStoredToken(service);
  switch (read.kind) {
    case 'none':
      return null;
    case 'sealed':
      return read.token;
    case 'plain':
      // Ancien token en clair : chiffré au premier accès. Un échec (IndexedDB indisponible) le laisse en place, lisible ;
      // nouvel essai au prochain accès
      try {
        await encryptLegacyTokens();
      } catch (error: unknown) {
        log.warn(`Token ${LABELS[service]} non chiffré :`, error);
      }
      return read.token;
    case 'unreadable':
      // Clé perdue (IndexedDB vidée) : la session ne peut plus servir, déconnexion propre (« Session expirée »)
      log.warn(`Token ${LABELS[service]} indéchiffrable : session fermée`);
      await endSessionIfUnreadable(service, read.sealed);
      return null;
  }
}

/** Token AniList déchiffré s'il existe et n'a pas expiré. */
export async function getValidToken(): Promise<AniListToken | null> {
  const token = await readToken('anilist');
  return token !== null && token.expiresAt > Date.now() ? token : null;
}

/** Token MAL déchiffré, même expiré : le refresh token permet de le renouveler. */
export function getMalToken(): Promise<MalToken | null> {
  return readToken('mal');
}

/**
 * Valeurs secrètes des tokens enregistrés, pour les masquer dans le rapport de diagnostic (jamais affichées). Sans
 * effet de bord : un token indéchiffrable ou une clé inaccessible sont ignorés.
 */
export async function readTokenSecrets(): Promise<string[]> {
  const values: string[] = [];
  for (const service of TRACKER_IDS) {
    try {
      const read = await readStoredToken(service);
      if (read.kind !== 'plain' && read.kind !== 'sealed') continue;
      values.push(read.token.accessToken);
      if ('refreshToken' in read.token) values.push(read.token.refreshToken);
    } catch {
      // Clé inaccessible : rien à masquer de plus (aucun token en clair dans le stockage)
    }
  }
  return values;
}
