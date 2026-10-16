import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { withOrigin, type MappingOrigin, type MediaMapping } from '../../../shared/sync.types';
import { setLocale } from '../../../i18n';
import type { EpisodeInfo } from '../../../shared/episode.types';
import { mappingKey, seriesKey } from '../../../platforms/series-identity';
import type { AniListMedia } from '../../anilist/media';
import type { MediaCandidate } from './model';

// Prime Video (catalogue généraliste, filtre « anime » par genre côté script de contenu, liens AniList rares) :
// résolution par le titre comme Crunchyroll / ADN pour un anime, titre exact exigé pour l'animation sans piste japonaise.
const storage = vi.hoisted(() => {
  const mock = { getMediaMapping: vi.fn(), saved: vi.fn(), forgotten: vi.fn() };
  // Écritures conditionnelles (voir browser/storage/mappings.ts) relayées aux simulations ci-dessus, origine posée comme saveLearned
  return {
    ...mock,
    saveLearned: vi.fn((key: string, _expected: unknown, mapping: MediaMapping, origin: MappingOrigin = 'learned') => mock.saved(key, withOrigin(mapping, origin))),
    forgetIfUnchanged: vi.fn((key: string) => mock.forgotten(key)),
  };
});
const api = vi.hoisted(() => ({ searchAnime: vi.fn(), getAnimeByIds: vi.fn() }));
vi.mock('../../../browser/storage/mappings', () => storage);
vi.mock('../../anilist/media', () => api);

const { findSeriesSeasons, resolveEpisode } = await import('../resolver');
const { hasExactTitle } = await import('./matching');
const { isPrimeOwnLink, matchPrimeLink, primeAnimeGate, primeOwnIds } = await import('./policies/prime');
const { filtersAnime, isTitleBoundLink, matchPlatformLink, platformLinkVerdict } = await import('./policies/registry');

setLocale('fr');

/** GTI compact de la saison (URL /detail/{id}) et GTI de l'épisode */
const SEASON = '0GMSR5LDQCKJ3B0DQAYCSQIR2W';
const EPISODE_GTI = 'amzn1.dv.gti.0c1b2a3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d';
const OWN_LINK = `https://www.primevideo.com/region/eu/detail/${SEASON}/ref=atv_dp`;
/** Forme la plus fréquente des liens « Amazon Prime Video » d'AniList : ancien ASIN américain */
const OTHER_LINK = 'https://www.amazon.com/dp/B01J776A9O';

function media(overrides: Partial<AniListMedia> & Pick<AniListMedia, 'id' | 'titles'>): AniListMedia {
  return {
    idMal: null,
    format: 'TV',
    episodes: 12,
    startDate: { year: 2019, month: 7, day: 7 },
    displayTitle: overrides.titles[0] ?? '',
    year: 2019,
    coverUrl: null,
    externalLinkUrls: [],
    relations: [],
    ...overrides,
  };
}

/** Épisode Prime Video tel que le produit l'adapter (titre de la série sans mention de version, numérotation par saison) */
function primeEpisode(overrides: Partial<EpisodeInfo> = {}): EpisodeInfo {
  return {
    platform: 'prime',
    episodeId: EPISODE_GTI,
    seriesId: null,
    seriesSlug: null,
    animeTitle: 'Tokyo Ghoul',
    seasonNumber: 1,
    seasonTitle: null,
    seasonEpisodeNumber: 3,
    displayedEpisodeNumber: 3,
    episodeTitle: null,
    url: `https://www.primevideo.com/detail/${SEASON}`,
    primeAnime: 'anime',
    ...overrides,
  };
}

function searchResults(byQuery: Record<string, AniListMedia[]>): void {
  api.searchAnime.mockImplementation((query: string) => Promise.resolve(byQuery[query] ?? []));
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('chrome', {});
  storage.getMediaMapping.mockResolvedValue(null);
  storage.saved.mockResolvedValue(undefined);
  api.getAnimeByIds.mockResolvedValue([]);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('liens AniList Prime Video', () => {
  it('primevideo.com et amazon.<tld> (/detail/, /dp/, /gp/video/detail/, ?gti=) prouvent la présence sur la plateforme', () => {
    expect(matchPrimeLink(OWN_LINK)).toBe('id');
    expect(matchPrimeLink(OTHER_LINK)).toBe('id');
    expect(matchPrimeLink('https://www.amazon.co.jp/gp/video/detail/B07NF1Y4RD/ref=atv_dp')).toBe('id');
    expect(matchPrimeLink(`https://www.amazon.de/gp/video/detail/x?gti=${EPISODE_GTI}`)).toBe('id');
    expect(matchPlatformLink(OTHER_LINK, 'prime', null, null)).toBe('id');
  });

  it('autre site, page sans identifiant, hôte piégé ou URL invalide : aucun lien', () => {
    expect(matchPrimeLink('https://www.netflix.com/title/80987039')).toBeNull();
    expect(matchPrimeLink('https://www.primevideo.com/storefront')).toBeNull();
    expect(matchPrimeLink('https://primevideo.com.evil.example/detail/B01J776A9O')).toBeNull();
    expect(matchPrimeLink('pas une url')).toBeNull();
    // Lien Prime Video sur un épisode d'une autre plateforme : ignoré
    expect(matchPlatformLink(OTHER_LINK, 'crunchyroll', 'GRMG8ZQZR', null)).toBeNull();
  });

  it('identifiants de la page : saison (seriesId ou URL /detail/{id}) et épisode, sous forme canonique', () => {
    expect(primeOwnIds({ seriesId: null, episodeId: EPISODE_GTI.toUpperCase(), url: `https://www.primevideo.com/-/fr/detail/${SEASON.toLowerCase()}/ref=x` })).toEqual([EPISODE_GTI, SEASON]);
    expect(primeOwnIds({ seriesId: SEASON })).toEqual([SEASON]);
    expect(primeOwnIds({ seriesId: null, url: 'pas une url' })).toEqual([]);
    expect(isPrimeOwnLink(OWN_LINK, [SEASON])).toBe(true);
    expect(isPrimeOwnLink(`https://www.amazon.com/gp/video/detail/x?gti=${EPISODE_GTI}`, [EPISODE_GTI])).toBe(true);
    expect(isPrimeOwnLink(OTHER_LINK, [SEASON, EPISODE_GTI])).toBe(false);
  });

  it('lien lié au titre, comme Disney+', () => {
    expect(isTitleBoundLink('prime')).toBe(true);
  });
});

describe('clés Prime Video', () => {
  it('correspondance et série ignorée par titre normalisé ; titre non latin gardé (jamais une clé vide partagée)', () => {
    expect(mappingKey(primeEpisode())).toBe('prime:title:tokyo ghoul:s1');
    expect(mappingKey(primeEpisode({ animeTitle: '東京喰種トーキョーグール', seasonNumber: 2 }))).toBe('prime:title:東京喰種トーキョーグール:s2');
    expect(mappingKey(primeEpisode({ animeTitle: '進撃の巨人' }))).not.toBe(mappingKey(primeEpisode({ animeTitle: '東京喰種' })));
    expect(seriesKey(primeEpisode())).toBe('prime:title:tokyo ghoul');
    expect(seriesKey(primeEpisode({ animeTitle: '進撃の巨人' }))).toBe('prime:title:進撃の巨人');
  });
});

describe('primeAnimeGate', () => {
  const vinland: MediaCandidate = { id: 1, format: 'TV', episodes: 12, startDate: null, titles: ['Vinland Saga', 'VINLAND SAGA Season 2'], link: null };
  const candidates: readonly MediaCandidate[] = [vinland];

  it('anime : ouvert sans condition ; autres plateformes : ouvert', () => {
    expect(primeAnimeGate(primeEpisode({ primeAnime: 'anime', animeTitle: 'Invincible' }), [])).toBe('open');
    expect(primeAnimeGate({ platform: 'crunchyroll', animeTitle: 'Invincible' }, [])).toBe('open');
  });

  it('animation-ja (Secret Level, doublage japonais) : rien trouvé ou rien au titre de la série → ignoré ; titre ou lien → ouvert', () => {
    const secretLevel = primeEpisode({ primeAnime: 'animation-ja', animeTitle: 'Secret Level' });
    expect(primeAnimeGate(secretLevel, [])).toBe('none');
    expect(primeAnimeGate(secretLevel, [{ ...vinland, titles: ['Level E'] }, { ...vinland, id: 2, titles: ['Secret of Mana'] }])).toBe('none');
    // Titre de la série, saison numérotée d'AniList (« Season 2 »), film au titre exact, ou lien Prime Video : résolution normale
    expect(primeAnimeGate(secretLevel, [{ ...vinland, titles: ['SECRET LEVEL'] }])).toBe('open');
    expect(primeAnimeGate(primeEpisode({ primeAnime: 'animation-ja', animeTitle: 'Vinland Saga' }), [{ ...vinland, titles: ['Vinland Saga Season 2'] }])).toBe('open');
    expect(primeAnimeGate(secretLevel, [{ ...vinland, format: 'MOVIE', titles: ['Secret Level'] }])).toBe('open');
    expect(primeAnimeGate(secretLevel, [{ ...vinland, titles: ['Autre titre'], link: 'id' }])).toBe('open');
  });

  it('animation-exact-only : titre ou synonyme exact (casse, ponctuation, accents), sinon ignoré', () => {
    expect(primeAnimeGate(primeEpisode({ primeAnime: 'animation-exact-only', animeTitle: 'Vinland Saga Season 2' }), candidates)).toBe('open');
    expect(primeAnimeGate(primeEpisode({ primeAnime: 'animation-exact-only', animeTitle: 'Vinland Saga Season 3' }), candidates)).toBe('none');
    // Titre au même début (« Season N » d'AniList) : pas exact
    expect(primeAnimeGate(primeEpisode({ primeAnime: 'animation-exact-only', animeTitle: 'Vinland' }), candidates)).toBe('none');
    expect(hasExactTitle({ titles: ['Pokémon'] }, 'POKEMON')).toBe(true);
    expect(hasExactTitle({ titles: ['ヴィンランド・サガ'] }, 'ヴィンランド・サガ')).toBe(true);
    expect(hasExactTitle({ titles: ['進撃の巨人'] }, '東京喰種')).toBe(false);
  });

  it('animation-exact-only : fiche liée à la page Prime Video (lien direct) suffit', () => {
    expect(primeAnimeGate(primeEpisode({ primeAnime: 'animation-exact-only', animeTitle: 'Autre titre' }), [{ ...vinland, link: 'id' }])).toBe('open');
  });

  it('verdict absent (défensif) : ignoré ; série soumise au filtre (verdict mémorisé) hors genre anime seulement', () => {
    expect(primeAnimeGate(primeEpisode({ primeAnime: undefined }), candidates)).toBe('none');
    expect(platformLinkVerdict(primeEpisode({ primeAnime: undefined }), candidates)).toBe('none');
    expect(platformLinkVerdict(primeEpisode({ primeAnime: 'anime' }), [])).toBe('open');
    expect(filtersAnime(primeEpisode({ primeAnime: 'anime' }))).toBe(false);
    // Doublage japonais d'une animation occidentale possible : verdict « série ignorée » mémorisé aussi
    expect(filtersAnime(primeEpisode({ primeAnime: 'animation-ja' }))).toBe(true);
    expect(filtersAnime(primeEpisode({ primeAnime: 'animation-exact-only' }))).toBe(true);
    expect(filtersAnime({ platform: 'netflix' })).toBe(true);
    expect(filtersAnime({ platform: 'crunchyroll' })).toBe(false);
  });
});

describe('resolveEpisode — Prime Video', () => {
  it('genre anime, titre seul (saison 1, une fiche) : comme Crunchyroll, sûre et mise en cache par titre', async () => {
    searchResults({ 'Tokyo Ghoul': [media({ id: 20605, titles: ['Tokyo Ghoul', '東京喰種トーキョーグール'] })] });
    const { result } = await resolveEpisode(primeEpisode());
    expect(result).toMatchObject({ ok: true, target: { mediaId: 20605, progress: 3, confidence: 'high' } });
    expect(storage.saved).toHaveBeenCalledWith('prime:title:tokyo ghoul:s1', expect.objectContaining({ mediaId: 20605 }));
  });

  it('animation + piste japonaise : résolution normale ; saison 2 par le titre « Season 2 » d’AniList', async () => {
    searchResults({
      'Tokyo Ghoul': [
        media({ id: 20605, titles: ['Tokyo Ghoul'], startDate: { year: 2014, month: 7, day: 4 } }),
        media({ id: 20850, titles: ['Tokyo Ghoul √A', 'Tokyo Ghoul Season 2'], startDate: { year: 2015, month: 1, day: 9 } }),
      ],
    });
    const { result } = await resolveEpisode(primeEpisode({ primeAnime: 'animation-ja', seasonNumber: 2 }));
    expect(result).toMatchObject({ ok: true, target: { mediaId: 20850, progress: 3 } });
  });

  it('genre anime, titre seul ambigu (Berserk 1997 / 2016) : à vérifier, raison sans « Crunchyroll / ADN »', async () => {
    searchResults({
      Berserk: [
        media({ id: 33, titles: ['Kenpuu Denki Berserk', 'Berserk'], startDate: { year: 1997, month: 10, day: 8 }, episodes: 25 }),
        media({ id: 21560, titles: ['Berserk'], startDate: { year: 2016, month: 7, day: 1 } }),
      ],
    });
    const { result } = await resolveEpisode(primeEpisode({ animeTitle: 'Berserk', seasonEpisodeNumber: 1, displayedEpisodeNumber: 1 }));
    expect(result).toMatchObject({ ok: true, target: { confidence: 'low' } });
    const reason = result.ok ? result.target.reason : '';
    expect(reason).toContain('Prime Video');
    expect(reason).not.toContain('Crunchyroll');
  });

  it('genre anime, rien trouvé : échec ordinaire (« introuvable »), jamais ignoré', async () => {
    searchResults({});
    const { result } = await resolveEpisode(primeEpisode({ animeTitle: 'Titre inconnu' }));
    expect(result).toMatchObject({ ok: false });
    expect(!result.ok && result.ignored).toBeFalsy();
  });

  it('animation sans piste japonaise, synonyme AniList exact (« Vinland Saga Season 2 ») : suivie', async () => {
    searchResults({
      'VINLAND SAGA Season 2': [
        media({ id: 101348, titles: ['Vinland Saga', 'VINLAND SAGA'], startDate: { year: 2019, month: 7, day: 8 }, episodes: 24 }),
        media({ id: 136430, titles: ['Vinland Saga Season 2', 'VINLAND SAGA SEASON 2'], startDate: { year: 2023, month: 1, day: 10 }, episodes: 24 }),
      ],
    });
    const { result } = await resolveEpisode(primeEpisode({ primeAnime: 'animation-exact-only', animeTitle: 'VINLAND SAGA Season 2', seasonNumber: 1 }));
    expect(result).toMatchObject({ ok: true, target: { mediaId: 136430, progress: 3 } });
  });

  it('animation sans piste japonaise, aucun titre exact (Invincible) : ignorée en silence, même avec une fiche « Season 2 »', async () => {
    searchResults({ Invincible: [media({ id: 999, titles: ['Invincible Season 2'] }), media({ id: 998, titles: ['The Invincible Ones'] })] });
    const { result } = await resolveEpisode(primeEpisode({ primeAnime: 'animation-exact-only', animeTitle: 'Invincible' }));
    expect(result).toMatchObject({ ok: false, ignored: true });
    expect(storage.saved).not.toHaveBeenCalled();
  });

  it('animation + piste japonaise, rien trouvé (Secret Level S1E1, relevé du 2026-10-16) : ignorée en silence, jamais « introuvable »', async () => {
    searchResults({});
    const { result } = await resolveEpisode(primeEpisode({ primeAnime: 'animation-ja', animeTitle: 'Secret Level', seasonEpisodeNumber: 1, displayedEpisodeNumber: 1 }));
    expect(result).toMatchObject({ ok: false, ignored: true });
    expect(storage.saved).not.toHaveBeenCalled();
  });

  it('animation + piste japonaise, résultats sans le titre de la série : ignorée en silence', async () => {
    searchResults({ 'Secret Level': [media({ id: 5001, titles: ['Level E'] }), media({ id: 5002, titles: ['Secret of Mana'] })] });
    const { result } = await resolveEpisode(primeEpisode({ primeAnime: 'animation-ja', animeTitle: 'Secret Level', seasonEpisodeNumber: 1, displayedEpisodeNumber: 1 }));
    expect(result).toMatchObject({ ok: false, ignored: true });
    expect(storage.saved).not.toHaveBeenCalled();
  });

  it('verdict absent (défensif) : ignoré sans aucune recherche', async () => {
    const { result } = await resolveEpisode(primeEpisode({ primeAnime: undefined }));
    expect(result).toMatchObject({ ok: false, ignored: true });
    expect(api.searchAnime).not.toHaveBeenCalled();
  });

  it('lien AniList vers la page de la saison elle-même : certaine, quel que soit le titre de la fiche', async () => {
    searchResults({ 'Tokyo Ghoul': [media({ id: 20605, titles: ['Toukyou Kushu'], externalLinkUrls: [OWN_LINK] }), media({ id: 1, titles: ['Tokyo Ghoul:re'] })] });
    const { result } = await resolveEpisode(primeEpisode({ primeAnime: 'animation-exact-only' }));
    expect(result).toMatchObject({ ok: true, target: { mediaId: 20605, progress: 3, confidence: 'high' } });
  });

  it('autre identifiant Prime Video + titre de la série : lien retenu ; sans le titre : aucun lien', async () => {
    searchResults({
      'Tokyo Ghoul': [
        media({ id: 20605, titles: ['Tokyo Ghoul'], externalLinkUrls: [OTHER_LINK], startDate: { year: 2014, month: 7, day: 4 } }),
        media({ id: 20850, titles: ['Tokyo Ghoul √A'], externalLinkUrls: ['https://www.amazon.com/dp/B00TFIB0TE'], startDate: { year: 2015, month: 1, day: 9 } }),
      ],
    });
    const { result, seasons } = await resolveEpisode(primeEpisode());
    expect(result).toMatchObject({ ok: true, target: { mediaId: 20605, confidence: 'high' } });
    // √A : lié à Prime Video mais d'un autre titre, ni suite déclarée : pas une saison de la série
    expect(seasons.map((s) => s.id)).toEqual([20605]);
    const { candidates } = await findSeriesSeasons(primeEpisode());
    expect(candidates.map((c) => [c.id, c.link])).toEqual([[20605, 'platform'], [20850, null]]);
  });

  it('page de série : lien vers son GTI compact certain sans condition de titre', async () => {
    searchResults({ 'Tokyo Ghoul': [media({ id: 20605, titles: ['Toukyou Kushu'], externalLinkUrls: [OWN_LINK] }), media({ id: 20850, titles: ['Kushu'], externalLinkUrls: [OTHER_LINK] })] });
    const { candidates } = await findSeriesSeasons({ platform: 'prime', seriesId: SEASON, seriesSlug: null, animeTitle: 'Tokyo Ghoul', seasonTitle: null });
    expect(candidates.map((c) => [c.id, c.link])).toEqual([[20605, 'id'], [20850, null]]);
  });

  it('suite d’une fiche liée, présente seulement sur Crunchyroll : reste une saison par relation (absence de lien Prime non probante)', async () => {
    searchResults({
      'Tokyo Ghoul': [
        media({ id: 20605, titles: ['Tokyo Ghoul'], externalLinkUrls: [OWN_LINK], startDate: { year: 2014, month: 7, day: 4 }, relations: [{ id: 20850, type: 'ANIME', relationType: 'SEQUEL', format: 'TV' }] }),
        media({ id: 20850, titles: ['Tokyo Ghoul √A'], externalLinkUrls: ['https://www.crunchyroll.com/series/GR0X8V0VY'], startDate: { year: 2015, month: 1, day: 9 } }),
      ],
    });
    const { result } = await resolveEpisode(primeEpisode({ seasonNumber: 2, url: 'https://www.primevideo.com/detail/0ABCDEFGHIJKLMNOPQRSTUVWXY' }));
    expect(result).toMatchObject({ ok: true, target: { mediaId: 20850, progress: 3 } });
  });
});

describe('remakes au même titre liés chacun à Prime Video (audit H2)', () => {
  // Deux franchises sans relation entre elles : un lien Prime Video au titre de la série ne prouve que la présence sur la plateforme
  const remakes = (): void =>
    searchResults({
      Foo: [
        media({ id: 1, titles: ['Foo'], episodes: 25, startDate: { year: 1997, month: 10, day: 8 }, externalLinkUrls: ['https://www.amazon.com/dp/B0AAAAAAA1'] }),
        media({ id: 2, titles: ['Foo'], episodes: 12, startDate: { year: 2016, month: 7, day: 1 }, externalLinkUrls: ['https://www.amazon.com/dp/B0BBBBBBB2'] }),
      ],
    });

  it('sans signal : à vérifier, jamais mis en cache', async () => {
    remakes();
    const { result } = await resolveEpisode(primeEpisode({ animeTitle: 'Foo', seasonNumber: 1 }));
    expect(result).toMatchObject({ ok: true, target: { mediaId: 1, progress: 3, confidence: 'low' } });
    expect(storage.saved).not.toHaveBeenCalled();
  });

  it('année de la saison : le remake prouvé par les signaux, synchronisé', async () => {
    remakes();
    const { result } = await resolveEpisode(primeEpisode({ animeTitle: 'Foo', seasonNumber: 1, signals: { seasonYear: 2016 } }));
    expect(result).toMatchObject({ ok: true, target: { mediaId: 2, progress: 3, confidence: 'high', bySignals: true } });
    expect(storage.saved).toHaveBeenCalledWith('prime:title:foo:y2016:s1', expect.objectContaining({ mediaId: 2, learned: true }));
  });

  it('une seule franchise (suite déclarée) liée en plusieurs saisons : inchangé, fiable', async () => {
    searchResults({
      Foo: [
        media({ id: 1, titles: ['Foo'], externalLinkUrls: ['https://www.amazon.com/dp/B0AAAAAAA1'], relations: [{ id: 2, type: 'ANIME', relationType: 'SEQUEL', format: 'TV' }] }),
        media({ id: 2, titles: ['Foo'], startDate: { year: 2021, month: 1, day: 1 }, externalLinkUrls: ['https://www.amazon.com/dp/B0BBBBBBB2'], relations: [{ id: 1, type: 'ANIME', relationType: 'PREQUEL', format: 'TV' }] }),
      ],
    });
    const { result } = await resolveEpisode(primeEpisode({ animeTitle: 'Foo', seasonNumber: 2 }));
    expect(result).toMatchObject({ ok: true, target: { mediaId: 2, progress: 3, confidence: 'high' } });
  });
});
