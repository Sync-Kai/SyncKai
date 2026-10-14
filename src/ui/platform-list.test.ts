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

  it('japonais et chinois : « 、 », espace entre « 和 / 或 » et un nom latin en chinois seulement', () => {
    setLocale('ja');
    expect(formatPlatformList(['crunchyroll', 'adn', 'netflix'], 'conjunction')).toBe('Crunchyroll、ADN、Netflix');
    setLocale('zh-TW');
    expect(formatPlatformList(['crunchyroll', 'adn', 'netflix'], 'disjunction')).toBe('Crunchyroll、ADN 或 Netflix');
    setLocale('zh-CN');
    expect(formatPlatformList(['netflix', 'disney'], 'conjunction')).toBe('Netflix 和 Disney+');
  });
});
