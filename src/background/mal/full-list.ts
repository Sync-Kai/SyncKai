import { isRecord } from '../../shared/guards';
import { parseMalListPage } from '../compare-parse';
import type { MalListEntry } from '../../shared/compare';
import { malRequest } from './client';

// Liste MyAnimeList complète de l'utilisateur (comparaison des services, import de l'historique).

/** limit=1000 = maximum de l'endpoint ; nsfw=true : sinon MAL omet les fiches NSFW */
const MAL_PAGE = 1000;
const MAX_MAL_PAGES = 20;
const MAL_FULL_LIST_PATH =
  '/users/@me/animelist?nsfw=true&fields=list_status{status,score,num_episodes_watched,is_rewatching,num_times_rewatched,updated_at},num_episodes,main_picture';

const isMalListData = (data: unknown): data is { data: unknown[]; paging?: unknown } => isRecord(data) && Array.isArray(data.data);

export async function fetchMalFullList(): Promise<MalListEntry[]> {
  const entries: MalListEntry[] = [];
  for (let page = 0; page < MAX_MAL_PAGES; page++) {
    const result = await malRequest(`${MAL_FULL_LIST_PATH}&limit=${MAL_PAGE}&offset=${page * MAL_PAGE}`, isMalListData);
    entries.push(...parseMalListPage(result.data));
    const hasNext = isRecord(result.paging) && typeof result.paging.next === 'string';
    if (!hasNext || result.data.length < MAL_PAGE) break;
  }
  return entries;
}
