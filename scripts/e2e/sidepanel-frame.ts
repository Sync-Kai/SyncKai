// Page de test : monte le VRAI panneau latéral (src/sidepanel/sidepanel.ts) sur l'API chrome simulée des captures
// (onglet Crunchyroll, page de lecture de Frieren). Les tests retiennent des réponses du service worker, changent
// la page de l'onglet et déclenchent tabs.onUpdated via `window.__e2ePanel`, pour reproduire les courses du panneau.
import '../../src/sidepanel/sidepanel.css';
import manifest from '../../manifest.json';
import { airingWeekKey, weekRange, type IsoWeekday } from '../../src/shared/agenda';
import { t } from '../../src/i18n';
import { isRecord } from '../../src/shared/guards';
import { LIVE_PORT_NAME, type LiveContentMessage, type LiveTickMessage } from '../../src/protocol/live';
import type { PageListState, PageMediaInfo, PageMediaResult, PageMediaView, PageSeason } from '../../src/shared/page-media.types';
import { isPanelTab } from '../../src/sidepanel/tabs';
import { accountDemo, isAccountDemo } from '../screenshots/demo-data';
import { agendaWeek, PANEL_PAGE, panelChrome, panelView, PLAYBACK } from '../screenshots/demo-panel';
import { createMockPort, installChromeMock, type SentMessage } from '../screenshots/mock-chrome';
import { loadedUiLocaleParam, param } from '../screenshots/params';
import type { E2EPanelControls, E2EState } from './protocol';

const tabParam = param('tab');
const tab = isPanelTab(tabParam) ? tabParam : 'nowPlaying';
const now = Date.now();
const TAB_ID = 1;

const trace: E2EState = { messages: [], permissionRequests: [], permissionRemovals: [], clipboard: [], openedTabs: [] };
window.__e2e = trace;

// ─── Page de l'onglet ─────────────────────────────────────────────────────

const DANDADAN_URL = 'https://www.crunchyroll.com/watch/DEMODANDADAN7/';
const DANDADAN_PAGE: PageMediaInfo = {
  ...PANEL_PAGE,
  seriesId: 'DEMODANDADAN',
  seriesSlug: 'dandadan',
  seriesTitle: 'Dandadan',
  seasonEpisodeCount: 12,
  episode: PANEL_PAGE.episode && { ...PANEL_PAGE.episode, episodeId: 'DEMODANDADAN7', seriesId: 'DEMODANDADAN', seriesSlug: 'dandadan', animeTitle: 'Dandadan', seasonEpisodeNumber: 7, displayedEpisodeNumber: 7, url: DANDADAN_URL },
};
/** `page=series` : page de série de Frieren (saison 1), sans épisode */
const SERIES_PAGE: PageMediaInfo = { ...PANEL_PAGE, kind: 'series', episode: null };
const pageParam = param('page');
let shownPage: PageMediaInfo = pageParam === 'series' ? SERIES_PAGE : PANEL_PAGE;
let pageReads = 0;

/** Frieren retirée des listes (« Retirer de la liste ») et commentaire enregistré : relus par RESOLVE_PAGE_MEDIA */
let removed = false;
let savedNotes: string | null = null;

/** Listes de la fiche après les actions du test (retrait, commentaire) */
function withActions(lists: PageListState[]): PageListState[] {
  return lists.map((list): PageListState => {
    if (list.state !== 'in-list') return list;
    if (removed) return { service: list.service, state: 'not-in-list', siteUrl: list.siteUrl };
    return { ...list, notes: savedNotes };
  });
}

const season = (id: number, title: string, year: number, slot: PageSeason['slot']): PageSeason => ({ id, title, format: 'TV', episodes: 28, year, coverUrl: null, slot });

/** Variante de la fiche demandée par `pageView` / `pageList` (états des maquettes PanelSaisonDevinee, PanelListeEtats) */
function demoView(): PageMediaView {
  const demo = panelView();
  const seasons = [season(demo.media.mediaId, demo.media.title, 2023, { season: 1, part: 1, parts: 1 }), season(182255, 'Frieren: Beyond Journey’s End Season 2', 2026, { season: 2, part: 1, parts: 1 })];
  const variant = param('pageView');
  const view: PageMediaView =
    variant === 'uncertain' || variant === 'manual' || variant === 'seasons' || shownPage.kind === 'series'
      ? { ...demo, seasons, confidence: variant === 'uncertain' || variant === 'manual' ? 'uncertain' : 'certain', source: variant === 'manual' ? 'manual' : 'page' }
      : demo;
  const [anilist, mal] = view.lists;
  switch (param('pageList') ?? '') {
    case 'missing':
      return { ...view, lists: view.lists.map((list): PageListState => ({ service: list.service, state: 'not-in-list', siteUrl: '' })) };
    case 'partial':
      return anilist ? { ...view, lists: [anilist, { service: 'mal', state: 'not-in-list', siteUrl: '' }] } : view;
    case 'none':
      return { ...view, lists: [] };
    case 'error':
      return anilist && mal ? { ...view, lists: [anilist, { service: 'mal', state: 'error', message: t('api.network', { service: 'MyAnimeList' }) }] } : view;
    default:
      return view;
  }
}

/** Réponse de RESOLVE_PAGE_MEDIA demandée par `pageMedia` (états de la maquette PanelFicheEtats) */
function pageMediaFailure(): PageMediaResult | null {
  switch (param('pageMedia') ?? '') {
    case 'untracked':
      return { ok: false, code: 'NOT_TRACKED', message: t('page.notTracked', { platform: 'Prime Video' }) };
    case 'off':
      return { ok: false, code: 'NOT_TRACKED', message: t('page.platformOff', { platform: 'Netflix' }) };
    case 'notFound':
      return { ok: false, code: 'NOT_FOUND', message: t('page.notFound', { title: PANEL_PAGE.seriesTitle }) };
    case 'error':
      return { ok: false, code: 'API_ERROR', message: t('api.rateLimited', { service: 'AniList' }) };
    default:
      return null;
  }
}

/** Fiche de la page demandée (titre de la page : Frieren ou Dandadan) */
function resolvePage(payload: unknown): PageMediaResult {
  const failure = pageMediaFailure();
  if (failure) return failure;
  const demo = demoView();
  const base = { ...demo, lists: withActions(demo.lists) };
  const page = isRecord(payload) && isRecord(payload.page) ? payload.page : null;
  if (page?.seriesTitle !== 'Dandadan') return { ok: true, data: base };
  return { ok: true, data: { ...base, media: { ...base.media, mediaId: 185660, idMal: 60543, title: 'Dandadan', episodes: 12 }, episodeProgress: 7 } };
}

// ─── Réponses retenues ────────────────────────────────────────────────────

const held = new Set<string>();
const waiting = new Map<string, (() => void)[]>();

/** Gestionnaire dont la réponse attend `release(type)` quand le type est retenu */
function holdable(type: string, handler: (payload: unknown) => unknown): (payload: unknown) => unknown {
  return (payload) => {
    if (!held.has(type)) return handler(payload);
    return new Promise((resolve) => {
      const queue = waiting.get(type) ?? [];
      queue.push(() => resolve(handler(payload)));
      waiting.set(type, queue);
    });
  };
}

// ─── Installation ─────────────────────────────────────────────────────────

const base = panelChrome(await loadedUiLocaleParam(), tab, now);

// ─── Lecture en direct (`live=<état>`, maquette PanelLectureEtats) ─────────

const tick = (extra: Partial<LiveTickMessage>): LiveTickMessage => ({
  type: 'tick',
  t: PLAYBACK.t,
  duration: PLAYBACK.duration,
  paused: false,
  point: { seconds: PLAYBACK.credits, source: 'credits' },
  state: 'watching',
  ...extra,
});
/** États de la lecture en direct (messages envoyés après l'épisode annoncé) ; textes lus à la connexion, langue chargée */
const liveDemos = (): Readonly<Record<string, readonly LiveContentMessage[]>> => ({
  waiting: [tick({ t: null, duration: null, point: null })],
  noVideo: [tick({ t: null, duration: null, point: null, state: 'no-video' })],
  ratio: [tick({ t: 11 * 60 + 50, point: { seconds: Math.round(PLAYBACK.duration * 0.85), source: 'ratio' } })],
  paused: [tick({ paused: true })],
  passed: [tick({ t: 22 * 60 + 45 })],
  autoOff: [tick({ state: 'idle' })],
  syncing: [tick({ t: PLAYBACK.credits, state: 'syncing' })],
  synced: [tick({ t: 22 * 60 + 5, state: 'synced' })],
  review: [tick({ t: 22 * 60 + 5 }), { type: 'sync', state: 'review', outcome: { status: 'needs-review', message: null } }],
  notConnected: [tick({ t: 22 * 60 + 5, state: 'not-connected' })],
  error: [tick({ t: 22 * 60 + 5 }), { type: 'sync', state: 'error', outcome: { status: 'error', message: t('api.network', { service: 'AniList' }) } }],
  excluded: [tick({ t: 22 * 60 + 5, state: 'excluded' })],
});
const liveParam = param('live');
/** Port de lecture simulé : épisode annoncé puis l'état demandé ; `silent` : connexion refusée (page injoignable) */
function demoLivePort(name: string): chrome.runtime.Port {
  if (liveParam === 'silent') throw new Error('Aucun script de contenu');
  const mock = createMockPort(name);
  const messages = name === LIVE_PORT_NAME ? [{ type: 'page', episodeId: PANEL_PAGE.episode?.episodeId ?? null } as const, ...(liveDemos()[liveParam ?? ''] ?? [])] : [];
  setTimeout(() => messages.forEach((message) => mock.emit(message)), 30);
  return mock.port;
}
const agendaParam = param('agenda');
const agendaError = agendaParam === 'error';
/** États de l'Agenda (maquette PanelAgendaEtats) : `failure` (échec sans programme en cache), `empty` (semaine sans sortie),
 * `noSeries` (listes « En cours » vides), `notConnected` (aucun compte) */
const agendaStorage: Record<string, unknown> =
  agendaParam === 'noSeries'
    ? { watchingCache: { anilist: { service: 'anilist', entries: [], fetchedAt: now }, mal: { service: 'mal', entries: [], fetchedAt: now } } }
    : {};
const agendaDrop = agendaParam === 'notConnected' ? ['anilistToken', 'malToken'] : [];
/** Sorties de la semaine en cache mais expirées, quel que soit le premier jour de la semaine de la langue */
const expiredWeeks = agendaError
  ? Object.fromEntries(
      ([1, 2, 3, 4, 5, 6, 7] as const satisfies readonly IsoWeekday[]).flatMap((day) => {
        const key = weekRange(now, day).key;
        const week = agendaWeek(key, now);
        return week ? [[airingWeekKey(key), { ...week, fetchedAt: now - 3 * 3_600_000 }]] : [];
      }),
    )
  : {};

/** `site=other` : onglet hors plateformes (ligne neutre) ; accès Netflix (seul) accordé avec `netflix=granted` */
const offTarget = param('site') === 'other';
const optionalOrigins = manifest.optional_host_permissions;
const netflixOrigins = optionalOrigins.filter((origin) => origin.includes('netflix.com'));
const offTargetOptions = offTarget
  ? {
      tab: { url: 'https://example.com/', title: 'Example' },
      permissions: { granted: true, onRequest: () => true, optional: optionalOrigins, optionalGranted: param('netflix') === 'granted' ? netflixOrigins : [] },
    }
  : {};

/** `account=expired|loading|no-stats` : compte AniList du menu du compte (voir accountDemo) */
const accountMode = param('account');
const account = accountDemo(isAccountDemo(accountMode) ? accountMode : null, base);

const controls = installChromeMock({
  ...base,
  ...offTargetOptions,
  storage: { ...Object.fromEntries(Object.entries(base.storage).filter(([key]) => !account.drop.includes(key) && !agendaDrop.includes(key))), ...expiredWeeks, ...account.storage, ...agendaStorage },
  // Fiche résolue au démarrage (pas de cache) dès qu'un état de la fiche est demandé
  session: param('cache') === 'none' || param('pageMedia') || param('pageView') || param('pageList') || pageParam ? {} : base.session,
  tabMessage: (message) => {
    if (!isRecord(message) || message.type !== 'GET_PAGE_MEDIA') return undefined;
    pageReads++;
    if (pageParam === 'unreachable') throw new Error('Could not establish connection. Receiving end does not exist.');
    return pageParam === 'none' ? null : shownPage;
  },
  ...(liveParam ? { connect: (_tabId: number, name: string) => demoLivePort(name) } : {}),
  handlers: {
    ...base.handlers,
    ...account.handlers,
    RESOLVE_PAGE_MEDIA: param('pageMedia') === 'hang' ? () => new Promise(() => undefined) : holdable('RESOLVE_PAGE_MEDIA', resolvePage),
    ...(param('details') === 'error' ? { GET_PANEL_MEDIA: () => ({ ok: false, code: 'NETWORK', message: t('api.network', { service: 'AniList' }) }) } : {}),
    ADJUST_PROGRESS: holdable('ADJUST_PROGRESS', () => ({
      status: 'synced',
      mediaTitle: 'Frieren',
      results: [{ service: 'anilist', outcome: { status: 'updated', progress: 27, completed: false } }],
    })),
    REMOVE_FROM_LIST: holdable('REMOVE_FROM_LIST', () => {
      removed = true;
      return { status: 'synced', mediaTitle: 'Frieren', results: [{ service: 'anilist', outcome: { status: 'updated', progress: 0, completed: false } }, { service: 'mal', outcome: { status: 'updated', progress: 0, completed: false } }] };
    }),
    SET_LIST_NOTES: holdable('SET_LIST_NOTES', (payload) => {
      const text = isRecord(payload) && typeof payload.notes === 'string' ? payload.notes.trim() : '';
      savedNotes = text || null;
      return { status: 'synced', mediaTitle: 'Frieren', results: [{ service: 'anilist', outcome: { status: 'updated', progress: 26, completed: false } }, { service: 'mal', outcome: { status: 'updated', progress: 26, completed: false } }] };
    }),
    GET_AGENDA: holdable(
      'GET_AGENDA',
      agendaError || agendaParam === 'failure'
        ? () => (agendaError ? { ok: false, code: 'API_ERROR', message: 'AniList 429 (e2e)' } : { ok: false, code: 'NETWORK', message: t('api.network', { service: 'AniList' }) })
        : agendaParam === 'empty'
          ? (payload: unknown) => ({ ok: true, data: { weekStart: isRecord(payload) && typeof payload.weekStart === 'string' ? payload.weekStart : '', fetchedAt: now, mediaIds: [], schedules: [] } })
          : (base.handlers.GET_AGENDA ?? (() => undefined)),
    ),
  },
  onSendMessage: (message: SentMessage) => trace.messages.push(message),
  // `popup=open` : chrome.action.openPopup présent (barre d'état : messages vers Activité cliquables)
  ...(param('popup') === 'open' ? { onOpenPopup: () => void (trace.popupOpens = (trace.popupOpens ?? 0) + 1) } : {}),
});

// `checking=hold` : la fenêtre du panneau ne répond jamais, l'onglet suivi reste « en vérification » (maquette PanelOuverture)
if (param('checking') === 'hold') chrome.windows.getCurrent = () => new Promise(() => undefined);

const panel: E2EPanelControls = {
  hold: (type) => void held.add(type),
  release: (type) => {
    held.delete(type);
    const queue = waiting.get(type) ?? [];
    waiting.delete(type);
    queue.forEach((answer) => answer());
  },
  navigate: (series) => {
    shownPage = series === 'dandadan' ? DANDADAN_PAGE : PANEL_PAGE;
  },
  emitUpdated: (change) => controls.emitTabUpdated(TAB_ID, change === 'complete' ? { status: 'complete' } : { url: shownPage.episode?.url ?? DANDADAN_URL }),
  pageReads: () => pageReads,
};
window.__e2ePanel = panel;

// Réponses retenues dès le démarrage : `hold=TYPE,TYPE`
for (const type of (param('hold') ?? '').split(',').filter(Boolean)) panel.hold(type);

await import('../../src/sidepanel/sidepanel.ts');
