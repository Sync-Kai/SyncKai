import type { ImportPlatform } from '../shared/cr-import';

/** Page « Importer un historique » (onglet dédié : lecture, analyse et aperçu durent plusieurs minutes) */
const IMPORT_PAGE = 'src/import-cr/import-cr.html';

/**
 * Adresse de la page d'import, ouverte sur une plateforme (barre d'état : import de cette plateforme) ou sans
 * (Réglages › Mes données : la plateforme se choisit dans la page)
 */
export function importPageUrl(platform?: ImportPlatform): string {
  return chrome.runtime.getURL(platform ? `${IMPORT_PAGE}?platform=${platform}` : IMPORT_PAGE);
}
