/**
 * Vérifie l'extension construite, et pas seulement les sources (à lancer après `npm run build` / `build:firefox`) :
 * - tous les fichiers cités par le manifeste généré, les pages, les styles et les chunks existent ;
 * - `web_accessible_resources` : scripts Netflix limités à *://*.netflix.com/*, rien d'exposé à tous les sites ;
 * - `*.iife.js` : scripts classiques (aucun import ni export, aucun `import(`) ;
 * - permissions, motifs et CSP des pages identiques au manifeste source adapté à la cible ;
 * - budgets de taille des scripts de contenu (Crunchyroll / ADN, Netflix).
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
import {
  CONTENT_SCRIPT_BUDGET_BYTES,
  NETFLIX_SCRIPTS_BUDGET_BYTES,
  checkAccessDeclarations,
  checkContentSecurityPolicy,
  checkWebAccessibleResources,
  fileReferences,
  hasDynamicImport,
  manifestReferences,
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

  // 1. Références : manifeste, puis pages, styles et chunks (imports, getURL, chemins des scripts Netflix)
  const roots = manifestReferences(manifest);
  for (const ref of roots) if (!files.has(ref)) errors.push(`manifest.json → ${ref} : fichier absent`);
  for (const file of [...files].sort()) {
    for (const ref of referencesOf(file)) if (!files.has(ref)) errors.push(`${file} → ${ref} : fichier absent`);
  }

  // 2. Ressources exposées aux pages web
  errors.push(...checkWebAccessibleResources(manifest));

  // 3. Scripts Netflix : scripts classiques (le moteur refuse import/export hors module), sans chargeur ESM
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

  // 5. Budgets : chargeur du script de contenu + chunks atteignables ; scripts Netflix
  const contentFiles = reachableFiles(
    (manifest.content_scripts ?? []).flatMap((script) => script.js ?? []),
    referencesOf,
  );
  const contentBytes = [...contentFiles].reduce((total, file) => total + size(file), 0);
  const netflixBytes = iifeFiles.reduce((total, file) => total + size(file), 0);
  if (contentBytes > CONTENT_SCRIPT_BUDGET_BYTES) {
    errors.push(`script de contenu Crunchyroll/ADN : ${kib(contentBytes)} > budget ${kib(CONTENT_SCRIPT_BUDGET_BYTES)}`);
  }
  if (netflixBytes > NETFLIX_SCRIPTS_BUDGET_BYTES) errors.push(`scripts Netflix : ${kib(netflixBytes)} > budget ${kib(NETFLIX_SCRIPTS_BUDGET_BYTES)}`);

  // Informatif : fichiers que rien ne référence (les autres langues de _locales sont lues par le navigateur)
  const used = reachableFiles(['manifest.json', ...roots], referencesOf);
  const unused = [...files].filter((file) => !used.has(file) && !file.startsWith('_locales/')).sort();

  const status = errors.length === 0 ? '✔' : '✖';
  console.log(`${status} ${outDir}/ : ${files.size} fichiers, ${roots.length} références du manifeste`);
  console.log(`  script de contenu Crunchyroll/ADN : ${kib(contentBytes)} / ${kib(CONTENT_SCRIPT_BUDGET_BYTES)} (${contentFiles.size} fichiers)`);
  console.log(`  scripts Netflix : ${kib(netflixBytes)} / ${kib(NETFLIX_SCRIPTS_BUDGET_BYTES)} (${iifeFiles.join(', ')})`);
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
