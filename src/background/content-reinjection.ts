// Scripts de contenu du manifeste (Crunchyroll, ADN) exécutés dans les onglets déjà ouverts à l'installation
// et à la mise à jour : le navigateur ne le fait pas, et le script de la version précédente, orphelin, ne peut
// plus rien envoyer (l'épisode en cours serait perdu). Le nouveau script arrête l'orphelin (start.ts) et se
// protège d'une double exécution (STARTED_FLAG de content.ts). Netflix a sa propre injection (netflix-access.ts).
import { createLogger } from '../shared/logger';

const log = createLogger('reinjection');

/** Script de contenu déclaré dans le manifeste généré (chemin du chargeur propre au build) */
export interface ManifestContentScript {
  js?: string[];
  matches?: string[];
}

/** Sous-ensemble de chrome.runtime / chrome.tabs / chrome.scripting utilisé par la réinjection */
export interface ContentReinjectionApi {
  contentScripts(): readonly ManifestContentScript[];
  /** Onglets ouverts sur ces motifs (tabs.query par URL : permissions d'hôte suffisantes, sans `tabs`) */
  tabIds(matches: string[]): Promise<number[]>;
  /** Exécute les fichiers du paquet dans la frame principale de l'onglet (monde isolé) */
  inject(tabId: number, files: string[]): Promise<void>;
}

/**
 * Exécute chaque script de contenu du manifeste dans les onglets ouverts qui lui correspondent.
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
          await api.inject(tabId, files);
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
  inject: async (tabId, files) => {
    await chrome.scripting.executeScript({ target: { tabId, frameIds: [0] }, files });
  },
};

/** Écouteur posé au chargement du service worker (niveau supérieur de background.ts) */
export function listenContentReinjection(): void {
  chrome.runtime.onInstalled.addListener((details) => {
    // Mise à jour du navigateur (`chrome_update`…) : les onglets ont déjà leur script, rien à faire
    if (details.reason !== 'install' && details.reason !== 'update') return;
    reinjectContentScripts(api, (tabId, error) => log.debug(`Réinjection impossible (onglet ${tabId ?? '?'}) :`, error))
      .then((count) => {
        if (count > 0) log.info(`Script de contenu exécuté dans ${count} onglet(s) ouvert(s)`);
      })
      .catch((error: unknown) => log.warn('Réinjection des scripts de contenu impossible :', error));
  });
}
