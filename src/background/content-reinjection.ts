// Scripts de contenu du manifeste (Crunchyroll, ADN) exécutés dans les onglets déjà ouverts à l'installation
// et à la mise à jour, sur Chrome : il ne le fait pas, et le script de la version précédente, orphelin, ne peut
// plus rien envoyer (l'épisode en cours serait perdu). Le nouveau script arrête l'orphelin (start.ts) et se
// protège d'une double exécution (instance-guard.ts). Netflix et Disney+ ont leur propre injection (platform-access.ts).
//
// Firefox (sources de Gecko, toolkit/components/extensions) : à l'arrêt de l'ancienne version, chaque contexte de
// script de contenu est fermé (`Cu.nukeSandbox`, ExtensionContent.sys.mjs) ; au démarrage de la nouvelle,
// `policy.injectContentScripts()` (ExtensionProcessScript.sys.mjs) exécute les scripts du manifeste dans les
// pages déjà ouvertes. Les scripts enregistrés par scripting.registerContentScripts sont en revanche effacés à
// la mise à jour (ExtensionScriptingStore.initExtension, ADDON_UPGRADE) : seuls Netflix et Disney+ sont donc à reprendre.
import { createLogger } from '../browser/logger';

const log = createLogger('reinjection');

export type ReinjectionTarget = 'chrome' | 'firefox';

/** Scripts à exécuter dans les onglets déjà ouverts pour un `runtime.onInstalled` */
export interface ReinjectionPlan {
  /** Crunchyroll / ADN (scripts du manifeste) */
  manifest: boolean;
  /** Netflix, Disney+ (scripts enregistrés), pour chaque plateforme dont l'accès est accordé */
  registered: boolean;
}

/**
 * Installation ou mise à jour de l'extension uniquement : après une mise à jour du navigateur (`chrome_update`…),
 * les onglets ont été rechargés avec leurs scripts. Firefox exécute lui-même les scripts du manifeste (voir
 * l'en-tête), pas les scripts enregistrés (Netflix, Disney+).
 */
export function reinjectionPlan(reason: string, target: ReinjectionTarget): ReinjectionPlan {
  const lifecycle = reason === 'install' || reason === 'update';
  return { manifest: lifecycle && target === 'chrome', registered: lifecycle };
}

/** Script de contenu déclaré dans le manifeste généré (chemin du chargeur propre au build) */
export interface ManifestContentScript {
  js?: string[];
  matches?: string[];
  /** `MAIN` : pont de page (Crunchyroll), réexécuté dans le monde de la page ; absent : monde isolé */
  world?: string;
}

/** Monde d'exécution d'un script du manifeste */
export type ScriptWorld = 'MAIN' | 'ISOLATED';

/** Sous-ensemble de chrome.runtime / chrome.tabs / chrome.scripting utilisé par la réinjection */
export interface ContentReinjectionApi {
  contentScripts(): readonly ManifestContentScript[];
  /** Onglets ouverts sur ces motifs (tabs.query par URL : permissions d'hôte suffisantes, sans `tabs`) */
  tabIds(matches: string[]): Promise<number[]>;
  /** Exécute les fichiers du paquet dans la frame principale de l'onglet, dans le monde du script */
  inject(tabId: number, files: string[], world: ScriptWorld): Promise<void>;
}

/**
 * Exécute chaque script de contenu du manifeste dans les onglets ouverts qui lui correspondent, dans l'ordre du manifeste
 * (pont MAIN de Crunchyroll avant le script isolé, qui lui demande aussitôt son canal).
 * Un onglet en échec (déchargé, page d'erreur, accès non accordé…) n'empêche pas les autres : `onError`,
 * jamais d'exception. Retourne le nombre d'injections réussies.
 */
export async function reinjectContentScripts(
  api: ContentReinjectionApi,
  onError: (tabId: number | null, error: unknown) => void,
): Promise<number> {
  let injected = 0;
  for (const script of api.contentScripts()) {
    const files = script.js ?? [];
    const matches = script.matches ?? [];
    const world: ScriptWorld = script.world === 'MAIN' ? 'MAIN' : 'ISOLATED';
    if (files.length === 0 || matches.length === 0) continue;
    let tabIds: number[];
    try {
      tabIds = await api.tabIds(matches);
    } catch (error: unknown) {
      onError(null, error);
      continue;
    }
    const results = await Promise.all(
      tabIds.map(async (tabId) => {
        try {
          await api.inject(tabId, files, world);
          return true;
        } catch (error: unknown) {
          onError(tabId, error);
          return false;
        }
      }),
    );
    injected += results.filter(Boolean).length;
  }
  return injected;
}

const api: ContentReinjectionApi = {
  contentScripts: () => chrome.runtime.getManifest().content_scripts ?? [],
  tabIds: async (matches) => (await chrome.tabs.query({ url: matches })).flatMap((tab) => (tab.id !== undefined ? [tab.id] : [])),
  inject: async (tabId, files, world) => {
    await chrome.scripting.executeScript({ target: { tabId, frameIds: [0] }, files, world });
  },
};

/** Écouteur posé au chargement du service worker (niveau supérieur de background.ts) */
export function listenContentReinjection(): void {
  chrome.runtime.onInstalled.addListener((details) => {
    if (!reinjectionPlan(details.reason, __SYNCKAI_TARGET__).manifest) return;
    reinjectContentScripts(api, (tabId, error) => log.debug(`Réinjection impossible (onglet ${tabId ?? '?'}) :`, error))
      .then((count) => {
        if (count > 0) log.info(`Script de contenu exécuté dans ${count} onglet(s) ouvert(s)`);
      })
      .catch((error: unknown) => log.warn('Réinjection des scripts de contenu impossible :', error));
  });
}
