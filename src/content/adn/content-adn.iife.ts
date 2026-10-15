// Script de contenu ADN déclaré dans le manifeste. Crunchyroll a le sien (crunchyroll/content-crunchyroll.iife.ts) : chaque
// page n'analyse que le code de sa plateforme. Aussi réinjecté par le service worker dans les onglets déjà ouverts à
// l'installation et à la mise à jour sur Chrome (background/content-reinjection.ts) ; Firefox le fait seul.
import { adnAdapter } from './adapter';
import { claimContentInstance } from '../lib/instance-guard';
import { startContent } from '../start';

/**
 * Garde contre une double exécution (script du manifeste puis réinjection, ou l'inverse), voir instance-guard.ts. Même clé
 * que le script Crunchyroll et que l'ancien script commun Crunchyroll / ADN : une page n'en charge qu'un, et l'instance
 * orpheline d'une version précédente est reconnue (puis arrêtée par start.ts).
 */
const STARTED_FLAG = Symbol.for('synckai.content');

// Lecteur de l'historique ADN : injecté à la demande par la page d'import (content/history/history.iife.ts)
if (claimContentInstance(STARTED_FLAG)) startContent([adnAdapter]);
