import { beforeEach, describe, expect, it, vi } from 'vitest';
import { setLocale } from '../../i18n';
import type { EpisodeInfo } from '../../shared/episode.types';
import type { MediaMapping } from '../../shared/sync.types';
import type { AniListMedia } from '../api/media';

// Signaux de la plateforme dans la résolution : clé de cache avec l'année, correspondance apprise contredite, preuve
// exigée pour une correspondance par le titre seul (stockage et API AniList simulés).
const storage = vi.hoisted(() => ({ getMediaMapping: vi.fn(), saveMediaMapping: vi.fn(), deleteMediaMapping: vi.fn() }));
const api = vi.hoisted(() => ({ searchAnime: vi.fn(), getAnimeByIds: vi.fn() }));
vi.mock('../../shared/storage', () => storage);
vi.mock('../api/media', () => api);

const { resolveEpisode } = await import('./resolver');
const { mappingKey } = await import('./matching');
const { rememberedSeason } = await import('../page-media-rules');

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
  storage.saveMediaMapping.mockResolvedValue(undefined);
  storage.deleteMediaMapping.mockResolvedValue(undefined);
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
    expect(storage.saveMediaMapping).not.toHaveBeenCalled();
  });

  it('année de la saison concordante : fiable, raison des signaux, correspondance apprise', async () => {
    const { result } = await resolveEpisode(adnEpisode({ signals: { seasonYear: 2025 } }));
    expect(result.ok && result.target).toMatchObject({ mediaId: 177474, confidence: 'high', reason: 'Matches the platform: release year' });
    expect(storage.saveMediaMapping).toHaveBeenCalledWith('adn:1311:s1', expect.objectContaining({ mediaId: 177474, learned: true }));
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

describe('correspondance en cache contredite par les signaux', () => {
  const stored: MediaMapping = { mediaId: 999, numbering: 'season', offset: 0, episodes: 12 };
  const wrong = media({ id: 999, titles: ['Other'], startDate: { year: 2010, month: 1, day: 1 } });

  it('apprise automatiquement : oubliée, nouvelle résolution', async () => {
    storage.getMediaMapping.mockResolvedValue({ ...stored, learned: true });
    api.getAnimeByIds.mockResolvedValue([wrong]);
    const { result } = await resolveEpisode(adnEpisode({ signals: { seasonYear: 2025 } }));
    expect(storage.deleteMediaMapping).toHaveBeenCalledWith('adn:1311:s1');
    expect(result.ok && result.target).toMatchObject({ mediaId: 177474, confidence: 'high' });
  });

  it('choisie par l’utilisateur (sans `learned`) : gardée, sans requête', async () => {
    storage.getMediaMapping.mockResolvedValue(stored);
    const { result } = await resolveEpisode(adnEpisode({ signals: { seasonYear: 2025 } }));
    expect(api.getAnimeByIds).not.toHaveBeenCalled();
    expect(result.ok && result.target).toMatchObject({ mediaId: 999, fromCache: true });
  });

  it('apprise et concordante : gardée', async () => {
    storage.getMediaMapping.mockResolvedValue({ ...stored, mediaId: 177474, learned: true });
    api.getAnimeByIds.mockResolvedValue([TOUGEN]);
    const { result } = await resolveEpisode(adnEpisode({ signals: { seasonYear: 2025 } }));
    expect(storage.deleteMediaMapping).not.toHaveBeenCalled();
    expect(result.ok && result.target).toMatchObject({ mediaId: 177474, fromCache: true });
  });
});
