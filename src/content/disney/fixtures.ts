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
