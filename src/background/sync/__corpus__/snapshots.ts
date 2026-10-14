import { asSnapshot, type AniListSnapshot, type CorpusMedia } from './types';

// Instantanés AniList du corpus (anilist/*.json, relevés par scripts/refresh-anilist-corpus.ts), réunis en un seul
// catalogue : les recherches et fiches de toutes les franchises répondent à tous les cas (One Piece sert à plusieurs).

const files = import.meta.glob<unknown>('./anilist/*.json', { eager: true, import: 'default' });

/** Instantanés par nom de fichier (sans extension) */
export const SNAPSHOTS: ReadonlyMap<string, AniListSnapshot> = new Map(
  Object.entries(files).map(([path, value]) => {
    const name = path.replace(/^.*\/([^/]+)\.json$/, '$1');
    return [name, asSnapshot(name, value)];
  }),
);

export interface CorpusCatalog {
  /** Recherche exacte → fiches dans l'ordre de l'API ; null : à relever */
  searches: ReadonlyMap<string, number[] | null>;
  /** Identifiants triés joints par « , » → fiches renvoyées ; null : à relever */
  byIds: ReadonlyMap<string, number[] | null>;
  media: ReadonlyMap<number, CorpusMedia>;
}

function buildCatalog(): CorpusCatalog {
  const searches = new Map<string, number[] | null>();
  const byIds = new Map<string, number[] | null>();
  const media = new Map<number, CorpusMedia>();
  for (const snapshot of SNAPSHOTS.values()) {
    for (const [query, ids] of Object.entries(snapshot.searches)) if (searches.get(query) == null) searches.set(query, ids);
    for (const [key, ids] of Object.entries(snapshot.byIds)) if (byIds.get(key) == null) byIds.set(key, ids);
    for (const entry of snapshot.media) media.set(entry.id, entry);
  }
  return { searches, byIds, media };
}

export const CATALOG: CorpusCatalog = buildCatalog();

/** Clé `byIds` d'une requête getAnimeByIds */
export const byIdsKey = (ids: readonly number[]): string => [...ids].sort((a, b) => a - b).join(',');
