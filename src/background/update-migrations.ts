import { deleteMediaMappingsByPrefix } from '../shared/storage';
import { createLogger } from '../shared/logger';

const log = createLogger('background');

/**
 * Correspondances Netflix enregistrées par la 2.1.0 : calculées avant le correctif des films (série TV homonyme
 * retenue) et des fiches liées à un autre titre Netflix. Recalculées toutes seules au prochain épisode.
 */
const NETFLIX_MAPPINGS_FIXED_IN = '2.1.1';

/** Compare deux versions « x.y.z » ; négatif si a < b, NaN si l'une est illisible. */
export function compareVersions(a: string, b: string): number {
  const left = a.split('.').map(Number);
  const right = b.split('.').map(Number);
  for (let i = 0; i < Math.max(left.length, right.length); i++) {
    const diff = (left[i] ?? 0) - (right[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

/**
 * Migrations à la mise à jour de l'extension (`runtime.onInstalled`, `reason === 'update'`). Chacune ne s'applique
 * qu'en venant d'une version antérieure à son correctif : les mises à jour suivantes gardent les choix manuels.
 */
export async function runUpdateMigrations(previousVersion: string | undefined): Promise<void> {
  // Version illisible (NaN) : aucune purge
  if (previousVersion === undefined || !(compareVersions(previousVersion, NETFLIX_MAPPINGS_FIXED_IN) < 0)) return;
  const removed = await deleteMediaMappingsByPrefix('netflix:');
  if (removed > 0) log.info(`Mise à jour depuis ${previousVersion} : ${removed} correspondance(s) Netflix oubliée(s)`);
}
