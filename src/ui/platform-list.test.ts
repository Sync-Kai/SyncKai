import { afterEach, describe, expect, it } from 'vitest';
import { getLocale, setLocale } from '../i18n';
import { formatPlatformList } from './platform-list';

describe('formatPlatformList', () => {
  const initial = getLocale();
  afterEach(() => setLocale(initial));

  it('liste dans la langue active, libellés des marques', () => {
    setLocale('fr');
    expect(formatPlatformList(['crunchyroll', 'adn', 'netflix', 'disney'], 'conjunction')).toBe('Crunchyroll, ADN, Netflix et Disney+');
    expect(formatPlatformList(['crunchyroll', 'adn', 'disney'], 'disjunction')).toBe('Crunchyroll, ADN ou Disney+');
    setLocale('de');
    expect(formatPlatformList(['crunchyroll', 'adn', 'netflix'], 'disjunction')).toBe('Crunchyroll, ADN oder Netflix');
    setLocale('en');
    expect(formatPlatformList(['crunchyroll', 'adn'], 'conjunction')).toBe('Crunchyroll and ADN');
  });
});
