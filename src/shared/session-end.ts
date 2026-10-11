import { refreshReviewBadge } from './badge';
import { clearAniListSession, clearMalSession, clearUserSyncDataIfNoSession } from './storage';
import type { TrackerId } from './tracker.types';

/**
 * Ferme la session d'un service : déconnexion depuis l'interface ou token refusé par le service. Efface la session,
 * puis les données de l'utilisateur si plus aucun service n'est connecté (un token AniList seulement expiré compte
 * encore), et met à jour le badge de l'icône.
 */
export async function endSession(service: TrackerId): Promise<void> {
  await (service === 'anilist' ? clearAniListSession() : clearMalSession());
  await clearUserSyncDataIfNoSession();
  await refreshReviewBadge();
}
