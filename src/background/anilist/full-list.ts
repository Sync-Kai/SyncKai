import { getCachedViewer } from '../../browser/storage/viewer-cache';
import { isRecord } from '../../shared/guards';
import { parseAniListCollection } from '../compare-parse';
import { ApiError } from '../errors';
import { anilistQuery } from './client';
import { getViewer } from './viewer';

// Liste AniList complète de l'utilisateur (comparaison des services, import de l'historique).

/** 500 = maximum de `perChunk` ; chunk + hasNextChunk : listes de plus de 500 entrées */
const ANILIST_CHUNK = 500;
const MAX_ANILIST_CHUNKS = 40;

const ANILIST_FULL_LIST_QUERY = /* GraphQL */ `
  query FullList($userId: Int, $chunk: Int, $perChunk: Int) {
    MediaListCollection(userId: $userId, type: ANIME, chunk: $chunk, perChunk: $perChunk) {
      hasNextChunk
      lists {
        entries {
          status
          progress
          score
          repeat
          media {
            id
            idMal
            title { userPreferred romaji english }
            coverImage { medium }
          }
        }
      }
    }
  }
`;

const isCollectionData = (data: unknown): data is { MediaListCollection: Record<string, unknown> } =>
  isRecord(data) && isRecord(data.MediaListCollection);

async function getAniListUserId(): Promise<number> {
  const cached = await getCachedViewer();
  if (cached) return cached.id;
  const result = await getViewer();
  if (!result.ok) throw new ApiError(result.code, result.message);
  return result.data.id;
}

/** Liste complète : requêtes de fond (comparaison, import Crunchyroll), budget limité */
export async function fetchAniListFullList(): Promise<ReturnType<typeof parseAniListCollection>> {
  const userId = await getAniListUserId();
  const entries: ReturnType<typeof parseAniListCollection> = [];
  for (let chunk = 1; chunk <= MAX_ANILIST_CHUNKS; chunk++) {
    const { MediaListCollection } = await anilistQuery(ANILIST_FULL_LIST_QUERY, isCollectionData, { userId, chunk, perChunk: ANILIST_CHUNK }, 'background');
    entries.push(...parseAniListCollection(MediaListCollection));
    if (MediaListCollection.hasNextChunk !== true) break;
  }
  return entries;
}
