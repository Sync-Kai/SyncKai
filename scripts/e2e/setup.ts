// Préparation des tests de bout en bout, côté Node (vitest.e2e.config.ts › setupFiles) : toutes les langues
// enregistrées d'emblée pour les textes attendus (`tl('fr', …)`). Dans le navigateur, les pages de test chargent
// leurs catalogues à la demande, comme l'extension (scripts/screenshots/params.ts › loadedUiLocaleParam).
import { registerAllCatalogs } from '../../src/test/catalogs';

registerAllCatalogs();
