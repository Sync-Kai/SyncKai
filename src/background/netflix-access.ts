// Netflix activé à la demande : seule source de vérité de l'enregistrement des scripts Netflix.
// L'état = la permission optionnelle `*://*.netflix.com/*` (aucun stockage). Le service worker ne se réveille
// que pour permissions.onAdded / onRemoved, runtime.onInstalled et runtime.onStartup.
// Les imports `?script` (chemins des scripts produits par crxjs) n'existent qu'ici (simulés dans netflix-access.test.ts).
import bridgePath from '../content/netflix/page-bridge.iife.ts?script';
import contentPath from '../content/netflix/content-netflix.iife.ts?script';
import { createLogger } from '../shared/logger';
import { resetRevokedNetflixPlayer } from '../shared/netflix-access';
import { NETFLIX_MATCHES } from '../shared/target-pages';
import {
  injectIntoOpenNetflixTabs,
  reconcileNetflixScripts,
  touchesNetflix,
  type NetflixInjectionApi,
  type NetflixScriptingApi,
  type NetflixScriptPaths,
} from './netflix-scripts';

const log = createLogger('netflix-access');

const PATHS: NetflixScriptPaths = { bridge: bridgePath, content: contentPath };

const api: NetflixScriptingApi = {
  hasAccess: () => chrome.permissions.contains({ origins: [...NETFLIX_MATCHES] }),
  registeredIds: async () => (await chrome.scripting.getRegisteredContentScripts()).map((script) => script.id),
  register: (scripts) => chrome.scripting.registerContentScripts(scripts),
  unregister: (ids) => chrome.scripting.unregisterContentScripts({ ids }),
};

const injection: NetflixInjectionApi = {
  hasAccess: api.hasAccess,
  netflixTabIds: async () => (await chrome.tabs.query({ url: [...NETFLIX_MATCHES] })).flatMap((tab) => (tab.id !== undefined ? [tab.id] : [])),
  inject: async (tabId, file, world) => {
    await chrome.scripting.executeScript({ target: { tabId, frameIds: [0] }, files: [file], world });
  },
};

/** Réconciliations en série : onInstalled et onAdded peuvent arriver ensemble (identifiants en double sinon) */
let queue: Promise<void> = Promise.resolve();

/** `injectOpenTabs` : accès tout juste accordé, scripts aussi exécutés dans les onglets Netflix déjà ouverts */
function reconcile(reregister: boolean, injectOpenTabs = false): void {
  queue = queue
    .then(() => reconcileNetflixScripts(api, PATHS, reregister))
    .then(async (result) => {
      if (result !== 'unchanged') log.info(`Scripts Netflix : ${result === 'registered' ? 'enregistrés' : 'retirés'}`);
      if (!injectOpenTabs || result === 'unregistered') return;
      // Onglet déchargé, page d'erreur… : sans conséquence, le script s'appliquera au prochain chargement
      const count = await injectIntoOpenNetflixTabs(injection, PATHS, (tabId, error) => log.debug(`Injection Netflix impossible (onglet ${tabId ?? '?'}) :`, error));
      if (count > 0) log.info(`Scripts Netflix exécutés dans ${count} onglet(s) ouvert(s)`);
    })
    .catch((error: unknown) => log.warn('Enregistrement des scripts Netflix impossible :', error));
}

/** Lecteur préféré « Netflix » sans l'accès : remis à la valeur par défaut (popup, panneau et alertes le lisent) */
function resetPlayer(): void {
  resetRevokedNetflixPlayer()
    .then((reset) => {
      if (reset) log.info('Accès Netflix absent : lecteur préféré remis à la valeur par défaut');
    })
    .catch((error: unknown) => log.warn('Lecteur préféré non corrigé :', error));
}

/** Écouteurs posés au chargement du service worker (niveau supérieur de background.ts) */
export function listenNetflixAccess(): void {
  chrome.permissions.onAdded.addListener((permissions) => {
    if (touchesNetflix(permissions)) reconcile(false, true);
  });
  // Retrait (Réglages, chrome://extensions, about:addons) : scripts retirés et lecteur préféré corrigé à la source
  chrome.permissions.onRemoved.addListener((permissions) => {
    if (!touchesNetflix(permissions)) return;
    reconcile(false);
    resetPlayer();
  });
  // Installation et mise à jour : chemins des scripts propres au build → réenregistrement si l'accès est accordé.
  // Accès perdu hors de la vue du service worker (navigateur fermé, version antérieure) : lecteur corrigé au démarrage
  chrome.runtime.onInstalled.addListener(() => {
    reconcile(true);
    resetPlayer();
  });
  chrome.runtime.onStartup.addListener(resetPlayer);
}
