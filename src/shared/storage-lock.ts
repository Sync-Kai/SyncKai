const STORAGE_LOCK = 'synckai:storage';

/**
 * Sérialise les lectures-modifications-écritures du stockage. Le popup, la page d'options et le
 * service worker partagent l'origine chrome-extension:// : le même verrou Web Locks les coordonne,
 * ce qui évite qu'une écriture en écrase une autre (ex : "Ignorer" pendant une synchro).
 * Module sans dépendance : importable par le logger (content script compris) sans cycle.
 */
export function withStorageLock<T>(task: () => Promise<T>): Promise<T> {
  return navigator.locks.request(STORAGE_LOCK, task);
}
