import { defineConfig } from 'vitest/config';

// Tests de bout en bout de l'extension construite (npm run test:ext) : dist/ chargé dans un vrai Chromium, réseau du
// service worker intercepté (faux AniList / MyAnimeList, scripts/ext-e2e). Séparés de vitest.config.ts (unitaires) et de
// vitest.e2e.config.ts (vues rendues sur une API chrome simulée). Un navigateur par test, fichiers l'un après l'autre.
export default defineConfig({
  define: {
    __SYNCKAI_BUILD__: JSON.stringify('ext-e2e'),
    __SYNCKAI_DEBUG__: JSON.stringify(false),
    __SYNCKAI_TARGET__: JSON.stringify('chrome'),
  },
  test: {
    include: ['scripts/ext-e2e/**/*.ext.ts'],
    environment: 'node',
    fileParallelism: false,
    testTimeout: 60_000,
    hookTimeout: 60_000,
  },
});
