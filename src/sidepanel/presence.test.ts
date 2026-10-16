import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import manifest from '../../manifest.json';
import type { PageMediaInfo } from '../shared/page-media.types';
import { contentScriptMatches } from '../platforms/target-pages';
import { createPlatformAccessStore } from '../ui/platform-access-store';
import { answersAsTarget, classifyTabUrl, watchPanelContext, type PanelContext } from './presence';

const requestPageMedia = vi.hoisted(() => vi.fn<(tabId: number) => Promise<unknown>>());
vi.mock('../ui/page-media-request', () => ({ PAGE_MEDIA_RETRY_DELAYS_MS: [0, 700, 1_800], requestPageMedia }));

const patterns = contentScriptMatches(manifest);

describe('classifyTabUrl', () => {
  it('URL visible : Crunchyroll / ADN ou autre site', () => {
    expect(classifyTabUrl('https://www.crunchyroll.com/watch/x', patterns)).toBe('target');
    expect(classifyTabUrl('https://animationdigitalnetwork.com/video/1', patterns)).toBe('target');
    expect(classifyTabUrl('https://anilist.co/home', patterns)).toBe('other');
  });

  it('URL masquée (pas de permission d’hôte) : le script de contenu tranchera', () => {
    expect(classifyTabUrl(undefined, patterns)).toBe('unknown');
    expect(classifyTabUrl('', patterns)).toBe('unknown');
  });
});

describe('answersAsTarget (URL masquée, script de contenu joignable)', () => {
  const page = (platform: 'crunchyroll' | 'prime'): PageMediaInfo => ({ platform, kind: 'series', seriesId: null, seriesSlug: null, seriesTitle: 'X', seasonNumber: 1, seasonTitle: null, episode: null });

  it('page d’une plateforme dont l’accès a été retiré (script encore actif) : hors page cible', async () => {
    expect(await answersAsTarget(page('prime'), () => Promise.resolve(false))).toBe(false);
    expect(await answersAsTarget(page('prime'), () => Promise.resolve(true))).toBe(true);
  });

  it('plateforme du manifeste, ou page sans série : page cible', async () => {
    expect(await answersAsTarget(page('crunchyroll'), () => Promise.resolve(false))).toBe(true);
    expect(await answersAsTarget(null, () => Promise.resolve(false))).toBe(true);
  });
});

// ─── watchPanelContext : suivi de l'onglet actif (chrome simulé, minuteurs factices) ──────────────────────────────

/** Réponse du script de contenu sur une page de série Crunchyroll */
const CR_SERIES_PAGE = { platform: 'crunchyroll', kind: 'series', seriesId: null, seriesSlug: null, seriesTitle: 'X', seasonNumber: 1, seasonTitle: null, episode: null } as const;

describe('watchPanelContext', () => {
  const WINDOW_ID = 1;
  type Listener<A extends unknown[]> = (...args: A) => void;
  let tabs: Map<number, { id: number; url?: string; pendingUrl?: string }>;
  let activeTabId: number | undefined;
  let onUpdated: Listener<[number, { url?: string; status?: string }]>[];
  let onActivated: Listener<[{ tabId: number; windowId: number }]>[];
  let onPermission: Listener<[]>[];
  let contexts: PanelContext[];
  let granted: boolean;

  const CR = 'https://www.crunchyroll.com/watch/GEP/episode';

  /** Laisse passer les microtâches et le délai anti-rebond (250 ms) */
  const settle = async (ms = 300): Promise<void> => {
    await vi.advanceTimersByTimeAsync(ms);
  };

  beforeEach(() => {
    vi.useFakeTimers();
    tabs = new Map();
    activeTabId = undefined;
    onUpdated = [];
    onActivated = [];
    onPermission = [];
    contexts = [];
    granted = false;
    requestPageMedia.mockReset();
    vi.stubGlobal('chrome', {
      runtime: { getManifest: () => manifest },
      tabs: {
        get: async (id: number) => {
          const tab = tabs.get(id);
          if (!tab) throw new Error('No tab');
          return tab;
        },
        query: async () => (activeTabId === undefined ? [] : [tabs.get(activeTabId)]),
        onUpdated: { addListener: (l: Listener<[number, { url?: string; status?: string }]>) => onUpdated.push(l) },
        onActivated: { addListener: (l: Listener<[{ tabId: number; windowId: number }]>) => onActivated.push(l) },
      },
      windows: { getCurrent: async () => ({ id: WINDOW_ID }) },
      permissions: {
        contains: async () => granted,
        onAdded: { addListener: (l: Listener<[]>) => onPermission.push(l) },
        onRemoved: { addListener: (l: Listener<[]>) => onPermission.push(l) },
      },
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  const start = async (): Promise<void> => {
    const started = watchPanelContext((context) => contexts.push(context), createPlatformAccessStore());
    await vi.advanceTimersByTimeAsync(0);
    await started;
  };
  const last = (): PanelContext | undefined => contexts.at(-1);

  it('aucun onglet actif : hors page cible', async () => {
    await start();
    expect(contexts).toEqual([{ status: 'off' }]);
  });

  it('onglet actif sur une page cible (URL visible) : suivi immédiat, sans interroger le script de contenu', async () => {
    tabs.set(5, { id: 5, url: CR });
    activeTabId = 5;
    await start();
    expect(contexts).toEqual([{ status: 'target', tabId: 5 }]);
    expect(requestPageMedia).not.toHaveBeenCalled();
  });

  it('onglet actif sur un autre site : hors page cible', async () => {
    tabs.set(5, { id: 5, url: 'https://example.com/' });
    activeTabId = 5;
    await start();
    expect(contexts).toEqual([{ status: 'off' }]);
  });

  it('URL en attente (pendingUrl) lue quand l’URL est absente', async () => {
    tabs.set(5, { id: 5, pendingUrl: CR });
    activeTabId = 5;
    await start();
    expect(last()).toEqual({ status: 'target', tabId: 5 });
  });

  it('URL masquée, script de contenu qui répond avec une page : cible', async () => {
    tabs.set(5, { id: 5 });
    activeTabId = 5;
    requestPageMedia.mockResolvedValue({ platform: 'crunchyroll', kind: 'series', seriesId: null, seriesSlug: null, seriesTitle: 'X', seasonNumber: 1, seasonTitle: null, episode: null });
    await start();
    expect(last()).toEqual({ status: 'target', tabId: 5 });
  });

  it('URL masquée, script de contenu muet au premier essai : « hors page » signalé aussitôt, puis cible si un essai suivant répond', async () => {
    tabs.set(5, { id: 5 });
    activeTabId = 5;
    requestPageMedia.mockResolvedValueOnce('unreachable').mockResolvedValue(null);
    const started = watchPanelContext((context) => contexts.push(context), createPlatformAccessStore());
    await vi.advanceTimersByTimeAsync(0);
    expect(contexts).toEqual([{ status: 'off' }]);
    await vi.advanceTimersByTimeAsync(700);
    await started;
    expect(contexts).toEqual([{ status: 'off' }, { status: 'target', tabId: 5 }]);
    expect(requestPageMedia).toHaveBeenCalledTimes(2);
  });

  it('URL masquée et script toujours muet après les trois essais : hors page cible', async () => {
    tabs.set(5, { id: 5 });
    activeTabId = 5;
    requestPageMedia.mockResolvedValue('unreachable');
    const started = watchPanelContext((context) => contexts.push(context), createPlatformAccessStore());
    await vi.advanceTimersByTimeAsync(3_000);
    await started;
    expect(requestPageMedia).toHaveBeenCalledTimes(3);
    expect(last()).toEqual({ status: 'off' });
  });

  it('URL masquée : page d’une plateforme optionnelle dont l’accès est retiré = hors page cible', async () => {
    tabs.set(5, { id: 5 });
    activeTabId = 5;
    requestPageMedia.mockResolvedValue({ platform: 'prime', kind: 'series', seriesId: null, seriesSlug: null, seriesTitle: 'X', seasonNumber: 1, seasonTitle: null, episode: null });
    await start();
    expect(last()).toEqual({ status: 'off' });
    granted = true;
    for (const listener of onPermission) listener();
    await settle();
    expect(last()).toEqual({ status: 'target', tabId: 5 });
  });

  it('onglet illisible (fermé) : hors page cible, sans exception', async () => {
    activeTabId = 9;
    tabs.set(9, { id: 9, url: CR });
    await start();
    tabs.delete(9);
    for (const listener of onActivated) listener({ tabId: 9, windowId: WINDOW_ID });
    await settle();
    expect(last()).toEqual({ status: 'off' });
  });

  it('changement d’onglet dans la fenêtre du panneau : suivi du nouvel onglet ; autre fenêtre : ignoré', async () => {
    tabs.set(1, { id: 1, url: 'https://example.com/' });
    tabs.set(2, { id: 2, url: CR });
    activeTabId = 1;
    await start();
    expect(last()).toEqual({ status: 'off' });
    for (const listener of onActivated) listener({ tabId: 2, windowId: 99 });
    await settle();
    expect(last()).toEqual({ status: 'off' });
    for (const listener of onActivated) listener({ tabId: 2, windowId: WINDOW_ID });
    await settle();
    expect(last()).toEqual({ status: 'target', tabId: 2 });
  });

  it('navigation dans l’onglet suivi : réévalue (URL changée ou chargement terminé) ; autres événements et autres onglets ignorés', async () => {
    tabs.set(1, { id: 1, url: 'https://example.com/' });
    activeTabId = 1;
    await start();
    const before = contexts.length;
    tabs.set(1, { id: 1, url: CR });
    for (const listener of onUpdated) listener(1, { status: 'loading' });
    for (const listener of onUpdated) listener(2, { url: CR });
    await settle();
    expect(contexts.length).toBe(before);
    for (const listener of onUpdated) listener(1, { url: CR });
    await settle();
    expect(last()).toEqual({ status: 'target', tabId: 1 });
    tabs.set(1, { id: 1, url: 'https://example.com/' });
    for (const listener of onUpdated) listener(1, { status: 'complete' });
    await settle();
    expect(last()).toEqual({ status: 'off' });
  });

  it('navigation SPA dans un onglet déjà cible (URL masquée), script muet au premier essai : pas de « hors page » le temps des essais', async () => {
    tabs.set(5, { id: 5 });
    activeTabId = 5;
    requestPageMedia.mockResolvedValue(CR_SERIES_PAGE);
    await start();
    expect(contexts).toEqual([{ status: 'target', tabId: 5 }]);
    // Navigation : le script de contenu de la nouvelle page n'est pas encore prêt au premier essai
    requestPageMedia.mockReset().mockResolvedValueOnce('unreachable').mockResolvedValue(CR_SERIES_PAGE);
    for (const listener of onUpdated) listener(5, { status: 'complete' });
    await vi.advanceTimersByTimeAsync(1_500);
    expect(contexts).toEqual([{ status: 'target', tabId: 5 }, { status: 'target', tabId: 5 }]);
    expect(requestPageMedia).toHaveBeenCalledTimes(2);
  });

  it('rafale d’événements : une seule réévaluation (anti-rebond 250 ms)', async () => {
    tabs.set(1, { id: 1, url: CR });
    activeTabId = 1;
    await start();
    const before = contexts.length;
    for (let i = 0; i < 5; i += 1) for (const listener of onUpdated) listener(1, { url: CR });
    await settle();
    expect(contexts.length).toBe(before + 1);
  });

  it('accès accordé ou retiré sans onglet suivi : rien à réévaluer', async () => {
    await start();
    const before = contexts.length;
    for (const listener of onPermission) listener();
    await settle();
    expect(contexts.length).toBe(before);
  });

  it('évaluation plus récente : le résultat d’une évaluation périmée est écarté', async () => {
    tabs.set(1, { id: 1, url: 'https://example.com/' });
    tabs.set(2, { id: 2 });
    activeTabId = 1;
    await start();
    // Onglet 2 à l'URL masquée, script lent à répondre ; l'utilisateur revient aussitôt sur l'onglet 1
    requestPageMedia.mockImplementation(() => new Promise((resolve) => setTimeout(() => resolve(null), 1_000)));
    for (const listener of onActivated) listener({ tabId: 2, windowId: WINDOW_ID });
    await settle();
    for (const listener of onActivated) listener({ tabId: 1, windowId: WINDOW_ID });
    await vi.advanceTimersByTimeAsync(3_000);
    expect(contexts).not.toContainEqual({ status: 'target', tabId: 2 });
    expect(last()).toEqual({ status: 'off' });
  });
});
