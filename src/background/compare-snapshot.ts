import { COMPARE_STORAGE_KEY, isComparisonResult, withStaleDiffs, type ComparisonResult } from '../shared/compare';
import { createLogger } from '../shared/logger';
import { withStorageLock } from '../shared/storage-lock';
import type { TrackerId } from '../shared/tracker.types';

// Dernière comparaison AniList ↔ MAL (`compare:last`) : lecture, et modifications sous le verrou du stockage
// (boucle d'alignement, écritures de la synchro et des contrôles, popup).

const log = createLogger('compare');

export async function readComparison(): Promise<ComparisonResult | null> {
  const stored = await chrome.storage.local.get(COMPARE_STORAGE_KEY);
  const value: unknown = stored[COMPARE_STORAGE_KEY];
  return isComparisonResult(value) ? value : null;
}

/**
 * Lecture-modification-écriture sous verrou. Rien n'est écrit si la comparaison a disparu
 * (déconnexion : elle n'est jamais recréée) ou si `update` la renvoie inchangée.
 */
export function updateComparison(update: (result: ComparisonResult) => ComparisonResult): Promise<void> {
  return withStorageLock(async () => {
    const current = await readComparison();
    if (!current) return;
    const next = update(current);
    if (next !== current) await chrome.storage.local.set({ [COMPARE_STORAGE_KEY]: next });
  });
}

/**
 * Écriture réussie sur `service` hors alignement (synchro, contrôle, note, revisionnage, import) : l'écart
 * de cette fiche est marqué « à réanalyser », il ne peut plus être aligné avec ses anciennes valeurs. Ne lève jamais.
 */
export async function markSeriesStale(service: TrackerId, id: number): Promise<void> {
  try {
    await updateComparison((result) => withStaleDiffs(result, (diff) => (service === 'mal' ? diff.malId : diff.mediaId) === id));
  } catch (error: unknown) {
    log.warn('Comparaison des listes non invalidée :', error);
  }
}
