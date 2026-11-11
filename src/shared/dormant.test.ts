import { describe, expect, it } from 'vitest';
import { dormantEntries, dormantKey, isDormant, lastActivity } from './dormant';
import type { WatchingEntry } from './watching.types';

const NOW = Date.UTC(2026, 10, 8, 12, 0, 0);
const DAY = 86_400_000;

function entry(overrides: Partial<WatchingEntry> = {}): WatchingEntry {
  return {
    mediaId: 1,
    malId: 10,
    title: 'Anime',
    coverUrl: null,
    progress: 7,
    totalEpisodes: 23,
    updatedAt: NOW - 31 * DAY,
    nextEpisode: null,
    airingStatus: 'FINISHED',
    episodeMinutes: 24,
    platforms: [],
    lastSync: null,
    siteUrl: 'https://anilist.co/anime/1',
    listStatus: 'CURRENT',
    ...overrides,
  };
}

const opts = { now: NOW, thresholdDays: 30 as const, kept: null };
const sync = (daysAgo: number): WatchingEntry['lastSync'] => ({ platform: 'crunchyroll', at: NOW - daysAgo * DAY, episodeUrl: 'https://www.crunchyroll.com/watch/X' });

describe('lastActivity', () => {
  it('le plus récent de updatedAt et lastSync.at', () => {
    expect(lastActivity(entry({ updatedAt: NOW - 10 * DAY, lastSync: sync(2) }))).toBe(NOW - 2 * DAY);
    expect(lastActivity(entry({ updatedAt: NOW - 2 * DAY, lastSync: sync(10) }))).toBe(NOW - 2 * DAY);
  });
  it('une seule source connue, ou aucune', () => {
    expect(lastActivity(entry({ updatedAt: null, lastSync: sync(3) }))).toBe(NOW - 3 * DAY);
    expect(lastActivity(entry({ updatedAt: null, lastSync: null }))).toBeNull();
  });
  it('horodatage non fini (NaN, Infinity) ignoré : jamais en sommeil sur une date illisible', () => {
    expect(lastActivity(entry({ updatedAt: Number.NaN, lastSync: null }))).toBeNull();
    expect(lastActivity(entry({ updatedAt: Number.NaN, lastSync: sync(3) }))).toBe(NOW - 3 * DAY);
    expect(lastActivity(entry({ updatedAt: NOW - 2 * DAY, lastSync: { platform: 'crunchyroll', at: Number.POSITIVE_INFINITY, episodeUrl: 'https://www.crunchyroll.com/watch/X' } }))).toBe(NOW - 2 * DAY);
    expect(isDormant(entry({ updatedAt: Number.NaN }), opts)).toBe(false);
  });
});

describe('isDormant', () => {
  it('CURRENT inactive depuis 31 j avec 16 épisodes de retard, seuil 30 : en sommeil', () => {
    expect(isDormant(entry({ progress: 19 }), opts)).toBe(true);
  });
  it('29 j : non', () => expect(isDormant(entry({ updatedAt: NOW - 29 * DAY }), opts)).toBe(false));
  it('REPEATING : non', () => expect(isDormant(entry({ listStatus: 'REPEATING' }), opts)).toBe(false));
  it('statut absent (cache 2.4.x) ou null : non', () => {
    expect(isDormant(entry({ listStatus: undefined }), opts)).toBe(false);
    expect(isDormant(entry({ listStatus: null }), opts)).toBe(false);
  });
  it('seuil null : non', () => expect(isDormant(entry(), { ...opts, thresholdDays: null })).toBe(false));
  it('aucune activité connue : non', () => expect(isDormant(entry({ updatedAt: null }), opts)).toBe(false));
  it('en diffusion et à jour : non', () => {
    const airing = entry({ airingStatus: 'RELEASING', totalEpisodes: 12, progress: 4, nextEpisode: { episode: 5, airingAt: NOW + DAY } });
    expect(isDormant(airing, opts)).toBe(false);
  });
  it('en avance sur le catalogue : non', () => expect(isDormant(entry({ progress: 30 }), opts)).toBe(false));
  it('pause de diffusion / sorties inconnues, inactive 40 j : oui (décision du propriétaire)', () => {
    const hiatus = entry({ airingStatus: 'HIATUS', totalEpisodes: null, updatedAt: NOW - 40 * DAY });
    expect(isDormant(hiatus, opts)).toBe(true);
    expect(isDormant(entry({ airingStatus: null, totalEpisodes: null, updatedAt: NOW - 40 * DAY }), opts)).toBe(true);
    // Pas encore sortie, sans date : inconnu, donc éligible
    expect(isDormant(entry({ airingStatus: 'NOT_YET_RELEASED', totalEpisodes: 12, progress: 0, updatedAt: NOW - 40 * DAY }), opts)).toBe(true);
  });
  it('épisode 1 daté dans 3 j, rien de sorti, progression 0, inactive 40 j : non (à jour sur son calendrier, POP-04)', () => {
    const premiere = entry({ airingStatus: 'NOT_YET_RELEASED', totalEpisodes: 12, progress: 0, updatedAt: NOW - 40 * DAY, nextEpisode: { episode: 1, airingAt: NOW + 3 * DAY } });
    expect(isDormant(premiere, opts)).toBe(false);
  });
  it('lastSync plus récent que updatedAt compte', () => {
    expect(isDormant(entry({ lastSync: sync(5) }), opts)).toBe(false);
    expect(isDormant(entry({ updatedAt: NOW - 5 * DAY, lastSync: sync(40) }), opts)).toBe(false);
  });

  describe('Garder', () => {
    it('gardée il y a 10 j, seuil 30 : non', () => {
      expect(isDormant(entry(), { ...opts, kept: { keptAt: NOW - 10 * DAY } })).toBe(false);
    });
    it('gardée il y a 31 j : oui', () => {
      expect(isDormant(entry({ updatedAt: NOW - 60 * DAY }), { ...opts, kept: { keptAt: NOW - 31 * DAY } })).toBe(true);
    });
    it('activité après la marque : la marque est ignorée, l\'activité décide', () => {
      // marque il y a 40 j, activité il y a 35 j : l'activité (plus ancienne que le seuil) rend la série en sommeil
      expect(isDormant(entry({ updatedAt: NOW - 35 * DAY }), { ...opts, kept: { keptAt: NOW - 40 * DAY } })).toBe(true);
      // marque il y a 10 j mais activité il y a 5 j : active, pas en sommeil
      expect(isDormant(entry({ updatedAt: NOW - 5 * DAY }), { ...opts, kept: { keptAt: NOW - 10 * DAY } })).toBe(false);
    });
    it('marque récente, activité antérieure à la marque : marque valide', () => {
      // activité 31 j, marque 20 j : marque valide
      expect(isDormant(entry(), { ...opts, kept: { keptAt: NOW - 20 * DAY } })).toBe(false);
    });
  });
});

describe('dormantKey', () => {
  it('identifiant AniList, sinon « mal:<id> »', () => {
    expect(dormantKey(entry({ mediaId: 101, malId: 7 }))).toBe('101');
    expect(dormantKey(entry({ mediaId: null, malId: 7 }))).toBe('mal:7');
  });
});

describe('dormantEntries', () => {
  const a = entry({ mediaId: 1, title: 'Alpha', updatedAt: NOW - 40 * DAY });
  const b = entry({ mediaId: 2, title: 'Beta', updatedAt: NOW - 90 * DAY });
  const c = entry({ mediaId: 3, title: 'Gamma', updatedAt: NOW - 5 * DAY });
  const d = entry({ mediaId: 4, title: 'Delta', updatedAt: NOW - 40 * DAY });
  const base = { now: NOW, thresholdDays: 30 as const, marks: {}, hero: null };

  it('séries en sommeil seulement, la plus longtemps inactive d\'abord (titre à égalité)', () => {
    expect(dormantEntries([a, b, c, d], base).map((e) => e.title)).toEqual(['Beta', 'Alpha', 'Delta']);
  });
  it('la série « Reprendre » n\'est jamais dans le groupe', () => {
    expect(dormantEntries([a, b, c], { ...base, hero: b }).map((e) => e.title)).toEqual(['Alpha']);
  });
  it('marque « Garder » de la série (clé dormantKey) : hors du groupe', () => {
    expect(dormantEntries([a, b], { ...base, marks: { '2': { keptAt: NOW - DAY } } }).map((e) => e.title)).toEqual(['Alpha']);
  });
  it('seuil « Jamais » : aucun groupe', () => {
    expect(dormantEntries([a, b], { ...base, thresholdDays: null })).toEqual([]);
  });
});
