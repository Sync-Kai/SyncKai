import type { MediaRef } from '../shared/engagement.types';

/**
 * Série telle que le service worker l'attend : identifiants et titre borné à 300 caractères, comme le valide `isMediaRef`.
 * Hors de shared/ : le budget du script de contenu Crunchyroll / ADN ne laisse aucune marge à du code des pages seules.
 */
export function mediaRefOf(mediaId: number | null, malId: number | null, title: string): MediaRef {
  return { mediaId, malId, title: title.slice(0, 300) };
}
