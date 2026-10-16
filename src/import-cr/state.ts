import { defaultSelection, importPlatformOf, isImportPlatform, type CrImportJob, type CrImportPlan, type ImportPlatform } from '../shared/cr-import';
import type { ReadProgress } from './sources/source';

// État de la page d'import (import-cr.ts) : étape en cours, tâche et aperçu relus du stockage, sélection de l'aperçu.
// Aucun rendu ici : la page redessine après chaque changement.

export type Step =
  | { kind: 'connect'; tabId: number | null; tabTitle: string | null; opening: boolean; error: string | null; reloadTabId: number | null }
  /** Lecture en cours dans l'onglet `tabId` (progression de la source, voir sources/source.ts) */
  | (ReadProgress & { tabId: number })
  | { kind: 'starting' };

export interface PageState {
  loaded: boolean;
  /** Plateforme choisie pour une nouvelle lecture (l'aperçu garde la sienne) */
  platform: ImportPlatform;
  connected: boolean;
  hostAccess: boolean;
  job: CrImportJob | null;
  plan: CrImportPlan | null;
  step: Step;
  /** Éléments cochés de l'aperçu (initialisés à chaque nouvel aperçu) */
  selected: Set<string>;
  selectionFor: number | null;
  reviewSelected: Set<string>;
  /** Blocs repliables de l'aperçu ouverts : choix de l'utilisateur gardé d'un rendu à l'autre (UI-06) */
  reviewOpen: boolean;
  upToDateOpen: boolean;
  busy: boolean;
  error: string | null;
  notice: string | null;
}

/** Écran de connexion (onglet à trouver, lecture à lancer) */
export const connectStep = (tabId: number | null = null, error: string | null = null, reloadTabId: number | null = null): Step => ({ kind: 'connect', tabId, tabTitle: null, opening: false, error, reloadTabId });

const requested = new URLSearchParams(location.search).get('platform');

export const state: PageState = {
  loaded: false,
  platform: isImportPlatform(requested) ? requested : 'crunchyroll',
  connected: true,
  hostAccess: true,
  job: null,
  plan: null,
  step: connectStep(),
  selected: new Set(),
  selectionFor: null,
  reviewSelected: new Set(),
  reviewOpen: true,
  upToDateOpen: false,
  busy: false,
  error: null,
  notice: null,
};

/** Plateforme affichée : celle de l'aperçu s'il existe, sinon celle choisie */
export const currentPlatform = (): ImportPlatform => (state.plan ? importPlatformOf(state.plan) : state.platform);

export const isRunning = (): boolean => state.job?.status === 'running';

export function setPlan(plan: CrImportPlan | null): void {
  state.plan = plan;
  // Nouvel aperçu : sélection par défaut ; mise à jour du même aperçu (résultats) : sélection conservée, éléments faits retirés
  if (plan && plan.builtAt !== state.selectionFor) {
    state.selectionFor = plan.builtAt;
    state.selected = new Set(defaultSelection(plan));
    state.reviewSelected = new Set(plan.review.filter((r) => !r.created).map((r) => r.key));
    state.reviewOpen = true;
    state.upToDateOpen = false;
  } else if (plan) {
    for (const item of plan.items) if (item.result?.outcome === 'updated') state.selected.delete(item.id);
    for (const review of plan.review) if (review.created) state.reviewSelected.delete(review.key);
  }
}
