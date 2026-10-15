// Fin de session (déconnexion, token refusé) et données liées au compte (file, notes, synchros récentes, corrections).
import { isSealedToken, type SealedToken } from '../tokens/crypto';
import { isPendingReview, isRecentSync } from '../../shared/review.types';
import type { TrackerId } from '../../shared/tracker.types';
import { isPendingRating } from './engagement-store';
import { PENDING_RATINGS_KEY, STORAGE_KEYS, SYNC_QUEUE_KEY } from '../../protocol/storage-keys';
import { isSyncQueueItem, restrictToSession } from '../../shared/queue.types';
import { liveServices, type SessionEpochs } from '../../shared/session-epochs';
import { keysClearedOnLastSession, keysClearedOnSessionEnd, prefixesClearedOnLastSession } from './account-keys';
import { withStorageLock } from './lock';
import { clearSessionCaches } from './session-cache';
import { createLogger } from '../logger';
import { getOpenSessions, bumpSessionEpoch } from './sessions';
import { setSessionExpired, readRawToken, readStoredToken, tokenOf } from './tokens';
import { removeCachedWatching } from './watching-cache';

const log = createLogger('storage');

/**
 * Token indéchiffrable (clé perdue : IndexedDB vidée) : ferme la session avec l'indicateur « Session expirée », comme
 * un token refusé, seulement si `sealed` est toujours le token enregistré (une reconnexion entre-temps est conservée).
 * Retourne true si la session a été fermée.
 */
export function clearUnreadableSession(service: TrackerId, sealed: SealedToken): Promise<boolean> {
  return withStorageLock(async () => {
    const raw = await readRawToken(service);
    if (!isSealedToken(raw) || raw.iv !== sealed.iv || raw.data !== sealed.data) return false;
    await (service === 'anilist' ? removeAniListSession(true) : removeMalSession(true));
    return true;
  });
}

/**
 * Supprime la session AniList : token, profil et liste « En cours » en cache (un autre compte ne doit
 * pas la voir), puis la part AniList de la file, des notes, des synchros récentes et des corrections.
 * Appelée à la déconnexion comme à l'invalidation du token.
 */
export function clearAniListSession(): Promise<void> {
  return withStorageLock(() => removeAniListSession(false));
}

/** Corps de clearAniListSession, sans verrou. `expired` : session invalidée par AniList (et non déconnexion volontaire) */
async function removeAniListSession(expired: boolean): Promise<void> {
  // Indicateur écrit avant la suppression du token : l'interface qui réagit à cette suppression le lit déjà (AUTH-03)
  await setSessionExpired('anilist', expired);
  await chrome.storage.local.remove(keysClearedOnSessionEnd('anilist'));
  await removeCachedWatching('anilist');
  await bumpSessionEpoch('anilist');
  await purgeClosedSessions();
  await removeSessionCaches();
}

/**
 * Token refusé par AniList : ferme la session seulement si `accessToken` est toujours le token enregistré (AUTH-02).
 * Une reconnexion pendant la requête refusée n'est pas effacée. Retourne true si la session a été fermée.
 */
export function clearAniListSessionIfToken(accessToken: string): Promise<boolean> {
  return withStorageLock(async () => {
    // Comparaison sur le token déchiffré (chaque écriture change l'IV, donc le chiffré)
    if (tokenOf(await readStoredToken('anilist'))?.accessToken !== accessToken) return false;
    await removeAniListSession(true);
    return true;
  });
}

/** Clés propres à l'utilisateur, sans verrou (voir clearUserSyncData) */
async function removeUserSyncData(): Promise<void> {
  // Semaines de l'agenda en cache (`airingWeek:<date>`, voir agenda.ts) : elles reflètent la liste de l'utilisateur
  const prefixes = prefixesClearedOnLastSession();
  const weeks = Object.keys(await chrome.storage.local.get(null)).filter((key) => prefixes.some((prefix) => key.startsWith(prefix)));
  await chrome.storage.local.remove([...keysClearedOnLastSession(), ...weeks]);
  await removeSessionCaches();
}

/**
 * Fiches en cache de session (état des listes du compte dans la fiche de la page) effacées à toute déconnexion
 * (SEC-03). Un échec (zone de session indisponible) ne bloque jamais la déconnexion : la TTL et la fermeture du
 * navigateur restent.
 */
async function removeSessionCaches(): Promise<void> {
  try {
    await clearSessionCaches();
  } catch (error: unknown) {
    log.warn('Caches de session non effacés à la déconnexion :', error);
  }
}

/**
 * Vérifications, dernières synchros, liens de séries appris (pages visitées) et file de relance : propres à l'utilisateur, effacées quand plus aucun
 * service de suivi n'est connecté (déconnexion du dernier compte).
 */
export function clearUserSyncData(): Promise<void> {
  return withStorageLock(removeUserSyncData);
}

/**
 * Après une déconnexion ou un token refusé : efface les données de l'utilisateur si plus aucune session n'est
 * ouverte. Un token AniList seulement expiré garde sa session (« Reconnecter ») : rien n'est effacé. Retourne true
 * si les données ont été effacées.
 */
export function clearUserSyncDataIfNoSession(): Promise<boolean> {
  return withStorageLock(async () => {
    if (Object.keys(await getOpenSessions()).length > 0) return false;
    await removeUserSyncData();
    return true;
  });
}

/** Comme clearAniListSession : token, profil et liste « En cours » MAL en cache, puis la part MAL des données du compte. */
export function clearMalSession(): Promise<void> {
  return withStorageLock(() => removeMalSession(false));
}

/** Corps de clearMalSession, sans verrou. `expired` : session invalidée par MyAnimeList (et non déconnexion volontaire) */
async function removeMalSession(expired: boolean): Promise<void> {
  // Indicateur écrit avant la suppression du token, comme pour AniList (AUTH-03)
  await setSessionExpired('mal', expired);
  await chrome.storage.local.remove(keysClearedOnSessionEnd('mal'));
  await removeCachedWatching('mal');
  await bumpSessionEpoch('mal');
  await purgeClosedSessions();
  await removeSessionCaches();
}

/** Comme clearAniListSessionIfToken : la session MAL n'est fermée que si `accessToken` est toujours le token enregistré. */
export function clearMalSessionIfToken(accessToken: string): Promise<boolean> {
  return withStorageLock(async () => {
    if (tokenOf(await readStoredToken('mal'))?.accessToken !== accessToken) return false;
    await removeMalSession(true);
    return true;
  });
}

// ─── Données liées au compte (file, notes, synchros récentes, corrections) ──

/** Tableau d'une clé, sans les éléments illisibles */
async function readList<T>(key: string, guard: (value: unknown) => value is T): Promise<T[]> {
  const raw: unknown = (await chrome.storage.local.get(key))[key];
  return Array.isArray(raw) ? raw.filter(guard) : [];
}

/** Réécrit la liste si elle a changé (vide : clé retirée) ; retourne le nombre d'éléments retirés ou modifiés */
async function writeListIfChanged<T>(key: string, before: readonly T[], after: readonly T[]): Promise<number> {
  const changed = before.length - after.length + after.filter((item) => !before.includes(item)).length;
  if (changed === 0) return 0;
  if (after.length === 0) await chrome.storage.local.remove(key);
  else await chrome.storage.local.set({ [key]: after });
  return changed;
}

/**
 * Après une déconnexion (sous le verrou du stockage, génération déjà incrémentée) : retire de la file les services
 * dont la session est fermée, et supprime les notes, synchros récentes et corrections qui ne valent plus pour aucune
 * session ouverte. Les données sans session (antérieures à la 2.2.0, non migrées) sont supprimées.
 */
async function purgeClosedSessions(): Promise<void> {
  const current = await getOpenSessions();
  const live = (epochs: SessionEpochs | undefined): boolean => epochs !== undefined && liveServices(epochs, current).length > 0;

  const queue = await readList(SYNC_QUEUE_KEY, isSyncQueueItem);
  await writeListIfChanged(SYNC_QUEUE_KEY, queue, queue.flatMap((item) => restrictToSession(item, current) ?? []));
  const ratings = await readList(PENDING_RATINGS_KEY, isPendingRating);
  await writeListIfChanged(PENDING_RATINGS_KEY, ratings, ratings.filter((rating) => live(rating.epochs)));
  const syncs = await readList(STORAGE_KEYS.recentSyncs, isRecentSync);
  await writeListIfChanged(STORAGE_KEYS.recentSyncs, syncs, syncs.filter((sync) => live(sync.epochs)));
  // Vérification simple : non liée au compte (elle n'applique que les règles normales, sans recul)
  const reviews = await readList(STORAGE_KEYS.pendingReviews, isPendingReview);
  await writeListIfChanged(STORAGE_KEYS.pendingReviews, reviews, reviews.filter((review) => review.previous === null || live(review.epochs)));
}

/**
 * Migration (mise à jour vers la 2.2.0) : la file, les notes en attente, les synchros récentes et les corrections
 * créées sans session reçoivent les sessions ouvertes, celles du compte connecté au moment de la mise à jour.
 * Retourne le nombre d'éléments rattachés.
 */
export function bindLegacyDataToSession(): Promise<number> {
  return withStorageLock(async () => {
    const epochs = await getOpenSessions();
    const bind = <T extends { epochs?: SessionEpochs }>(item: T, eligible = true): T => (item.epochs === undefined && eligible ? { ...item, epochs } : item);
    const queue = await readList(SYNC_QUEUE_KEY, isSyncQueueItem);
    const ratings = await readList(PENDING_RATINGS_KEY, isPendingRating);
    const syncs = await readList(STORAGE_KEYS.recentSyncs, isRecentSync);
    const reviews = await readList(STORAGE_KEYS.pendingReviews, isPendingReview);
    return (
      (await writeListIfChanged(SYNC_QUEUE_KEY, queue, queue.map((item) => bind(item)))) +
      (await writeListIfChanged(PENDING_RATINGS_KEY, ratings, ratings.map((rating) => bind(rating)))) +
      (await writeListIfChanged(STORAGE_KEYS.recentSyncs, syncs, syncs.map((sync) => bind(sync)))) +
      (await writeListIfChanged(STORAGE_KEYS.pendingReviews, reviews, reviews.map((review) => bind(review, review.previous !== null))))
    );
  });
}
