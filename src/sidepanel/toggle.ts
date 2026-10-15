import { createLogger } from '../shared/logger';
import { isPanelToggleMessage } from '../protocol/panel-toggle';
import { getChromeSidePanel } from '../shared/side-panel';

// Raccourci « Ouvrir ou fermer le panneau latéral » (Chrome) : côté panneau, la fermeture.
// Le service worker ouvre toujours (open() ne fait rien sur un panneau ouvert), puis diffuse SIDE_PANEL_TOGGLE ;
// le panneau qui existait déjà avant la commande, dans la fenêtre visée, se ferme alors lui-même.

const log = createLogger('sidepanel');

/** Ce que le panneau sait de lui-même : sa fenêtre (null tant qu'inconnue) et son instant de chargement */
export interface PanelIdentity {
  windowId: number | null;
  loadedAt: number;
}

/**
 * true si l'avis vise ce panneau : même fenêtre (panneau global, une page par fenêtre : celui d'une autre fenêtre n'est
 * pas concerné) et panneau chargé AVANT la commande (sinon c'est elle qui vient de l'ouvrir).
 */
export function shouldCloseOnToggle(message: unknown, self: PanelIdentity): boolean {
  if (!isPanelToggleMessage(message) || self.windowId === null) return false;
  return message.windowId === self.windowId && self.loadedAt < message.commandAt;
}

/** `sidePanel.close()` (Chrome 141+, sans geste utilisateur), sinon `window.close()` qui ferme aussi le panneau */
export function closeSidePanel(windowId: number): void {
  const sidePanel = getChromeSidePanel();
  const close: unknown = sidePanel ? Reflect.get(sidePanel, 'close') : undefined;
  if (!sidePanel || typeof close !== 'function') {
    window.close();
    return;
  }
  sidePanel.close({ windowId }).catch((error: unknown) => {
    log.debug('sidePanel.close refusé, fermeture de la page :', error);
    window.close();
  });
}

/**
 * À appeler dès le chargement du panneau (Chrome seulement : Firefox bascule sa barre latérale lui-même).
 * Fenêtre du panneau : `windows.getCurrent()`, la fenêtre qui héberge la page.
 */
export function listenPanelToggle(close: (windowId: number) => void = closeSidePanel): void {
  const self: PanelIdentity = { windowId: null, loadedAt: Date.now() };
  chrome.windows.getCurrent().then(
    (current) => {
      self.windowId = current.id ?? null;
    },
    (error: unknown) => log.debug('Fenêtre du panneau illisible :', error),
  );
  chrome.runtime.onMessage.addListener((message: unknown, sender: chrome.runtime.MessageSender): false => {
    // Avis du service worker seulement (ni script de contenu, ni autre extension)
    if (sender.id !== chrome.runtime.id || sender.tab !== undefined) return false;
    if (self.windowId !== null && shouldCloseOnToggle(message, self)) close(self.windowId);
    return false;
  });
}
