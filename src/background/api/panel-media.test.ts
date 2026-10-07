import { describe, expect, it } from 'vitest';
import { isPanelMedia } from '../../shared/panel-media.types';
import { parsePanelMedia } from './panel-media';

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
      { relationType: 'SEQUEL', node: { id: 182255, type: 'ANIME', format: 'TV', title: { userPreferred: 'Frieren 2' }, coverImage: { medium: 'https://s4.anilist.co/m.jpg' }, siteUrl: 'https://anilist.co/anime/182255' } },
      { relationType: 'SIDE_STORY', node: { id: 3, type: 'ANIME', format: 'ONA', title: { userPreferred: 'Mini' }, coverImage: null, siteUrl: 'https://evil.example/anime/3' } },
      { relationType: 'PREQUEL', node: { id: 2, type: 'ANIME', format: 'TV', title: { userPreferred: 'Avant' }, coverImage: { medium: 'http://insecure/c.jpg' }, siteUrl: 'https://anilist.co/anime/2' } },
      { relationType: 'CHARACTER', node: { id: 4, type: 'ANIME', format: 'TV', title: { userPreferred: 'Autre' }, siteUrl: 'https://anilist.co/anime/4' } },
    ],
  },
};

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
  });
});
