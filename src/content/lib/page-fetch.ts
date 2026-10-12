/** Requête HTTP (fetch de la page, injectable pour les tests) */
export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

declare global {
  // Firefox : `content.fetch` exécute la requête au nom de la page (cookies et origine du site)
  var content: { fetch?: typeof fetch } | undefined;
}

/**
 * fetch de la page : `content.fetch` sur Firefox, sinon fetch du script de contenu (origine de la page sur Chrome).
 * Dans les deux cas la requête part avec l'origine du site et sous sa politique CORS, comme celles du site lui-même
 * (le `fetch` d'un script de contenu Firefox partirait au nom de l'extension).
 */
export function pageFetch(): FetchLike {
  const scoped = globalThis.content;
  if (scoped && typeof scoped.fetch === 'function') {
    const contentFetch = scoped.fetch;
    return (input, init) => contentFetch.call(scoped, input, init);
  }
  return (input, init) => window.fetch(input, init);
}
