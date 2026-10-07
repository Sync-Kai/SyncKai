// Données de démo réalistes mais fictives (aucune donnée personnelle, aucune jaquette protégée).

import manifest from '../../manifest.json';
import { tl, type Locale } from '../../src/i18n';
import type { ComparisonResult, DiffSide, ListDiff } from '../../src/shared/compare';
import type { PageMediaInfo, PageMediaView, PageSeason } from '../../src/shared/page-media.types';
import type { ListStatus } from '../../src/shared/sync.types';
import type { AiringCheckResult } from '../../src/shared/airing.types';
import type { AniListViewer } from '../../src/shared/anilist.types';
import type { EpisodeInfo, StreamingPlatform } from '../../src/shared/episode.types';
import type { MalViewer } from '../../src/shared/mal.types';
import type { CandidateSummary, PendingReview, RecentSync } from '../../src/shared/review.types';
import type { SyncSettings } from '../../src/shared/settings';
import { STORAGE_KEYS } from '../../src/shared/storage';
import type { MediaMapping } from '../../src/shared/sync.types';
import type { TrackerId } from '../../src/shared/tracker.types';
import type { AiringStatus, WatchingEntry, WatchingList } from '../../src/shared/watching.types';
import { avatarUrl, coverUrl, type CoverMotif } from './covers';
import type { ChromeMockOptions } from './mock-chrome';

/** Version affichée dans le pied du popup : toujours celle du manifest (relue à chaque génération) */
export const VERSION: string = manifest.version;

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

interface SeriesSpec {
  id: number;
  malId: number;
  title: string;
  progress: number;
  total: number | null;
  status: AiringStatus;
  next: { episode: number; inMs: number } | null;
  updatedAgo: number;
  platform: StreamingPlatform;
  lastSyncAgo: number | null;
  cover: { from: string; to: string; accent: string; motif: CoverMotif };
}

const SERIES: readonly SeriesSpec[] = [
  { id: 185660, malId: 60543, title: 'Dandadan', progress: 7, total: 12, status: 'RELEASING', next: { episode: 8, inMs: 5 * DAY + 4 * HOUR }, updatedAgo: 3 * MIN, platform: 'crunchyroll', lastSyncAgo: 3 * MIN, cover: { from: '#2A3590', to: '#7C5CFF', accent: '#5FE3FF', motif: 'bolt' } },
  { id: 176496, malId: 58567, title: 'Solo Leveling', progress: 2, total: 13, status: 'RELEASING', next: { episode: 4, inMs: 3 * DAY + 6 * HOUR }, updatedAgo: 1 * DAY, platform: 'crunchyroll', lastSyncAgo: 1 * DAY, cover: { from: '#141A3D', to: '#3E5C8A', accent: '#B9A4FF', motif: 'peaks' } },
  { id: 154587, malId: 52991, title: 'Frieren', progress: 26, total: 28, status: 'FINISHED', next: null, updatedAgo: 2 * DAY, platform: 'crunchyroll', lastSyncAgo: 2 * DAY, cover: { from: '#2F6E5E', to: '#7EE0C3', accent: '#FFF6D8', motif: 'sun' } },
  { id: 178754, malId: 59177, title: 'Kaiju No. 8', progress: 4, total: 11, status: 'RELEASING', next: { episode: 5, inMs: 18 * HOUR + 20 * MIN }, updatedAgo: 6 * DAY, platform: 'crunchyroll', lastSyncAgo: 6 * DAY, cover: { from: '#8A5A2B', to: '#FF8FB8', accent: '#FFD37A', motif: 'rings' } },
  { id: 177937, malId: 59000, title: 'Spy x Family', progress: 6, total: 12, status: 'RELEASING', next: { episode: 7, inMs: 2 * DAY + 3 * HOUR }, updatedAgo: 5 * DAY, platform: 'crunchyroll', lastSyncAgo: null, cover: { from: '#8A3B5C', to: '#FF8FB8', accent: '#FFE3EE', motif: 'moon' } },
  { id: 21, malId: 21, title: 'One Piece', progress: 1122, total: null, status: 'RELEASING', next: { episode: 1123, inMs: 4 * DAY + 2 * HOUR }, updatedAgo: 4 * DAY, platform: 'adn', lastSyncAgo: 4 * DAY, cover: { from: '#2B6A73', to: '#46D6FF', accent: '#FFFFFF', motif: 'wave' } },
];

function entry(spec: SeriesSpec, service: TrackerId, now: number): WatchingEntry {
  const url = spec.platform === 'adn' ? `https://animationdigitalnetwork.com/video/${spec.id}` : `https://www.crunchyroll.com/series/demo-${spec.id}`;
  return {
    mediaId: spec.id,
    malId: spec.malId,
    title: spec.title,
    coverUrl: coverUrl(spec.cover),
    progress: spec.progress,
    totalEpisodes: spec.total,
    updatedAt: now - spec.updatedAgo,
    nextEpisode: spec.next ? { episode: spec.next.episode, airingAt: now + spec.next.inMs } : null,
    airingStatus: spec.status,
    platforms: [{ platform: spec.platform, url }],
    lastSync: spec.lastSyncAgo !== null ? { platform: spec.platform, at: now - spec.lastSyncAgo, episodeUrl: url } : null,
    siteUrl: service === 'anilist' ? `https://anilist.co/anime/${spec.id}` : `https://myanimelist.net/anime/${spec.malId}`,
  };
}

/** Liste « En cours » de démo d'un service (exportée pour les tests de bout en bout) */
export function watchingList(service: TrackerId, now: number): WatchingList {
  return { service, entries: SERIES.map((s) => entry(s, service, now)), fetchedAt: now - 2 * MIN };
}

function episode(title: string, season: number | null, number: number, platform: StreamingPlatform = 'crunchyroll'): EpisodeInfo {
  return {
    platform,
    episodeId: `DEMO${title.replace(/\W/g, '').toUpperCase()}${number}`,
    seriesId: `DEMO-${title.replace(/\W/g, '')}`,
    seriesSlug: title.toLowerCase().replace(/\W+/g, '-'),
    animeTitle: title,
    seasonNumber: season,
    seasonTitle: null,
    seasonEpisodeNumber: number,
    displayedEpisodeNumber: number,
    episodeTitle: null,
    url: platform === 'adn' ? 'https://animationdigitalnetwork.com/video/demo' : 'https://www.crunchyroll.com/watch/demo',
  };
}

const KAIJU_COVER = SERIES[3].cover;

function candidates(): CandidateSummary[] {
  return [
    { id: 178754, title: 'Kaiju No. 8 Season 2', format: 'TV', episodes: 11, year: 2025, coverUrl: coverUrl(KAIJU_COVER) },
    { id: 163132, title: 'Kaiju No. 8', format: 'TV', episodes: 12, year: 2024, coverUrl: coverUrl({ from: '#3E5C8A', to: '#B9A4FF', accent: '#FFD37A', motif: 'peaks' }) },
  ];
}

function review(locale: Locale, now: number): PendingReview {
  return {
    key: 'crunchyroll:DEMO-Kaiju8:S2',
    episode: episode('Kaiju No. 8', 2, 5),
    reason: tl(locale, 'match.undetermined'),
    suggestion: { mediaId: 178754, progress: 5 },
    candidates: candidates(),
    previous: null,
    createdAt: now - 4 * MIN,
  };
}

function recentSyncs(now: number): RecentSync[] {
  const sync = (key: string, ep: EpisodeInfo, mediaId: number, mediaTitle: string, progress: number, ago: number): RecentSync => ({ key, episode: ep, mediaId, mediaTitle, progress, syncedAt: now - ago });
  return [
    sync('cr:dandadan', episode('Dandadan', 2, 7), 185660, 'Dandadan Season 2', 7, 3 * MIN),
    sync('cr:solo', episode('Solo Leveling', 2, 2), 176496, 'Solo Leveling Season 2', 2, 1 * DAY),
    sync('adn:op', episode('One Piece', null, 1122, 'adn'), 21, 'One Piece', 1122, 4 * DAY),
  ];
}

function mappings(): Record<string, MediaMapping> {
  return {
    'crunchyroll:DEMO-Dandadan:S2': { mediaId: 185660, numbering: 'season', offset: 0, episodes: 12, seriesLabel: 'Dandadan · S2', mediaTitle: 'Dandadan Season 2' },
    'adn:DEMO-OnePiece': { mediaId: 21, numbering: 'displayed', offset: 0, episodes: null, seriesLabel: 'One Piece', mediaTitle: 'One Piece' },
  };
}

// ─── Fiche de la page (« Sur cette page ») ────────────────────────────────
// Page série Crunchyroll d'une saison découpée en deux fiches AniList (saison 2 · partie 1/2).

const MUSHOKU_COVER = { from: '#3B2A6E', to: '#46D6FF', accent: '#FFE3A3', motif: 'sun' } as const;

export const PAGE_INFO: PageMediaInfo = {
  platform: 'crunchyroll',
  kind: 'series',
  seriesId: 'DEMOMUSHOKU',
  seriesSlug: 'mushoku-tensei-jobless-reincarnation',
  seriesTitle: 'Mushoku Tensei: Jobless Reincarnation',
  seasonNumber: 2,
  seasonTitle: null,
  seasonEpisodeCount: 25,
  episode: null,
};

export function pageView(): PageMediaView {
  const season = (id: number, title: string, year: number, episodes: number, s: number, part: number): PageSeason => ({
    id,
    title,
    format: 'TV',
    episodes,
    year,
    coverUrl: coverUrl(MUSHOKU_COVER),
    slot: { season: s, part, parts: 2 },
  });
  return {
    media: {
      mediaId: 146065,
      idMal: 51179,
      title: 'Mushoku Tensei: Jobless Reincarnation Season 2',
      coverUrl: coverUrl(MUSHOKU_COVER),
      episodes: 13,
      format: 'TV',
      year: 2023,
      airingStatus: 'FINISHED',
      nextEpisode: null,
      siteUrl: 'https://anilist.co/anime/146065',
    },
    lists: [
      { service: 'anilist', state: 'in-list', status: 'CURRENT', progress: 7, score: 8, siteUrl: 'https://anilist.co/anime/146065' },
      { service: 'mal', state: 'in-list', status: 'CURRENT', progress: 7, score: 8, siteUrl: 'https://myanimelist.net/anime/51179' },
    ],
    confidence: 'certain',
    source: 'page',
    episodeProgress: null,
    seasons: [
      season(108465, 'Mushoku Tensei: Jobless Reincarnation', 2021, 11, 1, 1),
      season(127720, 'Mushoku Tensei: Jobless Reincarnation Part 2', 2021, 12, 1, 2),
      season(146065, 'Mushoku Tensei: Jobless Reincarnation Season 2', 2023, 13, 2, 1),
      season(166873, 'Mushoku Tensei: Jobless Reincarnation Season 2 Part 2', 2024, 12, 2, 2),
    ],
  };
}

// ─── Écarts AniList ↔ MAL ─────────────────────────────────────────────────

function comparison(now: number): ComparisonResult {
  const side = (status: ListStatus, progress: number, score: number | null = null): DiffSide => ({ status, progress, score, repeat: 0 });
  const diff = (mediaId: number, malId: number, title: string, cover: Parameters<typeof coverUrl>[0], anilist: DiffSide | null, mal: DiffSide | null, fields: ListDiff['fields']): ListDiff => ({
    key: `mal:${malId}`,
    mediaId,
    malId,
    title,
    coverUrl: coverUrl(cover),
    anilist,
    mal,
    fields,
  });
  // Triés par titre, comme compareLists() : les quatre premiers montrent chaque type d'écart
  const items: ListDiff[] = [
    diff(137822, 49596, 'Blue Lock', { from: '#1B3A8A', to: '#46D6FF', accent: '#FFFFFF', motif: 'bolt' }, side('COMPLETED', 24), side('CURRENT', 22), ['progress', 'status']),
    diff(127230, 44511, 'Chainsaw Man', { from: '#6E1F2E', to: '#FF8F6B', accent: '#FFD37A', motif: 'rings' }, side('COMPLETED', 12, 9), side('COMPLETED', 12, 8), ['score']),
    diff(153518, 52701, 'Delicious in Dungeon', { from: '#5A4A1E', to: '#FFD37A', accent: '#FFF6D8', motif: 'sun' }, side('CURRENT', 9), null, ['presence']),
    diff(154587, 52991, 'Frieren', SERIES[2].cover, side('CURRENT', 26, 9.5), side('CURRENT', 24, 9), ['progress']),
    diff(150672, 52034, 'Oshi no Ko', { from: '#8A3B5C', to: '#FF8FB8', accent: '#FFE3EE', motif: 'moon' }, side('PAUSED', 6), side('CURRENT', 6), ['status']),
    diff(176496, 58567, 'Solo Leveling', SERIES[1].cover, side('CURRENT', 2), side('CURRENT', 1), ['progress']),
    diff(136430, 49387, 'Vinland Saga Season 2', { from: '#2F4E6E', to: '#B9A4FF', accent: '#FFFFFF', motif: 'wave' }, side('CURRENT', 18), side('CURRENT', 16), ['progress']),
  ];
  return {
    analyzedAt: now - 2 * MIN,
    scoreFormat: 'POINT_10_DECIMAL',
    counts: { compared: 412, identical: 412 - items.length, different: items.length, onlyAniList: 1, onlyMal: 0, notComparable: 0 },
    items,
    errors: {},
  };
}

/**
 * Écran rendu par popup-frame :
 * - watching : « En cours » (carte « Reprendre ») ; menu : idem, menu « ⋯ » d'une ligne ouvert ;
 * - page : « En cours » avec la carte « Sur cette page » (onglet actif sur Crunchyroll) ;
 * - activity : carte « À vérifier » ; compare : « Écarts AniList ↔ MAL » analysés ; settings : Réglages.
 */
export type Scenario = 'watching' | 'menu' | 'page' | 'activity' | 'compare' | 'settings';

export function demoChrome(locale: Locale, scenario: Scenario, now: number = Date.now()): ChromeMockOptions {
  const anilistViewer: AniListViewer = { id: 1000001, name: 'Kai_fan', siteUrl: 'https://anilist.co/user/Kai_fan', avatarUrl: avatarUrl('K', '#FF8FB8', '#B9A4FF') };
  const malViewer: MalViewer = { id: 2000002, name: 'Kai_fan', pictureUrl: avatarUrl('K', '#7EE0C3', '#5FE3FF') };
  const settings: SyncSettings = {
    autoSync: true,
    completionTrigger: 'credits',
    completionPercentage: 85,
    notificationLevel: 'detailed',
    preferredPlayer: 'crunchyroll',
    ratingPrompt: true,
    airingAlerts: true,
    airingDelayHours: 0,
    language: locale,
    platformOffsets: { crunchyroll: 60, adn: 60 },
    seriesOffsets: {},
  };
  const airing: AiringCheckResult = { checkedAt: now - 12 * MIN, notified: 1, skipped: null, error: null };
  const lists = { anilist: watchingList('anilist', now), mal: watchingList('mal', now) };
  const far = now + 30 * DAY;

  return {
    locale,
    version: VERSION,
    storage: {
      settings,
      anilistToken: { accessToken: 'demo', expiresAt: far },
      anilistViewer,
      malToken: { accessToken: 'demo', refreshToken: 'demo', expiresAt: far },
      malViewer,
      watchingCache: lists,
      popupPrefs: { source: 'anilist', sort: 'next-episode' },
      // La carte « À vérifier » n'apparaît que sur l'écran Activité (badge cohérent avec la capture)
      pendingReviews: scenario === 'activity' ? [review(locale, now)] : [],
      recentSyncs: recentSyncs(now),
      mediaMappings: mappings(),
      excludedSeries: [],
      syncQueue: [],
      pendingRatings: [],
      airingLastResult: airing,
      ...(scenario === 'compare' ? { [STORAGE_KEYS.compareLast]: comparison(now) } : {}),
    },
    // Content script de l'onglet actif : page série Crunchyroll (scénario « page » seulement)
    tabMessage: (message) =>
      scenario === 'page' && typeof message === 'object' && message !== null && 'type' in message && message.type === 'GET_PAGE_MEDIA' ? PAGE_INFO : undefined,
    handlers: {
      GET_VIEWER: () => ({ ok: true, data: anilistViewer }),
      GET_MAL_VIEWER: () => ({ ok: true, data: malViewer }),
      GET_WATCHING: (payload) => {
        const service: TrackerId = typeof payload === 'object' && payload !== null && 'service' in payload && payload.service === 'mal' ? 'mal' : 'anilist';
        return { ok: true, data: lists[service] };
      },
      CHECK_AIRING: () => airing,
      SEARCH_ANIME: () => ({ ok: true, data: candidates() }),
      RESOLVE_PAGE_MEDIA: () => ({ ok: true, data: pageView() }),
      COMPARE_LISTS: () => ({ ok: true, data: comparison(now) }),
    },
  };
}
