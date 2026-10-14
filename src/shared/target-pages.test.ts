import { afterEach, describe, expect, it, vi } from 'vitest';
import manifest from '../../manifest.json';
import { contentScriptMatches, isTargetPage, matchesPattern, NETFLIX_MATCHES, SIDE_PANEL_PATH, targetPagePatterns } from './target-pages';

const DISNEY_MATCHES = ['*://*.disneyplus.com/*'];
const PRIME_MATCHES = ['*://*.primevideo.com/*'];

const patterns = contentScriptMatches(manifest);

describe('contentScriptMatches', () => {
  it('motifs des scripts de contenu du manifeste, sans doublon', () => {
    expect(patterns).toEqual(['*://*.crunchyroll.com/*', '*://animationdigitalnetwork.com/*', '*://*.animationdigitalnetwork.com/*']);
    expect(contentScriptMatches({ content_scripts: [{ matches: ['a'] }, { matches: ['a', 'b'] }, {}] })).toEqual(['a', 'b']);
    expect(contentScriptMatches({})).toEqual([]);
  });
});

describe('isTargetPage', () => {
  it.each([
    'https://www.crunchyroll.com/fr/watch/GG1U2Q5K4/the-beginning',
    'https://www.crunchyroll.com/',
    'http://crunchyroll.com/series/abc',
    'https://beta.crunchyroll.com/watch/x?t=10#top',
    'https://animationdigitalnetwork.com/video/123-frieren/456-episode-1',
    'https://www.animationdigitalnetwork.com/',
  ])('page cible : %s', (url) => {
    expect(isTargetPage(url, patterns)).toBe(true);
  });

  it.each([
    'https://anilist.co/anime/1',
    'https://myanimelist.net/anime/1',
    'https://crunchyroll.com.evil.example/watch/x',
    'https://notcrunchyroll.com/',
    'https://animationdigitalnetwork.fr/',
    'ftp://www.crunchyroll.com/',
    'chrome://extensions/',
    'about:blank',
    'pas une url',
    '',
  ])('autre page : %s', (url) => {
    expect(isTargetPage(url, patterns)).toBe(false);
  });

  it('URL absente (onglet sans permission d’hôte)', () => {
    expect(isTargetPage(undefined, patterns)).toBe(false);
    expect(isTargetPage(null, patterns)).toBe(false);
  });
});

describe('matchesPattern', () => {
  it('schéma explicite et chemin restreint', () => {
    expect(matchesPattern('https://example.com/watch/*', new URL('https://example.com/watch/1'))).toBe(true);
    expect(matchesPattern('https://example.com/watch/*', new URL('http://example.com/watch/1'))).toBe(false);
    expect(matchesPattern('https://example.com/watch/*', new URL('https://example.com/series/1'))).toBe(false);
  });

  it('hôte joker et motif invalide', () => {
    expect(matchesPattern('*://*/*', new URL('https://any.example/'))).toBe(true);
    expect(matchesPattern('<all_urls>', new URL('https://any.example/'))).toBe(false);
  });
});

describe('SIDE_PANEL_PATH', () => {
  it('identique au manifeste', () => {
    expect(SIDE_PANEL_PATH).toBe(manifest.side_panel.default_path);
  });
});

describe('targetPagePatterns (Netflix, Disney+, Prime Video)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('ajoute Netflix, Disney+ et Prime Video (accès optionnels) aux scripts de contenu du manifeste', () => {
    vi.stubGlobal('chrome', { runtime: { getManifest: () => manifest } });
    const all = targetPagePatterns();
    expect(all).toEqual([...patterns, ...NETFLIX_MATCHES, ...DISNEY_MATCHES, ...PRIME_MATCHES]);
    expect(isTargetPage('https://www.primevideo.com/region/eu/detail/0GMSR5WMNJ6EMYQRQ6Y2587WAF', all)).toBe(true);
    expect(isTargetPage('https://www.amazon.de/gp/video/detail/B0ABCDEF12', all)).toBe(false);
    expect(isTargetPage('https://www.disneyplus.com/fr-fr/play/eaccaafa-cf43-4d6a-b85f-f9add5b6cf41', all)).toBe(true);
    expect(isTargetPage('https://disneyplus.com.evil.example/play/1', all)).toBe(false);
    expect(isTargetPage('https://www.netflix.com/watch/81402901', all)).toBe(true);
    expect(isTargetPage('https://www.netflix.com.evil.example/watch/1', all)).toBe(false);
    // Sans accès accordé, l'URL d'un onglet Netflix est masquée : jamais reconnu
    expect(isTargetPage(undefined, all)).toBe(false);
  });

  it('Netflix, Disney+ et Prime Video absents des scripts de contenu et des origines requises du manifeste', () => {
    const optional = (p: string): boolean => p.includes('netflix') || p.includes('disneyplus') || p.includes('primevideo');
    expect(patterns.some(optional)).toBe(false);
    expect(manifest.host_permissions.some(optional)).toBe(false);
    expect(manifest.optional_host_permissions).toEqual([...NETFLIX_MATCHES, ...DISNEY_MATCHES, ...PRIME_MATCHES]);
  });
});
