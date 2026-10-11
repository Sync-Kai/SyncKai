/**
 * Accès à Netflix, activé à la demande (Réglages › Lecture & synchro) : permission d'hôte optionnelle.
 * L'état de l'accès EST la permission : rien n'est stocké. Le service worker enregistre ou retire les scripts
 * Netflix quand la permission change (background/netflix-access.ts).
 */
import type { StreamingPlatform } from './episode.types';
import { DEFAULT_SETTINGS, effectivePlayer, getSettings, saveSettings } from './settings';
import { withStorageLock } from './storage-lock';
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

/** Lecteur préféré effectif (voir `effectivePlayer`) ; la permission n'est lue que si le réglage vaut Netflix */
export async function effectivePreferredPlayer(preferred: StreamingPlatform): Promise<StreamingPlatform> {
  return preferred === 'netflix' ? effectivePlayer(preferred, await hasNetflixAccess()) : preferred;
}

/**
 * Lecteur préféré « Netflix » sans l'accès (retiré dans chrome://extensions ou about:addons, sauvegarde importée
 * sur un profil sans l'accès) : remis à la valeur par défaut, sous verrou. Appelé par le service worker au retrait
 * de la permission et au démarrage. Retourne true si le réglage a été corrigé.
 */
export function resetRevokedNetflixPlayer(): Promise<boolean> {
  return withStorageLock(async () => {
    const settings = await getSettings();
    if (settings.preferredPlayer !== 'netflix' || (await hasNetflixAccess())) return false;
    await saveSettings({ ...settings, preferredPlayer: DEFAULT_SETTINGS.preferredPlayer });
    return true;
  });
}
