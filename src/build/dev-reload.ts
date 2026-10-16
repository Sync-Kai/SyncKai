/**
 * Rechargement automatique des builds de développement : `npm run build:dev` écrit `dev-build.json` (horodatage du build)
 * dans le dossier de sortie, une fois tous les fichiers écrits ; le service worker du build qui tourne le relit
 * périodiquement et se recharge (`chrome.runtime.reload()`) quand l'horodatage diffère du sien. Jamais en production :
 * fichier non écrit, code sous `__SYNCKAI_DEBUG__` (scripts/build-checks.ts › DEV_ONLY_MARKERS). Sans import : chargé tel
 * quel par vite.config.ts.
 */

/** Fichier témoin, à la racine du dossier de sortie */
export const DEV_BUILD_FILE = 'dev-build.json';

/** Contenu du fichier témoin pour l'horodatage du build (`__SYNCKAI_BUILD__`) */
export function devBuildPayload(stamp: string): string {
  return `${JSON.stringify({ stamp })}\n`;
}

/** Nouveau build sur le disque : horodatage lisible et différent de celui du build qui tourne. Fichier illisible (build en cours) : non */
export function devBuildChanged(running: string, body: string): boolean {
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    return false;
  }
  if (typeof parsed !== 'object' || parsed === null || !('stamp' in parsed)) return false;
  const { stamp } = parsed;
  return typeof stamp === 'string' && stamp !== '' && stamp !== running;
}
