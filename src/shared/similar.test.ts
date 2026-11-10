import { describe, expect, it } from 'vitest';
import type { ListState, ListStates } from './franchise';
import type { PanelRecommendation } from './panel-media.types';
import { pickSimilar, similarLookupIds } from './similar';

// « Dans le même esprit » : filtre des recommandations de la fiche (listes, écartées, préquel non vu), 5 lignes au plus

const reco = (mediaId: number, over: Partial<PanelRecommendation> = {}): PanelRecommendation => ({
  mediaId, idMal: mediaId + 1000, title: `R${mediaId}`, format: 'TV', startYear: 2020, coverUrl: null, siteUrl: `https://anilist.co/anime/${mediaId}`, rating: 10, platforms: [], prequelIds: [], ...over,
});
const watched: ListState = { kind: 'watched', progress: null };
const planned: ListState = { kind: 'planned', progress: null };
const none: ListStates = { anilist: null, mal: null };
const ids = (list: readonly PanelRecommendation[]): number[] => list.map((r) => r.mediaId);

describe('pickSimilar', () => {
  it('garde 5 lignes au plus, dans l’ordre reçu', () => {
    const recos = [1, 2, 3, 4, 5, 6, 7, 8].map((id) => reco(id));
    expect(ids(pickSimilar(recos, none, new Set()))).toEqual([1, 2, 3, 4, 5]);
  });

  it('écarte ce qui est dans une liste AniList (quel que soit le statut) ou MyAnimeList', () => {
    const states: ListStates = { anilist: { 1: planned, 2: null }, mal: { 1003: watched } };
    expect(ids(pickSimilar([reco(1), reco(2), reco(3), reco(4)], states, new Set()))).toEqual([2, 4]);
  });

  it('écarte les séries déjà écartées de Découvrir', () => {
    expect(ids(pickSimilar([reco(1), reco(2)], none, new Set([2])))).toEqual([1]);
  });

  it('suite dont le préquel n’est ni vu, ni en cours, ni en revisionnage : écartée', () => {
    const states: ListStates = { anilist: { 100: watched, 200: { kind: 'inProgress', progress: 3 }, 300: planned, 400: null }, mal: null };
    const recos = [reco(1, { prequelIds: [100] }), reco(2, { prequelIds: [200] }), reco(3, { prequelIds: [300] }), reco(4, { prequelIds: [400] }), reco(5, { prequelIds: [100, 400] }), reco(6)];
    expect(ids(pickSimilar(recos, states, new Set()))).toEqual([1, 2, 6]);
  });

  it('MyAnimeList seul (préquel inconnu côté AniList) : la règle du préquel ne s’applique pas', () => {
    const states: ListStates = { anilist: null, mal: { 1002: watched } };
    expect(ids(pickSimilar([reco(1, { prequelIds: [100] }), reco(2)], states, new Set()))).toEqual([1]);
  });
});

describe('similarLookupIds', () => {
  it('identifiants à lire : les recommandations non écartées et leurs préquels, dédoublonnés', () => {
    const recos = [reco(1, { prequelIds: [100, 101] }), reco(2, { prequelIds: [100] }), reco(3)];
    expect(similarLookupIds(recos, new Set([3]))).toEqual({ mediaIds: [1, 2, 100, 101], malIds: [1001, 1002] });
  });
});
