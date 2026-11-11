import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setLocale } from '../../i18n';
import { STORAGE_KEYS } from '../../protocol/storage-keys';
import type { AniListViewer } from '../../shared/anilist.types';
import type { MalViewer } from '../../shared/mal.types';
import type { ProfileStats } from '../../shared/profile-stats';
import type { TrackerId } from '../../shared/tracker.types';
import type { WatchingEntry } from '../../shared/watching.types';
import { installFakeChrome } from '../../test/fake-chrome';
import { createStore, LOGGED_OUT, type AccountState, type Store } from '../../ui/state';
import { DEFAULT_SECTION_PREFS, type SectionPrefs } from './section-prefs';

// Contrôleur de l'écran Stats : service affiché (préférence du popup, sinon « Fiche ouverte par défaut »), période,
// historique local et cache « En cours » relus à l'affichage, profil relu au plus une fois quand il date de plus d'une
// heure ou n'a pas encore les statistiques détaillées (identifiants de compte fictifs)

const fake = installFakeChrome();
const { DEFAULT_STATS_PERIOD, createStatsController } = await import('./stats');

const NOW = new Date(2026, 10, 11, 12).getTime();
const HOUR = 3_600_000;

const PROFILE: ProfileStats = {
  scoreFormat: 'POINT_10',
  meanScore100: 76,
  statuses: [{ status: 'COMPLETED', count: 168 }],
  formats: [],
  genres: [],
  scores: [],
  studios: [],
  decades: [],
  rewatched: null,
};
const ANILIST: AniListViewer = { id: 7, name: 'A', siteUrl: 'https://anilist.co/user/7', avatarUrl: null, stats: { animeCount: 196, episodes: 3482, days: 58 }, profile: PROFILE };
const MAL: MalViewer = { id: 9, name: 'M', pictureUrl: null, stats: { animeCount: 231, episodes: 3910, days: 65 }, profile: { ...PROFILE, rewatched: 14 } };

const HISTORY = {
  anilist: { accountId: 7, days: { '2026-11-10': [3, 72], '2026-11-11': [2, 48] } },
  mal: { accountId: 9, days: { '2026-11-01': [1, 24] } },
};

function entry(overrides: Partial<WatchingEntry> = {}): WatchingEntry {
  return {
    mediaId: 1,
    malId: 10,
    title: 'Anime',
    coverUrl: null,
    progress: 7,
    totalEpisodes: 23,
    updatedAt: null,
    nextEpisode: null,
    airingStatus: 'FINISHED',
    episodeMinutes: 24,
    platforms: [],
    lastSync: null,
    siteUrl: 'https://anilist.co/anime/1',
    ...overrides,
  };
}

interface Harness {
  stores: Record<TrackerId, Store<AccountState<unknown>>>;
  refresh: ReturnType<typeof vi.fn<(service: TrackerId) => Promise<void>>>;
  saved: Partial<SectionPrefs>[];
  controller: ReturnType<typeof createStatsController>;
}

function harness(options: { anilist?: AccountState<unknown>; mal?: AccountState<unknown>; prefs?: SectionPrefs; defaultService?: TrackerId | null; refreshed?: Partial<Record<TrackerId, unknown>> } = {}): Harness {
  const stores: Record<TrackerId, Store<AccountState<unknown>>> = {
    anilist: createStore<AccountState<unknown>>(options.anilist ?? { status: 'logged-in', viewer: ANILIST, error: null }),
    mal: createStore<AccountState<unknown>>(options.mal ?? { status: 'logged-in', viewer: MAL, error: null }),
  };
  const refresh = vi.fn(async (service: TrackerId): Promise<void> => {
    const viewer = options.refreshed?.[service];
    const current = stores[service].get();
    if (viewer !== undefined && current.status === 'logged-in') stores[service].set({ ...current, viewer });
  });
  const saved: Partial<SectionPrefs>[] = [];
  const controller = createStatsController({
    accounts: { store: (service) => stores[service], refresh },
    defaultService: () => (options.defaultService === undefined ? 'anilist' : options.defaultService),
    prefs: {
      load: async () => options.prefs ?? DEFAULT_SECTION_PREFS,
      save: async (patch) => {
        saved.push(patch);
      },
    },
    now: () => NOW,
  });
  return { stores, refresh, saved, controller };
}

/** Vue publiée (null avant la fin des premières lectures) */
function viewOf(controller: Harness['controller']) {
  const view = controller.store.get();
  if (view === null) throw new Error('vue pas encore publiée');
  return view;
}

/** Lectures du stockage et requêtes du show() terminées */
const settle = async (): Promise<void> => {
  for (let i = 0; i < 10; i++) await new Promise((resolve) => setTimeout(resolve, 0));
};

beforeEach(() => {
  setLocale('fr');
  fake.reset({
    [STORAGE_KEYS.activityHistory]: HISTORY,
    [STORAGE_KEYS.anilistViewerAt]: NOW - 10 * 60_000,
    [STORAGE_KEYS.malViewerAt]: NOW - 10 * 60_000,
    [STORAGE_KEYS.watchingCache]: {
      anilist: { service: 'anilist', entries: [entry(), entry({ mediaId: 2, progress: 20 })], fetchedAt: NOW },
      mal: { service: 'mal', entries: [entry({ progress: 22 })], fetchedAt: NOW },
    },
  });
});
afterEach(() => vi.restoreAllMocks());

describe('createStatsController', () => {
  it('service : préférence retenue si connectée, sinon defaultService ; setService enregistre statsService', async () => {
    const { controller, saved } = harness({ prefs: { ...DEFAULT_SECTION_PREFS, statsService: 'mal' } });
    controller.show();
    await settle();
    expect(viewOf(controller)).toMatchObject({ service: 'mal', services: ['anilist', 'mal'] });
    controller.setService('anilist');
    expect(viewOf(controller).service).toBe('anilist');
    expect(saved).toEqual([{ statsService: 'anilist' }]);

    // Préférence MAL sans compte MAL : le service par défaut
    const alone = harness({ prefs: { ...DEFAULT_SECTION_PREFS, statsService: 'mal' }, mal: LOGGED_OUT, defaultService: 'anilist' });
    alone.controller.show();
    await settle();
    expect(viewOf(alone.controller).service).toBe('anilist');
    // Sans préférence : defaultService (watching.activeService())
    const fallback = harness({ defaultService: 'mal' });
    fallback.controller.show();
    await settle();
    expect(viewOf(fallback.controller).service).toBe('mal');
  });

  it('premier affichage : rien de publié avant la fin des lectures (pas d’activité vide ni de service par défaut)', async () => {
    const { controller } = harness({ prefs: { ...DEFAULT_SECTION_PREFS, statsService: 'mal' } });
    const published: unknown[] = [];
    controller.store.subscribe((view) => published.push(view));
    controller.show();
    expect(controller.store.get()).toBeNull();
    await settle();
    // Première vue publiée : celle des données lues (MAL retenu, son activité et son « En cours »)
    expect(published.filter((view) => view !== null)[0]).toMatchObject({ service: 'mal', activity: { episodes: 1 }, remaining: '≈ 25 min à rattraper · 1 série' });
    expect(published.slice(0, 1)).toEqual([null]);
  });

  it('un seul compte : services de longueur 1', async () => {
    const { controller } = harness({ anilist: LOGGED_OUT, defaultService: null });
    controller.show();
    await settle();
    expect(viewOf(controller)).toMatchObject({ service: 'mal', services: ['mal'] });
    // Aucun compte : service null
    const none = harness({ anilist: LOGGED_OUT, mal: LOGGED_OUT, defaultService: null });
    none.controller.show();
    await settle();
    expect(viewOf(none.controller)).toMatchObject({ service: null, services: [] });
  });

  it('show : profil relu une fois s’il date de plus d’une heure, jamais sinon', async () => {
    const fresh = harness();
    fresh.controller.show();
    await settle();
    fresh.controller.setService('mal');
    fresh.controller.show();
    await settle();
    expect(fresh.refresh).not.toHaveBeenCalled();

    await fake.local.set({ [STORAGE_KEYS.anilistViewerAt]: NOW - 2 * HOUR });
    const stale = harness();
    stale.controller.show();
    await settle();
    stale.controller.show();
    await settle();
    expect(stale.refresh).toHaveBeenCalledTimes(1);
    expect(stale.refresh).toHaveBeenCalledWith('anilist');
    expect(viewOf(stale.controller).refreshing).toBe(false);
  });

  it('profil en cache sans profile : totaux affichés, une relecture, blocs remplis à l’arrivée', async () => {
    const { profile: _profile, ...legacy } = ANILIST;
    let release: () => void = () => {};
    const { controller, refresh, stores } = harness({ anilist: { status: 'logged-in', viewer: legacy, error: null } });
    refresh.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          release = () => {
            stores.anilist.set({ status: 'logged-in', viewer: ANILIST, error: null });
            resolve();
          };
        }),
    );
    controller.show();
    await settle();
    // Profil récent (10 min) mais sans statistiques détaillées : relu une fois, les totaux restent affichés
    expect(refresh).toHaveBeenCalledTimes(1);
    const during = viewOf(controller);
    expect(during.refreshing).toBe(true);
    expect(during.account.status === 'logged-in' && during.account.viewer?.stats).toEqual(ANILIST.stats);
    expect(during.account.status === 'logged-in' && during.account.viewer?.profile).toBeUndefined();
    release();
    await settle();
    const after = viewOf(controller);
    expect(after.refreshing).toBe(false);
    expect(after.account.status === 'logged-in' && after.account.viewer?.profile).toEqual(PROFILE);
    controller.show();
    await settle();
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('période par défaut 30d, setPeriod recalcule sans relire le stockage', async () => {
    expect(DEFAULT_STATS_PERIOD).toBe('30d');
    const { controller } = harness();
    controller.show();
    await settle();
    const month = viewOf(controller);
    expect(month.period).toBe('30d');
    expect(month.activity).toMatchObject({ episodes: 5, minutes: 120, unit: 'day' });
    expect(month.activity.bars).toHaveLength(30);
    const get = vi.spyOn(chrome.storage.local, 'get');
    controller.setPeriod('7d');
    expect(viewOf(controller).period).toBe('7d');
    expect(viewOf(controller).activity.bars).toHaveLength(7);
    controller.setPeriod('12m');
    expect(viewOf(controller).activity).toMatchObject({ unit: 'month', episodes: 5 });
    expect(get).not.toHaveBeenCalled();
  });

  it('reloadActivity relit l’historique', async () => {
    const { controller } = harness();
    controller.show();
    await settle();
    await fake.local.set({ [STORAGE_KEYS.activityHistory]: { ...HISTORY, anilist: { accountId: 7, days: { '2026-11-11': [9, 200] } } } });
    expect(viewOf(controller).activity.episodes).toBe(5);
    controller.reloadActivity();
    await settle();
    expect(viewOf(controller).activity).toMatchObject({ episodes: 9, minutes: 200 });
  });

  it('part d’un autre compte : activité vide', async () => {
    // Reconnexion à un autre compte AniList (id 8) avant la relecture du profil : la part du compte 7 n'est pas montrée
    const { controller } = harness({ anilist: { status: 'logged-in', viewer: { ...ANILIST, id: 8 }, error: null } });
    controller.show();
    await settle();
    expect(viewOf(controller).activity).toMatchObject({ episodes: 0, minutes: 0, firstDay: null });
    controller.setService('mal');
    expect(viewOf(controller).activity.episodes).toBe(1);
  });

  it('session expirée : activité locale du compte en cache toujours calculée', async () => {
    await fake.local.set({ [STORAGE_KEYS.anilistViewer]: ANILIST });
    const { controller } = harness({ anilist: { ...LOGGED_OUT, expired: true } });
    controller.show();
    await settle();
    expect(viewOf(controller)).toMatchObject({ service: 'anilist', services: ['anilist', 'mal'], account: { status: 'logged-out', expired: true } });
    expect(viewOf(controller).activity.episodes).toBe(5);
  });

  it('remaining : formatRemainingTotal du cache du service affiché', async () => {
    const { controller } = harness();
    controller.show();
    await settle();
    // AniList : 16 + 3 épisodes de 24 min = 7,6 h → « ≈ 7,5 h » ; MAL : 1 épisode
    expect(viewOf(controller).remaining).toBe('≈ 7,5 h à rattraper · 2 séries');
    controller.setService('mal');
    expect(viewOf(controller).remaining).toBe('≈ 25 min à rattraper · 1 série');
    // Aucune série à rattraper : null
    await fake.local.set({ [STORAGE_KEYS.watchingCache]: {} });
    controller.show();
    await settle();
    expect(viewOf(controller).remaining).toBeNull();
  });

  it('dispose : plus aucune mise à jour', async () => {
    const { controller, stores } = harness();
    controller.show();
    await settle();
    controller.dispose();
    stores.mal.set(LOGGED_OUT);
    expect(viewOf(controller).services).toEqual(['anilist', 'mal']);
  });
});
