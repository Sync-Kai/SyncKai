/**
 * Accès à Netflix, activé à la demande (Réglages › Lecture & synchro) : permission d'hôte optionnelle.
 * L'état de l'accès EST la permission : rien n'est stocké. Le service worker enregistre ou retire les scripts
 * Netflix quand la permission change (background/netflix-access.ts).
 */
import { NETFLIX_MATCHES } from './target-pages';

/** true si l'accès à netflix.com est accordé ; API absente ou en échec → false (l'interrupteur reste éteint) */
export async function hasNetflixAccess(): Promise<boolean> {
  if (typeof chrome === 'undefined' || !chrome.permissions?.contains) return false;
  try {
    return await chrome.permissions.contains({ origins: [...NETFLIX_MATCHES] });
  } catch {
    return false;
  }
}

/**
 * Demande l'accès. À appeler directement dans le gestionnaire du clic : Firefox exige un geste utilisateur
 * et refuse la demande si un `await` le précède.
 */
export function requestNetflixAccess(): Promise<boolean> {
  return chrome.permissions.request({ origins: [...NETFLIX_MATCHES] });
}

/** Retire l'accès (les scripts Netflix sont désenregistrés par le service worker) */
export function removeNetflixAccess(): Promise<boolean> {
  return chrome.permissions.remove({ origins: [...NETFLIX_MATCHES] });
}
