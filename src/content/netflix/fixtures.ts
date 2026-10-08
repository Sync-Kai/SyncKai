// Réponse Netflix réaliste (tronquée) pour les tests : Mushoku Tensei, /watch/81402901 (relevé le 2026-10-09).
// Saison 1 : 23 épisodes, saison 2 : 25 épisodes. Contient des champs que la réduction doit écarter.

const S1_FIRST = 81402887; // 81402901 = S1E15
const S2_FIRST = 81691700;

function episode(id: number, seq: number, runtime = 1422, creditsOffset = 1329): Record<string, unknown> {
  return {
    id,
    episodeId: id,
    seq,
    title: `Episode ${seq} title`,
    synopsis: 'Synopsis à ne jamais transmettre',
    runtime,
    displayRuntime: runtime,
    creditsOffset,
    skipMarkers: { credit: { start: 0, end: 0 }, recap: { start: 0, end: 0 } },
    hiddenEpisodeNumbers: false,
    stills: [{ url: 'https://occ.nflxso.net/still.jpg' }],
    bookmark: { offset: 120, watchedDate: 1760000000000 },
  };
}

/** Identifiant de lecture de l'épisode `seq` de la saison 1 ou 2 */
export function mushokuEpisodeId(season: 1 | 2, seq: number): string {
  return String((season === 1 ? S1_FIRST : S2_FIRST) + seq - 1);
}

export function mushokuRawResponse(): Record<string, unknown> {
  return {
    version: '2.1',
    trackIds: { nextEpisode: 253, episodeSelector: 'null' },
    video: {
      id: 80987039,
      title: 'Mushoku Tensei: Jobless Reincarnation',
      synopsis: 'Synopsis de la série',
      type: 'show',
      currentEpisode: 81402901,
      hiddenEpisodeNumbers: false,
      skipMarkers: {},
      artwork: [{ url: 'https://occ.nflxso.net/art.jpg' }],
      boxart: [{ url: 'https://occ.nflxso.net/box.jpg' }],
      rating: 'TV-MA',
      userRating: { matchScore: 97 },
      authURL: 'should-never-leak',
      seasons: [
        {
          seq: 1,
          id: 81402879,
          title: 'Season 1',
          longName: 'Season 1',
          shortName: 'S1',
          year: 2021,
          hiddenEpisodeNumbers: false,
          episodes: Array.from({ length: 23 }, (_, i) => episode(S1_FIRST + i, i + 1)),
        },
        {
          seq: 2,
          id: 81691699,
          title: 'Season 2',
          longName: 'Season 2',
          shortName: 'S2',
          year: 2023,
          hiddenEpisodeNumbers: false,
          episodes: Array.from({ length: 25 }, (_, i) => episode(S2_FIRST + i, i + 1)),
        },
      ],
    },
  };
}
