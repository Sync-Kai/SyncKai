import { isMediaRef, mediaRefId, REWATCH_DECLINE_MS, type MediaRef, type PendingRating } from './engagement.types';
import { isRecord } from './guards';
import { withStorageLock } from './storage';
import type { ServiceResult } from './sync.types';

// Stockage de l'engagement (popup + service worker) : notes en attente et revisionnages refusés.
// Écritures sous `withStorageLock` (src/shared/storage.ts).

export const PENDING_RATINGS_KEY = 'pendingRatings';
export const REWATCH_DECLINED_KEY = 'rewatchDeclined';

/** Cartes « À noter » conservées au maximum (les plus anciennes sont abandonnées) */
export const MAX_PENDING_RATINGS = 30;

export function isPendingRating(value: unknown): value is PendingRating {
  return (
    isMediaRef(value) &&
    isRecord(value) &&
    typeof value.id === 'string' &&
    value.id === mediaRefId(value) &&
    (value.coverUrl === null || typeof value.coverUrl === 'string') &&
    typeof value.completedAt === 'number' &&
    Number.isFinite(value.completedAt)
  );
}

/**
 * Note réglée (pur, testable) : la carte « À noter » ne part que si aucun service n'est en erreur et qu'au moins un
 * a enregistré la note (même critère que le retour du popup). Échec partiel, ou série absente de toutes les listes
 * (tous `skipped`) : la carte reste, pour un nouvel essai ou « Ignorer ».
 */
export function isRatingSettled(results: readonly ServiceResult[]): boolean {
  const failed = results.some((r) => r.outcome.status === 'error');
  const written = results.some((r) => r.outcome.status === 'updated' || r.outcome.status === 'up-to-date');
  return !failed && written;
}

async function readPendingRatings(): Promise<PendingRating[]> {
  const stored = await chrome.storage.local.get(PENDING_RATINGS_KEY);
  const value: unknown = stored[PENDING_RATINGS_KEY];
  return Array.isArray(value) ? value.filter(isPendingRating) : [];
}

/** Notes en attente, de la plus récente à la plus ancienne. */
export async function getPendingRatings(): Promise<PendingRating[]> {
  return (await readPendingRatings()).sort((a, b) => b.completedAt - a.completedAt);
}

/** Ajoute ou remplace la note en attente de même `id`. */
export function addPendingRating(rating: PendingRating): Promise<void> {
  return withStorageLock(async () => {
    const others = (await readPendingRatings()).filter((r) => r.id !== rating.id);
    const next = [rating, ...others].sort((a, b) => b.completedAt - a.completedAt).slice(0, MAX_PENDING_RATINGS);
    await chrome.storage.local.set({ [PENDING_RATINGS_KEY]: next });
  });
}

/** Retire la note en attente ; renvoie true si une carte a été supprimée. */
export function removePendingRating(id: string): Promise<boolean> {
  return withStorageLock(async () => {
    const ratings = await readPendingRatings();
    const remaining = ratings.filter((r) => r.id !== id);
    if (remaining.length === ratings.length) return false;
    if (remaining.length === 0) await chrome.storage.local.remove(PENDING_RATINGS_KEY);
    else await chrome.storage.local.set({ [PENDING_RATINGS_KEY]: remaining });
    return true;
  });
}

// ─── Revisionnages refusés ────────────────────────────────────────────────

type RewatchDeclines = Record<string, number>;

/** Lecture brute ; valeurs invalides ignorées */
async function readRewatchDeclines(): Promise<RewatchDeclines> {
  const stored = await chrome.storage.local.get(REWATCH_DECLINED_KEY);
  const value: unknown = stored[REWATCH_DECLINED_KEY];
  if (!isRecord(value)) return {};
  const declines: RewatchDeclines = {};
  for (const [id, ts] of Object.entries(value)) {
    if (typeof ts === 'number' && Number.isFinite(ts)) declines[id] = ts;
  }
  return declines;
}

/** Refus encore actif (moins de 30 jours) ; pur, testable */
export function isDeclineActive(declinedAt: number | undefined, now: number): boolean {
  return declinedAt !== undefined && now - declinedAt < REWATCH_DECLINE_MS;
}

/** Ne garde que les refus encore actifs */
export function purgeExpiredDeclines(declines: RewatchDeclines, now: number): RewatchDeclines {
  return Object.fromEntries(Object.entries(declines).filter(([, ts]) => isDeclineActive(ts, now)));
}

export async function isRewatchDeclined(ref: Pick<MediaRef, 'mediaId' | 'malId'>, now: number = Date.now()): Promise<boolean> {
  const declines = await readRewatchDeclines();
  return isDeclineActive(Object.hasOwn(declines, mediaRefId(ref)) ? declines[mediaRefId(ref)] : undefined, now);
}

/** Enregistre un refus de revisionnage (et purge les refus expirés). */
export function recordRewatchDecline(ref: Pick<MediaRef, 'mediaId' | 'malId'>, now: number = Date.now()): Promise<void> {
  return withStorageLock(async () => {
    const declines = purgeExpiredDeclines(await readRewatchDeclines(), now);
    declines[mediaRefId(ref)] = now;
    await chrome.storage.local.set({ [REWATCH_DECLINED_KEY]: declines });
  });
}
