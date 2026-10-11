import { bindLegacyDataToSession, deleteMediaMappingsByPrefix } from '../shared/storage';
import { createLogger } from '../shared/logger';

const log = createLogger('background');

/**
 * Correspondances Netflix enregistrées par la 2.1.0 : calculées avant le correctif des films (série TV homonyme
 * retenue) et des fiches liées à un autre titre Netflix. Recalculées toutes seules au prochain épisode.
 */
const NETFLIX_MAPPINGS_FIXED_IN = '2.1.1';

/**
 * File de relance, notes en attente, synchros récentes et corrections liées au compte depuis la 2.2.0 : celles des
 * versions précédentes sont rattachées aux sessions ouvertes à la mise à jour (le compte connecté est le plus probable).
 */
const ACCOUNT_BINDING_IN = '2.2.0';

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
  if (previousVersion === undefined) return;
  // Version illisible (NaN) : aucune migration
  const before = (fixedIn: string): boolean => compareVersions(previousVersion, fixedIn) < 0;
  if (before(NETFLIX_MAPPINGS_FIXED_IN)) {
    const removed = await deleteMediaMappingsByPrefix('netflix:');
    if (removed > 0) log.info(`Mise à jour depuis ${previousVersion} : ${removed} correspondance(s) Netflix oubliée(s)`);
  }
  if (before(ACCOUNT_BINDING_IN)) {
    const bound = await bindLegacyDataToSession();
    if (bound > 0) log.info(`Mise à jour depuis ${previousVersion} : ${bound} élément(s) rattaché(s) au compte connecté`);
  }
}
