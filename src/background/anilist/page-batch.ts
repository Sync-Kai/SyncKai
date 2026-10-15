import { isRecord } from '../../shared/guards';
import type { PageMediaDetails } from '../../shared/page-media.types';
import type { RequestLane } from '../rate-limit';
import { anilistPublicQuery, anilistQuery } from './client';
import { MEDIA_LIST_ENTRY_FIELDS, toMediaListInfo, type MediaListInfo } from './list';
import { PAGE_MEDIA_FIELDS, toPageMediaDetails } from './media';

// Fiche de la page en UNE requête : la limite d'AniList compte les requêtes HTTP, pas les champs. Fiches de toutes les
// saisons du sélecteur (carte « Sur cette page ») et, compte AniList connecté, l'entrée de liste de chacune : changer de
// saison dans le menu de la page (ou dans le sélecteur) ne coûte plus ni PageMedia ni MediaEntry.
// `Page(id_in)` et non un alias `Media(id:)` par fiche : un identifiant absent (fiche supprimée ou fusionnée) fait
// répondre AniList 404 avec TOUTES les fiches à null (relevé le 2026-10-15) ; `id_in` l'ignore simplement.

/** Fiches au plus par requête (sélecteur : 12 saisons, plus la fiche retenue hors saisons) */
export const PAGE_BATCH_MAX = 25;

const batchQuery = (withEntries: boolean): string => /* GraphQL */ `
  query PageMediaBatch($ids: [Int]) {
    Page(perPage: ${PAGE_BATCH_MAX}) {
      media(id_in: $ids, type: ANIME) { ${PAGE_MEDIA_FIELDS}${withEntries ? ` ${MEDIA_LIST_ENTRY_FIELDS}` : ''} }
    }
  }
`;

const isBatchData = (data: unknown): data is { Page: { media: unknown[] } } => isRecord(data) && isRecord(data.Page) && Array.isArray(data.Page.media);

export interface PageMediaBatch {
  details: PageMediaDetails[];
  /** Entrées de liste AniList par fiche (null : non demandées) */
  entries: Map<number, MediaListInfo> | null;
}

/**
 * Fiches `ids` (et leurs entrées de liste si `withEntries`). Avec les entrées : requête authentifiée (une session
 * refusée lève TOKEN_INVALID, jamais une liste vide prise pour « pas dans la liste ») ; sans : catalogue public.
 */
export async function getPageMediaBatch(ids: readonly number[], withEntries: boolean, lane: RequestLane = 'interactive'): Promise<PageMediaBatch> {
  const wanted = [...new Set(ids)].slice(0, PAGE_BATCH_MAX);
  if (wanted.length === 0) return { details: [], entries: withEntries ? new Map() : null };
  const query = withEntries ? anilistQuery : anilistPublicQuery;
  const { Page } = await query(batchQuery(withEntries), isBatchData, { ids: wanted }, lane);
  const details: PageMediaDetails[] = [];
  const entries = withEntries ? new Map<number, MediaListInfo>() : null;
  for (const raw of Page.media) {
    const media = toPageMediaDetails(raw);
    if (!media || !isRecord(raw)) continue;
    details.push(media);
    entries?.set(media.mediaId, toMediaListInfo(media.mediaId, raw));
  }
  return { details, entries };
}
