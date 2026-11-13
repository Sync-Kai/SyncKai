import { ensureAiringAlarm } from '../airing-alarm';
import { refreshReviewBadge } from '../badge';
import {
  clearAniListSession,
  clearAniListSessionIfToken,
  clearMalSession,
  clearMalSessionIfToken,
  clearUnreadableSession,
  clearUserSyncDataForNewAccount,
  clearUserSyncDataIfNoSession,
} from './account-data';
import type { SessionEndReason } from './account-keys';
import type { SealedToken } from '../tokens/crypto';
import type { TrackerId } from '../../shared/tracker.types';
import { trace } from '../debug-trace-client';

/**
 * Après la fermeture d'une session : données de l'utilisateur si plus aucun service n'est connecté (une session expirée
 * garde l'historique d'activité), badge de l'icône, alarme des sorties supprimée s'il ne reste aucun service
 * (PERF-17 : depuis la page comme depuis le service worker)
 */
async function afterSessionEnd(reason: SessionEndReason): Promise<void> {
  await clearUserSyncDataIfNoSession(reason);
  await refreshReviewBadge();
  await ensureAiringAlarm();
}

/**
 * Ferme la session d'un service : déconnexion depuis l'interface ou token refusé par le service. Efface la session,
 * puis les données de l'utilisateur si plus aucun service n'est connecté (un token AniList seulement expiré compte
 * encore), et met à jour le badge de l'icône.
 */
export async function endSession(service: TrackerId): Promise<void> {
  // Trace de débogage (builds de développement seulement) : depuis une page (Réglages) ou le service worker
  if (__SYNCKAI_DEBUG__) trace('account', 'sign-out', { service });
  await (service === 'anilist' ? clearAniListSession() : clearMalSession());
  await afterSessionEnd('sign-out');
}

/**
 * Connexion d'un autre compte par-dessus une session encore enregistrée (STO-01, décision 11 b) : données de
 * l'utilisateur de l'ancien compte effacées si plus aucun autre service n'est connecté, puis badge de l'icône.
 */
export async function endPreviousAccountData(service: TrackerId): Promise<void> {
  if (__SYNCKAI_DEBUG__) trace('account', 'account-changed', { service });
  if (await clearUserSyncDataForNewAccount(service)) await refreshReviewBadge();
}

/**
 * Token `accessToken` refusé par le service : ferme la session seulement s'il est toujours le token enregistré
 * (une reconnexion ou un renouvellement entre-temps est conservé, AUTH-02). Retourne true si la session a été fermée.
 */
export async function endSessionIfToken(service: TrackerId, accessToken: string): Promise<boolean> {
  const ended = await (service === 'anilist' ? clearAniListSessionIfToken(accessToken) : clearMalSessionIfToken(accessToken));
  if (__SYNCKAI_DEBUG__) trace('account', 'token-rejected', { service, sessionExpired: ended });
  if (ended) await afterSessionEnd('expired');
  return ended;
}

/**
 * Token `sealed` indéchiffrable (clé perdue) : session fermée avec « Session expirée » s'il est toujours le token
 * enregistré, comme un token refusé. Le token est retiré : la lecture suivante ne recommence pas. Retourne true si la
 * session a été fermée.
 */
export async function endSessionIfUnreadable(service: TrackerId, sealed: SealedToken): Promise<boolean> {
  const ended = await clearUnreadableSession(service, sealed);
  if (__SYNCKAI_DEBUG__) trace('account', 'token-unreadable', { service, sessionExpired: ended });
  if (ended) await afterSessionEnd('expired');
  return ended;
}
