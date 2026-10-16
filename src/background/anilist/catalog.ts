import type { Catalog } from '../ports/catalog';
import { getAnimeByIds, searchAnime, searchAnimeBatch } from './media';

/** Catalogue AniList (API publique, cache du catalogue et budget de requêtes de anilist/media.ts) : catalogue par défaut */
export const anilistCatalog: Catalog = {
  search: (query, lane) => searchAnime(query, lane),
  searchBatch: (queries, lane) => searchAnimeBatch(queries, lane),
  byIds: (ids, lane) => getAnimeByIds(ids, lane),
};
