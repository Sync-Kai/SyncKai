import { disableSidePanelGlobally, enableSidePanelForTab } from '../shared/side-panel';
import { createLogger } from '../shared/logger';
import { isTargetPage } from '../shared/target-pages';

const log = createLogger('side-panel');

/** Expéditeur minimal d'un message (sous-ensemble de chrome.runtime.MessageSender, testable) */
export interface PanelSender {
  url?: string;
  frameId?: number;
  tab?: { id?: number };
}

/**
 * Onglet à équiper du panneau : cadre principal d'une page Crunchyroll / ADN, sinon null.
 * `sender.url` est fourni pour un script de contenu sans permission "tabs".
 */
export function panelTabFromSender(sender: PanelSender, patterns?: readonly string[]): number | null {
  const tabId = sender.tab?.id;
  if (tabId === undefined || tabId < 0 || sender.frameId !== 0) return null;
  return isTargetPage(sender.url, patterns) ? tabId : null;
}

/**
 * PANEL_AVAILABLE : le script de contenu se signale une fois par chargement de page (pas à chaque
 * navigation SPA : l'option par onglet reste en place tant que l'onglet existe ou qu'on ne la retire pas).
 */
export async function enablePanelForSender(sender: chrome.runtime.MessageSender): Promise<null> {
  const tabId = panelTabFromSender(sender);
  if (tabId === null) return null;
  try {
    await enableSidePanelForTab(tabId);
  } catch (error: unknown) {
    // Onglet fermé entre-temps : rien à faire
    log.debug('Panneau non activé pour l’onglet', tabId, error);
  }
  return null;
}

/** Installation / démarrage : panneau du manifeste indisponible partout (activé ensuite onglet par onglet) */
export function resetSidePanel(): void {
  disableSidePanelGlobally().catch((error: unknown) => log.warn('Désactivation globale du panneau impossible :', error));
}
