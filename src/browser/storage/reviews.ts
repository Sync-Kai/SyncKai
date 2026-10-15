// Vérifications manuelles (« À vérifier ») et dernières synchros, propres à l'utilisateur.
import { isPendingReview, isRecentSync, keepDeferred, type DeferredEpisode, type PendingReview, type RecentSync } from '../../shared/review.types';
import { STORAGE_KEYS } from '../../protocol/storage-keys';
import { withStorageLock } from './lock';

export const MAX_PENDING_REVIEWS = 20;

export const MAX_RECENT_SYNCS = 5;

// ─── Vérifications manuelles & dernières synchros (propres à l'utilisateur) ───

/** Cartes en attente, la plus récente en premier */
export async function getPendingReviews(): Promise<PendingReview[]> {
  const stored = await chrome.storage.local.get(STORAGE_KEYS.pendingReviews);
  const raw: unknown = stored[STORAGE_KEYS.pendingReviews];
  return (Array.isArray(raw) ? raw.filter(isPendingReview) : []).sort((a, b) => b.createdAt - a.createdAt);
}

/**
 * Ajoute ou remplace la carte d'une saison (une seule par clé : le dernier épisode l'emporte), MAX_PENDING_REVIEWS au plus.
 * Une correction (« Corriger », `previous`, épisode mis de côté) n'est jamais évincée ni remplacée par une vérification
 * simple : la plus ancienne carte simple laisse sa place ; corrections seules → nouvelle carte simple refusée. Correction
 * remplacée par une correction : épisode mis de côté gardé. Retourne false si la carte n'est pas enregistrée.
 */
export function savePendingReview(review: PendingReview): Promise<boolean> {
  return withStorageLock(async () => {
    const reviews = await getPendingReviews();
    const isCorrection = (r: PendingReview): boolean => r.previous !== null;
    const same = reviews.find((r) => r.key === review.key);
    if (same && isCorrection(same) && !isCorrection(review)) return false;
    const carried = same?.deferred !== undefined && isCorrection(review) ? (review.deferred === undefined ? same.deferred : keepDeferred(same.deferred, review.deferred)) : review.deferred;
    const next: PendingReview = carried !== undefined ? { ...review, deferred: carried } : review;
    const others = reviews.filter((r) => r.key !== review.key);
    const corrections = others.filter(isCorrection).length + (isCorrection(next) ? 1 : 0);
    if (!isCorrection(next) && corrections >= MAX_PENDING_REVIEWS) return false;
    // Cartes simples gardées dans la place restante, les plus récentes d'abord (getPendingReviews : ordre décroissant)
    const simpleKept = new Set(others.filter((r) => !isCorrection(r)).slice(0, Math.max(0, MAX_PENDING_REVIEWS - corrections - (isCorrection(next) ? 0 : 1))));
    await chrome.storage.local.set({ [STORAGE_KEYS.pendingReviews]: [next, ...others.filter((r) => isCorrection(r) || simpleKept.has(r))] });
    return true;
  });
}

export function deletePendingReview(key: string): Promise<void> {
  return withStorageLock(async () => {
    const remaining = (await getPendingReviews()).filter((r) => r.key !== key);
    await chrome.storage.local.set({ [STORAGE_KEYS.pendingReviews]: remaining });
  });
}

/** Retire la carte d'une saison et la renvoie (null : déjà retirée), en une seule opération sous le verrou */
export function takePendingReview(key: string): Promise<PendingReview | null> {
  return withStorageLock(async () => {
    const reviews = await getPendingReviews();
    const taken = reviews.find((r) => r.key === key) ?? null;
    if (taken !== null) await chrome.storage.local.set({ [STORAGE_KEYS.pendingReviews]: reviews.filter((r) => r.key !== key) });
    return taken;
  });
}

/**
 * Met un épisode de côté sur la correction (« Corriger ») en attente pour la saison : il sera appliqué après la
 * décision. false si la carte n'est plus une correction (validée ou ignorée entre-temps) : rien n'est enregistré.
 */
export function deferOnCorrection(key: string, deferred: DeferredEpisode): Promise<boolean> {
  return withStorageLock(async () => {
    const reviews = await getPendingReviews();
    const card = reviews.find((r) => r.key === key);
    if (card === undefined || card.previous === null) return false;
    const updated: PendingReview = { ...card, deferred: keepDeferred(card.deferred, deferred) };
    await chrome.storage.local.set({ [STORAGE_KEYS.pendingReviews]: reviews.map((r) => (r.key === key ? updated : r)) });
    return true;
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
