import { afterAll, describe, expect, it, vi } from 'vitest';
import {
  AGENDA_TTL_MS,
  airingWeekKey,
  buildAgendaDays,
  estimateRelease,
  firstDayOfWeek,
  formatOffset,
  isAgendaPayload,
  isAiringWeekCache,
  isWeekCacheFresh,
  isWeekKey,
  mergeWatchingSeries,
  parseDateKey,
  shiftWeek,
  watchingProgress,
  weekKeysToPrune,
  weekLocaleTag,
  weekRange,
  weekRangeFromKey,
  withSeriesOffset,
  type AiringSchedule,
  type AiringWeekCache,
  type OffsetSettings,
} from './agenda';
import type { ExcludedSeries } from './exclusions';
import type { WatchingEntry } from './watching.types';

// Fuseau fixe dès le chargement (les constantes des blocs describe sont calculées avant beforeAll) :
// semaines en heure locale, changement d'heure européen le 25 octobre 2026
vi.stubEnv('TZ', 'Europe/Paris');
afterAll(() => {
  vi.unstubAllEnvs();
});

const HOUR = 3_600_000;
const local = (y: number, m: number, d: number, h = 0, min = 0): number => new Date(y, m - 1, d, h, min).getTime();

describe('premier jour de la semaine', () => {
  it('lundi en fr / de, dimanche en en (en-US), lundi en en-GB', () => {
    expect(firstDayOfWeek('fr')).toBe(1);
    expect(firstDayOfWeek('de')).toBe(1);
    expect(firstDayOfWeek('en')).toBe(7);
    expect(firstDayOfWeek('en-GB')).toBe(1);
  });

  it('locale invalide : lundi', () => {
    expect(firstDayOfWeek('!!')).toBe(1);
  });

  it('langue complète du navigateur seulement si elle correspond à l’interface', () => {
    expect(weekLocaleTag('en', 'en-GB')).toBe('en-GB');
    expect(weekLocaleTag('en', 'en_GB')).toBe('en-GB');
    expect(weekLocaleTag('fr', 'en-US')).toBe('fr');
    expect(weekLocaleTag('de', '')).toBe('de');
    expect(weekLocaleTag('fr', 'fr-CA')).toBe('fr-CA');
  });
});

describe('weekRange', () => {
  it('semaine du lundi (fr / de) contenant un mercredi', () => {
    const range = weekRange(local(2026, 10, 7, 15), firstDayOfWeek('fr'));
    expect(range.key).toBe('2026-10-05');
    expect(range.start).toBe(local(2026, 10, 5));
    expect(range.end).toBe(local(2026, 10, 12));
    expect(range.days).toHaveLength(7);
    expect(weekRange(local(2026, 10, 7, 15), firstDayOfWeek('de')).key).toBe('2026-10-05');
  });

  it('dimanche : dernier jour (lundi) ou premier jour (en-US)', () => {
    expect(weekRange(local(2026, 10, 11, 23, 59), 1).key).toBe('2026-10-05');
    expect(weekRange(local(2026, 10, 11, 0, 1), firstDayOfWeek('en')).key).toBe('2026-10-11');
    expect(weekRange(local(2026, 10, 10, 12), firstDayOfWeek('en')).key).toBe('2026-10-04');
  });

  it('lundi minuit appartient à la nouvelle semaine', () => {
    expect(weekRange(local(2026, 10, 12), 1).key).toBe('2026-10-12');
    expect(weekRange(local(2026, 10, 12) - 1, 1).key).toBe('2026-10-05');
  });

  it('changement d’heure : 7 minuits locaux, semaine de 169 h', () => {
    const range = weekRange(local(2026, 10, 25, 12), 1);
    expect(range.key).toBe('2026-10-19');
    expect(range.end - range.start).toBe(169 * HOUR);
    expect(range.days.map((d) => new Date(d).getHours())).toEqual([0, 0, 0, 0, 0, 0, 0]);
    expect(range.days[6]).toBe(local(2026, 10, 25));
    // Passage à l'heure d'été (29 mars 2026) : 167 h
    const spring = weekRange(local(2026, 3, 29, 12), 1);
    expect(spring.end - spring.start).toBe(167 * HOUR);
  });

  it('navigation et clés', () => {
    const range = weekRange(local(2026, 10, 7), 1);
    expect(shiftWeek(range, -1).key).toBe('2026-09-28');
    expect(shiftWeek(range, 3).key).toBe('2026-10-26');
    expect(shiftWeek(shiftWeek(range, 3), -3)).toEqual(range);
    expect(weekRangeFromKey('2026-10-19')).toEqual(weekRange(local(2026, 10, 21), 1));
    expect(weekRangeFromKey('2026-02-30')).toBeNull();
  });

  it('clés de semaine valides uniquement', () => {
    expect(isWeekKey('2026-10-05')).toBe(true);
    expect(isWeekKey('2026-13-01')).toBe(false);
    expect(isWeekKey('2026-1-05')).toBe(false);
    expect(isWeekKey('1999-12-27')).toBe(false);
    expect(isWeekKey(20261005)).toBe(false);
    expect(parseDateKey('2028-02-29')?.getDate()).toBe(29);
  });
});

const settings: OffsetSettings = { platformOffsets: { crunchyroll: 60, adn: 90 }, seriesOffsets: { '42': -30 } };

describe('estimateRelease', () => {
  it('diffusion + délai de la plateforme', () => {
    expect(estimateRelease(1_000_000, 'crunchyroll', settings, 1)).toBe(1_000_000 + 3600);
    expect(estimateRelease(1_000_000, 'adn', settings, 1)).toBe(1_000_000 + 5400);
  });

  it('le délai de la série l’emporte, même sans plateforme connue', () => {
    expect(estimateRelease(1_000_000, 'crunchyroll', settings, 42)).toBe(1_000_000 - 1800);
    expect(estimateRelease(1_000_000, null, settings, 42)).toBe(1_000_000 - 1800);
  });

  it('plateforme inconnue sans délai de série : pas d’estimation', () => {
    expect(estimateRelease(1_000_000, null, settings, 1)).toBeNull();
  });

  it('withSeriesOffset ajoute, remplace et retire', () => {
    expect(withSeriesOffset(settings, 7, 120).seriesOffsets).toEqual({ '42': -30, '7': 120 });
    expect(withSeriesOffset(settings, 42, 15).seriesOffsets).toEqual({ '42': 15 });
    expect(withSeriesOffset(settings, 42, null).seriesOffsets).toEqual({});
  });

  it('formatOffset', () => {
    expect(formatOffset(60)).toBe('+1 h');
    expect(formatOffset(90)).toBe('+1 h 30');
    expect(formatOffset(45)).toBe('+45 min');
    expect(formatOffset(-125)).toBe('−2 h 05');
    expect(formatOffset(0)).toBe('+0 min');
  });
});

const entry = (patch: Partial<WatchingEntry>): WatchingEntry => ({
  mediaId: 1,
  malId: null,
  title: 'Série',
  coverUrl: null,
  progress: 0,
  totalEpisodes: null,
  updatedAt: null,
  nextEpisode: null,
  airingStatus: 'RELEASING',
  platforms: [],
  lastSync: null,
  siteUrl: 'https://anilist.co/anime/1',
  ...patch,
});

const excluded = (mediaId: number): ExcludedSeries => ({ id: `anilist:${mediaId}`, platformKey: null, mediaId, label: 'x', excludedAt: 0 });

describe('séries suivies', () => {
  const entries = [
    entry({ mediaId: 1, progress: 3, title: 'Un (AL)', platforms: [{ platform: 'adn', url: 'https://animationdigitalnetwork.com/video/1' }] }),
    entry({ mediaId: 1, progress: 5, title: 'Un (MAL)', platforms: [{ platform: 'crunchyroll', url: 'https://www.crunchyroll.com/series/1' }] }),
    entry({ mediaId: 2, progress: 1 }),
    entry({ mediaId: null, malId: 9, progress: 4 }),
    entry({ mediaId: 3, progress: 2 }),
  ];

  it('fusion par fiche AniList : progression la plus élevée, exclusions et fiches MAL seules ignorées', () => {
    const series = mergeWatchingSeries(entries, [excluded(3)], 'crunchyroll');
    expect([...series.keys()]).toEqual([1, 2]);
    expect(series.get(1)).toMatchObject({ progress: 5, title: 'Un (AL)', link: { platform: 'adn' } });
    expect(series.get(2)?.link).toBeNull();
  });

  it('watchingProgress (alertes) : même règle', () => {
    expect(watchingProgress(entries, [excluded(3)])).toEqual(new Map([[1, 5], [2, 1]]));
  });
});

const schedule = (scheduleId: number, mediaId: number, episode: number, airingAt: number): AiringSchedule => ({
  scheduleId,
  mediaId,
  episode,
  airingAt: Math.floor(airingAt / 1000),
  title: `Titre ${mediaId}`,
  coverUrl: null,
});

describe('buildAgendaDays', () => {
  const range = weekRange(local(2026, 10, 7), 1);
  const series = mergeWatchingSeries(
    [
      entry({ mediaId: 1, progress: 5, platforms: [{ platform: 'crunchyroll', url: 'https://www.crunchyroll.com/series/1' }] }),
      entry({ mediaId: 2, progress: 0 }),
    ],
    [],
    'crunchyroll',
  );

  it('répartit par jour local, trie, marque les épisodes vus et calcule l’estimation', () => {
    const days = buildAgendaDays(
      [
        schedule(11, 1, 6, local(2026, 10, 7, 17, 30)),
        schedule(10, 1, 5, local(2026, 10, 5, 23, 59)),
        schedule(12, 2, 1, local(2026, 10, 7, 9)),
        schedule(13, 99, 1, local(2026, 10, 8, 9)), // série non suivie
        schedule(14, 1, 7, local(2026, 10, 12, 0)), // semaine suivante
        schedule(11, 1, 6, local(2026, 10, 7, 17, 30)), // doublon
      ],
      series,
      range,
      settings,
      local(2026, 10, 7, 12),
    );
    expect(days.map((d) => d.rows.map((r) => r.scheduleId))).toEqual([[10], [], [12, 11], [], [], [], []]);
    expect(days.map((d) => d.isToday)).toEqual([false, false, true, false, false, false, false]);
    const [monday, , wednesday] = days;
    expect(monday?.rows[0]).toMatchObject({ watched: true, episode: 5 });
    expect(wednesday?.rows[1]).toMatchObject({ watched: false, platform: 'crunchyroll', estimateAt: Math.floor(local(2026, 10, 7, 18, 30) / 1000), customOffset: null });
    expect(wednesday?.rows[0]).toMatchObject({ platform: null, estimateAt: null, link: null });
  });

  it('dimanche du changement d’heure : sortie à 23 h rangée le dimanche', () => {
    const dst = weekRange(local(2026, 10, 25, 12), 1);
    const days = buildAgendaDays([schedule(1, 1, 6, local(2026, 10, 25, 23))], series, dst, settings, 0);
    expect(days[6]?.rows).toHaveLength(1);
  });
});

describe('cache de semaine', () => {
  const range = weekRange(local(2026, 10, 7), 1);
  const cache = (fetchedAt: number, mediaIds: number[] = [1, 2]): AiringWeekCache => ({ weekStart: range.key, fetchedAt, mediaIds, schedules: [] });

  it('semaine en cours : valide 1 h', () => {
    const now = local(2026, 10, 7, 12);
    expect(isWeekCacheFresh(cache(now - AGENDA_TTL_MS.current + 1), range, now, [1, 2])).toBe(true);
    expect(isWeekCacheFresh(cache(now - AGENDA_TTL_MS.current), range, now, [1, 2])).toBe(false);
  });

  it('semaine à venir : 6 h', () => {
    const now = local(2026, 10, 1, 12);
    expect(isWeekCacheFresh(cache(now - 5 * HOUR), range, now, [1])).toBe(true);
    expect(isWeekCacheFresh(cache(now - 6 * HOUR), range, now, [1])).toBe(false);
  });

  it('semaine passée : 7 j, seulement si lue après la fin de la semaine', () => {
    const now = local(2026, 10, 15, 12);
    expect(isWeekCacheFresh(cache(range.end + HOUR), range, now, [1])).toBe(true);
    expect(isWeekCacheFresh(cache(range.end - HOUR), range, now, [1])).toBe(false);
    expect(isWeekCacheFresh(cache(range.end + HOUR), range, range.end + 8 * 24 * HOUR, [1])).toBe(false);
  });

  it('série ajoutée depuis la lecture ou cache daté du futur : à relire', () => {
    const now = local(2026, 10, 7, 12);
    expect(isWeekCacheFresh(cache(now - HOUR / 2), range, now, [1, 2, 3])).toBe(false);
    expect(isWeekCacheFresh(cache(now + HOUR), range, now, [1])).toBe(false);
  });

  it('validation et nettoyage des clés', () => {
    expect(isAiringWeekCache(cache(1))).toBe(true);
    expect(isAiringWeekCache({ ...cache(1), schedules: [{ scheduleId: 1 }] })).toBe(false);
    expect(isAiringWeekCache({ ...cache(1), weekStart: 'hier' })).toBe(false);
    expect(airingWeekKey('2026-10-05')).toBe('airingWeek:2026-10-05');
    const now = local(2026, 10, 7);
    expect(weekKeysToPrune(['airingWeek:2026-10-05', 'airingWeek:2026-08-03', 'airingWeek:2027-01-04', 'airingWeek:x', 'settings'], now)).toEqual([
      'airingWeek:2026-08-03',
      'airingWeek:2027-01-04',
      'airingWeek:x',
    ]);
  });
});

describe('isAgendaPayload', () => {
  it('accepte une clé de semaine seule', () => {
    expect(isAgendaPayload({ weekStart: '2026-10-05' })).toBe(true);
  });

  it('refuse tout le reste', () => {
    expect(isAgendaPayload(null)).toBe(false);
    expect(isAgendaPayload({})).toBe(false);
    expect(isAgendaPayload({ weekStart: '2026-10-05T00:00' })).toBe(false);
    expect(isAgendaPayload({ weekStart: '2026-10-05', extra: 1 })).toBe(false);
    expect(isAgendaPayload({ weekStart: 1_780_000_000 })).toBe(false);
  });
});
