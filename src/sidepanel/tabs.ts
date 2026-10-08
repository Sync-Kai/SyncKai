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

/** Dernier onglet consulté (stockage local) : rouvert quand le réglage vaut « Dernier onglet ouvert » */
export const PANEL_LAST_TAB_KEY = 'panelLastTab';

/** Onglet affiché à l'ouverture du panneau selon le réglage ; dernier onglet absent ou inconnu → « En lecture » */
export function initialPanelTab(setting: PanelDefaultTab, lastTab: unknown): PanelTab {
  if (setting !== 'last') return setting;
  return isPanelTab(lastTab) ? lastTab : PANEL_TABS[0];
}
