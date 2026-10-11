import { vi } from 'vitest';
// Catalogues complets pour tous les tests : les modules partagés n'importent que le moteur `i18n/core` (PERF-01)
import '../i18n';

// Préparation commune des tests unitaires (vitest.config.ts › setupFiles) : la clé des tokens vit en mémoire
// (src/test/memory-key-store.ts) au lieu d'IndexedDB, absente de Node.
vi.mock('../shared/token-key-store', () => import('./memory-key-store'));
