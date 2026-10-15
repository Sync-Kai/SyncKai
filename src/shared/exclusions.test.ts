import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  EXCLUDED_SERIES_KEY,
  getExcludedSeries,
  isExcluded,
  mergeExclusion,
  normalizeSeriesTitle,
  platformSeriesKey,
  type ExcludedSeries,
} from './exclusions';
import {
  excludeSeries,
  includeSeries,
} from '../browser/storage/exclusions-store';

// chrome.storage.local et Web Locks minimaux (environnement Node)
let store: Record<string, unknown> = {};
vi.stubGlobal('chrome', {
  storage: {
    local: {
      get: async (key: string) => ({ [key]: store[key] }),
      set: async (items: Record<string, unknown>) => {
        store = { ...store, ...items };
      },
    },
  },
});
vi.stubGlobal('navigator', { locks: { request: <T>(_name: string, task: () => Promise<T>) => task() } });

beforeEach(() => {
  store = {};
});

describe('platformSeriesKey', () => {
  it('utilise l’identifiant de série quand il existe', () => {
    expect(platformSeriesKey({ platform: 'crunchyroll', seriesId: 'GRMG8ZQZR', animeTitle: 'One Piece' })).toBe('crunchyroll:GRMG8ZQZR');
    expect(platformSeriesKey({ platform: 'adn', seriesId: '1311', animeTitle: 'X' })).toBe('adn:1311');
  });

  it('se replie sur le titre normalisé', () => {
    expect(platformSeriesKey({ platform: 'crunchyroll', seriesId: null, animeTitle: '  Re:Zéro — Kara!  ' })).toBe('crunchyroll:title:re zero kara');
  });

  it('normalise accents, casse et ponctuation', () => {
    expect(normalizeSeriesTitle('Évangélion: 3.0+1.0')).toBe('evangelion 3 0 1 0');
  });
});

describe('mergeExclusion', () => {
  const base: ExcludedSeries = { id: 'adn:1', platformKey: 'adn:1', mediaId: null, label: 'A', excludedAt: 1 };

  it('ajoute une exclusion avec un id stable', () => {
    expect(mergeExclusion([], { platformKey: null, mediaId: 42, label: 'B' }, 5)).toEqual([
      { id: 'anilist:42', platformKey: null, mediaId: 42, label: 'B', excludedAt: 5 },
    ]);
  });

  it('complète une exclusion existante sans changer son id', () => {
    expect(mergeExclusion([base], { platformKey: 'adn:1', mediaId: 7, label: 'A2' }, 9)).toEqual([{ ...base, mediaId: 7 }]);
  });

  it('ignore une exclusion sans aucune clé', () => {
    expect(mergeExclusion([base], { platformKey: null, mediaId: null, label: 'C' }, 9)).toEqual([base]);
  });
});

describe('stockage', () => {
  it('exclut, détecte puis réinclut une série', async () => {
    await excludeSeries({ platformKey: 'crunchyroll:GR1', mediaId: null, label: 'One Piece' });
    await excludeSeries({ platformKey: null, mediaId: 21, label: 'One Piece' });
    expect(await getExcludedSeries()).toHaveLength(2);
    expect(await isExcluded({ platformKey: 'crunchyroll:GR1' })).toBe(true);
    expect(await isExcluded({ mediaId: 21 })).toBe(true);
    expect(await isExcluded({ mediaId: 22 })).toBe(false);
    expect(await isExcluded({})).toBe(false);

    await includeSeries('crunchyroll:GR1');
    expect(await isExcluded({ platformKey: 'crunchyroll:GR1' })).toBe(false);
  });

  it('ignore les données stockées invalides', async () => {
    store[EXCLUDED_SERIES_KEY] = [{ id: 1 }, 'x', { id: 'a', platformKey: null, mediaId: 3, label: 'L', excludedAt: 0 }];
    expect(await getExcludedSeries()).toEqual([{ id: 'a', platformKey: null, mediaId: 3, label: 'L', excludedAt: 0 }]);
    store[EXCLUDED_SERIES_KEY] = 'corrompu';
    expect(await getExcludedSeries()).toEqual([]);
  });
});
