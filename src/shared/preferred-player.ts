/**
 * Accès à Netflix, activé à la demande (Réglages › Lecture & synchro) : permission d'hôte optionnelle, voir
 * platform-access.ts. Netflix et Prime Video peuvent être le lecteur préféré parmi les plateformes optionnelles (pas
 * Disney+) : ce module garde les règles de ce réglage (lecteur effectif, correction quand l'accès est retiré).
 */
import type { StreamingPlatform } from './episode.types';
import { hasPlatformAccess } from './platform-access';
import { ACCESS_PLAYERS, DEFAULT_SETTINGS, effectivePlayer, getSettings, saveSettings } from './settings';
import { withStorageLock } from '../browser/storage/lock';

/** true si l'accès à netflix.com est accordé ; API absente ou en échec → false (l'interrupteur reste éteint) */
export function hasNetflixAccess(): Promise<boolean> {
  return hasPlatformAccess('netflix');
}

/** true si le lecteur préféré dépend d'un accès optionnel (Netflix, Prime Video) */
const needsAccess = (preferred: StreamingPlatform): boolean => ACCESS_PLAYERS.includes(preferred);

/** Lecteur préféré effectif (voir `effectivePlayer`) ; la permission n'est lue que si le réglage vaut Netflix ou Prime Video */
export async function effectivePreferredPlayer(preferred: StreamingPlatform): Promise<StreamingPlatform> {
  return effectivePlayer(preferred, needsAccess(preferred) && (await hasPlatformAccess(preferred)) ? [preferred] : []);
}

/**
 * Lecteur préféré « Netflix » ou « Prime Video » sans l'accès (retiré dans chrome://extensions ou about:addons,
 * sauvegarde importée sur un profil sans l'accès) : remis à la valeur par défaut, sous verrou. Appelé par le service
 * worker au retrait de la permission et au démarrage. Retourne true si le réglage a été corrigé.
 */
export function resetRevokedPlayer(): Promise<boolean> {
  return withStorageLock(async () => {
    const settings = await getSettings();
    if (!needsAccess(settings.preferredPlayer) || (await hasPlatformAccess(settings.preferredPlayer))) return false;
    await saveSettings({ ...settings, preferredPlayer: DEFAULT_SETTINGS.preferredPlayer });
    return true;
  });
}
