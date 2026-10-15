import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { CONTENT_KEYS } from '../i18n/content-keys';
import type { Locale } from '../i18n/locale-codes';
import en from '../i18n/locales/en.json';
import { catalogOf } from '../test/catalogs';
import type { StreamingAdapter } from './lib/adapter';

// Point d'entrée commun des scripts de contenu : raccourci sans lecture (CTRL-07), retrait d'une instance orpheline
// quand le script réinjecté démarre (CONT-06) et langue des textes chargée à la demande (PERF-12). Session, URL,
// panneau, toasts et service worker simulés ; moteur i18n réel (i18n/content).

const worker = vi.hoisted(() => ({
  /** Langue des réglages lue dans chrome.storage.local */
  language: 'en',
  /** Réponse du service worker simulé à GET_CONTENT_CATALOG */
  catalog: (locale: string): Promise<unknown> => Promise.reject(new Error(`catalogue ${locale} non prévu`)),
}));
const mocks = vi.hoisted(() => ({
  sendMessage: vi.fn((type: string, payload?: { locale: string }): Promise<unknown> => (type === 'GET_CONTENT_CATALOG' ? worker.catalog(payload?.locale ?? '') : Promise.resolve())),
  showToast: vi.fn(),
  startWatchSession: vi.fn(),
  /** Une session simulée par appel à startWatchSession */
  sessions: [] as { destroy: ReturnType<typeof vi.fn>; forceComplete: ReturnType<typeof vi.fn> }[],
  /** Arrêt du suivi d'URL, un par instance */
  stopUrl: [] as ReturnType<typeof vi.fn>[],
  /** Réponse à GET_PAGE_MEDIA : lecture synchrone, besoin d'un chargement asynchrone, chargement */
  detectPageMedia: vi.fn((): unknown => null),
  needsAsyncPageMedia: vi.fn(() => false),
  loadPageMedia: vi.fn((): Promise<unknown> => Promise.resolve(null)),
}));

vi.mock('../browser/logger', () => {
  const noop = (): void => undefined;
  return { createLogger: () => ({ debug: noop, info: noop, warn: noop, error: noop }) };
});
vi.mock('../protocol/messages', () => ({ sendMessage: mocks.sendMessage }));
vi.mock('./ui/toast', () => ({ showToast: mocks.showToast }));
vi.mock('./ui/sync-toast', () => ({ NOTICE_TOAST_MS: 5_000 }));
vi.mock('./lib/page-media', () => ({ detectPageMedia: mocks.detectPageMedia, needsAsyncPageMedia: mocks.needsAsyncPageMedia, loadPageMedia: mocks.loadPageMedia }));
vi.mock('./lib/live-stream', () => ({ createLiveStream: () => ({ addPeer: vi.fn(), notifySync: vi.fn(), refresh: vi.fn(), peerCount: 0 }) }));
vi.mock('./lib/url-watcher', () => ({
  watchUrl: () => {
    const stop = vi.fn();
    mocks.stopUrl.push(stop);
    return stop;
  },
}));
vi.mock('./lib/watch-session', () => ({ startWatchSession: mocks.startWatchSession }));

const { startContent } = await import('./start');

/**
 * Script de contenu neuf, comme au chargement d'une page : moteur i18n sans les catalogues complets enregistrés par
 * src/test/setup.ts (seul l'anglais embarqué), autres langues demandées au service worker simulé
 */
async function freshStartContent(): Promise<typeof startContent> {
  vi.resetModules();
  return (await import('./start')).startContent;
}

/** Textes des clés de contenu d'une langue, tels que les renvoie le service worker (background/content-catalog.ts) */
function contentSubset(locale: Locale): Record<string, string> {
  return Object.fromEntries(CONTENT_KEYS.map((key) => [key, catalogOf(locale)[key] ?? '']));
}

/** Langues demandées au service worker (GET_CONTENT_CATALOG), dans l'ordre */
const catalogRequests = (): unknown[] => mocks.sendMessage.mock.calls.filter(([type]) => type === 'GET_CONTENT_CATALOG').map(([, payload]) => payload?.locale);

type MessageListener = (message: unknown, sender: { id?: string }, sendResponse: (response?: unknown) => void) => boolean | undefined;
let messageListeners: MessageListener[] = [];

/** chrome.runtime simulé ; sans `id` : contexte invalidé (extension rechargée) */
function stubRuntime(id: string | undefined): void {
  vi.stubGlobal('chrome', {
    runtime: {
      id,
      onMessage: { addListener: (listener: MessageListener) => messageListeners.push(listener) },
      onConnect: { addListener: vi.fn() },
    },
    storage: { local: { get: () => Promise.resolve({ settings: { language: worker.language } }) } },
  });
}

const adapter: StreamingAdapter = {
  platform: 'crunchyroll',
  supportsHost: () => true,
  getEpisodeId: (url) => /\/watch\/(\w+)/.exec(url.pathname)?.[1] ?? null,
  extractEpisodeInfo: () => null,
  detectSeries: () => null,
  findVideo: () => null,
};

const flush = async (): Promise<void> => {
  // Microtâches uniquement : réglages, catalogue du service worker simulé et toast sont des promesses déjà résolues
  for (let i = 0; i < 50; i++) await Promise.resolve();
};

async function start(path: string, entry: typeof startContent = startContent): Promise<void> {
  vi.stubGlobal('location', { hostname: 'www.crunchyroll.com', href: `https://www.crunchyroll.com${path}` });
  entry([adapter]);
  await flush();
}

/** FORCE_COMPLETE (Alt+Shift+K) reçu par la première instance */
function pressShortcut(): void {
  messageListeners[0]?.({ type: 'FORCE_COMPLETE' }, { id: 'synckai' }, vi.fn());
}

beforeEach(() => {
  vi.clearAllMocks();
  worker.language = 'en';
  worker.catalog = (locale) => Promise.reject(new Error(`catalogue ${locale} non prévu`));
  mocks.detectPageMedia.mockReturnValue(null);
  mocks.needsAsyncPageMedia.mockReturnValue(false);
  mocks.loadPageMedia.mockResolvedValue(null);
  mocks.sessions.length = 0;
  mocks.stopUrl.length = 0;
  messageListeners = [];
  stubRuntime('synckai');
  vi.stubGlobal('document', new EventTarget());
  vi.stubGlobal('window', new EventTarget());
  mocks.startWatchSession.mockImplementation((_adapter: StreamingAdapter, episodeId: string) => {
    const session = { episodeId, destroy: vi.fn(), forceComplete: vi.fn(), snapshot: () => null, onStateChange: () => () => undefined };
    mocks.sessions.push(session);
    return session;
  });
});

afterAll(() => {
  vi.unstubAllGlobals();
});

describe('startContent — raccourci « valider l’épisode »', () => {
  it('aucune lecture en cours : toast explicatif', async () => {
    await start('/fr/series/GRMG8ZQZR/one-piece');
    pressShortcut();
    await flush();
    expect(mocks.showToast).toHaveBeenCalledWith(expect.objectContaining({ title: en['content.shortcut.noPlayback.title'] }), expect.anything());
  });

  it('lecture en cours : transmis à la session, sans toast ici', async () => {
    await start('/fr/watch/GE001/romance-dawn');
    pressShortcut();
    await flush();
    expect(mocks.sessions[0]?.forceComplete).toHaveBeenCalledOnce();
    expect(mocks.showToast).not.toHaveBeenCalled();
  });
});

describe('startContent — langue des textes chargée à la demande (PERF-12)', () => {
  beforeEach(() => {
    worker.language = 'de';
    worker.catalog = (locale) => Promise.resolve(contentSubset(locale as Locale));
  });

  it('démarrage en allemand (page de série, page de lecture) : aucune demande au service worker', async () => {
    const entry = await freshStartContent();
    await start('/fr/series/GRMG8ZQZR/one-piece', entry);
    await start('/fr/watch/GE001/romance-dawn', entry);
    expect(catalogRequests()).toEqual([]);
  });

  it('raccourci sans lecture : langue demandée une seule fois, toasts traduits', async () => {
    const entry = await freshStartContent();
    await start('/fr/series/GRMG8ZQZR/one-piece', entry);
    pressShortcut();
    pressShortcut();
    await flush();
    pressShortcut();
    await flush();
    const title = catalogOf('de')['content.shortcut.noPlayback.title'];
    expect(mocks.showToast.mock.calls.map(([content]: unknown[]) => (content as { title: string }).title)).toEqual([title, title, title]);
    expect(catalogRequests()).toEqual(['de']);
  });

  it('service worker injoignable : toast en anglais, nouvel essai au raccourci suivant', async () => {
    const entry = await freshStartContent();
    await start('/fr/series/GRMG8ZQZR/one-piece', entry);
    worker.catalog = () => Promise.reject(new Error('Could not establish connection. Receiving end does not exist.'));
    pressShortcut();
    await flush();
    worker.catalog = (locale) => Promise.resolve(contentSubset(locale as Locale));
    pressShortcut();
    await flush();
    expect(mocks.showToast.mock.calls.map(([content]: unknown[]) => (content as { title: string }).title)).toEqual([
      en['content.shortcut.noPlayback.title'],
      catalogOf('de')['content.shortcut.noPlayback.title'],
    ]);
    expect(catalogRequests()).toEqual(['de', 'de']);
  });
});

describe('startContent — GET_PAGE_MEDIA (popup, panneau)', () => {
  const SERIES = { platform: 'netflix', kind: 'series', seriesTitle: 'Mushoku Tensei' };

  it('lecture synchrone (Crunchyroll, ADN, cache du pont) : réponse immédiate, canal fermé', async () => {
    await start('/fr/series/GRMG8ZQZR/one-piece');
    mocks.detectPageMedia.mockReturnValue(SERIES);
    const sendResponse = vi.fn();
    expect(messageListeners[0]?.({ type: 'GET_PAGE_MEDIA' }, { id: 'synckai' }, sendResponse)).toBeUndefined();
    expect(sendResponse).toHaveBeenCalledWith(SERIES);
    expect(mocks.loadPageMedia).not.toHaveBeenCalled();
  });

  it('page de série d’une plateforme à pont, hors cache : canal gardé ouvert, réponse à l’arrivée des métadonnées', async () => {
    await start('/browse');
    mocks.needsAsyncPageMedia.mockReturnValue(true);
    let resolve: (value: unknown) => void = () => undefined;
    mocks.loadPageMedia.mockReturnValue(new Promise((done) => (resolve = done)));
    const sendResponse = vi.fn();
    expect(messageListeners[0]?.({ type: 'GET_PAGE_MEDIA' }, { id: 'synckai' }, sendResponse)).toBe(true);
    expect(sendResponse).not.toHaveBeenCalled();
    resolve(SERIES);
    await flush();
    expect(sendResponse).toHaveBeenCalledWith(SERIES);
  });

  it('autre extension : ignoré', async () => {
    await start('/browse');
    const sendResponse = vi.fn();
    expect(messageListeners[0]?.({ type: 'GET_PAGE_MEDIA' }, { id: 'autre' }, sendResponse)).toBeUndefined();
    expect(sendResponse).not.toHaveBeenCalled();
  });
});

describe('startContent — instance orpheline (extension rechargée)', () => {
  it('le script réinjecté démarre : l’ancienne instance, orpheline, arrête sa session et ses écouteurs', async () => {
    await start('/fr/watch/GE001/romance-dawn');
    // Mise à jour de l'extension : l'ancienne instance perd son contexte, le service worker réinjecte le script
    stubRuntime(undefined);
    await start('/fr/watch/GE001/romance-dawn');
    expect(mocks.sessions).toHaveLength(2);
    expect(mocks.sessions[0]?.destroy).toHaveBeenCalledOnce();
    expect(mocks.stopUrl[0]).toHaveBeenCalledOnce();
    expect(mocks.sessions[1]?.destroy).not.toHaveBeenCalled();
    expect(mocks.stopUrl[1]).not.toHaveBeenCalled();
  });

  it('instance valide : l’événement (même émis par la page) est sans effet', async () => {
    await start('/fr/watch/GE001/romance-dawn');
    document.dispatchEvent(new Event('synckai:content-started'));
    expect(mocks.sessions[0]?.destroy).not.toHaveBeenCalled();
    expect(mocks.stopUrl[0]).not.toHaveBeenCalled();
  });
});

describe('startContent — épisode changé sans changement d’URL (Prime Video)', () => {
  it('chaque nouvel épisode du lecteur relance le suivi ; le même épisode ne le relance pas', async () => {
    let playing: string | null = null;
    let onEpisode: () => void = () => undefined;
    const stopEpisode = vi.fn();
    const prime: StreamingAdapter = {
      ...adapter,
      platform: 'prime',
      getEpisodeId: () => playing,
      watchEpisode: (onChange) => {
        onEpisode = onChange;
        return stopEpisode;
      },
    };
    vi.stubGlobal('location', { hostname: 'www.primevideo.com', href: 'https://www.primevideo.com/region/eu/detail/0GMSR5WMNJ6EMYQRQ6Y2587WAF' });
    startContent([prime]);
    await flush();
    expect(mocks.sessions).toHaveLength(0);
    playing = 'amzn1.dv.gti.e860c26c-0000-4000-8000-000000000002';
    onEpisode();
    onEpisode();
    playing = 'amzn1.dv.gti.e860c26c-0000-4000-8000-000000000003';
    onEpisode();
    expect(mocks.startWatchSession.mock.calls.map(([, episodeId]: unknown[]) => episodeId)).toEqual([
      'amzn1.dv.gti.e860c26c-0000-4000-8000-000000000002',
      'amzn1.dv.gti.e860c26c-0000-4000-8000-000000000003',
    ]);
    expect(mocks.sessions[0]?.destroy).toHaveBeenCalledOnce();
    // Instance orpheline : suivi des épisodes arrêté avec le reste
    stubRuntime(undefined);
    startContent([prime]);
    await flush();
    expect(stopEpisode).toHaveBeenCalledOnce();
  });
});
