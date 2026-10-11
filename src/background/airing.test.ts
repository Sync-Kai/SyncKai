import { beforeEach, describe, expect, it, vi } from 'vitest';
import { setLocale } from '../i18n';
import { AIRING_COVERED_KEY, AIRING_NOTIFIED_KEY } from '../shared/airing-keys';
import { isAiringWeekCache } from '../shared/agenda';
import { STORAGE_KEYS } from '../shared/storage-keys';
import type { TrackerId } from '../shared/tracker.types';
import type { WatchingEntry, WatchingList, WatchingResult } from '../shared/watching.types';
import { installFakeChrome } from '../test/fake-chrome';

// Vérification horaire des sorties (ALRT-01, ALRT-04, ALRT-06) : vrai stockage (fausse API chrome partagée), calendrier
// AniList, liste « En cours » et notifications simulés.

const fakes = vi.hoisted(() => ({
  /** Calendrier AniList : variables de la requête → page */
  schedule: vi.fn<(variables: { ids: number[]; from: number; to: number; page: number }) => unknown>(),
  getWatchingList: vi.fn<(service: TrackerId, force?: boolean) => Promise<WatchingResult>>(),
  create: vi.fn<(id: string, options: unknown) => Promise<string>>(),
}));

vi.mock('./api/client', () => ({
  anilistPublicQuery: async (_query: string, _guard: unknown, variables: { ids: number[]; from: number; to: number; page: number }) =>
    fakes.schedule(variables),
}));
vi.mock('./api/watching', () => ({ getWatchingList: fakes.getWatchingList }));

const fake = installFakeChrome({ extra: { notifications: { create: fakes.create, clear: async () => true } } });
const { checkNewEpisodes } = await import('./airing');

setLocale('fr');

const HOUR_MS = 3_600_000;

/** Sessions AniList et MAL ouvertes (génération 0) */
const OPEN_SESSIONS = {
  [STORAGE_KEYS.anilistToken]: { accessToken: 'anilist', expiresAt: Number.MAX_SAFE_INTEGER },
  settings: { airingAlerts: true, airingDelayHours: 0 },
};

const entry = (mediaId: number, progress: number): WatchingEntry => ({
  mediaId,
  malId: null,
  title: `Série ${mediaId}`,
  coverUrl: null,
  progress,
  totalEpisodes: null,
  updatedAt: null,
  nextEpisode: null,
  airingStatus: 'RELEASING',
  platforms: [],
  lastSync: null,
  siteUrl: `https://anilist.co/anime/${mediaId}`,
});

const list = (fetchedAt: number, entries: WatchingEntry[]): WatchingList => ({ service: 'anilist', fetchedAt, entries });

/** Nœud airingSchedules (réponse GraphQL) */
const node = (id: number, mediaId: number, episode: number, airingAt: number): Record<string, unknown> => ({
  id,
  episode,
  airingAt,
  media: { id: mediaId, title: { userPreferred: `Série ${mediaId}` }, coverImage: null },
});

const page = (nodes: Record<string, unknown>[], hasNextPage = false): unknown => ({ Page: { pageInfo: { hasNextPage }, airingSchedules: nodes } });

const nowS = (): number => Math.floor(Date.now() / 1000);
const stored = (key: string): unknown => fake.local.peek(key);

beforeEach(() => {
  fakes.schedule.mockReset();
  fakes.getWatchingList.mockReset();
  fakes.create.mockReset();
  fakes.create.mockImplementation(async (id) => id);
});

describe('liste « En cours » de plus de 12 h (ALRT-01)', () => {
  it('rechargée avant le calcul : un épisode vu entre-temps n’est pas annoncé', async () => {
    const aired = nowS() - 600;
    fake.reset({ ...OPEN_SESSIONS, [STORAGE_KEYS.watchingCache]: { anilist: list(Date.now() - 13 * HOUR_MS, [entry(1, 6)]) } });
    // Liste relue : l'épisode 7 a été vu depuis (ailleurs que sur une plateforme suivie par SyncKai)
    fakes.getWatchingList.mockImplementation(async (service) => {
      const fresh = list(Date.now(), [entry(1, 7), entry(2, 0)]);
      await chrome.storage.local.set({ [STORAGE_KEYS.watchingCache]: { [service]: fresh } });
      return { ok: true, data: fresh };
    });
    fakes.schedule.mockImplementation(() => page([node(100, 1, 7, aired)]));

    const result = await checkNewEpisodes();

    expect(fakes.getWatchingList).toHaveBeenCalledWith('anilist', true);
    // Calendrier interrogé avec la liste relue (série 2 ajoutée depuis un autre appareil)
    expect(fakes.schedule.mock.calls[0]?.[0].ids).toEqual([1, 2]);
    expect(fakes.create).not.toHaveBeenCalled();
    expect(result).toMatchObject({ notified: 0, skipped: null, error: null });
  });

  it('liste récente : pas de requête, la progression des synchros récentes s’applique', async () => {
    const aired = nowS() - 600;
    fake.reset({
      ...OPEN_SESSIONS,
      [STORAGE_KEYS.watchingCache]: { anilist: list(Date.now() - HOUR_MS, [entry(1, 6), entry(2, 2)]) },
      [STORAGE_KEYS.recentSyncs]: [
        {
          key: 'crunchyroll:E7',
          episode: {
            platform: 'crunchyroll',
            episodeId: 'E7',
            seriesId: null,
            seriesSlug: null,
            animeTitle: 'Série 1',
            seasonNumber: null,
            seasonTitle: null,
            seasonEpisodeNumber: 7,
            displayedEpisodeNumber: 7,
            episodeTitle: null,
            url: 'https://www.crunchyroll.com/watch/E7',
          },
          mediaId: 1,
          mediaTitle: 'Série 1',
          progress: 7,
          syncedAt: Date.now() - 60_000,
        },
      ],
    });
    fakes.schedule.mockImplementation(() => page([node(100, 1, 7, aired), node(200, 2, 3, aired)]));

    const result = await checkNewEpisodes();

    expect(fakes.getWatchingList).not.toHaveBeenCalled();
    expect(fakes.create.mock.calls.map(([id]) => id)).toEqual(['synckai-airing:200']);
    expect(result.notified).toBe(1);
  });
});

describe('notification qui échoue (ALRT-04)', () => {
  it('retirée de airingNotified et réessayée à la vérification suivante', async () => {
    const aired = nowS() - 600;
    fake.reset({ ...OPEN_SESSIONS, [STORAGE_KEYS.watchingCache]: { anilist: list(Date.now(), [entry(1, 6), entry(2, 2)]) } });
    fakes.schedule.mockImplementation(() => page([node(100, 1, 7, aired), node(200, 2, 3, aired + 60)]));
    fakes.create.mockRejectedValueOnce(new Error('Icône illisible'));

    const first = await checkNewEpisodes();

    // Le premier échec n'arrête pas la boucle : la seconde notification est affichée
    expect(fakes.create.mock.calls.map(([id]) => id)).toEqual(['synckai-airing:100', 'synckai-airing:200']);
    expect(first).toMatchObject({ notified: 1, error: 'Icône illisible' });
    expect(stored(AIRING_NOTIFIED_KEY)).toEqual([200]);
    // Fenêtre ramenée à la sortie non annoncée : elle sera relue
    expect(stored(AIRING_COVERED_KEY)).toBe(aired);

    fakes.create.mockClear();
    const second = await checkNewEpisodes();

    expect(fakes.create.mock.calls.map(([id]) => id)).toEqual(['synckai-airing:100']);
    expect(second).toMatchObject({ notified: 1, error: null });
    expect(stored(AIRING_NOTIFIED_KEY)).toEqual([200, 100]);
  });
});

describe('pagination tronquée (ALRT-06)', () => {
  it('semaine marquée incomplète, fenêtre des alertes relue seule : la sortie récente est annoncée', async () => {
    const recent = nowS() - 600;
    fake.reset({ ...OPEN_SESSIONS, [STORAGE_KEYS.watchingCache]: { anilist: list(Date.now(), [entry(1, 6), entry(2, 0)]) } });
    fakes.schedule.mockImplementation(({ to, page: n }) => {
      // Fenêtre des alertes seule (se termine maintenant) : une seule page
      if (to <= nowS()) return page([node(500, 1, 7, recent)]);
      // Semaine entière : 3 pages pleines de sorties plus anciennes, toujours une page suivante
      return page(
        Array.from({ length: 50 }, (_, i) => node(n * 1000 + i, 2, n * 50 + i, recent - 5 * 3600 + n * 60)),
        true,
      );
    });

    const result = await checkNewEpisodes();

    expect(fakes.create.mock.calls.map(([id]) => id)).toEqual(['synckai-airing:500']);
    expect(result.notified).toBe(1);
    const weekKey = Object.keys(Object.fromEntries(fake.local.data)).find((key) => key.startsWith('airingWeek:'));
    const week = weekKey ? stored(weekKey) : undefined;
    expect(isAiringWeekCache(week) && week.truncated).toBe(true);
    // Fenêtre des alertes entièrement couverte par la seconde lecture
    expect(stored(AIRING_COVERED_KEY)).toBeGreaterThan(recent);
  });
});
