import { describe, expect, it } from 'vitest';
import type { HistorySeason } from './cr-history';
import {
  buildCrImportPlan,
  decideImport,
  defaultSelection,
  FINALIZE_ITEM,
  historySeasonLabel,
  isCrImportApplyPayload,
  isCrImportJob,
  isCrImportPlan,
  isCrImportReviewsPayload,
  planCounts,
  readResolutions,
  seasonIndexOf,
  startAnalyzeJob,
  startApplyJob,
  toEpisodeInfo,
  withItemResult,
  withReviewsCreated,
  type CrCatalogEntry,
  type CrListState,
  type PlanInput,
  type SeasonResolution,
} from './cr-import';
import { reduceJob } from './job';

function season(over: Partial<HistorySeason> = {}): HistorySeason {
  return {
    seriesId: 'GRMG8ZQZR',
    seriesTitle: 'One Piece',
    seriesSlug: null,
    seasonId: 'GSOP24',
    seasonNumber: 24,
    seasonTitle: 'Elbaph',
    episodeId: 'GEOP1180',
    episodeTitle: 'Le désespoir',
    episodeNumber: 1180,
    seasonEpisodeNumber: 25,
    watchedCount: 25,
    lastPlayedAt: 1,
    ...over,
  };
}

const mapping = (mediaId: number) => ({ mediaId, numbering: 'displayed' as const, offset: 0, episodes: null });
const certain = (key: string, mediaId: number, progress: number): SeasonResolution => ({ kind: 'certain', key, mediaId, progress, mapping: mapping(mediaId) });

function input(over: Partial<PlanInput> = {}): PlanInput {
  const catalog = new Map<number, CrCatalogEntry>([
    [21, { mediaId: 21, idMal: 21, title: 'ONE PIECE', coverUrl: 'https://img/op.jpg', episodes: null }],
    [100, { mediaId: 100, idMal: 200, title: 'Black Butler', coverUrl: null, episodes: 12 }],
    [300, { mediaId: 300, idMal: null, title: 'Sans MAL', coverUrl: null, episodes: 24 }],
  ]);
  return {
    seasons: [season()],
    resolutions: { '0': certain('crunchyroll:GRMG8ZQZR:s24', 21, 1180) },
    catalog,
    lists: { anilist: new Map<number, CrListState>(), mal: new Map<number, CrListState>() },
    services: ['anilist', 'mal'],
    excludedMediaIds: new Set(),
    stats: { items: 10, pages: 1, partial: false },
    ...over,
  };
}

describe('règles de l’import', () => {
  it('jamais de recul, jamais de réécriture identique', () => {
    expect(decideImport({ status: 'CURRENT', progress: 12 }, 10, 24)).toEqual({ action: 'skip', reason: 'up-to-date' });
    expect(decideImport({ status: 'CURRENT', progress: 10 }, 10, 24)).toEqual({ action: 'skip', reason: 'up-to-date' });
    expect(decideImport({ status: 'CURRENT', progress: 3 }, 10, 24)).toEqual({ action: 'update', progress: 10, status: 'CURRENT' });
  });

  it('terminée ou en revisionnage : jamais touchée ; dernier épisode → Terminé ; au-delà de la fiche : rien', () => {
    expect(decideImport({ status: 'COMPLETED', progress: 12 }, 12, 12)).toEqual({ action: 'skip', reason: 'completed' });
    expect(decideImport({ status: 'REPEATING', progress: 2 }, 8, 12)).toEqual({ action: 'skip', reason: 'repeating' });
    expect(decideImport(null, 12, 12)).toEqual({ action: 'update', progress: 12, status: 'COMPLETED' });
    expect(decideImport({ status: 'PAUSED', progress: 2 }, 5, null)).toEqual({ action: 'update', progress: 5, status: 'CURRENT' });
    expect(decideImport(null, 13, 12)).toEqual({ action: 'skip', reason: 'beyond' });
  });
});

describe('aperçu', () => {
  it('saisons sûres regroupées par fiche (progression maximale), état actuel → nouvelle valeur par service', () => {
    const plan = buildCrImportPlan(
      input({
        seasons: [season({ seasonNumber: 1, seasonTitle: 'Black Butler', seriesTitle: 'Black Butler', seriesId: 'GRBB' }), season({ seasonNumber: 2, seriesId: 'GRBB', seriesTitle: 'Black Butler', seasonTitle: 'Book of Circus' })],
        resolutions: { '0': certain('crunchyroll:GRBB:s1', 100, 5), '1': certain('crunchyroll:GRBB:s2', 100, 9) },
        lists: { anilist: new Map([[100, { status: 'CURRENT', progress: 7 }]]), mal: new Map([[200, { status: 'CURRENT', progress: 9 }]]) },
      }),
      42,
    );
    expect(plan.items).toHaveLength(1);
    const [item] = plan.items;
    expect(item).toMatchObject({ id: 'm:100', mediaId: 100, malId: 200, title: 'Black Butler', progress: 9, seasons: ['Black Butler · S1', 'Black Butler · S2 (Book of Circus)'] });
    expect(item?.services).toEqual([
      { service: 'anilist', current: { status: 'CURRENT', progress: 7 }, action: 'update', progress: 9, status: 'CURRENT' },
      { service: 'mal', current: { status: 'CURRENT', progress: 9 }, action: 'skip', reason: 'up-to-date' },
    ]);
    expect(item?.mappings.map((m) => m.key)).toEqual(['crunchyroll:GRBB:s1', 'crunchyroll:GRBB:s2']);
    expect(planCounts(plan)).toEqual({ toUpdate: 1, upToDate: 0, review: 0, reviewPending: 0 });
    expect(defaultSelection(plan)).toEqual(['m:100']);
  });

  it('absente de la liste : ajout ; pas d’équivalent MAL : ignorée sur MAL', () => {
    const plan = buildCrImportPlan(input({ seasons: [season()], resolutions: { '0': certain('k', 300, 3) } }), 0);
    expect(plan.items[0]?.services).toEqual([
      { service: 'anilist', current: null, action: 'update', progress: 3, status: 'CURRENT' },
      { service: 'mal', current: null, action: 'skip', reason: 'no-equivalent' },
    ]);
  });

  it('déjà à jour partout : non coché', () => {
    const plan = buildCrImportPlan(
      input({ lists: { anilist: new Map([[21, { status: 'CURRENT', progress: 1180 }]]), mal: new Map([[21, { status: 'COMPLETED', progress: 1000 }]]) } }),
      0,
    );
    expect(planCounts(plan)).toMatchObject({ toUpdate: 0, upToDate: 1 });
    expect(defaultSelection(plan)).toEqual([]);
  });

  it('incertaine → « À vérifier » (une par saison) ; exclue, échec et fiche exclue comptées à part', () => {
    const review: SeasonResolution = { kind: 'review', key: 'crunchyroll:GRX:s2', reason: 'Saison 2 ?', suggestion: { mediaId: 5, progress: 3 }, candidates: [] };
    const plan = buildCrImportPlan(
      input({
        seasons: [season({ seriesId: 'GRX', seasonNumber: 2 }), season({ seriesId: 'GRX', seasonNumber: 2, seasonId: 'VF' }), season({ seriesId: 'GRE' }), season({ seriesId: 'GRF' }), season({ seriesId: 'GRM' })],
        resolutions: {
          '0': review,
          '1': review,
          '2': { kind: 'excluded', key: 'e' },
          '3': { kind: 'failed', key: 'f', message: 'Erreur AniList (500).' },
          '4': certain('m', 21, 4),
        },
        excludedMediaIds: new Set([21]),
      }),
      0,
    );
    expect(plan.items).toEqual([]);
    expect(plan.review).toHaveLength(1);
    expect(plan.review[0]).toMatchObject({ key: 'crunchyroll:GRX:s2', reason: 'Saison 2 ?', created: false, episode: { platform: 'crunchyroll', seriesId: 'GRX', displayedEpisodeNumber: 1180, seasonEpisodeNumber: 25 } });
    expect(plan).toMatchObject({ excluded: 2, failed: 1, seasonCount: 5 });
  });

  it('One Piece : saisons sûres en numérotation absolue → UNE ligne, épisode le plus avancé (1180)', () => {
    const op = (n: number, title: string, displayed: number, relative: number): HistorySeason =>
      season({ seasonNumber: n, seasonTitle: title, seasonId: `GSOP${n}`, episodeNumber: displayed, seasonEpisodeNumber: relative });
    const plan = buildCrImportPlan(
      input({
        seasons: [op(31, 'Elbaph (1156-current)', 1180, 25), op(3, 'Alabasta (62-143)', 143, 82), op(5, 'Skypiea (136-206)', 206, 71)],
        resolutions: { '0': certain('crunchyroll:GRMG8ZQZR:s31', 21, 1180), '1': certain('crunchyroll:GRMG8ZQZR:s3', 21, 143), '2': certain('crunchyroll:GRMG8ZQZR:s5', 21, 206) },
      }),
      0,
    );
    expect(plan.items).toHaveLength(1);
    expect(plan.items[0]).toMatchObject({ mediaId: 21, progress: 1180 });
    expect(plan.items[0]?.seasons).toHaveLength(3);
  });

  it('vérifications d’une même série en numérotation absolue vers la même fiche : réunies (épisode le plus avancé)', () => {
    const op = (n: number, displayed: number, relative: number): HistorySeason =>
      season({ seasonNumber: n, seasonTitle: `Arc ${n}`, seasonId: `GSOP${n}`, episodeNumber: displayed, seasonEpisodeNumber: relative });
    const review = (n: number, progress: number): SeasonResolution => ({
      kind: 'review',
      key: `crunchyroll:GRMG8ZQZR:s${n}`,
      reason: 'Titre seul',
      suggestion: { mediaId: 21, progress },
      candidates: [],
    });
    const relativeReview: SeasonResolution = { kind: 'review', key: 'crunchyroll:GRMG8ZQZR:s40', reason: 'Saison 40 ?', suggestion: { mediaId: 21, progress: 3 }, candidates: [] };
    const plan = buildCrImportPlan(
      input({
        seasons: [op(3, 143, 82), op(31, 1180, 25), op(5, 206, 71), season({ seasonNumber: 40, seasonId: 'GS40', episodeNumber: 3, seasonEpisodeNumber: 3 })],
        resolutions: { '0': review(3, 143), '1': review(31, 1180), '2': review(5, 206), '3': relativeReview },
      }),
      0,
    );
    expect(plan.review).toHaveLength(2);
    expect(plan.review[0]).toMatchObject({ key: 'crunchyroll:GRMG8ZQZR:s31', suggestion: { progress: 1180 }, episode: { displayedEpisodeNumber: 1180 } });
    expect(plan.review[0]?.seasons).toEqual(['One Piece · S3 (Arc 3)', 'One Piece · S31 (Arc 31)', 'One Piece · S5 (Arc 5)']);
    // Numérotation relative : jamais réunie
    expect(plan.review[1]).toMatchObject({ key: 'crunchyroll:GRMG8ZQZR:s40', seasons: ['One Piece · S40 (Elbaph)'] });
    expect(isCrImportPlan(plan)).toBe(true);
  });

  it('résultats et vérifications inscrits dans le plan ; plan validé au stockage', () => {
    let plan = buildCrImportPlan(input(), 7);
    expect(isCrImportPlan(plan)).toBe(true);
    plan = withItemResult(plan, 'm:21', { outcome: 'updated', message: null });
    expect(plan.items[0]?.result).toEqual({ outcome: 'updated', message: null });
    expect(defaultSelection(plan)).toEqual([]);
    expect(isCrImportPlan(plan)).toBe(true);
    expect(withReviewsCreated({ ...plan, review: [] }, new Set(['x'])).review).toEqual([]);
    expect(isCrImportPlan({ ...plan, items: [{ ...plan.items[0], progress: 0 }] })).toBe(false);
  });
});

describe('épisode et libellé', () => {
  it('épisode équivalent à celui de la page de lecture (numéro affiché + position dans la saison)', () => {
    expect(toEpisodeInfo(season())).toEqual({
      platform: 'crunchyroll',
      episodeId: 'GEOP1180',
      seriesId: 'GRMG8ZQZR',
      seriesSlug: null,
      animeTitle: 'One Piece',
      seasonNumber: 24,
      seasonTitle: 'Elbaph',
      seasonEpisodeNumber: 25,
      displayedEpisodeNumber: 1180,
      episodeTitle: 'Le désespoir',
      url: 'https://www.crunchyroll.com/watch/GEOP1180',
    });
  });

  it('titre de saison générique omis', () => {
    expect(historySeasonLabel({ seriesTitle: 'Black Butler', seasonNumber: 4, seasonTitle: 'Black Butler' })).toBe('Black Butler · S4');
  });

  it('correspondances relues : entrées illisibles ignorées', () => {
    expect(readResolutions({ '0': certain('k', 1, 1), '1': { kind: 'certain', key: 'k' }, x: certain('k', 1, 1) })).toEqual({ '0': certain('k', 1, 1) });
    expect(readResolutions(null)).toEqual({});
  });
});

describe('tâches d’import', () => {
  it('analyse : une étape par saison puis la construction de l’aperçu', () => {
    const job = startAnalyzeJob(2, 0);
    expect(job).toMatchObject({ kind: 'cr-analyze', total: 3, pending: ['s:0', 's:1', FINALIZE_ITEM] });
    expect(seasonIndexOf('s:1')).toBe(1);
    expect(seasonIndexOf(FINALIZE_ITEM)).toBeNull();
    expect(isCrImportJob(job)).toBe(true);
    expect(isCrImportJob(reduceJob(job, { type: 'item', outcome: 'updated', at: 1 }))).toBe(true);
  });

  it('application : éléments du plan ; tâche invalide refusée', () => {
    const job = startApplyJob(['m:21'], 0);
    expect(isCrImportJob(job)).toBe(true);
    expect(isCrImportJob({ ...job, kind: 'apply' })).toBe(false);
    expect(isCrImportJob({ ...job, pending: ['drop table'] })).toBe(false);
  });

  it('messages : identifiants et clés validés', () => {
    expect(isCrImportApplyPayload({ ids: ['m:21'] })).toBe(true);
    expect(isCrImportApplyPayload({ ids: [] })).toBe(false);
    expect(isCrImportApplyPayload({ ids: ['21'] })).toBe(false);
    expect(isCrImportReviewsPayload({ keys: ['crunchyroll:GRX:s2'] })).toBe(true);
    expect(isCrImportReviewsPayload({ keys: [''] })).toBe(false);
  });
});
