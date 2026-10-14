// Données de détail Prime Video pour les tests, reconstruites à partir des chemins relevés le 2026-10-14 (Chrome,
// primevideo.com/region/eu, interface anglaise ; voir shared/prime-metadata.ts). Fausses mais réalistes : identifiants
// d'épisodes inventés, aucun jeton, cookie, URL de flux ni identifiant de compte. Les genres et pistes audio sont placés
// dans le détail de la saison (chemin exact inconnu), plus un carrousel de suggestions que la réduction doit ignorer.

/** From Old Country Bumpkin to Master Swordsman, saison 1 (GTI et GTI compact relevés) */
export const BUMPKIN_S1_GTI = 'amzn1.dv.gti.18f4d5fa-bcfd-40d4-b51c-57b602387b37';
export const BUMPKIN_S1_COMPACT = '0GMSR5WMNJ6EMYQRQ6Y2587WAF';
export const BUMPKIN_S2_GTI = 'amzn1.dv.gti.28f4d5fa-bcfd-40d4-b51c-57b602387b38';
export const BUMPKIN_S2_COMPACT = '0HMSR5WMNJ6EMYQRQ6Y2587WAG';
export const BUMPKIN_TITLE = 'From Old Country Bumpkin to Master Swordsman';

/** GTI d'épisode inventé : n = numéro de l'épisode */
export function bumpkinEpisodeGti(n: number): string {
  return `amzn1.dv.gti.e860c26c-0000-4000-8000-${String(n).padStart(12, '0')}`;
}

/** GTI compact d'épisode inventé (26 caractères) */
export function bumpkinEpisodeCompact(n: number): string {
  return `0SWVGA4V24235PQUGX1DTAB${String(n).padStart(3, '0')}`;
}

const EPISODE_TITLES = [
  'The Old Country Bumpkin Goes to the Capital',
  'The Old Country Bumpkin is Astounded by a Wizard',
  'The Old Country Bumpkin Faces a Swordsman',
  'The Old Country Bumpkin Takes a Pupil',
];

export interface DetailOptions {
  genres?: readonly string[];
  audioTracks?: readonly string[];
  /** Titre de la saison (`title`) et de la série (`parentTitle`) */
  title?: string;
  parentTitle?: string;
  episodes?: number;
}

/** Corps `{ atf, btf }` d'une page de saison (hydratation `init.preparations.body`, ou réponse SPA `/detail/{id}`) */
export function bumpkinDetailBody(options: DetailOptions = {}): Record<string, unknown> {
  const genres = options.genres ?? ['av_genre_animation_adult_interest', 'av_genre_action', 'av_genre_adventure', 'av_genre_comedy'];
  const audioTracks = options.audioTracks ?? ['English', 'Deutsch', 'Español (España)', 'Español (Latinoamérica)', 'Français', 'Italiano', 'Português (Brasil)', 'ไทย', '日本語'];
  const count = options.episodes ?? 4;
  const numbers = Array.from({ length: count }, (_, i) => i + 1);
  const season = {
    title: options.title ?? BUMPKIN_TITLE,
    parentTitle: options.parentTitle ?? BUMPKIN_TITLE,
    entityType: 'TV Show',
    seasonNumber: 1,
    titleType: 'season',
    runtime: '',
  };
  return {
    routingType: 'VOD_DP',
    atf: {
      state: {
        pageTitleId: BUMPKIN_S1_GTI,
        pageContext: { pageTitleId: BUMPKIN_S1_GTI, pageType: 'ATVDetail', subPageType: 'Season', playbackLaunchType: 'EMBEDDED' },
        detail: { headerDetail: { [BUMPKIN_S1_GTI]: season } },
        self: {
          [BUMPKIN_S1_GTI]: { gti: BUMPKIN_S1_GTI, compactGTI: BUMPKIN_S1_COMPACT, sequenceNumber: 1, titleType: 'season' },
          [bumpkinEpisodeGti(1)]: { gti: bumpkinEpisodeGti(1), compactGTI: bumpkinEpisodeCompact(1), sequenceNumber: 1, titleType: 'episode' },
        },
        seasons: {
          [BUMPKIN_S1_GTI]: [
            { seasonId: BUMPKIN_S1_GTI, seasonLink: `/region/eu/detail/${BUMPKIN_S1_COMPACT}?ref_=atv_dp_season_select_s1`, sequenceNumber: 1 },
            { seasonId: BUMPKIN_S2_GTI, seasonLink: `/region/eu/detail/${BUMPKIN_S2_COMPACT}?ref_=atv_dp_season_select_s2`, sequenceNumber: 2 },
          ],
        },
        metadata: { [BUMPKIN_S1_GTI]: { episodeCount: `${count} episodes` } },
      },
    },
    btf: {
      state: {
        detail: {
          detail: {
            [BUMPKIN_S1_GTI]: {
              ...season,
              genres: genres.map((id) => ({ id, text: id.replace('av_genre_', ''), link: `/region/eu/search?phrase=${id}` })),
              audioTracks,
            },
            ...Object.fromEntries(
              numbers.map((n) => [
                bumpkinEpisodeGti(n),
                { title: EPISODE_TITLES[n - 1] ?? `Episode ${n}`, duration: 1440, episodeNumber: n, entityType: 'TV Show', runtime: '24min', titleType: 'episode' },
              ]),
            ),
          },
        },
        // Suggestions : genres d'autres titres, jamais retenus pour la saison
        collections: [{ titles: [{ gti: 'amzn1.dv.gti.99999999-0000-4000-8000-000000000001', genres: [{ id: 'av_genre_anime' }], audioTracks: ['日本語'] }] }],
      },
    },
  };
}

/** Contenu JSON du nœud `#dv-web-page-hydration-data` (premier chargement) */
export function hydrationDocument(body: Record<string, unknown> = bumpkinDetailBody()): Record<string, unknown> {
  return { init: { preparations: { body } } };
}

/** Réponse JSON de `/detail/{id}` après une navigation SPA (racine exacte inconnue : enveloppe supposée) */
export function spaDetailResponse(body: Record<string, unknown> = bumpkinDetailBody()): Record<string, unknown> {
  return { page: [{ assembly: { body } }] };
}

/** Réponse `getDetailWidgets` envoyée au passage à l'épisode `playing` */
export function bumpkinDetailWidgets(playing: number, episodes = 4): Record<string, unknown> {
  return {
    __type: 'atv.wps#GetDetailWidgetsOutput',
    widgets: {
      buybox: {
        titleID: BUMPKIN_S1_GTI,
        bestSelf: { gti: bumpkinEpisodeGti(playing), compactGTI: bumpkinEpisodeCompact(playing), sequenceNumber: playing, titleType: 'episode' },
      },
      seasonSelector: [
        { seasonLink: `/region/eu/detail/${BUMPKIN_S1_COMPACT}`, sequenceNumber: 1, titleID: BUMPKIN_S1_GTI },
        { seasonLink: `/region/eu/detail/${BUMPKIN_S2_COMPACT}`, sequenceNumber: 2, titleID: BUMPKIN_S2_GTI },
      ],
      episodeList: {
        episodeCount: episodes,
        episodes: Array.from({ length: episodes }, (_, i) => i + 1).map((n) => ({
          titleID: bumpkinEpisodeGti(n),
          self: { gti: bumpkinEpisodeGti(n), compactGTI: bumpkinEpisodeCompact(n), sequenceNumber: n, titleType: 'episode' },
          detail: { title: EPISODE_TITLES[n - 1] ?? `Episode ${n}`, duration: 1441, episodeNumber: n, runtime: '24min', titleType: 'episode' },
        })),
      },
      pageContext: { pageTitleId: BUMPKIN_S1_GTI },
    },
  };
}
