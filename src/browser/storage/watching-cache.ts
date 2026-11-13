// Cache de la liste « En cours » (affichage instantané du popup).
import { isRecord } from '../../shared/guards';
import type { TrackerId } from '../../shared/tracker.types';
import { STORAGE_KEYS } from '../../protocol/storage-keys';
import { isWatchingList, type WatchingList } from '../../shared/watching.types';
import { withStorageLock } from './lock';
import { getSessionEpoch } from './sessions';

// ─── Cache de la liste « En cours » (affichage instantané du popup) ──────────

/** Dernière liste « en cours » récupérée pour ce service, null si absente ou illisible. */
export async function getCachedWatching(service: TrackerId): Promise<WatchingList | null> {
  const stored = await chrome.storage.local.get(STORAGE_KEYS.watchingCache);
  const cache: unknown = stored[STORAGE_KEYS.watchingCache];
  const list: unknown = isRecord(cache) ? cache[service] : undefined;
  return isWatchingList(list) && list.service === service ? list : null;
}

/** Retire l'entrée d'un service du cache, sans verrou (les verrous Web Locks ne sont pas réentrants). */
export async function removeCachedWatching(service: TrackerId): Promise<void> {
  const stored = await chrome.storage.local.get(STORAGE_KEYS.watchingCache);
  const cache: unknown = stored[STORAGE_KEYS.watchingCache];
  if (!isRecord(cache) || !(service in cache)) return;
  const { [service]: _removed, ...rest } = cache;
  await chrome.storage.local.set({ [STORAGE_KEYS.watchingCache]: rest });
}

/**
 * Met la liste en cache si la session n'a pas changé depuis `epoch` (capturée avant la requête).
 * Vérification et écriture sous le même verrou que la déconnexion : la liste d'un compte déconnecté
 * n'est jamais remise en cache. Retourne false si la liste est obsolète (rien n'est écrit).
 */
export function saveCachedWatching(list: WatchingList, epoch: number): Promise<boolean> {
  return withStorageLock(async () => {
    if ((await getSessionEpoch(list.service)) !== epoch) return false;
    const stored = await chrome.storage.local.get(STORAGE_KEYS.watchingCache);
    const cache: unknown = stored[STORAGE_KEYS.watchingCache];
    await chrome.storage.local.set({ [STORAGE_KEYS.watchingCache]: { ...(isRecord(cache) ? cache : {}), [list.service]: list } });
    return true;
  });
}

/**
 * Retire une série de la liste « en cours » en cache (retrait de la liste du service), si la session n'a pas changé
 * depuis `epoch` (relevée avant la requête). Sous le verrou de la déconnexion, comme saveCachedWatching. Retourne
 * true si une entrée a été retirée.
 */
export function dropCachedWatchingEntry(service: TrackerId, epoch: number, match: (entry: WatchingList['entries'][number]) => boolean): Promise<boolean> {
  return withStorageLock(async () => {
    if ((await getSessionEpoch(service)) !== epoch) return false;
    const list = await getCachedWatching(service);
    if (!list) return false;
    const entries = list.entries.filter((entry) => !match(entry));
    if (entries.length === list.entries.length) return false;
    const stored = await chrome.storage.local.get(STORAGE_KEYS.watchingCache);
    const cache: unknown = stored[STORAGE_KEYS.watchingCache];
    await chrome.storage.local.set({ [STORAGE_KEYS.watchingCache]: { ...(isRecord(cache) ? cache : {}), [service]: { ...list, entries } } });
    return true;
  });
}

/**
 * Liste « en cours » en cache rendue périmée (`fetchedAt` à 0, gardée pour l'affichage immédiat), si la session n'a pas
 * changé depuis `epoch` : une série remise en cours n'y est pas, la prochaine lecture la relit sur le service (POP-06).
 */
export function expireCachedWatching(service: TrackerId, epoch: number): Promise<void> {
  return withStorageLock(async () => {
    if ((await getSessionEpoch(service)) !== epoch) return;
    const list = await getCachedWatching(service);
    if (!list) return;
    const stored = await chrome.storage.local.get(STORAGE_KEYS.watchingCache);
    const cache: unknown = stored[STORAGE_KEYS.watchingCache];
    await chrome.storage.local.set({ [STORAGE_KEYS.watchingCache]: { ...(isRecord(cache) ? cache : {}), [service]: { ...list, fetchedAt: 0 } } });
  });
}
