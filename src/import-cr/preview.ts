import { t, tp, type MessageKey, type PluralKey } from '../i18n';
import type { HistoryStats } from '../platforms/crunchyroll/history';
import { hasUpdate, planCounts, type CrImportJob, type CrImportPlan, type CrPlanItem, type CrReviewItem, type CrServicePlan } from '../shared/cr-import';
import type { CandidateSummary } from '../shared/review.types';

// Étapes 4 et 5 de l'import (maquettes ImportApercu, ImportApercuVariantes, ImportApplication, ImportTermine) : règles
// d'affichage sans DOM (testées) de l'aperçu, de l'import en cours et de son bilan. Rendu : components/preview.tsx.

/** Historique incomplet : trop long, ou « Voir plus » de Netflix non reconnu dans la langue du profil */
export function partialNotice(stats: HistoryStats): string {
  return t(stats.moreUnrecognized ? 'crImport.netflix.moreUnrecognized' : 'crImport.read.partial');
}

export interface SummaryTile {
  id: 'toUpdate' | 'review' | 'upToDate' | 'excluded' | 'ignored' | 'failed';
  count: number;
  /** `info` : à mettre à jour, `warn` : à vérifier, `danger` : introuvables, `neutral` : le reste */
  tone: 'info' | 'warn' | 'danger' | 'neutral';
  label: string;
}

const TILE_LABELS: Readonly<Record<SummaryTile['id'], PluralKey>> = {
  toUpdate: 'crImport.summary.toUpdate',
  review: 'crImport.summary.review',
  upToDate: 'crImport.summary.upToDate',
  excluded: 'crImport.summary.excluded',
  ignored: 'crImport.summary.ignored',
  failed: 'crImport.summary.failed',
};

/** Cases du résumé : séries à mettre à jour toujours (même à 0), les autres compteurs seulement quand ils comptent */
export function summaryTiles(plan: CrImportPlan): SummaryTile[] {
  const counts = planCounts(plan);
  const tiles: Omit<SummaryTile, 'label'>[] = [
    { id: 'toUpdate', count: counts.toUpdate, tone: 'info' },
    { id: 'review', count: counts.review, tone: 'warn' },
    { id: 'upToDate', count: counts.upToDate, tone: 'neutral' },
    { id: 'excluded', count: plan.excluded, tone: 'neutral' },
    { id: 'ignored', count: plan.ignored ?? 0, tone: 'neutral' },
    { id: 'failed', count: plan.failed, tone: 'danger' },
  ];
  return tiles.filter((tile) => tile.id === 'toUpdate' || tile.count > 0).map((tile) => ({ ...tile, label: tp(TILE_LABELS[tile.id], tile.count) }));
}

const SKIP_KEYS: Readonly<Record<Extract<CrServicePlan, { action: 'skip' }>['reason'], MessageKey>> = {
  'up-to-date': 'crImport.skipReason.up-to-date',
  completed: 'crImport.skipReason.completed',
  repeating: 'crImport.skipReason.repeating',
  beyond: 'crImport.skipReason.beyond',
  'no-equivalent': 'crImport.skipReason.no-equivalent',
};

/** Pastille d'un service : « 3 → 6 », « ajout → 12 (terminé) » ou la raison de ne rien écrire (« déjà à jour ») */
export function serviceChipText(plan: CrServicePlan): string {
  if (plan.action === 'skip') return t(SKIP_KEYS[plan.reason]);
  const from = plan.current ? String(plan.current.progress) : t('crImport.preview.add');
  return `${from} → ${plan.progress}${plan.status === 'COMPLETED' ? ` ${t('crImport.preview.completed')}` : ''}`;
}

/** Ligne cochable : la série avance sur au moins un service et n'a pas encore été écrite */
export const isSelectable = (item: CrPlanItem): boolean => hasUpdate(item) && item.result?.outcome !== 'updated';

/** Résultat d'une ligne après l'import : mis à jour, échec (avec sa raison), rien d'écrit */
export function itemResult(item: CrPlanItem): { tone: 'success' | 'error' | 'muted'; text: string } | null {
  const result = item.result;
  if (!result) return null;
  if (result.outcome === 'updated') return { tone: 'success', text: t('crImport.result.updated') };
  return { tone: result.outcome === 'failed' ? 'error' : 'muted', text: result.message ?? t(`crImport.result.${result.outcome}`) };
}

/** Légende du bouton « Mettre à jour » ; null : rien à dire (tout est coché) */
export type ApplyHint = 'locked' | 'none' | 'stopped' | 'failed' | 'unchecked';

export function applyHint({ selectable, selected, running, job }: { selectable: number; selected: number; running: boolean; job: CrImportJob | null }): ApplyHint | null {
  if (running) return 'locked';
  if (selected === 0) return 'none';
  // Après un import arrêté ou en échec : ce qui reste coché n'a pas été écrit
  if (job?.status === 'stopped' || job?.status === 'cancelled') return 'stopped';
  if (job?.status === 'done' && job.failed > 0) return 'failed';
  return selected < selectable ? 'unchecked' : null;
}

export const APPLY_HINTS: Readonly<Record<ApplyHint, MessageKey>> = {
  locked: 'crImport.preview.hint.locked',
  none: 'crImport.preview.hint.none',
  stopped: 'crImport.preview.hint.stopped',
  failed: 'crImport.preview.hint.failed',
  unchecked: 'crImport.preview.hint.unchecked',
};

/**
 * Bilan de l'import (jusqu'à « OK ») : terminé, arrêté par l'utilisateur ou interrompu (session, réseau), avec les
 * compteurs ; `details` : raisons des lignes en échec ou ignorées (sans la raison de l'arrêt, déjà en tête)
 */
export function applyEnd(job: CrImportJob): { tone: 'success' | 'warning' | 'error'; text: string; details: string[] } {
  const head = job.status === 'stopped' ? t('crImport.apply.stopped', { message: job.message ?? '' }) : t(job.status === 'cancelled' ? 'crImport.apply.cancelled' : 'crImport.apply.done');
  const parts = [
    job.updated > 0 && tp('compare.result.updated', job.updated),
    job.skipped > 0 && tp('compare.result.skipped', job.skipped),
    job.failed > 0 && tp('compare.result.failed', job.failed),
  ].filter((part): part is string => typeof part === 'string');
  const tone = job.status === 'stopped' || (job.failed > 0 && job.updated === 0) ? 'error' : job.failed > 0 || job.status === 'cancelled' ? 'warning' : 'success';
  const details = job.failed + job.skipped > 0 ? job.messages.filter((message) => message !== job.message) : [];
  return { tone, text: [head, ...parts].join(' · '), details };
}

export interface ReviewGroup {
  key: string;
  title: string;
  items: CrReviewItem[];
}

/** Vérifications regroupées par série (One Piece : un seul bloc), dans l'ordre du plan */
export function reviewGroups(review: readonly CrReviewItem[]): ReviewGroup[] {
  const groups = new Map<string, ReviewGroup>();
  for (const item of review) {
    const key = item.episode.seriesId ?? item.episode.animeTitle;
    const group = groups.get(key) ?? { key, title: item.episode.animeTitle, items: [] };
    group.items.push(item);
    groups.set(key, group);
  }
  return [...groups.values()];
}

/** Libellé sans le titre de la série (affiché en tête du groupe) : « S3 (Alabasta (62-143)) », ou « Série » */
export function seasonPart(item: CrReviewItem): string {
  const prefix = `${item.episode.animeTitle} · `;
  return item.label.startsWith(prefix) ? item.label.slice(prefix.length) : item.label === item.episode.animeTitle ? t('crImport.review.series') : item.label;
}

/**
 * Fiche que proposera la vérification (la suggestion, sinon la première, comme ui/review-view.ts › defaultCandidate) et
 * les autres au choix : une correspondance enregistrée contredite par l'analyse (revalidateCache) reste parmi elles
 */
export function reviewProposal(item: CrReviewItem): { proposed: CandidateSummary | null; others: CandidateSummary[] } {
  const proposed = item.candidates.find((c) => c.id === item.suggestion?.mediaId) ?? item.candidates[0] ?? null;
  return { proposed, others: item.candidates.filter((c) => c !== proposed) };
}
