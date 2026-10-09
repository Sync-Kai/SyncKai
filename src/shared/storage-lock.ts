import { recordUnlocked } from './error-journal';
import { requestStorageLock, STORAGE_LOCK } from './storage-lock-core';

const SCOPE = 'lock';

/** Attente du verrou au-delà de laquelle un avertissement (unique) part dans le journal de diagnostic */
export const LOCK_WAIT_WARN_MS = 10_000;

/** Détenteurs et attentes du verrou du stockage : nombres et identifiants de client seulement */
export async function describeStorageLock(): Promise<string> {
  try {
    const { held = [], pending = [] } = await navigator.locks.query();
    const summary = (locks: readonly LockInfo[]): string => {
      const ours = locks.filter((lock) => lock.name === STORAGE_LOCK);
      return `${ours.length} [${ours.map((lock) => lock.clientId ?? '?').join(', ')}]`;
    };
    return `détenu ${summary(held)}, en attente ${summary(pending)}`;
  } catch {
    return 'état du verrou indisponible';
  }
}

/**
 * Sérialise les lectures-modifications-écritures du stockage. Le popup, la page d'options et le
 * service worker partagent l'origine chrome-extension:// : le même verrou Web Locks les coordonne,
 * ce qui évite qu'une écriture en écrase une autre (ex : "Ignorer" pendant une synchro).
 *
 * Attente > LOCK_WAIT_WARN_MS : un seul avertissement, jamais attendu par la tâche. Il est écrit dans
 * le journal SANS le verrou (`recordUnlocked`) : `log.warn` passerait par une écriture verrouillée,
 * jamais faite si le verrou reste détenu, c'est-à-dire précisément le cas diagnostiqué.
 */
export function withStorageLock<T>(task: () => Promise<T>): Promise<T> {
  const watchdog = setTimeout(() => {
    void describeStorageLock().then((state) => {
      const args = [`Verrou du stockage attendu depuis plus de ${LOCK_WAIT_WARN_MS / 1000} s :`, state];
      console.warn(`[SyncKai:${SCOPE}]`, ...args);
      return recordUnlocked('warn', SCOPE, args);
    });
  }, LOCK_WAIT_WARN_MS);
  return requestStorageLock(() => {
    clearTimeout(watchdog);
    return task();
  }).finally(() => clearTimeout(watchdog));
}
