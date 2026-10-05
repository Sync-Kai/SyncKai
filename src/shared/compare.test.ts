import { describe, expect, it } from 'vitest';
import {
  applicableDiffs,
  applyImpact,
  diffBreakdown,
  matchesFilter,
  compareLists,
  findDiff,
  isApplyDiffsPayload,
  isComparisonResult,
  malScoreFrom,
  planApply,
  scoresMatch,
  withDiffError,
  withoutDiff,
  type AniListListEntry,
  type ListDiff,
  type MalListEntry,
} from './compare';
import { aniListScoreOn10 } from './score';

const al = (patch: Partial<AniListListEntry> = {}): AniListListEntry => ({
  mediaId: 1,
  malId: 101,
  title: 'Frieren',
  coverUrl: 'https://s4.anilist.co/a.jpg',
  status: 'CURRENT',
  progress: 5,
  score: null,
  repeat: 0,
  ...patch,
});

const mal = (patch: Partial<MalListEntry> = {}): MalListEntry => ({
  malId: 101,
  mediaId: null,
  title: 'Sousou no Frieren',
  coverUrl: 'https://cdn.myanimelist.net/a.jpg',
  status: 'CURRENT',
  progress: 5,
  score: null,
  repeat: 0,
  ...patch,
});

const compare = (anilist: AniListListEntry[], malList: MalListEntry[], scoreFormat: Parameters<typeof scoresMatch>[2] = 'POINT_10_DECIMAL') =>
  compareLists({ anilist, mal: malList, scoreFormat }, 1_000);

describe('scoresMatch (arrondi inférieur MAL)', () => {
  it('pas de note des deux côtés = identique ; une seule note = écart', () => {
    expect(scoresMatch(null, null, 'POINT_10_DECIMAL')).toBe(true);
    expect(scoresMatch(8, null, 'POINT_10_DECIMAL')).toBe(false);
    expect(scoresMatch(null, 8, 'POINT_10_DECIMAL')).toBe(false);
  });

  it('AniList 8,5 ↔ MAL 8 n’est pas un écart ; 8,5 ↔ 9 en est un', () => {
    expect(scoresMatch(8.5, 8, 'POINT_10_DECIMAL')).toBe(true);
    expect(scoresMatch(8.5, 9, 'POINT_10_DECIMAL')).toBe(false);
    expect(scoresMatch(7.8, 7, 'POINT_10_DECIMAL')).toBe(true);
  });

  it('POINT_100 : 85 ↔ 8, 90 ↔ 9, 85 ↔ 9 en écart', () => {
    expect(scoresMatch(85, 8, 'POINT_100')).toBe(true);
    expect(scoresMatch(90, 9, 'POINT_100')).toBe(true);
    expect(scoresMatch(85, 9, 'POINT_100')).toBe(false);
  });

  it('formats grossiers comparés dans le format du profil (POINT_5, POINT_3)', () => {
    expect(scoresMatch(4, 8, 'POINT_5')).toBe(true);
    expect(scoresMatch(5, 9, 'POINT_5')).toBe(true); // 9 → 5 étoiles
    expect(scoresMatch(3, 9, 'POINT_3')).toBe(true); // 9 → content
    expect(scoresMatch(3, 10, 'POINT_3')).toBe(true);
    expect(scoresMatch(1, 9, 'POINT_3')).toBe(false);
  });

  it('malScoreFrom : arrondi inférieur borné à 1–10 (3 smileys = 10)', () => {
    expect(malScoreFrom(8.5)).toBe(8);
    expect(malScoreFrom(0.5)).toBe(1);
    expect(malScoreFrom(aniListScoreOn10(3, 'POINT_3') ?? 0)).toBe(10);
  });
});

describe('compareLists', () => {
  it('entrées identiques : aucun écart', () => {
    const result = compare([al({ score: 8.5 })], [mal({ score: 8 })]);
    expect(result.items).toEqual([]);
    expect(result.counts).toEqual({ compared: 1, identical: 1, different: 0, onlyAniList: 0, onlyMal: 0, notComparable: 0 });
  });

  it('écarts de progression, de statut et de note', () => {
    const result = compare([al({ progress: 12, status: 'COMPLETED', score: 9 })], [mal({ progress: 10, status: 'CURRENT', score: 7 })]);
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({
      key: 'mal:101',
      mediaId: 1,
      malId: 101,
      title: 'Frieren',
      fields: ['progress', 'status', 'score'],
      anilist: { status: 'COMPLETED', progress: 12, score: 9 },
      mal: { status: 'CURRENT', progress: 10, score: 7 },
    });
    expect(result.counts.different).toBe(1);
  });

  it('statuts : chaque statut MAL normalisé correspond au statut AniList', () => {
    for (const status of ['CURRENT', 'PLANNING', 'COMPLETED', 'PAUSED', 'DROPPED', 'REPEATING'] as const) {
      expect(compare([al({ status })], [mal({ status })]).items).toEqual([]);
    }
    // Revisionnage d'un côté, terminé de l'autre
    expect(compare([al({ status: 'REPEATING' })], [mal({ status: 'COMPLETED' })]).items[0]?.fields).toEqual(['status']);
  });

  it('PLANNING avec progression : comparé tel quel', () => {
    expect(compare([al({ status: 'PLANNING', progress: 3 })], [mal({ status: 'PLANNING', progress: 0 })]).items[0]?.fields).toEqual(['progress']);
  });

  it('séries absentes d’un côté', () => {
    const result = compare([al({ mediaId: 1, malId: 101 }), al({ mediaId: 2, malId: 102, title: 'Bocchi' })], [mal({ malId: 101 }), mal({ malId: 103, mediaId: 3, title: 'Apothecary' })]);
    expect(result.items.map((d) => [d.key, d.fields, d.anilist !== null, d.mal !== null])).toEqual([
      ['mal:103', ['presence'], false, true],
      ['mal:102', ['presence'], true, false],
    ]);
    expect(result.counts).toMatchObject({ compared: 3, identical: 1, different: 2, onlyAniList: 1, onlyMal: 1 });
  });

  it('non comparables : AniList sans idMal, MAL sans fiche AniList', () => {
    const result = compare([al({ mediaId: 1, malId: null })], [mal({ malId: 200, mediaId: null })]);
    expect(result.items).toEqual([]);
    expect(result.counts).toEqual({ compared: 0, identical: 0, different: 0, onlyAniList: 0, onlyMal: 0, notComparable: 2 });
  });

  it('doublons : même fiche dans plusieurs listes (une fois), deux fiches pour un même idMal (non comparable)', () => {
    const result = compare([al(), al(), al({ mediaId: 9 })], [mal(), mal()]);
    expect(result.items).toEqual([]);
    expect(result.counts).toMatchObject({ compared: 1, identical: 1, notComparable: 1 });
  });

  it('série MAL dont la fiche AniList est déjà dans la liste (sous un autre idMal) : non comparable', () => {
    const result = compare([al({ mediaId: 1, malId: 101 })], [mal({ malId: 101 }), mal({ malId: 999, mediaId: 1 })]);
    expect(result.counts).toMatchObject({ onlyMal: 0, notComparable: 1 });
  });

  it('note AniList exprimée sur 10 (non arrondie) dans le résultat', () => {
    const result = compare([al({ score: 78 })], [mal({ score: 9 })], 'POINT_100');
    expect(result.items[0]?.anilist?.score).toBe(7.8);
  });

  it('trié par titre', () => {
    const result = compare([al({ mediaId: 1, malId: 1, title: 'b' }), al({ mediaId: 2, malId: 2, title: 'A' })], []);
    expect(result.items.map((d) => d.title)).toEqual(['A', 'b']);
  });
});

const diff = (patch: Partial<ListDiff> = {}): ListDiff => ({
  key: 'mal:101',
  mediaId: 1,
  malId: 101,
  title: 'Frieren',
  coverUrl: null,
  anilist: { status: 'CURRENT', progress: 12, score: 8.5, repeat: 0 },
  mal: { status: 'CURRENT', progress: 10, score: 7, repeat: 0 },
  fields: ['progress', 'score'],
  ...patch,
});

describe('planApply', () => {
  it('aligner sur AniList : écrit sur MAL les champs en écart (statut + progression ensemble)', () => {
    expect(planApply(diff(), 'anilist')).toEqual({ action: 'write', target: 'mal', id: 101, write: { status: 'CURRENT', progress: 12, score: 8.5 }, create: false });
  });

  it('aligner sur MAL : écrit sur AniList', () => {
    expect(planApply(diff(), 'mal')).toEqual({ action: 'write', target: 'anilist', id: 1, write: { status: 'CURRENT', progress: 10, score: 7 }, create: false });
  });

  it('écart de note seul : la progression n’est pas réécrite', () => {
    expect(planApply(diff({ fields: ['score'] }), 'mal')).toMatchObject({ write: { score: 7 } });
  });

  it('« pas de note » n’efface jamais une note existante', () => {
    const noScore = diff({ anilist: { status: 'CURRENT', progress: 10, score: null, repeat: 0 }, fields: ['score'] });
    expect(planApply(noScore, 'anilist')).toEqual({ action: 'skip', reason: 'no-score' });
    expect(planApply(noScore, 'mal')).toMatchObject({ action: 'write', write: { score: 7 } });
  });

  it('revisionnage : statut REPEATING et compteur recopiés', () => {
    const rewatch = diff({
      anilist: { status: 'REPEATING', progress: 3, score: null, repeat: 1 },
      mal: { status: 'COMPLETED', progress: 12, score: null, repeat: 0 },
      fields: ['progress', 'status'],
    });
    expect(planApply(rewatch, 'anilist')).toMatchObject({ target: 'mal', write: { status: 'REPEATING', progress: 3, repeat: 1 } });
    expect(planApply(rewatch, 'mal')).toMatchObject({ target: 'anilist', write: { status: 'COMPLETED', progress: 12, repeat: 0 } });
  });

  it('série absente de la destination : créée avec statut, progression, note et revisionnages', () => {
    const onlyAl = diff({ mal: null, fields: ['presence'], anilist: { status: 'PAUSED', progress: 4, score: 6, repeat: 2 } });
    expect(planApply(onlyAl, 'anilist')).toEqual({ action: 'write', target: 'mal', id: 101, write: { status: 'PAUSED', progress: 4, score: 6, repeat: 2 }, create: true });
    const onlyMal = diff({ anilist: null, fields: ['presence'], mal: { status: 'PLANNING', progress: 0, score: null, repeat: 0 } });
    expect(planApply(onlyMal, 'mal')).toEqual({ action: 'write', target: 'anilist', id: 1, write: { status: 'PLANNING', progress: 0 }, create: true });
  });

  it('jamais de suppression : source sans la série → rien', () => {
    expect(planApply(diff({ mal: null, fields: ['presence'] }), 'mal')).toEqual({ action: 'skip', reason: 'missing-source' });
    expect(planApply(diff({ anilist: null, fields: ['presence'] }), 'anilist')).toEqual({ action: 'skip', reason: 'missing-source' });
  });

  it('destination AniList sans fiche connue : rien', () => {
    expect(planApply(diff({ mediaId: null }), 'mal')).toEqual({ action: 'skip', reason: 'no-equivalent' });
  });

  it('applicableDiffs : séries réellement modifiées par un alignement en lot', () => {
    const items = [diff(), diff({ key: 'mal:2', malId: 2, mal: null, fields: ['presence'] })];
    expect(applicableDiffs(items, 'anilist').map((d) => d.key)).toEqual(['mal:101', 'mal:2']);
    expect(applicableDiffs(items, 'mal').map((d) => d.key)).toEqual(['mal:101']);
  });
});

describe('mise à jour de la comparaison', () => {
  const result = compare([al({ progress: 12 }), al({ mediaId: 2, malId: 102, title: 'Bocchi' })], [mal()]);

  it('findDiff par id MAL, sinon par fiche AniList', () => {
    expect(findDiff(result, { mediaId: null, malId: 102 })?.title).toBe('Bocchi');
    expect(findDiff(result, { mediaId: 1, malId: null })?.key).toBe('mal:101');
    expect(findDiff(result, { mediaId: null, malId: 5 })).toBeNull();
  });

  it('withoutDiff retire la série et met les compteurs à jour', () => {
    const errored = withDiffError(result, 'mal:102', 'boom');
    const next = withoutDiff(errored, 'mal:102');
    expect(next.items.map((d) => d.key)).toEqual(['mal:101']);
    expect(next.counts).toMatchObject({ identical: 1, different: 1, onlyAniList: 0 });
    expect(next.errors).toEqual({});
  });

  it('withDiffError ajoute puis efface une erreur', () => {
    const errored = withDiffError(result, 'mal:101', 'Erreur');
    expect(errored.errors).toEqual({ 'mal:101': 'Erreur' });
    expect(withDiffError(errored, 'mal:101', null).errors).toEqual({});
  });

  it('isComparisonResult valide le stockage', () => {
    expect(isComparisonResult(result)).toBe(true);
    expect(isComparisonResult({ ...result, scoreFormat: 'X' })).toBe(false);
    expect(isComparisonResult({ ...result, items: [{ ...result.items[0], fields: ['nope'] }] })).toBe(false);
    expect(isComparisonResult(null)).toBe(false);
  });
});

describe('payload APPLY_DIFFS', () => {
  it('accepte une liste d’identifiants et un service source', () => {
    expect(isApplyDiffsPayload({ items: [{ mediaId: 1, malId: 101 }, { mediaId: null, malId: 5 }], source: 'mal' })).toBe(true);
  });

  it('refuse liste vide, identifiants absents ou invalides, source inconnue', () => {
    expect(isApplyDiffsPayload({ items: [], source: 'mal' })).toBe(false);
    expect(isApplyDiffsPayload({ items: [{ mediaId: null, malId: null }], source: 'mal' })).toBe(false);
    expect(isApplyDiffsPayload({ items: [{ mediaId: 0, malId: 1 }], source: 'mal' })).toBe(false);
    expect(isApplyDiffsPayload({ items: [{ mediaId: 1, malId: 1 }], source: 'kitsu' })).toBe(false);
    expect(isApplyDiffsPayload({ items: Array.from({ length: 2001 }, () => ({ mediaId: 1, malId: 1 })), source: 'anilist' })).toBe(false);
  });
});

describe('répartition, filtres et impact', () => {
  const items: ListDiff[] = [
    diff({ key: 'mal:1', malId: 1, mal: null, fields: ['presence'] }),
    diff({ key: 'mal:2', malId: 2, mal: null, fields: ['presence'] }),
    diff({ key: 'mal:3', malId: 3, anilist: null, fields: ['presence'] }),
    diff({ key: 'mal:4', malId: 4, fields: ['progress', 'status'], anilist: { status: 'COMPLETED', progress: 12, score: null, repeat: 0 } }),
    diff({ key: 'mal:5', malId: 5, fields: ['score'], anilist: { status: 'CURRENT', progress: 10, score: null, repeat: 0 } }),
  ];

  it('diffBreakdown compte chaque type (une série peut en avoir plusieurs)', () => {
    expect(diffBreakdown(items)).toEqual({ all: 5, missingMal: 2, missingAniList: 1, progress: 1, status: 1, score: 1 });
  });

  it('matchesFilter', () => {
    expect(items.filter((d) => matchesFilter(d, 'missingMal')).map((d) => d.malId)).toEqual([1, 2]);
    expect(items.filter((d) => matchesFilter(d, 'missingAniList')).map((d) => d.malId)).toEqual([3]);
    expect(items.filter((d) => matchesFilter(d, 'status')).map((d) => d.malId)).toEqual([4]);
    expect(items.filter((d) => matchesFilter(d, 'all'))).toHaveLength(5);
  });

  it('applyImpact : ajouts, progressions, statuts, notes ; séries sans effet exclues', () => {
    // Sur AniList : 2 ajouts à MAL, 1 progression + statut ; la note absente d'AniList n'efface rien ; mal:3 absente d'AniList → rien
    expect(applyImpact(items, 'anilist')).toEqual({ total: 3, created: 2, progress: 1, status: 1, score: 0 });
    // Sur MAL : 1 ajout à AniList, progression + statut, note recopiée
    expect(applyImpact(items, 'mal')).toEqual({ total: 3, created: 1, progress: 1, status: 1, score: 1 });
  });
});
