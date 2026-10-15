// Lecteurs de l'historique Crunchyroll / ADN (content/history/history.iife.ts) : hors du script de contenu du manifeste,
// injectés ici dans l'onglet de la plateforme juste avant l'ouverture du port. Seul import `?script` hors du service
// worker (chemin du script produit par crxjs ; simulé par le serveur des tests de bout en bout, scripts/screenshots/harness.ts).
import historyReaderPath from '../content/history/history.iife.ts?script';

/**
 * Injecte les lecteurs dans le cadre principal de l'onglet, dans le monde isolé des scripts de contenu (aucune ressource
 * exposée aux sites : `executeScript` depuis une page de l'extension). Sans effet s'ils y tournent déjà (garde du script).
 * Rejetée si l'onglet n'est pas accessible (fermé, en chargement ailleurs, page d'erreur, accès au site retiré).
 */
export async function injectHistoryReader(tabId: number): Promise<void> {
  await chrome.scripting.executeScript({ target: { tabId, frameIds: [0] }, files: [historyReaderPath] });
}
