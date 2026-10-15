import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SyncOutcome } from '../../shared/sync.types';
import type { TrackerId } from '../../shared/tracker.types';
import type { WatchingEntry, WatchingList } from '../../shared/watching.types';
import { setLocale } from '../../i18n';
import { installFakeChrome } from '../../test/fake-chrome';
import { createStore, LOGGED_OUT, type AccountState, type ExclusionsState, type Store } from '../../ui/state';
import type { WatchingController } from './watching';

// Contrôleur « En cours » : fausse API chrome (stockage, cache de la liste), faux service worker (réponses à la main)
// et faux comptes (stores seuls). Minuteries simulées : délai d'attente de GET_WATCHING, revalidation, bandeaux.

interface PendingCall {
  type: string;
  payload: unknown;
  resolve: (value: unknown) => void;
  reject: (error: unknown) => void;
}

const sw = vi.hoisted(() => ({ calls: [] as PendingCall[] }));

vi.mock('../../protocol/messages', () => ({
  sendMessage: (type: string, payload: unknown) => new Promise((resolve, reject) => sw.calls.push({ type, payload, resolve, reject })),
}));

const fake = installFakeChrome();
const { createWatchingController } = await import('./watching');
const { STORAGE_KEYS } = await import('../../protocol/storage-keys');
const { PLATFORM_LINKS_KEY } = await import('../../platforms/links');
const { popupTimeouts } = await import('../timeouts');
const { t } = await import('../../i18n');

async function settle(): Promise<void> {
  for (let i = 0; i < 20; i++) await Promise.resolve();
}

function calls(type: string): PendingCall[] {
  return sw.calls.filter((c) => c.type === type);
}

function lastCall(type: string): PendingCall {
  const call = calls(type).at(-1);
  if (!call) throw new Error(`${type} non envoyé`);
  return call;
}

function entry(mediaId: number, title: string, progress: number): WatchingEntry {
  return {
    mediaId,
    malId: mediaId + 1,
    title,
    coverUrl: null,
    progress,
    totalEpisodes: 28,
    updatedAt: null,
    nextEpisode: null,
    airingStatus: null,
    platforms: [],
    lastSync: null,
    siteUrl: `https://anilist.co/anime/${mediaId}`,
  };
}

const FRIEREN = entry(154587, 'Frieren', 7);
const DANDADAN = entry(171018, 'Dandadan', 4);

function list(service: TrackerId, entries: WatchingEntry[], fetchedAt = 1_000): WatchingList {
  return { service, entries, fetchedAt };
}

const loggedIn: AccountState<unknown> = { status: 'logged-in', viewer: null, error: null };

let accountStores: Record<TrackerId, Store<AccountState<unknown>>>;
const markExpired = vi.fn<(service: TrackerId) => void>();
const onServiceShown = vi.fn<(service: TrackerId) => void>();
const onNoticeShown = vi.fn<() => void>();
let exclusions: Store<ExclusionsState>;
let ctl: WatchingController;

function connect(...services: TrackerId[]): void {
  for (const id of ['anilist', 'mal'] as const) accountStores[id].set(services.includes(id) ? loggedIn : LOGGED_OUT);
}

beforeEach(() => {
  // Textes attendus en français, quelle que soit la langue de la machine (CI en anglais)
  setLocale('fr');
  fake.reset();
  sw.calls.length = 0;
  markExpired.mockReset();
  onServiceShown.mockReset();
  onNoticeShown.mockReset();
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
  accountStores = { anilist: createStore<AccountState<unknown>>({ status: 'loading' }), mal: createStore<AccountState<unknown>>({ status: 'loading' }) };
  // Session refusée : le compte passe à « Session expirée » (comme le contrôleur des comptes)
  markExpired.mockImplementation((service) => accountStores[service].set({ ...LOGGED_OUT, expired: true }));
  exclusions = createStore<ExclusionsState>({ status: 'ready', items: [] });
  ctl = createWatchingController({
    accounts: { store: (service) => accountStores[service], markExpired },
    exclusions,
    reloadExclusions: async () => undefined,
    onServiceShown,
    onNoticeShown,
  });
  ctl.start();
});

afterEach(() => {
  ctl.dispose();
  vi.useRealTimers();
});

describe('createWatchingController : chargement', () => {
  it('comptes encore en lecture : rien n’est chargé', () => {
    accountStores.anilist.set(loggedIn);
    expect(sw.calls).toHaveLength(0);
    expect(ctl.store.get()).toEqual({ status: 'idle' });
  });

  it('cache affiché tout de suite, puis revalidé par le service worker', async () => {
    fake.local.seed({ [STORAGE_KEYS.watchingCache]: { anilist: list('anilist', [FRIEREN]) } });
    connect('anilist');
    expect(onServiceShown).toHaveBeenCalledWith('anilist');
    await settle();
    expect(ctl.store.get()).toEqual({ status: 'ready', service: 'anilist', list: list('anilist', [FRIEREN]), refreshing: true, error: null });
    expect(lastCall('GET_WATCHING').payload).toEqual({ service: 'anilist' });

    const fresh = list('anilist', [{ ...FRIEREN, progress: 8 }, DANDADAN], 2_000);
    lastCall('GET_WATCHING').resolve({ ok: true, data: fresh });
    await settle();
    expect(ctl.store.get()).toEqual({ status: 'ready', service: 'anilist', list: fresh, refreshing: false, error: null });
  });

  it('sans cache : squelette puis erreur (« Réessayer » relit en forçant)', async () => {
    connect('anilist');
    await settle();
    expect(ctl.store.get()).toEqual({ status: 'loading', service: 'anilist' });
    lastCall('GET_WATCHING').resolve({ ok: false, code: 'NETWORK', message: 'Hors ligne' });
    await settle();
    expect(ctl.store.get()).toEqual({ status: 'error', service: 'anilist', message: 'Hors ligne' });

    void ctl.reload();
    await settle();
    expect(lastCall('GET_WATCHING').payload).toEqual({ service: 'anilist', force: true });
  });

  it('délai dépassé : erreur affichée sur la liste en cache, la réponse tardive s’applique ensuite', async () => {
    fake.local.seed({ [STORAGE_KEYS.watchingCache]: { anilist: list('anilist', [FRIEREN]) } });
    connect('anilist');
    await settle();
    vi.advanceTimersByTime(popupTimeouts.watchingMs);
    await settle();
    expect(ctl.store.get()).toMatchObject({ status: 'ready', refreshing: false, error: t('popup.swTimeout') });

    const late = list('anilist', [DANDADAN], 3_000);
    lastCall('GET_WATCHING').resolve({ ok: true, data: late });
    await settle();
    expect(ctl.store.get()).toEqual({ status: 'ready', service: 'anilist', list: late, refreshing: false, error: null });
  });

  it('changement de source : la réponse de l’ancienne requête est ignorée', async () => {
    connect('anilist', 'mal');
    await settle();
    const first = lastCall('GET_WATCHING');
    expect(first.payload).toEqual({ service: 'anilist' });

    void ctl.pickSource('mal');
    await settle();
    expect(lastCall('GET_WATCHING').payload).toEqual({ service: 'mal' });
    expect(fake.local.peek('popupPrefs')).toEqual({ source: 'mal', sort: 'next-episode' });

    first.resolve({ ok: true, data: list('anilist', [FRIEREN]) });
    await settle();
    expect(ctl.store.get()).toEqual({ status: 'loading', service: 'mal' });

    lastCall('GET_WATCHING').resolve({ ok: true, data: list('mal', [DANDADAN]) });
    await settle();
    expect(ctl.store.get()).toMatchObject({ status: 'ready', service: 'mal' });
  });

  it('session refusée : compte expiré, la liste de l’autre service prend le relais', async () => {
    connect('anilist', 'mal');
    await settle();
    lastCall('GET_WATCHING').resolve({ ok: false, code: 'TOKEN_INVALID', message: 'Session expirée' });
    await settle();
    expect(markExpired).toHaveBeenCalledWith('anilist');
    expect(ctl.activeService()).toBe('mal');
    expect(lastCall('GET_WATCHING').payload).toEqual({ service: 'mal' });
    expect(ctl.store.get()).toEqual({ status: 'loading', service: 'mal' });
  });

  it('déconnexion des deux services : liste vidée', async () => {
    connect('anilist');
    await settle();
    connect();
    expect(ctl.store.get()).toEqual({ status: 'idle' });
  });

  it('préférences : valeurs valides reprises, valeur inconnue remplacée par le tri par défaut', async () => {
    fake.local.seed({ popupPrefs: { source: 'mal', sort: 'inconnu' } });
    await ctl.loadPrefs();
    expect(ctl.prefs.get()).toEqual({ source: 'mal', sort: 'next-episode' });
    await ctl.pickSort('title');
    expect(fake.local.peek('popupPrefs')).toEqual({ source: 'mal', sort: 'title' });
  });
});

describe('createWatchingController : actions sur une série', () => {
  async function showList(): Promise<void> {
    connect('anilist');
    await settle();
    lastCall('GET_WATCHING').resolve({ ok: true, data: list('anilist', [FRIEREN, DANDADAN]) });
    await settle();
  }

  const key = `${FRIEREN.mediaId}:${FRIEREN.malId}`;

  it('+1 : action unique en cours, progression mise à jour, retour bref puis revalidation silencieuse', async () => {
    await showList();
    void ctl.adjust(FRIEREN, 1);
    void ctl.adjust(FRIEREN, 1);
    expect(calls('ADJUST_PROGRESS')).toHaveLength(1);
    expect(ctl.entryActions.get().get(key)).toEqual({ phase: 'pending', kind: 'adjust' });

    const outcome: SyncOutcome = { status: 'synced', mediaTitle: 'Frieren', results: [{ service: 'anilist', outcome: { status: 'updated', progress: 8, completed: false } }] };
    lastCall('ADJUST_PROGRESS').resolve(outcome);
    await settle();
    const shown = ctl.store.get();
    expect(shown.status === 'ready' && shown.list.entries[0]?.progress).toBe(8);
    expect(ctl.entryActions.get().get(key)).toMatchObject({ phase: 'done', feedback: { tone: 'success' } });
    expect(ctl.notice.get()).toBeNull();

    vi.advanceTimersByTime(1_000);
    await settle();
    expect(lastCall('GET_WATCHING').payload).toEqual({ service: 'anilist', force: true });
    vi.advanceTimersByTime(2_000);
    expect(ctl.entryActions.get().has(key)).toBe(false);
  });

  it('échec partiel : bandeau avec « Réessayer », qui renvoie la progression aux seuls services en échec', async () => {
    connect('anilist', 'mal');
    await settle();
    lastCall('GET_WATCHING').resolve({ ok: true, data: list('anilist', [FRIEREN]) });
    await settle();

    void ctl.adjust(FRIEREN, 1);
    lastCall('ADJUST_PROGRESS').resolve({
      status: 'synced',
      mediaTitle: 'Frieren',
      results: [
        { service: 'anilist', outcome: { status: 'updated', progress: 8, completed: false } },
        { service: 'mal', outcome: { status: 'error', message: 'HTTP 500' } },
      ],
    } satisfies SyncOutcome);
    await settle();
    const notice = ctl.notice.get();
    expect(notice?.feedback.tone).toBe('warning');
    expect(notice?.feedback.text.startsWith('Frieren · ')).toBe(true);
    expect(onNoticeShown).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(3_000);
    notice?.retry?.();
    expect(ctl.notice.get()).toBeNull();
    expect(lastCall('ADJUST_PROGRESS').payload).toEqual({ mediaId: FRIEREN.mediaId, malId: FRIEREN.malId, delta: 1, retry: { services: ['mal'], progress: 8 } });
  });

  it('changement de statut : la série quitte la liste, bandeau masqué au bout du délai', async () => {
    await showList();
    void ctl.setStatus(FRIEREN, 'PAUSED');
    expect(ctl.entryActions.get().get(key)).toEqual({ phase: 'pending', kind: 'status' });
    lastCall('SET_LIST_STATUS').resolve({ status: 'synced', mediaTitle: 'Frieren', results: [{ service: 'anilist', outcome: { status: 'updated', progress: 7, completed: false } }] } satisfies SyncOutcome);
    await settle();
    const shown = ctl.store.get();
    expect(shown.status === 'ready' && shown.list.entries.map((e) => e.title)).toEqual(['Dandadan']);
    expect(ctl.entryActions.get().has(key)).toBe(false);
    expect(ctl.notice.get()?.feedback.tone).toBe('success');

    vi.advanceTimersByTime(5_000);
    expect(ctl.notice.get()).toBeNull();
  });

  it('statut refusé par le service worker : la série reste, erreur affichée plus longtemps', async () => {
    await showList();
    void ctl.setStatus(FRIEREN, 'DROPPED');
    lastCall('SET_LIST_STATUS').reject(new Error('down'));
    await settle();
    const shown = ctl.store.get();
    expect(shown.status === 'ready' && shown.list.entries).toHaveLength(2);
    expect(ctl.notice.get()?.feedback.tone).toBe('error');
    vi.advanceTimersByTime(5_000);
    expect(ctl.notice.get()).not.toBeNull();
    vi.advanceTimersByTime(5_000);
    expect(ctl.notice.get()).toBeNull();
  });

  it('lien de série appris : ajouté à la série affichée sans requête', async () => {
    await showList();
    const before = sw.calls.length;
    const url = 'https://www.crunchyroll.com/series/GR001/frieren';
    await fake.local.set({ [PLATFORM_LINKS_KEY]: { [String(FRIEREN.mediaId)]: { links: { crunchyroll: url }, updatedAt: 1 } } });
    await settle();
    const shown = ctl.store.get();
    expect(shown.status === 'ready' && shown.list.entries[0]?.platforms).toEqual([{ platform: 'crunchyroll', url }]);
    expect(sw.calls.length).toBe(before);
  });
});

describe('createWatchingController : retrait de la liste et commentaire', () => {
  async function showList(): Promise<void> {
    connect('anilist');
    await settle();
    lastCall('GET_WATCHING').resolve({ ok: true, data: list('anilist', [FRIEREN, DANDADAN]) });
    await settle();
  }
  const key = `${FRIEREN.mediaId}:${FRIEREN.malId}`;
  const media = { mediaId: FRIEREN.mediaId, malId: FRIEREN.malId, title: 'Frieren' };
  const shownTitles = (): string[] | false => {
    const shown = ctl.store.get();
    return shown.status === 'ready' && shown.list.entries.map((e) => e.title);
  };

  it('retrait : REMOVE_FROM_LIST, la série quitte la liste, bandeau « retirée de ta liste », éditeur de cette série fermé', async () => {
    await showList();
    ctl.openNotes(FRIEREN);
    void ctl.remove(FRIEREN);
    expect(ctl.notes.get()).toBeNull();
    expect(ctl.entryActions.get().get(key)).toEqual({ phase: 'pending', kind: 'status' });
    expect(lastCall('REMOVE_FROM_LIST').payload).toEqual({ media });
    lastCall('REMOVE_FROM_LIST').resolve({
      status: 'synced',
      mediaTitle: 'Frieren',
      results: [
        { service: 'anilist', outcome: { status: 'updated', progress: 0, completed: false } },
        { service: 'mal', outcome: { status: 'skipped', reason: 'Absente de ta liste', code: 'not-in-list' } },
      ],
    } satisfies SyncOutcome);
    await settle();
    expect(shownTitles()).toEqual(['Dandadan']);
    expect(ctl.notice.get()?.feedback).toMatchObject({ tone: 'success', text: 'Frieren : retirée de ta liste' });
  });

  it('retrait en échec (session expirée) : la série reste, erreur du service en bandeau', async () => {
    await showList();
    void ctl.remove(FRIEREN);
    lastCall('REMOVE_FROM_LIST').resolve({
      status: 'synced',
      mediaTitle: 'Frieren',
      results: [{ service: 'anilist', outcome: { status: 'error', message: 'Session AniList expirée.', code: 'TOKEN_INVALID' } }],
    } satisfies SyncOutcome);
    await settle();
    expect(shownTitles()).toEqual(['Frieren', 'Dandadan']);
    expect(ctl.notice.get()?.feedback).toMatchObject({ tone: 'error', text: 'AniList : Session AniList expirée.' });
  });

  it('commentaire : lu à l’ouverture (réponse tardive d’une autre série ignorée), enregistré sans fermer en cas d’échec', async () => {
    await showList();
    ctl.openNotes(FRIEREN);
    expect(ctl.notes.get()).toMatchObject({ key, phase: 'loading' });
    expect(lastCall('GET_LIST_NOTES').payload).toEqual({ media });
    const first = lastCall('GET_LIST_NOTES');
    ctl.openNotes(DANDADAN);
    first.resolve({ ok: true, data: { inList: true, notes: 'Pas pour cette série' } });
    await settle();
    expect(ctl.notes.get()).toMatchObject({ entry: { title: 'Dandadan' }, phase: 'loading' });
    lastCall('GET_LIST_NOTES').resolve({ ok: true, data: { inList: true, notes: 'À revoir' } });
    await settle();
    expect(ctl.notes.get()).toMatchObject({ phase: 'ready', inList: true, notes: 'À revoir' });

    const failed = ctl.saveNotes(DANDADAN, 'Nouveau');
    expect(lastCall('SET_LIST_NOTES').payload).toEqual({ media: { mediaId: DANDADAN.mediaId, malId: DANDADAN.malId, title: 'Dandadan' }, notes: 'Nouveau' });
    lastCall('SET_LIST_NOTES').resolve({ status: 'synced', mediaTitle: 'Dandadan', results: [{ service: 'anilist', outcome: { status: 'error', message: 'Hors ligne', code: 'NETWORK' } }] } satisfies SyncOutcome);
    await expect(failed).resolves.toBe(false);
    expect(ctl.notice.get()?.feedback).toMatchObject({ tone: 'error', text: 'Dandadan · AniList : Hors ligne' });

    const saved = ctl.saveNotes(DANDADAN, 'Nouveau');
    lastCall('SET_LIST_NOTES').resolve({ status: 'synced', mediaTitle: 'Dandadan', results: [{ service: 'anilist', outcome: { status: 'updated', progress: 4, completed: false } }] } satisfies SyncOutcome);
    await expect(saved).resolves.toBe(true);
    expect(ctl.entryActions.get().get(`${DANDADAN.mediaId}:${DANDADAN.malId}`)).toMatchObject({ phase: 'done', feedback: { tone: 'success', text: 'Commentaire enregistré' } });
  });
});
