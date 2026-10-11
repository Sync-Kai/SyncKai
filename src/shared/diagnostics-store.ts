import { getLocale } from '../i18n';
import { AIRING_RESULT_KEY, isAiringCheckResult } from './airing.types';
import { getPendingRatings } from './engagement-store';
import { readJournal } from './error-journal';
import { getExcludedSeries } from './exclusions';
import { isRecord } from './guards';
import { buildDiagnosticsReport, describeBrowser, type BuildMode } from './diagnostics';
import { getSettings } from './settings';
import { getMediaMappings, getPendingReviews, getRecentSyncs, isStoredToken } from './storage';
import { STORAGE_KEYS } from './storage-keys';
import { getSyncQueue } from './sync-queue-store';
import { readTokenSecrets } from './token-access';

// Collecte des données du rapport de diagnostic (popup) : lecture directe de chrome.storage.local.

/** Navigateur courant, lisible (userAgentData absent des types DOM : lu comme `unknown`) */
export function currentBrowser(): string {
  const uaData: unknown = Reflect.get(navigator, 'userAgentData');
  return describeBrowser(uaData, navigator.userAgent);
}

/** Tokens (déchiffrés) et noms de compte présents en stockage : jamais affichés, servent seulement à les masquer */
async function sensitiveValues(stored: Record<string, unknown>): Promise<string[]> {
  const values = await readTokenSecrets();
  for (const key of [STORAGE_KEYS.anilistViewer, STORAGE_KEYS.malViewer]) {
    const viewer = stored[key];
    if (isRecord(viewer) && typeof viewer.name === 'string') values.push(viewer.name);
  }
  return values;
}

export async function buildCurrentReport(): Promise<string> {
  const stored = await chrome.storage.local.get([STORAGE_KEYS.anilistToken, STORAGE_KEYS.malToken, STORAGE_KEYS.anilistViewer, STORAGE_KEYS.malViewer, AIRING_RESULT_KEY]);
  const [settings, mappings, excluded, reviews, queue, ratings, recent, journal] = await Promise.all([
    getSettings(),
    getMediaMappings(),
    getExcludedSeries(),
    getPendingReviews(),
    getSyncQueue(),
    getPendingRatings(),
    getRecentSyncs(),
    readJournal(),
  ]);
  const airing: unknown = stored[AIRING_RESULT_KEY];
  const buildMode: BuildMode = __SYNCKAI_DEBUG__ ? 'development' : 'production';

  return buildDiagnosticsReport({
    generatedAt: Date.now(),
    version: chrome.runtime.getManifest().version,
    buildMode,
    browser: currentBrowser(),
    uiLocale: getLocale(),
    browserLanguage: navigator.language,
    settings,
    // Présence d'une session seulement (même expirée côté MAL : le refresh token la renouvelle)
    services: { anilist: isStoredToken('anilist', stored[STORAGE_KEYS.anilistToken]), mal: isStoredToken('mal', stored[STORAGE_KEYS.malToken]) },
    counters: {
      mappings: Object.keys(mappings).length,
      excludedSeries: excluded.length,
      pendingReviews: reviews.length,
      queuePending: queue.filter((item) => item.status === 'pending').length,
      queueFailed: queue.filter((item) => item.status === 'failed').length,
      pendingRatings: ratings.length,
      recentSyncs: recent.length,
    },
    airing: isAiringCheckResult(airing) ? airing : null,
    journal,
    sensitiveValues: await sensitiveValues(stored),
  });
}
