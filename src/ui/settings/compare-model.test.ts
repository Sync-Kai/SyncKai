import { describe, expect, it } from 'vitest';
import { t, tp } from '../../i18n';
import type { ComparisonResult, DiffSide, ListDiff } from '../../shared/compare';
import { startApplyJob, type CompareJob } from '../../shared/compare-job';
import { breakdownText, diffBadge, failedDiffs, jobSummary, skipNotes, visibleFilters } from './compare-model';

const side = (patch: Partial<DiffSide> = {}): DiffSide => ({ status: 'CURRENT', progress: 3, score: null, repeat: 0, ...patch });

function diff(key: string, patch: Partial<ListDiff> = {}): ListDiff {
  return { key, mediaId: 1, malId: Number(key.replace('mal:', '')), title: key, coverUrl: null, anilist: side(), mal: side({ progress: 2 }), fields: ['progress'], ...patch };
}

function result(items: ListDiff[], errors: Record<string, string> = {}): ComparisonResult {
  return {
    analyzedAt: 0,
    scoreFormat: 'POINT_10_DECIMAL',
    counts: { compared: 10, identical: 10 - items.length, different: items.length, onlyAniList: 0, onlyMal: 0, notComparable: 0 },
    items,
    errors,
  };
}

function job(patch: Partial<CompareJob>): CompareJob {
  return { ...startApplyJob([{ mediaId: 1, malId: 1 }], 'anilist', { anilist: 0, mal: 0 }, 0).job, ...patch };
}

describe('Écarts AniList ↔ MAL : modèle de la page', () => {
  it('compteur de la ligne « Mes données » : rien avant la première analyse, sinon les écarts restants', () => {
    expect(diffBadge(null)).toBeNull();
    expect(diffBadge(result([]))).toBe(0);
    expect(diffBadge(result([diff('mal:1'), diff('mal:2')]))).toBe(2);
  });

  it('répartition : types présents seulement, dans l’ordre des filtres', () => {
    const items = [diff('mal:1'), diff('mal:2', { mal: null, fields: ['presence'] }), diff('mal:3', { fields: ['status'] })];
    expect(breakdownText(items)).toBe([tp('compare.breakdown.missingMal', 1), tp('compare.breakdown.progress', 1), tp('compare.breakdown.status', 1)].join(' · '));
    expect(breakdownText([])).toBe('');
  });

  it('filtres : « Tout », les types présents et le filtre choisi même vidé (après un alignement)', () => {
    const items = [diff('mal:1'), diff('mal:2', { fields: ['score'] })];
    expect(visibleFilters(items, 'all')).toEqual([
      { filter: 'all', count: 2 },
      { filter: 'progress', count: 1 },
      { filter: 'score', count: 1 },
    ]);
    expect(visibleFilters(items, 'missingAniList').map((f) => f.filter)).toEqual(['all', 'missingAniList', 'progress', 'score']);
  });

  it('raisons d’un bouton sans objet, sous la ligne : une par raison, jamais « modifiée » (texte à part)', () => {
    // Absente d'AniList : « Garder AniList » sans objet
    expect(skipNotes(diff('mal:1', { anilist: null, fields: ['presence'] }))).toEqual([t('compare.skip.missingSource', { service: 'AniList' })]);
    // Note seulement, MAL sans note : « Garder MAL » sans objet
    expect(skipNotes(diff('mal:2', { anilist: side({ score: 8.5 }), mal: side({ progress: 3 }), fields: ['score'] }))).toEqual([
      t('compare.skip.noScore', { service: 'MyAnimeList' }),
    ]);
    expect(skipNotes(diff('mal:3'))).toEqual([]);
    expect(skipNotes(diff('mal:4', { stale: true }))).toEqual([]);
  });

  it('séries en échec : celles qui ont une erreur d’alignement, dans l’ordre de la liste', () => {
    const items = [diff('mal:1'), diff('mal:2'), diff('mal:3')];
    expect(failedDiffs(result(items, { 'mal:3': 'MyAnimeList ne répond pas', 'mal:1': 'x' })).map((d) => d.key)).toEqual(['mal:1', 'mal:3']);
    expect(failedDiffs(null)).toEqual([]);
  });

  it('bilan : terminé (succès, avec échecs), arrêté, interrompu', () => {
    expect(jobSummary(job({ status: 'done', updated: 6 }))).toEqual({ text: [t('compare.job.done'), tp('compare.result.updated', 6)].join(' · '), tone: 'success' });
    expect(jobSummary(job({ status: 'done', updated: 6, failed: 1 }))).toEqual({
      text: [t('compare.job.done'), tp('compare.result.updated', 6), tp('compare.result.failed', 1)].join(' · '),
      tone: 'warning',
    });
    expect(jobSummary(job({ status: 'done', failed: 2 })).tone).toBe('error');
    expect(jobSummary(job({ status: 'cancelled', updated: 3, skipped: 1 }))).toEqual({
      text: [t('compare.job.cancelled'), tp('compare.result.updated', 3), tp('compare.result.skipped', 1)].join(' · '),
      tone: 'warning',
    });
    expect(jobSummary(job({ status: 'stopped', updated: 3, message: 'Session' }))).toEqual({
      text: [t('compare.job.stopped', { message: 'Session' }), tp('compare.result.updated', 3)].join(' · '),
      tone: 'error',
    });
  });
});
