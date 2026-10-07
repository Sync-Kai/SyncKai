import { crx } from '@crxjs/vite-plugin';
import tailwindcss from '@tailwindcss/vite';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';
import manifest from './manifest.json';
import { resolveBuildStamp } from './src/build/build-stamp';
import { parseBuildTarget, targetManifest, targetOutDir } from './src/build/manifest-target';

// Navigateur cible : `SYNCKAI_TARGET=firefox` (npm run build:firefox), chrome par défaut.
// Pas de `--mode firefox` : le mode pilote __SYNCKAI_DEBUG__ et livrerait les logs de debug.
const target = parseBuildTarget(process.env.SYNCKAI_TARGET);

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
    gitCommitTime: readOrNull(() => execFileSync('git', ['log', '-1', '--format=%cI'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })),
    now: new Date(),
  });
}

export default defineConfig(({ mode }) => ({
  plugins: [tailwindcss(), crx({ manifest: targetManifest(manifest, target), browser: target })],
  build: {
    outDir: targetOutDir(target),
    rollupOptions: {
      // Pages d'extension hors manifeste (ouvertes via chrome.runtime.getURL)
      input: { import: 'src/import/import.html' },
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
