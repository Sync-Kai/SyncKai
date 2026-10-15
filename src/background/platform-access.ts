// Plateformes activées à la demande (Netflix, Disney+, Prime Video) : seule source de vérité de l'enregistrement de leurs scripts.
// L'état = la permission optionnelle de chaque plateforme (aucun stockage). Le service worker ne se réveille que pour
// permissions.onAdded / onRemoved, runtime.onInstalled et runtime.onStartup.
// Les imports `?script` (chemins des scripts produits par crxjs) n'existent qu'ici (simulés dans platform-access.test.ts).
import disneyBridgePath from '../content/disney/page-bridge.iife.ts?script';
import disneyContentPath from '../content/disney/content-disney.iife.ts?script';
import netflixBridgePath from '../content/netflix/page-bridge.iife.ts?script';
import netflixContentPath from '../content/netflix/content-netflix.iife.ts?script';
import primeBridgePath from '../content/prime/page-bridge.iife.ts?script';
import primeContentPath from '../content/prime/content-prime.iife.ts?script';
import { createLogger } from '../browser/logger';
import { resetRevokedPlayer } from '../shared/preferred-player';
import { PLATFORMS } from '../platforms/registry';
import { isPreferredPlayerOption } from '../shared/settings';
import { reinjectionPlan } from './content-reinjection';
import {
  injectIntoOpenTabs,
  platformMatches,
  reconcilePlatformScripts,
  SCRIPTED_PLATFORMS,
  touchesPlatform,
  type PlatformInjectionApi,
  type PlatformScriptingApi,
  type PlatformScriptPaths,
  type ScriptedPlatform,
} from './platform-scripts';

const log = createLogger('platform-access');

const PATHS: Readonly<Record<ScriptedPlatform, PlatformScriptPaths>> = {
  netflix: { bridge: netflixBridgePath, content: netflixContentPath },
  disney: { bridge: disneyBridgePath, content: disneyContentPath },
  prime: { bridge: primeBridgePath, content: primeContentPath },
};

const hasAccess = (platform: ScriptedPlatform) => (): Promise<boolean> => chrome.permissions.contains({ origins: platformMatches(platform) });

function scriptingApi(platform: ScriptedPlatform): PlatformScriptingApi {
  return {
    hasAccess: hasAccess(platform),
    registeredIds: async () => (await chrome.scripting.getRegisteredContentScripts()).map((script) => script.id),
    register: (scripts) => chrome.scripting.registerContentScripts(scripts),
    unregister: (ids) => chrome.scripting.unregisterContentScripts({ ids }),
  };
}

function injectionApi(platform: ScriptedPlatform): PlatformInjectionApi {
  return {
    hasAccess: hasAccess(platform),
    tabIds: async () => (await chrome.tabs.query({ url: platformMatches(platform) })).flatMap((tab) => (tab.id !== undefined ? [tab.id] : [])),
    inject: async (tabId, file, world) => {
      await chrome.scripting.executeScript({ target: { tabId, frameIds: [0] }, files: [file], world });
    },
  };
}

/** Réconciliations en série : onInstalled et onAdded peuvent arriver ensemble (identifiants en double sinon) */
let queue: Promise<void> = Promise.resolve();

/** `injectOpenTabs` : accès tout juste accordé ou extension mise à jour, scripts aussi exécutés dans les onglets déjà ouverts */
function reconcile(platform: ScriptedPlatform, reregister: boolean, injectOpenTabs = false): void {
  const { label } = PLATFORMS[platform];
  queue = queue
    .then(() => reconcilePlatformScripts(scriptingApi(platform), platform, PATHS[platform], reregister))
    .then(async (result) => {
      if (result !== 'unchanged') log.info(`Scripts ${label} : ${result === 'registered' ? 'enregistrés' : 'retirés'}`);
      if (!injectOpenTabs || result === 'unregistered') return;
      // Onglet déchargé, page d'erreur… : sans conséquence, le script s'appliquera au prochain chargement
      const count = await injectIntoOpenTabs(injectionApi(platform), PATHS[platform], (tabId, error) =>
        log.debug(`Injection ${label} impossible (onglet ${tabId ?? '?'}) :`, error),
      );
      if (count > 0) log.info(`Scripts ${label} exécutés dans ${count} onglet(s) ouvert(s)`);
    })
    .catch((error: unknown) => log.warn(`Enregistrement des scripts ${label} impossible :`, error));
}

/** Lecteur préféré « Netflix » ou « Prime Video » sans l'accès : remis à la valeur par défaut (popup, panneau et alertes le lisent) */
function resetPlayer(): void {
  resetRevokedPlayer()
    .then((reset) => {
      if (reset) log.info('Accès au lecteur préféré absent : lecteur préféré remis à la valeur par défaut');
    })
    .catch((error: unknown) => log.warn('Lecteur préféré non corrigé :', error));
}

/** Écouteurs posés au chargement du service worker (niveau supérieur de background.ts) */
export function listenPlatformAccess(): void {
  chrome.permissions.onAdded.addListener((permissions) => {
    for (const platform of SCRIPTED_PLATFORMS) if (touchesPlatform(platform, permissions)) reconcile(platform, false, true);
  });
  // Retrait (Réglages, chrome://extensions, about:addons) : scripts retirés et lecteur préféré corrigé à la source
  chrome.permissions.onRemoved.addListener((permissions) => {
    for (const platform of SCRIPTED_PLATFORMS) {
      if (!touchesPlatform(platform, permissions)) continue;
      reconcile(platform, false);
      if (isPreferredPlayerOption(platform)) resetPlayer();
    }
  });
  // Installation et mise à jour : chemins des scripts propres au build → réenregistrement si l'accès est accordé,
  // puis scripts exécutés dans les onglets ouverts (l'ancien script isolé est orphelin sur Chrome, détruit sur
  // Firefox ; aucun des deux ne réinjecte les scripts enregistrés, voir content-reinjection.ts).
  // Accès au lecteur préféré perdu hors de la vue du service worker (navigateur fermé, version antérieure) : lecteur corrigé au démarrage
  chrome.runtime.onInstalled.addListener((details) => {
    const { registered } = reinjectionPlan(details.reason, __SYNCKAI_TARGET__);
    for (const platform of SCRIPTED_PLATFORMS) reconcile(platform, true, registered);
    resetPlayer();
  });
  chrome.runtime.onStartup.addListener(resetPlayer);
}
