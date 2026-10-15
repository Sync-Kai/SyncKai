import { describe, expect, it } from 'vitest';
import { reduceNetflixMetadata, type NetflixShowMetadata } from './bridge-protocol';
import { mushokuEpisodeId, mushokuRawResponse } from './fixtures';
import {
  absoluteEpisodeNumber,
  creditsStartFromMetadata,
  episodeInfoFromMetadata,
  netflixAdapter,
  parseNetflixSeriesId,
  parseNetflixWatchId,
  pickNetflixSeason,
  seasonNumberFromLabel,
  seriesInfoFromMetadata,
} from './adapter';

const reduced = reduceNetflixMetadata(mushokuRawResponse());
if (!reduced) throw new Error('fixture invalide');
const MUSHOKU: NetflixShowMetadata = reduced;

const MOVIE: NetflixShowMetadata = { showId: '81000001', type: 'movie', title: 'Suzume', runtime: 7320, creditsOffset: 7010, seasons: [] };

describe('getEpisodeId / supportsHost', () => {
  it.each([
    ['/watch/81402901', '81402901'],
    ['/watch/81402901/', '81402901'],
  ])('page de lecture %s', (path, id) => {
    expect(parseNetflixWatchId(path)).toBe(id);
    expect(netflixAdapter.getEpisodeId(new URL(`https://www.netflix.com${path}?trackId=253&tctx=1`))).toBe(id);
  });

  it.each(['/browse', '/title/80987039', '/watch/', '/watch/abc', '/watch/1234567890123', '/watch/81402901/extra', '/fr/watch/81402901'])(
    'autre page : %s',
    (path) => {
      expect(parseNetflixWatchId(path)).toBeNull();
    },
  );

  it('domaines Netflix uniquement', () => {
    expect(netflixAdapter.supportsHost('www.netflix.com')).toBe(true);
    expect(netflixAdapter.supportsHost('netflix.com')).toBe(true);
    expect(netflixAdapter.supportsHost('netflix.com.evil.example')).toBe(false);
    expect(netflixAdapter.supportsHost('notnetflix.com')).toBe(false);
  });

  it('plateforme discrète ; hors page de série, aucune lecture du pont', () => {
    expect(netflixAdapter.quiet).toBe(true);
    expect(netflixAdapter.detectSeries(new URL('https://www.netflix.com/browse'))).toBeNull();
    expect(netflixAdapter.loadSeries).toBeTypeOf('function');
  });
});

describe('parseNetflixSeriesId (pages de série)', () => {
  it.each([
    ['/title/80987039', '80987039'],
    ['/be-fr/title/80987039/', '80987039'],
    ['/browse?jbv=80987039', '80987039'],
    ['/search?q=mushoku&jbv=80987039', '80987039'],
    // Fenêtre de détail d'une autre série ouverte sur une page de série : la fenêtre l'emporte
    ['/title/80000001?jbv=80987039', '80987039'],
  ])('%s → %s', (path, id) => {
    expect(parseNetflixSeriesId(new URL(`https://www.netflix.com${path}`))).toBe(id);
  });

  it.each(['/browse', '/watch/81402901?jbv=80987039', '/browse?jbv=abc', '/title/', '/title/abc', '/fr/watch/1'])('pas une page de série : %s', (path) => {
    expect(parseNetflixSeriesId(new URL(`https://www.netflix.com${path}`))).toBeNull();
  });
});

describe('seriesInfoFromMetadata (page de série)', () => {
  it('série à plusieurs saisons, menu « Saison 2 » (libellé localisé) : saison 2, numéros de la lecture (seq)', () => {
    expect(seriesInfoFromMetadata(MUSHOKU, 'Saison 2')).toEqual({
      seriesId: '80987039',
      seriesSlug: null,
      seriesTitle: 'Mushoku Tensei: Jobless Reincarnation',
      seasonNumber: 2,
      seasonTitle: null,
      seasonEpisodeCount: 25,
      platformSeasons: [23, 25],
      // Saison 2 : début d'origine 2023, 25 épisodes de 1422 s
      signals: { seasonYear: 2023, seasonEpisodeCount: 25, episodeMinutes: 23.7, format: 'series' },
    });
  });

  it('menu absent ou illisible : toute la série (saison choisie par la fiche)', () => {
    expect(seriesInfoFromMetadata(MUSHOKU, null)).toMatchObject({ seasonNumber: null, seasonTitle: null, seasonEpisodeCount: null });
    expect(seriesInfoFromMetadata(MUSHOKU, 'Épisodes')).toMatchObject({ seasonNumber: null });
    expect(seriesInfoFromMetadata(MUSHOKU, 'Saison 7')).toMatchObject({ seasonNumber: null });
  });

  it('une seule saison : retenue sans menu', () => {
    const single: NetflixShowMetadata = { ...MUSHOKU, seasons: MUSHOKU.seasons.slice(0, 1) };
    expect(seriesInfoFromMetadata(single, null)).toMatchObject({ seasonNumber: 1, seasonEpisodeCount: 23 });
  });

  it('film : ni saison ni nombre d’épisodes', () => {
    expect(seriesInfoFromMetadata(MOVIE, 'Saison 1')).toEqual({
      seriesId: '81000001',
      seriesSlug: null,
      seriesTitle: 'Suzume',
      seasonNumber: null,
      seasonTitle: null,
      seasonEpisodeCount: null,
      signals: { format: 'movie', episodeMinutes: 122 },
    });
  });

  it('toute la série (aucune saison) : aucun signal (l’année la plus ancienne n’est pas forcément celle de la série)', () => {
    expect(seriesInfoFromMetadata(MUSHOKU, null)).not.toHaveProperty('signals');
  });

  it('pickNetflixSeason : nom exact de la saison, sinon numéro du libellé', () => {
    const named: NetflixShowMetadata = { ...MUSHOKU, seasons: MUSHOKU.seasons.map((season, i) => ({ ...season, title: i === 1 ? 'Part 2: The Labyrinth' : season.title })) };
    expect(pickNetflixSeason(named.seasons, 'part 2: the labyrinth')?.seq).toBe(2);
    expect(pickNetflixSeason(named.seasons, 'Staffel 1')?.seq).toBe(1);
    expect(seasonNumberFromLabel('Season 12')).toBe(12);
    expect(seasonNumberFromLabel('Saison')).toBeNull();
  });
});

describe('absoluteEpisodeNumber', () => {
  it('additionne les épisodes des saisons précédentes', () => {
    expect(absoluteEpisodeNumber(MUSHOKU.seasons, 1, 15)).toBe(15);
    expect(absoluteEpisodeNumber(MUSHOKU.seasons, 2, 1)).toBe(24);
    expect(absoluteEpisodeNumber(MUSHOKU.seasons, 2, 25)).toBe(48);
  });

  it('null si une saison précédente est vide', () => {
    const seasons = [{ seq: 1, title: null, episodes: [] }, ...MUSHOKU.seasons.slice(1)];
    expect(absoluteEpisodeNumber(seasons, 2, 1)).toBeNull();
  });
});

describe('episodeInfoFromMetadata', () => {
  it('Mushoku Tensei S1E15 (/watch/81402901)', () => {
    expect(episodeInfoFromMetadata(MUSHOKU, '81402901')).toEqual({
      platform: 'netflix',
      episodeId: '81402901',
      seriesId: '80987039',
      seriesSlug: null,
      animeTitle: 'Mushoku Tensei: Jobless Reincarnation',
      seasonNumber: 1,
      // « Season 1 » est générique
      seasonTitle: null,
      seasonEpisodeNumber: 15,
      displayedEpisodeNumber: 15,
      episodeTitle: 'Episode 15 title',
      url: 'https://www.netflix.com/watch/81402901',
      // Épisodes de chaque saison : rapprochement des saisons Netflix avec les fiches AniList
      platformSeasons: [23, 25],
      // Signaux de la saison en lecture : année de début d'origine (2021), épisodes, durée médiane
      signals: { seasonYear: 2021, seasonEpisodeCount: 23, episodeMinutes: 23.7, format: 'series' },
    });
  });

  it('année de saison absente des métadonnées : les autres signaux restent', () => {
    const withoutYear: NetflixShowMetadata = { ...MUSHOKU, seasons: MUSHOKU.seasons.map(({ year: _year, ...season }) => season) };
    expect(episodeInfoFromMetadata(withoutYear, '81402901')?.signals).toEqual({ seasonEpisodeCount: 23, episodeMinutes: 23.7, format: 'series' });
  });

  it('Mushoku Tensei S2E1 : numéro affiché 24', () => {
    expect(episodeInfoFromMetadata(MUSHOKU, mushokuEpisodeId(2, 1))).toMatchObject({ seasonNumber: 2, seasonEpisodeNumber: 1, displayedEpisodeNumber: 24 });
  });

  it('vidéo absente (bande-annonce) → null', () => {
    expect(episodeInfoFromMetadata(MUSHOKU, '1')).toBeNull();
  });

  it('film : saison inconnue, épisode 1', () => {
    expect(episodeInfoFromMetadata(MOVIE, '81000001')).toMatchObject({
      seriesId: '81000001',
      animeTitle: 'Suzume',
      seasonNumber: null,
      seasonTitle: null,
      seasonEpisodeNumber: 1,
      displayedEpisodeNumber: 1,
    });
    expect(episodeInfoFromMetadata(MOVIE, '2')).toBeNull();
  });

  it('nom de saison significatif conservé', () => {
    const show: NetflixShowMetadata = { ...MUSHOKU, seasons: [{ ...MUSHOKU.seasons[0], title: 'Cour 2: The Journey' }] };
    expect(episodeInfoFromMetadata(show, '81402901')?.seasonTitle).toBe('Cour 2: The Journey');
  });
});

describe('creditsStartFromMetadata', () => {
  const withCredits = (creditsOffset: number | null, runtime: number | null): NetflixShowMetadata => ({
    ...MUSHOKU,
    seasons: [{ seq: 1, title: null, episodes: [{ id: '10', seq: 1, title: null, runtime, creditsOffset }] }],
  });

  it('début du générique valide', () => {
    expect(creditsStartFromMetadata(MUSHOKU, '81402901')).toBe(1329);
    expect(creditsStartFromMetadata(MOVIE, '81000001')).toBe(7010);
  });

  it('0, absent, au-delà de la durée ou durée inconnue → null', () => {
    expect(creditsStartFromMetadata(withCredits(null, 1400), '10')).toBeNull();
    expect(creditsStartFromMetadata(withCredits(1500, 1400), '10')).toBeNull();
    expect(creditsStartFromMetadata(withCredits(1400, 1400), '10')).toBeNull();
    expect(creditsStartFromMetadata(withCredits(1300, null), '10')).toBeNull();
    // creditsOffset = 0 est écarté dès la réduction (durée > 0 exigée)
    expect(reduceNetflixMetadata({ video: { id: 1, type: 'movie', title: 'T', runtime: 100, creditsOffset: 0 } })?.creditsOffset).toBeNull();
  });

  it('vidéo inconnue ou métadonnées absentes → null', () => {
    expect(creditsStartFromMetadata(MUSHOKU, '1')).toBeNull();
    expect(creditsStartFromMetadata(null, '81402901')).toBeNull();
  });
});

describe('numérotation déjà absolue dans les saisons Netflix (One Piece, /title/80107103, relevé le 2026-10-11)', () => {
  /** Saison `seq` dont les épisodes portent les numéros `from`..`to` (identifiants arbitraires) */
  function season(seq: number, title: string, from: number, to: number): NetflixShowMetadata['seasons'][number] {
    return {
      seq,
      title,
      episodes: Array.from({ length: to - from + 1 }, (_, i) => ({ id: String(82_700_000 + seq * 10_000 + i), seq: from + i, title: null, runtime: 1440, creditsOffset: null })),
    };
  }
  // Région où Netflix ne propose que quelques arcs : les saisons précédentes comptent bien moins d'épisodes que 1180
  const ONE_PIECE: NetflixShowMetadata = {
    showId: '80107103',
    type: 'show',
    title: 'One Piece',
    runtime: null,
    creditsOffset: null,
    seasons: [season(1, 'East Blue', 1, 61), season(38, 'Egghead Arc', 1086, 1155), season(40, 'Elbaph Arc', 1156, 1180)],
  };
  const idOf = (seasonSeq: number, number: number): string => {
    const found = ONE_PIECE.seasons.find((s) => s.seq === seasonSeq)?.episodes.find((e) => e.seq === number);
    if (!found) throw new Error('épisode absent');
    return found.id;
  };

  it('S40 « E1180 » : numéro affiché 1180 (pas 1180 + les épisodes des saisons précédentes)', () => {
    expect(episodeInfoFromMetadata(ONE_PIECE, idOf(40, 1180))).toMatchObject({ seasonNumber: 40, seasonEpisodeNumber: 25, displayedEpisodeNumber: 1180 });
    expect(episodeInfoFromMetadata(ONE_PIECE, idOf(40, 1165))).toMatchObject({ seasonEpisodeNumber: 10, displayedEpisodeNumber: 1165 });
    expect(episodeInfoFromMetadata(ONE_PIECE, idOf(38, 1086))).toMatchObject({ seasonEpisodeNumber: 1, displayedEpisodeNumber: 1086 });
  });

  it('1re saison (numéros dès 1) : inchangée', () => {
    expect(episodeInfoFromMetadata(ONE_PIECE, idOf(1, 61))).toMatchObject({ seasonEpisodeNumber: 61, displayedEpisodeNumber: 61 });
  });

  it('numéros qui continuent d’une saison à l’autre (S2 commence à 13 après 12 épisodes) : gardés tels quels', () => {
    const show: NetflixShowMetadata = { ...ONE_PIECE, seasons: [season(1, 'Season 1', 1, 12), season(2, 'Season 2', 13, 24)] };
    const id = show.seasons[1]?.episodes[2]?.id ?? '';
    expect(episodeInfoFromMetadata(show, id)).toMatchObject({ seasonNumber: 2, seasonEpisodeNumber: 3, displayedEpisodeNumber: 15 });
  });

  it('numérotation par saison (Ranma1/2, Mushoku Tensei : chaque saison repart de 1) : inchangée', () => {
    expect(episodeInfoFromMetadata(MUSHOKU, mushokuEpisodeId(2, 1))).toMatchObject({ seasonNumber: 2, seasonEpisodeNumber: 1, displayedEpisodeNumber: 24 });
    // Saison 2 dont le 1er épisode manque (numéro 2) : toujours relative, pas absolue
    const missingFirst: NetflixShowMetadata = { ...ONE_PIECE, seasons: [season(1, 'Season 1', 1, 12), season(2, 'Season 2', 2, 12)] };
    const id = missingFirst.seasons[1]?.episodes[0]?.id ?? '';
    expect(episodeInfoFromMetadata(missingFirst, id)).toMatchObject({ seasonEpisodeNumber: 2, displayedEpisodeNumber: 14 });
  });
});
