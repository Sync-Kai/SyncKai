// Réglages › Mes données › Écarts AniList ↔ MAL : textes et choix de la page, purs et testés sans DOM (répartition,
// filtres affichés, raisons des boutons sans objet, séries en échec, bilan de l'alignement, compteur de la ligne qui
// ouvre la page).
import { t, tp, type PluralKey } from '../../i18n';
import { DIFF_FILTERS, diffBreakdown, matchesFilter, planApply, skipReasonText, type ComparisonResult, type DiffFilter, type ListDiff } from '../../shared/compare';
import type { CompareJob } from '../../shared/compare-job';
import type { TrackerId } from '../../shared/tracker.types';

/** Les deux services, dans l'ordre des boutons « Garder … » */
export const COMPARE_SIDES: readonly TrackerId[] = ['anilist', 'mal'];

/** Compteur de la ligne « Écarts » (Mes données, Activité) : null avant la première analyse */
export function diffBadge(result: ComparisonResult | null): number | null {
  return result === null ? null : result.items.length;
}

const FILTER_BREAKDOWN: Partial<Record<DiffFilter, PluralKey>> = {
  missingMal: 'compare.breakdown.missingMal',
  missingAniList: 'compare.breakdown.missingAniList',
  progress: 'compare.breakdown.progress',
  status: 'compare.breakdown.status',
  score: 'compare.breakdown.score',
};

/** « 2 absentes de MAL · 3 progressions · 1 statut · 1 note » (types présents seulement) */
export function breakdownText(items: readonly ListDiff[]): string {
  const counts = diffBreakdown(items);
  return DIFF_FILTERS.flatMap((filter) => {
    const key = FILTER_BREAKDOWN[filter];
    return key && counts[filter] > 0 ? [tp(key, counts[filter])] : [];
  }).join(' · ');
}

/** Filtres proposés : « Tout », les types présents, et le filtre choisi même vidé (il reste affiché après un alignement) */
export function visibleFilters(items: readonly ListDiff[], current: DiffFilter): { filter: DiffFilter; count: number }[] {
  const counts = diffBreakdown(items);
  return DIFF_FILTERS.filter((filter) => filter === 'all' || filter === current || counts[filter] > 0).map((filter) => ({ filter, count: counts[filter] }));
}

/** Séries du filtre choisi */
export const filteredDiffs = (items: readonly ListDiff[], filter: DiffFilter): ListDiff[] => items.filter((diff) => matchesFilter(diff, filter));

/**
 * Raisons des boutons « Garder … » sans objet, écrites sous la ligne (une par raison). Une série modifiée depuis
 * l'analyse a son propre texte : ses raisons ne sont pas répétées.
 */
export function skipNotes(diff: ListDiff): string[] {
  if (diff.stale === true) return [];
  const notes = COMPARE_SIDES.flatMap((source) => {
    const plan = planApply(diff, source);
    return plan.action === 'skip' ? [skipReasonText(plan.reason, source)] : [];
  });
  return [...new Set(notes)];
}

/** Séries dont l'alignement a échoué (« Réessayer les échecs »), dans l'ordre de la liste */
export function failedDiffs(result: ComparisonResult | null): ListDiff[] {
  if (!result) return [];
  return result.items.filter((diff) => result.errors[diff.key] !== undefined);
}

export type JobSummaryTone = 'success' | 'warning' | 'error';

/** Bilan d'un alignement fini : « Alignement terminé · 6 séries alignées · 1 échec » et son ton */
export function jobSummary(job: CompareJob): { text: string; tone: JobSummaryTone } {
  const parts = [
    job.updated > 0 && tp('compare.result.updated', job.updated),
    job.skipped > 0 && tp('compare.result.skipped', job.skipped),
    job.failed > 0 && tp('compare.result.failed', job.failed),
  ].filter((part): part is string => typeof part === 'string');
  const head = job.status === 'stopped' ? t('compare.job.stopped', { message: job.message ?? '' }) : t(job.status === 'cancelled' ? 'compare.job.cancelled' : 'compare.job.done');
  const tone: JobSummaryTone = job.status === 'stopped' || (job.failed > 0 && job.updated === 0) ? 'error' : job.failed > 0 || job.status === 'cancelled' ? 'warning' : 'success';
  return { text: [head, ...parts].join(' · '), tone };
}
