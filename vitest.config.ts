import { defineConfig } from 'vitest/config';
import { contentCatalogsDefine } from './src/build/content-catalog';
import de from './src/i18n/locales/de.json';
import en from './src/i18n/locales/en.json';
import fr from './src/i18n/locales/fr.json';

// Config séparée de vite.config.ts : le plugin crx n'a pas sa place dans les tests unitaires
export default defineConfig({
  define: {
    __SYNCKAI_BUILD__: JSON.stringify('test'),
    __SYNCKAI_DEBUG__: JSON.stringify(true),
    __SYNCKAI_TARGET__: JSON.stringify('chrome'),
    // Comme vite.config.ts : textes des scripts de contenu (src/i18n/content.ts)
    __SYNCKAI_CONTENT_CATALOGS__: contentCatalogsDefine({ en, fr, de }),
  },
  test: {
    include: ['src/**/*.test.ts', 'scripts/**/*.test.ts'],
    environment: 'node',
    // Clé des tokens en mémoire (pas d'IndexedDB dans Node) : voir src/test/setup.ts
    setupFiles: ['src/test/setup.ts'],
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
