/**
 * Contrôles du paquet construit (dist/ ou dist-firefox/), lancés par scripts/verify-build.ts après le build.
 * Fonctions pures (aucun accès disque), testées par build-checks.test.ts. Elles couvrent les pièges propres au
 * build que les tests sur les sources ne voient pas : chargeurs crxjs, `web_accessible_resources`, IIFE Netflix et Disney+,
 * permissions réellement livrées, poids des scripts de contenu, catalogues de traduction émis.
 */
import { posix } from 'node:path';
import { FIREFOX_PANEL_COMMAND, firefoxMenuKeyConflicts, SOURCE_PANEL_COMMAND, type BuildTarget, type ManifestCommand } from '../src/build/manifest-target.ts';
import { isExtensionInjectedScript, LOCALE_CATALOG_DIR } from '../src/build/output-names.ts';

/** Netflix : accès optionnel uniquement (voir src/platforms/registry.ts › optionalMatches) */
export const NETFLIX_PATTERN = '*://*.netflix.com/*';
/** Disney+ : accès optionnel uniquement (voir src/platforms/registry.ts › optionalMatches) */
export const DISNEY_PATTERN = '*://*.disneyplus.com/*';
/** Prime Video : accès optionnel uniquement (voir src/platforms/registry.ts › optionalMatches) */
export const PRIME_PATTERN = '*://*.primevideo.com/*';

/** Plateformes à accès optionnel : dossier de leurs scripts enregistrés (`src/content/{dossier}/*.iife.js`), libellé, motif */
export const OPTIONAL_PLATFORMS: readonly { dir: string; label: string; pattern: string }[] = [
  { dir: 'netflix', label: 'Netflix', pattern: NETFLIX_PATTERN },
  { dir: 'disney', label: 'Disney+', pattern: DISNEY_PATTERN },
  { dir: 'prime', label: 'Prime Video', pattern: PRIME_PATTERN },
];

/**
 * Budget du script de contenu Crunchyroll du manifeste (`src/content/crunchyroll/content-crunchyroll.iife.js`, IIFE autonome,
 * plus tout fichier qu'il référencerait ; pont MAIN à part) : 54,5 Ko mesurés au 2026-10-15, ~10 % de marge. Historique :
 * script commun Crunchyroll / ADN de 267 Ko (PERF-01, catalogues i18n complets) à 58,3 Ko (IIFE autonome, journaux de
 * débogage retirés, lecteurs de l'historique injectés à la demande), puis séparé par plateforme : chaque page n'analyse
 * plus que le code de la sienne.
 */
export const CRUNCHYROLL_CONTENT_BUDGET_BYTES = 60 * 1024;

/** Budget du script de contenu ADN du manifeste (`src/content/adn/content-adn.iife.js`) : 49,0 Ko mesurés au 2026-10-15, ~10 % de marge */
export const ADN_CONTENT_BUDGET_BYTES = 54 * 1024;

/**
 * Scripts isolés du manifeste et leur budget, un par plateforme : scripts/verify-build.ts refuse un script isolé du manifeste
 * absent de cette table, et une entrée de la table absente du manifeste.
 */
export const MANIFEST_SCRIPT_BUDGETS: readonly { file: string; label: string; bytes: number }[] = [
  { file: 'src/content/crunchyroll/content-crunchyroll.iife.js', label: 'script de contenu Crunchyroll', bytes: CRUNCHYROLL_CONTENT_BUDGET_BYTES },
  { file: 'src/content/adn/content-adn.iife.js', label: 'script de contenu ADN', bytes: ADN_CONTENT_BUDGET_BYTES },
];

/** Budget des deux scripts Netflix (IIFE autonomes, clés i18n du contenu comprises) : 59,4 Ko mesurés au 2026-10-11, ~10 % de marge */
export const NETFLIX_SCRIPTS_BUDGET_BYTES = 65 * 1024;

/**
 * Budget des deux scripts Disney+ (IIFE autonomes, clés i18n du contenu comprises) : 70,0 Ko mesurés au 2026-10-11
 * (lecture, pages de série, générique de fin), ~7 % de marge. Relevé de 70 à 75 Ko le 2026-10-11 : trois fonctions
 * portées par un seul script ; au-delà, alléger (code des pages de série ou du pont) plutôt que relever encore.
 */
export const DISNEY_SCRIPTS_BUDGET_BYTES = 75 * 1024;

/**
 * Budget des deux scripts Prime Video (IIFE autonomes, clés i18n du contenu comprises) : même ordre de grandeur que
 * Disney+ (pont MAIN, lecture, pages de série, générique de fin). Au-delà, alléger plutôt que relever.
 */
export const PRIME_SCRIPTS_BUDGET_BYTES = 75 * 1024;

/**
 * Budget du pont Crunchyroll du monde MAIN (`content_scripts` à `world: "MAIN"`, IIFE autonome hors du budget du script de
 * contenu Crunchyroll) : 7,1 Ko mesurés au 2026-10-14 (relevé passif, réductions et table des signaux), ~25 % de marge.
 */
export const CRUNCHYROLL_BRIDGE_BUDGET_BYTES = 9 * 1024;

/**
 * Budget des lecteurs de l'historique Crunchyroll / ADN (`src/content/history/history.iife.js`, IIFE autonome injectée
 * par la page d'import, hors des budgets des scripts de contenu) : 14,7 Ko mesurés au 2026-10-15, ~10 % de marge.
 */
export const HISTORY_READER_BUDGET_BYTES = 16 * 1024;

/** Fichiers des scripts du manifeste d'un monde : `MAIN` (ponts de page) ou isolé (`world` absent ou `ISOLATED`) */
export function manifestScriptFiles(manifest: BuiltManifest, world: 'MAIN' | 'ISOLATED'): string[] {
  return (manifest.content_scripts ?? []).filter((script) => (script.world === 'MAIN') === (world === 'MAIN')).flatMap((script) => script.js ?? []);
}

/** Scripts isolés du manifeste sans budget dans MANIFEST_SCRIPT_BUDGETS, et budgets sans script du manifeste */
export function checkManifestScriptBudgets(manifest: BuiltManifest): string[] {
  const isolated = manifestScriptFiles(manifest, 'ISOLATED');
  return [
    ...isolated.filter((file) => !MANIFEST_SCRIPT_BUDGETS.some((budget) => budget.file === file)).map((file) => `${file} : script isolé du manifeste sans budget`),
    ...MANIFEST_SCRIPT_BUDGETS.filter((budget) => !isolated.includes(budget.file)).map((budget) => `${budget.label} (${budget.file}) absent du manifeste`),
  ];
}

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
  content_scripts?: { matches?: string[]; js?: string[]; css?: string[]; world?: string }[];
  web_accessible_resources?: { matches?: string[]; extension_ids?: string[]; resources: string[] }[];
  action?: { default_popup?: string; default_icon?: Record<string, string> };
  side_panel?: { default_path?: string };
  sidebar_action?: { default_panel?: string; default_icon?: Record<string, string> };
  options_page?: string;
  options_ui?: { page?: string };
  content_security_policy?: { extension_pages?: string };
  commands?: Record<string, ManifestCommand>;
}

/** Chrome refuse de charger une extension qui suggère plus de 4 raccourcis */
export const MAX_SUGGESTED_KEYS = 4;

/**
 * Commandes clavier : identiques au manifeste source adapté à la cible, au plus 4 touches suggérées, sans doublon par
 * plateforme. Panneau : `open-side-panel` + `side_panel` sur Chrome (service worker), `_execute_sidebar_action` +
 * `sidebar_action` sur Firefox (bascule native de la barre latérale), jamais l'une à la place de l'autre. Firefox : aucune
 * touche suggérée sur une lettre d’accès de ses menus (Alt+Maj+S ouvrait Historique, Alt+Maj+P Profils, voir manifest-target.ts).
 */
export function checkCommands(built: BuiltManifest, expected: BuiltManifest, target: BuildTarget): string[] {
  const errors: string[] = [];
  const commands = built.commands ?? {};
  const actual = JSON.stringify(commands);
  const wanted = JSON.stringify(expected.commands ?? {});
  if (actual !== wanted) errors.push(`commands : ${actual} ≠ manifeste source ${wanted}`);

  const suggested = Object.entries(commands).filter(([, command]) => command.suggested_key !== undefined);
  if (suggested.length > MAX_SUGGESTED_KEYS) errors.push(`commands : ${suggested.length} touches suggérées (Chrome en accepte ${MAX_SUGGESTED_KEYS} au plus)`);
  const seen = new Map<string, string>();
  for (const [name, command] of suggested) {
    for (const [platform, key] of Object.entries(command.suggested_key ?? {})) {
      const id = `${platform}:${key.toLowerCase()}`;
      const other = seen.get(id);
      if (other !== undefined) errors.push(`commands : ${key} (${platform}) suggérée pour ${other} et ${name}`);
      seen.set(id, name);
    }
  }

  const [wantedPanel, otherPanel] = target === 'firefox' ? [FIREFOX_PANEL_COMMAND, SOURCE_PANEL_COMMAND] : [SOURCE_PANEL_COMMAND, FIREFOX_PANEL_COMMAND];
  if (!(wantedPanel in commands)) errors.push(`commands : ${wantedPanel} absente (raccourci du panneau latéral, ${target})`);
  if (otherPanel in commands) errors.push(`commands : ${otherPanel} inattendue sur ${target}`);
  const panelDeclared = target === 'firefox' ? built.sidebar_action !== undefined : built.side_panel !== undefined;
  if (!panelDeclared) errors.push(`commands : ${wantedPanel} sans ${target === 'firefox' ? 'sidebar_action' : 'side_panel'}`);
  if (target === 'firefox') {
    for (const { command, key } of firefoxMenuKeyConflicts(commands)) errors.push(`commands : ${key} (${command}) ouvre un menu de Firefox (lettre d’accès)`);
  }
  return errors;
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
 * `web_accessible_resources` : aucune ressource exposée à tous les sites ni aux sites des scripts du manifeste (Crunchyroll,
 * ADN : leurs scripts sont des IIFE autonomes, sans chargeur ; une ressource exposée permettrait à la page de détecter
 * l'extension, SEC-09), aucun repère crxjs restant, les scripts enregistrés de chaque plateforme optionnelle
 * (`src/content/{netflix,disney}/*.iife.js`) exposés à cette seule plateforme, dans une entrée qui ne contient qu'eux, et
 * jamais les scripts injectés par une page de l'extension (lecteurs de l'historique, `src/content/history/`).
 */
export function checkWebAccessibleResources(manifest: BuiltManifest): string[] {
  const errors: string[] = [];
  const entries = manifest.web_accessible_resources ?? [];
  const scriptHosts = new Set((manifest.content_scripts ?? []).flatMap((script) => script.matches ?? []));
  for (const entry of entries) {
    const label = JSON.stringify(entry.matches ?? entry.extension_ids ?? []);
    if ((entry.matches ?? []).some(isAllSites)) errors.push(`web_accessible_resources ${label} : ressources exposées à tous les sites`);
    const exposed = (entry.matches ?? []).filter((pattern) => scriptHosts.has(pattern));
    if (exposed.length > 0) errors.push(`web_accessible_resources ${label} : ressources exposées aux sites des scripts du manifeste (${exposed.join(', ')})`);
    for (const resource of entry.resources) {
      if (resource.includes('<') || resource.includes('*')) errors.push(`web_accessible_resources ${label} : ressource non résolue « ${resource} »`);
    }
    const injected = entry.resources.filter(isExtensionInjectedScript);
    if (injected.length > 0) errors.push(`web_accessible_resources ${label} : scripts injectés par l'extension exposés aux sites (${injected.join(', ')})`);
    const iife = entry.resources.filter((file) => isIife(file) && !isExtensionInjectedScript(file));
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

/** Catalogues de traduction du paquet (`assets/locales/*.json`), triés */
export function localeCatalogFiles(files: ReadonlySet<string>): string[] {
  return [...files].filter((file) => file.startsWith(`${LOCALE_CATALOG_DIR}/`) && file.endsWith('.json')).sort();
}

/**
 * Catalogues de traduction chargés à la demande (src/i18n/index.ts) : chaque catalogue source hors anglais (`sources` :
 * langue → contenu de src/i18n/locales/<langue>.json) est dans `assets/locales/`, octet pour octet, dans un fichier
 * référencé par le code (chemin émis par Vite). Rolldown regroupe les fichiers de contenu identique (deux catalogues
 * identiques) : une langue peut être servie par le fichier d'une autre. Ni `en.json` (anglais embarqué dans le code),
 * ni fichier sans catalogue source.
 */
export function checkLocaleCatalogs(
  files: ReadonlySet<string>,
  referenced: ReadonlySet<string>,
  sources: ReadonlyMap<string, string>,
  read: (file: string) => string,
): string[] {
  const errors: string[] = [];
  const emitted = localeCatalogFiles(files);
  const byContent = new Map<string, string[]>();
  for (const file of emitted) byContent.set(read(file), [...(byContent.get(read(file)) ?? []), file]);
  for (const [locale, source] of sources) {
    const matches = byContent.get(source) ?? [];
    if (matches.length === 0) errors.push(`catalogue ${locale} absent de ${LOCALE_CATALOG_DIR}/ (contenu de src/i18n/locales/${locale}.json)`);
    else if (!matches.some((file) => referenced.has(file))) errors.push(`catalogue ${locale} (${matches.join(', ')}) jamais référencé par le code`);
  }
  const contents = new Set(sources.values());
  for (const file of emitted) {
    if (file === `${LOCALE_CATALOG_DIR}/en.json`) errors.push(`${file} : anglais dupliqué (déjà embarqué dans le code)`);
    else if (!contents.has(read(file))) errors.push(`${file} : aucun catalogue source de ce contenu`);
  }
  return errors;
}

/**
 * Appel dynamique `import(` : interdit dans les IIFE (chargeur ESM crxjs, cassé en monde MAIN). Sans espace avant la
 * parenthèse, comme dans le code produit : les textes i18n (« import (new tab) ») ne déclenchent pas d'alerte.
 */
export function hasDynamicImport(code: string): boolean {
  return /\bimport\(/.test(code);
}

/** Ponts passifs du monde MAIN du paquet (`src/content/<plateforme>/page-bridge.iife.js`), scripts classiques autonomes */
export function isMainWorldBridge(file: string): boolean {
  return /^src\/content\/[a-z0-9-]+\/page-bridge\.iife\.js$/.test(file);
}

/**
 * Chaînes interdites dans un pont du monde MAIN : API d'extension absentes de ce monde, et tout ce qui toucherait aux
 * en-têtes (jeton de l'utilisateur), aux cookies ou aux stockages de la page. Un pont lit uniquement les réponses que
 * l'application web demande elle-même (CLAUDE.md › Known pitfalls).
 */
export const MAIN_WORLD_FORBIDDEN: readonly { pattern: RegExp; label: string }[] = [
  { pattern: /\bchrome\./, label: 'chrome.' },
  { pattern: /\bbrowser\.(?:runtime|storage|tabs)/, label: 'browser.' },
  { pattern: /getResponseHeader|getAllResponseHeaders/, label: 'lecture d’en-têtes de réponse' },
  { pattern: /setRequestHeader/, label: 'setRequestHeader' },
  { pattern: /\.headers\b/, label: '.headers' },
  { pattern: /document\.cookie/, label: 'document.cookie' },
  { pattern: /\b(?:localStorage|sessionStorage|indexedDB)\b/, label: 'stockage de la page' },
];

/** Erreurs d'un pont du monde MAIN qui contient une chaîne de `MAIN_WORLD_FORBIDDEN` */
export function checkMainWorldBridge(file: string, code: string): string[] {
  return MAIN_WORLD_FORBIDDEN.filter(({ pattern }) => pattern.test(code)).map(({ label }) => `${file} : « ${label} » interdit dans un pont du monde MAIN`);
}

/**
 * Marqueurs des builds de développement (`npm run build:dev`) : clé du diagnostic de rapprochement et journaux
 * `[disney]`, présents seulement sous `if (__SYNCKAI_DEBUG__)`. Ils ne doivent pas figurer dans le code publié.
 * (Les textes `settings.matchDiag.*` du catalogue anglais restent, ce sont des données.)
 */
export const DEV_ONLY_MARKERS: readonly string[] = ['debug:matchDiagnostic', '[disney]'];

/** Erreurs pour chaque fichier JS du paquet qui contient un marqueur de `DEV_ONLY_MARKERS` */
export function checkNoDevMarkers(file: string, code: string): string[] {
  return DEV_ONLY_MARKERS.filter((marker) => code.includes(marker)).map((marker) => `${file} : marqueur de build de développement « ${marker} » dans le paquet`);
}
