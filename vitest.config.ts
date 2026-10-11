import { defineConfig } from 'vitest/config';

// Config séparée de vite.config.ts : le plugin crx n'a pas sa place dans les tests unitaires
export default defineConfig({
  define: {
    __SYNCKAI_BUILD__: JSON.stringify('test'),
    __SYNCKAI_DEBUG__: JSON.stringify(true),
    __SYNCKAI_TARGET__: JSON.stringify('chrome'),
  },
  test: {
    include: ['src/**/*.test.ts', 'scripts/**/*.test.ts'],
    environment: 'node',
    // `npm run coverage` : rapport seulement (aucun seuil bloquant), code de l'extension hors tests et aides de test
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/test/**', 'src/**/*.d.ts'],
      reporter: ['text-summary', 'html', 'json-summary'],
      reportsDirectory: 'coverage',
    },
  },
});
