import { isRecord } from './guards';
import { createLogger } from './logger';
import { mergePlatformLinks, parsePlatformLinkStore, PLATFORM_LINKS_KEY, rememberPlatformLink, type PlatformLinkStore } from './platform-links';
import { STORAGE_KEYS } from './storage';
import { withStorageLock } from './storage-lock';
import { isWatchingList, type PlatformLink, type WatchingList } from './watching.types';

// Accès chrome.storage des liens de séries appris (service worker uniquement).

const log = createLogger('platform-links');

export async function getPlatformLinks(): Promise<PlatformLinkStore> {
  try {
    const stored = await chrome.storage.local.get(PLATFORM_LINKS_KEY);
    return parsePlatformLinkStore(stored[PLATFORM_LINKS_KEY]);
  } catch (error: unknown) {
    log.debug('Liens appris illisibles :', error);
    return {};
  }
}

/** Ajoute le lien aux séries de la liste en cache qui n'ont encore aucun lien pour cette plateforme */
function patchWatchingCache(cache: unknown, mediaId: number, link: PlatformLink): Record<string, unknown> | null {
  if (!isRecord(cache)) return null;
  let changed = false;
  const next: Record<string, unknown> = { ...cache };
  for (const [service, list] of Object.entries(cache)) {
    if (!isWatchingList(list)) continue;
    const entries = list.entries.map((entry) => {
      if (entry.mediaId !== mediaId || entry.platforms.some((l) => l.platform === link.platform)) return entry;
      changed = true;
      return { ...entry, platforms: mergePlatformLinks(entry.platforms, [link]) };
    });
    next[service] = { ...list, entries } satisfies WatchingList;
  }
  return changed ? next : null;
}

/**
 * Mémorise le lien de série d'une fiche AniList. Une seule écriture (liens + liste « En cours » en cache) :
 * le popup, l'agenda et les alertes voient le nouveau lien sans nouvelle requête réseau.
 * Retourne true si quelque chose a changé. Ne lève jamais (simple amélioration de « Ouvrir »).
 */
export async function learnPlatformLink(mediaId: number, link: PlatformLink, now: number = Date.now()): Promise<boolean> {
  try {
    return await withStorageLock(async () => {
      const stored = await chrome.storage.local.get([PLATFORM_LINKS_KEY, STORAGE_KEYS.watchingCache]);
      const next = rememberPlatformLink(parsePlatformLinkStore(stored[PLATFORM_LINKS_KEY]), mediaId, link, now);
      if (!next) return false;
      const cache = patchWatchingCache(stored[STORAGE_KEYS.watchingCache], mediaId, link);
      await chrome.storage.local.set({ [PLATFORM_LINKS_KEY]: next, ...(cache ? { [STORAGE_KEYS.watchingCache]: cache } : {}) });
      log.info(`Lien ${link.platform} appris pour #${mediaId}`);
      return true;
    });
  } catch (error: unknown) {
    log.warn('Lien de série non mémorisé :', error);
    return false;
  }
}
