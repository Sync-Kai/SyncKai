// Données de démo du panneau latéral (« En lecture », « Agenda ») et de la page d'import Crunchyroll.
// Fictives mais réalistes : aucune donnée personnelle, aucune jaquette protégée.

import manifest from '../../manifest.json';
import { tl, type Locale } from '../../src/i18n';
import { weekRangeFromKey, type AiringSchedule, type AiringWeekCache } from '../../src/shared/agenda';
import type { CrImportPlan, CrPlanItem, CrReviewItem, CrServicePlan } from '../../src/shared/cr-import';
import type { EpisodeInfo } from '../../src/shared/episode.types';
import { isRecord } from '../../src/shared/guards';
import { LIVE_PORT_NAME, type LiveContentMessage } from '../../src/shared/live.types';
import { pageMediaCacheKey, toCachedPageMedia } from '../../src/shared/page-media-cache';
import type { PageMediaInfo, PageMediaView } from '../../src/shared/page-media.types';
import type { PanelMedia } from '../../src/shared/panel-media.types';
import { STORAGE_KEYS } from '../../src/shared/storage';
import { PANEL_LAST_TAB_KEY, type PanelTab } from '../../src/sidepanel/tabs';
import { bannerUrl, coverUrl } from './covers';
import { demoChrome, episode, SERIES } from './demo-data';
import { createMockPort, type ChromeMockOptions } from './mock-chrome';

// ─── « En lecture » : Frieren, épisode 27 en cours de lecture sur Crunchyroll ─────

const FRIEREN = SERIES.find((s) => s.id === 154587) ?? SERIES[0];
const FRIEREN_TITLE = 'Frieren: Beyond Journey’s End';
const TAB_ID = 1;
const WATCH_URL = 'https://www.crunchyroll.com/watch/DEMOFRIEREN27/';

const FRIEREN_EPISODE: EpisodeInfo = { ...episode('Frieren', 1, 27), episodeId: 'DEMOFRIEREN27', seriesId: 'DEMOFRIEREN', seriesSlug: 'frieren', url: WATCH_URL };

/** Page de lecture lue par le script de contenu de l'onglet */
export const PANEL_PAGE: PageMediaInfo = {
  platform: 'crunchyroll',
  kind: 'episode',
  seriesId: 'DEMOFRIEREN',
  seriesSlug: 'frieren',
  seriesTitle: FRIEREN_TITLE,
  seasonNumber: 1,
  seasonTitle: null,
  seasonEpisodeCount: 28,
  episode: FRIEREN_EPISODE,
};

export function panelView(): PageMediaView {
  return {
    media: {
      mediaId: FRIEREN.id,
      idMal: FRIEREN.malId,
      title: FRIEREN_TITLE,
      coverUrl: coverUrl(FRIEREN.cover),
      episodes: 28,
      format: 'TV',
      year: 2023,
      airingStatus: 'FINISHED',
      nextEpisode: null,
      siteUrl: `https://anilist.co/anime/${FRIEREN.id}`,
    },
    lists: [
      { service: 'anilist', state: 'in-list', status: 'CURRENT', progress: 26, score: 9, siteUrl: `https://anilist.co/anime/${FRIEREN.id}` },
      { service: 'mal', state: 'in-list', status: 'CURRENT', progress: 26, score: 9, siteUrl: `https://myanimelist.net/anime/${FRIEREN.malId}` },
    ],
    confidence: 'certain',
    source: 'page',
    seasons: [],
    episodeProgress: 27,
  };
}

export function panelMedia(): PanelMedia {
  return {
    mediaId: FRIEREN.id,
    idMal: FRIEREN.malId,
    siteUrl: `https://anilist.co/anime/${FRIEREN.id}`,
    title: FRIEREN_TITLE,
    romajiTitle: 'Sousou no Frieren',
    englishTitle: FRIEREN_TITLE,
    bannerUrl: bannerUrl({ from: '#2F6E5E', to: '#8FD9F0', accent: '#FFF6D8' }),
    coverUrl: coverUrl(FRIEREN.cover),
    coverColor: '#2f6e5e',
    // Synopsis absent : la capture montre la progression en direct et les suites sans défilement
    description: null,
    genres: ['Adventure', 'Drama', 'Fantasy'],
    averageScore: 91,
    season: 'FALL',
    seasonYear: 2023,
    format: 'TV',
    episodes: 28,
    airingStatus: 'FINISHED',
    nextEpisode: null,
    studio: { name: 'Madhouse', siteUrl: 'https://anilist.co/studio/11' },
    relations: [
      {
        relationType: 'SEQUEL',
        mediaId: 182255,
        title: 'Frieren: Beyond Journey’s End Season 2',
        format: 'TV',
        coverUrl: coverUrl({ from: '#24506E', to: '#9FD8F0', accent: '#FFF6D8', motif: 'peaks' }),
        siteUrl: 'https://anilist.co/anime/182255',
        platforms: [{ platform: 'crunchyroll', url: 'https://www.crunchyroll.com/series/DEMOFRIEREN2' }],
      },
      {
        relationType: 'SIDE_STORY',
        mediaId: 170068,
        title: 'Frieren: Beyond Journey’s End Mini Anime',
        format: 'ONA',
        coverUrl: coverUrl({ from: '#5A4A1E', to: '#FFD37A', accent: '#FFFFFF', motif: 'sun' }),
        siteUrl: 'https://anilist.co/anime/170068',
        platforms: [],
      },
    ],
  };
}

/** Lecture en cours : 19:20 / 23:40, synchro au générique à 21:30 → « Synchro dans 2 min 10 » */
export const PLAYBACK = { t: 19 * 60 + 20, duration: 23 * 60 + 40, credits: 21 * 60 + 30 } as const;

/** Script de contenu simulé derrière chrome.tabs.connect : état de la page puis position de lecture */
function livePort(name: string): chrome.runtime.Port {
  const mock = createMockPort(name);
  if (name === LIVE_PORT_NAME) {
    const messages: LiveContentMessage[] = [
      { type: 'page', episodeId: FRIEREN_EPISODE.episodeId },
      { type: 'tick', t: PLAYBACK.t, duration: PLAYBACK.duration, paused: false, point: { seconds: PLAYBACK.credits, source: 'credits' }, state: 'watching' },
    ];
    setTimeout(() => messages.forEach((message) => mock.emit(message)), 30);
  }
  return mock.port;
}

// ─── « Agenda » : semaine en cours ─────────────────────────────────────────

/** Jour de diffusion (0 = dimanche) et heure locale de chaque série suivie ; délai Crunchyroll / ADN : +1 h */
const AIRING_SLOTS: { mediaId: number; weekday: number; hour: number; minute: number }[] = [
  { mediaId: 185660, weekday: 2, hour: 17, minute: 0 }, // Dandadan
  { mediaId: 178754, weekday: 3, hour: 16, minute: 30 }, // Kaiju No. 8
  { mediaId: 177937, weekday: 4, hour: 17, minute: 30 }, // Spy x Family
  { mediaId: 176496, weekday: 6, hour: 17, minute: 0 }, // Solo Leveling
  { mediaId: 21, weekday: 0, hour: 16, minute: 15 }, // One Piece (ADN)
];

/** Sorties de la semaine demandée : épisodes passés déjà vus (✓), à venir = épisode suivant */
export function agendaWeek(weekStart: string, now: number): AiringWeekCache | null {
  const range = weekRangeFromKey(weekStart);
  if (!range) return null;
  const today = new Date(now);
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const schedules: AiringSchedule[] = [];
  for (const slot of AIRING_SLOTS) {
    const spec = SERIES.find((s) => s.id === slot.mediaId);
    const dayStart = range.days.find((day) => new Date(day).getDay() === slot.weekday);
    if (!spec || dayStart === undefined) continue;
    const day = new Date(dayStart);
    const at = new Date(day.getFullYear(), day.getMonth(), day.getDate(), slot.hour, slot.minute).getTime();
    schedules.push({
      scheduleId: spec.id * 10,
      mediaId: spec.id,
      episode: dayStart < todayStart ? spec.progress : spec.progress + 1,
      airingAt: Math.floor(at / 1000),
      title: spec.title,
      coverUrl: coverUrl(spec.cover),
    });
  }
  return { weekStart, fetchedAt: now, mediaIds: SERIES.map((s) => s.id), schedules };
}

/** API chrome du panneau latéral sur un onglet Crunchyroll (page de lecture de Frieren) */
export function panelChrome(locale: Locale, tab: PanelTab, now: number = Date.now()): ChromeMockOptions {
  const base = demoChrome(locale, 'watching', now);
  const view = panelView();
  return {
    ...base,
    storage: { ...base.storage, [PANEL_LAST_TAB_KEY]: tab },
    // Fiche de l'onglet déjà résolue (cache de session partagé avec le popup et la synchro)
    session: { [pageMediaCacheKey(TAB_ID)]: toCachedPageMedia(PANEL_PAGE, view, 'resolve', now - 60_000) },
    manifest: { host_permissions: manifest.host_permissions, content_scripts: manifest.content_scripts },
    tab: { url: WATCH_URL, title: FRIEREN_TITLE },
    sidePanel: true,
    tabMessage: (message) => (isRecord(message) && message.type === 'GET_PAGE_MEDIA' ? PANEL_PAGE : undefined),
    connect: (_tabId, name) => livePort(name),
    handlers: {
      ...base.handlers,
      RESOLVE_PAGE_MEDIA: () => ({ ok: true, data: view }),
      GET_PANEL_MEDIA: () => ({ ok: true, data: panelMedia() }),
      GET_AGENDA: (payload) => {
        const week = isRecord(payload) && typeof payload.weekStart === 'string' ? agendaWeek(payload.weekStart, now) : null;
        return week ? { ok: true, data: week } : { ok: false, code: 'API_ERROR', message: 'semaine invalide' };
      },
    },
  };
}

// ─── Import de l'historique Crunchyroll : aperçu ──────────────────────────

/** « AL 8 → 14 (terminé) » ; `current` null : série ajoutée à la liste (« ajout → 6 ») */
const update = (service: CrServicePlan['service'], current: number | null, progress: number, completed = false): CrServicePlan => ({
  service,
  current: current === null ? null : { status: 'CURRENT', progress: current },
  action: 'update',
  progress,
  status: completed ? 'COMPLETED' : 'CURRENT',
});

const upToDate = (service: CrServicePlan['service'], progress: number, completed = false): CrServicePlan => ({
  service,
  current: { status: completed ? 'COMPLETED' : 'CURRENT', progress },
  action: 'skip',
  reason: completed ? 'completed' : 'up-to-date',
});

type Cover = Parameters<typeof coverUrl>[0];

function item(mediaId: number, malId: number, title: string, episodes: number | null, seasons: string[], cover: Cover, services: CrServicePlan[]): CrPlanItem {
  const progress = Math.max(...services.map((s) => (s.action === 'update' ? s.progress : (s.current?.progress ?? 1))), 1);
  return { id: `m:${mediaId}`, mediaId, malId, title, coverUrl: coverUrl(cover), episodes, progress, seasons, services, mappings: [], result: null };
}

function review(key: string, seriesTitle: string, season: number, episodeNumber: number, reason: string): CrReviewItem {
  const label = `${seriesTitle} · S${season}`;
  const ep: EpisodeInfo = { ...episode(seriesTitle, season, episodeNumber), seriesId: `DEMO-${key}`, url: `https://www.crunchyroll.com/watch/DEMO${key}${episodeNumber}/` };
  return { key: `crunchyroll:DEMO-${key}:S${season}`, label, seasons: [label], episode: ep, reason, suggestion: null, candidates: [], created: false };
}

/** Séries déjà à jour (section repliée) */
const UP_TO_DATE: [number, number, string, number, boolean][] = [
  [185660, 60543, 'Dandadan', 7, false],
  [176496, 58567, 'Solo Leveling', 2, false],
  [154587, 52991, 'Frieren: Beyond Journey’s End', 26, false],
  [177937, 59000, 'Spy x Family Season 3', 6, false],
  [21, 21, 'One Piece', 1122, false],
  [127230, 44511, 'Chainsaw Man', 12, true],
  [137822, 49596, 'Blue Lock', 24, true],
  [153518, 52701, 'Delicious in Dungeon', 24, true],
  [150672, 52034, 'Oshi no Ko', 11, true],
  [136430, 49387, 'Vinland Saga Season 2', 24, true],
  [146065, 51179, 'Mushoku Tensei: Jobless Reincarnation Season 2', 13, true],
  [163132, 52588, 'Kaiju No. 8', 12, true],
];

export function importPlan(locale: Locale, now: number): CrImportPlan {
  const toUpdate: CrPlanItem[] = [
    item(163270, 57334, 'Blue Lock Season 2', 14, ['Blue Lock · S2'], { from: '#1B3A8A', to: '#46D6FF', accent: '#FFFFFF', motif: 'bolt' }, [
      update('anilist', 8, 14, true),
      update('mal', 8, 14, true),
    ]),
    item(172019, 57592, 'Dr. Stone: Science Future', 12, ['Dr. STONE · S4 (Science Future)'], { from: '#2F4E2E', to: '#9FE07E', accent: '#FFF6D8', motif: 'rings' }, [
      update('anilist', null, 6),
      update('mal', null, 6),
    ]),
    item(177709, 58939, 'Sakamoto Days', 11, ['Sakamoto Days · S1'], { from: '#5A2B2B', to: '#FF8F6B', accent: '#FFE3A3', motif: 'sun' }, [
      update('anilist', 3, 9),
      upToDate('mal', 9),
    ]),
  ];
  const done = UP_TO_DATE.map(([mediaId, malId, title, progress, completed]) =>
    item(mediaId, malId, title, null, [title], { from: '#3E5C8A', to: '#B9A4FF', accent: '#FFD37A', motif: 'peaks' }, [upToDate('anilist', progress, completed), upToDate('mal', progress, completed)]),
  );
  const items = [...toUpdate, ...done].sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: 'base' }));
  return {
    builtAt: now - 2 * 60_000,
    services: ['anilist', 'mal'],
    stats: { items: 412, pages: 5, partial: false },
    seasonCount: 31,
    items,
    review: [
      review('MUSHOKU', 'Mushoku Tensei: Jobless Reincarnation', 2, 25, tl(locale, 'match.beyondSeason', { episode: 25, total: 13, season: 2 })),
      review('SPYFAMILY', 'Spy x Family', 1, 25, tl(locale, 'match.beyondSeason', { episode: 25, total: 12, season: 1 })),
    ],
    excluded: 0,
    failed: 0,
  };
}

/** API chrome de la page d'import : aperçu prêt (analyse terminée), onglet Crunchyroll ouvert */
export function importChrome(locale: Locale, now: number = Date.now()): ChromeMockOptions {
  const base = demoChrome(locale, 'watching', now);
  return {
    ...base,
    storage: { ...base.storage, [STORAGE_KEYS.crImportPlan]: importPlan(locale, now) },
    manifest: { host_permissions: manifest.host_permissions, content_scripts: manifest.content_scripts },
    tab: { url: 'https://www.crunchyroll.com/', title: 'Crunchyroll' },
  };
}
