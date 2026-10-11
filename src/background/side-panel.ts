import { disableSidePanelGlobally, enableSidePanelForTab, getChromeSidePanel, openSidePanel } from '../shared/side-panel';
import { createLogger } from '../shared/logger';
import { PANEL_TOGGLE_MESSAGE, type PanelToggleMessage } from '../shared/panel-toggle';
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

/** Onglet transmis par `commands.onCommand` (sous-ensemble de chrome.tabs.Tab, testable) */
export interface CommandTab {
  id?: number;
  url?: string;
  pendingUrl?: string;
}

/**
 * Suite donnée au raccourci du panneau :
 * - `opened` : page reconnue, panneau activé pour l'onglet puis ouvert (ou laissé ouvert, puis fermé par lui-même) ;
 * - `open-if-enabled` : URL masquée (pas de permission d'hôte, ADN selon le navigateur), ouverture tentée seule ;
 * - `unsupported` : autre site, rien n'est fait ;
 * - `unavailable` : pas d'onglet ou pas d'API `chrome.sidePanel`.
 */
export type PanelCommandResult = 'opened' | 'open-if-enabled' | 'unsupported' | 'unavailable';

export interface PanelCommandOptions {
  /** Instant de la commande, pris à l'entrée du gestionnaire */
  commandAt?: number;
  /** Motifs des pages cibles (tests) ; par défaut ceux du manifeste et des plateformes optionnelles */
  patterns?: readonly string[];
  /** Diffusion de l'avis aux pages de l'extension (tests) */
  notify?: (message: PanelToggleMessage) => void;
}

/** Avis aux pages : aucun destinataire (panneau fermé) → rejet ignoré */
function broadcastToggle(message: PanelToggleMessage): void {
  chrome.runtime.sendMessage(message).catch((error: unknown) => log.debug('Raccourci du panneau : aucun panneau ouvert', error));
}

/**
 * Raccourci « Ouvrir ou fermer le panneau latéral » (Chrome, Brave). Ouverture entièrement synchrone :
 * `sidePanel.open()` exige le geste utilisateur de la commande, perdu au premier `await` (Chrome refuse alors l'ouverture).
 * - Page Crunchyroll / ADN, Netflix / Disney+ (accès accordé) : `setOptions` part sans attente avant `open` dans la même
 *   file IPC (openSidePanel). Couvre la course avec PANEL_AVAILABLE (script de contenu pas encore signalé) et les onglets
 *   ouverts avant l'installation.
 * - URL masquée : `open` seul. Il n'aboutit que si le panneau est déjà activé pour cet onglet (PANEL_AVAILABLE) ; sinon
 *   Chrome le refuse (panneau désactivé globalement) et le refus est consigné en debug. Si l'onglet a quitté la page
 *   cible depuis, le panneau se retire lui-même (sidepanel/presence.ts).
 * - Autre site (URL lisible) : rien, le panneau reste réservé aux sites de streaming (UX-04).
 *
 * Fermeture : le service worker ne sait pas si le panneau est ouvert (état perdu à chaque mise en veille). `open()` sur un
 * panneau ouvert ne fait rien ; une fois `open()` terminé, l'avis SIDE_PANEL_TOGGLE est diffusé et le panneau qui
 * existait avant la commande se ferme lui-même (sidepanel/toggle.ts). Aucun état, aucune course : la fermeture suit
 * toujours l'ouverture, jamais l'inverse.
 */
export function togglePanelFromCommand(tab: CommandTab | undefined, options: PanelCommandOptions = {}): PanelCommandResult {
  const { commandAt = Date.now(), patterns, notify = broadcastToggle } = options;
  const sidePanel = getChromeSidePanel();
  const tabId = tab?.id;
  if (!sidePanel || tabId === undefined || tabId < 0) {
    log.debug('Raccourci du panneau : aucun onglet ou panneau indisponible');
    return 'unavailable';
  }
  // URL masquée sans permission d'hôte : chaîne vide ou absente selon le navigateur
  const url = [tab?.url, tab?.pendingUrl].find((candidate) => candidate !== undefined && candidate !== '');
  if (url && !isTargetPage(url, patterns)) {
    log.debug('Raccourci du panneau ignoré hors des sites de streaming');
    return 'unsupported';
  }
  const settled = (): void => notify({ type: PANEL_TOGGLE_MESSAGE, tabId, commandAt });
  const refused = (error: unknown): void => {
    log.debug('Raccourci du panneau : ouverture refusée pour l’onglet', tabId, error);
    settled();
  };
  (url ? openSidePanel(tabId) : sidePanel.open({ tabId })).then(settled, refused);
  return url ? 'opened' : 'open-if-enabled';
}

/** Installation / démarrage : panneau du manifeste indisponible partout (activé ensuite onglet par onglet) */
export function resetSidePanel(): void {
  disableSidePanelGlobally().catch((error: unknown) => log.warn('Désactivation globale du panneau impossible :', error));
}
