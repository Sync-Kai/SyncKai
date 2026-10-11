/**
 * Sortie du build indépendante du dossier du projet (relecture AMO : le relecteur construit ailleurs que la CI).
 *
 * Cause : crxjs remplace chaque import `?script` (src/background/netflix-access.ts) par un repère
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
