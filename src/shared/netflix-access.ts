/**
 * Accès à Netflix, activé à la demande (Réglages › Lecture & synchro) : permission d'hôte optionnelle, voir
 * platform-access.ts. Seul Netflix peut être le lecteur préféré parmi les plateformes optionnelles : ce module garde
 * les règles de ce réglage (lecteur effectif, correction quand l'accès est retiré).
 */
import type { StreamingPlatform } from './episode.types';
import { hasPlatformAccess } from './platform-access';
import { DEFAULT_SETTINGS, effectivePlayer, getSettings, saveSettings } from './settings';
import { withStorageLock } from './storage-lock';

/** true si l'accès à netflix.com est accordé ; API absente ou en échec → false (l'interrupteur reste éteint) */
export function hasNetflixAccess(): Promise<boolean> {
  return hasPlatformAccess('netflix');
}

/** Lecteur préféré effectif (voir `effectivePlayer`) ; la permission n'est lue que si le réglage vaut Netflix */
export async function effectivePreferredPlayer(preferred: StreamingPlatform): Promise<StreamingPlatform> {
  return preferred === 'netflix' ? effectivePlayer(preferred, await hasNetflixAccess()) : effectivePlayer(preferred, undefined);
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
