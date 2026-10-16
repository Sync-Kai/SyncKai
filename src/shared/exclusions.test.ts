import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  EXCLUDED_SERIES_KEY,
  getExcludedSeries,
  isExcluded,
  mergeExclusion,
  normalizeSeriesTitle,
  type ExcludedSeries,
} from './exclusions';
import { exclusionKey, seriesKey } from '../platforms/series-identity';
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

describe('seriesKey', () => {
  it('utilise l’identifiant de série quand il existe', () => {
    expect(seriesKey({ platform: 'crunchyroll', seriesId: 'GRMG8ZQZR', animeTitle: 'One Piece' })).toBe('crunchyroll:GRMG8ZQZR');
    expect(seriesKey({ platform: 'adn', seriesId: '1311', animeTitle: 'X' })).toBe('adn:1311');
  });

  it('se replie sur le titre normalisé', () => {
    expect(seriesKey({ platform: 'crunchyroll', seriesId: null, animeTitle: '  Re:Zéro — Kara!  ' })).toBe('crunchyroll:title:re zero kara');
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

  it('année (décision 7) : une exclusion sans année couvre déjà le remake, une exclusion d’une autre année non', () => {
    const noYear: ExcludedSeries = { id: 'prime:title:berserk', platformKey: 'prime:title:berserk', mediaId: null, label: 'Berserk', excludedAt: 1 };
    const y2016: ExcludedSeries = { id: 'prime:title:berserk:y2016', platformKey: 'prime:title:berserk:y2016', mediaId: null, label: 'Berserk', excludedAt: 1 };
    // Remake de 2016 exclu alors que « Berserk » (sans année) l'est déjà : l'exclusion existante, plus large, est complétée
    expect(mergeExclusion([noYear], { platformKey: 'prime:title:berserk:y2016', mediaId: 21560, label: 'Berserk' }, 9)).toEqual([{ ...noYear, mediaId: 21560 }]);
    // Berserk 1997 exclu à côté de 2016 : deux exclusions
    expect(mergeExclusion([y2016], { platformKey: 'prime:title:berserk:y1997', mediaId: null, label: 'Berserk' }, 9)).toHaveLength(2);
    // Exclusion à l'année inconnue à côté de 2016 : nouvelle exclusion, qui couvre les deux remakes (jamais réduite à 2016)
    expect(mergeExclusion([y2016], { platformKey: 'prime:title:berserk', mediaId: null, label: 'Berserk' }, 9)).toEqual([
      y2016,
      { id: 'prime:title:berserk', platformKey: 'prime:title:berserk', mediaId: null, label: 'Berserk', excludedAt: 9 },
    ]);
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

  it('année (décision 7) : remake exclu, autre remake synchronisé ; année inconnue : jamais synchronisé', async () => {
    const episode = (seriesYear?: number) => ({ platform: 'prime' as const, seriesId: null, animeTitle: 'Berserk', seasonNumber: 1, ...(seriesYear ? { signals: { seriesYear } } : {}) });
    await excludeSeries({ platformKey: exclusionKey(episode(2016)), mediaId: null, label: 'Berserk' });
    expect(await getExcludedSeries()).toMatchObject([{ platformKey: 'prime:title:berserk:y2016' }]);
    expect(await isExcluded({ platformKey: exclusionKey(episode(2016)) })).toBe(true);
    expect(await isExcluded({ platformKey: exclusionKey(episode(1997)) })).toBe(false);
    expect(await isExcluded({ platformKey: exclusionKey(episode()) })).toBe(true);
    // Ancienne exclusion sans année : couvre les deux remakes, sans migration
    store[EXCLUDED_SERIES_KEY] = [{ id: 'prime:title:berserk', platformKey: 'prime:title:berserk', mediaId: null, label: 'Berserk', excludedAt: 0 }];
    expect(await isExcluded({ platformKey: exclusionKey(episode(1997)) })).toBe(true);
    expect(await isExcluded({ platformKey: exclusionKey(episode(2016)) })).toBe(true);
  });

  it('ignore les données stockées invalides', async () => {
    store[EXCLUDED_SERIES_KEY] = [{ id: 1 }, 'x', { id: 'a', platformKey: null, mediaId: 3, label: 'L', excludedAt: 0 }];
    expect(await getExcludedSeries()).toEqual([{ id: 'a', platformKey: null, mediaId: 3, label: 'L', excludedAt: 0 }]);
    store[EXCLUDED_SERIES_KEY] = 'corrompu';
    expect(await getExcludedSeries()).toEqual([]);
  });
});
