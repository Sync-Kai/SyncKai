import { refreshReviewBadge } from './badge';
import { BACKUP_STORAGE_KEYS, bindBackupToSession, buildBackup, mergeBackup, sectionsFromStorage, type Backup, type BackupData, type ImportMode } from './backup';
import { isRecord } from './guards';
import { getOpenSessions, withStorageLock } from './storage';
import { createLogger } from './logger';
import { hasNetflixAccess } from './netflix-access';
import { effectivePlayer } from './settings';

const log = createLogger('backup');

// Lecture / écriture des sauvegardes dans chrome.storage.local (popup et page d'import).

async function readCurrent(appVersion: string): Promise<Backup> {
  return buildBackup(sectionsFromStorage(await readStored()), appVersion, new Date());
}

function readStored(): Promise<Record<string, unknown>> {
  return chrome.storage.local.get(Object.values(BACKUP_STORAGE_KEYS));
}

/** Sauvegarde des 7 clés exportables (jamais les tokens ni les caches). */
export function exportBackup(): Promise<Backup> {
  return readCurrent(chrome.runtime.getManifest().version);
}

/**
 * Applique une sauvegarde importée sous verrou, puis met à jour le badge de l'icône.
 * Lecteur préféré « Netflix » importé sur un profil sans l'accès Netflix : remplacé par le lecteur par défaut.
 */
export async function applyBackup(incoming: BackupData, mode: ImportMode, includeSettings: boolean): Promise<void> {
  const netflixGranted = await hasNetflixAccess();
  await withStorageLock(async () => {
    const stored = await readStored();
    const current = buildBackup(sectionsFromStorage(stored), chrome.runtime.getManifest().version, new Date());
    // Sessions relevées sous le verrou de la déconnexion : l'import vaut pour les comptes connectés à cet instant
    const next = mergeBackup(current.data, bindBackupToSession(incoming, await getOpenSessions()), mode, includeSettings);
    // Fusion : les correspondances que cette version ne sait pas lire sont gardées (ARCH-15), sauf clé importée
    const rawMappings: unknown = stored[BACKUP_STORAGE_KEYS.mediaMappings];
    const mediaMappings = mode === 'merge' && isRecord(rawMappings) ? { ...rawMappings, ...next.mediaMappings } : next.mediaMappings;
    const settings = next.settings && { ...next.settings, preferredPlayer: effectivePlayer(next.settings.preferredPlayer, netflixGranted) };
    const k = BACKUP_STORAGE_KEYS;
    await chrome.storage.local.set({
      ...(settings !== null ? { [k.settings]: settings } : {}),
      [k.mediaMappings]: mediaMappings,
      [k.pendingReviews]: next.pendingReviews,
      [k.recentSyncs]: next.recentSyncs,
      [k.excludedSeries]: next.excludedSeries,
      [k.pendingRatings]: next.pendingRatings,
      [k.rewatchDeclined]: next.rewatchDeclined,
    });
  });
  // Badge décoratif : son échec ne remet pas l'import en cause
  await refreshReviewBadge().catch((error: unknown) => log.warn('Badge non mis à jour après import :', error));
}
