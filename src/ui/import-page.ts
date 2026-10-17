import type { ImportPlatform } from '../shared/cr-import';

/** Page « Importer un historique » (onglet dédié : lecture, analyse et aperçu durent plusieurs minutes) */
const IMPORT_PAGE = 'src/import-cr/import-cr.html';

/** Adresse de la page d'import pour une plateforme (Réglages › Mes données, barre d'état) */
export function importPageUrl(platform: ImportPlatform): string {
  return chrome.runtime.getURL(`${IMPORT_PAGE}?platform=${platform}`);
}
