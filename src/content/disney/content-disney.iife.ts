// Script de contenu Disney+ (monde isolé), enregistré à la demande par le service worker
// (src/background/platform-access.ts) quand l'utilisateur accorde l'accès à disneyplus.com, et exécuté aussitôt
// dans les onglets Disney+ déjà ouverts, ainsi qu'après une mise à jour de l'extension (accès accordé).
// Les métadonnées viennent du script du monde MAIN (page-bridge.iife.ts), qui observe les réponses du site.
// Format IIFE (suffixe .iife.ts) : script enregistré dynamiquement, sans chargeur ESM.
import { createLogger } from '../../browser/logger';
import { disneyAdapter } from './adapter';
import { claimContentInstance } from '../lib/instance-guard';
import { startContent } from '../start';

/**
 * Garde contre une double exécution dans le même monde isolé (accès retiré puis accordé de nouveau sans recharger
 * l'onglet, réinjection après une mise à jour), voir instance-guard.ts.
 */
const STARTED_FLAG = Symbol.for('synckai.disney.content.runtime');

if (claimContentInstance(STARTED_FLAG)) {
  createLogger('disney').debug('Script Disney+ démarré');
  startContent([disneyAdapter]);
}
