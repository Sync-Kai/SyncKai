export const ANILIST_GENRES = ['Action', 'Adventure', 'Comedy', 'Drama', 'Ecchi', 'Fantasy', 'Hentai', 'Horror', 'Mahou Shoujo', 'Mecha', 'Music', 'Mystery', 'Psychological', 'Romance', 'Sci-Fi', 'Slice of Life', 'Sports', 'Supernatural', 'Thriller'] as const;

const KNOWN: ReadonlySet<string> = new Set(ANILIST_GENRES);

// « Slice of Life » → « genre.sliceOfLife », « Sci-Fi » → « genre.sciFi ». Retourne `string` (et non `MessageKey`) tant que les clés ne sont pas dans les catalogues.
export function genreKey(name: string): string | null {
  if (!KNOWN.has(name)) return null;
  const words = name.split(/[^A-Za-z0-9]+/).filter(Boolean);
  return 'genre.' + words.map((w, i) => (i === 0 ? w.toLowerCase() : w[0].toUpperCase() + w.slice(1).toLowerCase())).join('');
}
