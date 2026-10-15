/** Nom du verrou Web Locks partagé par toutes les pages de l'extension et le service worker */
export const STORAGE_LOCK = 'synckai:storage';

/**
 * Verrou brut, sans diagnostic. Module sans dépendance : utilisé par le journal (error-journal.ts),
 * importé par le logger, sans cycle ; le diagnostic d'attente (storage-lock.ts) passe, lui, par le logger.
 */
export function requestStorageLock<T>(task: () => Promise<T>): Promise<T> {
  return navigator.locks.request(STORAGE_LOCK, task);
}
