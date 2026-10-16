import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AiringWeekCache } from '../shared/agenda';
import type { WatchingEntry, WatchingList } from '../shared/watching.types';
import { DEFAULT_SETTINGS } from '../shared/settings';
import { STORAGE_KEYS } from '../protocol/storage-keys';
import type { StreamingPlatform } from '../platforms/registry';
import type { PlatformAccessStore } from '../ui/platform-access-store';

// Données de l'Agenda (sans rendu) : comptes, séries en cours, cache de la semaine, requête GET_AGENDA en cours jamais
// jetée par un chargement automatique, écouteur du stockage retiré par dispose

interface PendingCall {
  type: string;
  payload: unknown;
  resolve: (value: unknown) => void;
}

type ChangeListener = (changes: Record<string, chrome.storage.StorageChange>, area: string) => void;

const fake = vi.hoisted(() => ({
  calls: [] as PendingCall[],
  anilist: true,
  mal: false,
  watching: null as WatchingList | null,
  weekCache: null as AiringWeekCache | null,
  preferred: null as StreamingPlatform | null,
  listeners: [] as ChangeListener[],
}));

vi.mock('../protocol/messages', () => ({
  sendMessage: (type: string, payload: unknown) => new Promise((resolve) => fake.calls.push({ type, payload, resolve })),
}));
vi.mock('../browser/storage/settings-access', () => ({ getSettings: () => Promise.resolve({ ...DEFAULT_SETTINGS, ...(fake.preferred ? { preferredPlayer: fake.preferred } : {}) }) }));
vi.mock('../browser/storage/tokens', () => ({ hasValidAniListToken: () => Promise.resolve(fake.anilist), hasMalToken: () => Promise.resolve(fake.mal) }));
vi.mock('../browser/storage/watching-cache', () => ({ getCachedWatching: (service: string) => Promise.resolve(service === 'anilist' ? fake.watching : null) }));
vi.mock('../browser/storage/agenda-store', () => ({ agendaFirstDay: () => 1, readWeekCache: () => Promise.resolve(fake.weekCache) }));
vi.mock('../shared/exclusions', async (importOriginal) => ({ ...(await importOriginal<typeof import('../shared/exclusions')>()), getExcludedSeries: () => Promise.resolve([]) }));

vi.stubGlobal('chrome', {
  storage: {
    onChanged: {
      addListener: (listener: ChangeListener) => void fake.listeners.push(listener),
      removeListener: (listener: ChangeListener) => void fake.listeners.splice(fake.listeners.indexOf(listener), 1),
    },
  },
});

const { createAgendaController, STORAGE_DEBOUNCE_MS } = await import('./agenda-controller');

function access(granted: readonly StreamingPlatform[]): PlatformAccessStore {
  return {
    get: () => granted,
    subscribe: () => () => true,
    refresh: () => Promise.resolve(granted),
    read: () => Promise.resolve(granted),
    has: (platform) => Promise.resolve(granted.includes(platform)),
    onPermissionsChange: () => () => true,
    dispose: () => undefined,
  };
}

function entry(mediaId: number): WatchingEntry {
  return {
    mediaId,
    malId: null,
    title: `Série ${mediaId}`,
    coverUrl: null,
    progress: 3,
    totalEpisodes: 12,
    updatedAt: null,
    nextEpisode: null,
    airingStatus: 'RELEASING',
    platforms: [],
    lastSync: null,
    siteUrl: `https://anilist.co/anime/${mediaId}`,
  };
}

const settle = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

function answerAgenda(value: unknown): void {
  const call = fake.calls.find((c) => c.type === 'GET_AGENDA');
  if (!call) throw new Error('Aucun GET_AGENDA en attente');
  fake.calls.splice(fake.calls.indexOf(call), 1);
  call.resolve(value);
}

const agendaCalls = (): PendingCall[] => fake.calls.filter((c) => c.type === 'GET_AGENDA');

beforeEach(() => {
  fake.calls.length = 0;
  fake.anilist = true;
  fake.mal = false;
  fake.watching = { service: 'anilist', entries: [entry(1)], fetchedAt: 1 };
  fake.weekCache = null;
  fake.preferred = null;
  fake.listeners.length = 0;
});

afterEach(() => {
  vi.useRealTimers();
});

describe('createAgendaController', () => {
  it('aucun compte connecté : « non connecté », aucune requête', async () => {
    fake.anilist = false;
    const ctl = createAgendaController({ platformAccess: access([]), onChange: () => undefined });
    await ctl.load(false);
    expect(ctl.status).toEqual({ kind: 'not-connected' });
    expect(agendaCalls()).toHaveLength(0);
  });

  it('aucune série en cours : plateformes optionnelles accordées reprises du store de la page', async () => {
    fake.watching = { service: 'anilist', entries: [], fetchedAt: 1 };
    const ctl = createAgendaController({ platformAccess: access(['netflix']), onChange: () => undefined });
    await ctl.load(false);
    expect(ctl.status).toEqual({ kind: 'no-series', optional: ['netflix'] });
  });

  it('lecteur préféré Netflix sans l’accès : lecteur par défaut', async () => {
    fake.preferred = 'netflix';
    const ctl = createAgendaController({ platformAccess: access([]), onChange: () => undefined });
    const load = ctl.load(false);
    await settle();
    answerAgenda({ ok: true, data: { weekStart: ctl.range.key, fetchedAt: Date.now(), mediaIds: [1], schedules: [] } });
    await load;
    expect(ctl.player).toBe(DEFAULT_SETTINGS.preferredPlayer);
    expect(ctl.connected).toEqual(['anilist']);
  });

  it('sans cache : GET_AGENDA demandé, programme affiché à la réponse', async () => {
    const changes = vi.fn();
    const ctl = createAgendaController({ platformAccess: access([]), onChange: changes });
    const load = ctl.load(false);
    await settle();
    expect(ctl.status).toEqual({ kind: 'loading' });
    expect(agendaCalls()).toHaveLength(1);
    const data: AiringWeekCache = { weekStart: ctl.range.key, fetchedAt: Date.now(), mediaIds: [1], schedules: [] };
    answerAgenda({ ok: true, data });
    await load;
    expect(ctl.status).toEqual({ kind: 'ready', cache: data, refreshing: false, error: null });
    expect(changes).toHaveBeenCalled();
  });

  it('chargement automatique pendant la requête : jamais jetée, rejoué après sa réponse ; échec retenu sans nouvelle requête', async () => {
    vi.useFakeTimers();
    const ctl = createAgendaController({ platformAccess: access([]), onChange: () => undefined });
    const first = ctl.load(false);
    await vi.advanceTimersByTimeAsync(0);
    expect(agendaCalls()).toHaveLength(1);
    // Écriture du stockage pendant la requête (liste « En cours » relue) : chargement mis en file
    await ctl.load(false);
    expect(agendaCalls()).toHaveLength(1);
    answerAgenda({ ok: false, code: 'API_ERROR', message: 'AniList indisponible' });
    await first;
    expect(ctl.status).toEqual({ kind: 'error', message: 'AniList indisponible' });
    // Chargement rejoué : requête récente en échec, erreur gardée (REFETCH_GUARD_MS), pas de boucle
    await vi.advanceTimersByTimeAsync(STORAGE_DEBOUNCE_MS);
    expect(agendaCalls()).toHaveLength(0);
    expect(ctl.status).toEqual({ kind: 'error', message: 'AniList indisponible' });
  });

  it('« Réessayer » (force) : nouvelle requête malgré l’échec récent', async () => {
    const ctl = createAgendaController({ platformAccess: access([]), onChange: () => undefined });
    const first = ctl.load(false);
    await settle();
    answerAgenda({ ok: false, code: 'API_ERROR', message: 'x' });
    await first;
    const retry = ctl.load(true);
    await settle();
    expect(agendaCalls()).toHaveLength(1);
    answerAgenda({ ok: true, data: { weekStart: ctl.range.key, fetchedAt: Date.now(), mediaIds: [1], schedules: [] } });
    await retry;
    expect(ctl.status.kind).toBe('ready');
  });

  it('autre semaine : état de la vue oublié, squelette, puis chargement après la rafale', async () => {
    vi.useFakeTimers();
    const week = vi.fn();
    const ctl = createAgendaController({ platformAccess: access([]), onChange: () => undefined, onWeekChange: week });
    const next = { ...ctl.range, key: '2099-01-05' };
    ctl.goTo(next);
    expect(week).toHaveBeenCalledTimes(1);
    expect(ctl.range).toBe(next);
    expect(ctl.status).toEqual({ kind: 'loading' });
    expect(agendaCalls()).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(300);
    expect(agendaCalls()).toHaveLength(1);
    ctl.dispose();
  });

  it('activate : écouteur du stockage posé une fois ; dispose le retire', async () => {
    vi.useFakeTimers();
    const ctl = createAgendaController({ platformAccess: access([]), onChange: () => undefined });
    ctl.activate();
    ctl.activate();
    expect(fake.listeners).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(0);
    answerAgenda({ ok: true, data: { weekStart: ctl.range.key, fetchedAt: Date.now(), mediaIds: [1], schedules: [] } });
    await vi.advanceTimersByTimeAsync(0);
    ctl.dispose();
    expect(fake.listeners).toHaveLength(0);
    // Aucun chargement après la destruction (minuit, stockage)
    await vi.advanceTimersByTimeAsync(2 * 24 * 3_600_000);
    expect(agendaCalls()).toHaveLength(0);
  });

  it('écriture du stockage pertinente (liste « En cours ») : rechargement regroupé', async () => {
    vi.useFakeTimers();
    fake.weekCache = { weekStart: '', fetchedAt: Date.now(), mediaIds: [1], schedules: [] };
    const ctl = createAgendaController({ platformAccess: access([]), onChange: () => undefined });
    fake.weekCache = { ...fake.weekCache, weekStart: ctl.range.key };
    ctl.activate();
    await vi.advanceTimersByTimeAsync(0);
    expect(ctl.status.kind).toBe('ready');
    fake.watching = { service: 'anilist', entries: [], fetchedAt: 2 };
    for (const listener of fake.listeners) listener({ [STORAGE_KEYS.watchingCache]: { newValue: {} } }, 'local');
    for (const listener of fake.listeners) listener({ other: { newValue: 1 } }, 'local');
    await vi.advanceTimersByTimeAsync(STORAGE_DEBOUNCE_MS);
    expect(ctl.status.kind).toBe('no-series');
    ctl.dispose();
  });
});
