import { describe, expect, it } from 'vitest';
import { anilistEntryWriteVariables } from '../anilist/list';
import { malEntryBody } from '../mal/client';
import { parseAniListCollection, parseMalListPage } from './compare-parse';

describe('parseAniListCollection', () => {
  it('lit toutes les listes, note 0 = pas de note, entrée illisible ignorée', () => {
    const entries = parseAniListCollection({
      lists: [
        {
          entries: [
            { status: 'REPEATING', progress: 3, score: 0, repeat: 1, media: { id: 1, idMal: 101, title: { userPreferred: 'Frieren' }, coverImage: { medium: 'https://s4.anilist.co/a.jpg' } } },
            { status: 'BOGUS', progress: 1, media: { id: 2 } },
          ],
        },
        { entries: [{ status: 'PLANNING', progress: null, score: 85, media: { id: 3, idMal: null, title: { romaji: 'Romaji' }, coverImage: { medium: 'javascript:x' } } }] },
      ],
    });
    expect(entries).toEqual([
      { mediaId: 1, malId: 101, title: 'Frieren', coverUrl: 'https://s4.anilist.co/a.jpg', status: 'REPEATING', progress: 3, score: null, repeat: 1, release: null },
      { mediaId: 3, malId: null, title: 'Romaji', coverUrl: null, status: 'PLANNING', progress: 0, score: 85, repeat: 0, release: null },
    ]);
  });

  it('release : fiche TV / TV_SHORT / ONA / MOVIE à venir ou en diffusion, sinon null ; siteUrl validée', () => {
    const media = (id: number, patch: Record<string, unknown>): unknown => ({
      status: 'PLANNING', progress: 0, media: { id, title: { userPreferred: `A${id}` }, format: 'TV', status: 'NOT_YET_RELEASED', siteUrl: `https://anilist.co/anime/${id}`, startDate: { year: 2027, month: 4, day: null }, season: 'SPRING', seasonYear: 2027, ...patch },
    });
    const entries = parseAniListCollection({
      lists: [{ entries: [media(1, {}), media(2, { siteUrl: 'javascript:alert(1)', status: 'RELEASING', season: 'BOGUS' }), media(3, { format: 'OVA' }), media(4, { status: 'FINISHED' })] }],
    });
    expect(entries.map((entry) => entry.release)).toEqual([
      { format: 'TV', status: 'NOT_YET_RELEASED', siteUrl: 'https://anilist.co/anime/1', year: 2027, month: 4, day: null, season: 'SPRING', seasonYear: 2027 },
      { format: 'TV', status: 'RELEASING', siteUrl: 'https://anilist.co/anime/2', year: 2027, month: 4, day: null, season: null, seasonYear: 2027 },
      null,
      null,
    ]);
  });
});

describe('parseMalListPage', () => {
  it('normalise statut (is_rewatching → REPEATING), note 0 et compteur', () => {
    const entries = parseMalListPage([
      {
        node: { id: 101, title: 'Sousou no Frieren', main_picture: { medium: 'https://cdn.myanimelist.net/a.jpg' } },
        list_status: { status: 'completed', is_rewatching: true, num_episodes_watched: 4, score: 0, num_times_rewatched: 2 },
      },
      { node: { id: 102, title: 'X' }, list_status: { status: 'on_hold', num_episodes_watched: 7, score: 8 } },
      { node: { id: 103, title: 'Y' }, list_status: { status: 'inconnu' } },
      { node: { id: 104 } },
    ]);
    expect(entries).toEqual([
      { malId: 101, mediaId: null, title: 'Sousou no Frieren', coverUrl: 'https://cdn.myanimelist.net/a.jpg', status: 'REPEATING', progress: 4, score: null, repeat: 2 },
      { malId: 102, mediaId: null, title: 'X', coverUrl: null, status: 'PAUSED', progress: 7, score: 8, repeat: 0 },
    ]);
  });
});

describe('écriture d’un alignement', () => {
  it('MAL : statut + is_rewatching, progression, compteur, note arrondie à l’inférieur', () => {
    expect(Object.fromEntries(malEntryBody({ status: 'REPEATING', progress: 3, repeat: 1, score: 8.5 }))).toEqual({
      status: 'completed',
      is_rewatching: 'true',
      num_watched_episodes: '3',
      num_times_rewatched: '1',
      score: '8',
    });
    expect(Object.fromEntries(malEntryBody({ status: 'PAUSED', progress: 4 }))).toEqual({ status: 'on_hold', is_rewatching: 'false', num_watched_episodes: '4' });
    expect(Object.fromEntries(malEntryBody({ status: 'PLANNING', progress: 0 }))).toMatchObject({ status: 'plan_to_watch' });
    expect(Object.fromEntries(malEntryBody({ score: 7.8 }))).toEqual({ score: '7' });
  });

  it('AniList : seuls les champs fournis, note dans le format du profil', () => {
    expect(anilistEntryWriteVariables(1, { status: 'DROPPED', progress: 2 }, 'POINT_100')).toEqual({ mediaId: 1, status: 'DROPPED', progress: 2 });
    expect(anilistEntryWriteVariables(1, { score: 7 }, 'POINT_100')).toEqual({ mediaId: 1, score: 70 });
    expect(anilistEntryWriteVariables(1, { score: 9 }, 'POINT_5')).toEqual({ mediaId: 1, score: 5 });
    expect(anilistEntryWriteVariables(1, { status: 'REPEATING', progress: 1, repeat: 2 }, 'POINT_10')).toEqual({ mediaId: 1, status: 'REPEATING', progress: 1, repeat: 2 });
  });
});
