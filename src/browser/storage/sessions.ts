// Sessions ouvertes et générations de session : course requête / déconnexion.
import { isRecord } from '../../shared/guards';
import { sealToken } from '../tokens/crypto';
import type { MalToken } from '../../shared/mal.types';
import type { TrackerId } from '../../shared/tracker.types';
import { STORAGE_KEYS } from '../../protocol/storage-keys';
import { stillOpen, type SessionEpochs } from '../../shared/session-epochs';
import { withStorageLock } from './lock';
import { isStoredToken, readStoredToken, tokenOf } from './tokens';

/**
 * Token renouvelé : enregistré seulement si la session `epoch` (relevée avant le renouvellement) est toujours ouverte
 * et que `previous` est toujours le token enregistré (AUTH-01). Sinon (déconnexion, autre compte), le token est
 * abandonné : retourne false.
 */
export async function saveRefreshedMalToken(previous: string, token: MalToken, epoch: number): Promise<boolean> {
  // Chiffré avant le verrou ; comparaison sur le token déchiffré
  const sealed = await sealToken('mal', token);
  return withStorageLock(async () => {
    if (!(await sessionsStillOpen({ mal: epoch })) || tokenOf(await readStoredToken('mal'))?.accessToken !== previous) return false;
    await chrome.storage.local.set({ [STORAGE_KEYS.malToken]: sealed });
    return true;
  });
}

// ─── Génération de session (course requête / déconnexion) ──────────────────
// La déconnexion se fait depuis le popup ou le panneau, pas dans le service worker : un compteur en
// mémoire du worker ne la verrait pas. Compteur dans storage.local, jamais effacé (clearUserSyncData
// ne le retire pas) : une remise à 0 ferait de nouveau correspondre une génération capturée avant.

/** Génération de session du service (0 tant qu'aucune déconnexion n'a eu lieu). */
export async function getSessionEpoch(service: TrackerId): Promise<number> {
  const stored = await chrome.storage.local.get(STORAGE_KEYS.sessionEpoch);
  const epochs: unknown = stored[STORAGE_KEYS.sessionEpoch];
  const epoch: unknown = isRecord(epochs) ? epochs[service] : undefined;
  return typeof epoch === 'number' && Number.isFinite(epoch) ? epoch : 0;
}

/**
 * Sessions ouvertes : génération de chaque service qui a un token enregistré (AniList même expiré). Une donnée liée
 * au compte (file, note, synchro récente, correction) les mémorise à sa création, voir session-epochs.ts.
 */
export async function getOpenSessions(): Promise<SessionEpochs> {
  const stored = await chrome.storage.local.get([STORAGE_KEYS.anilistToken, STORAGE_KEYS.malToken, STORAGE_KEYS.sessionEpoch]);
  const epochs: unknown = stored[STORAGE_KEYS.sessionEpoch];
  const epochOf = (service: TrackerId): number => {
    const epoch: unknown = isRecord(epochs) ? epochs[service] : undefined;
    return typeof epoch === 'number' && Number.isFinite(epoch) ? epoch : 0;
  };
  return {
    // Présence seule (chiffré ou ancien format) : aucun déchiffrement
    ...(isStoredToken('anilist', stored[STORAGE_KEYS.anilistToken]) ? { anilist: epochOf('anilist') } : {}),
    ...(isStoredToken('mal', stored[STORAGE_KEYS.malToken]) ? { mal: epochOf('mal') } : {}),
  };
}

/** La session `epoch` du service est toujours ouverte : aucune déconnexion depuis, token toujours enregistré. */
export async function isSessionOpen(service: TrackerId, epoch: number | undefined): Promise<boolean> {
  return epoch !== undefined && (await getOpenSessions())[service] === epoch;
}

/**
 * Les sessions relevées dans `epochs` sont toujours ouvertes (même génération, token enregistré). Sans verrou :
 * à appeler sous withStorageLock, juste avant l'écriture qu'elle autorise.
 */
export async function sessionsStillOpen(epochs: SessionEpochs): Promise<boolean> {
  return stillOpen(epochs, await getOpenSessions());
}

/**
 * Écriture d'une donnée liée au compte après une requête réseau (profil, comparaison, semaine d'agenda) : vérification
 * des sessions relevées AVANT la requête et écriture sous le même verrou que la déconnexion. Une donnée d'un compte
 * déconnecté entre-temps n'est jamais recréée. Retourne false si rien n'a été écrit.
 */
export function writeIfSessions(epochs: SessionEpochs, entries: Record<string, unknown>): Promise<boolean> {
  return withStorageLock(async () => {
    if (!(await sessionsStillOpen(epochs))) return false;
    await chrome.storage.local.set(entries);
    return true;
  });
}

/** writeIfSessions pour un seul service */
export function writeIfSession(service: TrackerId, epoch: number, entries: Record<string, unknown>): Promise<boolean> {
  return writeIfSessions({ [service]: epoch }, entries);
}

/** Incrémente la génération, sans verrou (appelée sous celui de clear*Session). */
export async function bumpSessionEpoch(service: TrackerId): Promise<void> {
  const stored = await chrome.storage.local.get(STORAGE_KEYS.sessionEpoch);
  const epochs: unknown = stored[STORAGE_KEYS.sessionEpoch];
  const current: unknown = isRecord(epochs) ? epochs[service] : undefined;
  const next = (typeof current === 'number' && Number.isFinite(current) ? current : 0) + 1;
  await chrome.storage.local.set({ [STORAGE_KEYS.sessionEpoch]: { ...(isRecord(epochs) ? epochs : {}), [service]: next } });
}
