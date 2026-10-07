import { defineConfig } from 'vitest/config';

// Tests de bout en bout du popup (npm run test:e2e) : Puppeteer + Chrome headless sur un serveur Vite.
// Séparés de vitest.config.ts pour que `npx vitest run` (tests unitaires) reste rapide et sans navigateur.
export default defineConfig({
  define: {
    __SYNCKAI_BUILD__: JSON.stringify('e2e'),
    __SYNCKAI_DEBUG__: JSON.stringify(false),
    __SYNCKAI_TARGET__: JSON.stringify('chrome'),
  },
  test: {
    include: ['scripts/e2e/**/*.e2e.ts'],
    environment: 'node',
    // Un seul navigateur et un seul serveur pour tout le fichier
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 120_000,
  },
});
