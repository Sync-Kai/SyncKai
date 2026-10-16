import { beforeEach, describe, expect, it, vi } from 'vitest';
import { setLocale } from '../../../i18n';
import type { EpisodeInfo } from '../../../shared/episode.types';
import { withOrigin, type MappingOrigin, type MediaMapping } from '../../../shared/sync.types';
import type { AniListMedia } from '../../anilist/media';
import type { Catalog } from '../../ports/catalog';

// Signaux de la plateforme dans la résolution : clé de cache avec l'année, correspondance apprise contredite, preuve
// exigée pour une correspondance par le titre seul (stockage et API AniList simulés).
const storage = vi.hoisted(() => {
  const mock = { getMediaMapping: vi.fn(), saved: vi.fn(), forgotten: vi.fn() };
  // Écritures conditionnelles (voir browser/storage/mappings.ts) relayées aux simulations ci-dessus, origine posée comme saveLearned
  return {
    ...mock,
    saveLearned: vi.fn((key: string, _expected: unknown, mapping: MediaMapping, origin: MappingOrigin = 'learned') => mock.saved(key, withOrigin(mapping, origin))),
    forgetIfUnchanged: vi.fn((key: string) => mock.forgotten(key)),
  };
});
vi.mock('../../../browser/storage/mappings', () => storage);

/** Faux catalogue (port Catalog, voir ports/catalog.ts) passé à la résolution, sans simuler le module AniList */
const api = { searchAnime: vi.fn<Catalog['search']>(), getAnimeByIds: vi.fn<Catalog['byIds']>() };
const catalog: Catalog = { search: api.searchAnime, byIds: api.getAnimeByIds, searchBatch: () => Promise.reject(new Error('aucune recherche groupée ici')) };

const resolver = await import('../resolver');
const resolveEpisode = (episode: EpisodeInfo, options?: Parameters<typeof resolver.resolveEpisode>[1]): ReturnType<typeof resolver.resolveEpisode> => resolver.resolveEpisode(episode, options, catalog);
const { mappingKey } = await import('../../../platforms/series-identity');
const { rememberedSeason } = await import('../../page-media/page-media-rules');

setLocale('en');

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
    duration: 24,
    countryOfOrigin: 'JP',
    status: 'FINISHED',
    endDate: null,
    ...overrides,
  };
}

/** ADN : aucune fiche liée, résolution par le titre */
function adnEpisode(overrides: Partial<EpisodeInfo> = {}): EpisodeInfo {
  return {
    platform: 'adn',
    episodeId: '29348',
    seriesId: '1311',
    seriesSlug: 'tougen-anki',
    animeTitle: 'TOUGEN ANKI',
    seasonNumber: 1,
    seasonTitle: null,
    seasonEpisodeNumber: 5,
    displayedEpisodeNumber: 5,
    episodeTitle: null,
    url: 'https://animationdigitalnetwork.com/video/1311-tougen-anki/29348',
    ...overrides,
  };
}

const TOUGEN = media({ id: 177474, titles: ['Tougen Anki', 'TOUGEN ANKI'], episodes: 24, startDate: { year: 2025, month: 7, day: 11 } });

beforeEach(() => {
  vi.clearAllMocks();
  storage.getMediaMapping.mockResolvedValue(null);
  storage.saved.mockResolvedValue(undefined);
  storage.forgotten.mockResolvedValue(undefined);
  api.searchAnime.mockResolvedValue([TOUGEN]);
  api.getAnimeByIds.mockResolvedValue([]);
});

describe('mappingKey et année de la saison', () => {
  it('clé par titre (Prime Video, Disney+) : année de la saison quand elle est connue ; identifiant de série : inchangée', () => {
    expect(mappingKey({ platform: 'prime', seriesId: null, animeTitle: 'Berserk', seasonNumber: 1, signals: { seasonYear: 2016 } })).toBe('prime:title:berserk:y2016:s1');
    expect(mappingKey({ platform: 'prime', seriesId: null, animeTitle: 'Berserk', seasonNumber: 1, signals: { episodeMinutes: 24 } })).toBe('prime:title:berserk:s1');
    expect(mappingKey({ platform: 'netflix', seriesId: '80987039', animeTitle: 'Mushoku', seasonNumber: 2, signals: { seasonYear: 2023 } })).toBe('netflix:80987039:s2');
  });

  it('rememberedSeason : correspondance de l’année d’abord, clés avec année lues pour la dernière saison', () => {
    const mapping = (mediaId: number): MediaMapping => ({ mediaId, numbering: 'season', offset: 0, episodes: 12 });
    const mappings = { 'prime:title:berserk:y1997:s1': mapping(33), 'prime:title:berserk:y2016:s1': mapping(21560), 'prime:title:berserk:y2017:s2': mapping(97643) };
    expect(rememberedSeason(mappings, 'prime:title:berserk:', 1, 2016)).toEqual({ mediaId: 21560, exact: true });
    expect(rememberedSeason(mappings, 'prime:title:berserk:', null)).toEqual({ mediaId: 97643, exact: false });
  });
});

describe('preuve exigée pour le titre seul', () => {
  it('sans signal : saison 1 au titre seul fiable (comportement d’avant)', async () => {
    const { result } = await resolveEpisode(adnEpisode());
    expect(result.ok && result.target).toMatchObject({ mediaId: 177474, confidence: 'high' });
  });

  it('signal comparable qui ne prouve rien (durée seule) : à vérifier, jamais mis en cache', async () => {
    const { result } = await resolveEpisode(adnEpisode({ signals: { episodeMinutes: 24 } }));
    expect(result.ok && result.target).toMatchObject({ mediaId: 177474, confidence: 'low' });
    expect(storage.saved).not.toHaveBeenCalled();
  });

  it('année de la saison concordante : fiable, raison des signaux, correspondance apprise', async () => {
    const { result } = await resolveEpisode(adnEpisode({ signals: { seasonYear: 2025 } }));
    expect(result.ok && result.target).toMatchObject({ mediaId: 177474, confidence: 'high', reason: 'Matches the platform: release year' });
    expect(storage.saved).toHaveBeenCalledWith('adn:1311:s1', expect.objectContaining({ mediaId: 177474, learned: true }));
  });

  it('année contradictoire (seule fiche) : à vérifier, signal nommé', async () => {
    const { result } = await resolveEpisode(adnEpisode({ signals: { seasonYear: 2019 } }));
    expect(result.ok && result.target).toMatchObject({ mediaId: 177474, confidence: 'low', reason: 'Doesn’t match the platform: release year' });
  });

  it('signal sans donnée AniList (pays inconnu) : comportement d’avant', async () => {
    api.searchAnime.mockResolvedValue([{ ...TOUGEN, countryOfOrigin: null }]);
    const { result } = await resolveEpisode(adnEpisode({ signals: { country: 'JP' } }));
    expect(result.ok && result.target).toMatchObject({ mediaId: 177474, confidence: 'high' });
  });
});

describe('signaux du seul pont de la page (SEC-01, décision 1) : jamais seuls à rendre sûr un titre seul', () => {
  /** Remakes au même titre, aucun lien vers la plateforme : sans signal, à vérifier (deux franchises) */
  const BERSERK_1997 = media({ id: 33, titles: ['Berserk'], episodes: 25, startDate: { year: 1997, month: 10, day: 8 } });
  const BERSERK_2016 = media({ id: 21560, titles: ['Berserk'], episodes: 12, startDate: { year: 2016, month: 7, day: 1 } });
  const crEpisode = (overrides: Partial<EpisodeInfo> = {}): EpisodeInfo =>
    adnEpisode({ platform: 'crunchyroll', episodeId: 'GBERSERK3', seriesId: 'GBERSERK', seriesSlug: 'berserk', animeTitle: 'Berserk', seasonEpisodeNumber: 3, displayedEpisodeNumber: 3, url: 'https://www.crunchyroll.com/watch/GBERSERK3', ...overrides });

  it('sans signal : à vérifier (comportement d’avant)', async () => {
    api.searchAnime.mockResolvedValue([BERSERK_1997, BERSERK_2016]);
    const { result } = await resolveEpisode(crEpisode());
    expect(result.ok && result.target).toMatchObject({ confidence: 'low' });
  });

  it('Crunchyroll : année de la saison (pont MAIN) qui désigne un remake → fiche proposée, mais à vérifier, jamais mise en cache', async () => {
    api.searchAnime.mockResolvedValue([BERSERK_1997, BERSERK_2016]);
    const { result } = await resolveEpisode(crEpisode({ signals: { seasonYear: 2016, seasonEpisodeCount: 12 } }));
    expect(result.ok && result.target).toMatchObject({ mediaId: 21560, confidence: 'low' });
    expect(storage.saved).not.toHaveBeenCalled();
  });

  it('Prime Video (pont MAIN) : même règle', async () => {
    api.searchAnime.mockResolvedValue([BERSERK_1997, BERSERK_2016]);
    const prime = crEpisode({ platform: 'prime', seriesId: null, seriesSlug: null, url: 'https://www.primevideo.com/detail/0ABC', primeAnime: 'anime', signals: { seasonYear: 2016, seasonEpisodeCount: 12 } });
    const { result } = await resolveEpisode(prime);
    expect(result.ok && result.target).toMatchObject({ mediaId: 21560, confidence: 'low' });
  });

  it('Netflix et Disney+ (pont MAIN, lien AniList exigé) : déjà garanti par la porte des liens, titre seul à vérifier', async () => {
    api.searchAnime.mockResolvedValue([BERSERK_1997, BERSERK_2016]);
    for (const platform of ['netflix', 'disney'] as const) {
      const { result } = await resolveEpisode(crEpisode({ platform, seriesId: platform === 'netflix' ? '80000001' : null, url: `https://www.${platform === 'netflix' ? 'netflix' : 'disneyplus'}.com/watch/1`, signals: { seasonYear: 2016, seasonEpisodeCount: 12 } }));
      expect(result.ok && result.target, platform).toMatchObject({ mediaId: 21560, confidence: 'low' });
    }
    expect(storage.saved).not.toHaveBeenCalled();
  });

  it('ADN (signaux du JSON-LD de la page, pas d’un pont) : la preuve vaut toujours', async () => {
    api.searchAnime.mockResolvedValue([BERSERK_1997, BERSERK_2016]);
    const { result } = await resolveEpisode(crEpisode({ platform: 'adn', seriesId: '1311', url: 'https://animationdigitalnetwork.com/video/1311-berserk/29348', signals: { seasonYear: 2016, seasonEpisodeCount: 12 } }));
    expect(result.ok && result.target).toMatchObject({ mediaId: 21560, confidence: 'high' });
  });

  it('Crunchyroll : fiche liée à la série sur AniList (preuve hors de la page) : sûre, les signaux départagent', async () => {
    const linked = { ...BERSERK_2016, externalLinkUrls: ['https://www.crunchyroll.com/series/GBERSERK/berserk'] };
    api.searchAnime.mockResolvedValue([BERSERK_1997, linked]);
    const { result } = await resolveEpisode(crEpisode({ signals: { seasonYear: 2016, seasonEpisodeCount: 12 } }));
    expect(result.ok && result.target).toMatchObject({ mediaId: 21560, confidence: 'high' });
  });

  it('Crunchyroll : titre seul déjà sûr sans les signaux (fiche unique, saison 1) et signaux concordants : sûr', async () => {
    api.searchAnime.mockResolvedValue([TOUGEN]);
    const { result } = await resolveEpisode(crEpisode({ animeTitle: 'TOUGEN ANKI', seriesSlug: 'tougen-anki', signals: { seasonYear: 2025 } }));
    expect(result.ok && result.target).toMatchObject({ mediaId: 177474, confidence: 'high' });
  });
});

describe('correspondance en cache contredite par les signaux', () => {
  const stored: MediaMapping = { mediaId: 999, numbering: 'season', offset: 0, episodes: 12 };
  const wrong = media({ id: 999, titles: ['Other'], startDate: { year: 2010, month: 1, day: 1 } });

  it('apprise automatiquement : oubliée, nouvelle résolution', async () => {
    storage.getMediaMapping.mockResolvedValue({ ...stored, learned: true });
    api.getAnimeByIds.mockResolvedValue([wrong]);
    const { result } = await resolveEpisode(adnEpisode({ signals: { seasonYear: 2025 } }));
    expect(storage.forgotten).toHaveBeenCalledWith('adn:1311:s1');
    expect(result.ok && result.target).toMatchObject({ mediaId: 177474, confidence: 'high' });
  });

  it('choisie par l’utilisateur (`chosen`) : gardée, sans requête', async () => {
    storage.getMediaMapping.mockResolvedValue({ ...stored, chosen: true });
    const { result } = await resolveEpisode(adnEpisode({ signals: { seasonYear: 2025 } }));
    expect(api.getAnimeByIds).not.toHaveBeenCalled();
    expect(result.ok && result.target).toMatchObject({ mediaId: 999, confidence: 'high', fromCache: true });
  });

  it('origine inconnue (ni `learned` ni `chosen`) : gardée en cache, à vérifier, fiche prouvée proposée', async () => {
    storage.getMediaMapping.mockResolvedValue(stored);
    api.getAnimeByIds.mockResolvedValue([wrong]);
    const { result, candidates } = await resolveEpisode(adnEpisode({ signals: { seasonYear: 2025 } }));
    expect(result.ok && result.target).toMatchObject({ mediaId: 177474, progress: 5, confidence: 'low', reason: 'Saved match contradicted by the platform: release year' });
    expect(result.ok && result.target.fromCache).toBeFalsy();
    // Fiche proposée d'abord, fiche en cache toujours sélectionnable
    expect(candidates.map((c) => c.id)).toEqual([177474, 999]);
    expect(storage.forgotten).not.toHaveBeenCalled();
    expect(storage.saved).not.toHaveBeenCalled();
  });

  it('origine inconnue contredite sans fiche prouvée : fiche en cache proposée, à vérifier', async () => {
    storage.getMediaMapping.mockResolvedValue(stored);
    api.getAnimeByIds.mockResolvedValue([wrong]);
    api.searchAnime.mockResolvedValue([]);
    const { result } = await resolveEpisode(adnEpisode({ signals: { seasonYear: 2025 } }));
    expect(result.ok && result.target).toMatchObject({ mediaId: 999, progress: 5, confidence: 'low' });
    expect(storage.forgotten).not.toHaveBeenCalled();
  });

  it('origine inconnue et concordante : gardée, fiable', async () => {
    storage.getMediaMapping.mockResolvedValue({ ...stored, mediaId: 177474 });
    api.getAnimeByIds.mockResolvedValue([TOUGEN]);
    const { result } = await resolveEpisode(adnEpisode({ signals: { seasonYear: 2025 } }));
    expect(result.ok && result.target).toMatchObject({ mediaId: 177474, confidence: 'high', fromCache: true });
    expect(api.searchAnime).not.toHaveBeenCalled();
  });

  it('apprise et concordante : gardée', async () => {
    storage.getMediaMapping.mockResolvedValue({ ...stored, mediaId: 177474, learned: true });
    api.getAnimeByIds.mockResolvedValue([TOUGEN]);
    const { result } = await resolveEpisode(adnEpisode({ signals: { seasonYear: 2025 } }));
    expect(storage.forgotten).not.toHaveBeenCalled();
    expect(result.ok && result.target).toMatchObject({ mediaId: 177474, fromCache: true });
  });
});
