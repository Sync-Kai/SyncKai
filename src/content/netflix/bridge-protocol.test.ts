import { describe, expect, it } from 'vitest';
import {
  decodeNetflixRequest,
  decodeNetflixResponse,
  encodeNetflixRequest,
  encodeNetflixResponse,
  isNetflixShowMetadata,
  NETFLIX_MAX_EPISODES,
  NETFLIX_MAX_TEXT,
  reduceNetflixMetadata,
  type NetflixShowMetadata,
} from './bridge-protocol';
import { mushokuRawResponse } from './fixtures';

describe('reduceNetflixMetadata', () => {
  it('réduit la réponse Mushoku Tensei (2 saisons, 23 + 25 épisodes) aux seuls champs utiles', () => {
    const show = reduceNetflixMetadata(mushokuRawResponse());
    expect(show).not.toBeNull();
    if (!show) return;
    expect(Object.keys(show).sort()).toEqual(['creditsOffset', 'runtime', 'seasons', 'showId', 'title', 'type']);
    expect(show).toMatchObject({ showId: '80987039', type: 'show', title: 'Mushoku Tensei: Jobless Reincarnation', runtime: null, creditsOffset: null });
    expect(show.seasons.map((s) => [s.seq, s.title, s.episodes.length])).toEqual([
      [1, 'Season 1', 23],
      [2, 'Season 2', 25],
    ]);
    const [season] = show.seasons;
    expect(Object.keys(season).sort()).toEqual(['episodes', 'seq', 'title']);
    expect(season.episodes[14]).toEqual({ id: '81402901', seq: 15, title: 'Episode 15 title', runtime: 1422, creditsOffset: 1329 });
    expect(Object.keys(season.episodes[0]).sort()).toEqual(['creditsOffset', 'id', 'runtime', 'seq', 'title']);
    // Aucune donnée de compte, image, synopsis ni marqueur ne passe
    const serialized = JSON.stringify(show);
    for (const leaked of ['authURL', 'should-never-leak', 'synopsis', 'Synopsis', 'nflxso', 'skipMarkers', 'bookmark', 'matchScore']) {
      expect(serialized).not.toContain(leaked);
    }
    expect(isNetflixShowMetadata(show)).toBe(true);
  });

  it('film : durée et générique au niveau de la vidéo, aucune saison', () => {
    const show = reduceNetflixMetadata({ video: { id: '81000001', type: 'movie', title: 'Suzume', runtime: 7320, creditsOffset: 7010, seasons: [] } });
    expect(show).toEqual({ showId: '81000001', type: 'movie', title: 'Suzume', runtime: 7320, creditsOffset: 7010, seasons: [] });
  });

  it('tronque les textes à 300 caractères et limite le nombre total d’épisodes', () => {
    const long = 'x'.repeat(1000);
    const raw = {
      video: {
        id: 1,
        type: 'show',
        title: long,
        seasons: [
          { seq: 1, title: long, episodes: Array.from({ length: 1500 }, (_, i) => ({ id: 10_000 + i, seq: i + 1, title: long })) },
          { seq: 2, title: 'Season 2', episodes: Array.from({ length: 1500 }, (_, i) => ({ id: 20_000 + i, seq: i + 1 })) },
        ],
      },
    };
    const show = reduceNetflixMetadata(raw);
    expect(show?.title).toHaveLength(NETFLIX_MAX_TEXT);
    expect(show?.seasons[0].title).toHaveLength(NETFLIX_MAX_TEXT);
    expect(show?.seasons[0].episodes[0].title).toHaveLength(NETFLIX_MAX_TEXT);
    expect(show?.seasons.reduce((n, s) => n + s.episodes.length, 0)).toBe(NETFLIX_MAX_EPISODES);
    expect(isNetflixShowMetadata(show)).toBe(true);
  });

  it('ignore les épisodes sans identifiant et complète un numéro absent par la position', () => {
    const show = reduceNetflixMetadata({
      video: { id: 5, type: 'show', title: 'T', seasons: [{ seq: 1, title: null, episodes: [{ seq: 1 }, { id: 'abc' }, { id: 7, runtime: -3, creditsOffset: 'x' }] }] },
    });
    expect(show?.seasons[0].episodes).toEqual([{ id: '7', seq: 3, title: null, runtime: null, creditsOffset: null }]);
  });

  it.each([
    null,
    'texte',
    {},
    { video: null },
    { video: { id: 1, type: 'show', title: 'T' } }, // saisons absentes
    { video: { id: 1, type: 'supplemental', title: 'T', seasons: [] } },
    { video: { id: 'abc', type: 'movie', title: 'T' } },
    { video: { id: 1, type: 'movie', title: '   ' } },
  ])('entrée invalide → null (%#)', (raw) => {
    expect(reduceNetflixMetadata(raw)).toBeNull();
  });
});

describe('isNetflixShowMetadata', () => {
  const valid: NetflixShowMetadata = {
    showId: '1',
    type: 'show',
    title: 'T',
    runtime: null,
    creditsOffset: null,
    seasons: [{ seq: 1, title: null, episodes: [{ id: '2', seq: 1, title: null, runtime: 1400, creditsOffset: 1300 }] }],
  };
  const manyEpisodes = Array.from({ length: NETFLIX_MAX_EPISODES + 1 }, (_, i) => ({ id: String(i), seq: 1, title: null, runtime: null, creditsOffset: null }));

  it('accepte la forme réduite', () => {
    expect(isNetflixShowMetadata(valid)).toBe(true);
  });

  it.each([
    { ...valid, showId: 'abc' },
    { ...valid, type: 'episode' },
    { ...valid, title: '' },
    { ...valid, title: 'x'.repeat(NETFLIX_MAX_TEXT + 1) },
    { ...valid, runtime: -1 },
    { ...valid, seasons: 'non' },
    { ...valid, seasons: [{ seq: 1, title: null, episodes: [{ id: '2', seq: -1, title: null, runtime: null, creditsOffset: null }] }] },
    { ...valid, seasons: [{ seq: 1, title: null, episodes: manyEpisodes }] },
  ])('rejette une forme invalide (%#)', (value) => {
    expect(isNetflixShowMetadata(value)).toBe(false);
  });
});

describe('messages du pont (chaînes JSON)', () => {
  const show = reduceNetflixMetadata(mushokuRawResponse());

  it('requête : aller-retour et validation', () => {
    const detail = encodeNetflixRequest({ v: 1, id: 'abc', movieId: '81402901' });
    expect(typeof detail).toBe('string');
    expect(decodeNetflixRequest(detail)).toEqual({ v: 1, id: 'abc', movieId: '81402901' });
    // Objet : refusé (detail toujours en chaîne, Xray Firefox)
    expect(decodeNetflixRequest({ v: 1, id: 'abc', movieId: '81402901' })).toBeNull();
    expect(decodeNetflixRequest(JSON.stringify({ v: 2, id: 'abc', movieId: '1' }))).toBeNull();
    expect(decodeNetflixRequest(JSON.stringify({ v: 1, id: 'abc', movieId: '../1' }))).toBeNull();
    expect(decodeNetflixRequest(JSON.stringify({ v: 1, id: 'abc', movieId: '1234567890123' }))).toBeNull();
    expect(decodeNetflixRequest('{pas du json')).toBeNull();
  });

  it('réponse : succès revalidé, erreurs typées', () => {
    if (!show) throw new Error('fixture invalide');
    expect(decodeNetflixResponse(encodeNetflixResponse({ v: 1, id: 'r1', ok: true, data: show }))).toEqual({ v: 1, id: 'r1', ok: true, data: show });
    expect(decodeNetflixResponse(encodeNetflixResponse({ v: 1, id: 'r2', ok: false, error: 'http', status: 404 }))).toEqual({
      v: 1,
      id: 'r2',
      ok: false,
      error: 'http',
      status: 404,
    });
    expect(decodeNetflixResponse(encodeNetflixResponse({ v: 1, id: 'r3', ok: false, error: 'network' }))).toEqual({ v: 1, id: 'r3', ok: false, error: 'network' });
    // Données forgées par la page : rejetées
    expect(decodeNetflixResponse(JSON.stringify({ v: 1, id: 'r4', ok: true, data: { showId: 'x' } }))).toBeNull();
    expect(decodeNetflixResponse(JSON.stringify({ v: 1, id: 'r5', ok: false, error: 'autre' }))).toBeNull();
    expect(decodeNetflixResponse(42)).toBeNull();
  });
});
