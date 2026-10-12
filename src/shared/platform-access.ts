/**
 * Plateformes activées à la demande (Réglages › Lecture & synchro) : Netflix, Disney+. Chacune est une permission
 * d'hôte optionnelle (`optional_host_permissions`) ; l'état de l'accès EST la permission, rien n'est stocké. Le
 * service worker enregistre ou retire les scripts de la plateforme quand elle change (background/platform-access.ts).
 */
import { isOptionalPlatform, PLATFORMS, STREAMING_PLATFORMS, type StreamingPlatform } from './platforms';

/**
 * true si l'accès à la plateforme est accordé ; toujours true pour une plateforme du manifeste (Crunchyroll, ADN).
 * API absente ou en échec → false (l'interrupteur reste éteint).
 */
export async function hasPlatformAccess(platform: StreamingPlatform): Promise<boolean> {
  if (!isOptionalPlatform(platform)) return true;
  if (typeof chrome === 'undefined' || !chrome.permissions?.contains) return false;
  try {
    return await chrome.permissions.contains({ origins: [...PLATFORMS[platform].optionalMatches] });
  } catch {
    return false;
  }
}

/**
 * Demande l'accès. À appeler directement dans le gestionnaire du clic : Firefox exige un geste utilisateur
 * et refuse la demande si un `await` le précède.
 */
export function requestPlatformAccess(platform: StreamingPlatform): Promise<boolean> {
  return chrome.permissions.request({ origins: [...PLATFORMS[platform].optionalMatches] });
}

/** Retire l'accès (les scripts de la plateforme sont désenregistrés par le service worker) */
export function removePlatformAccess(platform: StreamingPlatform): Promise<boolean> {
  return chrome.permissions.remove({ origins: [...PLATFORMS[platform].optionalMatches] });
}

/** Plateformes à accès optionnel actuellement accordées (ordre de STREAMING_PLATFORMS) */
export async function grantedOptionalPlatforms(): Promise<StreamingPlatform[]> {
  const optional = STREAMING_PLATFORMS.filter(isOptionalPlatform);
  const granted = await Promise.all(optional.map((platform) => hasPlatformAccess(platform)));
  return optional.filter((_, index) => granted[index]);
}

/** Plateformes réellement suivies : celles du manifeste, plus les plateformes optionnelles accordées */
export function activePlatforms(granted: readonly StreamingPlatform[]): StreamingPlatform[] {
  return STREAMING_PLATFORMS.filter((platform) => !isOptionalPlatform(platform) || granted.includes(platform));
}
