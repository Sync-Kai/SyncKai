import { vi } from 'vitest';
import { registerAllCatalogs } from './catalogs';

// Préparation commune des tests unitaires (vitest.config.ts › setupFiles) :
// - toutes les langues enregistrées d'emblée (tests synchrones) : dans l'extension, seul l'anglais est embarqué et les
//   autres langues sont chargées à la demande ; les modules partagés n'importent que le moteur `i18n/core` (PERF-01) ;
// - la clé des tokens vit en mémoire (src/test/memory-key-store.ts) au lieu d'IndexedDB, absente de Node.
registerAllCatalogs();
vi.mock('../browser/tokens/key-store', () => import('./memory-key-store'));
