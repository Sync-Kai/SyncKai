// Jeu d'annulation des séries en sommeil (POP-05, décision 6 b du 2026-11-13) : écritures que « Annuler » rétablit,
// gardées brièvement dans chrome.storage.session. « Tout mettre en pause » tourne dans le popup : le fermer pendant le
// lot l'arrête, et la réouverture propose encore « Annuler » pour les séries déjà écrites. Lié aux sessions ouvertes à
// l'écriture (générations) : jamais proposé après une déconnexion ou une connexion. Jamais dans local, rien après la
// fermeture du navigateur ; retiré à la déconnexion (session-cache.ts › clearSessionCaches).
import { DORMANT_UNDO_KEY } from '../../protocol/storage-keys';
import { isRecord } from '../../shared/guards';
import { isSessionEpochs, sameSessions, stillOpen } from '../../shared/session-epochs';
import { TRACKER_IDS, type TrackerId } from '../../shared/tracker.types';
import { isWatchingList, type WatchingEntry } from '../../shared/watching.types';
import { getOpenSessions } from './sessions';

/** Au-delà, rien n'est proposé : le temps de rouvrir le popup, pas d'annuler une pause ancienne */
export const DORMANT_UNDO_TTL_MS = 2 * 60_000;

/** Services réellement écrits pour une série, et le statut écrit */
export interface SavedDormantWrite {
  entry: WatchingEntry;
  status: 'PAUSED' | 'DROPPED';
  services: TrackerId[];
}

/** Écritures faites depuis la liste du service `service` */
export interface SavedDormantUndo {
  service: TrackerId;
  writes: SavedDormantWrite[];
}

const isService = (value: unknown): value is TrackerId => (TRACKER_IDS as readonly unknown[]).includes(value);

/** Remplace le jeu gardé, avec les sessions ouvertes maintenant (juste après les écritures) */
export async function saveDormantUndo(undo: SavedDormantUndo, now: number): Promise<void> {
  await chrome.storage.session.set({ [DORMANT_UNDO_KEY]: { ...undo, at: now, epochs: await getOpenSessions() } });
}

export async function clearDormantUndo(): Promise<void> {
  await chrome.storage.session.remove(DORMANT_UNDO_KEY);
}

/** Jeu gardé il y a moins de DORMANT_UNDO_TTL_MS, sous les mêmes sessions ; null sinon (absent, ancien, illisible, autre compte) */
export async function readDormantUndo(now: number): Promise<SavedDormantUndo | null> {
  const raw: unknown = (await chrome.storage.session.get(DORMANT_UNDO_KEY))[DORMANT_UNDO_KEY];
  if (!isRecord(raw) || typeof raw.at !== 'number' || now - raw.at > DORMANT_UNDO_TTL_MS || raw.at > now || !isService(raw.service) || !isSessionEpochs(raw.epochs)) return null;
  const { service, writes } = raw;
  const valid =
    Array.isArray(writes) &&
    writes.every((w: unknown) => isRecord(w) && (w.status === 'PAUSED' || w.status === 'DROPPED') && Array.isArray(w.services) && w.services.length > 0 && w.services.every(isService)) &&
    // Entrées relues comme la liste en cache (liens revalidés, SEC-04)
    isWatchingList({ service, fetchedAt: raw.at, entries: (writes as { entry: unknown }[]).map((w) => w.entry) });
  if (!valid || writes.length === 0) return null;
  const open = await getOpenSessions();
  return stillOpen(raw.epochs, open) && sameSessions(raw.epochs, open) ? { service, writes: writes as SavedDormantWrite[] } : null;
}
