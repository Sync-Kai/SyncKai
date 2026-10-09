import { createLogger } from './logger';
import { requestStorageLock, STORAGE_LOCK } from './storage-lock-core';

const log = createLogger('lock');

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
 * Attente > LOCK_WAIT_WARN_MS : un seul avertissement, jamais attendu par la tâche. Sans risque de
 * boucle ni d'interblocage : `log.warn` ne fait que mettre l'entrée en file, et le journal l'écrit
 * plus tard via `requestStorageLock` (verrou brut, sans diagnostic), quitte à attendre lui aussi.
 */
export function withStorageLock<T>(task: () => Promise<T>): Promise<T> {
  const watchdog = setTimeout(() => {
    void describeStorageLock().then((state) => log.warn(`Verrou du stockage attendu depuis plus de ${LOCK_WAIT_WARN_MS / 1000} s :`, state));
  }, LOCK_WAIT_WARN_MS);
  return requestStorageLock(() => {
    clearTimeout(watchdog);
    return task();
  }).finally(() => clearTimeout(watchdog));
}
