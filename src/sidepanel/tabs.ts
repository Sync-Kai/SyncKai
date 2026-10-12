import type { PanelDefaultTab } from '../shared/settings';

/** Onglets du panneau latéral, dans l'ordre d'affichage */
export const PANEL_TABS = ['nowPlaying', 'agenda'] as const;
export type PanelTab = (typeof PANEL_TABS)[number];

export function isPanelTab(value: unknown): value is PanelTab {
  return PANEL_TABS.some((tab) => tab === value);
}

/**
 * Navigation clavier d'une liste d'onglets (motif ARIA « tabs », activation automatique) :
 * flèches gauche/droite en boucle, Début/Fin ; null pour toute autre touche.
 */
export function nextTabIndex(current: number, key: string, count: number): number | null {
  if (count <= 0) return null;
  switch (key) {
    case 'ArrowRight':
      return (current + 1) % count;
    case 'ArrowLeft':
      return (current - 1 + count) % count;
    case 'Home':
      return 0;
    case 'End':
      return count - 1;
    default:
      return null;
  }
}

/**
 * L'onglet sélectionné devient-il visible ? (autre onglet que celui affiché, retour des Réglages ou d'une page
 * hors cible : `shown` null). Un simple nouveau rendu de l'onglet déjà affiché ne compte pas.
 */
export function isTabEntering(shown: PanelTab | null, selected: PanelTab): boolean {
  return shown !== selected;
}

/** Dernier onglet consulté (stockage local) : rouvert quand le réglage vaut « Dernier onglet ouvert » */
export const PANEL_LAST_TAB_KEY = 'panelLastTab';

/** Onglet affiché à l'ouverture du panneau selon le réglage ; dernier onglet absent ou inconnu → « En lecture » */
export function initialPanelTab(setting: PanelDefaultTab, lastTab: unknown): PanelTab {
  if (setting !== 'last') return setting;
  return isPanelTab(lastTab) ? lastTab : PANEL_TABS[0];
}

/**
 * Onglet affiché selon la page suivie. `auto` : l'Agenda a été choisi par le panneau (page hors streaming), pas par
 * l'utilisateur ; « En lecture » revient alors dès que l'onglet suivi redevient une page de streaming.
 */
export interface TabSelection {
  tab: PanelTab;
  auto: boolean;
}

/**
 * Passage sur une page de streaming (`target`) ou ailleurs, appelé seulement quand ce statut change :
 * - hors streaming, « En lecture » n'a rien à montrer : Agenda (choix automatique) ;
 * - de retour sur une page de streaming, « En lecture » revient si l'Agenda avait été choisi automatiquement ;
 * - un onglet choisi par l'utilisateur (ou par le réglage « Onglet à l'ouverture ») n'est jamais changé autrement.
 */
export function followPageContext(current: TabSelection, target: boolean): TabSelection {
  if (!target) return current.tab === 'nowPlaying' ? { tab: 'agenda', auto: true } : current;
  return current.auto ? { tab: 'nowPlaying', auto: false } : current;
}
