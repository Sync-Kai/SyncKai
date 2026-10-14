// Réponses de l'API CMS de Crunchyroll dans la forme relevée le 2026-10-14 (requêtes anonymes de la page elle-même,
// après la vérification Cloudflare) : `cms/series/{id}`, `cms/series/{id}/seasons`, `cms/seasons/{id}/episodes`,
// `discover/up_next/{id}`. Valeurs construites sur Frieren (GG5H5XQX4 : lancement 2023, 38 épisodes, 2 saisons ; S1 de
// 28 épisodes, premier épisode diffusé le 2023-09-29, 1 559 935 ms) ; identifiants de saison et d'épisode fictifs. Aucune
// donnée de compte : ces réponses n'en contiennent pas, et le jeton de la requête est dans ses en-têtes (jamais lus).

export const FRIEREN_SERIES_ID = 'GG5H5XQX4';
export const FRIEREN_S1 = 'GYFRIEREN1';
/** Doublage anglais de la saison 1 : saison à part, même numéro, incomplète */
export const FRIEREN_S1_DUB = 'GYFRIEREN1EN';
export const FRIEREN_S2 = 'GYFRIEREN2';

const BASE = 'https://www.crunchyroll.com/content/v2';
export const seriesUrl = (id = FRIEREN_SERIES_ID): string => `${BASE}/cms/series/${id}?preferred_audio_language=ja-JP&locale=fr-FR`;
export const seasonsUrl = (id = FRIEREN_SERIES_ID): string => `${BASE}/cms/series/${id}/seasons?force_locale=&preferred_audio_language=ja-JP&locale=fr-FR`;
export const episodesUrl = (seasonId: string): string => `${BASE}/cms/seasons/${seasonId}/episodes?preferred_audio_language=ja-JP&locale=fr-FR`;
export const upNextUrl = (id = FRIEREN_SERIES_ID): string => `${BASE}/discover/up_next/${id}?preferred_audio_language=ja-JP&locale=fr-FR`;

export function frierenSeries(overrides: Record<string, unknown> = {}): unknown {
  return {
    total: 1,
    data: [
      {
        id: FRIEREN_SERIES_ID,
        title: 'Frieren',
        slug_title: 'frieren-beyond-journeys-end',
        series_launch_year: 2023,
        episode_count: 38,
        season_count: 2,
        audio_locales: ['ja-JP', 'en-US', 'fr-FR'],
        keywords: ['winter-2024', 'fall-2023'],
        ...overrides,
      },
    ],
    meta: {},
  };
}

interface SeasonInit {
  id: string;
  number: number;
  episodes: number;
  audio: string;
  dubbed: boolean;
  title?: string;
}

const season = ({ id, number, episodes, audio, dubbed, title }: SeasonInit): Record<string, unknown> => ({
  id,
  title: title ?? `Season ${number}`,
  season_number: number,
  season_sequence_number: number,
  season_display_number: '',
  number_of_episodes: episodes,
  audio_locale: audio,
  is_dubbed: dubbed,
  is_subbed: !dubbed,
  keywords: number === 1 ? ['fall-2023'] : ['winter-2026'],
});

export const FRIEREN_SEASONS: readonly SeasonInit[] = [
  { id: FRIEREN_S1, number: 1, episodes: 28, audio: 'ja-JP', dubbed: false },
  { id: FRIEREN_S1_DUB, number: 1, episodes: 20, audio: 'en-US', dubbed: true, title: 'Season 1 (English Dub)' },
  { id: FRIEREN_S2, number: 2, episodes: 10, audio: 'ja-JP', dubbed: false },
];

export function frierenSeasons(seasons: readonly SeasonInit[] = FRIEREN_SEASONS): unknown {
  return { total: seasons.length, data: seasons.map(season), meta: {} };
}

/** Identifiant d'épisode fictif : GFRIER{saison}{numéro sur 2 chiffres}, suffixe EN pour le doublage */
export const frierenEpisodeId = (seasonNumber: number, episode: number, dub = false): string =>
  `GFRIER0${seasonNumber}${String(episode).padStart(2, '0')}${dub ? 'EN' : ''}`;

/** Épisodes d'une saison : un par semaine depuis `firstAirDate`, durées de 24 à 26 min (médiane 1 559 935 ms) */
export function frierenEpisodes(seasonNumber: number, count: number, { firstAirDate = '2023-09-29', dub = false, mediaType = 'episode' } = {}): unknown {
  const first = Date.parse(`${firstAirDate}T00:00:00Z`);
  return {
    total: count,
    data: Array.from({ length: count }, (_, i) => ({
      id: frierenEpisodeId(seasonNumber, i + 1, dub),
      series_id: FRIEREN_SERIES_ID,
      series_title: 'Frieren',
      season_title: `Season ${seasonNumber}`,
      season_number: seasonNumber,
      episode_number: i + 1,
      sequence_number: i + 1,
      duration_ms: [1_559_935, 1_440_000, 1_560_100][i % 3],
      episode_air_date: new Date(first + i * 7 * 86_400_000).toISOString().replace('.000Z', 'Z'),
      audio_locale: dub ? 'en-US' : 'ja-JP',
      media_type: mediaType,
      versions: dub ? [] : [{ audio_locale: 'en-US', guid: frierenEpisodeId(seasonNumber, i + 1, true), original: false }],
    })),
    meta: {},
  };
}

/** Épisode suggéré (`up_next`) : réponse propre au compte (progression), dont le pont ne garde que saison, épisode et durée */
export function frierenUpNext(seasonId = FRIEREN_S2, episode = 3): unknown {
  return {
    total: 1,
    data: [
      {
        panel: {
          id: frierenEpisodeId(2, episode),
          title: 'Épisode suggéré',
          episode_metadata: { season_id: seasonId, series_id: FRIEREN_SERIES_ID, season_number: 2, episode_number: episode, duration_ms: 1_500_000, episode_air_date: '2026-01-30T00:00:00Z' },
        },
        playhead: 431,
        fully_watched: false,
        never_watched: false,
      },
    ],
    meta: {},
  };
}
