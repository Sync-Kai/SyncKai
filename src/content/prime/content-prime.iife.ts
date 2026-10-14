// Script de contenu Prime Video (monde isolé), enregistré à la demande par le service worker
// (src/background/platform-access.ts) quand l'utilisateur accorde l'accès à primevideo.com, et exécuté aussitôt dans
// les onglets Prime Video déjà ouverts, ainsi qu'après une mise à jour de l'extension (accès accordé).
// Les métadonnées viennent du nœud d'hydratation de la page et du script du monde MAIN (page-bridge.iife.ts).
// Format IIFE (suffixe .iife.ts) : script enregistré dynamiquement, sans chargeur ESM.
import { createLogger } from '../../shared/logger';
import { primeAdapter } from '../adapters/prime';
import { claimContentInstance } from '../lib/instance-guard';
import { startContent } from '../start';

/** Garde contre une double exécution dans le même monde isolé (voir instance-guard.ts) */
const STARTED_FLAG = Symbol.for('synckai.prime.content.runtime');

if (claimContentInstance(STARTED_FLAG)) {
  if (__SYNCKAI_DEBUG__) createLogger('prime').debug('Script Prime Video démarré');
  startContent([primeAdapter]);
}
