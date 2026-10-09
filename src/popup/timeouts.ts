/**
 * Délais d'attente des réponses du service worker. Objet mutable : les tests de bout en bout
 * (scripts/e2e/popup-frame.ts) les raccourcissent avant de charger le popup.
 */
export const popupTimeouts = {
  /** GET_WATCHING sans réponse : erreur + « Réessayer » plutôt qu'un squelette sans fin (une réponse tardive s'applique) */
  watchingMs: 25_000,
};
