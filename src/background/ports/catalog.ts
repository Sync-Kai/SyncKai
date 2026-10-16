import type { AniListMedia } from '../anilist/media';
import type { RequestLane } from '../rate-limit';

/**
 * Catalogue d'anime lu par la correspondance (port, audit 1-§4.3) : recherches par titre et fiches par identifiant. AniList
 * aujourd'hui (anilist/catalog.ts, cache et budget de requêtes compris) ; injecté en paramètre par défaut dans la collecte
 * des candidats et la résolution (sync/candidates.ts, sync/resolver.ts), sans conteneur : un test passe un faux catalogue.
 */
export interface Catalog {
  /** Fiches trouvées pour une recherche par titre, dans l'ordre de pertinence */
  search(query: string, lane: RequestLane): Promise<AniListMedia[]>;
  /** Plusieurs recherches en une requête (pré-chargement de l'analyse d'un historique) : mêmes clés de cache que `search` */
  searchBatch(queries: readonly string[], lane: RequestLane): Promise<ReadonlyMap<string, AniListMedia[]>>;
  /** Fiches par identifiant (suites / préquelles absentes des recherches, fiche d'une correspondance en cache) */
  byIds(ids: readonly number[], lane: RequestLane): Promise<AniListMedia[]>;
}
