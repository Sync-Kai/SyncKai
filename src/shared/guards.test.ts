import { describe, expect, it, vi } from 'vitest';
import { installOnce, parseJsonBounded } from './guards';
import { domainOrSubdomain } from './hosts';
import { keep, trim } from './lru';

describe('parseJsonBounded', () => {
  it('chaîne JSON d’au plus maxLength caractères ; sinon null', () => {
    expect(parseJsonBounded('{"a":1}', 7)).toEqual({ a: 1 });
    expect(parseJsonBounded('{"a":1}', 6)).toBeNull();
    expect(parseJsonBounded({ a: 1 }, 100)).toBeNull();
    expect(parseJsonBounded('', 100)).toBeNull();
    expect(parseJsonBounded('{pas du json', 100)).toBeNull();
  });
});

describe('installOnce', () => {
  it('une installation par garde sur ce global', () => {
    const global = {};
    const install = vi.fn();
    expect(installOnce(global, Symbol.for('test.v1'), install)).toBe(true);
    expect(installOnce(global, Symbol.for('test.v1'), install)).toBe(false);
    expect(installOnce(global, Symbol.for('test.v2'), install)).toBe(true);
    expect(install).toHaveBeenCalledTimes(2);
  });
});

describe('domainOrSubdomain', () => {
  it('domaine exact ou sous-domaine, casse ignorée ; jamais un domaine qui le contient', () => {
    const isCrunchyroll = domainOrSubdomain('crunchyroll.com');
    expect(['crunchyroll.com', 'www.crunchyroll.com', 'WWW.Crunchyroll.COM', 'static.crunchyroll.com'].every(isCrunchyroll)).toBe(true);
    expect(['evilcrunchyroll.com', 'crunchyroll.com.evil.example', 'crunchyroll.co'].some(isCrunchyroll)).toBe(false);
    expect(domainOrSubdomain('bamgrid.com', 'disneyplus.com')('disney.api.edge.bamgrid.com')).toBe(true);
  });
});

describe('keep / trim', () => {
  it('la plus récente en dernier, les plus anciennes retirées au-delà de la borne', () => {
    const map = new Map<string, number>();
    for (const [key, value] of [['a', 1], ['b', 2], ['c', 3], ['a', 4]] as const) keep(map, key, value, 2);
    expect([...map]).toEqual([['c', 3], ['a', 4]]);
    const set = new Set([1, 2, 3, 4]);
    trim(set, 1);
    expect([...set]).toEqual([4]);
  });
});
