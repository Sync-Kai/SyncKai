// Script de contenu Netflix (monde isolé), enregistré à la demande par le service worker
// (src/background/netflix-access.ts) quand l'utilisateur accorde l'accès à netflix.com, et exécuté aussitôt
// dans les onglets Netflix déjà ouverts.
// Les métadonnées viennent du script du monde MAIN (page-bridge.iife.ts) via le pont d'événements.
// Format IIFE (suffixe .iife.ts) : script enregistré dynamiquement, sans chargeur ESM.
import { netflixAdapter } from '../adapters/netflix';
import { startContent } from '../start';

/**
 * Garde contre une double exécution dans le même monde isolé : accès retiré puis accordé de nouveau sans
 * recharger l'onglet (le script injecté à l'activation précédente tourne encore).
 */
const STARTED_FLAG = Symbol.for('synckai.netflix.content');

if (!Reflect.get(globalThis, STARTED_FLAG)) {
  Reflect.defineProperty(globalThis, STARTED_FLAG, { value: true });
  startContent([netflixAdapter]);
}
