/**
 * Sortie du build indépendante du dossier du projet (relecture AMO : le relecteur construit ailleurs que la CI).
 *
 * Cause : crxjs remplace chaque import `?script` (src/background/platform-access.ts) par un repère
 * `import.meta.CRX_DYNAMIC_SCRIPT_<id>`, où `<id>` est un hash du chemin absolu du script. Le hash du chunk est
 * calculé sur ce code intermédiaire, avant que crxjs n'y écrive le chemin final : contenu identique, mais nom
 * `background.ts-<hash>.js` (et donc `service-worker-loader.js`) différent d'un dossier à l'autre.
 * Correctif : nom fixe pour le chunk du service worker (le chargeur, régénéré à chaque build, l'importe par ce nom ;
 * aucun cache à invalider dans une extension). Les autres chunks gardent leur hash, indépendant du chemin.
 */

/** Nom fixe du chunk du service worker (importé par `service-worker-loader.js`) */
export const BACKGROUND_CHUNK_FILE = 'assets/background.js';

/** Nom par défaut de Vite pour les autres chunks */
export const DEFAULT_CHUNK_FILE = 'assets/[name]-[hash].js';

/** Nom par défaut de Vite pour les autres fichiers émis (styles, polices, images) */
export const DEFAULT_ASSET_FILE = 'assets/[name]-[hash][extname]';

/** Dossier des catalogues de traduction chargés à la demande : `assets/locales/<code>.json` */
export const LOCALE_CATALOG_DIR = 'assets/locales';

/** Sous-ensemble de PreRenderedAsset utilisé ici (chemins des fichiers sources de l'asset) */
export interface AssetInfo {
  originalFileNames: readonly string[];
}

/**
 * `build.rollupOptions.output.assetFileNames` : catalogues `src/i18n/locales/<code>.json` (lus par i18n/index.ts via
 * l'URL émise) à nom lisible `assets/locales/<code>.json`, sans hash : aucun cache à invalider dans une extension (voir
 * plus haut). Rolldown regroupe les fichiers de contenu identique (deux catalogues identiques) sous le nom du
 * premier : scripts/verify-build.ts vérifie chaque langue par son contenu. Autres fichiers : nom haché de Vite.
 */
export function assetFileName(asset: AssetInfo): string {
  const catalog = asset.originalFileNames.some((file) => /(?:^|\/)src\/i18n\/locales\/[^/]+\.json$/.test(file.replaceAll('\\', '/')));
  return catalog ? `${LOCALE_CATALOG_DIR}/[name][extname]` : DEFAULT_ASSET_FILE;
}

/** Sous-ensemble de PreRenderedChunk utilisé ici */
export interface ChunkInfo {
  facadeModuleId: string | null;
}

/**
 * `build.rollupOptions.output.entryFileNames` et `chunkFileNames` (Rolldown nomme les entrées émises par crxjs,
 * dont le service worker, via `chunkFileNames`). `backgroundSource` = `background.service_worker` du manifeste source.
 */
export function jsFileNames(backgroundSource: string): (chunk: ChunkInfo) => string {
  const suffix = `/${backgroundSource.replace(/^\.?\//, '')}`;
  return (chunk) => (chunk.facadeModuleId?.replaceAll('\\', '/').endsWith(suffix) ? BACKGROUND_CHUNK_FILE : DEFAULT_CHUNK_FILE);
}

/** Entrée `web_accessible_resources` (Manifest V3, par motifs ou par ID d'extension) */
export interface WebAccessibleResourceEntry {
  resources: string[];
}

/**
 * crxjs liste les scripts `?script` dans l'ordre de résolution des imports, variable d'un build à l'autre :
 * ressources triées dans chaque entrée (l'ordre est sans effet pour le navigateur), entrées laissées en place.
 */
export function sortWebAccessibleResources<E extends WebAccessibleResourceEntry>(entries: readonly E[]): E[] {
  return entries.map((entry) => ({ ...entry, resources: [...entry.resources].sort() }));
}

/**
 * Motifs d'accès de chaque plateforme optionnelle, par dossier de ses scripts enregistrés (`src/content/{dossier}/`).
 * Copie de PLATFORMS[…].optionalMatches (src/shared/platforms.ts, vérifiée par output-names.test.ts) : la configuration
 * de Vite n'importe pas le registre.
 */
export const REGISTERED_SCRIPT_MATCHES: Readonly<Record<string, readonly string[]>> = {
  netflix: ['*://*.netflix.com/*'],
  disney: ['*://*.disneyplus.com/*'],
};

/** Script enregistré d'une plateforme optionnelle (`src/content/{dossier}/….iife.js`) : son dossier, sinon null */
function registeredScriptDir(resource: string, matchesByDir: Readonly<Record<string, readonly string[]>>): string | null {
  const dir = /^src\/content\/([a-z0-9-]+)\/[^/]+\.iife\.js$/.exec(resource)?.[1];
  return dir !== undefined && Object.hasOwn(matchesByDir, dir) ? dir : null;
}

/**
 * crxjs réunit tous les scripts `?script` (`<dynamic_resource>`) dans une seule entrée, exposée à l'union des motifs :
 * les scripts Netflix seraient accessibles depuis Disney+ et inversement. Chaque plateforme reçoit ici sa propre
 * entrée, limitée à ses motifs ; les autres ressources restent dans leur entrée d'origine.
 */
export function splitRegisteredScripts<E extends WebAccessibleResourceEntry & { matches?: string[] }>(
  entries: readonly E[],
  matchesByDir: Readonly<Record<string, readonly string[]>> = REGISTERED_SCRIPT_MATCHES,
): E[] {
  return entries.flatMap((entry) => {
    const byDir = new Map<string, string[]>();
    const others: string[] = [];
    for (const resource of entry.resources) {
      const dir = registeredScriptDir(resource, matchesByDir);
      if (dir === null) others.push(resource);
      else byDir.set(dir, [...(byDir.get(dir) ?? []), resource]);
    }
    if (byDir.size === 0) return [entry];
    const split = [...byDir.entries()].map(([dir, resources]) => ({ ...entry, matches: [...(matchesByDir[dir] ?? [])], resources }));
    return others.length > 0 ? [{ ...entry, resources: others }, ...split] : split;
  });
}
