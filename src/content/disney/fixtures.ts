// Réponses Disney+ réelles (compte belge, profil fr-FR, relevées le 2026-10-11) pour les tests, champs utiles conservés
// tels quels, plus quelques champs que la réduction doit écarter (images, flux, classification).
// `GET disney.api.edge.bamgrid.com/explore/v1.21/playerExperience/{id}` (XMLHttpRequest du site). L'URL de lecture
// (/play/{id}) porte l'identifiant de l'épisode, que la réponse ne donne que dans `infoBlock` (protobuf en base64).

/** Undead Unluck, saison 1 épisode 1 : identifiant de l'URL /fr-fr/play/{id} (épisode, deeplinkId) */
export const UNDEAD_UNLUCK_S1E1_PLAY_ID = '539f8e74-65f6-4c6e-a689-c91d125b6c61';
/** … et `availId` de sa réponse playerExperience (différent) */
export const UNDEAD_UNLUCK_S1E1_AVAIL_ID = 'eaccaafa-cf43-4d6a-b85f-f9add5b6cf41';
/** `infoBlock` réel de la réponse S1E1 : se termine par « urn:ds:cmp:eva:episode/539f8e74-… » */
export const UNDEAD_UNLUCK_S1E1_INFO_BLOCK =
  'EiJ1cm46ZXZlbnQ6aW5mb2Jsb2NrOmJyb3dzZTp2MTpwYWdlGj9jb20uZGlzbmV5c3RyZWFtaW5nLnNlcnZpY2UubmFtb3JhLmluZm9ibG9jay5JbmZvQmxvY2tHZW5lcmF0b3IiJDEwYWQyNGZkLWRjYjAtNDY5ZS1hZjNmLWU0OWVmOGFkYTY1NzIfCh0yMDI2LTEwLTExVDE1OjAyOjIxLjcyMTIzMzQ1WjqmAQqjAWh0dHBzOi8vZ2l0aHViLmJhbXRlY2guY28vc2NoZW1hLXJlZ2lzdHJ5L3NjaGVtYS1yZWdpc3RyeS1pbmZvLWJsb2NrL2Jsb2IvYzY1YTMyY2JlNDllNWFkNzc5MWQ0NzU4YTM3NDEwYTYzYTMzNzFjMi9zbWl0aHkvZHNzL2V2ZW50L2luZm9ibG9jay9icm93c2UvdjEvcGFnZS5zbWl0aHlCFgoUYXBwbGljYXRpb24vcHJvdG9idWZKCAoGYmluYXJ5agIIBFpbClkSDHZpZGVvX3BsYXllchoMdmlkZW9fcGxheWVyIjt1cm46ZHM6Y21wOmV2YTplcGlzb2RlLzUzOWY4ZTc0LTY1ZjYtNGM2ZS1hNjg5LWM5MWQxMjViNmM2MQ==';

/** Undead Unluck: Winter Arc, épisode 1 : rangé en saison 99 de la série (identifiant d'épisode non relevé, pas d'infoBlock) */
export const WINTER_ARC_E1_AVAIL_ID = '0580a81e-2408-48e8-a6e0-14da8ca0e87f';

/** Date de réception des fiches dans les tests (ms) */
export const SEEN_AT = 1_760_000_000_000;

export function playerExperienceUrl(id: string, version = '21'): string {
  return `https://disney.api.edge.bamgrid.com/explore/v1.${version}/playerExperience/${id}`;
}

/** Réponse brute (forme réelle : `{ data: { playerExperience } }`) */
function response(playerExperience: Record<string, unknown>): Record<string, unknown> {
  return {
    data: {
      playerExperience: {
        ...playerExperience,
        // Champs à ne jamais transmettre au script isolé
        images: { tile: { '1.78': { imageId: 'abc', url: 'https://disney.images.edge.bamgrid.com/ripcut-delivery/v2/variant/disney/abc' } } },
        ratings: [{ system: 'BE', value: '12+' }],
        playback: { url: 'https://disney.playback.edge.bamgrid.com/ctr-regular?signed=1' },
      },
    },
  };
}

export function undeadUnluckS1E1(): Record<string, unknown> {
  return response({
    availId: UNDEAD_UNLUCK_S1E1_AVAIL_ID,
    title: 'Undead Unluck',
    subtitle: 'S1:E1 Undead et Unluck',
    subtitleTts: 'Saison 1 Épisode 1 Undead et Unluck',
    internalTitle: 'Undead Unluck - s1e1 - mediaId:1986b4d2-f9b8-4382-8059-e067b887c911',
    targetLanguage: 'ja',
    originalLanguage: 'ja',
    timeline: { runtimeMs: 1460000 },
    analytics: { contentSource: 'disney', franchise: 'Star', programType: 'episode', streamType: 'VOD' },
    infoBlock: UNDEAD_UNLUCK_S1E1_INFO_BLOCK,
  });
}

export function winterArcE1(): Record<string, unknown> {
  return response({
    availId: WINTER_ARC_E1_AVAIL_ID,
    title: 'Undead Unluck',
    subtitle: 'Undead Unluck: Winter Arc : E1 Undead Unluck: Winter Arc',
    internalTitle: 'Undead Unluck - s99e1 - mediaId:6175d8e7-a4c4-4dfc-9b45-ae2e9d518a59',
    targetLanguage: 'en',
    originalLanguage: 'ja',
    timeline: { runtimeMs: 2913000 },
    analytics: { contentSource: 'disney', franchise: 'Star', programType: 'episode', streamType: 'VOD' },
  });
}

/** Série non japonaise (forme identique, langue originale anglaise) : jamais suivie */
export function nonAnimeEpisode(availId = '11111111-2222-4333-8444-555555555555'): Record<string, unknown> {
  return response({
    availId,
    title: 'Andor',
    subtitle: 'S1:E1 Kassa',
    internalTitle: 'Andor - s1e1 - mediaId:22222222-3333-4444-8555-666666666666',
    targetLanguage: 'fr',
    originalLanguage: 'en',
    timeline: { runtimeMs: 2340000 },
    analytics: { contentSource: 'disney', franchise: 'Star Wars', programType: 'episode', streamType: 'VOD' },
  });
}

/**
 * Titres affichés (localisés, profil fr-FR) et internalTitle (anglais, stable) d'épisodes proposés par `upNext` : le
 * titre affiché ne sert jamais à la recherche AniList.
 */
export const UP_NEXT_TITLES: readonly { displayed: string; internalTitle: string; series: string; season: number; episode: number }[] = [
  {
    displayed: 'Time Shadows',
    internalTitle: 'Summer Time Rendering - s1e1 - mediaId:3f2a9c1e-5b7d-4e8f-9a0b-1c2d3e4f5a6b',
    series: 'Summer Time Rendering',
    season: 1,
    episode: 1,
  },
  {
    displayed: 'NO LONGER RANGERS',
    internalTitle: 'Go! Go! Loser Ranger! - s1e1 - mediaId:4a3b2c1d-6e5f-4a7b-8c9d-0e1f2a3b4c5d',
    series: 'Go! Go! Loser Ranger!',
    season: 1,
    episode: 1,
  },
  {
    displayed: 'SYNDUALITY Noir',
    internalTitle: 'Synduality Noir - s1e1 - mediaId:5b4c3d2e-7f6a-4b8c-9d0e-1f2a3b4c5d6e',
    series: 'Synduality Noir',
    season: 1,
    episode: 1,
  },
  {
    displayed: 'ISHURA',
    internalTitle: 'Ishura - s1e1 - mediaId:6c5d4e3f-8a7b-4c9d-8e1f-2a3b4c5d6e7f',
    series: 'Ishura',
    season: 1,
    episode: 1,
  },
  {
    displayed: 'Disney Twisted-Wonderland : La série d\'animation - La Maison Heartslabyul',
    internalTitle: 'Disney Twisted-Wonderland: The Animation - Episode of Heartslabyul - s1e1 - mediaId:7d6e5f4a-9b8c-4d0e-9f2a-3b4c5d6e7f8a',
    series: 'Disney Twisted-Wonderland: The Animation - Episode of Heartslabyul',
    season: 1,
    episode: 1,
  },
];

/**
 * <video> de la page de lecture relevées pendant la lecture (2026-10-11) : une inactive (btm-media-client-element), et le
 * vrai lecteur (hive-video), dont `currentTime` (23 s) n'est pas la position du programme (la barre indiquait des minutes).
 */
export const PLAY_PAGE_VIDEOS: readonly { className: string; paused: boolean; currentTime: number; duration: number; videoWidth: number; readyState: number }[] = [
  { className: 'btm-media-client-element', paused: true, currentTime: 0, duration: Number.NaN, videoWidth: 0, readyState: 0 },
  { className: 'hive-video', paused: false, currentTime: 23, duration: Number.POSITIVE_INFINITY, videoWidth: 1280, readyState: 4 },
];

// ─── Page de série (relevée le 2026-10-11, compte belge, profil fr-FR) ───────
// `GET disney.api.edge.bamgrid.com/explore/v1.21/page/entity-{uuid}` (XMLHttpRequest du site), page /fr-fr/browse/entity-{uuid}.
// Forme réelle, champs utiles conservés ; images, descriptions et infoBlock retirés, quelques champs à écarter ajoutés.

/** Undead Unluck : uuid de l'entité (URL /browse/entity-{uuid}, `partnerFeed.evaSeriesEntityId`) */
export const UNDEAD_UNLUCK_ENTITY_ID = '9a14d04d-01f2-40d0-be62-a6c8ffe24137';
/** Saison 1 (24 épisodes, `focus` de la page) et arc « Winter Arc » (1 épisode, aucun épisode dans la page) */
export const UNDEAD_UNLUCK_S1_ID = 'ce983a33-c432-4579-80e0-f7afade9c484';
export const WINTER_ARC_SEASON_ID = 'dd2dc681-e151-483c-ad6f-4ea876e27e53';

export function seriesPageUrl(entityId: string, version = '21'): string {
  return `https://disney.api.edge.bamgrid.com/explore/v1.${version}/page/entity-${entityId}?enhancedContainersLimit=15&limit=15`;
}

export function seasonUrl(seasonId: string, version = '21'): string {
  return `https://disney.api.edge.bamgrid.com/explore/v1.${version}/season/${seasonId}?limit=15&offset=0`;
}

/** Épisode de la liste des saisons (forme réelle des `items`) */
function seasonItem(season: number, episode: number, internalSeason = season): Record<string, unknown> {
  const id = `539f8e74-65f6-4c6e-a689-${String(episode).padStart(12, '0')}`;
  return {
    type: 'view',
    id,
    actions: [
      {
        type: 'playback',
        availId: `eaccaafa-cf43-4d6a-b85f-${String(episode).padStart(12, '0')}`,
        deeplinkId: id,
        partnerFeed: { evaSeriesEntityId: UNDEAD_UNLUCK_ENTITY_ID, dmcContentId: 'd2ec3225-0000-4000-8000-000000000000' },
        internalTitle: `Undead Unluck - s${internalSeason}e${episode} - mediaId:1986b4d2-f9b8-4382-8059-${String(episode).padStart(12, '0')}`,
      },
    ],
    visuals: { title: 'Undead Unluck', episodeTitle: `Épisode ${episode}`, seasonNumber: String(season), episodeNumber: String(episode), durationMs: 1459917 },
  };
}

interface SeriesPageOptions {
  entityId?: string;
  title?: string;
  genres?: string[];
  /** Sans titre interne (actions et épisodes) : titre anglais inconnu */
  internalTitles?: boolean;
}

/** Réponse brute de la page de série Undead Unluck (`{ data: { page } }`) */
export function undeadUnluckSeriesPage({ entityId = UNDEAD_UNLUCK_ENTITY_ID, title = 'Undead Unluck', genres = ['Action et aventure', 'Animation', 'Anime', 'Science-fiction', 'Fantastique'], internalTitles = true }: SeriesPageOptions = {}): Record<string, unknown> {
  const strip = (item: Record<string, unknown>): Record<string, unknown> => (internalTitles ? item : { ...item, actions: [] });
  return {
    data: {
      page: {
        type: 'page',
        id: `entity-${entityId}`,
        deeplinkId: `entity-${entityId}`,
        visuals: {
          title,
          featuredTitle: 'S1:E1 Undead et Unluck',
          description: { full: 'Description à ne jamais transmettre' },
          artwork: { standard: { tile: { '1.78': { imageId: 'abc' } } } },
          metastringParts: { genres: { values: genres }, releaseYearRange: { startYear: '2023', endYear: '2025' }, seasonsAvailable: '2 saisons' },
        },
        // État du profil (progression, liste) : jamais lu
        personalization: { userState: { inWatchlist: true, progress: { percentWatched: 42 }, releaseYearRange: { startYear: '2001' } } },
        actions: internalTitles
          ? [
              {
                type: 'playback',
                availId: 'eaccaafa-cf43-4d6a-b85f-f9add5b6cf41',
                deeplinkId: '539f8e74-65f6-4c6e-a689-c91d125b6c61',
                partnerFeed: { evaSeriesEntityId: entityId },
                internalTitle: 'Undead Unluck - s1e1 - mediaId:1986b4d2-f9b8-4382-8059-e067b887c911',
                resumeToken: 'jeton-à-ne-jamais-transmettre',
              },
            ]
          : [],
        containers: [
          {
            type: 'episodes',
            focus: { seasonId: UNDEAD_UNLUCK_S1_ID, itemId: '539f8e74-65f6-4c6e-a689-c91d125b6c61' },
            seasons: [
              {
                type: 'season',
                id: UNDEAD_UNLUCK_S1_ID,
                visuals: { name: 'Saison 1', episodeCountDisplayText: '24 épisodes' },
                pagination: { hasMore: true, currentOffset: 0, totalCount: 24 },
                items: Array.from({ length: 15 }, (_, i) => strip(seasonItem(1, i + 1))),
              },
              {
                type: 'season',
                id: WINTER_ARC_SEASON_ID,
                visuals: { name: 'Undead Unluck: Winter Arc', episodeCountDisplayText: '1 épisode' },
                pagination: { hasMore: true, currentOffset: 0, totalCount: 1 },
                items: [],
              },
            ],
          },
          {
            type: 'set',
            visuals: { name: 'SUGGESTIONS' },
            // Suggestions : années et durées d'autres séries, jamais lues
            items: [
              {
                type: 'view',
                actions: [{ type: 'playback', internalTitle: 'Summer Time Rendering - s1e1 - mediaId:3f2a9c1e-5b7d-4e8f-9a0b-1c2d3e4f5a6b' }],
                visuals: { title: 'Summer Time Rendering', durationMs: 60_000, metastringParts: { releaseYearRange: { startYear: '1999' } } },
              },
            ],
          },
          { type: 'details', visuals: { title, genres: { values: genres } } },
        ],
      },
    },
  };
}

/**
 * Réponse `season/{id}` de l'arc (forme NON relevée, supposée `{ data: { season } }` avec les mêmes épisodes que la page) :
 * titre interne « s99e1 » (arc).
 */
export function winterArcSeasonResponse(): Record<string, unknown> {
  return {
    data: {
      season: {
        type: 'season',
        id: WINTER_ARC_SEASON_ID,
        visuals: { name: 'Undead Unluck: Winter Arc' },
        pagination: { hasMore: false, currentOffset: 0, totalCount: 1 },
        items: [{ ...seasonItem(1, 1, 99), visuals: { title: 'Undead Unluck', episodeTitle: 'Undead Unluck: Winter Arc', episodeNumber: '1' } }],
      },
    },
  };
}

/** Série qui n'est pas un anime (genres sans « Anime ») */
export function nonAnimeSeriesPage(): Record<string, unknown> {
  return undeadUnluckSeriesPage({ entityId: '11111111-2222-4333-8444-000000000001', title: 'Andor', genres: ['Science-fiction', 'Action et aventure'], internalTitles: false });
}

// ─── Réponse de lecture (générique de fin) ────────────────────────────────
// Synduality Noir, saison 1 épisode 1 (relevé le 2026-10-11). Réponse du lecteur `disney.playback.edge.bamgrid.com`
// (scénario `ctr-regular`, requête POST ; chemin exact non relevé). Forme RÉDUITE : la réponse réelle contient aussi des
// URL de flux signées et des jetons de droits, jamais repris ici.

/** Identifiant de l'URL /play/{id} (épisode, deeplinkId) = `tracking.qoe.entityId` de la réponse de lecture */
export const SYNDUALITY_S1E1_PLAY_ID = 'e6055866-d238-415c-aa41-f60d7bf0dcf5';
/** `availId` (playerExperience) = `stream.playbackRights.externalIds.availId` de la réponse de lecture */
export const SYNDUALITY_S1E1_AVAIL_ID = 'eb81190f-39ec-476b-841a-b7add45d3315';
/** mediaId du titre interne = `tracking.telemetry.mediaId` de la réponse de lecture */
export const SYNDUALITY_S1E1_MEDIA_ID = '14c83c07-17c3-4aa3-b04c-e53e68dd7393';
/** Début du générique de fin (FFEC, ms) et durée de l'épisode (ms, 24:20) */
export const SYNDUALITY_S1E1_FFEC_MS = 1_429_803;
export const SYNDUALITY_S1E1_RUNTIME_MS = 1_460_084;

/** Chemin probable de la requête de lecture (version et scénario variables) */
export const PLAYBACK_URL = 'https://disney.playback.edge.bamgrid.com/v7/playback/ctr-regular';

/** Réponse de lecture réduite (forme réelle des champs gardés) */
export function syndualityPlayback(): Record<string, unknown> {
  return {
    stream: {
      insertion: {
        mode: 'SGAI',
        points: [{ id: 'INT-0', offset: 0, placement: 'PREROLL', content: [{ type: 'AUXILIARY_CONTENT', subtype: 'BRAND_BUMPER', duration: 5000 }] }],
      },
      editorial: [
        { label: 'FFEC', offsetMillis: SYNDUALITY_S1E1_FFEC_MS },
        { label: 'up_next', offsetMillis: 1_434_808 },
        { label: 'LFEC', offsetMillis: 1_441_023 },
      ],
      playbackRights: { externalIds: { alid: '12ab9363-0149-4389-8de8-08cc2d699e15', availId: SYNDUALITY_S1E1_AVAIL_ID } },
    },
    tracking: {
      telemetry: { mediaId: SYNDUALITY_S1E1_MEDIA_ID },
      conviva: { assetName: `Synduality Noir - s1e1 - mediaId:${SYNDUALITY_S1E1_MEDIA_ID}` },
      qoe: { entityId: SYNDUALITY_S1E1_PLAY_ID },
    },
    playhead: { position: 0, status: 'PlayheadFound' },
  };
}

/**
 * Réponse playerExperience du même épisode, reconstituée à partir des valeurs relevées (availId, titre interne avec le
 * mediaId, durée) ; sans infoBlock : l'identifiant de l'URL n'y figure pas
 */
export function syndualityS1E1(): Record<string, unknown> {
  return response({
    availId: SYNDUALITY_S1E1_AVAIL_ID,
    title: 'Synduality Noir',
    internalTitle: `Synduality Noir - s1e1 - mediaId:${SYNDUALITY_S1E1_MEDIA_ID}`,
    originalLanguage: 'ja',
    timeline: { runtimeMs: SYNDUALITY_S1E1_RUNTIME_MS },
    analytics: { programType: 'episode' },
  });
}
