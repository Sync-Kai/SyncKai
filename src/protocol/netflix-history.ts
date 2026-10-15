// Import de l'historique Netflix : seule pièce embarquée par le script de contenu Netflix (budget). La page d'import pilote
// l'onglet Netflix par chrome.scripting.executeScript (fonction autonome `netflixTabOp`, voir platforms/netflix/tab-op.ts), qui
// s'exécute dans le monde isolé de l'extension, celui du script de contenu : les points de lecture sont demandés au pont
// du monde MAIN par le script de contenu, qui expose pour cela `loadHistory` sous ce symbole (Symbol.for).

/** Clé (Symbol.for) de la fonction `(movieId) => Promise<métadonnées | null>` exposée par le script de contenu Netflix */
export const NETFLIX_HISTORY_HOOK = 'synckai.netflix.history';
