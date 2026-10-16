// Écritures par lots des tâches d'import (PERF-02) : l'historique (analyse) et l'aperçu (application) sont lus une fois
// par tâche, puis relus seulement après un réveil du service worker. Les correspondances de saison, les résultats et les
// correspondances apprises sont gardés en mémoire puis écrits par lots : le volume écrit ne croît plus avec le carré du
// nombre de saisons, et la page d'import ne redessine qu'à chaque lot.

/** Éléments au plus par lot */
export const WRITE_BATCH_SIZE = 20;
/** Délai au plus entre deux lots : la page d'import suit la progression */
export const WRITE_BATCH_MS = 10_000;

/** Lot en attente d'écriture, une entrée par clé (la dernière l'emporte) ; l'écriture elle-même reste à l'appelant */
export interface WriteBatch<V> {
  set(key: string, value: V): void;
  /** Lot plein, ou ouvert depuis WRITE_BATCH_MS : à écrire maintenant */
  full(): boolean;
  /** Entrées en attente retirées du lot (vide après), nouveau délai */
  take(): Map<string, V>;
}

export function createWriteBatch<V>(): WriteBatch<V> {
  let pending = new Map<string, V>();
  let since = Date.now();
  return {
    set: (key, value) => void pending.set(key, value),
    full: () => pending.size >= WRITE_BATCH_SIZE || Date.now() - since >= WRITE_BATCH_MS,
    take: () => {
      const entries = pending;
      pending = new Map();
      since = Date.now();
      return entries;
    },
  };
}
