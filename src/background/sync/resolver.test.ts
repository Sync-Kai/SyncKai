import { beforeEach, describe, expect, it, vi } from 'vitest';
import { setLocale } from '../../i18n';
import type { EpisodeInfo } from '../../shared/episode.types';
import type { AniListMedia } from '../api/media';

// Mise en cache des correspondances selon le filtre Netflix (stockage et API AniList simulés).
const storage = vi.hoisted(() => ({
  getMediaMapping: vi.fn(),
  saveMediaMapping: vi.fn(),
  deleteMediaMapping: vi.fn(),
}));
const api = vi.hoisted(() => ({ searchAnime: vi.fn(), getAnimeByIds: vi.fn() }));

vi.mock('../../shared/storage', () => storage);
vi.mock('../api/media', () => api);

const { resolveEpisode } = await import('./resolver');

setLocale('fr');

const SHOW_ID = '80987039';

function media(overrides: Partial<AniListMedia> & Pick<AniListMedia, 'id' | 'titles'>): AniListMedia {
  return {
    idMal: null,
    format: 'TV',
    episodes: 12,
    startDate: { year: 2021, month: 1, day: 11 },
    displayTitle: overrides.titles[0] ?? '',
    year: 2021,
    coverUrl: null,
    externalLinkUrls: [],
    relations: [],
    ...overrides,
  };
}

function netflixEpisode(overrides: Partial<EpisodeInfo> = {}): EpisodeInfo {
  return {
    platform: 'netflix',
    episodeId: '81402901',
    seriesId: SHOW_ID,
    seriesSlug: null,
    animeTitle: 'Frieren',
    seasonNumber: 1,
    seasonTitle: null,
    seasonEpisodeNumber: 3,
    displayedEpisodeNumber: 3,
    episodeTitle: null,
    url: 'https://www.netflix.com/watch/81402901',
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  storage.getMediaMapping.mockResolvedValue(null);
  storage.saveMediaMapping.mockResolvedValue(undefined);
  api.getAnimeByIds.mockResolvedValue([]);
});

describe('resolveEpisode — Netflix', () => {
  it('fiche liée à /title/{showId} : correspondance sûre, mise en cache', async () => {
    api.searchAnime.mockResolvedValue([media({ id: 154587, titles: ['Sousou no Frieren', 'Frieren'], externalLinkUrls: [`https://www.netflix.com/be-fr/title/${SHOW_ID}`] })]);
    const { result } = await resolveEpisode(netflixEpisode());
    expect(result).toMatchObject({ ok: true, target: { mediaId: 154587, progress: 3, confidence: 'high' } });
    expect(storage.saveMediaMapping).toHaveBeenCalledWith(`netflix:${SHOW_ID}:s1`, expect.objectContaining({ mediaId: 154587 }));
  });

  it('titre seul (même titre, aucun lien Netflix) : à vérifier, jamais mis en cache', async () => {
    api.searchAnime.mockResolvedValue([media({ id: 154587, titles: ['Sousou no Frieren', 'Frieren'], externalLinkUrls: ['https://www.crunchyroll.com/series/GG5H5XQX4'] })]);
    const { result } = await resolveEpisode(netflixEpisode());
    expect(result).toMatchObject({ ok: true, target: { mediaId: 154587, confidence: 'low' } });
    expect(storage.saveMediaMapping).not.toHaveBeenCalled();
  });

  it('ni lien ni titre identique : série ignorée, rien en cache', async () => {
    api.searchAnime.mockResolvedValue([media({ id: 1, titles: ['Wednesday Addams Special'] })]);
    const { result } = await resolveEpisode(netflixEpisode({ animeTitle: 'Wednesday' }));
    expect(result).toMatchObject({ ok: false, ignored: true });
    expect(storage.saveMediaMapping).not.toHaveBeenCalled();
  });

  it('Crunchyroll : titre seul fiable (saison 1) toujours mis en cache', async () => {
    api.searchAnime.mockResolvedValue([media({ id: 154587, titles: ['Frieren'] })]);
    const { result } = await resolveEpisode(netflixEpisode({ platform: 'crunchyroll', seriesId: 'GG5H5XQX4' }));
    expect(result).toMatchObject({ ok: true, target: { mediaId: 154587, confidence: 'high' } });
    expect(storage.saveMediaMapping).toHaveBeenCalledOnce();
  });
});
