import { vi } from 'vitest';

// Préparation commune des tests unitaires (vitest.config.ts › setupFiles) : la clé des tokens vit en mémoire
// (src/test/memory-key-store.ts) au lieu d'IndexedDB, absente de Node.
vi.mock('../shared/token-key-store', () => import('./memory-key-store'));
