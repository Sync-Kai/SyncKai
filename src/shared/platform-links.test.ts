import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  searchTitle,
  platformLinkFromExternal,
  learnedLinksFor,
  mergePlatformLinks,
  parsePlatformLinkStore,
  platformSearchUrl,
  platformSeriesUrl,
  platformsWithoutLink,
  rememberPlatformLink,
  withLearnedLinks,
  type PlatformLinkStore,
} from './platform-links';
import { learnPlatformLink } from './platform-links-store';
import { choosePlatformLink } from './watching';
import type { PlatformLink, WatchingEntry } from './watching.types';

const NOW = 1_800_000_000_000;
const ADN: PlatformLink = { platform: 'adn', url: 'https://animationdigitalnetwork.com/video/1311-tougen-anki' };
const CR: PlatformLink = { platform: 'crunchyroll', url: 'https://www.crunchyroll.com/series/GRMG8ZQZR/one-piece' };

describe('platformSeriesUrl', () => {
  it('forme canonique ADN et Crunchyroll', () => {
    expect(platformSeriesUrl('adn', '1311', 'tougen-anki')).toBe(ADN.url);
    expect(platformSeriesUrl('crunchyroll', 'grmg8zqzr', 'One-Piece')).toBe(CR.url);
    // Slug facultatif sur Crunchyroll (redirection), obligatoire sur ADN
    expect(platformSeriesUrl('crunchyroll', 'GRMG8ZQZR', null)).toBe('https://www.crunchyroll.com/series/GRMG8ZQZR');
    expect(platformSeriesUrl('adn', '1311', null)).toBeNull();
  });

  it('identifiant absent ou douteux : aucun lien', () => {
    expect(platformSeriesUrl('crunchyroll', null, 'one-piece')).toBeNull();
    expect(platformSeriesUrl('crunchyroll', '../x', 'one-piece')).toBeNull();
    expect(platformSeriesUrl('adn', 'abc', 'slug')).toBeNull();
    expect(platformSeriesUrl('adn', '12', 'slug/../x')).toBeNull();
  });

  it('Netflix : page du titre, identifiant numérique uniquement', () => {
    expect(platformSeriesUrl('netflix', '80987039', null)).toBe('https://www.netflix.com/title/80987039');
    expect(platformSeriesUrl('netflix', '80987039', 'ignored-slug')).toBe('https://www.netflix.com/title/80987039');
    expect(platformSeriesUrl('netflix', 'GRMG8ZQZR', null)).toBeNull();
    expect(platformSeriesUrl('netflix', null, null)).toBeNull();
  });
});

describe('platformSearchUrl', () => {
  it('encode le titre (espaces, accents, caractères réservés)', () => {
    expect(platformSearchUrl('crunchyroll', 'One Piece')).toBe('https://www.crunchyroll.com/search?q=One%20Piece');
    expect(platformSearchUrl('adn', ' Spy×Family & co ')).toBe('https://animationdigitalnetwork.com/video?search=Spy%C3%97Family%20%26%20Co');
    expect(platformSearchUrl('adn', 'Frieren?#/')).toBe('https://animationdigitalnetwork.com/video?search=Frieren%3F%23%2F');
    expect(platformSearchUrl('netflix', 'Mushoku Tensei II')).toBe('https://www.netflix.com/search?q=Mushoku%20Tensei');
  });
});

describe('parsePlatformLinkStore', () => {
  it('ne garde que des liens https de la bonne plateforme', () => {
    const store = parsePlatformLinkStore({
      '21': { links: { adn: ADN.url, crunchyroll: 'http://www.crunchyroll.com/series/X' }, updatedAt: NOW },
      '22': { links: { adn: 'https://evil.example/video/1-x' }, updatedAt: NOW },
      '23': { links: { crunchyroll: ADN.url }, updatedAt: NOW },
      abc: { links: { adn: ADN.url }, updatedAt: NOW },
      '24': { links: { adn: ADN.url } },
      '25': 'x',
    });
    expect(store).toEqual({ '21': { links: { adn: ADN.url }, updatedAt: NOW } });
    expect(parsePlatformLinkStore(null)).toEqual({});
    expect(parsePlatformLinkStore([ADN])).toEqual({});
  });
});

describe('rememberPlatformLink', () => {
  it('ajoute un lien, complète une fiche existante, ignore un lien déjà connu', () => {
    const first = rememberPlatformLink({}, 21, ADN, NOW);
    expect(first).toEqual({ '21': { links: { adn: ADN.url }, updatedAt: NOW } });
    if (!first) throw new Error('lien non appris');
    expect(rememberPlatformLink(first, 21, ADN, NOW + 1)).toBeNull();
    expect(rememberPlatformLink(first, 21, CR, NOW + 1)).toEqual({ '21': { links: { adn: ADN.url, crunchyroll: CR.url }, updatedAt: NOW + 1 } });
  });

  it('refuse un identifiant ou un lien invalide', () => {
    expect(rememberPlatformLink({}, 0, ADN, NOW)).toBeNull();
    expect(rememberPlatformLink({}, 21, { platform: 'adn', url: CR.url }, NOW)).toBeNull();
    expect(rememberPlatformLink({}, 21, { platform: 'adn', url: 'javascript:alert(1)' }, NOW)).toBeNull();
  });

  it('éviction LRU au-delà du plafond, la fiche apprise est toujours gardée', () => {
    const store: PlatformLinkStore = {
      '1': { links: { adn: ADN.url }, updatedAt: NOW - 30 },
      '2': { links: { adn: ADN.url }, updatedAt: NOW - 10 },
      '3': { links: { adn: ADN.url }, updatedAt: NOW - 20 },
    };
    const next = rememberPlatformLink(store, 4, CR, NOW, 2);
    expect(Object.keys(next ?? {}).sort()).toEqual(['2', '4']);
  });
});

describe('fusion des liens', () => {
  it('un lien par plateforme, le premier groupe l’emporte', () => {
    const anilist = [{ platform: 'crunchyroll', url: 'https://www.crunchyroll.com/series/A' }] satisfies PlatformLink[];
    const history = [{ platform: 'adn', url: 'https://animationdigitalnetwork.com/video/1-x/2-ep' }] satisfies PlatformLink[];
    expect(mergePlatformLinks(anilist, [CR, ADN], history)).toEqual([anilist[0], ADN]);
    expect(platformsWithoutLink([ADN])).toEqual(['crunchyroll']);
    expect(platformsWithoutLink([])).toEqual(['crunchyroll', 'adn']);
    // Netflix (catalogue généraliste) n'est jamais proposé en recherche
    expect(platformsWithoutLink([{ platform: 'netflix', url: 'https://www.netflix.com/title/1' }])).toEqual(['crunchyroll', 'adn']);
  });

  it('learnedLinksFor : ordre fixe, fiche inconnue ou MAL seule → aucun lien', () => {
    const store: PlatformLinkStore = { '21': { links: { adn: ADN.url, crunchyroll: CR.url }, updatedAt: NOW } };
    expect(learnedLinksFor(store, 21)).toEqual([CR, ADN]);
    expect(learnedLinksFor(store, 22)).toEqual([]);
    expect(learnedLinksFor(store, null)).toEqual([]);
  });

  it('lecteur ADN : « Ouvrir » passe sur ADN dès qu’un lien est appris', () => {
    const entry = { mediaId: 21, platforms: [CR] };
    expect(choosePlatformLink(entry, 'adn')).toEqual(CR);
    const learned = withLearnedLinks([entry], { '21': { links: { adn: ADN.url }, updatedAt: NOW } });
    expect(learned?.[0].platforms).toEqual([CR, ADN]);
    expect(choosePlatformLink(learned?.[0] ?? entry, 'adn')).toEqual(ADN);
    expect(choosePlatformLink(learned?.[0] ?? entry, 'crunchyroll')).toEqual(CR);
    // Rien de nouveau : null (pas de nouveau rendu)
    expect(withLearnedLinks([entry], { '21': { links: { crunchyroll: 'https://www.crunchyroll.com/series/B' }, updatedAt: NOW } })).toBeNull();
  });
});

describe('learnPlatformLink (stockage)', () => {
  afterEach(() => vi.unstubAllGlobals());

  function stubStorage(initial: Record<string, unknown>): { data: Record<string, unknown>; set: ReturnType<typeof vi.fn> } {
    const data = { ...initial };
    const set = vi.fn((items: Record<string, unknown>) => {
      Object.assign(data, items);
      return Promise.resolve();
    });
    vi.stubGlobal('chrome', {
      storage: {
        local: {
          get: (keys: string[]) => Promise.resolve(Object.fromEntries(keys.filter((k) => k in data).map((k) => [k, data[k]]))),
          set,
        },
      },
    });
    vi.stubGlobal('navigator', { locks: { request: (_name: string, task: () => Promise<unknown>) => task() } });
    return { data, set };
  }

  const cachedEntry = (mediaId: number, platforms: PlatformLink[]): WatchingEntry => ({
    mediaId,
    malId: null,
    title: 'x',
    coverUrl: null,
    progress: 0,
    totalEpisodes: null,
    updatedAt: null,
    nextEpisode: null,
    airingStatus: null,
    platforms,
    lastSync: null,
    siteUrl: 'https://anilist.co/anime/1',
  });

  it('une seule écriture : liens appris + liste « En cours » en cache complétée', async () => {
    const list = { service: 'anilist', fetchedAt: NOW, entries: [cachedEntry(21, [CR]), cachedEntry(22, [])] };
    const { data, set } = stubStorage({ watchingCache: { anilist: list } });
    expect(await learnPlatformLink(21, ADN, NOW)).toBe(true);
    expect(set).toHaveBeenCalledTimes(1);
    expect(data.platformLinks).toEqual({ '21': { links: { adn: ADN.url }, updatedAt: NOW } });
    const cache = data.watchingCache as { anilist: { entries: WatchingEntry[] } };
    expect(cache.anilist.entries[0].platforms).toEqual([CR, ADN]);
    expect(cache.anilist.entries[1].platforms).toEqual([]);
    // Déjà connu : aucune écriture
    expect(await learnPlatformLink(21, ADN, NOW + 1)).toBe(false);
    expect(set).toHaveBeenCalledTimes(1);
  });

  it('ne lève jamais (stockage indisponible)', async () => {
    vi.stubGlobal('navigator', { locks: { request: () => Promise.reject(new Error('quota')) } });
    expect(await learnPlatformLink(21, ADN, NOW)).toBe(false);
  });
});

describe('platformLinkFromExternal', () => {
  it('passe en https les vieux liens AniList http de Crunchyroll / ADN / Netflix (ex. Naruto Shippuden)', () => {
    expect(platformLinkFromExternal('http://www.crunchyroll.com/naruto-shippuden')).toEqual({
      platform: 'crunchyroll',
      url: 'https://www.crunchyroll.com/naruto-shippuden',
    });
    expect(platformLinkFromExternal('http://animationdigitalnetwork.fr/video/1-x')?.platform).toBe('adn');
    expect(platformLinkFromExternal('http://www.netflix.com/title/80987039')).toEqual({ platform: 'netflix', url: 'https://www.netflix.com/title/80987039' });
    expect(platformLinkFromExternal('https://evilnetflix.com/title/1')).toBeNull();
  });

  it('ignore les autres sites, les URL invalides et les schémas non web', () => {
    expect(platformLinkFromExternal('http://www.hulu.com/naruto-shippuden')).toBeNull();
    expect(platformLinkFromExternal('javascript:alert(1)')).toBeNull();
    expect(platformLinkFromExternal('pas une url')).toBeNull();
    expect(platformLinkFromExternal(null)).toBeNull();
  });
});

describe('searchTitle (recherche « Chercher sur … »)', () => {
  it('garde juste le nom de l’anime', () => {
    expect(searchTitle('Black Clover 2nd Season')).toBe('Black Clover');
    expect(searchTitle('BLEACH: Sennen Kessen-hen - Ketsubetsu-tan')).toBe('Bleach');
    expect(searchTitle('Tensei Shitara Slime Datta Ken 4th Season')).toBe('Tensei Shitara Slime Datta Ken');
    expect(searchTitle('SPY×FAMILY Season 3')).toBe('Spy×Family');
    expect(searchTitle('Shingeki no Kyojin: The Final Season Part 2')).toBe('Shingeki No Kyojin');
    expect(searchTitle('Mushoku Tensei II Part 2')).toBe('Mushoku Tensei');
    expect(searchTitle('Hunter x Hunter (2011)')).toBe('Hunter x Hunter');
  });

  it('ne casse pas les titres qui finissent par un nombre ou commencent court', () => {
    expect(searchTitle('Mob Psycho 100')).toBe('Mob Psycho 100');
    expect(searchTitle('Kaiju No. 8')).toBe('Kaiju No. 8');
    expect(searchTitle('86: Eighty Six')).toBe('86: Eighty Six');
    expect(searchTitle('Re:Zero kara Hajimeru Isekai Seikatsu 3rd Season')).toBe('Re:Zero Kara Hajimeru Isekai Seikatsu');
    expect(searchTitle('ONE PIECE')).toBe('One Piece');
  });

  it('met une majuscule en tête de chaque mot', () => {
    expect(searchTitle('black clover')).toBe('Black Clover');
    expect(searchTitle('Dr. STONE')).toBe('Dr. Stone');
  });

  it('la recherche utilise ce titre réduit', () => {
    expect(platformSearchUrl('adn', 'Black Clover 2nd Season')).toBe('https://animationdigitalnetwork.com/video?search=Black%20Clover');
  });
});
