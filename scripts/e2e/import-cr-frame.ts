// Page de test : monte la VRAIE page d'import (src/import-cr/import-cr.ts) sur l'API chrome simulée.
// Onglets Crunchyroll et ADN fictifs (tabs.query) et scripts de contenu simulés derrière chrome.tabs.connect ; le
// service worker simulé construit un aperçu fixe (Crunchyroll ou ADN) dès que l'analyse est demandée. Traces lues
// via `window.__e2e`.
import '../../src/import-cr/import-cr.css';
import manifest from '../../manifest.json';
import { ADN_HISTORY_VIDEOS } from '../../src/shared/__fixtures__/adn-history';
import type { AdnHistoryPortMessage } from '../../src/shared/adn-history';
import type { CrHistoryPortMessage } from '../../src/shared/cr-history';
import { CR_IMPORT_KEYS, startAnalyzeJob, startApplyJob, type CrImportJob, type CrImportPlan } from '../../src/shared/cr-import';
import { isRecord } from '../../src/shared/guards';
import { reduceJob } from '../../src/shared/job';
import { STORAGE_KEYS } from '../../src/shared/storage-keys';
import { installChromeMock } from '../screenshots/mock-chrome';
import { localeParam, param } from '../screenshots/params';
import type { E2EState } from './protocol';

const trace: E2EState = { messages: [], permissionRequests: [], permissionRemovals: [], clipboard: [], openedTabs: [] };
window.__e2e = trace;
const now = Date.now();

/** Lecture simulée : `history=logged-out` → session absente (Crunchyroll) ou jeton ADN absent / refusé */
const historyMode = param('history');

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
  locale: localeParam(),
  version: manifest.version,
  storage: { [STORAGE_KEYS.anilistToken]: { accessToken: 'e2e-anilist', expiresAt: now + 86_400_000 } },
  handlers: {
    // Analyse simulée : tâche lancée puis, peu après, aperçu prêt (comme le service worker en fin d'analyse)
    CR_IMPORT_ANALYZE: (payload) => {
      const adn = isRecord(payload) && payload.platform === 'adn';
      const job = startAnalyzeJob(2, Date.now());
      setTimeout(() => {
        let done: CrImportJob = job;
        for (let i = 0; i < 3; i++) done = reduceJob(done, { type: 'item', outcome: 'updated', at: Date.now() });
        void storageSet?.({ [CR_IMPORT_KEYS.job]: done, [CR_IMPORT_KEYS.plan]: adn ? ADN_PLAN : PLAN });
      }, 80);
      return { ok: true, data: job };
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
});

// Onglets Crunchyroll et ADN ouverts, scripts de contenu à l'écoute
const TABS = [
  { id: 7, status: 'complete', title: 'Crunchyroll', url: 'https://www.crunchyroll.com/' },
  { id: 8, status: 'complete', title: 'ADN', url: 'https://animationdigitalnetwork.com/' },
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
storageSet = (items) => chrome.storage.local.set(items);

await import('../../src/import-cr/import-cr.ts');
