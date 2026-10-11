/**
 * Contrôles du paquet construit (dist/ ou dist-firefox/), lancés par scripts/verify-build.ts après le build.
 * Fonctions pures (aucun accès disque), testées par build-checks.test.ts. Elles couvrent les pièges propres au
 * build que les tests sur les sources ne voient pas : chargeurs crxjs, `web_accessible_resources`, IIFE Netflix et Disney+,
 * permissions réellement livrées, poids des scripts de contenu.
 */
import { posix } from 'node:path';

/** Netflix : accès optionnel uniquement (voir src/shared/platforms.ts › optionalMatches) */
export const NETFLIX_PATTERN = '*://*.netflix.com/*';
/** Disney+ : accès optionnel uniquement (voir src/shared/platforms.ts › optionalMatches) */
export const DISNEY_PATTERN = '*://*.disneyplus.com/*';

/** Plateformes à accès optionnel : dossier de leurs scripts enregistrés (`src/content/{dossier}/*.iife.js`), libellé, motif */
export const OPTIONAL_PLATFORMS: readonly { dir: string; label: string; pattern: string }[] = [
  { dir: 'netflix', label: 'Netflix', pattern: NETFLIX_PATTERN },
  { dir: 'disney', label: 'Disney+', pattern: DISNEY_PATTERN },
];

/**
 * Budget du script de contenu Crunchyroll / ADN : chargeur + tous les chunks qu'il charge (imports statiques et
 * dynamiques). Mesuré à 75,6 Ko au 2026-10-11 (PERF-01 : 267 Ko avec les catalogues i18n complets, 129,5 Ko avec
 * les seules clés du contenu, puis gardes des messages, icônes, écritures des exclusions et descripteurs des plateformes
 * sortis du graphe du contenu, voir architecture.test.ts) : ~10 % de marge.
 */
export const CONTENT_SCRIPT_BUDGET_BYTES = 83 * 1024;

/** Budget des deux scripts Netflix (IIFE autonomes, clés i18n du contenu comprises) : 59,4 Ko mesurés au 2026-10-11, ~10 % de marge */
export const NETFLIX_SCRIPTS_BUDGET_BYTES = 65 * 1024;

/** Budget des deux scripts Disney+ (IIFE autonomes, clés i18n du contenu comprises) : 63,9 Ko mesurés au 2026-10-11 (journal de diagnostic compris), ~10 % de marge */
export const DISNEY_SCRIPTS_BUDGET_BYTES = 70 * 1024;

/** Plateforme (dossier) d'un script enregistré `src/content/{dossier}/….iife.js`, null sinon */
export function registeredScriptPlatform(file: string): string | null {
  const dir = /^src\/content\/([a-z0-9-]+)\/[^/]+\.iife\.js$/.exec(file)?.[1];
  return OPTIONAL_PLATFORMS.find((platform) => platform.dir === dir)?.dir ?? null;
}

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
  content_security_policy?: { extension_pages?: string };
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
 * `web_accessible_resources` : aucune ressource exposée à tous les sites, aucun repère crxjs restant, et les scripts
 * enregistrés de chaque plateforme optionnelle (`src/content/{netflix,disney}/*.iife.js`) exposés à cette seule
 * plateforme, dans une entrée qui ne contient qu'eux.
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
    for (const platform of OPTIONAL_PLATFORMS) {
      const own = iife.filter((file) => registeredScriptPlatform(file) === platform.dir);
      if (own.length === 0) continue;
      if (JSON.stringify(entry.matches ?? []) !== JSON.stringify([platform.pattern])) {
        errors.push(`web_accessible_resources ${label} : scripts ${platform.label} (${own.join(', ')}) exposés hors de ${platform.pattern}`);
      }
      if (own.length !== entry.resources.length) errors.push(`web_accessible_resources ${label} : entrée ${platform.label} mêlée à d'autres ressources`);
    }
    const unknown = iife.filter((file) => registeredScriptPlatform(file) === null);
    if (unknown.length > 0) errors.push(`web_accessible_resources ${label} : scripts sans plateforme connue (${unknown.join(', ')})`);
  }
  for (const platform of OPTIONAL_PLATFORMS) {
    if (!entries.some((entry) => entry.resources.some((file) => registeredScriptPlatform(file) === platform.dir))) {
      errors.push(`web_accessible_resources : scripts ${platform.label} (*.iife.js) absents`);
    }
  }
  return errors;
}

/**
 * Permissions et motifs livrés identiques au manifeste source adapté à la cible (aucun ajout par le plugin),
 * Netflix et Disney+ en accès optionnel uniquement (jamais dans host_permissions ni content_scripts : Chrome désactiverait
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

  for (const { pattern } of OPTIONAL_PLATFORMS) {
    if (built.host_permissions?.includes(pattern)) errors.push(`${pattern} dans host_permissions`);
    if ((built.content_scripts ?? []).some((script) => script.matches?.includes(pattern))) errors.push(`${pattern} dans content_scripts`);
    if (!built.optional_host_permissions?.includes(pattern)) errors.push(`${pattern} absent de optional_host_permissions`);
  }
  return errors;
}

/**
 * CSP des pages de l'extension (SEC-02) : présente et identique au manifeste source (le build ne doit ni la retirer ni
 * l'élargir). Ce n'est pas une permission : rien à justifier sur le Chrome Web Store.
 */
export function checkContentSecurityPolicy(built: BuiltManifest, expected: BuiltManifest): string[] {
  const wanted = expected.content_security_policy?.extension_pages;
  if (wanted === undefined) return ['content_security_policy.extension_pages absente du manifeste source'];
  const actual = built.content_security_policy?.extension_pages;
  if (actual !== wanted) return [`content_security_policy.extension_pages : ${JSON.stringify(actual ?? null)} ≠ manifeste source ${JSON.stringify(wanted)}`];
  return [];
}

/** Chemins du paquet cités dans des chaînes (`chrome.runtime.getURL("assets/…")`, scripts Netflix et Disney+, pages) */
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
