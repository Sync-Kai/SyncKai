/**
 * Vrai si l'extension a été rechargée ou mise à jour depuis le lancement de ce script de contenu : il est alors
 * orphelin (chrome.runtime ne répond plus, mais ses écouteurs DOM tournent encore).
 */
export function isExtensionContextInvalidated(): boolean {
  return typeof chrome.runtime?.id !== 'string';
}
