import { beforeEach, describe, expect, it, vi } from 'vitest';
import { setLocale } from '../../i18n';
import type { EpisodeInfo } from '../../shared/episode.types';
import type { AniListMedia } from '../anilist/media';
import {
  AOT_SEASON_IDS,
  AOT_SERIES,
  ATTACK_ON_TITAN_SEARCH,
  FINAL_CHAPTERS_SPECIALS,
  FINAL_SEASON_PART_2,
  LAST_ATTACK_MOVIE,
  LAST_ATTACK_MOVIE_ID,
  LAST_ATTACK_SEASON,
} from './__fixtures__/attack-on-titan-search';

// Saison nommée d'une page Crunchyroll qui désigne un film publié dans la série (Attack on Titan « Last Attack »),
// sur les résultats AniList réels (voir __fixtures__/attack-on-titan-search.ts).
const storage = vi.hoisted(() => {
  const mock = { getMediaMapping: vi.fn(), saveMediaMapping: vi.fn(), deleteMediaMapping: vi.fn() };
  // Écritures conditionnelles (voir browser/storage/mappings.ts) relayées aux simulations ci-dessus
  return { ...mock, saveMediaMappingIf: vi.fn((key: string, _expected: unknown, next: unknown) => mock.saveMediaMapping(key, next)), deleteMediaMappingIf: vi.fn((key: string) => mock.deleteMediaMapping(key)) };
});
const api = vi.hoisted(() => ({ searchAnime: vi.fn(), getAnimeByIds: vi.fn() }));
vi.mock('../../browser/storage/mappings', () => storage);
vi.mock('../anilist/media', () => api);

const { findSeriesSeasons, resolveEpisode } = await import('./resolver');
const { isUnmatchedNamedSeason, resolveTarget } = await import('./matching');

setLocale('fr');

/** Recherches AniList : titre de la série → 20 résultats réels ; « série + saison » → `bySeason` (réel : aucun) */
function searchResults(bySeason: AniListMedia[]): void {
  api.searchAnime.mockImplementation(async (search: string) => (search === AOT_SERIES.animeTitle ? ATTACK_ON_TITAN_SEARCH : search === LAST_ATTACK_SEASON ? bySeason : []));
}

const seriesQuery = { platform: 'crunchyroll', ...AOT_SERIES, seasonTitle: LAST_ATTACK_SEASON } as const;

/** Même appel que la page de série (page-media.ts › pickSeriesSeason) : premier épisode de la saison nommée */
const seriesPageNumbers = { animeTitle: AOT_SERIES.animeTitle, seasonTitle: LAST_ATTACK_SEASON, seasonNumber: null, seasonEpisodeNumber: 1, displayedEpisodeNumber: 1 };

/** Page de lecture de l'épisode unique de la saison (numéro de saison Crunchyroll non relevé : plusieurs valeurs testées) */
const lastAttackEpisode = (seasonNumber: number | null): EpisodeInfo => ({
  platform: 'crunchyroll',
  episodeId: 'GLASTATK1',
  ...AOT_SERIES,
  seasonNumber,
  seasonTitle: LAST_ATTACK_SEASON,
  seasonEpisodeNumber: 1,
  displayedEpisodeNumber: 1,
  episodeTitle: 'Attack on Titan: The Last Attack',
  url: 'https://www.crunchyroll.com/watch/GLASTATK1/attack-on-titan-the-last-attack',
});

beforeEach(() => {
  vi.clearAllMocks();
  storage.getMediaMapping.mockResolvedValue(null);
  storage.saveMediaMapping.mockResolvedValue(undefined);
  api.getAnimeByIds.mockResolvedValue([]);
});

describe('Attack on Titan, saison Crunchyroll « Attack on Titan: Last Attack » — données AniList réelles (aucune fiche du film)', () => {
  beforeEach(() => searchResults([]));

  it('recherche : 2 requêtes (série, série + saison), saisons liées, spéciaux THE FINAL CHAPTERS rattachés par relation', async () => {
    const { candidates, seasons } = await findSeriesSeasons(seriesQuery);
    expect(api.searchAnime.mock.calls.map(([search]: unknown[]) => search)).toEqual([AOT_SERIES.animeTitle, LAST_ATTACK_SEASON]);
    expect(api.getAnimeByIds).not.toHaveBeenCalled();
    expect(seasons.map((m) => m.id)).toEqual([...AOT_SEASON_IDS]);
    const linkOf = (id: number): string | null | undefined => candidates.find((c) => c.id === id)?.link;
    expect(linkOf(FINAL_SEASON_PART_2)).toBe('id');
    expect(FINAL_CHAPTERS_SPECIALS.map(linkOf)).toEqual(['relation', 'relation']);
    // Films et Junior High : anciennes pages Crunchyroll d'autres séries
    expect([linkOf(119113), linkOf(21281)]).toEqual(['other-slug', 'other-slug']);
  });

  it('page de série : aucune fiche désignée par la saison (ni « Final Season Part 2 », ni un spécial)', async () => {
    const { candidates } = await findSeriesSeasons(seriesQuery);
    expect(resolveTarget(seriesPageNumbers, candidates)).toMatchObject({ ok: false });
    const partTwo = candidates.find((c) => c.id === FINAL_SEASON_PART_2);
    expect(partTwo && isUnmatchedNamedSeason({ ...seriesPageNumbers }, partTwo)).toBe(true);
  });

  it('page de lecture du film : jamais de confiance haute ni de correspondance enregistrée, quel que soit le numéro de saison', async () => {
    for (const seasonNumber of [null, 0, 1, 4, 5, 6, 7, 8, 9]) {
      const { result } = await resolveEpisode(lastAttackEpisode(seasonNumber));
      expect(result, `saison ${String(seasonNumber)}`).not.toMatchObject({ ok: true, target: { confidence: 'high' } });
    }
    expect(storage.saveMediaMapping).not.toHaveBeenCalled();
  });
});

describe('Attack on Titan « Last Attack » — fiche du film présente (fiche fictive, titre « Attack on Titan: THE LAST ATTACK »)', () => {
  beforeEach(() => searchResults([LAST_ATTACK_MOVIE, ...ATTACK_ON_TITAN_SEARCH.slice(0, 3)]));

  it('page de série : le film, certain (titre « série + saison » à l’article près), malgré les exclusions par ancien slug', async () => {
    const { candidates, seasons } = await findSeriesSeasons(seriesQuery);
    expect(seasons.map((m) => m.id)).toEqual([...AOT_SEASON_IDS]);
    expect(resolveTarget(seriesPageNumbers, candidates)).toMatchObject({ ok: true, target: { mediaId: LAST_ATTACK_MOVIE_ID, progress: 1, confidence: 'high' } });
    expect(isUnmatchedNamedSeason(seriesPageNumbers, LAST_ATTACK_MOVIE)).toBe(false);
  });

  it('page de lecture : même fiche, épisode 1, correspondance enregistrée (cohérent avec la page de série)', async () => {
    for (const seasonNumber of [null, 7]) {
      const { result } = await resolveEpisode(lastAttackEpisode(seasonNumber));
      expect(result).toMatchObject({ ok: true, target: { mediaId: LAST_ATTACK_MOVIE_ID, progress: 1, confidence: 'high' } });
    }
    expect(storage.saveMediaMapping).toHaveBeenCalledWith(expect.stringMatching(/^crunchyroll:GR751KNZY:s/), expect.objectContaining({ mediaId: LAST_ATTACK_MOVIE_ID }));
  });

  it('deux fiches au même titre : ambigu, jamais certain', async () => {
    const twin: AniListMedia = { ...LAST_ATTACK_MOVIE, id: LAST_ATTACK_MOVIE_ID + 1, format: 'SPECIAL', titles: ['Attack on Titan: The Last Attack'] };
    searchResults([LAST_ATTACK_MOVIE, twin]);
    const { candidates } = await findSeriesSeasons(seriesQuery);
    expect(resolveTarget(seriesPageNumbers, candidates)).not.toMatchObject({ ok: true, target: { confidence: 'high' } });
  });
});
