import { getPendingRatings } from '../browser/storage/engagement-store';
import { getPendingReviews } from './storage';
import { getSyncQueue } from '../browser/storage/sync-queue-store';

const BADGE_COLOR = '#f59e0b'; // amber-500, cohérent avec les alertes "à vérifier"
const BADGE_TEXT_COLOR = '#1A0F1C'; // texte sombre : meilleur contraste que le blanc sur l'ambre
const SYNC_BADGE_COLOR = '#7EE0C3'; // mint "Yoru Mochi"
const SYNC_BADGE_TEXT_COLOR = '#1A0F1C';
const SYNC_BADGE_MS = 4_000;

/** Timer de la coche en cours : une nouvelle synchro prolonge l'affichage au lieu de l'empiler */
let flashTimer: ReturnType<typeof setTimeout> | undefined;

/** Couleurs du badge ; setBadgeTextColor : Chrome 110+, absent de certains navigateurs */
async function setBadgeColors(background: string, text: string): Promise<void> {
  await chrome.action.setBadgeBackgroundColor({ color: background });
  if (typeof chrome.action.setBadgeTextColor === 'function') {
    await chrome.action.setBadgeTextColor({ color: text });
  }
}

/** Affiche sur l'icône le nombre d'épisodes à vérifier + synchros abandonnées + séries à noter (vide si aucun). */
export async function refreshReviewBadge(): Promise<void> {
  // Coche de succès en cours : le compteur sera restauré à la fin du flash
  if (flashTimer !== undefined) return;
  const [reviews, queue, ratings] = await Promise.all([getPendingReviews(), getSyncQueue(), getPendingRatings()]);
  const count = reviews.length + queue.filter((item) => item.status === 'failed').length + ratings.length;
  await chrome.action.setBadgeText({ text: count > 0 ? String(count) : '' });
  if (count > 0) await setBadgeColors(BADGE_COLOR, BADGE_TEXT_COLOR);
}

/**
 * Coche "✓" sur l'icône pendant ~4 s après une synchronisation réussie (visible même en plein écran),
 * puis restaure le compteur d'épisodes à vérifier. Ne lève jamais.
 */
export async function flashSyncBadge(): Promise<void> {
  try {
    clearTimeout(flashTimer);
    flashTimer = setTimeout(() => {
      flashTimer = undefined;
      refreshReviewBadge().catch(() => undefined);
    }, SYNC_BADGE_MS);
    await chrome.action.setBadgeText({ text: '✓' });
    await setBadgeColors(SYNC_BADGE_COLOR, SYNC_BADGE_TEXT_COLOR);
  } catch {
    // Badge purement décoratif : une erreur ne doit jamais remonter dans la synchronisation
  }
}
