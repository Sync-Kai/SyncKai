// Script de contenu Crunchyroll déclaré dans le manifeste, après le pont du monde MAIN (page-bridge.iife.ts, `document_start`).
// ADN a le sien (adn/content-adn.iife.ts) : chaque page n'analyse que le code de sa plateforme ; Netflix, Disney+ et Prime
// Video ont des scripts enregistrés à la demande par le service worker. Aussi réinjecté par le service worker dans les
// onglets déjà ouverts à l'installation et à la mise à jour sur Chrome (background/content-reinjection.ts) ; Firefox le fait seul.
import { crunchyrollAdapter, crunchyrollBridge } from './adapter';
import { claimContentInstance } from '../lib/instance-guard';
import { startContent } from '../start';

/**
 * Garde contre une double exécution (script du manifeste puis réinjection, ou l'inverse), voir instance-guard.ts. Même clé
 * que le script ADN et que l'ancien script commun Crunchyroll / ADN : une page n'en charge qu'un, et l'instance orpheline
 * d'une version précédente est reconnue (puis arrêtée par start.ts).
 */
const STARTED_FLAG = Symbol.for('synckai.content');

if (claimContentInstance(STARTED_FLAG)) {
  startContent([crunchyrollAdapter], {
    // Pont MAIN de Crunchyroll (signaux de correspondance). Lecteurs de l'historique : injectés à la demande par la page
    // d'import (content/history/history.iife.ts)
    onAdapter: () => crunchyrollBridge(),
  });
}
