// Historique d'activité de l'écran Stats (règles : shared/activity-history.ts) : écrit par le service worker après une
// synchro réussie (là où l'est « Synchro cette semaine »), lu par le popup.
import { addActivity, readActivityHistory, withoutOtherAccount, type ActivityHistory } from '../../shared/activity-history';
import type { SessionEpochs } from '../../shared/session-epochs';
import type { TrackerId } from '../../shared/tracker.types';
import { STORAGE_KEYS } from '../../protocol/storage-keys';
import { withStorageLock } from './lock';
import { getOpenSessions } from './sessions';
import { getCachedMalViewer, getCachedViewer } from './viewer-cache';

/**
 * Sous le verrou : services aux sessions relevées et toujours ouvertes, identifiant du compte lu dans le profil en
 * cache (absent : service ignoré). false : rien d'écrit
 */
export function recordActivity(services: readonly TrackerId[], epochs: SessionEpochs, minutes: number, now: number = Date.now()): Promise<boolean> {
  return withStorageLock(async () => {
    const open = await getOpenSessions();
    const writes: { service: TrackerId; accountId: number }[] = [];
    for (const service of services) {
      if (epochs[service] === undefined || epochs[service] !== open[service]) continue;
      // Profil effacé à la fin de chaque session : celui en cache est celui du compte de la session ouverte
      const viewer = service === 'anilist' ? await getCachedViewer() : await getCachedMalViewer();
      if (viewer !== null) writes.push({ service, accountId: viewer.id });
    }
    if (writes.length === 0) return false;
    const raw: unknown = (await chrome.storage.local.get(STORAGE_KEYS.activityHistory))[STORAGE_KEYS.activityHistory];
    await chrome.storage.local.set({ [STORAGE_KEYS.activityHistory]: addActivity(raw, writes, minutes, now) });
    return true;
  });
}

export async function getActivityHistory(): Promise<ActivityHistory> {
  return readActivityHistory((await chrome.storage.local.get(STORAGE_KEYS.activityHistory))[STORAGE_KEYS.activityHistory]);
}

/** Profil de `accountId` enregistré sur `service` : la part d'un autre compte est retirée (clé retirée sans part restante) */
export function dropOtherAccountActivity(service: TrackerId, accountId: number): Promise<void> {
  return withStorageLock(async () => {
    const raw: unknown = (await chrome.storage.local.get(STORAGE_KEYS.activityHistory))[STORAGE_KEYS.activityHistory];
    const next = withoutOtherAccount(raw, service, accountId);
    if (next === null) return;
    if (Object.keys(next).length === 0) await chrome.storage.local.remove(STORAGE_KEYS.activityHistory);
    else await chrome.storage.local.set({ [STORAGE_KEYS.activityHistory]: next });
  });
}
