import { defaultSelection, importPlatformOf, type CrImportJob, type CrImportPlan, type ImportPlatform } from '../shared/cr-import';
import { createStore, type ReadonlyStore } from '../ui/state';
import type { ReadProgress } from './sources/source';

// État de la page d'import (import-cr.ts) : étape en cours, plateformes (accès, onglet), tâche et aperçu relus du stockage,
// sélection de l'aperçu. Aucun rendu ici : chaque changement est publié (`publish`) dans `view`, que lit l'arbre Preact.

/** Onglet et accès d'une plateforme (tuiles du choix, barre d'action) */
export interface PlatformTab {
  /** Accès au site (Netflix : accès optionnel) ; null : pas encore relu */
  access: boolean | null;
  tabId: number | null;
  tabTitle: string | null;
}

/** Message de l'écran de connexion : échec de la lecture (erreur) ou historique vide (information) */
export interface StepAlert {
  text: string;
  tone: 'error' | 'info';
  /** Onglet à recharger (« Recharger l'onglet ») : lecteur absent ou muet */
  reloadTabId: number | null;
}

/** Lecture en cours : progression de la source (voir sources/source.ts) ; Netflix garde les lignes et titres déjà lus */
export type ReadStep = Extract<ReadProgress, { kind: 'reading' }> | (Extract<ReadProgress, { kind: 'netflix' }> & { rows: number; titles: number });

export type Step =
  /** Choix de la plateforme ; `opening` : onglet de la plateforme choisie ouvert, en attente */
  | { kind: 'connect'; opening: boolean; alert: StepAlert | null }
  /** Lecture en cours dans l'onglet `tabId` */
  | (ReadStep & { tabId: number })
  | { kind: 'starting' };

export interface PageState {
  loaded: boolean;
  /** Plateforme choisie pour une nouvelle lecture (l'aperçu garde la sienne) */
  platform: ImportPlatform;
  platforms: Record<ImportPlatform, PlatformTab>;
  connected: boolean;
  job: CrImportJob | null;
  plan: CrImportPlan | null;
  step: Step;
  /** Éléments cochés de l'aperçu (initialisés à chaque nouvel aperçu) */
  selected: Set<string>;
  selectionFor: number | null;
  reviewSelected: Set<string>;
  /** « Déjà à jour » déplié : choix de l'utilisateur gardé d'un rendu à l'autre (UI-06) */
  upToDateOpen: boolean;
  /** Demande en cours depuis l'aperçu (import, vérifications) : cases et boutons figés, bouton concerné occupé */
  busy: 'apply' | 'reviews' | null;
  error: string | null;
  notice: string | null;
}

/** Écran de connexion (choix de la plateforme, lecture à lancer), avec le message de la lecture précédente */
export const connectStep = (alert: StepAlert | null = null): Step => ({ kind: 'connect', opening: false, alert });

const noTab = (): PlatformTab => ({ access: null, tabId: null, tabTitle: null });

export const state: PageState = {
  loaded: false,
  platform: 'crunchyroll',
  platforms: { crunchyroll: noTab(), adn: noTab(), netflix: noTab() },
  connected: true,
  job: null,
  plan: null,
  step: connectStep(),
  selected: new Set(),
  selectionFor: null,
  reviewSelected: new Set(),
  upToDateOpen: false,
  busy: null,
  error: null,
  notice: null,
};

const store = createStore<PageState>({ ...state });

/** Instantané de l'état lu par l'arbre Preact (nouvel objet à chaque publication) */
export const view: ReadonlyStore<PageState> = store;

/** Publie l'état courant : l'arbre Preact est redessiné */
export function publish(): void {
  store.set({ ...state, platforms: { ...state.platforms } });
}

/** Plateforme affichée : celle de l'aperçu s'il existe, sinon celle choisie */
export const currentPlatform = (page: Pick<PageState, 'plan' | 'platform'> = state): ImportPlatform => (page.plan ? importPlatformOf(page.plan) : page.platform);

export const isRunning = (): boolean => state.job?.status === 'running';

export function setPlan(plan: CrImportPlan | null): void {
  state.plan = plan;
  // Nouvel aperçu : sélection par défaut ; mise à jour du même aperçu (résultats) : sélection conservée, éléments faits retirés
  if (plan && plan.builtAt !== state.selectionFor) {
    state.selectionFor = plan.builtAt;
    state.selected = new Set(defaultSelection(plan));
    state.reviewSelected = new Set(plan.review.filter((r) => !r.created).map((r) => r.key));
    state.upToDateOpen = false;
  } else if (plan) {
    for (const item of plan.items) if (item.result?.outcome === 'updated') state.selected.delete(item.id);
    for (const review of plan.review) if (review.created) state.reviewSelected.delete(review.key);
  }
}
