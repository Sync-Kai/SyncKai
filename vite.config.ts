import { crx, type CrxPlugin } from '@crxjs/vite-plugin';
import tailwindcss from '@tailwindcss/vite';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { defineConfig, type Plugin } from 'vite';
import manifest from './manifest.json';
import { GIT_COMMIT_EPOCH_ARGS, resolveBuildStamp } from './src/build/build-stamp';
import { contentCatalogsDefine } from './src/build/content-catalog';
import { devVersionName, GIT_DIRTY_ARGS, GIT_SHORT_SHA_ARGS } from './src/build/dev-version';
import { parseBuildTarget, targetManifest, targetOutDir } from './src/build/manifest-target';
import { assetFileName, crxIifeIntermediates, dropExtensionInjectedScripts, jsFileNames, sortWebAccessibleResources, splitRegisteredScripts } from './src/build/output-names';
import en from './src/i18n/locales/en.json';

// Navigateur cible : `SYNCKAI_TARGET=firefox` (npm run build:firefox), chrome par défaut.
// Pas de `--mode firefox` : le mode pilote __SYNCKAI_DEBUG__ et livrerait les logs de debug.
const target = parseBuildTarget(process.env.SYNCKAI_TARGET);
const jsFileName = jsFileNames(manifest.background.service_worker);

function readOrNull(read: () => string): string | null {
  try {
    return read();
  } catch {
    return null;
  }
}

/** Horodatage reproductible (SOURCE_DATE_EPOCH, archive des sources, dernier commit) : voir BUILD.md */
function buildStamp(mode: string): string {
  // En développement, l'heure réelle du build permet de vérifier quelle version tourne dans un onglet
  if (mode !== 'production') return new Date().toISOString();
  return resolveBuildStamp({
    epochEnv: process.env.SOURCE_DATE_EPOCH,
    epochFile: readOrNull(() => readFileSync('.source-date-epoch', 'utf8')),
    gitCommitEpoch: readOrNull(() => execFileSync('git', [...GIT_COMMIT_EPOCH_ARGS], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })),
    now: new Date(),
  });
}

/** Builds de développement : `version_name` « 2.3.1-dev · 3c8ec4f » (src/build/dev-version.ts) ; production inchangée */
function withDevVersionName<M extends { version: string }>(built: M, mode: string): M {
  if (mode === 'production') return built;
  const git = (args: readonly string[]): string | null => readOrNull(() => execFileSync('git', [...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }));
  const sha = git(GIT_SHORT_SHA_ARGS)?.trim() ?? '';
  // `git diff --quiet` sort en erreur (code 1) si des fichiers suivis sont modifiés
  const clean = git(GIT_DIRTY_ARGS) !== null;
  return { ...built, version_name: devVersionName(built.version, sha ? { sha, dirty: !clean } : null) };
}

/**
 * Manifeste généré identique d'un build à l'autre (ordre des scripts `?script`), scripts enregistrés de chaque plateforme
 * optionnelle exposés à cette seule plateforme (crxjs les réunit sous l'union des motifs), et scripts injectés par une page
 * de l'extension (lecteurs de l'historique) exposés à aucun site : voir src/build/output-names.ts
 */
const sortedWebAccessibleResources: CrxPlugin = {
  name: 'synckai:sorted-web-accessible-resources',
  enforce: 'post',
  renderCrxManifest(generated) {
    if (generated.web_accessible_resources) {
      generated.web_accessible_resources = sortWebAccessibleResources(splitRegisteredScripts(dropExtensionInjectedScripts(generated.web_accessible_resources)));
    }
    return generated;
  },
};

/**
 * Intermédiaires de crxjs retirés du paquet (2-H) : chunk du build principal de chaque script `*.iife.ts`, construit à part en
 * IIFE autonome, et chunks qu'il est seul à importer ; personne ne les charge (src/build/output-names.ts, verify-build refuse
 * tout fichier que rien ne référence). Après le plugin IIFE de crxjs (`enforce: 'post'`, placé après crx())
 */
const dropCrxIifeIntermediates: Plugin = {
  name: 'synckai:drop-crx-iife-intermediates',
  apply: 'build',
  enforce: 'post',
  generateBundle(_options, bundle) {
    for (const name of crxIifeIntermediates(bundle)) Reflect.deleteProperty(bundle, name);
  },
};

export default defineConfig(({ mode }) => ({
  // Après crx() : renderCrxManifest est appelé dans l'ordre des plugins, une fois les ressources calculées
  plugins: [tailwindcss(), crx({ manifest: withDevVersionName(targetManifest(manifest, target), mode), browser: target }), sortedWebAccessibleResources, dropCrxIifeIntermediates],
  build: {
    outDir: targetOutDir(target),
    rollupOptions: {
      // Pages d'extension hors manifeste (ouvertes via chrome.runtime.getURL). Panneau latéral : crxjs le
      // construit d'après `side_panel` (Chrome) mais ignore `sidebar_action` (Firefox) → entrée explicite
      input: {
        import: 'src/import/import.html',
        'import-cr': 'src/import-cr/import-cr.html',
        ...(target === 'firefox' ? { sidepanel: 'src/sidepanel/sidepanel.html' } : {}),
      },
      // Chunk du service worker à nom fixe : son hash dépendait du chemin absolu du projet (src/build/output-names.ts).
      // Les deux options : Rolldown nomme les entrées émises par crxjs (service worker, scripts) via chunkFileNames.
      // Catalogues de traduction chargés à la demande (i18n/index.ts) : assets/locales/<code>.json
      output: { entryFileNames: jsFileName, chunkFileNames: jsFileName, assetFileNames: assetFileName },
    },
  },
  define: {
    // Horodatage du build, loggé au démarrage pour vérifier quelle version tourne dans un onglet
    __SYNCKAI_BUILD__: JSON.stringify(buildStamp(mode)),
    // Logs debug/info : actifs hors production (`npm run dev`, `npm run build:dev`)
    __SYNCKAI_DEBUG__: JSON.stringify(mode !== 'production'),
    // Navigateur cible (chrome | firefox) : différences d'API (boutons de notification…)
    __SYNCKAI_TARGET__: JSON.stringify(target),
    // Textes des scripts de contenu (src/i18n/content.ts) : leurs seules clés, en anglais (autres langues demandées au
    // service worker), pas les catalogues complets (PERF-01). Hérité par le build séparé des scripts Netflix et Disney+
    // (`*.iife.ts`), contrairement aux plugins
    __SYNCKAI_CONTENT_CATALOGS__: contentCatalogsDefine(en),
  },
}));
