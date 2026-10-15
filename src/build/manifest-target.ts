/**
 * Manifeste par navigateur cible, appliqué au build (vite.config.ts) avant le plugin crx.
 * Chrome : manifest.json tel quel. Firefox : service worker → `background.scripts`,
 * champs propres à Chrome retirés, `browser_specific_settings.gecko` ajouté, panneau latéral Chrome
 * (`side_panel` + permission `sidePanel`) remplacé par la barre latérale Firefox (`sidebar_action`), commande
 * « Ouvrir le panneau latéral » remplacée par la commande native `_execute_sidebar_action` (même touche suggérée).
 * Touches suggérées identiques sur les deux cibles (voir SUGGESTED_KEYS).
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

/**
 * Commande du panneau latéral dans le manifeste source (Chrome, traitée par le service worker). Sans import : ce module
 * est aussi chargé tel quel par Node (scripts/verify-build.ts). Égalité avec src/protocol/commands.ts vérifiée par les tests.
 */
export const SOURCE_PANEL_COMMAND = 'open-side-panel';

/** Firefox : commande native qui affiche ou masque la barre latérale (`sidebar_action`), sans code */
export const FIREFOX_PANEL_COMMAND = '_execute_sidebar_action';

/**
 * Touches suggérées, identiques sur Chrome, Brave et Firefox (décision du 2026-10-11, égalité avec manifest.json
 * vérifiée par les tests) :
 * - « Valider l'épisode » : Alt+Shift+K. Alt+Shift+S ouvrait le menu Historique de Firefox (lettre d'accès S en anglais).
 * - Panneau latéral : Alt+Shift+1 (« Alt+Maj+& » en AZERTY : même touche physique). Alt+Shift+P ouvrait le menu
 *   Profils de Firefox (constaté) et crée un groupe d'onglets dans Chrome (accelerator_table.cc, Windows et Linux).
 * Ni K ni 1 ne figurent dans les raccourcis de Chrome (accelerator_table.cc : Alt+1 sélectionne un onglet sous Linux,
 * pas Alt+Shift+1) ni de Firefox (browser-sets.inc.xhtml : aucun Alt+Shift). Chiffre sur Firefox : la commande devient
 * un <key keycode="VK_1"> comparé au keyCode (ShortcutUtils.getKeyAttribute, KeyEventHandler::KeyEventMatched), qui vaut
 * 49 en AZERTY comme en QWERTY (touche virtuelle VK_1 sous Windows, « 1 » avec Maj ailleurs).
 */
export const SUGGESTED_KEYS = { 'complete-episode': 'Alt+Shift+K', 'open-side-panel': 'Alt+Shift+1' } as const;

/**
 * Lettres d'accès des menus de Firefox (Windows, Linux), en anglais, français et allemand (mozilla-l10n,
 * browser/browser/menubar.ftl) :
 * - en : File F, Edit E, View V, History S, Bookmarks B, Profiles P, Tools T, Help H ;
 * - fr : Fichier F, Édition N, Affichage A, Historique H, Marque-pages M, Profils P, Outils O, Aide E ;
 * - de : Datei D, Bearbeiten B, Ansicht A, Chronik C, Lesezeichen L, Profile P, Extras X, Hilfe H.
 * Alt+lettre (et Alt+Maj+lettre, constaté avec S et P) ouvre ce menu au lieu de déclencher la commande. Le menu
 * Profils n'apparaît qu'avec la nouvelle gestion des profils, mais Alt+Maj+P l'a ouvert chez le propriétaire.
 */
export const FIREFOX_MENU_ACCESS_KEYS: readonly string[] = ['A', 'B', 'C', 'D', 'E', 'F', 'H', 'L', 'M', 'N', 'O', 'P', 'S', 'T', 'V', 'X'];

/** Commande clavier du manifeste (`commands`) */
export interface ManifestCommand {
  suggested_key?: Record<string, string>;
  description?: string;
}

/** Champs du manifeste source que la cible modifie ; les autres sont recopiés tels quels */
export interface SourceManifest {
  key?: string;
  minimum_chrome_version?: string;
  background?: { service_worker: string; type?: string };
  permissions?: string[];
  side_panel?: { default_path: string };
  action?: { default_icon?: Record<string, string> };
  commands?: Record<string, ManifestCommand>;
}

/** Barre latérale Firefox : jamais ouverte d'office (`open_at_install` vaut true par défaut) */
export interface FirefoxSidebarAction {
  default_panel: string;
  default_title: string;
  default_icon?: Record<string, string>;
  open_at_install: false;
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

export type FirefoxManifest<M extends SourceManifest> = Omit<M, 'key' | 'minimum_chrome_version' | 'background' | 'side_panel' | 'commands'> & {
  background?: FirefoxBackground;
  commands?: Record<string, ManifestCommand>;
  sidebar_action?: FirefoxSidebarAction;
  browser_specific_settings: GeckoSettings;
};

/** Lit la cible du build (`SYNCKAI_TARGET`) ; absente → chrome, inconnue → erreur explicite */
export function parseBuildTarget(value: string | undefined): BuildTarget {
  if (value === undefined || value === '') return 'chrome';
  const target = BUILD_TARGETS.find((candidate) => candidate === value);
  if (!target) throw new Error(`SYNCKAI_TARGET inconnu : « ${value} » (attendu : ${BUILD_TARGETS.join(', ')})`);
  return target;
}

/**
 * Firefox : la commande du panneau devient `_execute_sidebar_action` (touche et description conservées, même position).
 * Le navigateur affiche ou masque alors lui-même la barre latérale, sans passer par le script d'arrière-plan.
 */
export function firefoxCommands(commands: Readonly<Record<string, ManifestCommand>>): Record<string, ManifestCommand> {
  return Object.fromEntries(Object.entries(commands).map(([name, command]) => [name === SOURCE_PANEL_COMMAND ? FIREFOX_PANEL_COMMAND : name, command]));
}

/**
 * Touches suggérées qui ouvriraient un menu de Firefox (Alt+lettre ou Alt+Maj+lettre d'accès, voir
 * FIREFOX_MENU_ACCESS_KEYS) au lieu de déclencher la commande. Chiffres et autres touches acceptés. macOS exclu : pas de
 * lettres d'accès.
 */
export function firefoxMenuKeyConflicts(commands: Readonly<Record<string, ManifestCommand>>): { command: string; key: string }[] {
  return Object.entries(commands).flatMap(([command, { suggested_key: keys = {} }]) =>
    Object.entries(keys)
      .filter(([platform]) => platform !== 'mac')
      .flatMap(([, key]) => {
        const letter = /^alt\+(?:shift\+)?([a-z])$/i.exec(key)?.[1]?.toUpperCase();
        return letter !== undefined && FIREFOX_MENU_ACCESS_KEYS.includes(letter) ? [{ command, key }] : [];
      }),
  );
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
  // `side_panel` et `sidePanel` sont inconnus de Firefox (avertissements web-ext) : remplacés par `sidebar_action`
  const { key: _key, minimum_chrome_version: _minChrome, background, side_panel: sidePanel, commands, ...rest } = base;
  const defaultIcon = rest.action?.default_icon;
  return {
    ...rest,
    ...(commands ? { commands: firefoxCommands(commands) } : {}),
    ...(rest.permissions ? { permissions: rest.permissions.filter((permission) => permission !== 'sidePanel') } : {}),
    ...(sidePanel
      ? {
          sidebar_action: {
            default_panel: sidePanel.default_path,
            default_title: '__MSG_extName__',
            ...(defaultIcon ? { default_icon: defaultIcon } : {}),
            open_at_install: false,
          },
        }
      : {}),
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
