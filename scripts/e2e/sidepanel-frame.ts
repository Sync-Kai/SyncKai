// Page de test : monte le VRAI panneau latéral (src/sidepanel/sidepanel.ts) sur l'API chrome simulée des captures
// (onglet Crunchyroll, page de lecture de Frieren). Les tests retiennent des réponses du service worker, changent
// la page de l'onglet et déclenchent tabs.onUpdated via `window.__e2ePanel`, pour reproduire les courses du panneau.
import '../../src/sidepanel/sidepanel.css';
import { airingWeekKey, weekRange, type IsoWeekday } from '../../src/shared/agenda';
import { isRecord } from '../../src/shared/guards';
import type { PageMediaInfo, PageMediaResult } from '../../src/shared/page-media.types';
import { isPanelTab } from '../../src/sidepanel/tabs';
import { agendaWeek, PANEL_PAGE, panelChrome, panelView } from '../screenshots/demo-panel';
import { installChromeMock, type SentMessage } from '../screenshots/mock-chrome';
import { localeParam, param } from '../screenshots/params';
import type { E2EPanelControls, E2EState } from './protocol';

const tabParam = param('tab');
const tab = isPanelTab(tabParam) ? tabParam : 'nowPlaying';
const now = Date.now();
const TAB_ID = 1;

const trace: E2EState = { messages: [], permissionRequests: [], permissionRemovals: [], clipboard: [] };
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
let shownPage: PageMediaInfo = PANEL_PAGE;
let pageReads = 0;

/** Fiche de la page demandée (titre de la page : Frieren ou Dandadan) */
function resolvePage(payload: unknown): PageMediaResult {
  const base = panelView();
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

const base = panelChrome(localeParam(), tab, now);
const agendaError = param('agenda') === 'error';
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

const controls = installChromeMock({
  ...base,
  storage: { ...base.storage, ...expiredWeeks },
  session: param('cache') === 'none' ? {} : base.session,
  tabMessage: (message) => {
    if (!isRecord(message) || message.type !== 'GET_PAGE_MEDIA') return undefined;
    pageReads++;
    return shownPage;
  },
  handlers: {
    ...base.handlers,
    RESOLVE_PAGE_MEDIA: holdable('RESOLVE_PAGE_MEDIA', resolvePage),
    ADJUST_PROGRESS: holdable('ADJUST_PROGRESS', () => ({
      status: 'synced',
      mediaTitle: 'Frieren',
      results: [{ service: 'anilist', outcome: { status: 'updated', progress: 27, completed: false } }],
    })),
    GET_AGENDA: holdable(
      'GET_AGENDA',
      agendaError ? () => ({ ok: false, code: 'API_ERROR', message: 'AniList 429 (e2e)' }) : (base.handlers.GET_AGENDA ?? (() => undefined)),
    ),
  },
  onSendMessage: (message: SentMessage) => trace.messages.push(message),
});

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
