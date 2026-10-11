// Lint typé (typescript-eslint, project service) : jeu de règles court, à fort signal.
// Le reste (types, style) est déjà tenu par `tsc` strict ; pas de formateur.
import { defineConfig } from 'eslint/config';
import tseslint from 'typescript-eslint';

export default defineConfig(
  {
    ignores: ['dist/**', 'dist-firefox/**', 'release/**', 'node_modules/**'],
  },
  {
    files: ['src/**/*.ts', 'scripts/**/*.ts'],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        // Chaque fichier est typé par le tsconfig.json le plus proche (racine, scripts, scripts/screenshots, scripts/e2e)
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: { '@typescript-eslint': tseslint.plugin },
    linterOptions: { reportUnusedDisableDirectives: 'error' },
    rules: {
      // Promesse ni attendue ni gérée : rejet silencieux (synchro perdue dans le service worker)
      '@typescript-eslint/no-floating-promises': 'error',
      // Fonction async passée là où un retour void est attendu (écouteurs DOM, chrome.*.addListener)
      '@typescript-eslint/no-misused-promises': 'error',
      // switch sur une union : chaque membre traité, sans se reposer sur `default`
      '@typescript-eslint/switch-exhaustiveness-check': 'error',
      '@typescript-eslint/no-explicit-any': 'error',
    },
  },
);
