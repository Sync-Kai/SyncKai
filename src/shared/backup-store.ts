import { refreshReviewBadge } from './badge';
import { BACKUP_STORAGE_KEYS, bindBackupToSession, buildBackup, mergeBackup, sectionsFromStorage, type Backup, type BackupData, type ImportMode } from './backup';
import { getOpenSessions, withStorageLock } from './storage';
import { createLogger } from './logger';
import { hasNetflixAccess } from './netflix-access';
import { effectivePlayer } from './settings';

const log = createLogger('backup');

// Lecture / écriture des sauvegardes dans chrome.storage.local (popup et page d'import).

async function readCurrent(appVersion: string): Promise<Backup> {
  const stored = await chrome.storage.local.get(Object.values(BACKUP_STORAGE_KEYS));
  return buildBackup(sectionsFromStorage(stored), appVersion, new Date());
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
    const current = await readCurrent(chrome.runtime.getManifest().version);
    // Sessions relevées sous le verrou de la déconnexion : l'import vaut pour les comptes connectés à cet instant
    const next = mergeBackup(current.data, bindBackupToSession(incoming, await getOpenSessions()), mode, includeSettings);
    const settings = next.settings && { ...next.settings, preferredPlayer: effectivePlayer(next.settings.preferredPlayer, netflixGranted) };
    const k = BACKUP_STORAGE_KEYS;
    await chrome.storage.local.set({
      ...(settings !== null ? { [k.settings]: settings } : {}),
      [k.mediaMappings]: next.mediaMappings,
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
