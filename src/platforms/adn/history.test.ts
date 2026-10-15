import { describe, expect, it } from 'vitest';
import { ADN_HISTORY_VIDEOS, adnVideo, GIRL_DOWNSTAIRS, HERO_WITHOUT_A_CLASS, STUDENT_COUNCIL } from '../../shared/__fixtures__/adn-history';
import { adnSlugFromPath, isAdnHistoryPortMessage, isAdnWatched, parseAdnVideo, reduceAdnHistory } from './history';
import { isCrHistoryResult, MAX_HISTORY_SEASONS } from '../crunchyroll/history';
import { toEpisodeInfo } from '../../shared/cr-import';

const stats = { items: ADN_HISTORY_VIDEOS.length, pages: 1, partial: false };

describe('historique ADN → épisodes', () => {
  it('lit un élément réel (série, slug, saison, numéro, position)', () => {
    expect(parseAdnVideo(ADN_HISTORY_VIDEOS[1])).toEqual({
      episodeId: '30015',
      showId: '1428',
      showTitle: 'Even the Student Council Has Its Holes!',
      showSlug: 'even-the-student-council-has-its-holes',
      seasonNumber: 1,
      episodeNumber: 1,
      episodeTitle: 'Épisode 1',
      fullyWatched: true,
      stoptime: 1299,
      duration: 1421,
      watchedAt: Date.parse('2026-10-12T19:15:00.000Z'),
    });
  });

  it('spécial non numéroté, numéro décimal ou nul : pas de numéro', () => {
    expect(parseAdnVideo(adnVideo({ id: 1, show: STUDENT_COUNCIL, shortNumber: 'OAV', stoptime: 0, fully: true, watchDate: 'x' }))?.episodeNumber).toBeNull();
    expect(parseAdnVideo({ ...adnVideo({ id: 1, show: STUDENT_COUNCIL, shortNumber: '1', stoptime: 0, fully: true, watchDate: 'x' }), shortNumber: '12.5' })?.episodeNumber).toBeNull();
    expect(parseAdnVideo({ ...adnVideo({ id: 1, show: STUDENT_COUNCIL, shortNumber: '1', stoptime: 0, fully: true, watchDate: 'x' }), shortNumber: 0 })?.episodeNumber).toBeNull();
    expect(parseAdnVideo({ ...adnVideo({ id: 1, show: STUDENT_COUNCIL, shortNumber: '1', stoptime: 0, fully: true, watchDate: 'x' }), shortNumber: 7 })?.episodeNumber).toBe(7);
  });

  it('éléments illisibles ignorés (sans série, identifiants invalides, titre vide)', () => {
    const base = adnVideo({ id: 1, show: STUDENT_COUNCIL, shortNumber: '1', stoptime: 0, fully: true, watchDate: 'x' });
    expect(parseAdnVideo(null)).toBeNull();
    expect(parseAdnVideo({ ...base, show: null })).toBeNull();
    expect(parseAdnVideo({ ...base, id: '<img>' })).toBeNull();
    expect(parseAdnVideo({ ...base, show: { id: 1428, title: '   ' } })).toBeNull();
  });

  it('slug lu dans /video/{id}-{slug}, seulement pour la série attendue', () => {
    expect(adnSlugFromPath('/video/1331-hero-without-a-class-who-even-needs-skills', '1331')).toBe('hero-without-a-class-who-even-needs-skills');
    expect(adnSlugFromPath('/de/video/1331-Hero/29932-folge-1', '1331')).toBe('hero');
    expect(adnSlugFromPath('/video/9999-autre', '1331')).toBeNull();
    expect(adnSlugFromPath('/video/1331-<b>', '1331')).toBeNull();
    expect(adnSlugFromPath(42, '1331')).toBeNull();
  });

  it('vu : terminé selon ADN, ou position ≥ seuil de fin réglé ; commencé seulement : jamais', () => {
    expect(isAdnWatched({ fullyWatched: true, stoptime: 0, duration: null }, 85)).toBe(true);
    expect(isAdnWatched({ fullyWatched: false, stoptime: 1208, duration: 1421 }, 85)).toBe(true);
    expect(isAdnWatched({ fullyWatched: false, stoptime: 1200, duration: 1421 }, 85)).toBe(false);
    expect(isAdnWatched({ fullyWatched: false, stoptime: 16, duration: 1421 }, 85)).toBe(false);
    expect(isAdnWatched({ fullyWatched: false, stoptime: 1400, duration: null }, 85)).toBe(false);
    expect(isAdnWatched({ fullyWatched: false, stoptime: 1200, duration: 1421 }, 80)).toBe(true);
  });
});

describe('historique ADN → une ligne par saison', () => {
  it('épisode terminé le plus avancé par (série, saison), comptes et dernier visionnage ; partiels jamais importés', () => {
    const result = reduceAdnHistory({ videos: ADN_HISTORY_VIDEOS, stats }, 85);
    expect(isCrHistoryResult(result)).toBe(true);
    expect(result.stats).toEqual(stats);
    expect(result.seasons.map((s) => [s.seriesId, s.seasonNumber, s.episodeNumber, s.seasonEpisodeNumber, s.watchedCount])).toEqual([
      // E2 commencé (16 s) : la progression reste à E1
      ['1428', 1, 1, 1, 1],
      // E2 à 84 % (< 85 %) : ignoré
      ['1331', 1, 1, 1, 1],
      // Manhwa : non filtré (la correspondance AniList décide) ; spécial « OAV » ignoré
      ['1290', 1, 3, 3, 1],
    ]);
    expect(result.seasons[0]).toMatchObject({
      seriesTitle: STUDENT_COUNCIL.title,
      seriesSlug: STUDENT_COUNCIL.slug,
      seasonId: '1428-s1',
      seasonTitle: null,
      episodeId: '30015',
      lastPlayedAt: Date.parse('2026-10-12T19:15:00.000Z'),
    });
  });

  it('plusieurs épisodes terminés : le plus grand numéro, dans n’importe quel ordre', () => {
    const videos = ['3', '1', '5', '2'].map((n, i) => adnVideo({ id: 100 + i, show: HERO_WITHOUT_A_CLASS, shortNumber: n, stoptime: 1421, fully: true, watchDate: `2026-10-0${i + 1}T10:00:00Z` }));
    const [season] = reduceAdnHistory({ videos, stats }, 85).seasons;
    expect(season).toMatchObject({ episodeNumber: 5, episodeId: '102', watchedCount: 4, lastPlayedAt: Date.parse('2026-10-04T10:00:00Z') });
  });

  it('saisons séparées d’une même série ; plus récente d’abord', () => {
    const videos = [
      adnVideo({ id: 1, show: GIRL_DOWNSTAIRS, shortNumber: '4', season: '1', stoptime: 1421, fully: true, watchDate: '2026-01-01T00:00:00Z' }),
      adnVideo({ id: 2, show: GIRL_DOWNSTAIRS, shortNumber: '2', season: '2', stoptime: 1421, fully: true, watchDate: '2026-02-01T00:00:00Z' }),
    ];
    expect(reduceAdnHistory({ videos, stats }, 85).seasons.map((s) => [s.seasonNumber, s.episodeNumber])).toEqual([
      [2, 2],
      [1, 4],
    ]);
  });

  it('trop de saisons : tronqué et signalé partiel', () => {
    const videos = Array.from({ length: MAX_HISTORY_SEASONS + 1 }, (_, i) =>
      adnVideo({ id: i + 1, show: { ...STUDENT_COUNCIL, id: 10_000 + i }, shortNumber: '1', stoptime: 1421, fully: true, watchDate: '2026-01-01T00:00:00Z' }),
    );
    const result = reduceAdnHistory({ videos, stats }, 85);
    expect(result.seasons).toHaveLength(MAX_HISTORY_SEASONS);
    expect(result.stats.partial).toBe(true);
  });

  it('épisode équivalent à celui de la page de lecture ADN (même clé de saison, URL du site)', () => {
    const [season] = reduceAdnHistory({ videos: ADN_HISTORY_VIDEOS, stats }, 85).seasons;
    if (!season) throw new Error('saison absente');
    expect(toEpisodeInfo(season, 'adn')).toEqual({
      platform: 'adn',
      episodeId: '30015',
      seriesId: '1428',
      seriesSlug: 'even-the-student-council-has-its-holes',
      animeTitle: 'Even the Student Council Has Its Holes!',
      seasonNumber: 1,
      seasonTitle: null,
      seasonEpisodeNumber: 1,
      displayedEpisodeNumber: 1,
      episodeTitle: 'Épisode 1',
      url: 'https://animationdigitalnetwork.com/video/1428-even-the-student-council-has-its-holes/30015',
    });
  });
});

describe('protocole du port ADN', () => {
  it('accepte la progression, les épisodes et les erreurs connues ; rien d’autre', () => {
    expect(isAdnHistoryPortMessage({ type: 'progress', pages: 1, items: 100 })).toBe(true);
    expect(isAdnHistoryPortMessage({ type: 'progress', pages: -1, items: 0 })).toBe(false);
    expect(isAdnHistoryPortMessage({ type: 'done', result: { videos: ADN_HISTORY_VIDEOS, stats } })).toBe(true);
    expect(isAdnHistoryPortMessage({ type: 'done', result: { videos: 'x', stats } })).toBe(false);
    expect(isAdnHistoryPortMessage({ type: 'done', result: { videos: new Array(5001).fill(null), stats } })).toBe(false);
    expect(isAdnHistoryPortMessage({ type: 'error', code: 'logged-out' })).toBe(true);
    expect(isAdnHistoryPortMessage({ type: 'error', code: 'teapot' })).toBe(false);
    expect(isAdnHistoryPortMessage({ type: 'token', token: 'x' })).toBe(false);
  });
});
