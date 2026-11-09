import { describe, expect, it } from 'vitest';
import en from '../i18n/locales/en.json';
import { ANILIST_GENRES, genreKey } from './genres';

describe('genreKey', () => {
  it('met le nom en camelCase', () => {
    expect(genreKey('Slice of Life')).toBe('genre.sliceOfLife');
    expect(genreKey('Sci-Fi')).toBe('genre.sciFi');
    expect(genreKey('Mahou Shoujo')).toBe('genre.mahouShoujo');
    expect(genreKey('Action')).toBe('genre.action');
  });

  it('renvoie null pour un genre inconnu', () => {
    expect(genreKey('Isekai')).toBeNull();
    expect(genreKey('')).toBeNull();
  });

  it('couvre les 19 genres AniList avec des clés distinctes', () => {
    expect(ANILIST_GENRES).toHaveLength(19);
    const keys = ANILIST_GENRES.map(genreKey);
    expect(keys.every((k) => k !== null)).toBe(true);
    expect(new Set(keys).size).toBe(19);
  });

  it('chaque clé existe dans le catalogue anglais', () => {
    for (const g of ANILIST_GENRES) expect(Object.keys(en)).toContain(genreKey(g));
  });
});
