import { getLocale } from '../../i18n';
import { AIRING_RESULT_KEY, isAiringCheckResult } from '../../shared/airing.types';
import { getPendingRatings } from './engagement-store';
import { readJournal } from '../error-journal';
import { getExcludedSeries } from '../../shared/exclusions';
import { isRecord } from '../../shared/guards';
import { buildDiagnosticsReport, describeBrowser, type BuildMode } from '../../shared/diagnostics';
import { getSettings } from './settings-access';
import { getMediaMappings } from './mappings';
import { getPendingReviews, getRecentSyncs } from './reviews';
import { isStoredToken } from './tokens';
import { STORAGE_KEYS } from '../../protocol/storage-keys';
import { getSyncQueue } from './sync-queue-store';

// Collecte des données du rapport de diagnostic : lecture directe de chrome.storage.local. Appelée par le service worker
// seulement (GET_DIAGNOSTICS_REPORT, background/diagnostics-report.ts), qui fournit les jetons déchiffrés à masquer :
// aucune page ne déchiffre de jeton (SEC-06).

/** Navigateur courant, lisible (userAgentData absent des types DOM : lu comme `unknown`) */
export function currentBrowser(): string {
  const uaData: unknown = Reflect.get(navigator, 'userAgentData');
  return describeBrowser(uaData, navigator.userAgent);
}

/** Tokens (déchiffrés) et noms de compte présents en stockage : jamais affichés, servent seulement à les masquer */
function sensitiveValues(tokenSecrets: readonly string[], stored: Record<string, unknown>): string[] {
  const values = [...tokenSecrets];
  for (const key of [STORAGE_KEYS.anilistViewer, STORAGE_KEYS.malViewer]) {
    const viewer = stored[key];
    if (isRecord(viewer) && typeof viewer.name === 'string') values.push(viewer.name);
  }
  return values;
}

/** Rapport complet ; `tokenSecrets` : valeurs des jetons enregistrés (déchiffrées par le service worker), masquées partout */
export async function buildCurrentReport(tokenSecrets: readonly string[]): Promise<string> {
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
    sensitiveValues: sensitiveValues(tokenSecrets, stored),
  });
}
