import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { EpisodeInfo } from '../../shared/episode.types';
import type { SyncOutcome } from '../../shared/sync.types';
import type { StreamingAdapter } from '../adapters/adapter';

// Session de lecture avec un adapter asynchrone (Netflix) : DOM, toasts, service worker et lecteur simulés.

const toastHandle = vi.hoisted(() => ({ update: vi.fn(), dismiss: vi.fn() }));
const mocks = vi.hoisted(() => ({
  showToast: vi.fn(),
  sendMessage: vi.fn(),
  isExcluded: vi.fn(),
  getSettings: vi.fn(),
  /** Fin de lecture du lecteur simulé (onCompleted du suivi vidéo) */
  completions: [] as (() => void)[],
  /** Messages warn/error : consignés au journal de diagnostic en production */
  journaled: [] as unknown[][],
}));

vi.mock('../ui/toast', () => ({ showToast: mocks.showToast }));
vi.mock('../ui/engagement-prompt', () => ({ showEngagementPrompt: vi.fn() }));
vi.mock('../../shared/messages', () => ({ sendMessage: mocks.sendMessage }));
vi.mock('../../shared/logger', () => {
  const noop = (): void => undefined;
  const journal = (...args: unknown[]): void => void mocks.journaled.push(args);
  return { createLogger: () => ({ debug: noop, info: noop, warn: journal, error: journal }) };
});
vi.mock('../../shared/exclusions', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../shared/exclusions')>()),
  isExcluded: mocks.isExcluded,
}));
vi.mock('../../shared/settings', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../shared/settings')>()),
  getSettings: mocks.getSettings,
}));
vi.mock('./video-tracker', () => ({
  trackVideoProgress: (_video: HTMLVideoElement, options: { onCompleted: () => void }) => {
    mocks.completions.push(options.onCompleted);
    return { completionPoint: () => null };
  },
}));

const { DEFAULT_SETTINGS } = await import('../../shared/settings');
const { startWatchSession } = await import('./watch-session');

const fakeVideo = { id: '', paused: true, duration: Number.NaN, currentTime: 0 } as unknown as HTMLVideoElement;

function episode(showId: string, watchId: string, overrides: Partial<EpisodeInfo> = {}): EpisodeInfo {
  return {
    platform: 'netflix',
    episodeId: watchId,
    seriesId: showId,
    seriesSlug: null,
    animeTitle: `Série ${showId}`,
    seasonNumber: 1,
    seasonTitle: null,
    seasonEpisodeNumber: 1,
    displayedEpisodeNumber: 1,
    episodeTitle: null,
    url: `https://www.netflix.com/watch/${watchId}`,
    ...overrides,
  };
}

/** Adapter façon Netflix : rien dans le DOM, métadonnées obtenues par requête */
function asyncAdapter(catalog: Record<string, EpisodeInfo>, quiet = true): StreamingAdapter & { loadEpisodeInfo: ReturnType<typeof vi.fn> } {
  return {
    platform: 'netflix',
    quiet,
    supportsHost: () => true,
    getEpisodeId: (url) => /^\/watch\/(\d+)\/?$/.exec(url.pathname)?.[1] ?? null,
    extractEpisodeInfo: () => null,
    detectSeries: () => null,
    findVideo: () => fakeVideo,
    loadEpisodeInfo: vi.fn((watchId: string) => Promise.resolve(catalog[watchId] ?? null)),
  };
}

/** Adapter synchrone (Crunchyroll, ADN) : métadonnées lues dans la page */
function syncAdapter(info: EpisodeInfo): StreamingAdapter {
  return {
    platform: 'crunchyroll',
    supportsHost: () => true,
    getEpisodeId: (url) => /^\/watch\/(\w+)/.exec(url.pathname)?.[1] ?? null,
    extractEpisodeInfo: () => info,
    detectSeries: () => null,
    findVideo: () => fakeVideo,
  };
}

const flush = async (): Promise<void> => {
  // Microtâches uniquement : toutes les attentes simulées sont des promesses déjà résolues
  for (let i = 0; i < 50; i++) await Promise.resolve();
};

function navigate(path: string): void {
  vi.stubGlobal('location', { href: `https://www.netflix.com${path}` });
}

/** Démarre une session, attend le lecteur puis simule la fin de l'épisode */
async function watchToEnd(adapter: StreamingAdapter, watchId: string): Promise<void> {
  navigate(`/watch/${watchId}`);
  mocks.completions.length = 0;
  startWatchSession(adapter, watchId);
  await flush();
  const complete = mocks.completions.at(-1);
  if (!complete) throw new Error('lecteur non suivi');
  complete();
  await flush();
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.journaled.length = 0;
  vi.stubGlobal('chrome', { runtime: { id: 'test' } });
  vi.stubGlobal('document', { fullscreenElement: null });
  mocks.showToast.mockReturnValue(toastHandle);
  mocks.isExcluded.mockResolvedValue(false);
  mocks.getSettings.mockResolvedValue({ ...DEFAULT_SETTINGS, autoSync: true, notificationLevel: 'detailed', completionTrigger: 'percentage' });
});

afterAll(() => {
  vi.unstubAllGlobals();
});

describe('startWatchSession — adapter asynchrone', () => {
  it('métadonnées obtenues par loadEpisodeInfo et envoyées à la fin de l’épisode', async () => {
    const info = episode('100', '1001');
    const adapter = asyncAdapter({ '1001': info });
    mocks.sendMessage.mockResolvedValue({ status: 'needs-review', reason: 'x' } satisfies SyncOutcome);
    await watchToEnd(adapter, '1001');
    expect(adapter.loadEpisodeInfo).toHaveBeenCalledWith('1001', expect.any(AbortSignal));
    expect(mocks.sendMessage).toHaveBeenCalledWith('EPISODE_COMPLETED', { episode: info, services: null });
  });

  it('nouvelle demande à la plateforme si les métadonnées manquaient au démarrage', async () => {
    const info = episode('101', '1011');
    const adapter = asyncAdapter({});
    adapter.loadEpisodeInfo.mockResolvedValueOnce(null).mockResolvedValueOnce(info);
    mocks.sendMessage.mockResolvedValue({ status: 'needs-review', reason: 'x' } satisfies SyncOutcome);
    await watchToEnd(adapter, '1011');
    expect(adapter.loadEpisodeInfo).toHaveBeenCalledTimes(2);
    expect(mocks.sendMessage).toHaveBeenCalledWith('EPISODE_COMPLETED', { episode: info, services: null });
  });

  it('plateforme discrète : vidéo non identifiée sans toast, pas de « Synchronisation… »', async () => {
    await watchToEnd(asyncAdapter({}), '1021');
    expect(mocks.sendMessage).not.toHaveBeenCalled();
    expect(mocks.showToast).not.toHaveBeenCalled();
    // Bande-annonce, bonus regardés jusqu'au bout : cas normal, hors journal de diagnostic
    expect(mocks.journaled).toEqual([]);

    // Envoi en cours : aucun toast de progression même en mode détaillé
    mocks.sendMessage.mockReturnValue(new Promise<SyncOutcome>(() => undefined));
    await watchToEnd(asyncAdapter({ '1022': episode('102', '1022') }), '1022');
    expect(mocks.sendMessage).toHaveBeenCalledOnce();
    expect(mocks.showToast).not.toHaveBeenCalled();
  });

  it('série ignorée : rien d’affiché, l’épisode suivant n’est pas renvoyé au service worker', async () => {
    const catalog = { '1031': episode('103', '1031'), '1032': episode('103', '1032', { seasonEpisodeNumber: 2, displayedEpisodeNumber: 2 }) };
    const adapter = asyncAdapter(catalog);
    const states: string[] = [];
    mocks.sendMessage.mockResolvedValue({ status: 'ignored' } satisfies SyncOutcome);

    navigate('/watch/1031');
    mocks.completions.length = 0;
    const session = startWatchSession(adapter, '1031');
    session.onStateChange((state) => states.push(state));
    await flush();
    mocks.completions.at(-1)?.();
    await flush();
    expect(mocks.sendMessage).toHaveBeenCalledOnce();
    expect(states.at(-1)).toBe('idle');
    session.destroy();

    await watchToEnd(adapter, '1032');
    expect(mocks.sendMessage).toHaveBeenCalledOnce();
    expect(mocks.showToast).not.toHaveBeenCalled();

    // Une autre série reste envoyée
    const other = asyncAdapter({ '1041': episode('104', '1041') });
    await watchToEnd(other, '1041');
    expect(mocks.sendMessage).toHaveBeenCalledTimes(2);
  });

  it('accès Netflix retiré : rien d’affiché, mais la série n’est pas retenue (accès accordé de nouveau sans recharger)', async () => {
    const catalog = { '1051': episode('105', '1051'), '1052': episode('105', '1052', { seasonEpisodeNumber: 2, displayedEpisodeNumber: 2 }) };
    const adapter = asyncAdapter(catalog);
    mocks.sendMessage.mockResolvedValue({ status: 'ignored', noAccess: true } satisfies SyncOutcome);
    await watchToEnd(adapter, '1051');
    expect(mocks.sendMessage).toHaveBeenCalledOnce();
    expect(mocks.showToast).not.toHaveBeenCalled();

    mocks.sendMessage.mockResolvedValue({ status: 'needs-review', reason: 'x' } satisfies SyncOutcome);
    await watchToEnd(adapter, '1052');
    expect(mocks.sendMessage).toHaveBeenCalledTimes(2);
  });
});

describe('startWatchSession — adapter synchrone (inchangé)', () => {
  it('métadonnées lues dans la page, toast « Synchronisation… » en mode détaillé', async () => {
    const info = episode('GRMG8ZQZR', 'GE001', { platform: 'crunchyroll' });
    mocks.sendMessage.mockResolvedValue({ status: 'needs-review', reason: 'x' } satisfies SyncOutcome);
    await watchToEnd(syncAdapter(info), 'GE001');
    expect(mocks.sendMessage).toHaveBeenCalledWith('EPISODE_COMPLETED', { episode: info, services: null });
    expect(mocks.showToast).toHaveBeenCalledWith(expect.objectContaining({ tone: 'info' }));
  });

  it('épisode non identifié : toast d’erreur', async () => {
    const adapter: StreamingAdapter = { ...syncAdapter(episode('X', 'GE002')), extractEpisodeInfo: () => null };
    navigate('/watch/GE002');
    mocks.completions.length = 0;
    // Sans métadonnées, waitFor observe le DOM : MutationObserver simulé (jamais déclenché)
    vi.stubGlobal('MutationObserver', class { observe(): void {} disconnect(): void {} });
    vi.stubGlobal('document', { fullscreenElement: null, documentElement: {} });
    const session = startWatchSession(adapter, 'GE002');
    await flush();
    mocks.completions.at(-1)?.();
    await flush();
    expect(mocks.sendMessage).not.toHaveBeenCalled();
    expect(mocks.showToast).toHaveBeenCalledWith(expect.objectContaining({ tone: 'error' }), expect.anything());
    // Plateforme d'animes : un épisode non identifié reste une anomalie consignée
    expect(mocks.journaled.length).toBeGreaterThan(0);
    session.destroy();
  });
});
