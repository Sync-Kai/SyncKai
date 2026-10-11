import { isSyncQueueItem, restrictToSession, type SyncQueueItem } from './queue.types';
import { getOpenSessions } from './storage';
import { SYNC_QUEUE_KEY } from './storage-keys';
import { withStorageLock } from './storage-lock';

// Accès au stockage de la file de synchro (popup + service worker).
// Écritures sous `withStorageLock` (src/shared/storage-lock.ts), clé `SYNC_QUEUE_KEY` (storage-keys.ts).

/** Lecture brute, entrées invalides ignorées */
async function readQueue(): Promise<SyncQueueItem[]> {
  const stored = await chrome.storage.local.get(SYNC_QUEUE_KEY);
  const value: unknown = stored[SYNC_QUEUE_KEY];
  return Array.isArray(value) ? value.filter(isSyncQueueItem) : [];
}

/** Pending par prochaine tentative, puis failed du plus récent au plus ancien */
function compareQueueItems(a: SyncQueueItem, b: SyncQueueItem): number {
  if (a.status !== b.status) return a.status === 'pending' ? -1 : 1;
  return a.status === 'pending' ? a.nextAttemptAt - b.nextAttemptAt : b.firstFailedAt - a.firstFailedAt;
}

/** File complète, triée par prochaine tentative (pending d'abord, puis failed). */
export async function getSyncQueue(): Promise<SyncQueueItem[]> {
  return (await readQueue()).sort(compareQueueItems);
}

/**
 * Ajoute ou remplace l'entrée de même `id`, réduite aux services dont la session est toujours ouverte. Vérifié sous
 * le même verrou que la déconnexion : un échec de l'ancien compte n'est jamais remis en file après celle-ci. Plus
 * aucun service valable : l'entrée est retirée. Retourne false dans ce cas.
 */
export function saveQueueItem(item: SyncQueueItem): Promise<boolean> {
  return withStorageLock(async () => {
    // Élément antérieur à la 2.2.0 encore présent : aucune déconnexion depuis (elle l'aurait purgé), session courante
    const live = restrictToSession(item, await getOpenSessions(), 'current');
    const queue = await readQueue();
    const others = queue.filter((i) => i.id !== item.id);
    if (live !== null) await chrome.storage.local.set({ [SYNC_QUEUE_KEY]: [...others, live] });
    else if (others.length < queue.length) {
      if (others.length === 0) await chrome.storage.local.remove(SYNC_QUEUE_KEY);
      else await chrome.storage.local.set({ [SYNC_QUEUE_KEY]: others });
    }
    return live !== null;
  });
}

export function removeQueueItem(id: string): Promise<void> {
  return withStorageLock(async () => {
    const queue = await readQueue();
    const remaining = queue.filter((i) => i.id !== id);
    if (remaining.length === queue.length) return;
    if (remaining.length === 0) await chrome.storage.local.remove(SYNC_QUEUE_KEY);
    else await chrome.storage.local.set({ [SYNC_QUEUE_KEY]: remaining });
  });
}
