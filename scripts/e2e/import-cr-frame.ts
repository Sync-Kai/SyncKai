// Page de test : monte la VRAIE page d'import (src/import-cr/import-cr.ts) sur l'API chrome simulée.
// Onglets Crunchyroll, ADN et Netflix fictifs (tabs.query) et scripts de contenu simulés derrière chrome.tabs.connect
// (Netflix : chrome.scripting.executeScript simulé, page Activité de 45 lignes, « Voir plus » par 20) ; le service worker
// simulé filtre les titres Netflix et construit un aperçu fixe dès que l'analyse est demandée. Traces lues via `window.__e2e`.
import '../../src/import-cr/import-cr.css';
import manifest from '../../manifest.json';
import { ADN_HISTORY_VIDEOS } from '../../src/shared/__fixtures__/adn-history';
import { movieShow, NETFLIX_ROWS, onePieceShow, ranmaShow } from '../../src/shared/__fixtures__/netflix-history';
import type { AdnHistoryPortMessage } from '../../src/protocol/adn-history';
import type { CrHistoryPortMessage } from '../../src/shared/cr-history';
import { CR_IMPORT_KEYS, startAnalyzeJob, startApplyJob, type CrImportJob, type CrImportPlan } from '../../src/shared/cr-import';
import { isRecord } from '../../src/shared/guards';
import { reduceJob } from '../../src/shared/job';
import { STORAGE_KEYS } from '../../src/protocol/storage-keys';
import { installChromeMock } from '../screenshots/mock-chrome';
import { loadedUiLocaleParam, param } from '../screenshots/params';
import type { E2EState } from './protocol';

const trace: E2EState = { messages: [], permissionRequests: [], permissionRemovals: [], clipboard: [], openedTabs: [] };
window.__e2e = trace;
const now = Date.now();

/** Lecture simulée : `history=logged-out` → session absente (Crunchyroll) ou jeton ADN absent / refusé */
const historyMode = param('history');
/** `netflix=denied` : accès optionnel à netflix.com pas encore accordé */
const netflixMode = param('netflix');
const NETFLIX_PATTERN = '*://*.netflix.com/*';

const season = (seriesId: string, seriesTitle: string, seasonNumber: number, episodeNumber: number) => ({
  seriesId,
  seriesTitle,
  seriesSlug: null,
  seasonId: `${seriesId}S${seasonNumber}`,
  seasonNumber,
  seasonTitle: seriesTitle,
  episodeId: `${seriesId}E${episodeNumber}`,
  episodeTitle: null,
  episodeNumber,
  seasonEpisodeNumber: episodeNumber,
  watchedCount: episodeNumber,
  lastPlayedAt: now,
});

const PLAN: CrImportPlan = {
  builtAt: now,
  services: ['anilist', 'mal'],
  stats: { items: 240, pages: 3, partial: false },
  seasonCount: 4,
  items: [
    {
      id: 'm:100',
      mediaId: 100,
      malId: 200,
      title: 'Black Butler',
      coverUrl: null,
      episodes: 24,
      progress: 9,
      seasons: ['Black Butler · S1'],
      services: [
        { service: 'anilist', current: { status: 'CURRENT', progress: 7 }, action: 'update', progress: 9, status: 'CURRENT' },
        { service: 'mal', current: null, action: 'update', progress: 9, status: 'CURRENT' },
      ],
      mappings: [],
      result: null,
    },
    {
      id: 'm:300',
      mediaId: 300,
      malId: 301,
      title: 'Slime',
      coverUrl: null,
      episodes: 12,
      progress: 4,
      seasons: ['Slime · S4'],
      services: [
        { service: 'anilist', current: null, action: 'update', progress: 4, status: 'CURRENT' },
        { service: 'mal', current: { status: 'CURRENT', progress: 4 }, action: 'skip', reason: 'up-to-date' },
      ],
      mappings: [],
      result: null,
    },
    {
      id: 'm:21',
      mediaId: 21,
      malId: 21,
      title: 'ONE PIECE',
      coverUrl: null,
      episodes: null,
      progress: 1180,
      seasons: ['One Piece · S24 (Elbaph)'],
      services: [
        { service: 'anilist', current: { status: 'CURRENT', progress: 1180 }, action: 'skip', reason: 'up-to-date' },
        { service: 'mal', current: { status: 'CURRENT', progress: 1180 }, action: 'skip', reason: 'up-to-date' },
      ],
      mappings: [],
      result: null,
    },
  ],
  review: [
    {
      key: 'crunchyroll:GRX:s2',
      label: 'Mystery · S2',
      seasons: ['Mystery · S2'],
      episode: {
        platform: 'crunchyroll',
        episodeId: 'GRXE3',
        seriesId: 'GRX',
        seriesSlug: null,
        animeTitle: 'Mystery',
        seasonNumber: 2,
        seasonTitle: 'Mystery',
        seasonEpisodeNumber: 3,
        displayedEpisodeNumber: 3,
        episodeTitle: null,
        url: 'https://www.crunchyroll.com/watch/GRXE3',
      },
      reason: 'Saison 2 non liée',
      suggestion: null,
      candidates: [],
      created: false,
    },
  ],
  excluded: 0,
  failed: 0,
};

/** Aperçu de l'historique ADN (voir src/shared/__fixtures__/adn-history.ts) */
const ADN_PLAN: CrImportPlan = {
  builtAt: now + 1,
  platform: 'adn',
  services: ['anilist', 'mal'],
  stats: { items: ADN_HISTORY_VIDEOS.length, pages: 1, partial: false },
  seasonCount: 3,
  items: [
    {
      id: 'm:500',
      mediaId: 500,
      malId: 501,
      title: 'Even the Student Council Has Its Holes!',
      coverUrl: null,
      episodes: 12,
      progress: 1,
      seasons: ['Even the Student Council Has Its Holes! · S1'],
      services: [
        { service: 'anilist', current: null, action: 'update', progress: 1, status: 'CURRENT' },
        { service: 'mal', current: null, action: 'update', progress: 1, status: 'CURRENT' },
      ],
      mappings: [],
      result: null,
    },
  ],
  review: [
    {
      key: 'adn:1290:s1',
      label: 'The Girl Downstairs · S1',
      seasons: ['The Girl Downstairs · S1'],
      episode: {
        platform: 'adn',
        episodeId: '27003',
        seriesId: '1290',
        seriesSlug: 'the-girl-downstairs',
        animeTitle: 'The Girl Downstairs',
        seasonNumber: 1,
        seasonTitle: null,
        seasonEpisodeNumber: 3,
        displayedEpisodeNumber: 3,
        episodeTitle: 'Épisode 3',
        url: 'https://animationdigitalnetwork.com/video/1290-the-girl-downstairs/27003',
      },
      reason: 'Aucune fiche trouvée',
      suggestion: null,
      candidates: [],
      created: false,
    },
  ],
  excluded: 0,
  failed: 0,
};

/** Aperçu de l'historique Netflix (Ranma ½ S1E5) */
const NETFLIX_PLAN: CrImportPlan = {
  builtAt: now + 2,
  platform: 'netflix',
  services: ['anilist', 'mal'],
  stats: { items: 45, pages: 3, partial: false, ignored: 39 },
  seasonCount: 3,
  items: [
    {
      id: 'm:178533',
      mediaId: 178533,
      malId: 58936,
      title: 'Ranma1/2 (2024)',
      coverUrl: null,
      episodes: 12,
      progress: 5,
      seasons: ['Ranma1/2 · S1'],
      services: [
        { service: 'anilist', current: { status: 'CURRENT', progress: 3 }, action: 'update', progress: 5, status: 'CURRENT' },
        { service: 'mal', current: null, action: 'update', progress: 5, status: 'CURRENT' },
      ],
      mappings: [],
      result: null,
    },
  ],
  review: [],
  excluded: 0,
  failed: 0,
  ignored: 40,
};

/** Page Activité de visionnage simulée : 20 lignes au chargement, 20 de plus par clic sur « Voir plus », 45 en tout */
const netflixPage = { rows: 20, clicks: 0 };
const NETFLIX_TOTAL = 45;
const netflixRows = (): { href: string; text: string }[] =>
  Array.from({ length: netflixPage.rows }, (_, i) => {
    const row = NETFLIX_ROWS[i];
    return row ? { href: `/title/${row.id}`, text: row.text } : { href: `/title/${70000000 + i}`, text: `Série ${i} : Saison 1 : "Épisode 1"` };
  });

/** chrome.scripting.executeScript simulé : la fonction injectée (netflixTabOp) est identifiée par son opération */
function netflixScript(op: unknown, movieId: unknown): unknown {
  if (op === 'state') return { path: '/viewingactivity', rows: netflixPage.rows, more: netflixPage.rows < NETFLIX_TOTAL, gate: false, list: true };
  if (op === 'click') {
    netflixPage.clicks++;
    netflixPage.rows = Math.min(NETFLIX_TOTAL, netflixPage.rows + 20);
    return true;
  }
  if (op === 'rows') return netflixRows();
  const shows = [ranmaShow(), onePieceShow(true), movieShow(7300)];
  return shows.find((show) => show.showId === movieId || show.seasons.some((season) => season.episodes.some((episode) => episode.id === movieId))) ?? null;
}

/** Filtre « anime » simulé : Ranma ½, One Piece et le film liés à Netflix ; le reste n'est pas un anime */
const NETFLIX_LINKS: Record<string, string[]> = { 'Ranma ½': ['81301833'], 'One Piece': ['80107103'], 'Le Voyage de Chihiro': ['60023642'] };

/** Port vers le script de contenu simulé : progression puis historique (ou erreur) */
function fakePort(name: string): chrome.runtime.Port {
  const messageListeners = new Set<(message: unknown) => void>();
  const disconnectListeners = new Set<() => void>();
  let open = true;
  const emit = (message: CrHistoryPortMessage | AdnHistoryPortMessage, delay: number): void => {
    setTimeout(() => open && messageListeners.forEach((l) => l(structuredClone(message))), delay);
  };
  const event = <T>(set: Set<T>) => ({ addListener: (l: T) => void set.add(l), removeListener: (l: T) => void set.delete(l), hasListener: (l: T) => set.has(l) });
  const port = {
    name,
    postMessage: (message: unknown) => {
      if (isRecord(message) && message.type === 'READ_ADN_HISTORY' && name === 'synckai:adn-history') {
        if (historyMode === 'logged-out') {
          emit({ type: 'error', code: 'logged-out' }, 20);
          return;
        }
        emit({ type: 'progress', pages: 1, items: ADN_HISTORY_VIDEOS.length }, 20);
        emit({ type: 'done', result: { videos: ADN_HISTORY_VIDEOS, stats: { items: ADN_HISTORY_VIDEOS.length, pages: 1, partial: false } } }, 60);
        return;
      }
      if (!isRecord(message) || message.type !== 'READ_CR_HISTORY' || name !== 'synckai:cr-history') return;
      if (historyMode === 'logged-out') {
        emit({ type: 'error', code: 'logged-out' }, 20);
        return;
      }
      emit({ type: 'progress', pages: 1, items: 100, lookups: 0, lookupsTotal: 0 }, 20);
      emit({ type: 'done', result: { seasons: [season('GRBB', 'Black Butler', 1, 9), season('GRSL', 'Slime', 4, 4)], stats: { items: 240, pages: 3, partial: false } } }, 60);
    },
    disconnect: () => {
      open = false;
    },
    onMessage: event(messageListeners),
    onDisconnect: event(disconnectListeners),
  };
  return port as unknown as chrome.runtime.Port;
}

let storageSet: ((items: Record<string, unknown>) => Promise<void>) | null = null;

installChromeMock({
  locale: await loadedUiLocaleParam(),
  version: manifest.version,
  storage: { [STORAGE_KEYS.anilistToken]: { accessToken: 'e2e-anilist', expiresAt: now + 86_400_000 } },
  handlers: {
    // Analyse simulée : tâche lancée puis, peu après, aperçu prêt (comme le service worker en fin d'analyse)
    CR_IMPORT_ANALYZE: (payload) => {
      const platform = isRecord(payload) ? payload.platform : undefined;
      const job = startAnalyzeJob(2, Date.now());
      setTimeout(() => {
        let done: CrImportJob = job;
        for (let i = 0; i < 3; i++) done = reduceJob(done, { type: 'item', outcome: 'updated', at: Date.now() });
        void storageSet?.({ [CR_IMPORT_KEYS.job]: done, [CR_IMPORT_KEYS.plan]: platform === 'adn' ? ADN_PLAN : platform === 'netflix' ? NETFLIX_PLAN : PLAN });
      }, 80);
      return { ok: true, data: job };
    },
    NETFLIX_IMPORT_TITLES: (payload) => {
      const titles = isRecord(payload) && Array.isArray(payload.titles) ? payload.titles.filter((title): title is string => typeof title === 'string') : [];
      return { ok: true, data: titles.map((title) => ({ title, showIds: NETFLIX_LINKS[title] ?? [], titleMatch: false })) };
    },
    CR_IMPORT_APPLY: (payload) => {
      const ids = isRecord(payload) && Array.isArray(payload.ids) ? payload.ids.filter((id): id is string => typeof id === 'string') : [];
      return { ok: true, data: startApplyJob(ids, Date.now()) };
    },
    CR_IMPORT_REVIEWS: () => ({ ok: true, data: { created: 1, limited: false } }),
    CR_IMPORT_CANCEL: () => ({ ok: true, data: null }),
  },
  onSendMessage: (message) => trace.messages.push(message),
  manifest: { host_permissions: manifest.host_permissions, content_scripts: manifest.content_scripts },
  // Accès du manifeste accordé ; Netflix (optionnel) accordé sauf `netflix=denied`, accordé à la demande
  permissions: {
    granted: true,
    optional: [NETFLIX_PATTERN],
    optionalGranted: netflixMode === 'denied' ? [] : [NETFLIX_PATTERN],
    onRequest: (origins) => {
      trace.permissionRequests.push(origins);
      return true;
    },
  },
});

// Onglets Crunchyroll et ADN ouverts, scripts de contenu à l'écoute
const TABS = [
  { id: 7, status: 'complete', title: 'Crunchyroll', url: 'https://www.crunchyroll.com/' },
  { id: 8, status: 'complete', title: 'ADN', url: 'https://animationdigitalnetwork.com/' },
  { id: 9, status: 'complete', title: 'Netflix', url: 'https://www.netflix.com/viewingactivity' },
];
Object.assign(chrome.tabs, {
  query: (info: { url?: string | string[] }) => {
    const patterns = [info.url ?? []].flat();
    return Promise.resolve(TABS.filter((tab) => patterns.some((pattern) => tab.url.startsWith(pattern.replace(/\*$/, '')))));
  },
  connect: (_tabId: number, info: { name?: string }) => fakePort(info.name ?? ''),
  update: () => Promise.resolve({}),
  reload: () => Promise.resolve(),
});
Object.assign(chrome, {
  scripting: {
    executeScript: (injection: { target: { tabId: number }; args?: unknown[] }) => {
      if (injection.target.tabId !== 9) return Promise.reject(new Error('Onglet hors de netflix.com'));
      const [op, , movieId] = injection.args ?? [];
      return Promise.resolve([{ frameId: 0, result: structuredClone(netflixScript(op, movieId)) }]);
    },
  },
});
window.__e2eNetflix = netflixPage;
storageSet = (items) => chrome.storage.local.set(items);

await import('../../src/import-cr/import-cr.ts');
