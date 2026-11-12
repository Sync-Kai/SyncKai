import { isRecord } from '../../shared/guards';
import { toSafeImageUrl, toSafeUrl } from '../../shared/url';
import { getExcludedSeries, isEntryExcluded } from '../../shared/exclusions';
import { listedQualifies, parseRelease, type InLists, type ListedEntry, type RelationEdge, type SourceSeries } from '../../shared/sequels';
import type { MalListEntry } from '../../shared/compare';
import type { TrackerId } from '../../shared/tracker.types';
import { aniListIdsByMal } from '../anilist/by-mal';
import { anilistPublicQuery } from '../anilist/client';
import { fetchAniListFullList } from '../anilist/full-list';
import { fetchMalFullList } from '../mal/full-list';

// Lectures réseau de la vérification des suites : listes complètes des services connectés, puis relations AniList.
// Toute erreur remonte (ApiError) : la passe est abandonnée entière, rien n'est marqué amorcé.

const RELATIONS_CHUNK = 50;
/** Statuts dont les séries comptent comme « source » d'une suite ; PAUSED, DROPPED et PLANNING sont ignorés */
const SOURCE_STATUSES: readonly string[] = ['COMPLETED', 'CURRENT', 'REPEATING'];

const RELATIONS_QUERY = /* GraphQL */ `
  query SequelRelations($ids: [Int]) {
    Page(perPage: 50) {
      media(id_in: $ids) {
        id
        title { userPreferred }
        relations {
          edges {
            relationType
            node { id idMal type format status title { userPreferred } coverImage { medium } siteUrl startDate { year month day } season seasonYear }
          }
        }
      }
    }
  }
`;

/** Fiches AniList à venir ou en diffusion des entrées MAL (MAL seul : séries de la liste pour « Annoncées ») */
const LISTED_BY_MAL_QUERY = /* GraphQL */ `
  query ListedByMal($ids: [Int]) {
    Page(perPage: 50) {
      media(idMal_in: $ids, type: ANIME, status_in: [NOT_YET_RELEASED, RELEASING]) { id idMal format status title { userPreferred } coverImage { medium } siteUrl startDate { year month day } season seasonYear }
    }
  }
`;

const isPageData = (data: unknown): data is { Page: { media: unknown[] } } =>
  isRecord(data) && isRecord(data.Page) && Array.isArray(data.Page.media);

const num = (value: unknown): number | null => (typeof value === 'number' && Number.isFinite(value) ? value : null);
const str = (value: unknown): string | null => (typeof value === 'string' ? value : null);

/** Arête de relation lue de façon défensive (réponse externe) ; illisible → ignorée */
function parseEdge(raw: unknown): RelationEdge | null {
  if (!isRecord(raw) || !isRecord(raw.node)) return null;
  const node = raw.node;
  const id = num(node.id);
  const relationType = str(raw.relationType);
  const title = isRecord(node.title) ? str(node.title.userPreferred) : null;
  if (id === null || relationType === null || title === null) return null;
  // URL de fiche validée ici (elle finit dans un href et un onglet) : invalide ou absente → fiche AniList par id
  const siteUrl = toSafeUrl(str(node.siteUrl), 'anilist.co') ?? `https://anilist.co/anime/${id}`;
  const date = isRecord(node.startDate) ? node.startDate : {};
  return {
    relationType,
    node: {
      id, idMal: num(node.idMal), type: str(node.type) ?? '', format: str(node.format), status: str(node.status), title,
      coverUrl: toSafeImageUrl(isRecord(node.coverImage) ? str(node.coverImage.medium) : null), siteUrl,
      year: num(date.year), month: num(date.month), day: num(date.day), season: str(node.season), seasonYear: num(node.seasonYear),
    },
  };
}

export interface SourceRelations {
  /** Titre AniList de la série source (les listes MAL ne fournissent que des ids), null si absent de la réponse */
  title: string | null;
  edges: RelationEdge[];
}

/** Titre et relations de chaque série `ids` (lots de 50, file de fond) ; une série sans relation a une liste vide. Lève une ApiError. */
export async function fetchSequelRelations(ids: readonly number[]): Promise<Map<number, SourceRelations>> {
  const byId = new Map<number, SourceRelations>();
  for (let i = 0; i < ids.length; i += RELATIONS_CHUNK) {
    const { Page } = await anilistPublicQuery(RELATIONS_QUERY, isPageData, { ids: ids.slice(i, i + RELATIONS_CHUNK) }, 'background');
    for (const media of Page.media) {
      const id = isRecord(media) ? num(media.id) : null;
      if (id === null || !isRecord(media) || !isRecord(media.relations)) continue;
      const edges = Array.isArray(media.relations.edges) ? media.relations.edges : [];
      byId.set(id, { title: isRecord(media.title) ? str(media.title.userPreferred) : null, edges: edges.flatMap((edge) => parseEdge(edge) ?? []) });
    }
  }
  return byId;
}

/** MAL seul : fiche AniList (par idMal, lots de 50, file de fond) des entrées À regarder / En cours retenues pour « Annoncées ». Lève une ApiError. */
async function listedByMal(mal: readonly MalListEntry[]): Promise<ListedEntry[]> {
  const statusByMal = new Map(mal.flatMap((entry) => (entry.status === 'PLANNING' || entry.status === 'CURRENT' ? [[entry.malId, entry.status] as const] : [])));
  const ids = [...statusByMal.keys()];
  const listed: ListedEntry[] = [];
  for (let i = 0; i < ids.length; i += RELATIONS_CHUNK) {
    const { Page } = await anilistPublicQuery(LISTED_BY_MAL_QUERY, isPageData, { ids: ids.slice(i, i + RELATIONS_CHUNK) }, 'background');
    for (const media of Page.media) {
      if (!isRecord(media)) continue;
      const id = num(media.id);
      const idMal = num(media.idMal);
      const title = isRecord(media.title) ? str(media.title.userPreferred) : null;
      const listStatus = idMal === null ? undefined : statusByMal.get(idMal);
      const release = id === null ? null : parseRelease(media, id);
      if (id === null || title === null || listStatus === undefined || release === null || !listedQualifies(listStatus, release.status)) continue;
      listed.push({ id, idMal, title, coverUrl: toSafeImageUrl(isRecord(media.coverImage) ? str(media.coverImage.medium) : null), ...release, listStatus });
    }
  }
  return listed;
}

/**
 * Séries sources (terminées, en cours, revues) des services donnés, sans les séries exclues, et ids de toutes les
 * entrées de toutes les listes (pour ne jamais proposer une suite déjà suivie). Les séries MAL sont rapprochées de leur
 * fiche AniList par `idMal`. `listed` : séries des listes à venir pour « Annoncées » (liste AniList si connectée, sinon MAL
 * par idMal). Lève une ApiError si une liste n'a pas pu être lue en entier.
 */
export async function readSourceSeries(services: readonly TrackerId[]): Promise<{ sources: SourceSeries[]; inLists: InLists; listed: ListedEntry[] }> {
  const [anilist, mal, excluded] = await Promise.all([
    services.includes('anilist') ? fetchAniListFullList() : Promise.resolve([]),
    services.includes('mal') ? fetchMalFullList() : Promise.resolve([]),
    getExcludedSeries(),
  ]);
  const ids = new Set(anilist.map((entry) => entry.mediaId));
  const malIds = new Set([...anilist.flatMap((entry) => (entry.malId !== null ? [entry.malId] : [])), ...mal.map((entry) => entry.malId)]);
  const byId = new Map<number, SourceSeries>();
  const add = (id: number, title: string, service: TrackerId): void => {
    const existing = byId.get(id);
    if (!existing) byId.set(id, { id, title, services: [service] });
    else if (!existing.services.includes(service)) existing.services.push(service);
  };
  for (const entry of anilist) if (SOURCE_STATUSES.includes(entry.status)) add(entry.mediaId, entry.title, 'anilist');
  // Fiche AniList d'une série MAL : celle de la liste AniList si présente, sinon le catalogue
  const aniListByMal = new Map(anilist.flatMap((entry) => (entry.malId !== null ? [[entry.malId, entry.mediaId] as const] : [])));
  const malSources = mal.filter((entry) => SOURCE_STATUSES.includes(entry.status));
  const lookup = await aniListIdsByMal([...new Set(malSources.filter((entry) => !aniListByMal.has(entry.malId)).map((entry) => entry.malId))]);
  for (const entry of malSources) {
    const id = aniListByMal.get(entry.malId) ?? lookup.get(entry.malId);
    if (id !== undefined) add(id, entry.title, 'mal');
  }
  const sources = [...byId.values()].filter((source) => !isEntryExcluded(excluded, { mediaId: source.id, platforms: [] }));
  const listed = services.includes('anilist')
    ? anilist.flatMap(({ mediaId, malId, title, coverUrl, status, release }): ListedEntry[] => (release !== null && listedQualifies(status, release.status) ? [{ id: mediaId, idMal: malId, title, coverUrl, ...release, listStatus: status }] : []))
    : await listedByMal(mal);
  return { sources, inLists: { ids, malIds }, listed };
}
