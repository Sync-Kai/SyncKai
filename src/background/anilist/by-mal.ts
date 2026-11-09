import { isRecord } from '../../shared/guards';
import { anilistPublicQuery } from './client';

// Correspondance MAL → AniList par `idMal` (comparaison des services, alertes de suite).

const CATALOG_BY_MAL_QUERY = /* GraphQL */ `
  query CompareCatalog($ids: [Int]) {
    Page(perPage: 50) {
      media(idMal_in: $ids, type: ANIME) { id idMal }
    }
  }
`;
const CATALOG_CHUNK = 50;

const isPageData = (data: unknown): data is { Page: { media: unknown[] } } =>
  isRecord(data) && isRecord(data.Page) && Array.isArray(data.Page.media);

/** Fiche AniList de chaque id MAL connu du catalogue (lots de 50, file de fond) ; les ids inconnus sont absents. Lève une ApiError. */
export async function aniListIdsByMal(malIds: readonly number[]): Promise<Map<number, number>> {
  const byMal = new Map<number, number>();
  for (let i = 0; i < malIds.length; i += CATALOG_CHUNK) {
    const { Page } = await anilistPublicQuery(CATALOG_BY_MAL_QUERY, isPageData, { ids: malIds.slice(i, i + CATALOG_CHUNK) }, 'background');
    for (const media of Page.media) {
      if (isRecord(media) && typeof media.id === 'number' && typeof media.idMal === 'number' && !byMal.has(media.idMal)) byMal.set(media.idMal, media.id);
    }
  }
  return byMal;
}
