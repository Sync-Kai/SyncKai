import type { ImportPlatform } from '../shared/cr-import';

// Actions de la page d'import (import-cr.ts) appelées par l'arbre Preact (components/). Module feuille : les composants
// n'importent pas la page, qui les monte.

export interface ImportActions {
  /** Autre plateforme choisie (écran de connexion seulement), gardée dans l'URL */
  choosePlatform(platform: ImportPlatform): void;
  /** « Ouvrir {platform} » : onglet ouvert en arrière-plan, la page le suit */
  openPlatform(): void;
  /** « Autoriser l'accès » : demande envoyée dans le clic (Firefox : geste utilisateur sans await préalable) */
  requestAccess(platform: ImportPlatform): void;
  /** « Lire mon historique » dans l'onglet trouvé */
  read(tabId: number): void;
  stopReading(): void;
  showTab(tabId: number): void;
  reloadTab(tabId: number): void;
  /** « Arrêter » l'analyse ou l'import en cours */
  cancelJob(): void;
  /** « Recommencer » : aperçu et dernière tâche effacés, retour au choix de la plateforme */
  restart(): void;
  /** Ligne de l'aperçu cochée ou décochée */
  toggleItem(id: string, checked: boolean): void;
  /** « Tout cocher » / « Tout décocher » (lignes pas encore écrites) */
  toggleAll(): void;
  /** « Mettre à jour N séries » : import des lignes cochées en tâche de fond */
  applySelected(): void;
  /** Saison « À vérifier » cochée ou décochée */
  toggleReview(key: string, checked: boolean): void;
  /** « Créer N vérifications » : cartes « À vérifier » du popup */
  createReviews(): void;
  /** « Déjà à jour » déplié ou replié (choix gardé d'un rendu à l'autre, UI-06) */
  setUpToDateOpen(open: boolean): void;
  /** « OK » du bilan de l'import */
  dismissJob(): void;
}
