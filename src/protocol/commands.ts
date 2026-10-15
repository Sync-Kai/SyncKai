// Commandes clavier déclarées dans manifest.json (`commands`) : noms partagés par le service worker, les réglages et le build.

/** « Valider l'épisode en cours » (Alt+Shift+K suggéré, voir SUGGESTED_KEYS dans src/build/manifest-target.ts) */
export const COMPLETE_EPISODE_COMMAND = 'complete-episode';

/** Chrome : « Ouvrir le panneau latéral » (Alt+Shift+1 suggéré), traitée par le service worker */
export const OPEN_SIDE_PANEL_COMMAND = 'open-side-panel';

/** Firefox : commande native qui affiche ou masque la barre latérale (`sidebar_action`), sans code */
export const FIREFOX_SIDEBAR_COMMAND = '_execute_sidebar_action';

/** Nom de la commande du panneau dans le manifeste livré pour la cible */
export function panelCommandName(target: 'chrome' | 'firefox'): string {
  return target === 'firefox' ? FIREFOX_SIDEBAR_COMMAND : OPEN_SIDE_PANEL_COMMAND;
}
