import type { AniListToken } from '../../shared/auth.types';
import { createLogger } from '../logger';
import type { MalToken } from '../../shared/mal.types';
import { endSessionIfUnreadable } from '../storage/session-end';
import { encryptLegacyTokens, readSessionToken, readStoredToken, type TokenOf } from '../storage/tokens';
import { SessionChangedError } from '../../shared/session-epochs';
import { TRACKER_IDS, type TrackerId } from '../../shared/tracker.types';

// Lecture des tokens OAuth déchiffrés (SEC-01), réservée au service worker (requêtes AniList / MAL). Les pages de
// l'extension se contentent de la présence (browser/storage/tokens.ts : hasValidAniListToken, hasMalToken). À ne jamais appeler sous
// le verrou du stockage : la migration et la déconnexion le prennent (ordre des verrous : sync/entry-lock.ts).

const log = createLogger('storage');

const LABELS: Record<TrackerId, string> = { anilist: 'AniList', mal: 'MyAnimeList' };

/** `session` : requête liée à cette session (écriture décidée sous elle), refusée si elle a été fermée ou remplacée (L2) */
async function readToken<S extends TrackerId>(service: S, session: number | undefined): Promise<TokenOf[S] | null> {
  const read = session === undefined ? await readStoredToken(service) : await readSessionToken(service, session);
  if (read === null) throw new SessionChangedError(service);
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

/**
 * Token AniList déchiffré s'il existe et n'a pas expiré. `session` : celui de cette session seulement, sinon
 * SessionChangedError (une écriture décidée sous une session n'utilise jamais le token d'une session plus récente, L2).
 */
export async function getValidToken(session?: number): Promise<AniListToken | null> {
  const token = await readToken('anilist', session);
  return token !== null && token.expiresAt > Date.now() ? token : null;
}

/** Token MAL déchiffré, même expiré : le refresh token permet de le renouveler. `session` : voir getValidToken. */
export function getMalToken(session?: number): Promise<MalToken | null> {
  return readToken('mal', session);
}

/**
 * Valeurs secrètes des tokens enregistrés, pour les masquer dans le rapport de diagnostic construit par le service
 * worker (GET_DIAGNOSTICS_REPORT, SEC-06 ; jamais affichées ni envoyées à une page). Sans
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
