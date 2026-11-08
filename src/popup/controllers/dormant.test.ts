import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DormantAfterDays } from '../../shared/settings';
import type { ServiceOutcome, SyncOutcome } from '../../shared/sync.types';
import type { TrackerId } from '../../shared/tracker.types';
import type { WatchingEntry, WatchingList } from '../../shared/watching.types';
import { setLocale } from '../../i18n';
import { installFakeChrome } from '../../test/fake-chrome';
import { createStore, LOGGED_OUT, type AccountState, type ExclusionsState, type Store } from '../../ui/state';
import type { DormantController } from './dormant';
import type { WatchingController } from './watching';

// Groupe « En sommeil » : vrai contrôleur « En cours » (liste, bandeau), faux service worker (réponses à la main) et
// marques « Garder » simulées (module de stockage remplacé).

interface PendingCall {
  type: string;
  payload: unknown;
  resolve: (value: unknown) => void;
}

const sw = vi.hoisted(() => ({ calls: [] as PendingCall[] }));
interface KeepFake {
  marks: Record<string, { keptAt: number }>;
  read: ReturnType<typeof vi.fn<(service: string) => Promise<Record<string, { keptAt: number }>>>>;
  write: ReturnType<typeof vi.fn<(service: string, key: string, now: number) => Promise<void>>>;
}
const keep: KeepFake = vi.hoisted(() => ({ marks: {}, read: vi.fn(), write: vi.fn() }));

vi.mock('../../protocol/messages', () => ({
  sendMessage: (type: string, payload: unknown) => new Promise((resolve) => sw.calls.push({ type, payload, resolve })),
}));
vi.mock('../../browser/storage/dormant-keep', () => ({ readKeepMarks: keep.read, keepDormant: keep.write }));

installFakeChrome();
const { createWatchingController } = await import('./watching');
const { createDormantController } = await import('./dormant');

const NOW = Date.UTC(2026, 10, 8, 12);
const DAY = 86_400_000;

async function settle(): Promise<void> {
  for (let i = 0; i < 20; i++) await Promise.resolve();
}

const calls = (type: string): PendingCall[] => sw.calls.filter((c) => c.type === type);

function lastCall(type: string): PendingCall {
  const call = calls(type).at(-1);
  if (!call) throw new Error(`${type} non envoyé`);
  return call;
}

function entry(mediaId: number, title: string, inactiveDays: number, overrides: Partial<WatchingEntry> = {}): WatchingEntry {
  return {
    mediaId,
    malId: mediaId + 1,
    title,
    coverUrl: null,
    progress: 7,
    totalEpisodes: 23,
    updatedAt: NOW - inactiveDays * DAY,
    nextEpisode: null,
    airingStatus: 'FINISHED',
    episodeMinutes: 24,
    listStatus: 'CURRENT',
    platforms: [],
    lastSync: null,
    siteUrl: `https://anilist.co/anime/${mediaId}`,
    ...overrides,
  };
}

const FRIEREN = entry(154587, 'Frieren', 45);
const VINLAND = entry(101348, 'Vinland Saga', 120);
const DANDADAN = entry(171018, 'Dandadan', 2);
const list = (entries: WatchingEntry[]): WatchingList => ({ service: 'anilist', entries, fetchedAt: NOW });

const updated = { status: 'updated', progress: 7, completed: false } as const;
const outcome = (title: string, results: { service: TrackerId; outcome: ServiceOutcome }[]): SyncOutcome => ({ status: 'synced', mediaTitle: title, results });

let watching: WatchingController;
let ctl: DormantController;
let threshold: Store<DormantAfterDays | undefined>;

function shownTitles(): string[] {
  const shown = watching.store.get();
  return shown.status === 'ready' ? shown.list.entries.map((e) => e.title) : [];
}

const dormantTitles = (): string[] => ctl.store.get().entries.map((e) => e.title);

async function showList(entries: WatchingEntry[], services: TrackerId[] = ['anilist', 'mal']): Promise<void> {
  const loggedIn: AccountState<unknown> = { status: 'logged-in', viewer: null, error: null };
  for (const id of services) accounts[id].set(loggedIn);
  await settle();
  lastCall('GET_WATCHING').resolve({ ok: true, data: list(entries) });
  await settle();
}

let accounts: Record<TrackerId, Store<AccountState<unknown>>>;

beforeEach(() => {
  setLocale('fr');
  sw.calls.length = 0;
  keep.marks = {};
  keep.read.mockReset().mockImplementation(() => Promise.resolve({ ...keep.marks }));
  keep.write.mockReset().mockResolvedValue(undefined);
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
  accounts = { anilist: createStore<AccountState<unknown>>({ status: 'loading' }), mal: createStore<AccountState<unknown>>({ status: 'loading' }) };
  accounts.mal.set(LOGGED_OUT);
  watching = createWatchingController({
    accounts: { store: (service) => accounts[service], markExpired: vi.fn() },
    preferredService: createStore<TrackerId | null>('anilist'),
    exclusions: createStore<ExclusionsState>({ status: 'ready', items: [] }),
    reloadExclusions: async () => undefined,
    onServiceShown: vi.fn(),
    onNoticeShown: vi.fn(),
  });
  threshold = createStore<DormantAfterDays | undefined>(30);
  ctl = createDormantController({ watching, threshold, now: () => NOW });
  watching.start();
  ctl.start();
});

afterEach(() => {
  ctl.dispose();
  watching.dispose();
  vi.useRealTimers();
});

describe('createDormantController : groupe', () => {
  it('dormant entries leave the main list, sorted by inactivity', async () => {
    await showList([FRIEREN, DANDADAN, VINLAND]);
    expect(dormantTitles()).toEqual(['Vinland Saga', 'Frieren']);
    expect(ctl.store.get().thresholdDays).toBe(30);
  });

  it('the Resume entry is never in the group', async () => {
    // Toutes en sommeil : la dernière synchronisée reste dans la carte « Reprendre »
    const resumed = { ...VINLAND, lastSync: { platform: 'crunchyroll' as const, at: NOW - 40 * DAY, episodeUrl: 'https://www.crunchyroll.com/watch/X' } };
    await showList([FRIEREN, resumed]);
    expect(dormantTitles()).toEqual(['Frieren']);
  });

  it('seuil « Jamais » ou réglages pas encore lus : aucun groupe', async () => {
    threshold.set(undefined);
    await showList([FRIEREN, VINLAND]);
    expect(dormantTitles()).toEqual([]);
    threshold.set(null);
    expect(dormantTitles()).toEqual([]);
    threshold.set(60);
    expect(dormantTitles()).toEqual(['Vinland Saga']);
  });

  it('marques « Garder » du service affiché lues avant d’afficher le groupe', async () => {
    keep.marks = { [String(FRIEREN.mediaId)]: { keptAt: NOW - DAY } };
    await showList([FRIEREN, VINLAND]);
    expect(keep.read).toHaveBeenCalledWith('anilist');
    expect(dormantTitles()).toEqual(['Vinland Saga']);
  });

  it('keep hides the entry and stores the mark', async () => {
    await showList([FRIEREN, VINLAND]);
    await ctl.keepDormant(FRIEREN);
    expect(keep.write).toHaveBeenCalledWith('anilist', String(FRIEREN.mediaId), NOW);
    expect(dormantTitles()).toEqual(['Vinland Saga']);
    // Toujours dans « Mes séries » (liste principale)
    expect(shownTitles()).toContain('Frieren');
  });
});

describe('createDormantController : pause, abandon, annuler', () => {
  it('pause sends SET_LIST_STATUS { status: PAUSED, onlyFrom: CURRENT }, then the banner offers « Annuler »', async () => {
    await showList([FRIEREN, VINLAND, DANDADAN]);
    void ctl.pauseDormant(FRIEREN);
    expect(ctl.store.get().busy.has(`${FRIEREN.mediaId}:${FRIEREN.malId}`)).toBe(true);
    expect(lastCall('SET_LIST_STATUS').payload).toEqual({ mediaId: FRIEREN.mediaId, malId: FRIEREN.malId, status: 'PAUSED', onlyFrom: 'CURRENT', coverUrl: null });
    lastCall('SET_LIST_STATUS').resolve(outcome('Frieren', [{ service: 'anilist', outcome: updated }]));
    await settle();
    expect(shownTitles()).toEqual(['Vinland Saga', 'Dandadan']);
    expect(dormantTitles()).toEqual(['Vinland Saga']);
    const notice = watching.notice.get();
    expect(notice?.feedback).toMatchObject({ tone: 'success', text: 'Frieren mise en pause' });
    expect(notice?.undo).not.toBeNull();
    expect(notice?.retry).toBeNull();
  });

  it('undo sends { status: CURRENT, onlyFrom: PAUSED, services: [written] } and brings the series back', async () => {
    await showList([FRIEREN, VINLAND]);
    void ctl.pauseDormant(FRIEREN);
    lastCall('SET_LIST_STATUS').resolve(
      outcome('Frieren', [
        { service: 'anilist', outcome: updated },
        { service: 'mal', outcome: { status: 'skipped', reason: 'Absente de ta liste', code: 'not-in-list' } },
      ]),
    );
    await settle();
    watching.notice.get()?.undo?.();
    expect(lastCall('SET_LIST_STATUS').payload).toEqual({ mediaId: FRIEREN.mediaId, malId: FRIEREN.malId, status: 'CURRENT', onlyFrom: 'PAUSED', services: ['anilist'], coverUrl: null });
    lastCall('SET_LIST_STATUS').resolve(outcome('Frieren', [{ service: 'anilist', outcome: updated }]));
    await settle();
    // De retour dans la liste, active pour un seuil entier (sa fiche vient d'être modifiée)
    expect(shownTitles()).toContain('Frieren');
    expect(dormantTitles()).toEqual(['Vinland Saga']);
    expect(watching.notice.get()?.feedback).toMatchObject({ tone: 'success', text: 'Frieren remise en cours' });
    expect(watching.notice.get()?.undo).toBeNull();
  });

  it('R8 : « absente de ta liste » et « déjà à jour » comptent comme inchangés, jamais un avertissement', async () => {
    await showList([FRIEREN, VINLAND]);
    void ctl.pauseDormant(FRIEREN);
    lastCall('SET_LIST_STATUS').resolve(
      outcome('Frieren', [
        { service: 'anilist', outcome: updated },
        { service: 'mal', outcome: { status: 'up-to-date', progress: 7 } },
      ]),
    );
    await settle();
    expect(watching.notice.get()?.feedback.tone).toBe('success');

    // Rien d'écrit nulle part (statut déjà changé ailleurs, absente) : information, sans « Annuler » ni « Réessayer »
    void ctl.pauseDormant(VINLAND);
    lastCall('SET_LIST_STATUS').resolve(
      outcome('Vinland Saga', [
        { service: 'anilist', outcome: { status: 'up-to-date', progress: 7 } },
        { service: 'mal', outcome: { status: 'skipped', reason: 'Absente de ta liste', code: 'not-in-list' } },
      ]),
    );
    await settle();
    const notice = watching.notice.get();
    expect(notice?.feedback).toMatchObject({ tone: 'info', text: 'Rien n’a été modifié' });
    expect(notice?.undo).toBeNull();
    expect(notice?.retry).toBeNull();
    // La série n'est plus « en cours » sur le service affiché : elle quitte la liste
    expect(shownTitles()).toEqual([]);
  });

  it('échec partiel : avertissement, « Réessayer » sur le seul service en échec, « Annuler » sur celui écrit', async () => {
    await showList([FRIEREN, VINLAND]);
    void ctl.pauseDormant(FRIEREN);
    lastCall('SET_LIST_STATUS').resolve(
      outcome('Frieren', [
        { service: 'anilist', outcome: updated },
        { service: 'mal', outcome: { status: 'error', message: 'HTTP 500' } },
      ]),
    );
    await settle();
    const notice = watching.notice.get();
    expect(notice?.feedback.tone).toBe('warning');
    expect(notice?.feedback.text).toBe('Frieren mise en pause · échec MyAnimeList');
    notice?.retry?.();
    expect(lastCall('SET_LIST_STATUS').payload).toEqual({ mediaId: FRIEREN.mediaId, malId: FRIEREN.malId, status: 'PAUSED', onlyFrom: 'CURRENT', services: ['mal'], coverUrl: null });
    lastCall('SET_LIST_STATUS').resolve(outcome('Frieren', [{ service: 'mal', outcome: updated }]));
    await settle();
    // « Annuler » rétablit les deux écritures
    watching.notice.get()?.undo?.();
    expect(lastCall('SET_LIST_STATUS').payload).toMatchObject({ status: 'CURRENT', onlyFrom: 'PAUSED', services: ['anilist', 'mal'] });
  });

  it('échec complet : erreur, la série reste, pas d’« Annuler »', async () => {
    await showList([FRIEREN, VINLAND]);
    void ctl.dropDormant(FRIEREN);
    expect(lastCall('SET_LIST_STATUS').payload).toMatchObject({ status: 'DROPPED', onlyFrom: 'CURRENT' });
    lastCall('SET_LIST_STATUS').resolve(outcome('Frieren', [{ service: 'anilist', outcome: { status: 'error', message: 'Hors ligne' } }]));
    await settle();
    const notice = watching.notice.get();
    expect(notice?.feedback.tone).toBe('error');
    expect(notice?.undo).toBeNull();
    expect(notice?.retry).not.toBeNull();
    expect(dormantTitles()).toEqual(['Vinland Saga', 'Frieren']);
  });

  it('abandon : « … abandonnée », annuler renvoie onlyFrom DROPPED', async () => {
    await showList([FRIEREN, VINLAND]);
    void ctl.dropDormant(FRIEREN);
    lastCall('SET_LIST_STATUS').resolve(outcome('Frieren', [{ service: 'anilist', outcome: updated }]));
    await settle();
    expect(watching.notice.get()?.feedback.text).toBe('Frieren abandonnée');
    void ctl.undoDormant();
    expect(lastCall('SET_LIST_STATUS').payload).toMatchObject({ status: 'CURRENT', onlyFrom: 'DROPPED', services: ['anilist'] });
  });

  it('« Tout mettre en pause » : une écriture par série, résultat regroupé, un seul « Annuler » pour toutes', async () => {
    await showList([FRIEREN, VINLAND, DANDADAN]);
    void ctl.pauseAllDormant();
    expect(calls('SET_LIST_STATUS')).toHaveLength(1);
    expect(lastCall('SET_LIST_STATUS').payload).toMatchObject({ mediaId: VINLAND.mediaId, status: 'PAUSED', onlyFrom: 'CURRENT' });
    lastCall('SET_LIST_STATUS').resolve(outcome('Vinland Saga', [{ service: 'anilist', outcome: updated }]));
    await settle();
    expect(calls('SET_LIST_STATUS')).toHaveLength(2);
    expect(lastCall('SET_LIST_STATUS').payload).toMatchObject({ mediaId: FRIEREN.mediaId, status: 'PAUSED' });
    lastCall('SET_LIST_STATUS').resolve(outcome('Frieren', [{ service: 'anilist', outcome: updated }]));
    await settle();
    expect(shownTitles()).toEqual(['Dandadan']);
    expect(watching.notice.get()?.feedback).toMatchObject({ tone: 'success', text: '2 séries mises en pause' });

    watching.notice.get()?.undo?.();
    expect(lastCall('SET_LIST_STATUS').payload).toMatchObject({ mediaId: VINLAND.mediaId, status: 'CURRENT', onlyFrom: 'PAUSED', services: ['anilist'] });
    lastCall('SET_LIST_STATUS').resolve(outcome('Vinland Saga', [{ service: 'anilist', outcome: updated }]));
    await settle();
    expect(lastCall('SET_LIST_STATUS').payload).toMatchObject({ mediaId: FRIEREN.mediaId, status: 'CURRENT', onlyFrom: 'PAUSED' });
    lastCall('SET_LIST_STATUS').resolve(outcome('Frieren', [{ service: 'anilist', outcome: updated }]));
    await settle();
    expect(watching.notice.get()?.feedback).toMatchObject({ tone: 'success', text: '2 séries remises en cours' });
  });

  it('« Annuler » disparaît avec le bandeau', async () => {
    await showList([FRIEREN, VINLAND]);
    void ctl.pauseDormant(FRIEREN);
    lastCall('SET_LIST_STATUS').resolve(outcome('Frieren', [{ service: 'anilist', outcome: updated }]));
    await settle();
    vi.advanceTimersByTime(60_000);
    expect(watching.notice.get()).toBeNull();
    const before = calls('SET_LIST_STATUS').length;
    await ctl.undoDormant();
    expect(calls('SET_LIST_STATUS')).toHaveLength(before);
  });
});
