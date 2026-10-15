/**
 * Vérifie l'extension construite, et pas seulement les sources (à lancer après `npm run build` / `build:firefox`) :
 * - tous les fichiers cités par le manifeste généré, les pages, les styles et les chunks existent ;
 * - `web_accessible_resources` : scripts Netflix et Disney+ limités à leur plateforme, rien d'exposé à tous les sites ;
 * - `*.iife.js` : scripts classiques (aucun import ni export, aucun `import(`) ;
 * - permissions, motifs, CSP des pages et commandes clavier identiques au manifeste source adapté à la cible ;
 * - budgets de taille des scripts de contenu (Crunchyroll / ADN, pont Crunchyroll du monde MAIN, Netflix, Disney+, Prime Video,
 *   lecteurs de l'historique injectés par la page d'import) ;
 * - catalogues de traduction chargés à la demande : chaque langue hors anglais dans assets/locales/, référencée par le code ;
 * - ponts du monde MAIN : aucune API d'extension, aucun en-tête ni cookie (chaînes interdites) ; aucun marqueur de build de développement.
 *
 * Usage : npm run verify:build                        (dist/ et dist-firefox/)
 *         node scripts/verify-build.ts --target chrome|firefox
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { Script } from 'node:vm';
import { BUILD_TARGETS, parseBuildTarget, targetManifest, targetOutDir, type BuildTarget } from '../src/build/manifest-target.ts';
import { isExtensionInjectedScript, LOCALE_CATALOG_DIR } from '../src/build/output-names.ts';
import { LOCALES } from '../src/i18n/locale-codes.ts';
import {
  CONTENT_SCRIPT_BUDGET_BYTES,
  CRUNCHYROLL_BRIDGE_BUDGET_BYTES,
  DISNEY_SCRIPTS_BUDGET_BYTES,
  HISTORY_READER_BUDGET_BYTES,
  PRIME_SCRIPTS_BUDGET_BYTES,
  NETFLIX_SCRIPTS_BUDGET_BYTES,
  registeredScriptPlatform,
  checkAccessDeclarations,
  checkCommands,
  checkContentSecurityPolicy,
  checkLocaleCatalogs,
  checkMainWorldBridge,
  checkNoDevMarkers,
  isMainWorldBridge,
  localeCatalogFiles,
  checkWebAccessibleResources,
  fileReferences,
  hasDynamicImport,
  manifestReferences,
  manifestScriptFiles,
  reachableFiles,
  type BuiltManifest,
} from './build-checks.ts';

interface SourceManifest extends BuiltManifest {
  version: string;
  background: { service_worker: string; type?: string };
  side_panel?: { default_path: string };
}

const ROOT = fileURLToPath(new URL('..', import.meta.url));

function listFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? listFiles(path) : [path];
  });
}

const kib = (bytes: number): string => `${(bytes / 1024).toFixed(1)} Ko`;

/** Vérifie un paquet ; retourne la liste des erreurs (vide = conforme) */
function verifyTarget(target: BuildTarget, source: SourceManifest): string[] {
  const outDir = targetOutDir(target);
  const dist = join(ROOT, outDir);
  let manifest: BuiltManifest;
  try {
    manifest = JSON.parse(readFileSync(join(dist, 'manifest.json'), 'utf8')) as BuiltManifest;
  } catch {
    return [`${outDir}/manifest.json introuvable : lancez \`npm run ${target === 'firefox' ? 'build:firefox' : 'build'}\``];
  }

  const files = new Set(listFiles(dist).map((file) => relative(dist, file).split(sep).join('/')));
  const contents = new Map<string, string>();
  const read = (file: string): string => {
    const cached = contents.get(file);
    if (cached !== undefined) return cached;
    const content = readFileSync(join(dist, file), 'utf8');
    contents.set(file, content);
    return content;
  };
  const referencesOf = (file: string): string[] => (files.has(file) && /\.(js|html|css)$/.test(file) ? fileReferences(file, read(file)) : []);
  const size = (file: string): number => (files.has(file) ? statSync(join(dist, file)).size : 0);

  const errors: string[] = [];

  if (manifest.version !== source.version) errors.push(`version ${manifest.version ?? '?'} ≠ manifest.json ${source.version}`);

  // 1. Références : manifeste, puis pages, styles et chunks (imports, getURL, chemins des scripts enregistrés)
  const roots = manifestReferences(manifest);
  for (const ref of roots) if (!files.has(ref)) errors.push(`manifest.json → ${ref} : fichier absent`);
  for (const file of [...files].sort()) {
    for (const ref of referencesOf(file)) if (!files.has(ref)) errors.push(`${file} → ${ref} : fichier absent`);
  }

  // 2. Ressources exposées aux pages web
  errors.push(...checkWebAccessibleResources(manifest));

  // 3. Scripts Netflix et Disney+ : scripts classiques (le moteur refuse import/export hors module), sans chargeur ESM
  const iifeFiles = [...files].filter((file) => file.endsWith('.iife.js')).sort();
  for (const file of iifeFiles) {
    try {
      new Script(read(file), { filename: file });
    } catch (error: unknown) {
      errors.push(`${file} : script classique invalide (import/export au niveau supérieur ?) : ${error instanceof Error ? error.message : String(error)}`);
    }
    if (hasDynamicImport(read(file))) errors.push(`${file} : import() dynamique (chargeur ESM, cassé en monde MAIN)`);
  }

  // 4. Permissions livrées = manifeste source adapté à la cible
  errors.push(...checkAccessDeclarations(manifest, targetManifest(source, target)));
  errors.push(...checkContentSecurityPolicy(manifest, targetManifest(source, target)));
  errors.push(...checkCommands(manifest, targetManifest(source, target), target));

  // 5. Budgets : chargeur du script de contenu + chunks atteignables ; scripts de chaque plateforme optionnelle
  // Pont Crunchyroll du monde MAIN (manifeste) : budget à part, comme les scripts des plateformes optionnelles
  const contentFiles = reachableFiles(manifestScriptFiles(manifest, 'ISOLATED'), referencesOf);
  const contentBytes = [...contentFiles].reduce((total, file) => total + size(file), 0);
  const bridgeFiles = reachableFiles(manifestScriptFiles(manifest, 'MAIN'), referencesOf);
  const bridgeBytes = [...bridgeFiles].reduce((total, file) => total + size(file), 0);
  const platformBytes = (dir: string): number => iifeFiles.filter((file) => registeredScriptPlatform(file) === dir).reduce((total, file) => total + size(file), 0);
  const netflixBytes = platformBytes('netflix');
  const disneyBytes = platformBytes('disney');
  const primeBytes = platformBytes('prime');
  // Lecteurs de l'historique injectés par la page d'import (IIFE autonome, hors du script du manifeste)
  const historyFiles = iifeFiles.filter(isExtensionInjectedScript);
  const historyBytes = historyFiles.reduce((total, file) => total + size(file), 0);
  if (historyFiles.length === 0) errors.push('lecteurs de l’historique (src/content/history/*.iife.js) absents');
  if (historyBytes > HISTORY_READER_BUDGET_BYTES) errors.push(`lecteurs de l’historique : ${kib(historyBytes)} > budget ${kib(HISTORY_READER_BUDGET_BYTES)}`);
  if (contentBytes > CONTENT_SCRIPT_BUDGET_BYTES) {
    errors.push(`script de contenu Crunchyroll/ADN : ${kib(contentBytes)} > budget ${kib(CONTENT_SCRIPT_BUDGET_BYTES)}`);
  }
  if (bridgeBytes > CRUNCHYROLL_BRIDGE_BUDGET_BYTES) errors.push(`pont Crunchyroll (monde MAIN) : ${kib(bridgeBytes)} > budget ${kib(CRUNCHYROLL_BRIDGE_BUDGET_BYTES)}`);
  if (netflixBytes > NETFLIX_SCRIPTS_BUDGET_BYTES) errors.push(`scripts Netflix : ${kib(netflixBytes)} > budget ${kib(NETFLIX_SCRIPTS_BUDGET_BYTES)}`);
  if (disneyBytes > DISNEY_SCRIPTS_BUDGET_BYTES) errors.push(`scripts Disney+ : ${kib(disneyBytes)} > budget ${kib(DISNEY_SCRIPTS_BUDGET_BYTES)}`);
  if (primeBytes > PRIME_SCRIPTS_BUDGET_BYTES) errors.push(`scripts Prime Video : ${kib(primeBytes)} > budget ${kib(PRIME_SCRIPTS_BUDGET_BYTES)}`);

  // 6. Catalogues de traduction : référencés par le code des pages et du service worker (chemins émis par Vite)
  const used = reachableFiles(['manifest.json', ...roots], referencesOf);
  const catalogSources = new Map(
    LOCALES.filter((locale) => locale !== 'en').map((locale) => [locale, readFileSync(join(ROOT, 'src/i18n/locales', `${locale}.json`), 'utf8')]),
  );
  errors.push(...checkLocaleCatalogs(files, used, catalogSources, read));
  const catalogFiles = localeCatalogFiles(files);
  const catalogBytes = catalogFiles.reduce((total, file) => total + size(file), 0);

  // 7. Ponts du monde MAIN sans API d'extension ni accès aux en-têtes, cookies ou stockages ; aucun marqueur de build de développement
  for (const file of [...files].sort()) {
    if (isMainWorldBridge(file)) errors.push(...checkMainWorldBridge(file, read(file)));
    if (file.endsWith('.js')) errors.push(...checkNoDevMarkers(file, read(file)));
  }

  // Informatif : fichiers que rien ne référence (les autres langues de _locales sont lues par le navigateur)
  const unused = [...files].filter((file) => !used.has(file) && !file.startsWith('_locales/')).sort();

  const status = errors.length === 0 ? '✔' : '✖';
  console.log(`${status} ${outDir}/ : ${files.size} fichiers, ${roots.length} références du manifeste`);
  console.log(`  script de contenu Crunchyroll/ADN : ${kib(contentBytes)} / ${kib(CONTENT_SCRIPT_BUDGET_BYTES)} (${contentFiles.size} fichiers)`);
  console.log(`  pont Crunchyroll (monde MAIN) : ${kib(bridgeBytes)} / ${kib(CRUNCHYROLL_BRIDGE_BUDGET_BYTES)} (${[...bridgeFiles].join(', ')})`);
  const listOf = (dir: string): string => iifeFiles.filter((file) => registeredScriptPlatform(file) === dir).join(', ');
  console.log(`  scripts Netflix : ${kib(netflixBytes)} / ${kib(NETFLIX_SCRIPTS_BUDGET_BYTES)} (${listOf('netflix')})`);
  console.log(`  scripts Disney+ : ${kib(disneyBytes)} / ${kib(DISNEY_SCRIPTS_BUDGET_BYTES)} (${listOf('disney')})`);
  console.log(`  scripts Prime Video : ${kib(primeBytes)} / ${kib(PRIME_SCRIPTS_BUDGET_BYTES)} (${listOf('prime')})`);
  console.log(`  lecteurs de l’historique (injectés par la page d’import) : ${kib(historyBytes)} / ${kib(HISTORY_READER_BUDGET_BYTES)} (${historyFiles.join(', ')})`);
  console.log(`  catalogues de traduction : ${catalogSources.size} langues lues à la demande, ${catalogFiles.length} fichiers (${LOCALE_CATALOG_DIR}/, ${kib(catalogBytes)} ; contenus identiques regroupés), anglais embarqué`);
  if (unused.length > 0) console.log(`  non référencés (${unused.length}) : ${unused.join(', ')}`);
  return errors;
}

const { values: args } = parseArgs({ options: { target: { type: 'string' } }, strict: true });
let targets: readonly BuildTarget[];
try {
  targets = args.target === undefined ? BUILD_TARGETS : [parseBuildTarget(args.target)];
} catch (error: unknown) {
  console.error(`✖ ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}

const source = JSON.parse(readFileSync(join(ROOT, 'manifest.json'), 'utf8')) as SourceManifest;
let failed = false;
for (const target of targets) {
  const errors = verifyTarget(target, source);
  for (const error of errors) console.error(`  ✖ ${error}`);
  failed ||= errors.length > 0;
}
process.exit(failed ? 1 : 0);
