/**
 * Manifeste par navigateur cible, appliqué au build (vite.config.ts) avant le plugin crx.
 * Chrome : manifest.json tel quel. Firefox : service worker → `background.scripts`,
 * champs propres à Chrome retirés, `browser_specific_settings.gecko` ajouté.
 */

export type BuildTarget = 'chrome' | 'firefox';

export const BUILD_TARGETS: readonly BuildTarget[] = ['chrome', 'firefox'];

/** ID AMO de l'extension (identique à `FIREFOX_ADDON_ID` côté OAuth) : fixe l'URL de redirection identity */
export const FIREFOX_GECKO_ID = 'synckai@sync-kai.github.io';

/** Firefox 142 : 140 suffit sur ordinateur pour `data_collection_permissions`, mais AMO applique aussi ce minimum à
 * Firefox pour Android, qui ne le gère qu'à partir de 142 (avertissement de validation de la 1.9.0) */
export const FIREFOX_MIN_VERSION = '142.0';

/** Valeurs acceptées par AMO pour `data_collection_permissions.required` */
export type GeckoDataCollection =
  | 'none'
  | 'personallyIdentifyingInfo'
  | 'healthInfo'
  | 'financialAndPaymentInfo'
  | 'authenticationInfo'
  | 'personalCommunications'
  | 'locationInfo'
  | 'browsingActivity'
  | 'websiteContent'
  | 'websiteActivity'
  | 'searchTerms'
  | 'bookmarksInfo';

/**
 * Données transmises hors du navigateur (voir PRIVACY.md) :
 * - websiteContent : titre de la série, saison et numéro d'épisode lus sur la page Crunchyroll / ADN,
 *   envoyés à AniList / MyAnimeList (recherche de la fiche, mise à jour de la progression) ;
 * - websiteActivity : l'action « épisode regardé jusqu'au bout » sur ces sites, reportée sur la liste.
 * Pas d'authenticationInfo : aucun mot de passe ni identifiant n'est saisi ou transmis par l'extension
 * (connexion sur les pages officielles AniList / MAL, jetons OAuth renvoyés uniquement à leur émetteur).
 */
export const FIREFOX_DATA_COLLECTION: readonly GeckoDataCollection[] = ['websiteContent', 'websiteActivity'];

/** Champs du manifeste source que la cible modifie ; les autres sont recopiés tels quels */
export interface SourceManifest {
  key?: string;
  minimum_chrome_version?: string;
  background?: { service_worker: string; type?: string };
}

export interface FirefoxBackground {
  scripts: string[];
  type: 'module';
}

export interface GeckoSettings {
  gecko: {
    id: string;
    strict_min_version: string;
    data_collection_permissions: { required: GeckoDataCollection[] };
  };
}

export type FirefoxManifest<M extends SourceManifest> = Omit<M, 'key' | 'minimum_chrome_version' | 'background'> & {
  background?: FirefoxBackground;
  browser_specific_settings: GeckoSettings;
};

/** Lit la cible du build (`SYNCKAI_TARGET`) ; absente → chrome, inconnue → erreur explicite */
export function parseBuildTarget(value: string | undefined): BuildTarget {
  if (value === undefined || value === '') return 'chrome';
  const target = BUILD_TARGETS.find((candidate) => candidate === value);
  if (!target) throw new Error(`SYNCKAI_TARGET inconnu : « ${value} » (attendu : ${BUILD_TARGETS.join(', ')})`);
  return target;
}

/** Dossier de sortie du build pour une cible */
export function targetOutDir(target: BuildTarget): string {
  return target === 'firefox' ? 'dist-firefox' : 'dist';
}

export function targetManifest<M extends SourceManifest>(base: M, target: 'chrome'): M;
export function targetManifest<M extends SourceManifest>(base: M, target: 'firefox'): FirefoxManifest<M>;
export function targetManifest<M extends SourceManifest>(base: M, target: BuildTarget): M | FirefoxManifest<M>;
export function targetManifest<M extends SourceManifest>(base: M, target: BuildTarget): M | FirefoxManifest<M> {
  if (target === 'chrome') return base;

  // `key` (ID Chrome Web Store) et `minimum_chrome_version` sont propres à Chrome
  const { key: _key, minimum_chrome_version: _minChrome, background, ...rest } = base;
  return {
    ...rest,
    // Firefox n'accepte pas `service_worker` : script d'arrière-plan (event page) en module ES
    ...(background ? { background: { scripts: [background.service_worker], type: 'module' } } : {}),
    browser_specific_settings: {
      gecko: {
        id: FIREFOX_GECKO_ID,
        strict_min_version: FIREFOX_MIN_VERSION,
        data_collection_permissions: { required: [...FIREFOX_DATA_COLLECTION] },
      },
    },
  };
}
