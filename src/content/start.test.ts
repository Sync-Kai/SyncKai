import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { StreamingAdapter } from './adapters/adapter';

// Point d'entrée commun des scripts de contenu : raccourci sans lecture (CTRL-07) et retrait d'une instance
// orpheline quand le script réinjecté démarre (CONT-06). Session, URL, panneau et toasts simulés.

const mocks = vi.hoisted(() => ({
  showToast: vi.fn(),
  startWatchSession: vi.fn(),
  /** Une session simulée par appel à startWatchSession */
  sessions: [] as { destroy: ReturnType<typeof vi.fn>; forceComplete: ReturnType<typeof vi.fn> }[],
  /** Arrêt du suivi d'URL, un par instance */
  stopUrl: [] as ReturnType<typeof vi.fn>[],
}));

vi.mock('../i18n', () => ({ initI18n: () => Promise.resolve(), t: (key: string) => key }));
vi.mock('../shared/logger', () => {
  const noop = (): void => undefined;
  return { createLogger: () => ({ debug: noop, info: noop, warn: noop, error: noop }) };
});
vi.mock('../shared/messages', () => ({ sendMessage: vi.fn(() => Promise.resolve()) }));
vi.mock('./ui/toast', () => ({ showToast: mocks.showToast }));
vi.mock('./ui/sync-toast', () => ({ NOTICE_TOAST_MS: 5_000 }));
vi.mock('./lib/page-media', () => ({ detectPageMedia: () => null }));
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

type MessageListener = (message: unknown, sender: { id?: string }, sendResponse: (response?: unknown) => void) => void;
let messageListeners: MessageListener[] = [];

/** chrome.runtime simulé ; sans `id` : contexte invalidé (extension rechargée) */
function stubRuntime(id: string | undefined): void {
  vi.stubGlobal('chrome', {
    runtime: {
      id,
      onMessage: { addListener: (listener: MessageListener) => messageListeners.push(listener) },
      onConnect: { addListener: vi.fn() },
    },
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
  for (let i = 0; i < 10; i++) await Promise.resolve();
};

async function start(path: string): Promise<void> {
  vi.stubGlobal('location', { hostname: 'www.crunchyroll.com', href: `https://www.crunchyroll.com${path}` });
  startContent([adapter]);
  await flush();
}

beforeEach(() => {
  vi.clearAllMocks();
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
    messageListeners[0]?.({ type: 'FORCE_COMPLETE' }, { id: 'synckai' }, vi.fn());
    expect(mocks.showToast).toHaveBeenCalledWith(expect.objectContaining({ title: 'content.shortcut.noPlayback.title' }), expect.anything());
  });

  it('lecture en cours : transmis à la session, sans toast ici', async () => {
    await start('/fr/watch/GE001/romance-dawn');
    messageListeners[0]?.({ type: 'FORCE_COMPLETE' }, { id: 'synckai' }, vi.fn());
    expect(mocks.sessions[0]?.forceComplete).toHaveBeenCalledOnce();
    expect(mocks.showToast).not.toHaveBeenCalled();
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
