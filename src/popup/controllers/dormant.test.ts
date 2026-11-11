import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DormantAfterDays } from '../../shared/settings';
import type { ServiceOutcome, SyncOutcome } from '../../shared/sync.types';
import type { TrackerId } from '../../shared/tracker.types';
import type { WatchingEntry, WatchingList } from '../../shared/watching.types';
import { setLocale } from '../../i18n';
import { installFakeChrome } from '../../test/fake-chrome';
import { createStore, LOGGED_OUT, type AccountState, type ExclusionsState, type Store } from '../../ui/state';
import { popupTimeouts } from '../timeouts';
import type { DormantController } from './dormant';
import type { WatchingController } from './watching';

// Groupe « En sommeil » : vrai contrôleur « En cours » (liste, bandeau), faux service worker (réponses à la main) et
// marques « Garder » simulées (module de stockage remplacé).

interface PendingCall {
  type: string;
  payload: unknown;
  resolve: (value: unknown) => void;
  /** Envoi, sur l'horloge simulée (ms) */
  at: number;
}

const sw = vi.hoisted(() => ({ calls: [] as PendingCall[] }));
interface KeepFake {
  marks: Record<string, { keptAt: number }>;
  read: ReturnType<typeof vi.fn<(service: string) => Promise<Record<string, { keptAt: number }>>>>;
  write: ReturnType<typeof vi.fn<(service: string, key: string, now: number) => Promise<void>>>;
}
const keep: KeepFake = vi.hoisted(() => ({ marks: {}, read: vi.fn(), write: vi.fn() }));

vi.mock('../../protocol/messages', () => ({
  sendMessage: (type: string, payload: unknown) => new Promise((resolve) => sw.calls.push({ type, payload, resolve, at: vi.getMockedSystemTime()?.getTime() ?? 0 })),
}));
vi.mock('../../browser/storage/dormant-keep', () => ({ readKeepMarks: keep.read, keepDormant: keep.write }));

installFakeChrome();
const { createWatchingController } = await import('./watching');
const { createDormantController } = await import('./dormant');

const NOW = Date.UTC(2026, 10, 8, 12);
const DAY = 86_400_000;
/** Rythme des lots du popup ; 0 dans les autres tests (aucune attente entre deux séries) */
const PACE_MS = popupTimeouts.dormantPaceMs;

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
const BOCCHI = entry(130003, 'Bocchi the Rock!', 60);
const list = (entries: WatchingEntry[]): WatchingList => ({ service: 'anilist', entries, fetchedAt: NOW });

const updated = { status: 'updated', progress: 7, completed: false } as const;
const outcome = (title: string, results: { service: TrackerId; outcome: ServiceOutcome }[]): SyncOutcome => ({ status: 'synced', mediaTitle: title, results });

let watching: WatchingController;
let ctl: DormantController;
let threshold: Store<DormantAfterDays | undefined>;
let preferred: Store<TrackerId | null>;
const onUndo = vi.fn<() => void>();

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
  popupTimeouts.dormantPaceMs = 0;
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
  preferred = createStore<TrackerId | null>('anilist');
  onUndo.mockReset();
  accounts = { anilist: createStore<AccountState<unknown>>({ status: 'loading' }), mal: createStore<AccountState<unknown>>({ status: 'loading' }) };
  accounts.mal.set(LOGGED_OUT);
  watching = createWatchingController({
    accounts: { store: (service) => accounts[service], markExpired: vi.fn() },
    preferredService: preferred,
    exclusions: createStore<ExclusionsState>({ status: 'ready', items: [] }),
    reloadExclusions: async () => undefined,
    onServiceShown: vi.fn(),
    onNoticeShown: vi.fn(),
  });
  threshold = createStore<DormantAfterDays | undefined>(30);
  ctl = createDormantController({ watching, threshold, accounts: { store: (service) => accounts[service] }, now: () => NOW });
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
    // Progression du bouton : séries écrites sur le total
    expect(ctl.store.get().progress).toEqual({ done: 0, total: 2 });
    lastCall('SET_LIST_STATUS').resolve(outcome('Vinland Saga', [{ service: 'anilist', outcome: updated }]));
    await settle();
    expect(ctl.store.get().progress).toEqual({ done: 1, total: 2 });
    expect(calls('SET_LIST_STATUS')).toHaveLength(2);
    expect(lastCall('SET_LIST_STATUS').payload).toMatchObject({ mediaId: FRIEREN.mediaId, status: 'PAUSED' });
    lastCall('SET_LIST_STATUS').resolve(outcome('Frieren', [{ service: 'anilist', outcome: updated }]));
    await settle();
    expect(ctl.store.get().progress).toBeNull();
    expect(shownTitles()).toEqual(['Dandadan']);
    expect(watching.notice.get()?.feedback).toMatchObject({ tone: 'success', text: '2 séries mises en pause' });

    watching.notice.get()?.undo?.();
    // « Annuler » : le groupe attend, sans progression (le bouton nomme la pause groupée)
    expect(ctl.store.get()).toMatchObject({ bulk: true, progress: null });
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

  it('« Annuler » renvoie les séries remises en cours (focus de l’hôte) ; l’hôte peut porter le clic du bandeau', async () => {
    await showList([FRIEREN, VINLAND]);
    void ctl.pauseDormant(FRIEREN);
    lastCall('SET_LIST_STATUS').resolve(outcome('Frieren', [{ service: 'anilist', outcome: updated }]));
    await settle();
    const restored = ctl.undoDormant();
    lastCall('SET_LIST_STATUS').resolve(outcome('Frieren', [{ service: 'anilist', outcome: updated }]));
    await expect(restored).resolves.toEqual([`${FRIEREN.mediaId}:${FRIEREN.malId}`]);

    // Hôte fourni : le « Annuler » du bandeau passe par lui (focus après l'écriture), jamais directement par le contrôleur
    ctl.dispose();
    ctl = createDormantController({ watching, threshold, accounts: { store: (service) => accounts[service] }, now: () => NOW, onUndo });
    ctl.start();
    await settle();
    void ctl.pauseDormant(VINLAND);
    lastCall('SET_LIST_STATUS').resolve(outcome('Vinland Saga', [{ service: 'anilist', outcome: updated }]));
    await settle();
    const before = calls('SET_LIST_STATUS').length;
    watching.notice.get()?.undo?.();
    expect(onUndo).toHaveBeenCalledTimes(1);
    expect(calls('SET_LIST_STATUS')).toHaveLength(before);
  });

  it('déconnexion puis reconnexion d’un compte dans le délai : « Annuler » retiré, rien n’est écrit sur le nouveau compte', async () => {
    await showList([FRIEREN, VINLAND]);
    void ctl.pauseDormant(FRIEREN);
    lastCall('SET_LIST_STATUS').resolve(outcome('Frieren', [{ service: 'anilist', outcome: updated }, { service: 'mal', outcome: updated }]));
    await settle();
    expect(watching.notice.get()?.undo).not.toBeNull();
    // MyAnimeList (pas le service affiché) : déconnecté puis reconnecté, peut-être à un autre compte
    accounts.mal.set(LOGGED_OUT);
    accounts.mal.set({ status: 'logged-in', viewer: null, error: null });
    await settle();
    const notice = watching.notice.get();
    expect(notice?.feedback.text).toBe('Frieren mise en pause');
    expect(notice?.undo).toBeNull();
    const before = calls('SET_LIST_STATUS').length;
    await expect(ctl.undoDormant()).resolves.toEqual([]);
    expect(calls('SET_LIST_STATUS')).toHaveLength(before);
  });

  it('service affiché changé : « Annuler » retiré', async () => {
    await showList([FRIEREN, VINLAND]);
    void ctl.pauseDormant(FRIEREN);
    lastCall('SET_LIST_STATUS').resolve(outcome('Frieren', [{ service: 'anilist', outcome: updated }]));
    await settle();
    preferred.set('mal');
    await settle();
    expect(watching.notice.get()?.undo ?? null).toBeNull();
    const before = calls('SET_LIST_STATUS').length;
    await ctl.undoDormant();
    expect(calls('SET_LIST_STATUS')).toHaveLength(before);
  });
});

describe('createDormantController : lots interrompus, échecs complets, « Garder » en échec', () => {
  it('« Tout mettre en pause » : une série en échec complet est comptée (jamais « 2 séries mises en pause » seul) ; « Réessayer » la reprend', async () => {
    await showList([FRIEREN, VINLAND, BOCCHI, DANDADAN]);
    void ctl.pauseAllDormant();
    lastCall('SET_LIST_STATUS').resolve(outcome('Vinland Saga', [{ service: 'anilist', outcome: updated }]));
    await settle();
    expect(lastCall('SET_LIST_STATUS').payload).toMatchObject({ mediaId: BOCCHI.mediaId });
    lastCall('SET_LIST_STATUS').resolve({ status: 'error', message: 'Hors ligne' });
    await settle();
    lastCall('SET_LIST_STATUS').resolve(outcome('Frieren', [{ service: 'anilist', outcome: updated }]));
    await settle();
    const notice = watching.notice.get();
    expect(notice?.feedback).toMatchObject({ tone: 'warning', text: '2 séries mises en pause · 1 en échec' });
    expect(notice?.feedback.detail).toContain('Bocchi the Rock! · Hors ligne');
    expect(notice?.undo).not.toBeNull();
    notice?.retry?.();
    expect(lastCall('SET_LIST_STATUS').payload).toEqual({ mediaId: BOCCHI.mediaId, malId: BOCCHI.malId, status: 'PAUSED', onlyFrom: 'CURRENT', coverUrl: null });
  });

  it('« Tout mettre en pause » : arrêt à la limite de débit, la suite « non faite » ; « Réessayer » reprend là', async () => {
    await showList([FRIEREN, VINLAND, BOCCHI, DANDADAN]);
    void ctl.pauseAllDormant();
    lastCall('SET_LIST_STATUS').resolve(outcome('Vinland Saga', [{ service: 'anilist', outcome: updated }]));
    await settle();
    lastCall('SET_LIST_STATUS').resolve(outcome('Bocchi the Rock!', [{ service: 'anilist', outcome: { status: 'error', message: 'Trop de requêtes', code: 'RATE_LIMITED' } }]));
    await settle();
    // Frieren jamais envoyée
    expect(calls('SET_LIST_STATUS')).toHaveLength(2);
    expect(ctl.store.get().bulk).toBe(false);
    const notice = watching.notice.get();
    expect(notice?.feedback).toMatchObject({ tone: 'warning', text: 'Vinland Saga mise en pause · 2 en échec' });
    expect(notice?.feedback.detail).toContain('Trop de requêtes');
    notice?.retry?.();
    expect(lastCall('SET_LIST_STATUS').payload).toMatchObject({ mediaId: BOCCHI.mediaId, status: 'PAUSED', services: ['anilist'] });
    lastCall('SET_LIST_STATUS').resolve(outcome('Bocchi the Rock!', [{ service: 'anilist', outcome: updated }]));
    await settle();
    expect(lastCall('SET_LIST_STATUS').payload).toEqual({ mediaId: FRIEREN.mediaId, malId: FRIEREN.malId, status: 'PAUSED', onlyFrom: 'CURRENT', coverUrl: null });
    lastCall('SET_LIST_STATUS').resolve(outcome('Frieren', [{ service: 'anilist', outcome: updated }]));
    await settle();
    expect(watching.notice.get()?.feedback).toMatchObject({ tone: 'success', text: '2 séries mises en pause' });
    // « Annuler » rétablit les trois
    watching.notice.get()?.undo?.();
    expect(lastCall('SET_LIST_STATUS').payload).toMatchObject({ mediaId: VINLAND.mediaId, status: 'CURRENT' });
  });

  it('« Tout mettre en pause » : compte changé entre deux séries, la suite n’est pas écrite, ni « Annuler » ni « Réessayer »', async () => {
    await showList([FRIEREN, VINLAND, BOCCHI, DANDADAN]);
    void ctl.pauseAllDormant();
    accounts.mal.set(LOGGED_OUT);
    lastCall('SET_LIST_STATUS').resolve(outcome('Vinland Saga', [{ service: 'anilist', outcome: updated }]));
    await settle();
    expect(calls('SET_LIST_STATUS')).toHaveLength(1);
    const notice = watching.notice.get();
    expect(notice?.feedback).toMatchObject({ tone: 'warning', text: 'Vinland Saga mise en pause · 2 en échec' });
    expect(notice?.undo).toBeNull();
    expect(notice?.retry).toBeNull();
    expect(ctl.store.get().bulk).toBe(false);
  });

  it('« Garder » en échec pendant un changement de service affiché : pas d’erreur, bandeau d’échec', async () => {
    await showList([FRIEREN, VINLAND]);
    let fail: (error: Error) => void = () => undefined;
    keep.write.mockImplementationOnce(() => new Promise<void>((_resolve, reject) => (fail = reject)));
    const kept = ctl.keepDormant(FRIEREN);
    // Liste MAL affichée : marques remises à null, leur relecture jamais finie
    keep.read.mockImplementation(() => new Promise(() => undefined));
    preferred.set('mal');
    await settle();
    lastCall('GET_WATCHING').resolve({ ok: true, data: { ...list([FRIEREN, VINLAND]), service: 'mal' } });
    await settle();
    fail(new Error('storage'));
    await expect(kept).resolves.toBeUndefined();
    expect(watching.notice.get()?.feedback).toMatchObject({ tone: 'error' });
  });
});

describe('createDormantController : rythme des lots et occupation (PERF-02, POP-02)', () => {
  it('« Tout mettre en pause » sur 20 séries : jamais plus de 10 écritures (20 requêtes AniList) en 60 s', async () => {
    popupTimeouts.dormantPaceMs = PACE_MS;
    await showList(Array.from({ length: 20 }, (_, i) => entry(300_000 + i, `Série ${i + 1}`, 40 + i)));
    let finished = false;
    void ctl.pauseAllDormant().then(() => (finished = true));
    // Faux service worker : chaque écriture répond dans la demi-seconde, jusqu'à la fin du lot
    const answered = new Set<PendingCall>();
    for (let step = 0; !finished && step < 1_000; step++) {
      for (const call of calls('SET_LIST_STATUS').filter((c) => !answered.has(c))) {
        answered.add(call);
        call.resolve(outcome('Série', [{ service: 'anilist', outcome: updated }]));
      }
      await vi.advanceTimersByTimeAsync(500);
    }
    const starts = calls('SET_LIST_STATUS').map((c) => c.at);
    expect(starts).toHaveLength(20);
    const busiest = Math.max(...starts.map((start) => starts.filter((at) => at >= start && at < start + 60_000).length));
    expect(busiest).toBeLessThanOrEqual(10);
    expect(watching.notice.get()?.feedback.text).toBe('20 séries mises en pause');
  });

  it('pause seule finie pendant le lot : le groupe reste occupé, une série gardée entre-temps n’est jamais mise en pause', async () => {
    await showList([FRIEREN, VINLAND, BOCCHI, DANDADAN]);
    // Frieren en cours d'écriture : hors du lot (Vinland Saga, puis Bocchi)
    void ctl.pauseDormant(FRIEREN);
    const single = lastCall('SET_LIST_STATUS');
    void ctl.pauseAllDormant();
    expect(lastCall('SET_LIST_STATUS').payload).toMatchObject({ mediaId: VINLAND.mediaId, status: 'PAUSED' });
    single.resolve(outcome('Frieren', [{ service: 'anilist', outcome: updated }]));
    await settle();
    expect(ctl.store.get().bulk).toBe(true);
    // Bocchi attend son tour : occupée (« Garder » désactivé à l'écran) ; un « Garder » passé quand même l'emporte
    expect(ctl.store.get().busy.has(`${BOCCHI.mediaId}:${BOCCHI.malId}`)).toBe(true);
    await ctl.keepDormant(BOCCHI);
    lastCall('SET_LIST_STATUS').resolve(outcome('Vinland Saga', [{ service: 'anilist', outcome: updated }]));
    await settle();
    expect(calls('SET_LIST_STATUS').map((c) => c.payload)).not.toContainEqual(expect.objectContaining({ mediaId: BOCCHI.mediaId }));
    expect(ctl.store.get().bulk).toBe(false);
    expect(ctl.store.get().busy.size).toBe(0);
    expect(watching.notice.get()?.feedback.text).toBe('Vinland Saga mise en pause');
  });

  it('« Annuler » de 3 séries : le bandeau reste, « Annuler » porte 1 / 3 puis 2 / 3, ses boutons inactifs jusqu’au bout', async () => {
    await showList([FRIEREN, VINLAND, BOCCHI, DANDADAN]);
    void ctl.pauseAllDormant();
    for (const title of ['Vinland Saga', 'Bocchi the Rock!', 'Frieren']) {
      lastCall('SET_LIST_STATUS').resolve(outcome(title, [{ service: 'anilist', outcome: updated }]));
      await settle();
    }
    expect(watching.notice.get()?.feedback.text).toBe('3 séries mises en pause');
    // « Annuler » au rythme des lots, sur l'horloge simulée
    popupTimeouts.dormantPaceMs = PACE_MS;
    const sent = calls('SET_LIST_STATUS').length;
    watching.notice.get()?.undo?.();
    for (const done of [1, 2]) {
      lastCall('SET_LIST_STATUS').resolve(outcome('Série', [{ service: 'anilist', outcome: updated }]));
      await settle();
      expect(watching.notice.get()).toMatchObject({ feedback: { text: '3 séries mises en pause' }, progress: { button: 'undo', done, total: 3 } });
      // Un second « Annuler » pendant l'écriture n'envoie rien
      watching.notice.get()?.undo?.();
      await vi.advanceTimersByTimeAsync(PACE_MS);
    }
    // Délai du bandeau (10 s) dépassé : toujours affiché tant que la dernière série s'écrit
    expect(watching.notice.get()?.progress).toEqual({ button: 'undo', done: 2, total: 3 });
    expect(calls('SET_LIST_STATUS')).toHaveLength(sent + 3);
    lastCall('SET_LIST_STATUS').resolve(outcome('Frieren', [{ service: 'anilist', outcome: updated }]));
    await settle();
    expect(watching.notice.get()?.feedback.text).toBe('3 séries remises en cours');
    expect(watching.notice.get()?.progress).toBeUndefined();
  });

  it('« Réessayer » (d’une pause, puis d’un « Annuler ») : le bandeau reste, la progression sur « Réessayer », « Annuler » inactif', async () => {
    await showList([FRIEREN, VINLAND]);
    void ctl.pauseDormant(FRIEREN);
    lastCall('SET_LIST_STATUS').resolve(outcome('Frieren', [{ service: 'anilist', outcome: updated }, { service: 'mal', outcome: { status: 'error', message: 'HTTP 500' } }]));
    await settle();
    watching.notice.get()?.retry?.();
    expect(watching.notice.get()).toMatchObject({ feedback: { text: 'Frieren mise en pause · échec MyAnimeList' }, progress: { button: 'retry', done: 0, total: 1 } });
    // « Annuler » pendant l'essai : rien n'est envoyé
    const sent = calls('SET_LIST_STATUS').length;
    watching.notice.get()?.undo?.();
    expect(calls('SET_LIST_STATUS')).toHaveLength(sent);
    lastCall('SET_LIST_STATUS').resolve(outcome('Frieren', [{ service: 'mal', outcome: updated }]));
    await settle();
    expect(watching.notice.get()?.progress).toBeUndefined();
    // « Annuler » en échec sur MyAnimeList, puis son « Réessayer »
    watching.notice.get()?.undo?.();
    lastCall('SET_LIST_STATUS').resolve(outcome('Frieren', [{ service: 'anilist', outcome: updated }, { service: 'mal', outcome: { status: 'error', message: 'HTTP 500' } }]));
    await settle();
    watching.notice.get()?.retry?.();
    expect(watching.notice.get()?.progress).toEqual({ button: 'retry', done: 0, total: 1 });
  });
});
