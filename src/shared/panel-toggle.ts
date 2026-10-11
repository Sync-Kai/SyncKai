import { isRecord } from './guards';

/**
 * Raccourci « Ouvrir ou fermer le panneau latéral » (Chrome) : avis diffusé par le service worker aux pages de
 * l'extension, une fois son `sidePanel.open()` terminé (ou écarté). Le panneau déjà ouvert sur cet onglet avant la commande
 * se ferme alors lui-même. Envoyé APRÈS open : le panneau ne peut pas être rouvert juste après s'être fermé.
 * Message du service worker vers les pages : hors MESSAGE_ORIGINS (qui ne filtre que les messages reçus par le service worker).
 */
export const PANEL_TOGGLE_MESSAGE = 'SIDE_PANEL_TOGGLE';

export interface PanelToggleMessage {
  type: typeof PANEL_TOGGLE_MESSAGE;
  /** Onglet de la commande (le panneau Chrome est propre à chaque onglet) */
  tabId: number;
  /** Instant de la commande (Date.now() du service worker) : un panneau chargé après vient d'être ouvert par elle */
  commandAt: number;
}

export function isPanelToggleMessage(value: unknown): value is PanelToggleMessage {
  return isRecord(value) && value.type === PANEL_TOGGLE_MESSAGE && typeof value.tabId === 'number' && typeof value.commandAt === 'number';
}
