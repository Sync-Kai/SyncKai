// Netflix activé à la demande : seule source de vérité de l'enregistrement des scripts Netflix.
// L'état = la permission optionnelle `*://*.netflix.com/*` (aucun stockage). Le service worker ne se réveille
// que pour permissions.onAdded / onRemoved et runtime.onInstalled.
// Les imports `?script` (chemins des scripts produits par crxjs) n'existent qu'ici : module jamais importé par Vitest.
import bridgePath from '../content/netflix/page-bridge.iife.ts?script';
import contentPath from '../content/netflix/content-netflix.iife.ts?script';
import { createLogger } from '../shared/logger';
import { NETFLIX_MATCHES } from '../shared/target-pages';
import { reconcileNetflixScripts, touchesNetflix, type NetflixScriptingApi, type NetflixScriptPaths } from './netflix-scripts';

const log = createLogger('netflix-access');

const PATHS: NetflixScriptPaths = { bridge: bridgePath, content: contentPath };

const api: NetflixScriptingApi = {
  hasAccess: () => chrome.permissions.contains({ origins: [...NETFLIX_MATCHES] }),
  registeredIds: async () => (await chrome.scripting.getRegisteredContentScripts()).map((script) => script.id),
  register: (scripts) => chrome.scripting.registerContentScripts(scripts),
  unregister: (ids) => chrome.scripting.unregisterContentScripts({ ids }),
};

/** Réconciliations en série : onInstalled et onAdded peuvent arriver ensemble (identifiants en double sinon) */
let queue: Promise<void> = Promise.resolve();

function reconcile(reregister: boolean): void {
  queue = queue
    .then(() => reconcileNetflixScripts(api, PATHS, reregister))
    .then((result) => {
      if (result !== 'unchanged') log.info(`Scripts Netflix : ${result === 'registered' ? 'enregistrés' : 'retirés'}`);
    })
    .catch((error: unknown) => log.warn('Enregistrement des scripts Netflix impossible :', error));
}

/** Écouteurs posés au chargement du service worker (niveau supérieur de background.ts) */
export function listenNetflixAccess(): void {
  chrome.permissions.onAdded.addListener((permissions) => {
    if (touchesNetflix(permissions)) reconcile(false);
  });
  chrome.permissions.onRemoved.addListener((permissions) => {
    if (touchesNetflix(permissions)) reconcile(false);
  });
  // Installation et mise à jour : chemins des scripts propres au build → réenregistrement si l'accès est accordé
  chrome.runtime.onInstalled.addListener(() => reconcile(true));
}
