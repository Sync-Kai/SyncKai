import { defineConfig } from 'vitest/config';
import { contentCatalogsDefine } from './src/build/content-catalog';
import en from './src/i18n/locales/en.json';
import thresholds from './scripts/coverage-thresholds.json';

// Config séparée de vite.config.ts : le plugin crx n'a pas sa place dans les tests unitaires
export default defineConfig({
  define: {
    __SYNCKAI_BUILD__: JSON.stringify('test'),
    __SYNCKAI_DEBUG__: JSON.stringify(true),
    __SYNCKAI_TARGET__: JSON.stringify('chrome'),
    // Comme vite.config.ts : textes des scripts de contenu (src/i18n/content.ts)
    __SYNCKAI_CONTENT_CATALOGS__: contentCatalogsDefine(en),
  },
  test: {
    include: ['src/**/*.test.{ts,tsx}', 'scripts/**/*.test.ts'],
    environment: 'node',
    // Clé des tokens en mémoire (pas d'IndexedDB dans Node) : voir src/test/setup.ts
    setupFiles: ['src/test/setup.ts'],
    // `npm run coverage` (job « coverage » de ci.yml) : code de l'extension hors tests et aides de test.
    // Seuils en cliquet (décision 5 de l'audit 2026-10-15) dans scripts/coverage-thresholds.json, lu aussi par ci.yml :
    // valeurs mesurées le 2026-11-13 (audit 2026-11-10, décision 13), arrondies au dixième inférieur. Une baisse fait
    // échouer le job ; plus d'un point au-dessus d'un seuil, le job avertit : le relever à la main, jamais l'abaisser.
    // Sans --coverage (`vitest run`, `npm run verify`, release.yml), aucun seuil n'est vérifié.
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/**/*.test.{ts,tsx}', 'src/test/**', 'src/**/*.d.ts'],
      reporter: ['text-summary', 'html', 'json-summary'],
      reportsDirectory: 'coverage',
      thresholds,
    },
  },
});
