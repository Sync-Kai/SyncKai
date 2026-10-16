import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { withOrigin, type MappingOrigin, type MediaMapping } from '../../../shared/sync.types';
import { setLocale } from '../../../i18n';
import type { EpisodeInfo } from '../../../shared/episode.types';
import type { AniListMedia } from '../../anilist/media';

// Série Netflix en plusieurs saisons, une fiche AniList par saison, liées à des titres Netflix DIFFÉRENTS (relevé le
// 2026-10-11 : Ranma1/2, /title/81171925, 3 saisons ; AniList lie la saison 3 à 81171925 mais les saisons 1 et 2 à
// 81301833). Avant le correctif, S1E1 était synchronisé sur la saison 3 (« Fiche unique »).
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
const { resolveTarget } = await import('./rules-engine');

setLocale('fr');

const SHOW_ID = '81171925';
const OTHER_NETFLIX_TITLE = 'https://www.netflix.com/title/81301833';
const S1 = 178533;
const S2 = 185731;
const S3 = 209872;

type Relation = AniListMedia['relations'][number];
const sequel = (id: number): Relation => ({ relationType: 'SEQUEL', id, type: 'ANIME', format: 'TV' });
const prequel = (id: number): Relation => ({ relationType: 'PREQUEL', id, type: 'ANIME', format: 'TV' });
const alternative = (id: number): Relation => ({ relationType: 'ALTERNATIVE', id, type: 'ANIME', format: 'TV' });

function media(overrides: Partial<AniListMedia> & Pick<AniListMedia, 'id' | 'titles'>): AniListMedia {
  return {
    idMal: null,
    format: 'TV',
    episodes: 12,
    startDate: null,
    displayTitle: overrides.titles[0] ?? '',
    year: null,
    coverUrl: null,
    externalLinkUrls: [],
    relations: [],
    ...overrides,
  };
}

/** Résultats réels de la recherche AniList « Ranma1/2 » (liens et relations relevés le 2026-10-11) */
function ranmaSearch(): AniListMedia[] {
  return [
    media({
      id: S1,
      titles: ['Ranma 1/2 (2024)', 'Ranma1/2 (2024)'],
      startDate: { year: 2024, month: 10, day: 6 },
      externalLinkUrls: ['https://ranma-pr.com/', OTHER_NETFLIX_TITLE],
      relations: [alternative(210), sequel(S2)],
    }),
    media({
      id: S2,
      titles: ['Ranma 1/2 (2024) 2nd Season', 'Ranma1/2 (2024) Season 2'],
      startDate: { year: 2025, month: 10, day: 5 },
      externalLinkUrls: [OTHER_NETFLIX_TITLE],
      relations: [prequel(S1), sequel(S3)],
    }),
    media({
      id: S3,
      titles: ['Ranma 1/2 (2024) 3rd Season', 'Ranma1/2 (2024) Season 3'],
      episodes: null,
      startDate: { year: 2026, month: 10, day: 4 },
      externalLinkUrls: [`https://www.netflix.com/title/${SHOW_ID}`],
      relations: [prequel(S2)],
    }),
    media({ id: 210, titles: ['Ranma 1/2', 'Ranma ½'], episodes: 18, startDate: { year: 1989, month: 4, day: 15 } }),
    media({ id: 1007, format: 'OVA', titles: ['Ranma 1/2 (OVA)'], episodes: 6, startDate: { year: 1993, month: 10, day: 21 } }),
  ];
}

/** Épisode de la saison `season` (12, 12 puis 2 épisodes sur Netflix, numérotation continue) */
function ranmaEpisode(season: 1 | 2 | 3, number: number, platformSeasons: number[] | undefined = [12, 12, 2]): EpisodeInfo {
  const before = [0, 12, 24][season - 1] ?? 0;
  return {
    platform: 'netflix',
    episodeId: `8132${season}0${number}`,
    seriesId: SHOW_ID,
    seriesSlug: null,
    animeTitle: 'Ranma1/2',
    seasonNumber: season,
    seasonTitle: null,
    seasonEpisodeNumber: number,
    displayedEpisodeNumber: before + number,
    episodeTitle: null,
    url: `https://www.netflix.com/watch/8132${season}0${number}`,
    ...(platformSeasons ? { platformSeasons } : {}),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('chrome', {});
  storage.getMediaMapping.mockResolvedValue(null);
  storage.saved.mockResolvedValue(undefined);
  api.searchAnime.mockImplementation((query: string) => Promise.resolve(query === 'Ranma1/2' ? ranmaSearch() : []));
  api.getAnimeByIds.mockResolvedValue([]);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('Ranma1/2 sur Netflix : saison N → fiche AniList de la saison N', () => {
  it.each<[string, EpisodeInfo, number, number]>([
    ['S1E1 « Voilà Ranma »', ranmaEpisode(1, 1), S1, 1],
    ['S2E3', ranmaEpisode(2, 3), S2, 3],
    ['S3E1 (saison en cours, nombre d’épisodes inconnu sur AniList)', ranmaEpisode(3, 1), S3, 1],
  ])('%s', async (_label, episode, mediaId, progress) => {
    const { result } = await resolveEpisode(episode);
    expect(result).toMatchObject({ ok: true, target: { mediaId, progress, confidence: 'high' } });
    // Correspondance mise en cache par saison (clé netflix:{showId}:s{seq})
    expect(storage.saved).toHaveBeenCalledWith(`netflix:${SHOW_ID}:s${episode.seasonNumber ?? 0}`, expect.objectContaining({ mediaId }));
  });

  it('page de série : les trois fiches sont les saisons de la série', async () => {
    const { seasons } = await findSeriesSeasons({ platform: 'netflix', seriesId: SHOW_ID, seriesSlug: null, animeTitle: 'Ranma1/2', seasonTitle: null, platformSeasons: [12, 12, 2] });
    expect(seasons.map((m) => m.id)).toEqual([S1, S2, S3]);
  });

  it('épisodes par saison inconnus (épisode mis en file avant la mise à jour) : jamais la saison 3 en certain', async () => {
    const { result } = await resolveEpisode(ranmaEpisode(1, 1, undefined));
    expect(result.ok && result.target.confidence === 'high' && result.target.mediaId === S3).toBe(false);
    if (result.ok && result.target.mediaId === S3) expect(storage.saved).not.toHaveBeenCalled();
  });

  it('nombres d’épisodes incompatibles (autre découpage) : pas d’alignement, saison 3 jamais certaine pour S1', async () => {
    const { result } = await resolveEpisode(ranmaEpisode(1, 1, [24, 2]));
    expect(result.ok && result.target.confidence === 'high' && result.target.mediaId === S3).toBe(false);
  });
});

describe('suite publiée à part sur Netflix (Naruto / Naruto Shippuden) : l’autre série n’est jamais une saison', () => {
  const NARUTO = 20;
  const SHIPPUDEN = 1735;
  const SHIPPUDEN_ID = '70205012';

  function search(): AniListMedia[] {
    return [
      media({ id: NARUTO, titles: ['Naruto'], episodes: 220, startDate: { year: 2002, month: 10, day: 3 }, externalLinkUrls: ['https://www.netflix.com/title/70205011'], relations: [sequel(SHIPPUDEN)] }),
      media({
        id: SHIPPUDEN,
        titles: ['Naruto: Shippuuden', 'Naruto Shippuden'],
        episodes: 500,
        startDate: { year: 2007, month: 2, day: 15 },
        externalLinkUrls: [`https://www.netflix.com/title/${SHIPPUDEN_ID}`],
        relations: [prequel(NARUTO)],
      }),
    ];
  }

  function shippudenEpisode(season: number, number: number, platformSeasons: number[]): EpisodeInfo {
    const before = platformSeasons.slice(0, season - 1).reduce((sum, count) => sum + count, 0);
    return { ...ranmaEpisode(1, 1), seriesId: SHIPPUDEN_ID, animeTitle: 'Naruto Shippuden', seasonNumber: season, seasonEpisodeNumber: number, displayedEpisodeNumber: before + number, platformSeasons };
  }

  beforeEach(() => {
    api.searchAnime.mockImplementation((query: string) => Promise.resolve(query === 'Naruto Shippuden' ? search() : []));
  });

  it('Netflix en 2 saisons (32 + 468) : S1E1 → Shippuden épisode 1, pas Naruto', async () => {
    const { result } = await resolveEpisode(shippudenEpisode(1, 1, [32, 468]));
    expect(result).toMatchObject({ ok: true, target: { mediaId: SHIPPUDEN, progress: 1, confidence: 'high' } });
  });

  it('S2E5 → Shippuden épisode 37 (numérotation absolue sur la fiche unique, qui couvre toutes les saisons)', async () => {
    const { result } = await resolveEpisode(shippudenEpisode(2, 5, [32, 468]));
    expect(result).toMatchObject({ ok: true, target: { mediaId: SHIPPUDEN, progress: 37, confidence: 'high' } });
  });
});

describe('longue série en une seule fiche AniList (numérotation absolue)', () => {
  it('One Piece en plusieurs saisons Netflix : épisode absolu sur la fiche unique, certain', async () => {
    api.searchAnime.mockResolvedValue([media({ id: 21, titles: ['One Piece'], episodes: null, externalLinkUrls: ['https://www.netflix.com/title/80107103'] })]);
    const episode: EpisodeInfo = { ...ranmaEpisode(2, 3), seriesId: '80107103', animeTitle: 'One Piece', displayedEpisodeNumber: 64, platformSeasons: [61, 16] };
    const { result } = await resolveEpisode(episode);
    expect(result).toMatchObject({ ok: true, target: { mediaId: 21, progress: 64, confidence: 'high' } });
  });

  it('resolveTarget seul (sans comptes de saisons, Crunchyroll) : comportement inchangé', () => {
    const result = resolveTarget(
      { animeTitle: 'One Piece', seasonTitle: null, seasonNumber: 1, seasonEpisodeNumber: 1, displayedEpisodeNumber: 1 },
      [{ id: 21, format: 'TV', episodes: null, startDate: null, titles: ['One Piece'], link: 'id' }],
    );
    expect(result).toMatchObject({ ok: true, target: { mediaId: 21, confidence: 'high' } });
  });
});

describe('Disney+ : série précédente publiée à part (BLEACH / BLEACH: Thousand-Year Blood War)', () => {
  const BLEACH = 269;
  const TYBW = 116674;
  const TYBW2 = 159322;
  const DISNEY_TYBW = 'https://www.disneyplus.com/series/bleach-thousand-year-blood-war/4Afet1Q421gy';

  /** Liens et relations réels (relevés le 2026-10-11) */
  function search(): AniListMedia[] {
    return [
      media({ id: BLEACH, titles: ['BLEACH', 'Bleach'], episodes: 366, startDate: { year: 2004, month: 10, day: 5 }, externalLinkUrls: ['https://www.disneyplus.com/en-gb/series/bleach/6g48QKlgQdWK'], relations: [sequel(TYBW)] }),
      media({ id: TYBW, titles: ['BLEACH: Sennen Kessen-hen', 'BLEACH: Thousand-Year Blood War'], episodes: 13, startDate: { year: 2022, month: 10, day: 11 }, externalLinkUrls: [DISNEY_TYBW], relations: [prequel(BLEACH), sequel(TYBW2)] }),
      media({
        id: TYBW2,
        titles: ['BLEACH: Sennen Kessen-hen - Ketsubetsu-tan', 'BLEACH: Thousand-Year Blood War - The Separation'],
        episodes: 13,
        startDate: { year: 2023, month: 7, day: 8 },
        externalLinkUrls: [DISNEY_TYBW],
        relations: [prequel(TYBW)],
      }),
    ];
  }

  function tybwEpisode(season: number, number: number): EpisodeInfo {
    return { ...ranmaEpisode(1, 1, undefined), platform: 'disney', seriesId: null, animeTitle: 'BLEACH: Thousand-Year Blood War', seasonNumber: season, seasonEpisodeNumber: number, displayedEpisodeNumber: number };
  }

  beforeEach(() => {
    api.searchAnime.mockImplementation((query: string) => Promise.resolve(query === 'BLEACH: Thousand-Year Blood War' ? search() : []));
  });

  it('S1E1 → BLEACH: Thousand-Year Blood War épisode 1, jamais BLEACH (2004)', async () => {
    const { result } = await resolveEpisode(tybwEpisode(1, 1));
    expect(result).toMatchObject({ ok: true, target: { mediaId: TYBW, progress: 1 } });
  });

  it('S2E1 → « The Separation » épisode 1', async () => {
    const { result } = await resolveEpisode(tybwEpisode(2, 1));
    expect(result).toMatchObject({ ok: true, target: { mediaId: TYBW2, progress: 1 } });
  });
});

describe('Crunchyroll, page de série sur la saison « Special » (I Got a Cheat Skill…, relevé le 2026-10-11)', () => {
  const SERIES_ID = 'GEXH3W49E';
  const TV = 153845;
  const SPECIAL = 170110;
  const TITLE = 'I Got a Cheat Skill in Another World and Became Unrivaled in The Real World, Too';
  const ROMAJI = 'Isekai de Cheat Skill wo Te ni Shita Ore wa, Genjitsu Sekai wo mo Musou Suru: Level Up wa Jinsei wo Kaeta';

  function search(): AniListMedia[] {
    return [
      media({
        id: TV,
        titles: [ROMAJI, TITLE],
        episodes: 13,
        startDate: { year: 2023, month: 4, day: 6 },
        externalLinkUrls: [`https://www.crunchyroll.com/series/${SERIES_ID}/i-got-a-cheat-skill-in-another-world-and-became-unrivaled-in-the-real-world-too`],
        relations: [{ relationType: 'SEQUEL', id: SPECIAL, type: 'ANIME', format: 'SPECIAL' }],
      }),
      media({
        id: SPECIAL,
        format: 'SPECIAL',
        episodes: 1,
        titles: [ROMAJI, `${TITLE} (Special) - The Legendary Dragon—Awakens`],
        startDate: { year: 2024, month: 3, day: 1 },
        externalLinkUrls: ['https://www.crunchyroll.com/watch/G14UV4GZQ/the-legendary-dragonawakens'],
        relations: [{ relationType: 'PREQUEL', id: TV, type: 'ANIME', format: 'TV' }],
      }),
    ];
  }

  beforeEach(() => {
    api.searchAnime.mockImplementation((query: string) => Promise.resolve(query.startsWith(TITLE) ? search() : []));
  });

  it('saison « Special » lue sur la page : fiche spéciale (1 épisode), certaine — pas la saison 1 devinée', async () => {
    const { candidates } = await findSeriesSeasons({ platform: 'crunchyroll', seriesId: SERIES_ID, seriesSlug: null, animeTitle: TITLE, seasonTitle: 'Special' });
    const result = resolveTarget({ animeTitle: TITLE, seasonTitle: 'Special', seasonNumber: null, seasonEpisodeNumber: 1, displayedEpisodeNumber: 1 }, candidates);
    expect(result).toMatchObject({ ok: true, target: { mediaId: SPECIAL, progress: 1, confidence: 'high' } });
  });

  it('saison 1 : fiche TV', async () => {
    const { candidates } = await findSeriesSeasons({ platform: 'crunchyroll', seriesId: SERIES_ID, seriesSlug: null, animeTitle: TITLE, seasonTitle: null });
    const result = resolveTarget({ animeTitle: TITLE, seasonTitle: null, seasonNumber: 1, seasonEpisodeNumber: 1, displayedEpisodeNumber: 1 }, candidates);
    expect(result).toMatchObject({ ok: true, target: { mediaId: TV, confidence: 'high' } });
  });
});

describe('One Piece sur Netflix (/title/80107103, arcs en saisons, numéros absolus) : synchro juste et peu de requêtes', () => {
  const ONE_PIECE = 21;
  const MONSTERS = 167404;
  /** Arcs proposés dans la région (bien moins d'épisodes que les numéros affichés) */
  const PLATFORM_SEASONS = [61, 70, 25];

  /** Fiches réelles (relevées le 2026-10-11) : One Piece, sa « préquelle » MONSTERS (ONA 2024, autre titre Netflix), films */
  function search(): AniListMedia[] {
    return [
      media({
        id: ONE_PIECE,
        titles: ['ONE PIECE', 'One Piece'],
        episodes: null,
        startDate: { year: 1999, month: 10, day: 20 },
        externalLinkUrls: ['https://www.netflix.com/title/80107103'],
        relations: [prequel(MONSTERS)],
      }),
      media({ id: 141902, format: 'MOVIE', episodes: 1, titles: ['ONE PIECE FILM: RED'], startDate: { year: 2022, month: 8, day: 6 }, externalLinkUrls: ['https://www.netflix.com/title/81700392'] }),
      media({ id: 197178, format: 'SPECIAL', episodes: 1, titles: ['ONE PIECE HEROINES'], startDate: { year: 2024, month: 12, day: 1 }, externalLinkUrls: ['https://www.netflix.com/us/title/82904737'] }),
    ];
  }

  /** Épisode tel que le produit l'adapter corrigé : S40 « Elbaph Arc », 25e épisode de la saison, E1180 */
  const elbaph = (): EpisodeInfo => ({
    ...ranmaEpisode(3, 1),
    seriesId: '80107103',
    animeTitle: 'One Piece',
    seasonNumber: 40,
    seasonTitle: 'Elbaph Arc',
    seasonEpisodeNumber: 25,
    displayedEpisodeNumber: 1180,
    platformSeasons: PLATFORM_SEASONS,
  });

  beforeEach(() => {
    api.searchAnime.mockImplementation((query: string) => Promise.resolve(query.startsWith('One Piece') ? search() : []));
    api.getAnimeByIds.mockResolvedValue([media({ id: MONSTERS, format: 'ONA', episodes: 1, titles: ['MONSTERS: Ippaku Sanjou Hiryuu Jigoku'], startDate: { year: 2024, month: 1, day: 21 }, externalLinkUrls: ['https://www.netflix.com/title/81733654'] })]);
  });

  it('E1180 → One Piece épisode 1180, certain (pas 1377, pas « À vérifier »)', async () => {
    const { result } = await resolveEpisode(elbaph());
    expect(result).toMatchObject({ ok: true, target: { mediaId: ONE_PIECE, progress: 1180, confidence: 'high' } });
  });

  it('début de lecture : la recherche seulement (série + arc), aucune fiche de relation demandée', async () => {
    await resolveEpisode(elbaph());
    expect(api.searchAnime).toHaveBeenCalledTimes(2);
    expect(api.getAnimeByIds).not.toHaveBeenCalled();
  });

  it('page de série (arc choisi, sans épisode) : même coût', async () => {
    await findSeriesSeasons({ platform: 'netflix', seriesId: '80107103', seriesSlug: null, animeTitle: 'One Piece', seasonTitle: 'Elbaph Arc', platformSeasons: PLATFORM_SEASONS });
    expect(api.searchAnime.mock.calls.length + api.getAnimeByIds.mock.calls.length).toBeLessThanOrEqual(3);
  });
});

describe('One Piece sur Crunchyroll (/series/GRMG8ZQZR), page de série sur l’arc « Elbaph (1156-current) »', () => {
  const ONE_PIECE = 21;
  const MONSTERS = 167404;
  const CR_SERIES = 'GRMG8ZQZR';

  function search(): AniListMedia[] {
    return [
      media({
        id: ONE_PIECE,
        titles: ['ONE PIECE', 'One Piece'],
        episodes: null,
        startDate: { year: 1999, month: 10, day: 20 },
        externalLinkUrls: [`https://www.crunchyroll.com/series/${CR_SERIES}/one-piece`, 'https://www.netflix.com/title/80107103'],
        relations: [prequel(MONSTERS)],
      }),
    ];
  }
  /** MONSTERS (ONA 2024) : « préquelle » d'One Piece pour AniList, liée seulement à Netflix (relevé le 2026-10-11) */
  const monsters = (): AniListMedia =>
    media({
      id: MONSTERS,
      format: 'ONA',
      episodes: 1,
      titles: ['MONSTERS: Ippaku Sanjou Hiryuu Jigoku', 'MONSTERS: 103 Mercies Dragon Damnation'],
      startDate: { year: 2024, month: 1, day: 21 },
      externalLinkUrls: ['https://www.netflix.com/title/81733654'],
      relations: [sequel(ONE_PIECE)],
    });

  beforeEach(() => {
    api.searchAnime.mockImplementation((query: string) => Promise.resolve(query.toLowerCase().startsWith('one piece') ? search() : []));
    api.getAnimeByIds.mockResolvedValue([monsters()]);
  });

  it('MONSTERS (préquelle sortie après One Piece, liée à Netflix seulement) n’est pas une saison de la série Crunchyroll', async () => {
    const { seasons } = await findSeriesSeasons({ platform: 'crunchyroll', seriesId: CR_SERIES, seriesSlug: 'one-piece', animeTitle: 'One Piece', seasonTitle: 'Elbaph' });
    expect(seasons.map((m) => m.id)).toEqual([ONE_PIECE]);
  });

  it('arc à partir de l’épisode 1156 : fiche unique One Piece, certaine (numérotation absolue)', async () => {
    const { candidates } = await findSeriesSeasons({ platform: 'crunchyroll', seriesId: CR_SERIES, seriesSlug: 'one-piece', animeTitle: 'One Piece', seasonTitle: 'Elbaph' });
    const result = resolveTarget({ animeTitle: 'One Piece', seasonTitle: 'Elbaph', seasonNumber: null, seasonEpisodeNumber: 1, displayedEpisodeNumber: 1156 }, candidates);
    expect(result).toMatchObject({ ok: true, target: { mediaId: ONE_PIECE, progress: 1156, confidence: 'high' } });
  });

  it('lecture E1180 (saison 43 de Crunchyroll, 25e épisode) : progression 1180', async () => {
    const episode: EpisodeInfo = { ...ranmaEpisode(1, 1, undefined), platform: 'crunchyroll', seriesId: CR_SERIES, seriesSlug: 'one-piece', animeTitle: 'One Piece', seasonNumber: 43, seasonTitle: 'Elbaph', seasonEpisodeNumber: 25, displayedEpisodeNumber: 1180 };
    const { result } = await resolveEpisode(episode);
    expect(result).toMatchObject({ ok: true, target: { mediaId: ONE_PIECE, progress: 1180, confidence: 'high' } });
  });
});

describe('régressions saisons découpées : Black Butler sur Crunchyroll (liens et relations réels, 2026-10-11)', () => {
  const CR = 'https://www.crunchyroll.com/series/GYQ43P3E6/black-butler';
  const NF = 'https://www.netflix.com/title/70204955';
  const rel = (relationType: 'SEQUEL' | 'PREQUEL', id: number, format: string): Relation => ({ relationType, id, type: 'ANIME', format });

  function search(): AniListMedia[] {
    return [
      media({ id: 4898, titles: ['Kuroshitsuji', 'Black Butler'], episodes: 24, startDate: { year: 2008, month: 10, day: 3 }, externalLinkUrls: ['http://movies.netflix.com/WiMovie/Black_Butler/70204955', CR], relations: [rel('SEQUEL', 6707, 'TV'), rel('SEQUEL', 20606, 'TV')] }),
      media({ id: 6707, titles: ['Kuroshitsuji II', 'Black Butler II'], episodes: 12, startDate: { year: 2010, month: 7, day: 2 }, externalLinkUrls: [NF, CR], relations: [rel('PREQUEL', 4898, 'TV')] }),
      media({ id: 20606, titles: ['Kuroshitsuji: Book of Circus', 'Black Butler: Book of Circus'], episodes: 10, startDate: { year: 2014, month: 7, day: 11 }, externalLinkUrls: [CR], relations: [rel('SEQUEL', 20670, 'OVA'), rel('PREQUEL', 4898, 'TV')] }),
      media({ id: 166715, titles: ['Kuroshitsuji: Kishuku Gakkou-hen', 'Black Butler: Public School Arc'], episodes: 11, startDate: { year: 2024, month: 4, day: 13 }, externalLinkUrls: [CR], relations: [rel('PREQUEL', 21425, 'MOVIE'), rel('SEQUEL', 179054, 'TV')] }),
      media({ id: 179054, titles: ['Kuroshitsuji: Midori no Majo-hen', 'Black Butler: Emerald Witch Arc'], episodes: 13, startDate: { year: 2025, month: 7, day: 5 }, externalLinkUrls: [CR, NF], relations: [rel('PREQUEL', 166715, 'TV')] }),
    ];
  }

  beforeEach(() => {
    api.searchAnime.mockImplementation((query: string) => Promise.resolve(query === 'Black Butler' ? search() : []));
  });

  it('toutes les saisons TV restent des saisons de la série (relations datées dans l’ordre, liens Crunchyroll)', async () => {
    const { seasons } = await findSeriesSeasons({ platform: 'crunchyroll', seriesId: 'GYQ43P3E6', seriesSlug: 'black-butler', animeTitle: 'Black Butler', seasonTitle: null });
    expect(seasons.map((m) => m.id)).toEqual([4898, 6707, 20606, 166715, 179054]);
  });
});
