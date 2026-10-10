import { isAniListViewer, type AniListViewer } from './anilist.types';
import { isAniListToken, type AniListToken } from './auth.types';
import { isRecord } from './guards';
import { isMalToken, isMalViewer, type MalToken, type MalViewer } from './mal.types';
import { isPendingReview, isRecentSync, type PendingReview, type RecentSync } from './review.types';
import { isMediaMapping, type MediaMapping } from './sync.types';
import type { TrackerId } from './tracker.types';
import { SYNC_QUEUE_KEY } from './sync-queue-store';
import { PENDING_RATINGS_KEY, REWATCH_DECLINED_KEY } from './engagement-store';
import { isWatchingList, type WatchingList } from './watching.types';
import { PLATFORM_LINKS_KEY } from './platform-links';
import { withStorageLock } from './storage-lock';

// Verrou défini dans storage-lock.ts ; réexporté pour les modules existants
export { withStorageLock };

export const MAX_PENDING_REVIEWS = 20;
export const MAX_RECENT_SYNCS = 5;

/** Clés utilisées dans chrome.storage.local */
export const STORAGE_KEYS = {
  anilistToken: 'anilistToken',
  anilistViewer: 'anilistViewer',
  mediaMappings: 'mediaMappings',
  pendingReviews: 'pendingReviews',
  recentSyncs: 'recentSyncs',
  malToken: 'malToken',
  malViewer: 'malViewer',
  watchingCache: 'watchingCache',
  /** Génération de session par service, incrémentée à chaque déconnexion (voir saveCachedWatching) */
  sessionEpoch: 'sessionEpoch',
  /** Dernière comparaison AniList ↔ MAL (Activité › Écarts) */
  compareLast: 'compare:last',
  /** Tâche d'analyse ou d'alignement en cours (progression, reprise) */
  compareJob: 'compare:job',
  /** Import de l'historique Crunchyroll : tâche, historique réduit, correspondances, aperçu (voir cr-import.ts) */
  crImportJob: 'crImport:job',
  crImportInput: 'crImport:input',
  crImportResolutions: 'crImport:resolutions',
  crImportPlan: 'crImport:plan',
} as const;

/** Import Crunchyroll : propre au compte (aperçu = état des listes), effacé à toute déconnexion */
const CR_IMPORT_STORAGE_KEYS = [STORAGE_KEYS.crImportJob, STORAGE_KEYS.crImportInput, STORAGE_KEYS.crImportResolutions, STORAGE_KEYS.crImportPlan];

/** Retourne le token AniList s'il existe et n'a pas expiré. */
export async function getValidToken(): Promise<AniListToken | null> {
  const stored = await chrome.storage.local.get(STORAGE_KEYS.anilistToken);
  const token: unknown = stored[STORAGE_KEYS.anilistToken];
  return isAniListToken(token) && token.expiresAt > Date.now() ? token : null;
}

export async function saveToken(token: AniListToken): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEYS.anilistToken]: token });
}

export async function getCachedViewer(): Promise<AniListViewer | null> {
  const stored = await chrome.storage.local.get(STORAGE_KEYS.anilistViewer);
  const viewer: unknown = stored[STORAGE_KEYS.anilistViewer];
  return isAniListViewer(viewer) ? viewer : null;
}

export async function saveCachedViewer(viewer: AniListViewer): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEYS.anilistViewer]: viewer });
}

// Les correspondances ne dépendent pas de l'utilisateur (mediaId global) : conservées à la déconnexion
export async function getMediaMappings(): Promise<Record<string, MediaMapping>> {
  const stored = await chrome.storage.local.get(STORAGE_KEYS.mediaMappings);
  const raw: unknown = stored[STORAGE_KEYS.mediaMappings];
  if (!isRecord(raw)) return {};
  return Object.fromEntries(Object.entries(raw).filter((entry): entry is [string, MediaMapping] => isMediaMapping(entry[1])));
}

export async function getMediaMapping(key: string): Promise<MediaMapping | null> {
  return (await getMediaMappings())[key] ?? null;
}

export function saveMediaMapping(key: string, mapping: MediaMapping): Promise<void> {
  return withStorageLock(async () => {
    const mappings = await getMediaMappings();
    await chrome.storage.local.set({ [STORAGE_KEYS.mediaMappings]: { ...mappings, [key]: mapping } });
  });
}

export function deleteMediaMapping(key: string): Promise<void> {
  return withStorageLock(async () => {
    const { [key]: _removed, ...rest } = await getMediaMappings();
    await chrome.storage.local.set({ [STORAGE_KEYS.mediaMappings]: rest });
  });
}

/** Supprime les correspondances dont la clé commence par `prefix` (ex : `netflix:`) ; retourne leur nombre. */
export function deleteMediaMappingsByPrefix(prefix: string): Promise<number> {
  return withStorageLock(async () => {
    const mappings = await getMediaMappings();
    const kept = Object.fromEntries(Object.entries(mappings).filter(([key]) => !key.startsWith(prefix)));
    const removed = Object.keys(mappings).length - Object.keys(kept).length;
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
 * pas la voir). Appelée à la déconnexion comme à l'invalidation du token.
 */
export function clearAniListSession(): Promise<void> {
  return withStorageLock(async () => {
    await chrome.storage.local.remove([STORAGE_KEYS.anilistToken, STORAGE_KEYS.anilistViewer, STORAGE_KEYS.compareLast, STORAGE_KEYS.compareJob, ...CR_IMPORT_STORAGE_KEYS]);
    await removeCachedWatching('anilist');
    await bumpSessionEpoch('anilist');
  });
}

/**
 * Vérifications, dernières synchros, liens de séries appris (pages visitées) et file de relance : propres à l'utilisateur, effacées quand plus aucun
 * service de suivi n'est connecté (déconnexion du dernier compte).
 */
export function clearUserSyncData(): Promise<void> {
  return withStorageLock(async () => {
    // Semaines de l'agenda en cache (`airingWeek:<date>`, voir agenda.ts) : elles reflètent la liste de l'utilisateur
    const weeks = Object.keys(await chrome.storage.local.get(null)).filter((key) => key.startsWith('airingWeek:'));
    await chrome.storage.local.remove([STORAGE_KEYS.pendingReviews, STORAGE_KEYS.recentSyncs, STORAGE_KEYS.watchingCache, SYNC_QUEUE_KEY, PENDING_RATINGS_KEY, REWATCH_DECLINED_KEY, STORAGE_KEYS.compareLast, STORAGE_KEYS.compareJob, ...CR_IMPORT_STORAGE_KEYS, PLATFORM_LINKS_KEY, ...weeks]);
  });
}

// ─── Session MyAnimeList ──────────────────────────────────────────────────

/** Token MAL stocké, même expiré : le refresh token permet de le renouveler. */
export async function getMalToken(): Promise<MalToken | null> {
  const stored = await chrome.storage.local.get(STORAGE_KEYS.malToken);
  const token: unknown = stored[STORAGE_KEYS.malToken];
  return isMalToken(token) ? token : null;
}

export async function saveMalToken(token: MalToken): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEYS.malToken]: token });
}

export async function getCachedMalViewer(): Promise<MalViewer | null> {
  const stored = await chrome.storage.local.get(STORAGE_KEYS.malViewer);
  const viewer: unknown = stored[STORAGE_KEYS.malViewer];
  return isMalViewer(viewer) ? viewer : null;
}

export async function saveCachedMalViewer(viewer: MalViewer): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEYS.malViewer]: viewer });
}

/** Comme clearAniListSession : token, profil et liste « En cours » MAL en cache. */
export function clearMalSession(): Promise<void> {
  return withStorageLock(async () => {
    await chrome.storage.local.remove([STORAGE_KEYS.malToken, STORAGE_KEYS.malViewer, STORAGE_KEYS.compareLast, STORAGE_KEYS.compareJob, ...CR_IMPORT_STORAGE_KEYS]);
    await removeCachedWatching('mal');
    await bumpSessionEpoch('mal');
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
