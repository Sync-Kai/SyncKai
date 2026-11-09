import { describe, expect, it } from 'vitest';
import { setLocale } from '../i18n';
import { formatSequelDate } from './sequel-date';
import type { SequelSnapshot } from './sequels';

const base: SequelSnapshot = {
  id: 1, idMal: null, title: 'Suite', format: 'TV', status: 'NOT_YET_RELEASED', coverUrl: null, siteUrl: 'https://anilist.co/anime/1',
  year: null, month: null, day: null, season: null, seasonYear: null, sourceId: 2, sourceTitle: 'Source',
};

describe('formatSequelDate', () => {
  it('formate selon la précision connue (fr)', () => {
    setLocale('fr');
    expect(formatSequelDate({ ...base, year: 2027, month: 1, day: 10 }, 'fr')).toBe('10 janv. 2027');
    expect(formatSequelDate({ ...base, year: 2027, month: 10 }, 'fr')).toBe('octobre 2027');
    expect(formatSequelDate({ ...base, season: 'WINTER', seasonYear: 2027 }, 'fr')).toBe('Hiver 2027');
    expect(formatSequelDate({ ...base, year: 2027 }, 'fr')).toBe('2027');
    expect(formatSequelDate(base, 'fr')).toBe('Date à venir');
    expect(formatSequelDate({ ...base, status: 'RELEASING', year: 2027, month: 1, day: 10 }, 'fr')).toBe('Déjà en diffusion');
  });

  it('suit la langue (en, ja)', () => {
    setLocale('en');
    expect(formatSequelDate({ ...base, year: 2027, month: 1, day: 10 }, 'en')).toBe('Jan 10, 2027');
    expect(formatSequelDate({ ...base, status: 'RELEASING' }, 'en')).toBe('Already airing');
    setLocale('ja');
    expect(formatSequelDate({ ...base, year: 2027, month: 10 }, 'ja')).toBe('2027年10月');
    setLocale('fr');
  });
});
