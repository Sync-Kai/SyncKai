import { describe, expect, it } from 'vitest';
import type { EpisodeInfo } from '../../shared/episode.types';
import type { AniListMedia } from '../anilist/media';
import { candidateSteps, type CatalogAnswer, type CatalogRequest, type CollectedCandidates } from './candidates';

// Collecte des candidats (audit 1-§4.3) : étapes pures déroulées à la main, sans catalogue ni simulation de module. Chaque
// requête cédée par l'orchestrateur reçoit la réponse du test, comme le ferait le port Catalog.

function media(overrides: Partial<AniListMedia> & Pick<AniListMedia, 'id' | 'titles'>): AniListMedia {
  return {
    idMal: null,
    format: 'TV',
    episodes: 12,
    startDate: { year: 2019, month: 7, day: 7 },
    displayTitle: overrides.titles[0] ?? '',
    year: 2019,
    coverUrl: null,
    externalLinkUrls: [],
    relations: [],
    duration: 24,
    countryOfOrigin: 'JP',
    status: 'FINISHED',
    endDate: null,
    ...overrides,
  };
}

const crunchyroll = (overrides: Partial<EpisodeInfo> = {}): EpisodeInfo => ({
  platform: 'crunchyroll',
  episodeId: 'GEP1',
  seriesId: 'GSERIES',
  seriesSlug: 'foo',
  animeTitle: 'Foo',
  seasonNumber: 2,
  seasonTitle: null,
  seasonEpisodeNumber: 3,
  displayedEpisodeNumber: 3,
  episodeTitle: null,
  url: 'https://www.crunchyroll.com/watch/GEP1',
  ...overrides,
});

/** Déroule la collecte : requêtes cédées (relevées) et réponses du test, résultat final */
function walk(episode: EpisodeInfo, respond: (request: CatalogRequest) => CatalogAnswer): { requests: CatalogRequest[]; collected: CollectedCandidates } {
  const steps = candidateSteps(episode);
  const requests: CatalogRequest[] = [];
  let step = steps.next([]);
  while (!step.done) {
    requests.push(step.value);
    step = steps.next(respond(step.value));
  }
  return { requests, collected: step.value };
}

const S1 = media({
  id: 1,
  titles: ['Foo'],
  startDate: { year: 2018, month: 1, day: 1 },
  externalLinkUrls: ['https://www.crunchyroll.com/series/GSERIES/foo'],
  relations: [{ relationType: 'SEQUEL', id: 2, type: 'ANIME', format: 'TV' }],
});
const S2 = media({ id: 2, titles: ['Foo: The Sequel'], startDate: { year: 2020, month: 1, day: 1 }, relations: [{ relationType: 'PREQUEL', id: 1, type: 'ANIME', format: 'TV' }] });

describe('candidateSteps (pipeline sur un CandidateSet)', () => {
  it('suite absente de la recherche : demandée par identifiant, rattachée par relation', () => {
    const { requests, collected } = walk(crunchyroll(), (request) => (request.kind === 'search' ? [[S1]] : [[S2]]));
    expect(requests).toEqual([{ kind: 'search', queries: ['Foo'] }, { kind: 'ids', ids: [2] }]);
    expect(collected.candidates.map((c) => [c.id, c.link])).toEqual([[1, 'id'], [2, 'relation']]);
  });

  it('suite liée seulement à une autre plateforme : jamais une saison par relation (MONSTERS)', () => {
    const netflixOnly = { ...S2, externalLinkUrls: ['https://www.netflix.com/title/81000001'] };
    const { collected } = walk(crunchyroll(), (request) => (request.kind === 'search' ? [[S1, netflixOnly]] : [[]]));
    expect(collected.candidates.map((c) => [c.id, c.link])).toEqual([[1, 'id'], [2, null]]);
  });

  it('numérotation absolue couverte par une fiche liée en cours de diffusion : aucune requête de plus (One Piece)', () => {
    const onePiece = { ...S1, episodes: null, status: 'RELEASING' };
    const { requests } = walk(crunchyroll({ seasonEpisodeNumber: 25, displayedEpisodeNumber: 1180 }), () => [[onePiece]]);
    expect(requests).toEqual([{ kind: 'search', queries: ['Foo'] }]);
  });

  it('tours de récupération bornés : au plus deux tours ordinaires', () => {
    // Chaîne sans fin : chaque fiche demandée annonce une suite absente
    const chained = (id: number): AniListMedia => media({ id, titles: [`Foo ${id}`], startDate: { year: 2018 + id, month: 1, day: 1 }, relations: [{ relationType: 'SEQUEL', id: id + 1, type: 'ANIME', format: 'TV' }] });
    const { requests } = walk(crunchyroll(), (request) => (request.kind === 'search' ? [[{ ...S1, relations: [{ relationType: 'SEQUEL', id: 2, type: 'ANIME', format: 'TV' }] }]] : [request.ids.map(chained)]));
    expect(requests.filter((r) => r.kind === 'ids')).toEqual([{ kind: 'ids', ids: [2] }, { kind: 'ids', ids: [3] }]);
  });
});
