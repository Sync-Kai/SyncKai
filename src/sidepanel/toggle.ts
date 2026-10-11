import { createLogger } from '../shared/logger';
import { isPanelToggleMessage } from '../shared/panel-toggle';
import { getChromeSidePanel } from '../shared/side-panel';

// Raccourci « Ouvrir ou fermer le panneau latéral » (Chrome) : côté panneau, la fermeture.
// Le service worker ouvre toujours (open() ne fait rien sur un panneau ouvert), puis diffuse SIDE_PANEL_TOGGLE ;
// le panneau qui existait déjà avant la commande, sur l'onglet visé, se ferme alors lui-même.

const log = createLogger('sidepanel');

/** Ce que le panneau sait de lui-même : onglet suivi (null tant qu'inconnu) et instant de chargement */
export interface PanelIdentity {
  tabId: number | null;
  loadedAt: number;
}

/**
 * true si l'avis vise ce panneau : même onglet (le panneau Chrome est propre à un onglet, donc à une fenêtre : un panneau
 * ouvert dans une autre fenêtre ou sur un autre onglet n'est pas concerné) et panneau chargé AVANT la commande (sinon
 * c'est elle qui vient de l'ouvrir).
 */
export function shouldCloseOnToggle(message: unknown, self: PanelIdentity): boolean {
  if (!isPanelToggleMessage(message) || self.tabId === null) return false;
  return message.tabId === self.tabId && self.loadedAt < message.commandAt;
}

/** `sidePanel.close()` (Chrome 141+, sans geste utilisateur), sinon `window.close()` qui ferme aussi le panneau */
export function closeSidePanel(tabId: number): void {
  const sidePanel = getChromeSidePanel();
  const close: unknown = sidePanel ? Reflect.get(sidePanel, 'close') : undefined;
  if (!sidePanel || typeof close !== 'function') {
    window.close();
    return;
  }
  sidePanel.close({ tabId }).catch((error: unknown) => {
    log.debug('sidePanel.close refusé, fermeture de la page :', error);
    window.close();
  });
}

/**
 * À appeler dès le chargement du panneau (Chrome seulement : Firefox bascule sa barre latérale lui-même).
 * Onglet du panneau : l'onglet actif de sa fenêtre à l'ouverture (même règle que presence.ts).
 */
export function listenPanelToggle(close: (tabId: number) => void = closeSidePanel): void {
  const self: PanelIdentity = { tabId: null, loadedAt: Date.now() };
  chrome.tabs.query({ active: true, currentWindow: true }).then(
    ([tab]) => {
      self.tabId = tab?.id ?? null;
    },
    (error: unknown) => log.debug('Onglet du panneau illisible :', error),
  );
  chrome.runtime.onMessage.addListener((message: unknown, sender: chrome.runtime.MessageSender): false => {
    // Avis du service worker seulement (ni script de contenu, ni autre extension)
    if (sender.id !== chrome.runtime.id || sender.tab !== undefined) return false;
    if (self.tabId !== null && shouldCloseOnToggle(message, self)) close(self.tabId);
    return false;
  });
}
