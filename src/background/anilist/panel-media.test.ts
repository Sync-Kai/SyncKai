import { describe, expect, it } from 'vitest';
import { isPanelMedia } from '../../shared/panel-media.types';
import type { EpisodeInfo } from '../../shared/episode.types';
import type { RecentSync } from '../../shared/review.types';
import { choosePlatformLink } from '../../shared/watching';
import { PANEL_MEDIA_CACHE_VERSION, panelMediaCacheKey, parsePanelMedia, withHistoryLinks } from './panel-media';

const full = {
  id: 154587,
  idMal: 52991,
  siteUrl: 'https://anilist.co/anime/154587',
  bannerImage: 'https://s4.anilist.co/file/anilistcdn/media/anime/banner/154587.jpg',
  coverImage: { extraLarge: 'https://s4.anilist.co/xl.jpg', large: 'https://s4.anilist.co/l.jpg', color: '#d6e4a1' },
  description: 'Elfe &amp; mage.<br><br><i>(Source: Crunchyroll)</i>',
  genres: ['Adventure', 'Drama', 'Fantasy'],
  averageScore: 91,
  season: 'FALL',
  seasonYear: 2023,
  format: 'TV',
  episodes: 28,
  status: 'FINISHED',
  nextAiringEpisode: null,
  studios: { nodes: [{ name: 'Madhouse', siteUrl: 'https://anilist.co/studio/11' }] },
  title: { romaji: 'Sousou no Frieren', english: "Frieren: Beyond Journey's End", userPreferred: 'Sousou no Frieren' },
  relations: {
    edges: [
      { relationType: 'ADAPTATION', node: { id: 1, type: 'MANGA', format: 'MANGA', title: { userPreferred: 'Manga' }, coverImage: { medium: null }, siteUrl: 'https://anilist.co/manga/1' } },
      {
        relationType: 'SEQUEL',
        node: {
          id: 182255,
          idMal: 59978,
          type: 'ANIME',
          format: 'TV',
          status: 'NOT_YET_RELEASED',
          startDate: { year: 2026, month: 10, day: null },
          season: 'FALL',
          seasonYear: 2026,
          title: { userPreferred: 'Frieren 2' },
          coverImage: { medium: 'https://s4.anilist.co/m.jpg' },
          siteUrl: 'https://anilist.co/anime/182255',
          externalLinks: [
            { url: 'https://www.netflix.com/title/1' },
            { url: 'javascript:alert(1)' },
            { url: 'https://animationdigitalnetwork.com/video/1234-frieren' },
            { url: 'https://www.crunchyroll.com/series/GG5H5XQ7D/frieren' },
            { url: 'https://www.crunchyroll.com/series/OTHER' },
          ],
        },
      },
      { relationType: 'SIDE_STORY', node: { id: 3, type: 'ANIME', format: 'ONA', title: { userPreferred: 'Mini' }, coverImage: null, siteUrl: 'https://evil.example/anime/3' } },
      { relationType: 'PREQUEL', node: { id: 2, type: 'ANIME', format: 'TV', title: { userPreferred: 'Avant' }, coverImage: { medium: 'http://insecure/c.jpg' }, siteUrl: 'https://anilist.co/anime/2' } },
      { relationType: 'CHARACTER', node: { id: 4, type: 'ANIME', format: 'TV', title: { userPreferred: 'Autre' }, siteUrl: 'https://anilist.co/anime/4' } },
    ],
  },
};

const recoNode = (id: number, over: Record<string, unknown> = {}): Record<string, unknown> => ({
  id,
  idMal: id + 1000,
  isAdult: false,
  title: { userPreferred: `Reco ${id}` },
  coverImage: { medium: `https://s4.anilist.co/r${id}.jpg` },
  siteUrl: `https://anilist.co/anime/${id}`,
  format: 'TV',
  startDate: { year: 2020 },
  externalLinks: [{ url: 'https://www.crunchyroll.com/series/GG5H5XQ7D/reco' }],
  relations: { edges: [{ relationType: 'PREQUEL', node: { id: id + 500, idMal: id + 1500 } }, { relationType: 'SIDE_STORY', node: { id: 9 } }, { relationType: 'PREQUEL', node: null }, { relationType: 'PREQUEL', node: { id: id + 600, idMal: null } }] },
  ...over,
});

describe('parsePanelMedia : recommandations (« Dans le même esprit »)', () => {
  it('garde au plus 8 recommandations, ordre d’AniList, champs de la ligne et préquels', () => {
    const nodes = Array.from({ length: 10 }, (_, i) => ({ rating: 50 - i, mediaRecommendation: recoNode(i + 10) }));
    const recos = parsePanelMedia({ ...full, recommendations: { nodes } })?.recommendations ?? [];
    expect(recos).toHaveLength(8);
    expect(recos[0]).toEqual({
      mediaId: 10,
      idMal: 1010,
      title: 'Reco 10',
      format: 'TV',
      startYear: 2020,
      coverUrl: 'https://s4.anilist.co/r10.jpg',
      siteUrl: 'https://anilist.co/anime/10',
      rating: 50,
      platforms: [{ platform: 'crunchyroll', url: 'https://www.crunchyroll.com/series/GG5H5XQ7D/reco' }],
      prequelIds: [510, 610],
      prequelMalIds: [1510, null],
    });
    expect(recos.map((r) => r.mediaId)).toEqual([10, 11, 12, 13, 14, 15, 16, 17]);
  });

  it('écarte les adultes, les nœuds sans fiche ou sans identifiant, les doublons', () => {
    const nodes = [
      { rating: 9, mediaRecommendation: recoNode(1, { isAdult: true }) },
      { rating: 8, mediaRecommendation: null },
      { rating: 7, mediaRecommendation: { title: { userPreferred: 'x' } } },
      { rating: 6, mediaRecommendation: recoNode(2) },
      { rating: 5, mediaRecommendation: recoNode(2) },
      { rating: 4, mediaRecommendation: recoNode(154587) },
    ];
    expect(parsePanelMedia({ ...full, recommendations: { nodes } })?.recommendations.map((r) => r.mediaId)).toEqual([2]);
  });

  it('sans recommandations ou données invalides : liste vide', () => {
    expect(parsePanelMedia(full)?.recommendations).toEqual([]);
    expect(parsePanelMedia({ ...full, recommendations: { nodes: 'x' } })?.recommendations).toEqual([]);
  });

  it('cache : une fiche sans recommandations (cache v5, sans préquels MAL) est rejetée, la version a changé', () => {
    expect(PANEL_MEDIA_CACHE_VERSION).toBeGreaterThanOrEqual(6);
    const media = parsePanelMedia(full);
    if (!media) throw new Error('fiche absente');
    const { recommendations: _r, ...legacy } = media;
    expect(isPanelMedia(legacy)).toBe(false);
    expect(isPanelMedia(media)).toBe(true);
    const withReco = parsePanelMedia({ ...full, recommendations: { nodes: [{ rating: 3, mediaRecommendation: recoNode(2) }] } });
    expect(isPanelMedia(withReco)).toBe(true);
    expect(isPanelMedia({ ...media, recommendations: [{ mediaId: 1 }] })).toBe(false);
    const noMal = (withReco?.recommendations ?? []).map(({ prequelMalIds: _p, ...rest }) => rest);
    expect(isPanelMedia({ ...withReco, recommendations: noMal })).toBe(false);
    expect(panelMediaCacheKey(1)).not.toContain('v5:');
  });
});

describe('parsePanelMedia (GET_PANEL_MEDIA)', () => {
  it('normalise une réponse complète', () => {
    const media = parsePanelMedia(full);
    expect(media).toMatchObject({
      mediaId: 154587,
      idMal: 52991,
      title: 'Sousou no Frieren',
      romajiTitle: 'Sousou no Frieren',
      englishTitle: "Frieren: Beyond Journey's End",
      bannerUrl: 'https://s4.anilist.co/file/anilistcdn/media/anime/banner/154587.jpg',
      coverUrl: 'https://s4.anilist.co/xl.jpg',
      coverColor: '#d6e4a1',
      description: 'Elfe & mage.\n\n(Source: Crunchyroll)',
      genres: ['Adventure', 'Drama', 'Fantasy'],
      averageScore: 91,
      season: 'FALL',
      seasonYear: 2023,
      airingStatus: 'FINISHED',
      nextEpisode: null,
      studio: { name: 'Madhouse', siteUrl: 'https://anilist.co/studio/11' },
    });
    expect(media && isPanelMedia(media)).toBe(true);
  });

  it('relations : animes uniquement, types affichés, triées, URLs sûres', () => {
    const relations = parsePanelMedia(full)?.relations ?? [];
    expect(relations.map((r) => [r.relationType, r.mediaId])).toEqual([
      ['PREQUEL', 2],
      ['SEQUEL', 182255],
      ['SIDE_STORY', 3],
    ]);
    expect(relations[0].coverUrl).toBeNull(); // http refusé
    expect(relations[2].siteUrl).toBe('https://anilist.co/anime/3'); // domaine étranger remplacé
  });

  it('relations : fiche MyAnimeList équivalente si connue (lien du titre), sinon null', () => {
    const relations = parsePanelMedia(full)?.relations ?? [];
    expect(relations.map((r) => [r.mediaId, r.idMal])).toEqual([
      [2, null],
      [182255, 59978],
      [3, null],
    ]);
  });

  it('champs absents ou invalides → null / []', () => {
    const media = parsePanelMedia({ id: 7, coverImage: { color: 'red;background:url(x)' }, season: 'MONSOON', genres: [1, null, 'Action'], studios: { nodes: [{}] } });
    expect(media).toEqual({
      mediaId: 7,
      idMal: null,
      siteUrl: 'https://anilist.co/anime/7',
      title: '#7',
      romajiTitle: null,
      englishTitle: null,
      bannerUrl: null,
      coverUrl: null,
      coverColor: null,
      description: null,
      genres: ['Action'],
      averageScore: null,
      season: null,
      seasonYear: null,
      format: null,
      episodes: null,
      airingStatus: null,
      nextEpisode: null,
      studio: null,
      relations: [],
      recommendations: [],
    });
    expect(media && isPanelMedia(media)).toBe(true);
  });

  it('prochain épisode converti en millisecondes', () => {
    expect(parsePanelMedia({ id: 7, nextAiringEpisode: { episode: 6, airingAt: 1_800_000_000 } })?.nextEpisode).toEqual({ episode: 6, airingAt: 1_800_000_000_000 });
  });

  it('null sans identifiant', () => {
    expect(parsePanelMedia(null)).toBeNull();
    expect(parsePanelMedia({ id: '7' })).toBeNull();
    expect(parsePanelMedia({ id: 0 })).toBeNull();
  });

  it('cache de session : une fiche d’un autre format est rejetée', () => {
    expect(isPanelMedia({ mediaId: 7 })).toBe(false);
    expect(isPanelMedia({ ...parsePanelMedia(full), relations: [{ relationType: 'ADAPTATION' }] })).toBe(false);
    // Relation d'avant l'ajout de idMal (cache v2) : rejetée
    const relations = (parsePanelMedia(full)?.relations ?? []).map(({ idMal: _idMal, ...rest }) => rest);
    expect(isPanelMedia({ ...parsePanelMedia(full), relations })).toBe(false);
  });
});

describe('liens « Regarder » des relations', () => {
  const episode = (platform: EpisodeInfo['platform'], url: string): EpisodeInfo => ({
    platform,
    episodeId: 'E1',
    seriesId: null,
    seriesSlug: null,
    animeTitle: 'T',
    seasonNumber: null,
    seasonTitle: null,
    seasonEpisodeNumber: 1,
    displayedEpisodeNumber: 1,
    episodeTitle: null,
    url,
  });
  const sync = (mediaId: number, platform: EpisodeInfo['platform'], url: string, syncedAt: number): RecentSync => ({
    key: `${mediaId}-${platform}`,
    episode: episode(platform, url),
    mediaId,
    mediaTitle: 'T',
    progress: 1,
    syncedAt,
  });
  const relation = (id: number) => parsePanelMedia(full)?.relations.find((r) => r.mediaId === id);

  it('liens Crunchyroll / ADN / Netflix extraits d’AniList : https, un par plateforme, autres sites ignorés', () => {
    expect(relation(182255)?.platforms).toEqual([
      { platform: 'netflix', url: 'https://www.netflix.com/title/1' },
      { platform: 'adn', url: 'https://animationdigitalnetwork.com/video/1234-frieren' },
      { platform: 'crunchyroll', url: 'https://www.crunchyroll.com/series/GG5H5XQ7D/frieren' },
    ]);
    expect(relation(2)?.platforms).toEqual([]);
  });

  it('lecteur préféré respecté, sinon première plateforme disponible', () => {
    const sequel = relation(182255);
    if (!sequel) throw new Error('relation absente');
    expect(choosePlatformLink(sequel, 'crunchyroll')?.platform).toBe('crunchyroll');
    expect(choosePlatformLink(sequel, 'adn')?.platform).toBe('adn');
    expect(choosePlatformLink({ platforms: [sequel.platforms[2]] }, 'adn')?.platform).toBe('crunchyroll');
    expect(choosePlatformLink(sequel, 'netflix')?.platform).toBe('netflix');
    // Repli dans l’ordre fixe des plateformes (Crunchyroll, ADN, Netflix), pas dans l’ordre des liens AniList
    expect(choosePlatformLink({ platforms: [sequel.platforms[0], sequel.platforms[1]] }, 'crunchyroll')?.platform).toBe('adn');
    expect(choosePlatformLink({ platforms: [] }, 'adn')).toBeNull();
  });

  it('historique SyncKai en complément (plateforme absente d’AniList seulement)', () => {
    const media = parsePanelMedia(full);
    if (!media) throw new Error('fiche absente');
    const enriched = withHistoryLinks(media, [
      sync(2, 'crunchyroll', 'https://www.crunchyroll.com/watch/E9/avant', 3),
      sync(182255, 'crunchyroll', 'https://www.crunchyroll.com/watch/E1/frieren-2', 2),
      sync(999, 'adn', 'https://animationdigitalnetwork.com/video/1/x', 1),
    ]);
    expect(enriched.relations.find((r) => r.mediaId === 2)?.platforms).toEqual([{ platform: 'crunchyroll', url: 'https://www.crunchyroll.com/watch/E9/avant' }]);
    // Lien AniList déjà présent pour Crunchyroll : conservé
    expect(enriched.relations.find((r) => r.mediaId === 182255)?.platforms).toEqual(media.relations.find((r) => r.mediaId === 182255)?.platforms);
    expect(withHistoryLinks(media, [])).toBe(media);
    expect(isPanelMedia(enriched)).toBe(true);
  });

  it('liens appris : après AniList, avant l’historique ; la fiche en cache reste inchangée', () => {
    const media = parsePanelMedia(full);
    if (!media) throw new Error('fiche absente');
    const learnedAdn = 'https://animationdigitalnetwork.com/video/42-avant';
    const enriched = withHistoryLinks(media, [sync(2, 'adn', 'https://animationdigitalnetwork.com/video/42-avant/7-ep', 3)], {
      '2': { links: { adn: learnedAdn }, updatedAt: 1 },
    });
    expect(enriched.relations.find((r) => r.mediaId === 2)?.platforms).toEqual([{ platform: 'adn', url: learnedAdn }]);
    expect(choosePlatformLink(enriched.relations.find((r) => r.mediaId === 2) ?? { platforms: [] }, 'adn')?.url).toBe(learnedAdn);
    expect(media.relations.find((r) => r.mediaId === 2)?.platforms).toEqual([]);
  });

  it('relations : statut, date de début et saison conservés (null si absents)', () => {
    const relations = parsePanelMedia(full)?.relations ?? [];
    const sequel = relations.find((r) => r.mediaId === 182255);
    expect(sequel).toMatchObject({ status: 'NOT_YET_RELEASED', startYear: 2026, startMonth: 10, startDay: null, season: 'FALL', seasonYear: 2026 });
    const prequel = relations.find((r) => r.mediaId === 2);
    expect(prequel).toMatchObject({ status: null, startYear: null, startMonth: null, startDay: null, season: null, seasonYear: null });
  });

  it('cache : une relation d’avant le statut (cache v3) est rejetée, la version a changé', () => {
    expect(PANEL_MEDIA_CACHE_VERSION).toBeGreaterThanOrEqual(4);
    const media = parsePanelMedia(full);
    if (!media) throw new Error('fiche absente');
    const legacy = { ...media, relations: media.relations.map(({ status: _s, ...rest }) => rest) };
    expect(isPanelMedia(legacy)).toBe(false);
    expect(panelMediaCacheKey(1)).not.toContain('v3:');
  });

  it('cache versionné : clé v2, et une fiche sans liens de plateformes est rejetée', () => {
    expect(PANEL_MEDIA_CACHE_VERSION).toBeGreaterThanOrEqual(2);
    expect(panelMediaCacheKey(154587)).toBe(`panelMedia:v${PANEL_MEDIA_CACHE_VERSION}:154587`);
    const media = parsePanelMedia(full);
    if (!media) throw new Error('fiche absente');
    const legacy = { ...media, relations: media.relations.map(({ platforms: _, ...rest }) => rest) };
    expect(isPanelMedia(legacy)).toBe(false);
    expect(isPanelMedia({ ...media, relations: [{ ...media.relations[0], platforms: [{ platform: 'hidive', url: 'x' }] }] })).toBe(false);
  });
});
