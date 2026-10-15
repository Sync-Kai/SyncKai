import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CONTENT_KEYS } from '../../i18n/content-keys';
import type { Locale } from '../../i18n/locale-codes';
import en from '../../i18n/locales/en.json';
import { catalogOf } from '../../test/catalogs';
import type { EpisodeInfo } from '../../shared/episode.types';
import type { SyncOutcome } from '../../shared/sync.types';
import type { StreamingAdapter } from './adapter';

// Session de lecture (adapters synchrone et asynchrone) : DOM, toasts, service worker et lecteur simulés.

const toastHandle = vi.hoisted(() => ({ update: vi.fn(), dismiss: vi.fn() }));
const mocks = vi.hoisted(() => ({
  showToast: vi.fn(),
  sendMessage: vi.fn(),
  isExcluded: vi.fn(),
  getContentSettings: vi.fn(),
  /** Fin de lecture du lecteur simulé (onCompleted du suivi vidéo) */
  completions: [] as (() => void)[],
  /** <video> suivies, dans l'ordre, avec le signal de leur tracker et la lecture de position transmise */
  tracked: [] as { video: HTMLVideoElement; signal: AbortSignal; readPlayback?: (video: HTMLVideoElement) => unknown; getCreditsStart: () => number | null }[],
  /** Messages warn/error : consignés au journal de diagnostic en production */
  journaled: [] as unknown[][],
}));

vi.mock('../ui/toast', () => ({ showToast: mocks.showToast }));
vi.mock('../ui/engagement-prompt', () => ({ showEngagementPrompt: vi.fn() }));
vi.mock('../../protocol/messages', () => ({ sendMessage: mocks.sendMessage }));
vi.mock('../../browser/logger', () => {
  const noop = (): void => undefined;
  const journal = (...args: unknown[]): void => void mocks.journaled.push(args);
  return { createLogger: () => ({ debug: noop, info: noop, warn: journal, error: journal }) };
});
vi.mock('../../browser/storage/exclusions-read', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../browser/storage/exclusions-read')>()),
  isExcluded: mocks.isExcluded,
}));
vi.mock('../../browser/storage/content-settings', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../browser/storage/content-settings')>()),
  getContentSettings: mocks.getContentSettings,
}));
vi.mock('./video-tracker', () => ({
  trackVideoProgress: (
    video: HTMLVideoElement,
    options: { onCompleted: () => void; signal: AbortSignal; readPlayback?: (video: HTMLVideoElement) => unknown; getCreditsStart: () => number | null },
  ) => {
    mocks.completions.push(options.onCompleted);
    mocks.tracked.push({ video, signal: options.signal, readPlayback: options.readPlayback, getCreditsStart: options.getCreditsStart });
    return { completionPoint: () => null };
  },
}));

const { DEFAULT_CONTENT_SETTINGS } = await import('../../shared/content-settings');
const { startWatchSession, VIDEO_POLL_MS } = await import('./watch-session');

/** Fausse <video> : seules les propriétés lues par la session */
function makeVideo(id = ''): HTMLVideoElement & { isConnected: boolean } {
  return { id, paused: true, duration: Number.NaN, currentTime: 0, isConnected: true } as unknown as HTMLVideoElement & { isConnected: boolean };
}

const fakeVideo = makeVideo();

/** Faux `document` : cible des écouteurs capturés (événements média) */
let doc: EventTarget & { fullscreenElement: null; documentElement: object };

function installDocument(): void {
  doc = Object.assign(new EventTarget(), { fullscreenElement: null, documentElement: {} });
  vi.stubGlobal('document', doc);
}

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
  mocks.tracked.length = 0;
  vi.stubGlobal('chrome', { runtime: { id: 'test' } });
  installDocument();
  // waitFor (métadonnées absentes du DOM) : MutationObserver simulé, jamais déclenché
  vi.stubGlobal('MutationObserver', class { observe(): void {} disconnect(): void {} });
  mocks.showToast.mockReturnValue(toastHandle);
  mocks.isExcluded.mockResolvedValue(false);
  mocks.getContentSettings.mockResolvedValue({ ...DEFAULT_CONTENT_SETTINGS, autoSync: true, notificationLevel: 'detailed', completionTrigger: 'percentage' });
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

  it('début du générique en échec (promesse rejetée) : repli sur le ratio comme un null, aucun rejet non géré', async () => {
    mocks.getContentSettings.mockResolvedValue({ ...DEFAULT_CONTENT_SETTINGS, autoSync: true, completionTrigger: 'credits' });
    const unhandled: unknown[] = [];
    const onUnhandled = (reason: unknown): void => void unhandled.push(reason);
    // Process Node du lanceur de tests (types Node absents de src/)
    const node = Reflect.get(globalThis, 'process') as { on(event: string, listener: (reason: unknown) => void): void; off(event: string, listener: (reason: unknown) => void): void };
    node.on('unhandledRejection', onUnhandled);
    try {
      const failing: StreamingAdapter = { ...syncAdapter(episode('GRMG8ZQZR', 'GE003')), getCreditsStart: () => Promise.reject(new Error('pont absent')) };
      navigate('/watch/GE003');
      startWatchSession(failing, 'GE003');
      await flush();
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(mocks.tracked.at(-1)?.getCreditsStart()).toBeNull();
      expect(unhandled).toEqual([]);
      // Témoin : une valeur obtenue est bien transmise au suivi
      const working: StreamingAdapter = { ...syncAdapter(episode('GRMG8ZQZR', 'GE004')), getCreditsStart: () => Promise.resolve(1312) };
      navigate('/watch/GE004');
      startWatchSession(working, 'GE004');
      await flush();
      expect(mocks.tracked.at(-1)?.getCreditsStart()).toBe(1312);
    } finally {
      node.off('unhandledRejection', onUnhandled);
    }
  });

  it('épisode non identifié : toast d’erreur', async () => {
    const adapter: StreamingAdapter = { ...syncAdapter(episode('X', 'GE002')), extractEpisodeInfo: () => null };
    navigate('/watch/GE002');
    mocks.completions.length = 0;
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

describe('startWatchSession — langue des textes chargée à la demande (PERF-12)', () => {
  /** Session d'un script de contenu neuf : seul l'anglais embarqué, les autres langues demandées au service worker */
  async function freshSession(): Promise<typeof startWatchSession> {
    vi.resetModules();
    return (await import('./watch-session')).startWatchSession;
  }

  /** Service worker simulé : textes de contenu d'une langue (`catalog`), résultat de la synchronisation */
  function stubWorker(outcome: SyncOutcome, catalog: (locale: Locale) => Promise<unknown> = (locale) => Promise.resolve(contentSubset(locale))): void {
    mocks.sendMessage.mockImplementation((type: string, payload: { locale: Locale }) => (type === 'GET_CONTENT_CATALOG' ? catalog(payload.locale) : Promise.resolve(outcome)));
  }

  const catalogRequests = (): unknown[] => mocks.sendMessage.mock.calls.filter(([type]) => type === 'GET_CONTENT_CATALOG').map(([, payload]) => (payload as { locale: Locale }).locale);
  const toastTitles = (): unknown[] => mocks.showToast.mock.calls.map(([content]) => (content as ToastTitle).title);
  type ToastTitle = { title: string };

  beforeEach(() => {
    mocks.getContentSettings.mockResolvedValue({ ...DEFAULT_CONTENT_SETTINGS, autoSync: true, notificationLevel: 'detailed', completionTrigger: 'percentage', language: 'de' });
  });

  it('rien demandé au démarrage de la session ; à la fin de l’épisode, une demande et des toasts traduits', async () => {
    stubWorker(synced);
    const start = await freshSession();
    const info = episode('GRMG8ZQZR', 'GE040', { platform: 'crunchyroll' });
    navigate('/watch/GE040');
    mocks.completions.length = 0;
    const session = start(syncAdapter(info), 'GE040');
    await flush();
    expect(mocks.tracked).toHaveLength(1);
    expect(catalogRequests()).toEqual([]);

    mocks.completions.at(-1)?.();
    await flush();
    expect(toastTitles()).toEqual([catalogOf('de')['common.syncing']]);
    // Raccourci sur l'épisode synchronisé : deuxième besoin, aucune nouvelle demande
    session.forceComplete();
    await flush();
    expect(toastTitles()).toEqual([catalogOf('de')['common.syncing'], catalogOf('de')['content.shortcut.alreadySynced']]);
    expect(catalogRequests()).toEqual(['de']);
    session.destroy();
  });

  it('épisode non identifié : toast d’erreur traduit (langue assurée avant le texte)', async () => {
    stubWorker(synced);
    const start = await freshSession();
    const adapter: StreamingAdapter = { ...syncAdapter(episode('X', 'GE041')), extractEpisodeInfo: () => null };
    navigate('/watch/GE041');
    mocks.completions.length = 0;
    const session = start(adapter, 'GE041');
    await flush();
    expect(catalogRequests()).toEqual([]);
    mocks.completions.at(-1)?.();
    await flush();
    expect(toastTitles()).toEqual([catalogOf('de')['content.unidentified.title']]);
    expect(catalogRequests()).toEqual(['de']);
    session.destroy();
  });

  it('service worker sans catalogue : anglais, nouvel essai au besoin suivant (raccourci)', async () => {
    let available = false;
    stubWorker({ status: 'needs-review', reason: 'x' }, (locale) => (available ? Promise.resolve(contentSubset(locale)) : Promise.resolve(null)));
    const start = await freshSession();
    const info = episode('GRMG8ZQZR', 'GE042', { platform: 'crunchyroll' });
    navigate('/watch/GE042');
    mocks.completions.length = 0;
    const session = start(syncAdapter(info), 'GE042');
    await flush();
    mocks.completions.at(-1)?.();
    await flush();
    available = true;
    // À vérifier : rien d'écrit, le raccourci renvoie l'épisode
    session.forceComplete();
    await flush();
    expect(toastTitles()).toEqual([en['common.syncing'], catalogOf('de')['common.syncing']]);
    expect(catalogRequests()).toEqual(['de', 'de']);
    session.destroy();
  });
});

/** Adapter synchrone dont le lecteur peut changer pendant la session */
function playerAdapter(info: EpisodeInfo, player: { current: HTMLVideoElement | null }): StreamingAdapter {
  return { ...syncAdapter(info), findVideo: () => player.current };
}

/** Résultat « synchronisé partout » */
const synced: SyncOutcome = { status: 'synced', mediaTitle: 'Série', results: [] };

/** Action « Réessayer » du dernier toast (bulle créée ou toast de progression mis à jour) */
function lastRetryAction(): (() => void) | null {
  const calls = [...mocks.showToast.mock.calls, ...toastHandle.update.mock.calls] as [{ action?: { onClick: () => void } }][];
  const actions = calls.map(([content]) => content.action).filter((action) => action !== undefined);
  return actions.at(-1)?.onClick ?? null;
}

describe('startWatchSession — lecteur suivi (CONT-01, CONT-02)', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('<video> détachée puis remplacée : tracker recréé sur la nouvelle, l’ancien annulé', async () => {
    const info = episode('GRMG8ZQZR', 'GE010', { platform: 'crunchyroll' });
    const first = makeVideo('first');
    const player: { current: HTMLVideoElement | null } = { current: first };
    navigate('/watch/GE010');
    const session = startWatchSession(playerAdapter(info, player), 'GE010');
    await flush();
    expect(mocks.tracked.map((t) => t.video)).toEqual([first]);

    // Lecture automatique : le lecteur détruit sa <video> et en crée une autre, qui charge sa source
    const second = makeVideo('second');
    first.isConnected = false;
    player.current = second;
    doc.dispatchEvent(new Event('loadstart'));
    expect(mocks.tracked.map((t) => t.video)).toEqual([first, second]);
    expect(mocks.tracked[0]?.signal.aborted).toBe(true);
    expect(mocks.tracked[1]?.signal.aborted).toBe(false);

    // Même lecteur : aucun nouveau tracker
    doc.dispatchEvent(new Event('play'));
    expect(mocks.tracked).toHaveLength(2);

    // Remplacé sans événement capté : rattaché à la lecture de la position (panneau ouvert)
    const third = makeVideo('third');
    second.isConnected = false;
    player.current = third;
    session.snapshot();
    expect(mocks.tracked.map((t) => t.video)).toEqual([first, second, third]);

    session.destroy();
    expect(mocks.tracked[2]?.signal.aborted).toBe(true);
  });

  it('lecteur apparu après 35 s (onglet en arrière-plan) : capté au premier play, épisode envoyé', async () => {
    vi.useFakeTimers();
    const info = episode('GRMG8ZQZR', 'GE011', { platform: 'crunchyroll' });
    const player: { current: HTMLVideoElement | null } = { current: null };
    const states: string[] = [];
    mocks.sendMessage.mockResolvedValue(synced);
    navigate('/watch/GE011');
    const session = startWatchSession(playerAdapter(info, player), 'GE011');
    session.onStateChange((state) => states.push(state));
    await flush();
    vi.advanceTimersByTime(35_000);
    await flush();
    expect(states).toContain('no-video');
    expect(mocks.tracked).toHaveLength(0);

    player.current = makeVideo('late');
    doc.dispatchEvent(new Event('play'));
    expect(mocks.tracked).toHaveLength(1);
    expect(states.at(-1)).toBe('watching');

    mocks.completions.at(-1)?.();
    await flush();
    expect(mocks.sendMessage).toHaveBeenCalledOnce();
    session.destroy();
  });

  it('position fournie par l’adapter (Disney+) : lue par le suivi et par la progression en direct, pas sur la <video>', async () => {
    const info = episode('X', 'GE013', { platform: 'crunchyroll' });
    const player: { current: HTMLVideoElement | null } = { current: makeVideo('disney') };
    const readPlayback = vi.fn(() => ({ currentTime: 120, duration: 1_460 }));
    navigate('/watch/GE013');
    const session = startWatchSession({ ...playerAdapter(info, player), readPlayback }, 'GE013');
    await flush();
    expect(session.snapshot()).toMatchObject({ t: 120, duration: 1_460 });
    expect(mocks.tracked[0]?.readPlayback?.(makeVideo())).toEqual({ currentTime: 120, duration: 1_460 });
    session.destroy();
  });

  it('sans lecture propre à l’adapter : rien n’est transmis au suivi (position de la <video>)', async () => {
    const player: { current: HTMLVideoElement | null } = { current: makeVideo('cr') };
    navigate('/watch/GE014');
    const session = startWatchSession(playerAdapter(episode('X', 'GE014', { platform: 'crunchyroll' }), player), 'GE014');
    await flush();
    expect(mocks.tracked[0]?.readPlayback).toBeUndefined();
    expect(session.snapshot()).toMatchObject({ t: null, duration: null });
    session.destroy();
  });

  it('lecteur créé hors du document puis inséré, sans événement média visible (Netflix) : trouvé par la relecture périodique', async () => {
    vi.useFakeTimers();
    const player: { current: HTMLVideoElement | null } = { current: null };
    navigate('/watch/GE015');
    const session = startWatchSession(playerAdapter(episode('X', 'GE015', { platform: 'crunchyroll' }), player), 'GE015');
    await flush();
    vi.advanceTimersByTime(VIDEO_POLL_MS);
    expect(mocks.tracked).toHaveLength(0);
    player.current = makeVideo('inserted');
    vi.advanceTimersByTime(VIDEO_POLL_MS);
    expect(mocks.tracked.map((t) => t.video)).toEqual([player.current]);
    session.destroy();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('lecteur suivi et connecté : plus de relecture ; retiré du DOM : relecture jusqu’au nouveau lecteur', async () => {
    vi.useFakeTimers();
    const first = makeVideo('first');
    const player: { current: HTMLVideoElement | null } = { current: first };
    const findVideo = vi.fn(() => player.current);
    navigate('/watch/GE016');
    const session = startWatchSession({ ...playerAdapter(episode('X', 'GE016', { platform: 'crunchyroll' }), player), findVideo }, 'GE016');
    await flush();
    const calls = findVideo.mock.calls.length;
    vi.advanceTimersByTime(5 * VIDEO_POLL_MS);
    expect(findVideo.mock.calls.length).toBe(calls);

    // Lecteur retiré, remplacé plus tard, sans aucun événement média
    first.isConnected = false;
    player.current = null;
    vi.advanceTimersByTime(2 * VIDEO_POLL_MS);
    expect(findVideo.mock.calls.length).toBe(calls + 2);
    const second = makeVideo('second');
    player.current = second;
    vi.advanceTimersByTime(VIDEO_POLL_MS);
    expect(mocks.tracked.map((t) => t.video)).toEqual([first, second]);
    expect(mocks.tracked[0]?.signal.aborted).toBe(true);
    session.destroy();
  });

  it('session détruite : plus aucun écouteur capté ni minuteur', async () => {
    vi.useFakeTimers();
    const player: { current: HTMLVideoElement | null } = { current: null };
    navigate('/watch/GE012');
    const session = startWatchSession(playerAdapter(episode('X', 'GE012', { platform: 'crunchyroll' }), player), 'GE012');
    await flush();
    session.destroy();
    player.current = makeVideo();
    doc.dispatchEvent(new Event('loadstart'));
    vi.advanceTimersByTime(60_000);
    expect(mocks.tracked).toHaveLength(0);
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe('startWatchSession — envoi et raccourci (CONT-05, CONT-07, CTRL-07)', () => {
  it('service worker injoignable : bulle avec « Réessayer », qui renvoie l’épisode', async () => {
    const info = episode('GRMG8ZQZR', 'GE020', { platform: 'crunchyroll' });
    mocks.sendMessage.mockRejectedValueOnce(new Error('Aucune réponse du service worker')).mockResolvedValue(synced);
    await watchToEnd(syncAdapter(info), 'GE020');
    expect(toastHandle.update).toHaveBeenCalledWith(expect.objectContaining({ tone: 'error' }), expect.anything());
    const retry = lastRetryAction();
    expect(retry).not.toBeNull();
    retry?.();
    await flush();
    expect(mocks.sendMessage).toHaveBeenCalledTimes(2);
  });

  it('synchro en pause à la fin de l’épisode, puis réactivée : le raccourci renvoie l’épisode', async () => {
    const info = episode('GRMG8ZQZR', 'GE021', { platform: 'crunchyroll' });
    mocks.getContentSettings.mockResolvedValue({ ...DEFAULT_CONTENT_SETTINGS, autoSync: false, completionTrigger: 'percentage' });
    mocks.sendMessage.mockResolvedValue(synced);
    navigate('/watch/GE021');
    const session = startWatchSession(syncAdapter(info), 'GE021');
    await flush();
    mocks.completions.at(-1)?.();
    await flush();
    expect(mocks.sendMessage).not.toHaveBeenCalled();

    // Raccourci encore en pause : explication à l'écran, rien d'envoyé
    session.forceComplete();
    await flush();
    expect(mocks.sendMessage).not.toHaveBeenCalled();
    expect(mocks.showToast).toHaveBeenLastCalledWith(expect.objectContaining({ tone: 'info' }), expect.anything());

    mocks.getContentSettings.mockResolvedValue({ ...DEFAULT_CONTENT_SETTINGS, autoSync: true, notificationLevel: 'detailed', completionTrigger: 'percentage' });
    session.forceComplete();
    await flush();
    expect(mocks.sendMessage).toHaveBeenCalledOnce();
    session.destroy();
  });

  it('Netflix : clics répétés sur « Réessayer » pendant l’envoi → un seul nouvel envoi', async () => {
    const info = episode('106', '1061');
    mocks.sendMessage.mockResolvedValueOnce({ status: 'error', message: 'AniList indisponible' } satisfies SyncOutcome);
    await watchToEnd(asyncAdapter({ '1061': info }), '1061');
    expect(mocks.sendMessage).toHaveBeenCalledOnce();
    const retry = lastRetryAction();
    expect(retry).not.toBeNull();

    // Envoi en cours (jamais résolu) : sans toast de progression, la bulle reste cliquable
    mocks.sendMessage.mockReturnValue(new Promise<SyncOutcome>(() => undefined));
    retry?.();
    retry?.();
    retry?.();
    await flush();
    expect(mocks.sendMessage).toHaveBeenCalledTimes(2);
  });

  it('raccourci sur un épisode déjà synchronisé : toast explicatif, rien de renvoyé', async () => {
    const info = episode('GRMG8ZQZR', 'GE022', { platform: 'crunchyroll' });
    mocks.sendMessage.mockResolvedValue(synced);
    navigate('/watch/GE022');
    const session = startWatchSession(syncAdapter(info), 'GE022');
    await flush();
    mocks.completions.at(-1)?.();
    await flush();
    expect(mocks.sendMessage).toHaveBeenCalledOnce();
    mocks.showToast.mockClear();

    session.forceComplete();
    await flush();
    expect(mocks.sendMessage).toHaveBeenCalledOnce();
    expect(mocks.showToast).toHaveBeenCalledWith(expect.objectContaining({ tone: 'success' }), expect.objectContaining({ variant: 'pill' }));
    session.destroy();
  });

  it('série ignorée (Netflix) : le raccourci reste silencieux', async () => {
    mocks.sendMessage.mockResolvedValue({ status: 'ignored' } satisfies SyncOutcome);
    navigate('/watch/1071');
    const session = startWatchSession(asyncAdapter({ '1071': episode('107', '1071') }), '1071');
    await flush();
    mocks.completions.at(-1)?.();
    await flush();
    session.forceComplete();
    await flush();
    expect(mocks.sendMessage).toHaveBeenCalledOnce();
    expect(mocks.showToast).not.toHaveBeenCalled();
    session.destroy();
  });
});

describe('startWatchSession — extension mise à jour (CONT-06)', () => {
  it('contexte invalidé dès l’ouverture de l’épisode : averti tout de suite, rien n’est suivi', async () => {
    vi.stubGlobal('chrome', { runtime: {} });
    const adapter = asyncAdapter({ '1081': episode('108', '1081') });
    navigate('/watch/1081');
    startWatchSession(adapter, '1081');
    await flush();
    expect(mocks.showToast).toHaveBeenCalledWith(expect.objectContaining({ tone: 'warning' }), expect.anything());
    expect(adapter.loadEpisodeInfo).not.toHaveBeenCalled();
    expect(mocks.tracked).toHaveLength(0);
  });

  it('extension rechargée pendant la lecture : averti au premier événement média, session arrêtée', async () => {
    const info = episode('GRMG8ZQZR', 'GE030', { platform: 'crunchyroll' });
    navigate('/watch/GE030');
    startWatchSession(syncAdapter(info), 'GE030');
    await flush();
    expect(mocks.tracked).toHaveLength(1);
    expect(mocks.showToast).not.toHaveBeenCalled();

    vi.stubGlobal('chrome', { runtime: {} });
    doc.dispatchEvent(new Event('play'));
    expect(mocks.showToast).toHaveBeenCalledWith(expect.objectContaining({ tone: 'warning' }), expect.anything());
    expect(mocks.tracked[0]?.signal.aborted).toBe(true);
  });
});

/** Textes des clés de contenu d'une langue, tels que les renvoie le service worker (background/content-catalog.ts) */
function contentSubset(locale: Locale): Record<string, string> {
  return Object.fromEntries(CONTENT_KEYS.map((key) => [key, catalogOf(locale)[key] ?? '']));
}
