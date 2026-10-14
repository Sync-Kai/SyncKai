import { configDefaults, defineConfig } from 'vitest/config';

// Tests de bout en bout du popup (npm run test:e2e) : Puppeteer + Chrome headless sur un serveur Vite.
// Séparés de vitest.config.ts pour que `npx vitest run` (tests unitaires) reste rapide et sans navigateur.
// Le contrôle de mise en page des 21 langues (≈ 40 s, en échec tant qu'un libellé traduit déborde) n'en fait pas
// partie, pour ne pas bloquer release.yml : il tourne seul avec SYNCKAI_I18N_LAYOUT=1 (npm run test:i18n-layout).
const LAYOUT_CHECK = 'scripts/e2e/i18n-layout.e2e.ts';
const layoutOnly = process.env.SYNCKAI_I18N_LAYOUT === '1';

export default defineConfig({
  define: {
    __SYNCKAI_BUILD__: JSON.stringify('e2e'),
    __SYNCKAI_DEBUG__: JSON.stringify(false),
    __SYNCKAI_TARGET__: JSON.stringify('chrome'),
  },
  test: {
    include: layoutOnly ? [LAYOUT_CHECK] : ['scripts/e2e/**/*.e2e.ts'],
    exclude: layoutOnly ? configDefaults.exclude : [...configDefaults.exclude, LAYOUT_CHECK],
    environment: 'node',
    // Textes attendus dans toutes les langues (catalogues chargés à la demande dans l'extension)
    setupFiles: ['scripts/e2e/setup.ts'],
    // Un seul navigateur et un seul serveur pour tout le fichier
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 120_000,
  },
});
