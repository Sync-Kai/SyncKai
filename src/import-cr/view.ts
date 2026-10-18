import { t } from '../i18n';
import type { CrImportJob, CrImportPlan } from '../shared/cr-import';
import type { ReadProgress } from './sources/source';
import type { PageState, PlatformTab, ReadStep, Step } from './state';

// Règles d'affichage de la page d'import, sans DOM (testées) : écran montré selon l'état relu (tâche, aperçu, étape),
// étape de l'indicateur, état de chaque plateforme (tuiles, barre d'action), textes de lecture et d'analyse.

/** Lecture en cours (Crunchyroll / ADN ou Netflix) */
export type ReadingStep = Extract<Step, { tabId: number }>;

export type ImportScreen =
  /** Comptes, accès et tâche relus : ni tuiles ni bouton tant que ce n'est pas fini */
  | { kind: 'loading' }
  /** Étape 1 : plateforme, onglet, « Lire mon historique » */
  | { kind: 'choose' }
  /** Étape 2 : lecture dans l'onglet */
  | { kind: 'reading'; step: ReadingStep }
  /** Étape 3 : historique lu, analyse demandée au service worker */
  | { kind: 'starting' }
  | { kind: 'analyzing'; job: CrImportJob }
  /** Analyse arrêtée ou interrompue avant l'aperçu */
  | { kind: 'analyze-ended'; job: CrImportJob }
  /** Étapes 4 et 5 : aperçu, avec l'import en cours ou son bilan (`job` : tâche d'import seulement) */
  | { kind: 'preview'; plan: CrImportPlan; job: CrImportJob | null };

/** Écran affiché ; une analyse en cours l'emporte sur l'écran de connexion (page rouverte, autre onglet) */
export function importScreen(page: Pick<PageState, 'loaded' | 'job' | 'plan' | 'step'>): ImportScreen {
  const { job, plan, step } = page;
  if (!page.loaded) return { kind: 'loading' };
  if (job?.kind === 'cr-analyze' && job.status === 'running') return { kind: 'analyzing', job };
  if (plan) return { kind: 'preview', plan, job: job?.kind === 'cr-apply' ? job : null };
  if (job?.kind === 'cr-analyze' && job.status !== 'done') return { kind: 'analyze-ended', job };
  if (step.kind === 'reading' || step.kind === 'netflix') return { kind: 'reading', step };
  if (step.kind === 'starting') return { kind: 'starting' };
  return { kind: 'choose' };
}

/** Étapes de l'indicateur, dans l'ordre */
export const IMPORT_STEPS = ['platform', 'reading', 'analysis', 'preview', 'import'] as const;
export type ImportStepId = (typeof IMPORT_STEPS)[number];

/** Étape en cours, de 1 à 5 ; 6 : import terminé, toutes les étapes faites */
export function currentStep(screen: ImportScreen): number {
  switch (screen.kind) {
    case 'loading':
    case 'choose':
      return 1;
    case 'reading':
      return 2;
    case 'starting':
    case 'analyzing':
    case 'analyze-ended':
      return 3;
    case 'preview':
      // Import terminé : toutes les étapes faites ; arrêté ou interrompu : l'étape 5 reste en cours
      return screen.job === null ? 4 : screen.job.status === 'done' ? 6 : 5;
  }
}

export type PlatformStatus = { kind: 'access' } | { kind: 'ready'; tabId: number; title: string | null } | { kind: 'waiting' } | { kind: 'none' };

/**
 * État d'une plateforme (sa tuile, et la barre d'action quand elle est choisie) : accès à autoriser avant tout, puis onglet
 * prêt, en attente de l'onglet ouvert par « Ouvrir … » (`opening`), ou aucun onglet
 */
export function platformStatus(tab: PlatformTab, opening: boolean): PlatformStatus {
  if (tab.access === false) return { kind: 'access' };
  if (tab.tabId !== null) return { kind: 'ready', tabId: tab.tabId, title: tab.tabTitle };
  return opening ? { kind: 'waiting' } : { kind: 'none' };
}

/** Lecture en cours d'après la progression reçue ; Netflix garde les lignes chargées et les titres filtrés */
export function readStep(previous: Step, progress: ReadProgress, tabId: number): ReadingStep {
  if (progress.kind === 'reading') return { ...progress, tabId };
  const before = previous.kind === 'netflix' ? previous : null;
  const rows = progress.phase === 'rows' ? progress.done : (before?.rows ?? 0);
  const titles = progress.phase === 'titles' ? progress.total : (before?.titles ?? 0);
  return { ...progress, rows, titles, tabId };
}

export interface Progress {
  done: number;
  total: number;
}

/** Lecture Crunchyroll / ADN : connexion, pages lues (total inconnu, sans barre), puis vérification de la numérotation */
export function readingStatus(step: Extract<ReadStep, { kind: 'reading' }>, platform: string): { text: string; progress: Progress | null } {
  if (step.lookupsTotal > 0) return { text: t('crImport.read.lookups', { done: step.lookups, total: step.lookupsTotal }), progress: { done: step.lookups, total: step.lookupsTotal } };
  if (step.pages > 0) return { text: t('crImport.read.progress', { pages: step.pages, items: step.items }), progress: null };
  return { text: t('crImport.read.starting', { platform }), progress: null };
}

export interface NetflixPhase {
  id: Extract<ReadStep, { kind: 'netflix' }>['phase'];
  state: 'done' | 'current' | 'pending';
  text: string;
  progress: Progress | null;
}

const PHASES = ['rows', 'titles', 'shows'] as const;

/** Lecture Netflix en trois temps : lignes (« Voir plus »), titres filtrés sur AniList, progression des séries gardées */
export function netflixPhases(step: Extract<ReadStep, { kind: 'netflix' }>): NetflixPhase[] {
  const current = PHASES.indexOf(step.phase);
  return PHASES.map((id, index): NetflixPhase => {
    const state = index < current ? 'done' : index === current ? 'current' : 'pending';
    const progress = state === 'current' && id !== 'rows' ? { done: step.done, total: step.total } : null;
    switch (id) {
      case 'rows':
        if (state === 'done') return { id, state, text: t('crImport.netflix.rowsDone', { rows: step.rows }), progress };
        return { id, state, text: step.done > 0 ? t('crImport.netflix.rows', { rows: step.done }) : t('crImport.read.starting', { platform: 'Netflix' }), progress };
      case 'titles':
        if (state === 'done') return { id, state, text: t('crImport.netflix.titles', { done: step.titles, total: step.titles }), progress };
        return { id, state, text: state === 'current' ? t('crImport.netflix.titles', { done: step.done, total: step.total }) : t('crImport.netflix.titlesNext'), progress };
      case 'shows':
        return { id, state, text: state === 'current' ? t('crImport.netflix.shows', { done: step.done, total: step.total }) : t('crImport.netflix.showsNext'), progress };
    }
  });
}

/** Progression d'une tâche de fond : l'analyse ne montre pas son étape finale (lecture des listes) comme une saison */
export function jobProgress(job: CrImportJob): { analyzing: boolean; done: number; total: number; finalizing: boolean; text: string } {
  const analyzing = job.kind === 'cr-analyze';
  const total = analyzing ? Math.max(0, job.total - 1) : job.total;
  const done = Math.min(job.done, total);
  const finalizing = analyzing && job.done >= total;
  const text = analyzing ? (finalizing ? t('crImport.analyze.finalizing') : t('crImport.analyze.running', { done, total })) : t('crImport.apply.running', { done, total });
  return { analyzing, done, total, finalizing, text };
}

/** Bilan d'une analyse sans aperçu : interrompue (session expirée, compte changé…) ou arrêtée par l'utilisateur */
export function analyzeEnd(job: CrImportJob): { tone: 'error' | 'warn'; text: string } {
  return job.status === 'stopped' ? { tone: 'error', text: t('crImport.analyze.stopped', { message: job.message ?? '' }) } : { tone: 'warn', text: t('crImport.analyze.cancelled') };
}
