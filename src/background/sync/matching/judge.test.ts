import { describe, expect, it } from 'vitest';
import { setLocale } from '../../../i18n';
import { judge, syncResult, type JudgeQuery } from './judge';
import type { MediaCandidate, ResolveResult } from './model';

// Juge unique (audit 1-§4.4) : chaque spécification nommée isolément, puis sa traduction pour la synchro.
setLocale('fr');

function candidate(overrides: Partial<MediaCandidate> & Pick<MediaCandidate, 'id'>): MediaCandidate {
  return { format: 'TV', episodes: 12, startDate: null, titles: [], link: null, ...overrides };
}

const query = (overrides: Partial<JudgeQuery> = {}): JudgeQuery => ({ platform: 'netflix', animeTitle: 'Bubble', seasonTitle: null, seasonNumber: 1, ...overrides });

const chosen = (mediaId: number, extra: { confidence?: 'high' | 'low'; bySignals?: true } = {}): ResolveResult => ({
  ok: true,
  target: { mediaId, numbering: 'season', offset: 0, episodes: 12, progress: 1, confidence: extra.confidence ?? 'high', reason: 'règle', ...(extra.bySignals ? { bySignals: true } : {}) },
});

const film = candidate({ id: 1, format: 'MOVIE', episodes: 1, titles: ['Bubble Movie'], link: 'id' });
const tv = candidate({ id: 2, titles: ['Bubble'] });

describe('judge : spécifications nommées', () => {
  it('unlinkedEntry : fiche non liée retenue à côté d’une fiche liée (série TV homonyme d’un film lié)', () => {
    expect(judge(query(), [film, tv], chosen(2))).toMatchObject({ verdict: 'linked', doubts: ['unlinkedEntry'] });
    expect(judge(query(), [film, tv], chosen(1)).doubts).toEqual([]);
  });

  it('unlinkedEntry : levé pour un groupe prouvé dans la franchise liée, gardé hors de celle-ci', () => {
    const first = candidate({ id: 10, titles: ['Bubble'], link: 'id', startDate: 20200101, relations: [{ id: 11, type: 'SEQUEL' }] });
    const part2 = candidate({ id: 11, titles: ['Bubble Part 2'], startDate: 20210101, relations: [{ id: 10, type: 'PREQUEL' }] });
    const remake = candidate({ id: 12, titles: ['Bubble'], startDate: 20240101 });
    expect(judge(query(), [first, part2], chosen(11, { bySignals: true })).doubts).toEqual([]);
    expect(judge(query(), [first, remake], chosen(12, { bySignals: true })).doubts).toEqual(['unlinkedEntry']);
  });

  it('titleOnly : plateforme généraliste sans fiche liée, fiche au titre de la série', () => {
    expect(judge(query(), [tv], chosen(2))).toMatchObject({ verdict: 'title', doubts: ['titleOnly'] });
  });

  it('singleEntry : fiche unique, suite d’une autre, qui ne couvre pas les saisons de la plateforme', () => {
    const sequel = candidate({ id: 3, titles: ['Bubble'], link: 'id', hasPrequel: true, episodes: 12 });
    expect(judge(query({ platformSeasons: [12, 12] }), [sequel], chosen(3)).doubts).toEqual(['singleEntry']);
    expect(judge(query({ platformSeasons: [12] }), [sequel], chosen(3)).doubts).toEqual([]);
  });

  it('wholeShow : fiche unique liée qui couvre toutes les saisons de la plateforme (arcs One Piece)', () => {
    const onePiece = candidate({ id: 21, titles: ['ONE PIECE'], link: 'id', episodes: null, startDate: 19991020 });
    expect(judge(query({ animeTitle: 'ONE PIECE', platformSeasons: [61, 77] }), [onePiece], chosen(21)).wholeShow).toBe(true);
    expect(judge(query({ animeTitle: 'ONE PIECE', platformSeasons: [61] }), [onePiece], chosen(21)).wholeShow).toBe(false);
  });

  it('unmatchedName : saison nommée sans fiche à son titre', () => {
    const series = candidate({ id: 4, titles: ['ONE PIECE'], link: 'id', episodes: null });
    const page = query({ platform: 'crunchyroll', animeTitle: 'ONE PIECE', seasonTitle: 'HEROINES', seasonNumber: null });
    expect(judge(page, [series], chosen(4)).doubts).toEqual(['unmatchedName']);
    expect(judge({ ...page, seasonTitle: 'ONE PIECE' }, [series], chosen(4)).doubts).toEqual([]);
  });

  it('countMismatch : épisodes de la saison sur la page contre le total du groupe de la fiche (parties comprises)', () => {
    const ii = candidate({ id: 5, titles: ['Mushoku Tensei II'], link: 'id', episodes: 12, startDate: 20230101, relations: [{ id: 6, type: 'SEQUEL' }] });
    const iiPart2 = candidate({ id: 6, titles: ['Mushoku Tensei II Part 2'], link: 'id', episodes: 12, startDate: 20240101 });
    const page = query({ platform: 'crunchyroll', animeTitle: 'Mushoku Tensei II' });
    expect(judge({ ...page, seasonEpisodeCount: 25 }, [ii, iiPart2], chosen(5)).doubts).toEqual([]);
    expect(judge({ ...page, seasonEpisodeCount: 12 }, [ii, iiPart2], chosen(5)).doubts).toEqual(['countMismatch']);
    expect(judge(page, [ii, iiPart2], chosen(5)).doubts).toEqual([]);
  });

  it('échec des règles : aucun doute, verdict seul', () => {
    expect(judge(query(), [film, tv], { ok: false, reason: 'x' })).toMatchObject({ verdict: 'linked', doubts: [], wholeShow: false, bySignals: false });
  });
});

describe('syncResult : doutes traduits pour la synchro', () => {
  it('plateforme spécialisée : résultat inchangé, quels que soient les doutes de page', () => {
    const page = query({ platform: 'crunchyroll', animeTitle: 'ONE PIECE', seasonTitle: 'HEROINES', seasonNumber: null });
    const result = chosen(4);
    expect(syncResult(page, judge(page, [candidate({ id: 4, titles: ['ONE PIECE'], link: 'id' })], result))).toBe(result);
  });

  it('fiche non liée à côté d’une fiche liée : confiance basse ; série inconnue : ignorée', () => {
    expect(syncResult(query(), judge(query(), [film, tv], chosen(2)))).toMatchObject({ ok: true, target: { mediaId: 2, confidence: 'low' } });
    expect(syncResult(query({ animeTitle: 'Wednesday' }), judge(query({ animeTitle: 'Wednesday' }), [], chosen(2)))).toMatchObject({ ok: false, ignored: true });
  });

  it('résultat déjà incertain : raison de la règle gardée (sauf titre seul)', () => {
    const low = chosen(2, { confidence: 'low' });
    expect(syncResult(query(), judge(query(), [film, tv], low))).toBe(low);
    expect(syncResult(query(), judge(query(), [tv], low))).toMatchObject({ target: { confidence: 'low', reason: 'Trouvée par le titre seul (aucune fiche AniList liée à cette série Netflix)' } });
  });
});
