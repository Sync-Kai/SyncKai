import { enableSidePanelGlobally, getChromeSidePanel, openSidePanel } from '../browser/side-panel';
import { createLogger } from '../browser/logger';
import { PANEL_TOGGLE_MESSAGE, type PanelToggleMessage } from '../protocol/panel-toggle';

const log = createLogger('side-panel');

/** Onglet transmis par `commands.onCommand` (sous-ensemble de chrome.tabs.Tab, testable) */
export interface CommandTab {
  windowId?: number;
}

/**
 * Suite donnée au raccourci du panneau :
 * - `opened` : panneau ouvert dans la fenêtre de l'onglet (ou laissé ouvert, puis fermé par lui-même) ;
 * - `unavailable` : pas d'onglet (donc pas de fenêtre), ou pas d'API `chrome.sidePanel`.
 */
export type PanelCommandResult = 'opened' | 'unavailable';

export interface PanelCommandOptions {
  /** Instant de la commande, pris à l'entrée du gestionnaire */
  commandAt?: number;
  /** Diffusion de l'avis aux pages de l'extension (tests) */
  notify?: (message: PanelToggleMessage) => void;
}

/** Avis aux pages : aucun destinataire (panneau fermé) → rejet ignoré */
function broadcastToggle(message: PanelToggleMessage): void {
  chrome.runtime.sendMessage(message).catch((error: unknown) => log.debug('Raccourci du panneau : aucun panneau ouvert', error));
}

/**
 * Raccourci « Ouvrir ou fermer le panneau latéral » (Chrome, Brave), sur n'importe quel onglet. Ouverture entièrement
 * synchrone : `sidePanel.open()` exige le geste utilisateur de la commande, perdu au premier `await` (Chrome refuse
 * alors l'ouverture). Panneau global : il s'ouvre dans la fenêtre de l'onglet et la page suit l'onglet actif.
 *
 * Fermeture : le service worker ne sait pas si le panneau est ouvert (état perdu à chaque mise en veille). `open()` sur un
 * panneau ouvert ne fait rien ; une fois `open()` terminé (ou refusé), l'avis SIDE_PANEL_TOGGLE est diffusé avec la
 * fenêtre visée et le panneau de cette fenêtre qui existait avant la commande se ferme lui-même (sidepanel/toggle.ts).
 * Aucun état, aucune course : la fermeture suit toujours l'ouverture, jamais l'inverse.
 */
export function togglePanelFromCommand(tab: CommandTab | undefined, options: PanelCommandOptions = {}): PanelCommandResult {
  const { commandAt = Date.now(), notify = broadcastToggle } = options;
  const windowId = tab?.windowId;
  if (!getChromeSidePanel() || windowId === undefined || windowId < 0) {
    log.debug('Raccourci du panneau : aucune fenêtre ou panneau indisponible');
    return 'unavailable';
  }
  const settled = (): void => notify({ type: PANEL_TOGGLE_MESSAGE, windowId, commandAt });
  const refused = (error: unknown): void => {
    log.debug('Raccourci du panneau : ouverture refusée pour la fenêtre', windowId, error);
    settled();
  };
  openSidePanel({ windowId }).then(settled, refused);
  return 'opened';
}

/**
 * Installation, mise à jour, démarrage : panneau disponible partout (option globale). Annule la désactivation globale
 * des versions qui le réservaient aux pages de streaming.
 */
export function resetSidePanel(): void {
  enableSidePanelGlobally().catch((error: unknown) => log.warn('Activation globale du panneau impossible :', error));
}
