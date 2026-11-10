import { t } from '../../i18n';
import { createLogger } from '../../browser/logger';
import { readFranchiseCache, writeFranchiseCache } from '../../browser/storage/session-cache';
import { isRecord } from '../../shared/guards';
import { mergeRound, MAX_ROUNDS, newFranchiseGraph, restoreStart, type FranchiseGraph, type FranchiseResult, type RawMedia } from '../../shared/franchise';
import { anilistPublicQuery } from '../anilist/client';
import { buildPlatforms } from '../anilist/watching';
import { ApiError } from '../errors';

// Ordre de visionnage : le graphe de relations d'une franchise est lu tour par tour (une requête AniList par tour, au plus
// MAX_ROUNDS), chaque tour demandant les entrées principales dont les relations ne sont pas encore lues (`mergeRound`).

const log = createLogger('franchise');

const NODE = 'id idMal type format status episodes duration title { userPreferred } coverImage { medium } siteUrl startDate { year month day } season seasonYear externalLinks { url }';
const FRANCHISE_QUERY = /* GraphQL */ `
  query Franchise($ids: [Int]) {
    Page(perPage: 50) {
      media(id_in: $ids) {
        ${NODE}
        relations { edges { relationType node { ${NODE} } } }
      }
    }
  }
`;

const isRawMedia = (value: unknown): value is RawMedia => isRecord(value) && typeof value.id === 'number' && typeof value.type === 'string';
const isPageData = (data: unknown): data is { Page: { media: RawMedia[] } } =>
  isRecord(data) && isRecord(data.Page) && Array.isArray(data.Page.media) && data.Page.media.every(isRawMedia);

/** Relations dont le nœud est exploitable : AniList permet `node: null`, qui ferait échouer le parcours */
function withValidEdges(media: RawMedia): RawMedia {
  const edges = media.relations?.edges;
  if (!edges) return media;
  return { ...media, relations: { edges: edges.filter((edge) => isRecord(edge) && isRawMedia(edge.node)) } };
}

/** Liens externes bruts de la page (entrées demandées et leurs relations directes) ; `mergeRound` ne les garde pas */
function collectLinks(page: readonly RawMedia[], into: Map<number, unknown>): void {
  for (const media of page) {
    if (media.externalLinks) into.set(media.id, media.externalLinks);
    for (const edge of media.relations?.edges ?? []) if (edge.node.externalLinks && !into.has(edge.node.id)) into.set(edge.node.id, edge.node.externalLinks);
  }
}

interface Walk {
  promise: Promise<FranchiseResult>;
  /** Identifiants dont les relations sont lues (alimenté tour par tour) : une demande pour l'un d'eux rejoint ce parcours */
  read: Set<number>;
}
const inFlight = new Map<number, Walk>();

async function walk(startId: number, read: Set<number>, maxRounds: number): Promise<FranchiseGraph> {
  let graph = newFranchiseGraph(startId);
  let frontier = [startId];
  const links = new Map<number, unknown>();
  for (let round = 0; frontier.length > 0; round += 1) {
    // Frontière non vide après le dernier tour : graphe partiel
    if (round >= maxRounds) {
      graph = restoreStart({ ...graph, capped: true });
      break;
    }
    // Entrées sur le point d'être lues : une demande qui arrive pendant ce tour rejoint le parcours
    for (const id of frontier) read.add(id);
    const { Page } = await anilistPublicQuery(FRANCHISE_QUERY, isPageData, { ids: frontier }, 'background');
    const page = Page.media.map(withValidEdges);
    collectLinks(page, links);
    for (const media of page) read.add(media.id);
    ({ graph, frontier } = mergeRound(graph, page));
  }
  const nodes = Object.fromEntries(Object.entries(graph.nodes).map(([id, node]) => [id, { ...node, platforms: buildPlatforms(links.get(node.id), []) }]));
  return { ...graph, nodes };
}

async function run(mediaId: number, read: Set<number>, maxRounds: number): Promise<FranchiseResult> {
  try {
    const cached = await readFranchiseCache(mediaId);
    if (cached) return { ok: true, graph: cached };
    const graph = await walk(mediaId, read, maxRounds);
    // Graphe complet : valable pour toutes ses entrées principales ; plafonné : pour le départ seulement (il dépend du départ)
    await writeFranchiseCache(graph.capped ? [mediaId] : [...new Set([mediaId, ...graph.main])], graph);
    return { ok: true, graph };
  } catch (error: unknown) {
    if (error instanceof ApiError) return { ok: false, message: error.message };
    log.error('Erreur inattendue (ordre de visionnage) :', error);
    return { ok: false, message: t('panel.order.error') };
  }
}

/** Graphe de la franchise de cette entrée (catalogue public, sans compte requis), cache de session 24 h. `maxRounds` : tests */
export function loadFranchise(mediaId: number, maxRounds: number = MAX_ROUNDS): Promise<FranchiseResult> {
  // Deux entrées de la même franchise demandées ensemble : un seul parcours
  for (const walkInFlight of inFlight.values()) if (walkInFlight.read.has(mediaId)) return walkInFlight.promise;
  const existing = inFlight.get(mediaId);
  if (existing) return existing.promise;
  const read = new Set<number>([mediaId]);
  const promise = run(mediaId, read, maxRounds).finally(() => inFlight.delete(mediaId));
  inFlight.set(mediaId, { promise, read });
  return promise;
}
