// Réponses Prime Video pour les tests, reconstruites à partir des chemins relevés le 2026-10-14 (Chrome,
// primevideo.com/region/eu ; From Old Country Bumpkin to Master Swordsman S1, E1 → E4 par lecture automatique). Fausses
// mais réalistes : identifiants d'épisodes inventés, paramètres de requête factices, aucun jeton, cookie, URL de flux,
// licence ni identifiant de compte. Les champs que la réduction doit écarter sont remplacés par des valeurs factices
// reconnaissables (« SECRET… »), pour vérifier qu'ils ne quittent jamais le pont.
import { bumpkinEpisodeGti, BUMPKIN_S1_COMPACT, BUMPKIN_S1_GTI, BUMPKIN_TITLE } from '../../shared/__fixtures__/prime-detail';

export * from '../../shared/__fixtures__/prime-detail';

/** Date de réception des réponses dans les tests (ms) */
export const SEEN_AT = 1_760_000_000_000;

/** Fin de générique relevée (Bumpkin E2 : 1311000 ; E3, E4 : 1312000) et carte « À suivre » (1417000) */
export const BUMPKIN_CREDITS_MS: Readonly<Record<number, number>> = { 2: 1_311_000, 3: 1_312_000, 4: 1_312_000 };
export const BUMPKIN_DURATION_MS = 1_441_000;

const PLAYER_HOST = 'https://atv-ps-eu.primevideo.com';
const COMMON_QUERY = 'deviceTypeID=AOAGZA014O5RE&marketplaceID=A3K6Y4MI8GDYMT&uxLocale=en_US&firmware=1';

export function catalogUrl(entityId: string, resources = 'catalogMetadataV2,inPlaybackRatingV3'): string {
  return `${PLAYER_HOST}/cdp/lumina/playerChromeResources/v1?${COMMON_QUERY}&desiredResources=${resources}&entityId=${encodeURIComponent(entityId)}&widgetScheme=x&nerid=n`;
}

export function playbackUrl(titleId: string): string {
  return `${PLAYER_HOST}/playback/prs/GetVodPlaybackResources?${COMMON_QUERY}&titleId=${encodeURIComponent(titleId)}&nerid=n`;
}

export function detailUrl(compact: string = BUMPKIN_S1_COMPACT): string {
  return `https://www.primevideo.com/region/eu/detail/${compact}?ref_=atv_dp_season_select_s1&dvWebAppClientVersion=1.0.0`;
}

export function widgetsUrl(seasonGti: string = BUMPKIN_S1_GTI): string {
  return `https://www.primevideo.com/region/eu/api/getDetailWidgets?titleID=${encodeURIComponent(seasonGti)}&isTvodOnRow=1&widgets=buybox,episodeList`;
}

const EPISODE_TITLES: Readonly<Record<number, string>> = {
  1: 'The Old Country Bumpkin Goes to the Capital',
  2: 'The Old Country Bumpkin is Astounded by a Wizard',
  3: 'The Old Country Bumpkin Faces a Swordsman',
  4: 'The Old Country Bumpkin Takes a Pupil',
};

/** `playerChromeResources` avec `catalogMetadataV2` de l'épisode `n` (et d'autres ressources à ignorer) */
export function bumpkinCatalog(n: number, seriesTitle: string = BUMPKIN_TITLE): Record<string, unknown> {
  return {
    resources: {
      catalogMetadataV2: { catalog: { type: 'EPISODE', entityType: 'TV Show', title: EPISODE_TITLES[n] ?? `Episode ${n}`, seriesTitle, episodeNumber: n, seasonNumber: 1 } },
      inPlaybackRatingV3: { rating: 'SECRET-rating' },
    },
  };
}

/** `playerChromeResources` avec `nextUpV3` seul : décrit l'épisode SUIVANT, jamais une identité */
export function bumpkinNextUp(next: number): Record<string, unknown> {
  return {
    resources: {
      nextUpV3: {
        isMultiTitleExperience: false,
        card: {
          carouselTitle: 'Next up',
          autoPlayConfig: { numTitlesToAutoplay: 5, isLogicalNextUp: true },
          carouselItems: [{ titleId: bumpkinEpisodeGti(next), isLogicalNextEpisode: true, isEntitled: true, catalog: { type: 'EPISODE', title: EPISODE_TITLES[next], seriesTitle: BUMPKIN_TITLE, episodeNumber: next, seasonNumber: 1 } }],
        },
      },
    },
  };
}

/** `GetVodPlaybackResources` de l'épisode `n` : repères, durée, et champs sensibles factices à ne jamais lire */
export function bumpkinPlayback(n: number): Record<string, unknown> {
  const credits = BUMPKIN_CREDITS_MS[n];
  return {
    transitionTimecodes: {
      result: {
        events: [
          ...(credits !== undefined ? [{ eventType: 'END_CREDITS', startTimeMs: credits, intervals: [{ startTimeMs: credits }] }] : []),
          { eventType: 'NEXT_UP', startTimeMs: 1_417_000, intervals: [{ startTimeMs: 1_417_000 }] },
          { eventType: 'SKIP_INTRO', startTimeMs: 84_000, endTimeMs: 96_000, intervals: [{ startTimeMs: 84_000, endTimeMs: 96_000 }] },
        ],
      },
    },
    vodPlaylistedPlaybackUrls: {
      result: {
        playbackUrls: {
          fullTitleDurationMs: BUMPKIN_DURATION_MS,
          intraTitlePlaylist: [{ type: 'Main', startMs: 0, endMs: 695_361, urls: [{ url: 'https://SECRET-stream.example/manifest.mpd' }] }],
          urlSets: { default: { url: 'https://SECRET-stream.example/manifest.mpd' } },
        },
      },
    },
    timedTextUrls: { result: { subtitleUrls: [{ url: 'https://SECRET-subtitles.example/en.dfxp' }] } },
    playbackData: { licenseToken: 'SECRET-licence' },
  };
}

/** A Star Brighter Than the Sun E2 : pas d'END_CREDITS (l'histoire continue après le générique) */
export function playbackWithoutCredits(): Record<string, unknown> {
  return {
    transitionTimecodes: {
      result: { events: [{ eventType: 'NEXT_UP', startTimeMs: 1_443_000 }, { eventType: 'SKIP_INTRO', startTimeMs: 87_000, endTimeMs: 172_000 }] },
    },
    vodPlaylistedPlaybackUrls: { result: { playbackUrls: { fullTitleDurationMs: 1_448_000 } } },
  };
}
