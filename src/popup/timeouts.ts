/**
 * Délais du popup (attente des réponses du service worker, rythme des écritures groupées). Objet mutable : les tests de
 * bout en bout (scripts/e2e/popup-frame.ts) les raccourcissent avant de charger le popup.
 */
export const popupTimeouts = {
  /** GET_WATCHING sans réponse : erreur + « Réessayer » plutôt qu'un squelette sans fin (une réponse tardive s'applique) */
  watchingMs: 25_000,
  /**
   * Séries en sommeil, lot de plusieurs séries (« Tout mettre en pause », son « Réessayer », « Annuler ») : attente entre
   * deux séries. Deux requêtes AniList par série : au plus 20 par minute, sous la limite dégradée de 30 (PERF-02)
   */
  dormantPaceMs: 6_000,
};
