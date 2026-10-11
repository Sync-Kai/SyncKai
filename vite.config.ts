import { crx, type CrxPlugin } from '@crxjs/vite-plugin';
import tailwindcss from '@tailwindcss/vite';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';
import manifest from './manifest.json';
import { GIT_COMMIT_EPOCH_ARGS, resolveBuildStamp } from './src/build/build-stamp';
import { parseBuildTarget, targetManifest, targetOutDir } from './src/build/manifest-target';
import { jsFileNames, sortWebAccessibleResources } from './src/build/output-names';

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

/** Manifeste généré identique d'un build à l'autre (ordre des scripts `?script`) : voir src/build/output-names.ts */
const sortedWebAccessibleResources: CrxPlugin = {
  name: 'synckai:sorted-web-accessible-resources',
  enforce: 'post',
  renderCrxManifest(generated) {
    if (generated.web_accessible_resources) generated.web_accessible_resources = sortWebAccessibleResources(generated.web_accessible_resources);
    return generated;
  },
};

export default defineConfig(({ mode }) => ({
  // Après crx() : renderCrxManifest est appelé dans l'ordre des plugins, une fois les ressources calculées
  plugins: [tailwindcss(), crx({ manifest: targetManifest(manifest, target), browser: target }), sortedWebAccessibleResources],
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
      // Les deux options : Rolldown nomme les entrées émises par crxjs (service worker, scripts) via chunkFileNames
      output: { entryFileNames: jsFileName, chunkFileNames: jsFileName },
    },
  },
  define: {
    // Horodatage du build, loggé au démarrage pour vérifier quelle version tourne dans un onglet
    __SYNCKAI_BUILD__: JSON.stringify(buildStamp(mode)),
    // Logs debug/info : actifs hors production (`npm run dev`, `npm run build:dev`)
    __SYNCKAI_DEBUG__: JSON.stringify(mode !== 'production'),
    // Navigateur cible (chrome | firefox) : différences d'API (boutons de notification…)
    __SYNCKAI_TARGET__: JSON.stringify(target),
  },
}));
