import { describe, expect, it } from 'vitest';
import {
  airedEpisodes,
  choosePlatformLink,
  formatRelativeTime,
  isWatchingFresh,
  nextEpisodeBadge,
  pickHeroEntry,
  sortWatching,
  sortWatchingBy,
  WATCHING_MAX_AGE_MS,
  WATCHING_REVALIDATE_MS,
} from './watching';
import { isWatchingList, isWatchingSort, WATCHING_SORTS, type WatchingEntry } from './watching.types';
import { setLocale } from '../i18n';

// Textes attendus en français
setLocale('fr');

const NOW = Date.UTC(2026, 9, 1, 12, 0, 0);
const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

function entry(overrides: Partial<WatchingEntry> = {}): WatchingEntry {
  return {
    mediaId: 1,
    malId: 10,
    title: 'Anime',
    coverUrl: null,
    progress: 0,
    totalEpisodes: null,
    updatedAt: null,
    nextEpisode: null,
    airingStatus: null,
    platforms: [],
    lastSync: null,
    siteUrl: 'https://anilist.co/anime/1',
    ...overrides,
  };
}

describe('airedEpisodes', () => {
  it('déduit les épisodes sortis du prochain épisode annoncé', () => {
    expect(airedEpisodes(entry({ nextEpisode: { episode: 5, airingAt: NOW + DAY }, totalEpisodes: 12 }))).toBe(4);
  });

  it('prend le total pour une série terminée ou annulée', () => {
    expect(airedEpisodes(entry({ airingStatus: 'FINISHED', totalEpisodes: 12 }))).toBe(12);
    expect(airedEpisodes(entry({ airingStatus: 'CANCELLED', totalEpisodes: 3 }))).toBe(3);
  });

  it('retourne null sans information exploitable', () => {
    expect(airedEpisodes(entry({ airingStatus: 'FINISHED', totalEpisodes: null }))).toBeNull();
    expect(airedEpisodes(entry({ airingStatus: 'RELEASING', totalEpisodes: 24 }))).toBeNull();
    expect(airedEpisodes(entry())).toBeNull();
  });
});

describe('nextEpisodeBadge', () => {
  it('signale un épisode sorti non vu', () => {
    const e = entry({ progress: 2, nextEpisode: { episode: 5, airingAt: NOW + DAY } });
    expect(nextEpisodeBadge(e, NOW)).toEqual({ kind: 'available', label: 'Ép. 3 disponible' });
  });

  it('signale le prochain épisode d’une série terminée pas finie', () => {
    const e = entry({ progress: 10, airingStatus: 'FINISHED', totalEpisodes: 12 });
    expect(nextEpisodeBadge(e, NOW)).toEqual({ kind: 'available', label: 'Ép. 11 disponible' });
  });

  it('considère comme sorti un épisode annoncé dont l’heure est passée', () => {
    const e = entry({ progress: 4, nextEpisode: { episode: 5, airingAt: NOW - MIN } });
    expect(nextEpisodeBadge(e, NOW)).toEqual({ kind: 'available', label: 'Ép. 5 disponible' });
    expect(nextEpisodeBadge(entry({ progress: 4, nextEpisode: { episode: 5, airingAt: NOW } }), NOW).kind).toBe('available');
  });

  it('affiche un compte à rebours en minutes, heures puis jours', () => {
    const at = (ms: number): string => nextEpisodeBadge(entry({ progress: 4, nextEpisode: { episode: 5, airingAt: NOW + ms } }), NOW).label;
    expect(at(12 * MIN + 30_000)).toBe('Ép. 5 dans 12 min');
    expect(at(10_000)).toBe('Ép. 5 dans 1 min');
    expect(at(HOUR)).toBe('Ép. 5 dans 1 h');
    expect(at(18 * HOUR + 59 * MIN)).toBe('Ép. 5 dans 18 h');
    expect(at(DAY)).toBe('Ép. 5 dans 1 j');
    expect(at(2 * DAY + 23 * HOUR)).toBe('Ép. 5 dans 2 j');
    expect(nextEpisodeBadge(entry({ progress: 4, nextEpisode: { episode: 5, airingAt: NOW + HOUR } }), NOW).kind).toBe('upcoming');
  });

  it('indique une série terminée entièrement vue', () => {
    expect(nextEpisodeBadge(entry({ progress: 12, airingStatus: 'FINISHED', totalEpisodes: 12 }), NOW)).toEqual({
      kind: 'finished',
      label: 'Série terminée',
    });
    expect(nextEpisodeBadge(entry({ airingStatus: 'CANCELLED' }), NOW).kind).toBe('finished');
  });

  it('annonce "Prochain épisode bientôt" pour une série en diffusion sans date à venir', () => {
    const soon = { kind: 'upcoming', label: 'Prochain épisode bientôt' };
    expect(nextEpisodeBadge(entry({ airingStatus: 'RELEASING', progress: 3 }), NOW)).toEqual(soon);
    // Épisode annoncé passé (cache) mais déjà vu
    expect(nextEpisodeBadge(entry({ progress: 5, nextEpisode: { episode: 5, airingAt: NOW - HOUR } }), NOW)).toEqual(soon);
    expect(nextEpisodeBadge(entry({ airingStatus: 'RELEASING', progress: 5, nextEpisode: { episode: 5, airingAt: NOW - HOUR } }), NOW)).toEqual(soon);
  });

  it('retombe sur "Date inconnue" sans information', () => {
    expect(nextEpisodeBadge(entry({ progress: 3 }), NOW)).toEqual({ kind: 'unknown', label: 'Date inconnue' });
    expect(nextEpisodeBadge(entry({ airingStatus: 'HIATUS' }), NOW).kind).toBe('unknown');
    expect(nextEpisodeBadge(entry({ airingStatus: 'HIATUS', progress: 5, nextEpisode: { episode: 5, airingAt: NOW - HOUR } }), NOW).kind).toBe('unknown');
    expect(nextEpisodeBadge(entry({ airingStatus: 'NOT_YET_RELEASED' }), NOW).kind).toBe('unknown');
  });

  it('privilégie "Série terminée" à un épisode annoncé passé', () => {
    const e = entry({ progress: 12, airingStatus: 'FINISHED', totalEpisodes: 12, nextEpisode: { episode: 12, airingAt: NOW - DAY } });
    expect(nextEpisodeBadge(e, NOW).kind).toBe('finished');
  });
});

describe('sortWatching', () => {
  const available1 = entry({ title: 'dispo ancien', progress: 1, airingStatus: 'FINISHED', totalEpisodes: 12, updatedAt: NOW - 2 * DAY });
  const available2 = entry({ title: 'dispo récent', progress: 1, nextEpisode: { episode: 4, airingAt: NOW + DAY }, updatedAt: NOW - HOUR });
  const upcomingFar = entry({ title: 'bientôt loin', progress: 3, nextEpisode: { episode: 4, airingAt: NOW + 3 * DAY } });
  const upcomingNear = entry({ title: 'bientôt proche', progress: 3, nextEpisode: { episode: 4, airingAt: NOW + HOUR } });
  const unknownOld = entry({ title: 'inconnu ancien', updatedAt: NOW - 5 * DAY });
  const unknownNew = entry({ title: 'inconnu récent', updatedAt: NOW - DAY });
  const unknownNull = entry({ title: 'inconnu sans date', updatedAt: null });
  const finishedOld = entry({ title: 'fini ancien', progress: 12, airingStatus: 'FINISHED', totalEpisodes: 12, updatedAt: NOW - 9 * DAY });
  const finishedNew = entry({ title: 'fini récent', progress: 12, airingStatus: 'FINISHED', totalEpisodes: 12, updatedAt: NOW - 3 * DAY });

  it('ordonne disponibles → prochaines sorties → sans date → terminées', () => {
    const input = [finishedOld, unknownNull, upcomingFar, unknownOld, available1, finishedNew, upcomingNear, unknownNew, available2];
    expect(sortWatching(input, NOW).map((e) => e.title)).toEqual([
      'dispo récent',
      'dispo ancien',
      'bientôt proche',
      'bientôt loin',
      'inconnu récent',
      'inconnu ancien',
      'inconnu sans date',
      'fini récent',
      'fini ancien',
    ]);
  });

  it('place "bientôt" après les sorties datées et avant les dates inconnues', () => {
    const soonOld = entry({ title: 'bientôt ancien', progress: 3, airingStatus: 'RELEASING', updatedAt: NOW - 4 * DAY });
    const soonPast = entry({ title: 'bientôt passé', progress: 4, nextEpisode: { episode: 4, airingAt: NOW - HOUR }, updatedAt: NOW - HOUR });
    const input = [unknownNew, soonOld, upcomingFar, soonPast, upcomingNear];
    expect(sortWatching(input, NOW).map((e) => e.title)).toEqual([
      'bientôt proche',
      'bientôt loin',
      'bientôt passé',
      'bientôt ancien',
      'inconnu récent',
    ]);
  });

  it('retourne un nouveau tableau sans modifier l’entrée', () => {
    const input = [unknownOld, available1];
    const sorted = sortWatching(input, NOW);
    expect(sorted).not.toBe(input);
    expect(input.map((e) => e.title)).toEqual(['inconnu ancien', 'dispo ancien']);
  });

  it('est stable à égalité', () => {
    const a = entry({ title: 'a', updatedAt: null });
    const b = entry({ title: 'b', updatedAt: null });
    const c = entry({ title: 'c', updatedAt: null });
    expect(sortWatching([b, a, c], NOW).map((e) => e.title)).toEqual(['b', 'a', 'c']);
    expect(sortWatching([], NOW)).toEqual([]);
  });
});

describe('sortWatchingBy', () => {
  const titles = (list: WatchingEntry[]): string[] => list.map((e) => e.title);

  it('"next-episode" reprend exactement sortWatching', () => {
    const input = [
      entry({ title: 'fini', progress: 12, airingStatus: 'FINISHED', totalEpisodes: 12 }),
      entry({ title: 'proche', progress: 3, nextEpisode: { episode: 4, airingAt: NOW + HOUR } }),
      entry({ title: 'dispo', progress: 1, airingStatus: 'FINISHED', totalEpisodes: 12 }),
    ];
    expect(titles(sortWatchingBy(input, 'next-episode', NOW))).toEqual(titles(sortWatching(input, NOW)));
    expect(titles(sortWatchingBy(input, 'next-episode', NOW))).toEqual(['dispo', 'proche', 'fini']);
  });

  it('"recent" : mise à jour la plus récente en tête, dates inconnues en dernier (stable)', () => {
    const input = [
      entry({ title: 'sans date 1', updatedAt: null }),
      entry({ title: 'ancien', updatedAt: NOW - 3 * DAY }),
      entry({ title: 'sans date 2', updatedAt: null }),
      entry({ title: 'récent', updatedAt: NOW - HOUR }),
      entry({ title: 'moyen', updatedAt: NOW - DAY }),
    ];
    expect(titles(sortWatchingBy(input, 'recent', NOW))).toEqual(['récent', 'moyen', 'ancien', 'sans date 1', 'sans date 2']);
  });

  it('"title" : ordre alphabétique français, insensible à la casse et aux accents', () => {
    const input = [entry({ title: 'zoo' }), entry({ title: 'Éclair' }), entry({ title: 'banane' }), entry({ title: 'Avion' }), entry({ title: 'ecole' })];
    expect(titles(sortWatchingBy(input, 'title', NOW))).toEqual(['Avion', 'banane', 'Éclair', 'ecole', 'zoo']);
  });

  it('"title" est stable pour des titres équivalents', () => {
    const a = entry({ title: 'Été', mediaId: 1 });
    const b = entry({ title: 'ete', mediaId: 2 });
    expect(sortWatchingBy([b, a], 'title', NOW)).toEqual([b, a]);
    expect(sortWatchingBy([a, b], 'title', NOW)).toEqual([a, b]);
  });

  it('"remaining" : moins d’épisodes restants en tête, total inconnu en dernier, puis par titre', () => {
    const input = [
      entry({ title: 'inconnu B', progress: 1, totalEpisodes: null }),
      entry({ title: 'reste 10', progress: 2, totalEpisodes: 12 }),
      entry({ title: 'inconnu A', progress: 5, totalEpisodes: null }),
      entry({ title: 'reste 1 b', progress: 23, totalEpisodes: 24 }),
      entry({ title: 'reste 1 a', progress: 11, totalEpisodes: 12 }),
      entry({ title: 'total zéro', progress: 0, totalEpisodes: 0 }),
      entry({ title: 'reste 0', progress: 13, totalEpisodes: 12 }),
    ];
    expect(titles(sortWatchingBy(input, 'remaining', NOW))).toEqual([
      'reste 0',
      'reste 1 a',
      'reste 1 b',
      'reste 10',
      'inconnu A',
      'inconnu B',
      'total zéro',
    ]);
  });

  it('retourne un nouveau tableau sans modifier l’entrée, pour chaque mode', () => {
    const input = [entry({ title: 'b', updatedAt: NOW - DAY, totalEpisodes: 3 }), entry({ title: 'a', updatedAt: NOW, totalEpisodes: 1 })];
    for (const sort of WATCHING_SORTS) {
      const sorted = sortWatchingBy(input, sort, NOW);
      expect(sorted).not.toBe(input);
      expect(sorted).toHaveLength(2);
      expect(titles(input)).toEqual(['b', 'a']);
    }
    expect(sortWatchingBy([], 'title', NOW)).toEqual([]);
  });
});

describe('isWatchingSort', () => {
  it('accepte les modes connus et rejette le reste', () => {
    for (const sort of WATCHING_SORTS) expect(isWatchingSort(sort)).toBe(true);
    expect(isWatchingSort('alpha')).toBe(false);
    expect(isWatchingSort(undefined)).toBe(false);
    expect(isWatchingSort(1)).toBe(false);
  });
});

describe('choosePlatformLink', () => {
  const crunchyroll = { platform: 'crunchyroll', url: 'https://www.crunchyroll.com/series/X' } as const;
  const adn = { platform: 'adn', url: 'https://animationdigitalnetwork.com/video/1' } as const;

  it('préfère la plateforme choisie', () => {
    expect(choosePlatformLink(entry({ platforms: [crunchyroll, adn] }), 'adn')).toEqual(adn);
  });

  it('prend la première plateforme sinon', () => {
    expect(choosePlatformLink(entry({ platforms: [crunchyroll] }), 'adn')).toEqual(crunchyroll);
  });

  it('retourne null sans plateforme', () => {
    expect(choosePlatformLink(entry(), 'crunchyroll')).toBeNull();
  });
});

describe('pickHeroEntry', () => {
  const sync = (at: number): WatchingEntry['lastSync'] => ({ platform: 'crunchyroll', at, episodeUrl: 'https://www.crunchyroll.com/watch/E' });

  it('choisit la dernière synchro SyncKai', () => {
    const old = entry({ title: 'old', lastSync: sync(NOW - DAY) });
    const recent = entry({ title: 'recent', lastSync: sync(NOW - HOUR) });
    expect(pickHeroEntry([old, entry(), recent])?.title).toBe('recent');
  });

  it('retourne null sans synchro', () => {
    expect(pickHeroEntry([entry(), entry()])).toBeNull();
    expect(pickHeroEntry([])).toBeNull();
  });
});

describe('formatRelativeTime', () => {
  it.each([
    [0, 'à l’instant'],
    [59_000, 'à l’instant'],
    [-5 * MIN, 'à l’instant'],
    [MIN, 'il y a 1 min'],
    [20 * MIN, 'il y a 20 min'],
    [59 * MIN + 59_000, 'il y a 59 min'],
    [HOUR, 'il y a 1 h'],
    [2 * HOUR + 30 * MIN, 'il y a 2 h'],
    [23 * HOUR + 59 * MIN, 'il y a 23 h'],
    [DAY, 'hier'],
    [47 * HOUR, 'hier'],
    [2 * DAY, 'il y a 2 jours'],
    [3 * DAY + 5 * HOUR, 'il y a 3 jours'],
  ])('%i ms → %s', (elapsed, expected) => {
    expect(formatRelativeTime(NOW - elapsed, NOW)).toBe(expected);
  });
});

describe('isWatchingList', () => {
  it('accepte une liste valide et rejette les données corrompues', () => {
    expect(isWatchingList({ service: 'anilist', fetchedAt: NOW, entries: [entry()] })).toBe(true);
    expect(isWatchingList({ service: 'kitsu', fetchedAt: NOW, entries: [] })).toBe(false);
    expect(isWatchingList({ service: 'mal', fetchedAt: NOW, entries: [{ title: 'x' }] })).toBe(false);
    expect(isWatchingList(null)).toBe(false);
  });
});

describe('isWatchingFresh (PERF-04, ALRT-01)', () => {
  const list = (fetchedAt: number): { fetchedAt: number } => ({ fetchedAt });

  it('GET_WATCHING sans force : liste de moins de 90 s servie sans requête', () => {
    expect(WATCHING_REVALIDATE_MS).toBe(90_000);
    expect(isWatchingFresh(list(NOW - 89_000), NOW, WATCHING_REVALIDATE_MS)).toBe(true);
    expect(isWatchingFresh(list(NOW - 90_000), NOW, WATCHING_REVALIDATE_MS)).toBe(false);
    expect(isWatchingFresh(null, NOW, WATCHING_REVALIDATE_MS)).toBe(false);
  });

  it('synchro postérieure à la lecture de la liste : à relire', () => {
    expect(isWatchingFresh(list(NOW - 30_000), NOW, WATCHING_REVALIDATE_MS, NOW - 10_000)).toBe(false);
    expect(isWatchingFresh(list(NOW - 30_000), NOW, WATCHING_REVALIDATE_MS, NOW - 60_000)).toBe(true);
  });

  it('alertes : relue au-delà de 12 h ; liste datée du futur (horloge) : relue', () => {
    expect(isWatchingFresh(list(NOW - WATCHING_MAX_AGE_MS + 1), NOW, WATCHING_MAX_AGE_MS)).toBe(true);
    expect(isWatchingFresh(list(NOW - WATCHING_MAX_AGE_MS), NOW, WATCHING_MAX_AGE_MS)).toBe(false);
    expect(isWatchingFresh(list(NOW + 3_600_000), NOW, WATCHING_MAX_AGE_MS)).toBe(false);
  });
});
