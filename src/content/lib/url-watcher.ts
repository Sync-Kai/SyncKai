const POLL_MS = 1000;

/**
 * Appelle `onChange` à chaque changement d'URL d'une SPA. Retourne une fonction de nettoyage.
 *
 * Un content script vit dans un "isolated world" : surcharger history.pushState ici n'intercepterait
 * pas les appels de la page. On utilise donc la Navigation API (Chrome 102+), dont les événements
 * sont visibles depuis le content script, et `popstate` ; un relevé léger de location.href chaque seconde
 * reste posé dans tous les cas (2-R7) : Firefox peut exposer `navigation` au script de contenu (Xray) sans lui
 * livrer les `pushState` de la page (non vérifié), une navigation SPA ne serait alors jamais vue.
 */
export function watchUrl(onChange: (url: URL) => void): () => void {
  let lastHref = location.href;

  const check = (): void => {
    if (location.href === lastHref) return;
    lastHref = location.href;
    onChange(new URL(lastHref));
  };

  // Typé comme toujours présent par lib.dom, mais absent des navigateurs plus anciens
  const navigation: Navigation | undefined = window.navigation;
  navigation?.addEventListener('currententrychange', check);
  const interval = setInterval(check, POLL_MS);
  window.addEventListener('popstate', check);
  return () => {
    navigation?.removeEventListener('currententrychange', check);
    clearInterval(interval);
    window.removeEventListener('popstate', check);
  };
}
