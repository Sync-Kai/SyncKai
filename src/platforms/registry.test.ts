import { describe, expect, it } from 'vitest';
import manifest from '../../manifest.json';
import { isStreamingPlatform } from '../shared/episode.types';
import {
  isOptionalPlatform,
  OPTIONAL_PLATFORM_MATCHES,
  PLATFORM_LABELS,
  platformFromHost,
  platformRecord,
  PLATFORMS,
  STREAMING_PLATFORMS,
  type StreamingPlatform,
} from './registry';
import { contentScriptMatches, matchesPattern } from './target-pages';

// Logos réellement présents dans public/brands/ (clés : chemins depuis la racine du projet)
const BRAND_FILES = Object.keys(import.meta.glob('/public/brands/*', { query: '?url', eager: true }));

describe('registre des plateformes', () => {
  it('un descripteur par plateforme, dans l’ordre de STREAMING_PLATFORMS', () => {
    expect(Object.keys(PLATFORMS)).toEqual([...STREAMING_PLATFORMS]);
    expect(STREAMING_PLATFORMS).toEqual(['crunchyroll', 'adn', 'netflix', 'disney', 'prime']);
  });

  it('isStreamingPlatform suit le registre', () => {
    for (const platform of STREAMING_PLATFORMS) expect(isStreamingPlatform(platform)).toBe(true);
    for (const value of ['hidive', 'Crunchyroll', '', 'toString', '__proto__', null, 1]) expect(isStreamingPlatform(value)).toBe(false);
  });

  it('libellés et logos embarqués', () => {
    expect(PLATFORM_LABELS).toEqual({ crunchyroll: 'Crunchyroll', adn: 'ADN', netflix: 'Netflix', disney: 'Disney+', prime: 'Prime Video' });
    for (const platform of STREAMING_PLATFORMS) {
      const { icon, label } = PLATFORMS[platform];
      expect(PLATFORM_LABELS[platform]).toBe(label);
      expect(icon).toMatch(/^\/brands\/[a-z]+\.png$/);
      expect(BRAND_FILES).toContain(`/public${icon}`);
    }
  });

  it('pages d’accueil en https, sur l’hôte de la plateforme', () => {
    for (const platform of STREAMING_PLATFORMS) {
      const url = new URL(PLATFORMS[platform].homeUrl);
      expect(url.protocol).toBe('https:');
      expect(platformFromHost(url.hostname)).toBe(platform);
    }
  });

  it('Netflix, Disney+, Prime Video : catalogues généralistes (jamais proposés en recherche, accès optionnel)', () => {
    // Prime Video : filtre par genre dans le script de contenu, pas de lien AniList requis
    expect(STREAMING_PLATFORMS.filter((p) => PLATFORMS[p].linkRequired)).toEqual(['netflix', 'disney']);
    expect(STREAMING_PLATFORMS.filter((p) => !PLATFORMS[p].searchable)).toEqual(['netflix', 'disney', 'prime']);
    expect(STREAMING_PLATFORMS.filter(isOptionalPlatform)).toEqual(['netflix', 'disney', 'prime']);
  });
});

describe('hôtes', () => {
  it.each<[string, StreamingPlatform]>([
    ['crunchyroll.com', 'crunchyroll'],
    ['www.crunchyroll.com', 'crunchyroll'],
    ['beta.crunchyroll.com', 'crunchyroll'],
    ['WWW.Crunchyroll.COM', 'crunchyroll'],
    ['animationdigitalnetwork.com', 'adn'],
    ['animationdigitalnetwork.fr', 'adn'],
    ['www.animationdigitalnetwork.de', 'adn'],
    ['netflix.com', 'netflix'],
    ['www.netflix.com', 'netflix'],
    ['disneyplus.com', 'disney'],
    ['www.disneyplus.com', 'disney'],
    ['primevideo.com', 'prime'],
    ['www.primevideo.com', 'prime'],
  ])('%s → %s', (host, platform) => {
    expect(platformFromHost(host)).toBe(platform);
    expect(PLATFORMS[platform].matchesHost(host)).toBe(true);
  });

  it.each([
    'evilcrunchyroll.com',
    'crunchyroll.com.evil.example',
    'crunchyroll.co',
    'crunchyroll-com.example',
    'fakeanimationdigitalnetwork.com',
    'animationdigitalnetwork.com.evil.example',
    'animationdigitalnetwork.es',
    'notnetflix.com',
    'netflix.com.evil.example',
    'notdisneyplus.com',
    'disneyplus.com.evil.example',
    'disney.com',
    'notprimevideo.com',
    'primevideo.com.evil.example',
    // Sites Amazon : hors v1 (boutique), jamais ciblés
    'www.amazon.com',
    'www.amazon.de',
    'netflix.co',
    'anilist.co',
    '',
  ])('%s refusé', (host) => {
    expect(platformFromHost(host)).toBeNull();
    for (const platform of STREAMING_PLATFORMS) expect(PLATFORMS[platform].matchesHost(host)).toBe(false);
  });
});

describe('URL de série et de recherche', () => {
  it('Crunchyroll : identifiant en majuscules, slug facultatif', () => {
    const { seriesUrl } = PLATFORMS.crunchyroll;
    expect(seriesUrl('grmg8zqzr', 'one-piece')).toBe('https://www.crunchyroll.com/series/GRMG8ZQZR/one-piece');
    expect(seriesUrl('GRMG8ZQZR', null)).toBe('https://www.crunchyroll.com/series/GRMG8ZQZR');
    expect(seriesUrl(null, 'one-piece')).toBeNull();
    expect(seriesUrl('../x', null)).toBeNull();
  });

  it('ADN : identifiant numérique et slug obligatoires', () => {
    const { seriesUrl } = PLATFORMS.adn;
    expect(seriesUrl('1234', 'frieren')).toBe('https://animationdigitalnetwork.com/video/1234-frieren');
    expect(seriesUrl('1234', null)).toBeNull();
    expect(seriesUrl('abc', 'frieren')).toBeNull();
  });

  it('Netflix : identifiant numérique, slug ignoré', () => {
    const { seriesUrl } = PLATFORMS.netflix;
    expect(seriesUrl('81402901', 'ignored')).toBe('https://www.netflix.com/title/81402901');
    expect(seriesUrl('8140x', null)).toBeNull();
  });

  it('Disney+ : page /browse/entity-{uuid}, identifiant en minuscules', () => {
    const { seriesUrl, seriesIdInPath } = PLATFORMS.disney;
    expect(seriesUrl('5E2C1A3B-0000-4000-8000-0123456789AB', null)).toBe('https://www.disneyplus.com/browse/entity-5e2c1a3b-0000-4000-8000-0123456789ab');
    expect(seriesUrl('1234', null)).toBeNull();
    expect(seriesUrl(null, null)).toBeNull();
    expect(seriesIdInPath.exec('/fr-fr/browse/entity-5e2c1a3b-0000-4000-8000-0123456789ab')?.[1]).toBe('5e2c1a3b-0000-4000-8000-0123456789ab');
    // Ancien lien AniList : pas d'identifiant de série exploitable
    expect(seriesIdInPath.exec('/series/undead-unluck/2Sfd2YX6Ce6O')).toBeNull();
  });

  it('Prime Video : page /detail/{GTI compact}, préfixe de région facultatif', () => {
    const { seriesUrl, seriesIdInPath } = PLATFORMS.prime;
    expect(seriesUrl('0gmsr5wmnj6emyqrq6y2587waf', null)).toBe('https://www.primevideo.com/detail/0GMSR5WMNJ6EMYQRQ6Y2587WAF');
    // ASIN ou GTI complet : pas de page canonique sûre
    expect(seriesUrl('B0ABCDEF12', null)).toBeNull();
    expect(seriesUrl('amzn1.dv.gti.18f4d5fa-bcfd-40d4-b51c-57b602387b37', null)).toBeNull();
    expect(seriesUrl(null, null)).toBeNull();
    expect(seriesIdInPath.exec('/region/eu/detail/0GMSR5WMNJ6EMYQRQ6Y2587WAF')?.[1]).toBe('0GMSR5WMNJ6EMYQRQ6Y2587WAF');
    expect(seriesIdInPath.exec('/detail/0GMSR5WMNJ6EMYQRQ6Y2587WAF/ref=atv_dp')?.[1]).toBe('0GMSR5WMNJ6EMYQRQ6Y2587WAF');
    expect(seriesIdInPath.exec('/-/fr/detail/B0ABCDEF12')?.[1]).toBe('B0ABCDEF12');
    expect(seriesIdInPath.exec('/region/eu/storefront')).toBeNull();
    expect(PLATFORMS.prime.searchUrl('Dororo')).toBe('https://www.primevideo.com/search?phrase=Dororo');
  });

  it('URL de série reconnues par seriesIdInPath et par l’hôte', () => {
    const ids: Record<StreamingPlatform, string> = {
      crunchyroll: 'GRMG8ZQZR',
      adn: '1234',
      netflix: '81402901',
      disney: '5e2c1a3b-0000-4000-8000-0123456789ab',
      prime: '0GMSR5WMNJ6EMYQRQ6Y2587WAF',
    };
    for (const platform of STREAMING_PLATFORMS) {
      const url = new URL(PLATFORMS[platform].seriesUrl(ids[platform], 'slug') ?? '');
      expect(platformFromHost(url.hostname)).toBe(platform);
      expect(PLATFORMS[platform].seriesIdInPath.exec(url.pathname)?.[1]).toBe(ids[platform]);
    }
  });

  it('recherche : requête insérée telle quelle (déjà encodée)', () => {
    expect(PLATFORMS.crunchyroll.searchUrl('One%20Piece')).toBe('https://www.crunchyroll.com/search?q=One%20Piece');
    expect(PLATFORMS.adn.searchUrl('Frieren')).toBe('https://animationdigitalnetwork.com/video?search=Frieren');
    expect(PLATFORMS.netflix.searchUrl('Frieren')).toBe('https://www.netflix.com/search?q=Frieren');
    expect(PLATFORMS.disney.searchUrl('Ishura')).toBe('https://www.disneyplus.com/search?q=Ishura');
  });
});

describe('manifeste', () => {
  it('accès optionnel = optional_host_permissions', () => {
    expect(manifest.optional_host_permissions).toEqual([...OPTIONAL_PLATFORM_MATCHES]);
  });

  it('chaque plateforme non optionnelle a un script de contenu sur son hôte', () => {
    const matches = contentScriptMatches(manifest);
    for (const platform of STREAMING_PLATFORMS.filter((p) => !isOptionalPlatform(p))) {
      const home = new URL(PLATFORMS[platform].homeUrl);
      expect(matches.some((pattern) => matchesPattern(pattern, home))).toBe(true);
    }
  });
});

describe('platformRecord', () => {
  it('Record complet, une valeur par plateforme', () => {
    expect(platformRecord((platform) => platform.length)).toEqual({ crunchyroll: 11, adn: 3, netflix: 7, disney: 6, prime: 5 });
  });
});
