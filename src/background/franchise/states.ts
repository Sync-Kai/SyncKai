import { connectedServices } from '../../browser/airing-alarm';
import { getOpenSessions } from '../../browser/storage/sessions';
import { createLogger } from '../../browser/logger';
import { isRecord } from '../../shared/guards';
import { MAX_EXTRAS, MAX_MAIN, toListState, type ListState, type ListStates } from '../../shared/franchise';
import type { TrackerId } from '../../shared/tracker.types';
import { anilistQuery } from '../anilist/client';
import { fetchMalFullList } from '../mal/full-list';

// États de liste de l'utilisateur pour les entrées d'une franchise (panneau « Ordre de visionnage ») : lecture seule,
// rien n'est stocké. AniList : une requête authentifiée par tranche de 50 ; MAL : sa liste complète (la sienne
// seulement), les statuts MAL étant déjà convertis en statuts communs par parseMalListPage.

const log = createLogger('franchise');

const PAGE_SIZE = 50;
/** Identifiants lus au plus par service : entrées principales plus extras */
const MAX_IDS = MAX_MAIN + MAX_EXTRAS;

const STATES_QUERY = /* GraphQL */ `
  query ListStates($ids: [Int]) {
    Page(perPage: ${PAGE_SIZE}) {
      media(id_in: $ids, type: ANIME) { id mediaListEntry { status progress } }
    }
  }
`;

const isStatesData = (data: unknown): data is { Page: { media: unknown[] } } => isRecord(data) && isRecord(data.Page) && Array.isArray(data.Page.media);

async function readAnilist(ids: readonly number[]): Promise<Record<number, ListState>> {
  // Hors liste (ou fiche absente) = null
  const states: Record<number, ListState> = Object.fromEntries(ids.map((id) => [id, null]));
  for (let from = 0; from < ids.length; from += PAGE_SIZE) {
    const { Page } = await anilistQuery(STATES_QUERY, isStatesData, { ids: ids.slice(from, from + PAGE_SIZE) }, 'background');
    for (const media of Page.media) {
      if (isRecord(media) && typeof media.id === 'number' && isRecord(media.mediaListEntry)) {
        states[media.id] = toListState(media.mediaListEntry.status, media.mediaListEntry.progress);
      }
    }
  }
  return states;
}

async function readMal(ids: readonly number[]): Promise<Record<number, ListState>> {
  const wanted = new Set(ids);
  const states: Record<number, ListState> = Object.fromEntries(ids.map((id) => [id, null]));
  for (const entry of await fetchMalFullList()) if (wanted.has(entry.malId)) states[entry.malId] = toListState(entry.status, entry.progress);
  return states;
}

/** Lecture d'un service ; null en cas d'échec (le panneau affiche alors la franchise sans états) */
async function settle(service: TrackerId, read: () => Promise<Record<number, ListState>>): Promise<Record<number, ListState> | null> {
  try {
    return await read();
  } catch (error: unknown) {
    log.warn(`Lecture des états ${service} impossible`, error);
    return null;
  }
}

export async function loadListStates(payload: { mediaIds: readonly number[]; malIds: readonly number[] }): Promise<ListStates> {
  const [connected, before] = await Promise.all([connectedServices(), getOpenSessions()]);
  const mediaIds = [...new Set(payload.mediaIds)].slice(0, MAX_IDS);
  const malIds = [...new Set(payload.malIds)].slice(0, MAX_IDS);
  const [anilist, mal] = await Promise.all([
    connected.includes('anilist') ? settle('anilist', () => readAnilist(mediaIds)) : null,
    connected.includes('mal') ? settle('mal', () => readMal(malIds)) : null,
  ]);
  // Compte changé pendant la lecture : les états lus appartiennent peut-être à un autre compte, jamais servis
  const after = await getOpenSessions();
  return { anilist: before.anilist === after.anilist ? anilist : null, mal: before.mal === after.mal ? mal : null };
}
