import type { AniListSeason } from './sequels';
import type { TrackerId } from './tracker.types';
import { toSafeImageUrl, toSafeUrl } from './url';
import type { PlatformLink } from './watching.types';

/**
 * Ordre de visionnage d'une franchise : règles pures (parcours du graphe de relations AniList, ordre de sortie, « Ensuite »).
 * Aucune API du navigateur : le chargeur du service worker lit AniList et appelle `mergeRound` tour par tour.
 */

export type FranchiseRelation = 'PREQUEL' | 'SEQUEL' | 'SIDE_STORY' | 'SPIN_OFF' | 'ALTERNATIVE' | 'SUMMARY' | 'PARENT';

export interface FranchiseNode {
  id: number;
  idMal: number | null;
  title: string;
  format: string | null;
  status: string | null;
  episodes: number | null;
  duration: number | null;
  coverUrl: string | null;
  siteUrl: string;
  year: number | null;
  month: number | null;
  day: number | null;
  season: AniListSeason | null;
  seasonYear: number | null;
  /**
   * Toujours `[]` en sortie de `mergeRound` : le helper lien externe → plateforme (`buildPlatforms`) vit dans
   * background/anilist/watching.ts, que shared/ ne peut pas importer. Le chargeur (background/franchise) la remplit
   * à partir des `externalLinks` bruts de `RawMedia`.
   */
  platforms: PlatformLink[];
}

export interface FranchiseGraph {
  startId: number;
  nodes: Record<number, FranchiseNode>;
  /** Chaîne principale (PREQUEL / SEQUEL), dans l'ordre de découverte ; `releaseOrder` la trie */
  main: number[];
  /** Entrées à un saut d'une entrée principale : `from` est l'entrée principale, `relation` son lien vers `id` */
  extras: { id: number; relation: FranchiseRelation; from: number }[];
  /** Entrées qu'une entrée principale déclare SUMMARY / COMPILATION : sorties de la chaîne principale en fin de parcours (ORD-03) */
  recaps?: { id: number; from: number }[];
  /** Plafond (50 entrées principales) atteint : le graphe est partiel */
  capped: boolean;
  /** Entrées dont les relations ont été lues (page de premier niveau) : la frontière est `main` moins ces identifiants */
  expanded: number[];
}

/** Graphe relu du cache de session : structure vérifiée (les entrées des nœuds ont été écrites par le chargeur) */
export function isFranchiseGraph(value: unknown): value is FranchiseGraph {
  if (typeof value !== 'object' || value === null) return false;
  const g = value as Record<string, unknown>;
  return typeof g.startId === 'number' && typeof g.capped === 'boolean' && Array.isArray(g.main) && Array.isArray(g.extras) && Array.isArray(g.expanded)
    && typeof g.nodes === 'object' && g.nodes !== null && g.main.every((id) => typeof id === 'number' && typeof (g.nodes as Record<number, unknown>)[id] === 'object');
}

/** Forme brute de la réponse AniList (requête du chargeur) ; les niveaux imbriqués ne portent parfois que `id` et `type` */
export interface RawMedia {
  id: number;
  idMal?: number | null;
  type: string;
  format?: string | null;
  status?: string | null;
  episodes?: number | null;
  duration?: number | null;
  title?: { userPreferred?: string | null } | null;
  coverImage?: { medium?: string | null } | null;
  siteUrl?: string | null;
  startDate?: { year?: number | null; month?: number | null; day?: number | null } | null;
  season?: string | null;
  seasonYear?: number | null;
  externalLinks?: { url?: string | null }[] | null;
  relations?: { edges?: RawEdge[] | null } | null;
}

export interface RawEdge {
  relationType: string;
  node: RawMedia;
}

export const MAX_MAIN = 50;
/** Tours de lecture au plus (le chargeur s'arrête et marque `capped` ; la saga Gundam réelle en demande 9) */
export const MAX_ROUNDS = 12;
export const MAX_EXTRAS = 40;

/** Durée par épisode (minutes) en dessous de laquelle une entrée est un PV et non une œuvre à regarder */
const MAX_PV_MINUTES = 5;

const CHAIN_RELATIONS: ReadonlySet<string> = new Set<FranchiseRelation>(['PREQUEL', 'SEQUEL']);
const EXTRA_RELATIONS: ReadonlySet<string> = new Set<FranchiseRelation>(['SIDE_STORY', 'SPIN_OFF', 'ALTERNATIVE', 'SUMMARY', 'PARENT']);
const RECAP_RELATIONS: ReadonlySet<string> = new Set(['SUMMARY', 'COMPILATION']);
const SEASONS: ReadonlySet<string> = new Set<AniListSeason>(['WINTER', 'SPRING', 'SUMMER', 'FALL']);

export function newFranchiseGraph(startId: number): FranchiseGraph {
  return { startId, nodes: {}, main: [startId], extras: [], capped: false, expanded: [] };
}

/** Anime à regarder : jamais de MUSIC, ni de PV (5 minutes ou moins par épisode) ; durée inconnue acceptée */
function isShown(media: RawMedia): boolean {
  if (media.type !== 'ANIME' || media.format === 'MUSIC') return false;
  return typeof media.duration !== 'number' || media.duration > MAX_PV_MINUTES;
}

function toNode(media: RawMedia): FranchiseNode {
  const season = media.season ?? null;
  return {
    id: media.id,
    idMal: media.idMal ?? null,
    title: media.title?.userPreferred ?? '',
    format: media.format ?? null,
    status: media.status ?? null,
    episodes: media.episodes ?? null,
    duration: media.duration ?? null,
    coverUrl: toSafeImageUrl(media.coverImage?.medium),
    siteUrl: toSafeUrl(media.siteUrl, 'anilist.co') ?? `https://anilist.co/anime/${media.id}`,
    year: media.startDate?.year ?? null,
    month: media.startDate?.month ?? null,
    day: media.startDate?.day ?? null,
    season: season !== null && SEASONS.has(season) ? (season as AniListSeason) : null,
    seasonYear: media.seasonYear ?? null,
    platforms: [],
  };
}

/**
 * Intègre une page de réponse AniList (les entrées demandées par le tour précédent) et renvoie la frontière du tour suivant :
 * les entrées principales dont les relations ne sont pas encore lues. Frontière vide = chaîne fermée ou plafond atteint.
 */
export function mergeRound(graph: FranchiseGraph, page: readonly RawMedia[]): { graph: FranchiseGraph; frontier: number[] } {
  const nodes: Record<number, FranchiseNode> = { ...graph.nodes };
  let main = [...graph.main];
  const extras = [...graph.extras];
  const expanded = new Set(graph.expanded);
  let capped = graph.capped;
  const recaps = [...(graph.recaps ?? [])];

  const addMain = (media: RawMedia): void => {
    if (!isShown(media) || main.includes(media.id)) return;
    if (main.length >= MAX_MAIN) {
      capped = true;
      return;
    }
    main.push(media.id);
    nodes[media.id] = toNode(media);
    const asExtra = extras.findIndex((e) => e.id === media.id);
    if (asExtra !== -1) extras.splice(asExtra, 1);
  };

  const addExtra = (media: RawMedia, relation: FranchiseRelation, from: number): void => {
    if ((!isShown(media) && media.id !== graph.startId) || main.includes(media.id) || extras.some((e) => e.id === media.id)) return;
    if (extras.length >= MAX_EXTRAS) return;
    extras.push({ id: media.id, relation, from });
    nodes[media.id] = toNode(media);
  };

  for (const media of page) {
    if (expanded.has(media.id)) continue;
    expanded.add(media.id);
    nodes[media.id] = toNode(media);
    const edges = media.relations?.edges ?? [];

    // Départ sans PREQUEL / SEQUEL qui est un dérivé d'une chaîne (SIDE_STORY, SPIN_OFF…) : son PARENT devient la racine de la
    // chaîne, le départ rejoint les extras quand le parent est lu (le lien exact est celui que le parent déclare vers lui)
    if (media.id === graph.startId && !edges.some((e) => CHAIN_RELATIONS.has(e.relationType) && isShown(e.node))) {
      const parent = edges.find((e) => e.relationType === 'PARENT' && isShown(e.node));
      if (parent) {
        main = main.filter((id) => id !== media.id);
        addMain(parent.node);
        continue;
      }
    }

    if (!main.includes(media.id)) continue;
    for (const edge of edges) {
      if (RECAP_RELATIONS.has(edge.relationType) && !recaps.some((r) => r.id === edge.node.id)) recaps.push({ id: edge.node.id, from: media.id });
      if (CHAIN_RELATIONS.has(edge.relationType)) addMain(edge.node);
      else if (EXTRA_RELATIONS.has(edge.relationType)) addExtra(edge.node, edge.relationType as FranchiseRelation, media.id);
    }
  }

  const frontier = capped ? [] : main.filter((id) => !expanded.has(id));
  const merged: FranchiseGraph = { startId: graph.startId, nodes, main, extras, capped, expanded: [...expanded], recaps };
  return { graph: frontier.length === 0 ? restoreStart(demoteRecaps(merged)) : merged, frontier };
}

/**
 * Fin de parcours : une entrée que la chaîne relie par PREQUEL / SEQUEL mais qu'une entrée principale déclare SUMMARY ou
 * COMPILATION (film de montage) rejoint les extras, hors plafond, et ne compte plus dans « Ensuite » (ORD-03). Jamais la racine.
 */
function demoteRecaps(graph: FranchiseGraph): FranchiseGraph {
  const root = graph.main[0];
  const demoted = (graph.recaps ?? []).filter((r) => r.id !== root && graph.main.includes(r.id) && graph.main.includes(r.from));
  if (demoted.length === 0) return graph;
  const ids = new Set(demoted.map((r) => r.id));
  return {
    ...graph,
    main: graph.main.filter((id) => !ids.has(id)),
    extras: [...graph.extras, ...demoted.map((r) => ({ id: r.id, relation: 'SUMMARY' as const, from: r.from }))],
  };
}

/**
 * Parcours fini ou interrompu (plafond de tours) : un départ dérivé que son parent ne déclare pas (COMPILATION, OTHER,
 * CONTAINS…) rejoint quand même les extras de son parent, hors plafond, pour que la page affichée soit toujours dans le graphe
 */
export function restoreStart(graph: FranchiseGraph): FranchiseGraph {
  const root = graph.main[0];
  if (root === undefined || !graph.nodes[graph.startId] || graph.main.includes(graph.startId) || graph.extras.some((e) => e.id === graph.startId)) return graph;
  return { ...graph, extras: [...graph.extras, { id: graph.startId, relation: 'SIDE_STORY', from: root }] };
}

/** Date de sortie triable : inconnue → null ; mois / jour manquants (annonce « 2027 ») après les dates complètes de l'année */
function dateKey(node: FranchiseNode): number | null {
  if (node.year === null) return null;
  return node.year * 10000 + (node.month ?? 99) * 100 + (node.day ?? 99);
}

/** Entrées dans l'ordre de sortie ; dates inconnues en dernier (ordre d'arrivée), annoncées à leur date. `all` ajoute les extras */
export function releaseOrder(graph: FranchiseGraph, mode: 'main' | 'all'): FranchiseNode[] {
  const ids = mode === 'main' ? graph.main : [...graph.main, ...graph.extras.map((e) => e.id)];
  const listed = ids.flatMap((id, index) => {
    const node = graph.nodes[id];
    return node ? [{ node, index, key: dateKey(node) }] : [];
  });
  listed.sort((a, b) => {
    if (a.key === null || b.key === null) return a.key === b.key ? a.index - b.index : a.key === null ? 1 : -1;
    return a.key - b.key || a.index - b.index;
  });
  return listed.map((item) => item.node);
}

export type FranchiseResult = { ok: true; graph: FranchiseGraph } | { ok: false; message: string };

export type ListState = { kind: 'watched' | 'inProgress' | 'planned' | 'paused' | 'dropped'; progress: number | null } | null;

const isReleased = (node: FranchiseNode): boolean => node.status !== 'NOT_YET_RELEASED' && node.status !== 'CANCELLED';

/**
 * « N / M vus » (entrées principales sorties, hors `notOnMal`) et « Ensuite » : première entrée sortie après la plus avancée vue
 * ou en cours (la première sortie si rien n'est vu), jamais un trou derrière ; tout vu → l'entrée annoncée, sinon null.
 * `main` est déjà en ordre de sortie (`releaseOrder(graph, 'main')`).
 */
export function franchiseProgress(
  main: readonly FranchiseNode[],
  states: ReadonlyMap<number, ListState | 'notOnMal'>,
): { watched: number; total: number; next: FranchiseNode | null; allWatched: boolean } {
  const stateOf = (node: FranchiseNode): ListState | 'notOnMal' => states.get(node.id) ?? null;
  const counted = main.filter((node) => stateOf(node) !== 'notOnMal');
  const released = counted.filter(isReleased);
  const kindOf = (node: FranchiseNode): string | undefined => (stateOf(node) as ListState)?.kind;
  const watched = released.filter((node) => kindOf(node) === 'watched').length;
  let furthest = -1;
  released.forEach((node, index) => {
    const kind = kindOf(node);
    if (kind === 'watched' || kind === 'inProgress') furthest = index;
  });
  const allWatched = released.length > 0 && watched === released.length;
  // « Ensuite » est une entrée sortie ; l'annonce n'est proposée que lorsque tout le sorti est vu
  const announced = counted.find((node) => node.status === 'NOT_YET_RELEASED') ?? null;
  return { watched, total: released.length, next: allWatched ? announced : (released[furthest + 1] ?? null), allWatched };
}

/** Titre sans le titre racine quand celui-ci le préfixe (à la frontière d'un mot) et que le reste commence par une lettre ; inchangé sinon, jamais vide */
export function shortTitle(rootTitle: string, title: string): string {
  const root = rootTitle.trim();
  if (root === '' || !title.toLowerCase().startsWith(root.toLowerCase())) return title;
  const rest = title.slice(root.length);
  if (/^[\p{L}\p{N}]/u.test(rest)) return title;
  const short = rest.replace(/^[\s:：\-–—·]+/u, '').trim();
  // Un reste qui ne commence pas par une lettre (« 2 », « 5 (ONA) »), ou par un chiffre romain / une lettre seule
  // (« II », « III: … », « S ») n'est plus un titre : on garde l'entier
  const first = short.split(/[\s:：]/u)[0];
  return /^\p{L}/u.test(short) && !/^(?:[IVX]+|\p{L})$/u.test(first) ? short : title;
}

/** États de liste des entrées d'une franchise, par service : null = service non connecté, session changée ou lecture échouée */
export interface ListStates {
  anilist: Record<number, ListState> | null;
  mal: Record<number, ListState> | null;
}

const KIND_OF_STATUS: Record<string, NonNullable<ListState>['kind']> = {
  COMPLETED: 'watched',
  REPEATING: 'watched',
  CURRENT: 'inProgress',
  PLANNING: 'planned',
  PAUSED: 'paused',
  DROPPED: 'dropped',
};

/** Statut de liste commun (AniList MediaListStatus) → état de la franchise ; null si le statut est inconnu. La progression ne sert qu'« en cours » */
export function toListState(status: unknown, progress: unknown): ListState {
  if (typeof status !== 'string' || !Object.hasOwn(KIND_OF_STATUS, status)) return null;
  const kind = KIND_OF_STATUS[status];
  return { kind, progress: kind === 'inProgress' && typeof progress === 'number' ? progress : null };
}

const sameState = (a: ListState, b: ListState): boolean => a?.kind === b?.kind && a?.progress === b?.progress;

/**
 * États des entrées pour le service choisi (`entryService`), repli sur l'autre quand il n'est pas lu ; aucun état si aucun
 * service. MAL pilote et pas d'`idMal` : 'notOnMal'. `other` : état de l'autre service, seulement quand les deux sont lus
 * et diffèrent (infobulle de la ligne).
 */
export function mergeStates(
  states: ListStates,
  entryService: TrackerId,
  nodes: readonly FranchiseNode[],
): { byId: ReadonlyMap<number, ListState | 'notOnMal'>; other: ReadonlyMap<number, { service: TrackerId; state: ListState }> } {
  const byId = new Map<number, ListState | 'notOnMal'>();
  const other = new Map<number, { service: TrackerId; state: ListState }>();
  const otherService: TrackerId = entryService === 'anilist' ? 'mal' : 'anilist';
  const chosen = states[entryService] ? entryService : states[otherService] ? otherService : null;
  if (chosen === null) return { byId, other };
  const stateOf = (service: TrackerId, node: FranchiseNode): ListState | 'notOnMal' => {
    if (service === 'anilist') return states.anilist?.[node.id] ?? null;
    return node.idMal === null ? 'notOnMal' : (states.mal?.[node.idMal] ?? null);
  };
  const counterpart: TrackerId = chosen === 'anilist' ? 'mal' : 'anilist';
  for (const node of nodes) {
    const state = stateOf(chosen, node);
    byId.set(node.id, state);
    if (!states[counterpart] || state === 'notOnMal') continue;
    const counter = stateOf(counterpart, node);
    if (counter !== 'notOnMal' && !sameState(state, counter)) other.set(node.id, { service: counterpart, state: counter });
  }
  return { byId, other };
}
