/**
 * Contrôles du paquet construit (dist/ ou dist-firefox/), lancés par scripts/verify-build.ts après le build.
 * Fonctions pures (aucun accès disque), testées par build-checks.test.ts. Elles couvrent les pièges propres au
 * build que les tests sur les sources ne voient pas : chargeurs crxjs, `web_accessible_resources`, IIFE Netflix,
 * permissions réellement livrées, poids des scripts de contenu.
 */
import { posix } from 'node:path';

/** Netflix : accès optionnel uniquement (voir src/shared/target-pages.ts › NETFLIX_MATCHES) */
export const NETFLIX_PATTERN = '*://*.netflix.com/*';

/**
 * Budget du script de contenu Crunchyroll / ADN : chargeur + tous les chunks qu'il charge (imports statiques et
 * dynamiques). Mesuré à 253,5 Ko au 2026-10-11 (2.1.0), dont ~150 Ko de catalogues i18n (les trois langues) :
 * ~10 % de marge, sous le plafond de 300 Ko de l'audit. À resserrer quand il ne chargera plus que la langue active.
 */
export const CONTENT_SCRIPT_BUDGET_BYTES = 280 * 1024;

/** Budget des deux scripts Netflix (IIFE autonomes, i18n compris) : 198 Ko mesurés au 2026-10-11, ~10 % de marge */
export const NETFLIX_SCRIPTS_BUDGET_BYTES = 220 * 1024;

/** Champs du manifeste généré lus par les contrôles */
export interface BuiltManifest {
  version?: string;
  default_locale?: string;
  icons?: Record<string, string>;
  permissions?: string[];
  optional_permissions?: string[];
  host_permissions?: string[];
  optional_host_permissions?: string[];
  background?: { service_worker?: string; scripts?: string[] };
  content_scripts?: { matches?: string[]; js?: string[]; css?: string[] }[];
  web_accessible_resources?: { matches?: string[]; extension_ids?: string[]; resources: string[] }[];
  action?: { default_popup?: string; default_icon?: Record<string, string> };
  side_panel?: { default_path?: string };
  sidebar_action?: { default_panel?: string; default_icon?: Record<string, string> };
  options_page?: string;
  options_ui?: { page?: string };
}

/** Champs d'accès comparés au manifeste source (après adaptation à la cible) */
const ACCESS_FIELDS = ['permissions', 'optional_permissions', 'host_permissions', 'optional_host_permissions'] as const;

const isIife = (file: string): boolean => file.endsWith('.iife.js');

/** Fichiers du paquet cités par le manifeste (chemins relatifs à la racine du paquet) */
export function manifestReferences(manifest: BuiltManifest): string[] {
  const refs = [
    ...Object.values(manifest.icons ?? {}),
    ...Object.values(manifest.action?.default_icon ?? {}),
    ...Object.values(manifest.sidebar_action?.default_icon ?? {}),
    manifest.action?.default_popup,
    manifest.side_panel?.default_path,
    manifest.sidebar_action?.default_panel,
    manifest.options_page,
    manifest.options_ui?.page,
    manifest.background?.service_worker,
    ...(manifest.background?.scripts ?? []),
    ...(manifest.content_scripts ?? []).flatMap((script) => [...(script.js ?? []), ...(script.css ?? [])]),
    // Motifs (`*`) exclus : seuls les chemins exacts sont vérifiables
    ...(manifest.web_accessible_resources ?? []).flatMap((entry) => entry.resources.filter((resource) => !resource.includes('*'))),
    manifest.default_locale ? `_locales/${manifest.default_locale}/messages.json` : undefined,
  ];
  return [...new Set(refs.filter((ref): ref is string => typeof ref === 'string' && ref !== ''))].map((ref) => ref.replace(/^\//, ''));
}

/** Motif ouvert à tous les sites (`<all_urls>`, `*://*\/*`, `https://*\/*`…) */
function isAllSites(pattern: string): boolean {
  return pattern === '<all_urls>' || /^[^:]+:\/\/\*\//.test(pattern);
}

/**
 * `web_accessible_resources` : aucune ressource exposée à tous les sites, aucun repère crxjs restant, et les deux
 * scripts Netflix (`*.iife.js`) exposés à Netflix seul, dans une entrée qui ne contient qu'eux.
 */
export function checkWebAccessibleResources(manifest: BuiltManifest): string[] {
  const errors: string[] = [];
  const entries = manifest.web_accessible_resources ?? [];
  for (const entry of entries) {
    const label = JSON.stringify(entry.matches ?? entry.extension_ids ?? []);
    if ((entry.matches ?? []).some(isAllSites)) errors.push(`web_accessible_resources ${label} : ressources exposées à tous les sites`);
    for (const resource of entry.resources) {
      if (resource.includes('<') || resource.includes('*')) errors.push(`web_accessible_resources ${label} : ressource non résolue « ${resource} »`);
    }
    const iife = entry.resources.filter(isIife);
    if (iife.length === 0) continue;
    if (JSON.stringify(entry.matches ?? []) !== JSON.stringify([NETFLIX_PATTERN])) {
      errors.push(`web_accessible_resources ${label} : scripts Netflix (${iife.join(', ')}) exposés hors de ${NETFLIX_PATTERN}`);
    }
    if (iife.length !== entry.resources.length) errors.push(`web_accessible_resources ${label} : entrée Netflix mêlée à d'autres ressources`);
  }
  if (!entries.some((entry) => entry.resources.some(isIife))) errors.push('web_accessible_resources : scripts Netflix (*.iife.js) absents');
  return errors;
}

/**
 * Permissions et motifs livrés identiques au manifeste source adapté à la cible (aucun ajout par le plugin),
 * Netflix en accès optionnel uniquement (jamais dans host_permissions ni content_scripts : Chrome désactiverait
 * l'extension à la mise à jour).
 */
export function checkAccessDeclarations(built: BuiltManifest, expected: BuiltManifest): string[] {
  const errors: string[] = [];
  for (const field of ACCESS_FIELDS) {
    const actual = JSON.stringify(built[field] ?? []);
    const wanted = JSON.stringify(expected[field] ?? []);
    if (actual !== wanted) errors.push(`${field} : ${actual} ≠ manifeste source ${wanted}`);
  }
  const matches = (manifest: BuiltManifest): string => JSON.stringify((manifest.content_scripts ?? []).map((script) => script.matches ?? []));
  if (matches(built) !== matches(expected)) errors.push(`content_scripts.matches : ${matches(built)} ≠ manifeste source ${matches(expected)}`);

  if (built.host_permissions?.includes(NETFLIX_PATTERN)) errors.push(`${NETFLIX_PATTERN} dans host_permissions`);
  if ((built.content_scripts ?? []).some((script) => script.matches?.includes(NETFLIX_PATTERN))) errors.push(`${NETFLIX_PATTERN} dans content_scripts`);
  if (!built.optional_host_permissions?.includes(NETFLIX_PATTERN)) errors.push(`${NETFLIX_PATTERN} absent de optional_host_permissions`);
  return errors;
}

/** Chemins du paquet cités dans des chaînes (`chrome.runtime.getURL("assets/…")`, scripts Netflix, pages) */
const PACKAGE_PATH = /(["'`])\/?((?:assets|src|icons|brands|_locales)\/[\w.@/-]*\.(?:js|css|html|json|png|svg|woff2?))\1/g;
/** Imports relatifs ES (`from"./x.js"`, `import"./x.js"`, `import("./x.js")`) */
const RELATIVE_IMPORT = /\b(?:from|import)\s*\(?\s*(["'`])(\.{1,2}\/[^"'`\s]+)\1/g;
const HTML_ATTRIBUTE = /\b(?:src|href)\s*=\s*"([^"]+)"/g;
const CSS_URL = /url\(\s*["']?([^"')]+)["']?\s*\)/g;

/** Résout une référence trouvée dans `fromFile` en chemin du paquet ; null pour une URL externe ou une ancre */
function resolveReference(fromFile: string, ref: string): string | null {
  const path = ref.split(/[?#]/)[0] ?? '';
  if (path === '' || /^[a-z][a-z0-9+.-]*:/i.test(path) || path.startsWith('//')) return null;
  if (path.startsWith('/')) return posix.normalize(path.slice(1));
  return posix.normalize(posix.join(posix.dirname(fromFile), path));
}

/** Fichiers du paquet référencés par un fichier JS, HTML ou CSS (chemins relatifs à la racine du paquet) */
export function fileReferences(file: string, content: string): string[] {
  const refs = new Set<string>();
  const add = (ref: string | undefined, relativeTo: string = file): void => {
    const resolved = ref === undefined ? null : resolveReference(relativeTo, ref);
    if (resolved !== null) refs.add(resolved);
  };
  if (file.endsWith('.js')) {
    for (const match of content.matchAll(RELATIVE_IMPORT)) add(match[2]);
    for (const match of content.matchAll(PACKAGE_PATH)) add(`/${match[2] ?? ''}`);
  } else if (file.endsWith('.html')) {
    for (const match of content.matchAll(HTML_ATTRIBUTE)) add(match[1]);
  } else if (file.endsWith('.css')) {
    for (const match of content.matchAll(CSS_URL)) add(match[1]);
  }
  return [...refs].sort();
}

/** Fermeture des références depuis `starts` (les fichiers absents sont ignorés : signalés par ailleurs) */
export function reachableFiles(starts: readonly string[], referencesOf: (file: string) => readonly string[]): Set<string> {
  const seen = new Set<string>();
  const queue = [...starts];
  for (let file = queue.shift(); file !== undefined; file = queue.shift()) {
    if (seen.has(file)) continue;
    seen.add(file);
    queue.push(...referencesOf(file));
  }
  return seen;
}

/**
 * Appel dynamique `import(` : interdit dans les IIFE (chargeur ESM crxjs, cassé en monde MAIN). Sans espace avant la
 * parenthèse, comme dans le code produit : les textes i18n (« import (new tab) ») ne déclenchent pas d'alerte.
 */
export function hasDynamicImport(code: string): boolean {
  return /\bimport\(/.test(code);
}
