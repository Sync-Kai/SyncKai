import { isAniListViewer, type AniListViewer } from './anilist.types';
import { isAniListToken, type AniListToken } from './auth.types';
import { isRecord } from './guards';
import { isMalToken, isMalViewer, type MalToken, type MalViewer } from './mal.types';
import { isPendingReview, isRecentSync, type PendingReview, type RecentSync } from './review.types';
import { isMediaMapping, type MediaMapping } from './sync.types';
import type { TrackerId } from './tracker.types';
import { isPendingRating } from './engagement-store';
import { PENDING_RATINGS_KEY, REWATCH_DECLINED_KEY, SESSION_EXPIRED_KEYS, STORAGE_KEYS, SYNC_QUEUE_KEY } from './storage-keys';
import { isSyncQueueItem, restrictToSession } from './queue.types';
import { liveServices, stillOpen, type SessionEpochs } from './session-epochs';
import { isWatchingList, type WatchingList } from './watching.types';
import { PLATFORM_LINKS_KEY } from './platform-links';
import { withStorageLock } from './storage-lock';
import { AIRING_USER_KEYS } from './airing-keys';
import { clearSessionCaches } from './session-cache';
import { createLogger } from './logger';

const log = createLogger('storage');

export const MAX_PENDING_REVIEWS = 20;
export const MAX_RECENT_SYNCS = 5;

/** Session du service invalidée en arrière-plan depuis la dernière connexion (voir SESSION_EXPIRED_KEYS) */
export async function isSessionExpired(service: TrackerId): Promise<boolean> {
  const key = SESSION_EXPIRED_KEYS[service];
  return (await chrome.storage.local.get(key))[key] === true;
}

/** Pose (invalidation) ou retire (déconnexion volontaire, connexion) l'indicateur de session expirée */
async function setSessionExpired(service: TrackerId, expired: boolean): Promise<void> {
  const key = SESSION_EXPIRED_KEYS[service];
  if (expired) await chrome.storage.local.set({ [key]: true });
  else await chrome.storage.local.remove(key);
}

/** Import Crunchyroll : propre au compte (aperçu = état des listes), effacé à toute déconnexion */
const CR_IMPORT_STORAGE_KEYS = [STORAGE_KEYS.crImportJob, STORAGE_KEYS.crImportInput, STORAGE_KEYS.crImportResolutions, STORAGE_KEYS.crImportPlan];

/** Retourne le token AniList s'il existe et n'a pas expiré. */
export async function getValidToken(): Promise<AniListToken | null> {
  const stored = await chrome.storage.local.get(STORAGE_KEYS.anilistToken);
  const token: unknown = stored[STORAGE_KEYS.anilistToken];
  return isAniListToken(token) && token.expiresAt > Date.now() ? token : null;
}

/** Token AniList enregistré, même expiré (« Reconnecter ») : la session reste ouverte jusqu'à la déconnexion. */
export async function hasAniListToken(): Promise<boolean> {
  const stored = await chrome.storage.local.get(STORAGE_KEYS.anilistToken);
  return isAniListToken(stored[STORAGE_KEYS.anilistToken]);
}

/** Connexion AniList réussie : nouveau token, indicateur « Session expirée » retiré */
export async function saveToken(token: AniListToken): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEYS.anilistToken]: token });
  await setSessionExpired('anilist', false);
}

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

/** Copie de l'objet brut du stockage, entrées illisibles comprises */
async function readRawMappings(): Promise<Record<string, unknown>> {
  const raw: unknown = (await chrome.storage.local.get(STORAGE_KEYS.mediaMappings))[STORAGE_KEYS.mediaMappings];
  return isRecord(raw) && !Array.isArray(raw) ? { ...raw } : {};
}

function readableMappings(raw: Record<string, unknown>): Record<string, MediaMapping> {
  return Object.fromEntries(Object.entries(raw).filter((entry): entry is [string, MediaMapping] => isMediaMapping(entry[1])));
}

export async function getMediaMappings(): Promise<Record<string, MediaMapping>> {
  return readableMappings(await readRawMappings());
}

export async function getMediaMapping(key: string): Promise<MediaMapping | null> {
  return (await getMediaMappings())[key] ?? null;
}

/** Ajoute ou remplace la correspondance de la clé (les autres entrées, même illisibles, restent intactes). */
export function saveMediaMapping(key: string, mapping: MediaMapping): Promise<void> {
  return withStorageLock(async () => {
    const raw = await readRawMappings();
    await chrome.storage.local.set({ [STORAGE_KEYS.mediaMappings]: { ...raw, [key]: mapping } });
  });
}

/**
 * Enregistre en une seule écriture les correspondances dont la clé n'en a pas encore de lisible (import : jamais
 * d'écrasement d'une correspondance existante, apprise ou corrigée par l'utilisateur). Retourne le nombre ajouté.
 */
export function saveMediaMappingsIfAbsent(entries: readonly { key: string; mapping: MediaMapping }[]): Promise<number> {
  if (entries.length === 0) return Promise.resolve(0);
  return withStorageLock(async () => {
    const raw = await readRawMappings();
    const known = readableMappings(raw);
    const added = entries.filter(({ key }, i) => !Object.hasOwn(known, key) && entries.findIndex((e) => e.key === key) === i);
    if (added.length > 0) await chrome.storage.local.set({ [STORAGE_KEYS.mediaMappings]: { ...raw, ...Object.fromEntries(added.map(({ key, mapping }) => [key, mapping])) } });
    return added.length;
  });
}

export function deleteMediaMapping(key: string): Promise<void> {
  return withStorageLock(async () => {
    const raw = await readRawMappings();
    if (!Object.hasOwn(raw, key)) return;
    const { [key]: _removed, ...rest } = raw;
    await chrome.storage.local.set({ [STORAGE_KEYS.mediaMappings]: rest });
  });
}

/** Supprime les correspondances dont la clé commence par `prefix` (ex : `netflix:`), même illisibles ; retourne leur nombre. */
export function deleteMediaMappingsByPrefix(prefix: string): Promise<number> {
  return withStorageLock(async () => {
    const raw = await readRawMappings();
    const kept = Object.fromEntries(Object.entries(raw).filter(([key]) => !key.startsWith(prefix)));
    const removed = Object.keys(raw).length - Object.keys(kept).length;
    if (removed > 0) await chrome.storage.local.set({ [STORAGE_KEYS.mediaMappings]: kept });
    return removed;
  });
}

export function clearMediaMappings(): Promise<void> {
  return withStorageLock(() => chrome.storage.local.remove(STORAGE_KEYS.mediaMappings));
}

// ─── Vérifications manuelles & dernières synchros (propres à l'utilisateur) ───

/** Cartes en attente, la plus récente en premier */
export async function getPendingReviews(): Promise<PendingReview[]> {
  const stored = await chrome.storage.local.get(STORAGE_KEYS.pendingReviews);
  const raw: unknown = stored[STORAGE_KEYS.pendingReviews];
  return (Array.isArray(raw) ? raw.filter(isPendingReview) : []).sort((a, b) => b.createdAt - a.createdAt);
}

/** Ajoute ou remplace la carte d'une saison (une seule par clé : le dernier épisode l'emporte). */
export function savePendingReview(review: PendingReview): Promise<void> {
  return withStorageLock(async () => {
    const others = (await getPendingReviews()).filter((r) => r.key !== review.key);
    await chrome.storage.local.set({ [STORAGE_KEYS.pendingReviews]: [review, ...others].slice(0, MAX_PENDING_REVIEWS) });
  });
}

export function deletePendingReview(key: string): Promise<void> {
  return withStorageLock(async () => {
    const remaining = (await getPendingReviews()).filter((r) => r.key !== key);
    await chrome.storage.local.set({ [STORAGE_KEYS.pendingReviews]: remaining });
  });
}

/** Dernières synchros, la plus récente en premier */
export async function getRecentSyncs(): Promise<RecentSync[]> {
  const stored = await chrome.storage.local.get(STORAGE_KEYS.recentSyncs);
  const raw: unknown = stored[STORAGE_KEYS.recentSyncs];
  return (Array.isArray(raw) ? raw.filter(isRecentSync) : []).sort((a, b) => b.syncedAt - a.syncedAt);
}

/** Une entrée par saison : la synchro la plus récente remplace la précédente. */
export function addRecentSync(sync: RecentSync): Promise<void> {
  return withStorageLock(async () => {
    const others = (await getRecentSyncs()).filter((s) => s.key !== sync.key);
    await chrome.storage.local.set({ [STORAGE_KEYS.recentSyncs]: [sync, ...others].slice(0, MAX_RECENT_SYNCS) });
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
  await chrome.storage.local.remove([STORAGE_KEYS.anilistToken, STORAGE_KEYS.anilistViewer, STORAGE_KEYS.anilistViewerAt, STORAGE_KEYS.compareLast, STORAGE_KEYS.compareJob, ...CR_IMPORT_STORAGE_KEYS]);
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
    const stored: unknown = (await chrome.storage.local.get(STORAGE_KEYS.anilistToken))[STORAGE_KEYS.anilistToken];
    if (!isAniListToken(stored) || stored.accessToken !== accessToken) return false;
    await removeAniListSession(true);
    return true;
  });
}

/** Clés propres à l'utilisateur, sans verrou (voir clearUserSyncData) */
async function removeUserSyncData(): Promise<void> {
  // Semaines de l'agenda en cache (`airingWeek:<date>`, voir agenda.ts) : elles reflètent la liste de l'utilisateur
  const weeks = Object.keys(await chrome.storage.local.get(null)).filter((key) => key.startsWith('airingWeek:'));
  await chrome.storage.local.remove([
    STORAGE_KEYS.pendingReviews,
    STORAGE_KEYS.recentSyncs,
    STORAGE_KEYS.watchingCache,
    SYNC_QUEUE_KEY,
    PENDING_RATINGS_KEY,
    REWATCH_DECLINED_KEY,
    STORAGE_KEYS.compareLast,
    STORAGE_KEYS.compareJob,
    ...CR_IMPORT_STORAGE_KEYS,
    PLATFORM_LINKS_KEY,
    // Alertes de sortie : épisodes notifiés, cibles des notifications (séries de l'ancien compte), dernière vérification (ALRT-05)
    ...AIRING_USER_KEYS,
    ...weeks,
  ]);
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

// ─── Session MyAnimeList ──────────────────────────────────────────────────

/** Token MAL stocké, même expiré : le refresh token permet de le renouveler. */
export async function getMalToken(): Promise<MalToken | null> {
  const stored = await chrome.storage.local.get(STORAGE_KEYS.malToken);
  const token: unknown = stored[STORAGE_KEYS.malToken];
  return isMalToken(token) ? token : null;
}

/** Connexion MAL (nouvelle session), indicateur « Session expirée » retiré. Un renouvellement passe par saveRefreshedMalToken. */
export async function saveMalToken(token: MalToken): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEYS.malToken]: token });
  await setSessionExpired('mal', false);
}

/**
 * Token renouvelé : enregistré seulement si la session `epoch` (relevée avant le renouvellement) est toujours ouverte
 * et que `previous` est toujours le token enregistré (AUTH-01). Sinon (déconnexion, autre compte), le token est
 * abandonné : retourne false.
 */
export function saveRefreshedMalToken(previous: string, token: MalToken, epoch: number): Promise<boolean> {
  return withStorageLock(async () => {
    if (!(await sessionsStillOpen({ mal: epoch })) || (await getMalToken())?.accessToken !== previous) return false;
    await chrome.storage.local.set({ [STORAGE_KEYS.malToken]: token });
    return true;
  });
}

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

/** Comme clearAniListSession : token, profil et liste « En cours » MAL en cache, puis la part MAL des données du compte. */
export function clearMalSession(): Promise<void> {
  return withStorageLock(() => removeMalSession(false));
}

/** Corps de clearMalSession, sans verrou. `expired` : session invalidée par MyAnimeList (et non déconnexion volontaire) */
async function removeMalSession(expired: boolean): Promise<void> {
  // Indicateur écrit avant la suppression du token, comme pour AniList (AUTH-03)
  await setSessionExpired('mal', expired);
  await chrome.storage.local.remove([STORAGE_KEYS.malToken, STORAGE_KEYS.malViewer, STORAGE_KEYS.malViewerAt, STORAGE_KEYS.compareLast, STORAGE_KEYS.compareJob, ...CR_IMPORT_STORAGE_KEYS]);
  await removeCachedWatching('mal');
  await bumpSessionEpoch('mal');
  await purgeClosedSessions();
  await removeSessionCaches();
}

/** Comme clearAniListSessionIfToken : la session MAL n'est fermée que si `accessToken` est toujours le token enregistré. */
export function clearMalSessionIfToken(accessToken: string): Promise<boolean> {
  return withStorageLock(async () => {
    if ((await getMalToken())?.accessToken !== accessToken) return false;
    await removeMalSession(true);
    return true;
  });
}

// ─── Cache de la liste « En cours » (affichage instantané du popup) ──────────

/** Dernière liste « en cours » récupérée pour ce service, null si absente ou illisible. */
export async function getCachedWatching(service: TrackerId): Promise<WatchingList | null> {
  const stored = await chrome.storage.local.get(STORAGE_KEYS.watchingCache);
  const cache: unknown = stored[STORAGE_KEYS.watchingCache];
  const list: unknown = isRecord(cache) ? cache[service] : undefined;
  return isWatchingList(list) && list.service === service ? list : null;
}

/** Retire l'entrée d'un service du cache, sans verrou (les verrous Web Locks ne sont pas réentrants). */
async function removeCachedWatching(service: TrackerId): Promise<void> {
  const stored = await chrome.storage.local.get(STORAGE_KEYS.watchingCache);
  const cache: unknown = stored[STORAGE_KEYS.watchingCache];
  if (!isRecord(cache) || !(service in cache)) return;
  const { [service]: _removed, ...rest } = cache;
  await chrome.storage.local.set({ [STORAGE_KEYS.watchingCache]: rest });
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
    ...(isAniListToken(stored[STORAGE_KEYS.anilistToken]) ? { anilist: epochOf('anilist') } : {}),
    ...(isMalToken(stored[STORAGE_KEYS.malToken]) ? { mal: epochOf('mal') } : {}),
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
async function bumpSessionEpoch(service: TrackerId): Promise<void> {
  const stored = await chrome.storage.local.get(STORAGE_KEYS.sessionEpoch);
  const epochs: unknown = stored[STORAGE_KEYS.sessionEpoch];
  const current: unknown = isRecord(epochs) ? epochs[service] : undefined;
  const next = (typeof current === 'number' && Number.isFinite(current) ? current : 0) + 1;
  await chrome.storage.local.set({ [STORAGE_KEYS.sessionEpoch]: { ...(isRecord(epochs) ? epochs : {}), [service]: next } });
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
