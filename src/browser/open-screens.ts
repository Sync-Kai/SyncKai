import { POPUP_PATH, SIDE_PANEL_PATH } from '../platforms/target-pages';

// Écrans de l'extension qui affichent la fiche d'un onglet (popup, panneau latéral) : ouverts ou non, pour que le service
// worker ne recalcule pas en arrière-plan une fiche que personne ne regarde.

const SCREEN_PAGES: readonly string[] = [POPUP_PATH, SIDE_PANEL_PATH];

/**
 * Un popup ou un panneau latéral est-il ouvert ? Une de leurs pages ouverte dans un onglet compte aussi (fenêtre
 * détachée, pages de test). `null` : inconnu (`runtime.getContexts` absent de Firefox, Chrome < 116, appel en échec),
 * l'appelant garde alors son comportement par défaut.
 */
export async function hasOpenScreen(): Promise<boolean | null> {
  try {
    if (typeof chrome.runtime.getContexts !== 'function') return null;
    const contexts = await chrome.runtime.getContexts({ contextTypes: ['POPUP', 'SIDE_PANEL', 'TAB'] });
    return contexts.some((context) => context.contextType !== 'TAB' || SCREEN_PAGES.some((page) => context.documentUrl?.includes(`/${page}`) === true));
  } catch {
    return null;
  }
}
