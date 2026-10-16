import { beforeEach, describe, expect, it, vi } from 'vitest';
import { setLocale } from '../i18n';
import { AIRING_COVERED_KEY, AIRING_NOTIFIED_KEY } from '../shared/airing-keys';
import { isAiringWeekCache } from '../shared/agenda';
import { STORAGE_KEYS } from '../protocol/storage-keys';
import type { TrackerId } from '../shared/tracker.types';
import type { WatchingEntry, WatchingList, WatchingResult } from '../shared/watching.types';
import { installFakeChrome } from '../test/fake-chrome';

// Vérification horaire des sorties (ALRT-01, ALRT-04, ALRT-06) : vrai stockage (fausse API chrome partagée), calendrier
// AniList, liste « En cours » et notifications simulés.

const fakes = vi.hoisted(() => ({
  /** Calendrier AniList : variables de la requête → page */
  schedule: vi.fn<(variables: { ids: number[]; from: number; to: number; page: number }) => unknown>(),
  /** File de chaque requête du calendrier (B9 : vérification horaire en file de fond) */
  lanes: [] as (string | undefined)[],
  getWatchingList: vi.fn<(service: TrackerId, force?: boolean) => Promise<WatchingResult>>(),
  create: vi.fn<(id: string, options: unknown) => Promise<string>>(),
}));

vi.mock('./anilist/client', () => ({
  anilistPublicQuery: async (_query: string, _guard: unknown, variables: { ids: number[]; from: number; to: number; page: number }, lane?: string) => {
    fakes.lanes.push(lane);
    return fakes.schedule(variables);
  },
}));
vi.mock('./anilist/watching', () => ({ getWatchingList: fakes.getWatchingList }));

const fake = installFakeChrome({ extra: { notifications: { create: fakes.create, clear: async () => true } } });
const { checkNewEpisodes, handleAiringAlarm } = await import('./airing');

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
  fakes.lanes.length = 0;
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

    // Vérification horaire : file de fond, jamais le budget des écrans ouverts (2026-10-15, limite AniList atteinte)
    expect(fakes.getWatchingList).toHaveBeenCalledWith('anilist', true, 'background');
    expect(fakes.lanes).toEqual(['background']);
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

describe('heure de l’alerte = heure annoncée par l’agenda (décision 17, 6-D13)', () => {
  const crunchyroll = (mediaId: number, progress: number): WatchingEntry => ({ ...entry(mediaId, progress), platforms: [{ platform: 'crunchyroll', url: `https://www.crunchyroll.com/series/S${mediaId}` }] });
  /** Calendrier qui respecte les bornes demandées (exclues), comme AniList */
  const scheduleOf = (nodes: Record<string, unknown>[]) => ({ from, to }: { from: number; to: number }): unknown =>
    page(nodes.filter((n) => typeof n.airingAt === 'number' && n.airingAt > from && n.airingAt < to));

  it('délai de la série (+3 jours dans l’agenda) : rien à la diffusion japonaise, annoncée quand l’agenda l’annonce', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    try {
      vi.setSystemTime(Date.parse('2026-10-14T15:00:00Z'));
      const aired = nowS() - 600;
      const settings = { airingAlerts: true, airingDelayHours: 0, seriesOffsets: { '1': { minutes: 3 * 24 * 60, at: 1 } } };
      fake.reset({ ...OPEN_SESSIONS, settings, [STORAGE_KEYS.watchingCache]: { anilist: list(Date.now(), [crunchyroll(1, 6), crunchyroll(2, 2)]) } });
      fakes.schedule.mockImplementation(scheduleOf([node(100, 1, 7, aired), node(200, 2, 3, aired)]));
      // Liste « En cours » relue quand elle a plus de 12 h (même contenu)
      fakes.getWatchingList.mockImplementation(async (service) => {
        const fresh = list(Date.now(), [crunchyroll(1, 6), crunchyroll(2, 2)]);
        await chrome.storage.local.set({ [STORAGE_KEYS.watchingCache]: { [service]: fresh } });
        return { ok: true, data: fresh };
      });

      expect((await checkNewEpisodes()).notified).toBe(0);
      // Série 2 : délai de Crunchyroll (60 min par défaut) pas encore écoulé ; série 1 : 3 jours
      expect(fakes.create).not.toHaveBeenCalled();
      expect((await checkNewEpisodes()).notified).toBe(0);

      fakes.create.mockClear();
      vi.setSystemTime(Date.now() + HOUR_MS);
      expect((await checkNewEpisodes()).notified).toBe(1);
      expect(fakes.create.mock.calls.map(([id]) => id)).toEqual(['synckai-airing:200']);
      // La reprise reste à la sortie de la série 1, pas encore annoncée
      expect(stored(AIRING_COVERED_KEY)).toBe(aired);

      fakes.create.mockClear();
      vi.setSystemTime(Date.now() + 3 * 24 * HOUR_MS);
      expect((await checkNewEpisodes()).notified).toBe(1);
      expect(fakes.create.mock.calls.map(([id]) => id)).toEqual(['synckai-airing:100']);
    } finally {
      vi.useRealTimers();
    }
  });

  it('délai des alertes ajouté à l’heure de l’agenda ; sans plateforme ni délai de série : diffusion japonaise + délai', async () => {
    const settings = { airingAlerts: true, airingDelayHours: 1, platformOffsets: { crunchyroll: 30 } };
    const now = nowS();
    fake.reset({ ...OPEN_SESSIONS, settings, [STORAGE_KEYS.watchingCache]: { anilist: list(Date.now(), [crunchyroll(1, 6), entry(2, 2)]) } });
    // Série 1 (Crunchyroll, 30 min + 1 h) : due 90 min après la diffusion ; série 2 (aucun lien) : 1 h après
    fakes.schedule.mockImplementation(scheduleOf([node(100, 1, 7, now - 95 * 60), node(101, 1, 8, now - 85 * 60), node(200, 2, 3, now - 61 * 60)]));
    await checkNewEpisodes();
    expect(fakes.create.mock.calls.map(([id]) => id).sort()).toEqual(['synckai-airing:100', 'synckai-airing:200']);
  });
});

describe('alarme horaire (PERF-17) : vérifiée à son déclenchement, plus par storage.onChanged', () => {
  const AIRING = 'synckai:airing';

  it('alertes coupées : aucune requête ni notification, alarme supprimée', async () => {
    fake.reset({ ...OPEN_SESSIONS, settings: { airingAlerts: false } });
    await chrome.alarms.create(AIRING, { delayInMinutes: 1, periodInMinutes: 60 });
    await handleAiringAlarm();
    expect(fakes.schedule).not.toHaveBeenCalled();
    expect(fakes.create).not.toHaveBeenCalled();
    expect(await chrome.alarms.get(AIRING)).toBeUndefined();
  });

  it('aucun service connecté : aucune requête, alarme supprimée', async () => {
    fake.reset({ settings: { airingAlerts: true } });
    await chrome.alarms.create(AIRING, { delayInMinutes: 1, periodInMinutes: 60 });
    await handleAiringAlarm();
    expect(fakes.schedule).not.toHaveBeenCalled();
    expect(fakes.getWatchingList).not.toHaveBeenCalled();
    expect(await chrome.alarms.get(AIRING)).toBeUndefined();
  });

  it('alertes actives et un service connecté : vérification en file de fond, alarme gardée', async () => {
    fake.reset({ ...OPEN_SESSIONS, [STORAGE_KEYS.watchingCache]: { anilist: list(Date.now(), [entry(1, 6)]) } });
    await chrome.alarms.create(AIRING, { delayInMinutes: 1, periodInMinutes: 60 });
    fakes.schedule.mockImplementation(() => page([]));
    await handleAiringAlarm();
    expect(fakes.lanes).toEqual(['background']);
    expect(await chrome.alarms.get(AIRING)).toMatchObject({ periodInMinutes: 60 });
  });
});
