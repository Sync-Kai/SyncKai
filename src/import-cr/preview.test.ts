import { describe, expect, it } from 'vitest';
import { t, tp } from '../i18n';
import { startApplyJob, type CrImportJob, type CrImportPlan, type CrPlanItem, type CrReviewItem } from '../shared/cr-import';
import type { CandidateSummary } from '../shared/review.types';
import { applyEnd, applyHint, isSelectable, itemResult, partialNotice, reviewGroups, reviewProposal, seasonPart, serviceChipText, summaryTiles } from './preview';

// Étapes 4 et 5 de l'import (aperçu, import, bilan) : règles d'affichage sans DOM.

const item = (patch: Partial<CrPlanItem> = {}): CrPlanItem => ({
  id: 'm:1',
  mediaId: 1,
  malId: 11,
  title: 'Frieren',
  coverUrl: null,
  episodes: 28,
  progress: 6,
  seasons: ['Frieren · S1'],
  services: [{ service: 'anilist', current: { status: 'CURRENT', progress: 3 }, action: 'update', progress: 6, status: 'CURRENT' }],
  mappings: [],
  result: null,
  ...patch,
});

const upToDate = (id: number): CrPlanItem =>
  item({ id: `m:${id}`, mediaId: id, services: [{ service: 'anilist', current: { status: 'CURRENT', progress: 6 }, action: 'skip', reason: 'up-to-date' }] });

const plan = (patch: Partial<CrImportPlan> = {}): CrImportPlan => ({
  builtAt: 1,
  services: ['anilist', 'mal'],
  stats: { items: 40, pages: 1, partial: false },
  seasonCount: 4,
  items: [],
  review: [],
  excluded: 0,
  failed: 0,
  ...patch,
});

const candidate = (id: number, title: string): CandidateSummary => ({ id, title, format: 'TV', episodes: 12, year: 2023, coverUrl: null });

const review = (patch: Partial<CrReviewItem> = {}): CrReviewItem => ({
  key: 'crunchyroll:GRX:s2',
  label: 'Mushoku Tensei · S2',
  seasons: ['Mushoku Tensei · S2'],
  episode: {
    platform: 'crunchyroll',
    episodeId: 'E1',
    seriesId: 'GRX',
    seriesSlug: null,
    animeTitle: 'Mushoku Tensei',
    seasonNumber: 2,
    seasonTitle: null,
    seasonEpisodeNumber: 12,
    displayedEpisodeNumber: 12,
    episodeTitle: null,
    url: 'https://www.crunchyroll.com/watch/E1',
  },
  reason: 'Titre seul',
  suggestion: null,
  candidates: [],
  created: false,
  ...patch,
});

const applyJob = (patch: Partial<CrImportJob> = {}): CrImportJob => ({ ...startApplyJob(['m:1', 'm:2'], 0).job, ...patch });

describe('aperçu : résumé', () => {
  it('séries à mettre à jour toujours, les autres compteurs seulement quand ils comptent', () => {
    const tiles = summaryTiles(plan({ items: [item(), upToDate(2), upToDate(3)], review: [review()], excluded: 1, failed: 2 }));
    expect(tiles).toEqual([
      { id: 'toUpdate', count: 1, tone: 'info', label: tp('crImport.summary.toUpdate', 1) },
      { id: 'review', count: 1, tone: 'warn', label: tp('crImport.summary.review', 1) },
      { id: 'upToDate', count: 2, tone: 'neutral', label: tp('crImport.summary.upToDate', 2) },
      { id: 'excluded', count: 1, tone: 'neutral', label: tp('crImport.summary.excluded', 1) },
      { id: 'failed', count: 2, tone: 'danger', label: tp('crImport.summary.failed', 2) },
    ]);
    // Rien à mettre à jour : la case reste (à 0)
    expect(summaryTiles(plan({ items: [upToDate(2)] })).map((tile) => [tile.id, tile.count])).toEqual([
      ['toUpdate', 0],
      ['upToDate', 1],
    ]);
  });

  it('Netflix : titres écartés (pas des animes)', () => {
    expect(summaryTiles(plan({ platform: 'netflix', ignored: 12 })).map((tile) => tile.id)).toEqual(['toUpdate', 'ignored']);
  });

  it('historique incomplet : trop long, ou « Voir plus » non reconnu', () => {
    expect(partialNotice({ items: 1, pages: 1, partial: true })).toBe(t('crImport.read.partial'));
    expect(partialNotice({ items: 1, pages: 1, partial: true, moreUnrecognized: true })).toBe(t('crImport.netflix.moreUnrecognized'));
  });
});

describe('aperçu : lignes', () => {
  it('pastille d’un service : progression, ajout, terminé, ou raison de ne rien écrire', () => {
    expect(serviceChipText({ service: 'anilist', current: { status: 'CURRENT', progress: 3 }, action: 'update', progress: 6, status: 'CURRENT' })).toBe('3 → 6');
    expect(serviceChipText({ service: 'mal', current: null, action: 'update', progress: 12, status: 'COMPLETED' })).toBe(`${t('crImport.preview.add')} → 12 ${t('crImport.preview.completed')}`);
    expect(serviceChipText({ service: 'mal', current: null, action: 'skip', reason: 'repeating' })).toBe(t('crImport.skipReason.repeating'));
  });

  it('cochable tant que la série avance quelque part et n’est pas encore écrite', () => {
    expect(isSelectable(item())).toBe(true);
    expect(isSelectable(upToDate(2))).toBe(false);
    expect(isSelectable(item({ result: { outcome: 'updated', message: null } }))).toBe(false);
    expect(isSelectable(item({ result: { outcome: 'failed', message: 'MyAnimeList : délai dépassé' } }))).toBe(true);
  });

  it('résultat d’une ligne après l’import', () => {
    expect(itemResult(item())).toBeNull();
    expect(itemResult(item({ result: { outcome: 'updated', message: null } }))).toEqual({ tone: 'success', text: t('crImport.result.updated') });
    expect(itemResult(item({ result: { outcome: 'failed', message: 'MyAnimeList : délai dépassé' } }))).toEqual({ tone: 'error', text: 'MyAnimeList : délai dépassé' });
    expect(itemResult(item({ result: { outcome: 'failed', message: null } }))).toEqual({ tone: 'error', text: t('crImport.result.failed') });
    expect(itemResult(item({ result: { outcome: 'skipped', message: null } }))).toEqual({ tone: 'muted', text: t('crImport.result.skipped') });
  });
});

describe('aperçu : bouton « Mettre à jour » et sa légende', () => {
  const hint = (patch: Partial<Parameters<typeof applyHint>[0]> = {}) => applyHint({ selectable: 3, selected: 3, running: false, job: null, ...patch });

  it('tout coché : rien à dire ; une ligne décochée n’est pas écrite ; aucune cochée', () => {
    expect(hint()).toBeNull();
    expect(hint({ selected: 2 })).toBe('unchecked');
    expect(hint({ selected: 0 })).toBe('none');
  });

  it('import en cours : cases et boutons bloqués', () => {
    expect(hint({ running: true, job: applyJob() })).toBe('locked');
  });

  it('après un import arrêté ou en échec : ce qui reste coché', () => {
    expect(hint({ job: applyJob({ status: 'cancelled' }) })).toBe('stopped');
    expect(hint({ job: applyJob({ status: 'stopped', message: 'Session expirée' }) })).toBe('stopped');
    expect(hint({ job: applyJob({ status: 'done', failed: 2 }) })).toBe('failed');
    // Import terminé sans échec, nouvelle sélection : légende ordinaire
    expect(hint({ selected: 1, job: applyJob({ status: 'done' }) })).toBe('unchecked');
    // Aucune cochée l'emporte
    expect(hint({ selected: 0, job: applyJob({ status: 'done', failed: 2 }) })).toBe('none');
  });
});

describe('import terminé, arrêté ou interrompu : bilan', () => {
  it('terminé sans échec', () => {
    expect(applyEnd(applyJob({ status: 'done', updated: 35 }))).toEqual({ tone: 'success', text: [t('crImport.apply.done'), tp('compare.result.updated', 35)].join(' · '), details: [] });
  });

  it('terminé avec des échecs : leurs raisons sous le bilan', () => {
    const job = applyJob({ status: 'done', updated: 35, failed: 2, messages: ['MyAnimeList : délai dépassé', 'MyAnimeList : fiche introuvable'] });
    expect(applyEnd(job)).toEqual({
      tone: 'warning',
      text: [t('crImport.apply.done'), tp('compare.result.updated', 35), tp('compare.result.failed', 2)].join(' · '),
      details: ['MyAnimeList : délai dépassé', 'MyAnimeList : fiche introuvable'],
    });
    // Rien d'écrit et des échecs : erreur
    expect(applyEnd(applyJob({ status: 'done', failed: 2 })).tone).toBe('error');
  });

  it('arrêté par l’utilisateur (attention), interrompu (erreur, raison en tête et pas répétée dessous)', () => {
    expect(applyEnd(applyJob({ status: 'cancelled', updated: 12 }))).toEqual({ tone: 'warning', text: [t('crImport.apply.cancelled'), tp('compare.result.updated', 12)].join(' · '), details: [] });
    const reason = 'MyAnimeList : compte déconnecté';
    const stopped = applyEnd(applyJob({ status: 'stopped', message: reason, updated: 12, skipped: 1, messages: [reason] }));
    expect(stopped).toEqual({ tone: 'error', text: [t('crImport.apply.stopped', { message: reason }), tp('compare.result.updated', 12), tp('compare.result.skipped', 1)].join(' · '), details: [] });
  });
});

describe('aperçu : à vérifier', () => {
  it('regroupées par série, dans l’ordre du plan', () => {
    const a = review({ key: 'a', label: 'One Piece · S23 (Egghead)', episode: { ...review().episode, seriesId: 'OP', animeTitle: 'One Piece' } });
    const b = review({ key: 'b' });
    const c = review({ key: 'c', label: 'One Piece · S24 (Elbaph)', episode: { ...review().episode, seriesId: 'OP', animeTitle: 'One Piece' } });
    expect(reviewGroups([a, b, c])).toEqual([
      { key: 'OP', title: 'One Piece', items: [a, c] },
      { key: 'GRX', title: 'Mushoku Tensei', items: [b] },
    ]);
  });

  it('libellé sans le titre de la série ; la série entière', () => {
    expect(seasonPart(review())).toBe('S2');
    expect(seasonPart(review({ label: 'Mushoku Tensei' }))).toBe(t('crImport.review.series'));
    expect(seasonPart(review({ label: 'Autre · S1' }))).toBe('Autre · S1');
  });

  it('fiche proposée par la vérification, les autres au choix (correspondance enregistrée comprise)', () => {
    const fresh = candidate(2, 'Frieren Season 2');
    const cached = candidate(1, 'Frieren');
    const other = candidate(3, 'Frieren Movie');
    expect(reviewProposal(review({ suggestion: { mediaId: 2, progress: 4 }, candidates: [fresh, cached, other] }))).toEqual({ proposed: fresh, others: [cached, other] });
    // Suggestion absente des fiches : la première est cochée dans la carte
    expect(reviewProposal(review({ suggestion: null, candidates: [cached, other] }))).toEqual({ proposed: cached, others: [other] });
    expect(reviewProposal(review())).toEqual({ proposed: null, others: [] });
  });
});
