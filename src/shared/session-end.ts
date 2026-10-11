import { refreshReviewBadge } from './badge';
import { clearAniListSession, clearAniListSessionIfToken, clearMalSession, clearMalSessionIfToken, clearUserSyncDataIfNoSession } from './storage';
import type { TrackerId } from './tracker.types';

/** Après la fermeture d'une session : données de l'utilisateur si plus aucun service n'est connecté, badge de l'icône */
async function afterSessionEnd(): Promise<void> {
  await clearUserSyncDataIfNoSession();
  await refreshReviewBadge();
}

/**
 * Ferme la session d'un service : déconnexion depuis l'interface ou token refusé par le service. Efface la session,
 * puis les données de l'utilisateur si plus aucun service n'est connecté (un token AniList seulement expiré compte
 * encore), et met à jour le badge de l'icône.
 */
export async function endSession(service: TrackerId): Promise<void> {
  await (service === 'anilist' ? clearAniListSession() : clearMalSession());
  await afterSessionEnd();
}

/**
 * Token `accessToken` refusé par le service : ferme la session seulement s'il est toujours le token enregistré
 * (une reconnexion ou un renouvellement entre-temps est conservé, AUTH-02). Retourne true si la session a été fermée.
 */
export async function endSessionIfToken(service: TrackerId, accessToken: string): Promise<boolean> {
  const ended = await (service === 'anilist' ? clearAniListSessionIfToken(accessToken) : clearMalSessionIfToken(accessToken));
  if (ended) await afterSessionEnd();
  return ended;
}
