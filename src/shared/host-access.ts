/**
 * Accès aux sites (host permissions). Firefox laisse l'utilisateur les retirer (et ne les accordait pas
 * à l'installation avant Firefox 127) : sans elles, le script de contenu ne s'exécute plus sur
 * Crunchyroll / ADN et les API AniList / MAL sont bloquées. Sur Chrome, la vérification passe toujours.
 */

interface ManifestOrigins {
  host_permissions?: string[];
  content_scripts?: { matches?: string[] }[];
}

/** Origines requises : host_permissions + sites des scripts de contenu, sans doublon */
export function requiredOrigins(manifest: ManifestOrigins): string[] {
  const origins = [...(manifest.host_permissions ?? []), ...(manifest.content_scripts ?? []).flatMap((script) => script.matches ?? [])];
  return [...new Set(origins)];
}

/** true si toutes les origines sont accordées ; API absente ou en échec → considéré comme accordé (pas de faux bandeau) */
export async function hasHostAccess(origins: readonly string[]): Promise<boolean> {
  if (origins.length === 0 || typeof chrome === 'undefined' || !chrome.permissions?.contains) return true;
  try {
    return await chrome.permissions.contains({ origins: [...origins] });
  } catch {
    return true;
  }
}

/**
 * Demande l'accès. À appeler directement dans le gestionnaire du clic : Firefox exige un geste utilisateur
 * et refuse la demande si un `await` le précède.
 */
export function requestHostAccess(origins: readonly string[]): Promise<boolean> {
  return chrome.permissions.request({ origins: [...origins] });
}
