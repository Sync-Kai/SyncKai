// Profils AniList et MyAnimeList en cache.
import { isAniListViewer, type AniListViewer } from '../../shared/anilist.types';
import { isMalViewer, type MalViewer } from '../../shared/mal.types';
import type { TrackerId } from '../../shared/tracker.types';
import { STORAGE_KEYS } from '../../protocol/storage-keys';
import { writeIfSession } from './sessions';

export async function getCachedViewer(): Promise<AniListViewer | null> {
  const stored = await chrome.storage.local.get(STORAGE_KEYS.anilistViewer);
  const viewer: unknown = stored[STORAGE_KEYS.anilistViewer];
  return isAniListViewer(viewer) ? viewer : null;
}

/** Profil AniList, enregistré seulement si la session `epoch` (relevée avant la requête) est toujours ouverte (AUTH-04). */
export function saveCachedViewer(viewer: AniListViewer, epoch: number): Promise<boolean> {
  return writeIfSession('anilist', epoch, { [STORAGE_KEYS.anilistViewer]: viewer, [STORAGE_KEYS.anilistViewerAt]: Date.now() });
}

// Les correspondances ne dépendent pas de l'utilisateur (mediaId global) : conservées à la déconnexion.
// Écritures sur l'objet brut (ARCH-15) : une entrée que cette version ne sait pas lire (format d'une autre version,
// garde resserrée) n'est jamais effacée par l'écriture d'une autre clé.

export async function getCachedMalViewer(): Promise<MalViewer | null> {
  const stored = await chrome.storage.local.get(STORAGE_KEYS.malViewer);
  const viewer: unknown = stored[STORAGE_KEYS.malViewer];
  return isMalViewer(viewer) ? viewer : null;
}

/** Moment de la lecture du profil en cache (ms), null si inconnu (profil enregistré avant la 2.2.0) */
export async function getViewerFetchedAt(service: TrackerId): Promise<number | null> {
  const key = service === 'anilist' ? STORAGE_KEYS.anilistViewerAt : STORAGE_KEYS.malViewerAt;
  const value: unknown = (await chrome.storage.local.get(key))[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/** Profil MAL, enregistré seulement si la session `epoch` (relevée avant la requête) est toujours ouverte (AUTH-04). */
export function saveCachedMalViewer(viewer: MalViewer, epoch: number): Promise<boolean> {
  return writeIfSession('mal', epoch, { [STORAGE_KEYS.malViewer]: viewer, [STORAGE_KEYS.malViewerAt]: Date.now() });
}
