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
      // Ferme le trou de `any` implicite que no-explicit-any laisse ouvert (JSON.parse, res.json(), Array.isArray)
      '@typescript-eslint/no-unsafe-assignment': 'error',
      '@typescript-eslint/no-unsafe-argument': 'error',
      '@typescript-eslint/no-unsafe-return': 'error',
      '@typescript-eslint/no-unsafe-member-access': 'error',
      '@typescript-eslint/no-unsafe-call': 'error',
      // Assertion devenue inutile après un changement de type ; API dépréciée (chrome, puppeteer) avant qu'elle ne casse
      '@typescript-eslint/no-unnecessary-type-assertion': 'error',
      '@typescript-eslint/no-deprecated': 'error',
      // Fabriques qui grossissent : avertissement seulement, le plafond évite d'en ajouter de nouvelles
      'max-lines-per-function': ['warn', { max: 200, skipBlankLines: true, skipComments: true }],
    },
  },
  {
    // Code livré (hors tests) : pas de HTML injecté en texte, pas d'évaluation de code, journal par le logger seulement
    files: ['src/**/*.ts'],
    ignores: ['src/**/*.test.ts', 'src/test/**'],
    rules: {
      'no-restricted-syntax': [
        'error',
        { selector: 'MemberExpression[property.name=/^(innerHTML|outerHTML)$/]', message: 'HTML injecté en texte interdit : construire les nœuds (ui/dom.ts) ou textContent.' },
        { selector: 'CallExpression[callee.property.name=/^(insertAdjacentHTML|writeln)$/]', message: 'HTML injecté en texte interdit : construire les nœuds (ui/dom.ts).' },
        { selector: 'CallExpression[callee.object.name="document"][callee.property.name="write"]', message: 'document.write interdit.' },
        { selector: 'CallExpression[callee.name="eval"], NewExpression[callee.name="Function"], CallExpression[callee.name="Function"]', message: 'Évaluation de code interdite (CSP, revue des Stores).' },
        { selector: 'Identifier[name="localStorage"]', message: 'localStorage interdit : chrome.storage.local (le lecteur d’historique ADN lit celui de la page ADN, voir content/adn/history.ts).' },
        { selector: 'MemberExpression[object.name="console"]', message: 'console.* interdit : passer par createLogger (browser/logger.ts).' },
      ],
    },
  },
  {
    // Tests unitaires : les simulations `vi.fn()` / `vi.hoisted` sans type renvoient `any` par construction de Vitest
    files: ['src/**/*.test.ts'],
    rules: {
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
    },
  },
  {
    // Exceptions assumées : le journal lui-même, et le lecteur d'historique ADN qui lit le jeton de la page ADN
    files: ['src/browser/logger.ts', 'src/browser/storage/lock.ts', 'src/content/adn/history.ts'],
    rules: { 'no-restricted-syntax': 'off' },
  },
);
