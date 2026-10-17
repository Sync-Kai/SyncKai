// « Synchro cette semaine » du menu du compte (règles : shared/weekly-syncs.ts) : écrit par le service worker après une
// synchro réussie, lu par les pages à l'ouverture du menu.
import { addWeeklySyncs, weeklySyncCount } from '../../shared/weekly-syncs';
import type { SessionEpochs } from '../../shared/session-epochs';
import type { TrackerId } from '../../shared/tracker.types';
import { STORAGE_KEYS } from '../../protocol/storage-keys';
import { withStorageLock } from './lock';
import { getOpenSessions } from './sessions';

/**
 * Un épisode de plus pour chaque service écrit, sous le verrou de la déconnexion : seulement pour les sessions relevées
 * avant la synchro (`epochs`) et toujours ouvertes (même règle que addRecentSync, audit L3). false : rien d'écrit
 */
export function recordWeeklySyncs(services: readonly TrackerId[], epochs: SessionEpochs, now: number = Date.now()): Promise<boolean> {
  return withStorageLock(async () => {
    const open = await getOpenSessions();
    const live = services.filter((service) => epochs[service] !== undefined && epochs[service] === open[service]);
    if (live.length === 0) return false;
    const raw: unknown = (await chrome.storage.local.get(STORAGE_KEYS.weeklySyncs))[STORAGE_KEYS.weeklySyncs];
    await chrome.storage.local.set({ [STORAGE_KEYS.weeklySyncs]: addWeeklySyncs(raw, live, open, now) });
    return true;
  });
}

/** Épisodes synchronisés cette semaine vers `service` par sa session ouverte (0 sans session) */
export async function getWeeklySyncCount(service: TrackerId, now: number = Date.now()): Promise<number> {
  const [stored, open] = await Promise.all([chrome.storage.local.get(STORAGE_KEYS.weeklySyncs), getOpenSessions()]);
  return weeklySyncCount(stored[STORAGE_KEYS.weeklySyncs], service, open[service], now);
}
