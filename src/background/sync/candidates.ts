import type { EpisodeInfo } from '../../shared/episode.types';
import { PLATFORMS, type StreamingPlatform } from '../../platforms/registry';
import { STREAMING_PLATFORMS } from '../../platforms/ids';
import { normalizeTitle, slugSearchTitle, withoutDiacritics } from '../../shared/title';
import { createLogger } from '../../browser/logger';
import type { AniListMedia } from '../anilist/media';
import { anilistCatalog } from '../anilist/catalog';
import type { Catalog } from '../ports/catalog';
import type { RequestLane } from '../rate-limit';
import { alignPlatformSeasons, toSortableDate } from './matching/matching';
import { isAbsoluteNumbering, isLinked, isOtherSeries, SERIES_FORMATS, type LinkKind, type MediaCandidate } from './matching/model';
import type { PlatformMatchPolicy, PolicyQuery } from './matching/policies/policy';
import { policyOf } from './matching/policies/registry';
import { seasonSearchQuery } from './matching/season-titles';

// Collecte des fiches candidates d'une série (audit 1-§4.3) : pipeline d'étapes pures sur un CandidateSet (classement des
// liens, règlement entre fiches, propagation des relations, alignement des saisons de la plateforme), les requêtes au
// catalogue cédées (yield) à l'orchestrateur, qui les envoie au port Catalog. Le budget de requêtes (tours de récupération,
// fiche liée qui couvre déjà l'épisode) reste dans l'orchestrateur, candidateSteps.

const log = createLogger('sync');

const FRANCHISE_RELATIONS: ReadonlySet<string> = new Set(['SEQUEL', 'PREQUEL']);
/** Limite les requêtes supplémentaires pour récupérer les saisons absentes de la recherche */
const MAX_FETCH_ROUNDS = 2;
/**
 * Tours de plus, numérotation absolue seulement : préquelles de la franchise (saisons séries, ou OVA / spécial qui les relie) pour
 * que le cumul parte de la 1re saison (Slime : saison 2 → OVA « Coleus no Yume » → saison 1)
 */
const MAX_PREQUEL_ROUNDS = 4;

export interface CollectedCandidates {
  candidates: MediaCandidate[];
  /** Fiches complètes, dans l'ordre de pertinence de la recherche */
  media: AniListMedia[];
}

/**
 * Série à rechercher : un épisode, ou une page de série (titre et saison lus sur la page).
 * `episodeId` (page de lecture) : reconnaît une fiche AniList liée à l'épisode lui-même.
 * `url` (page de lecture Prime Video) : page de détail de la saison, dont l'identifiant rend certain un lien AniList vers elle.
 */
export type SeriesQuery = Pick<EpisodeInfo, 'platform' | 'seriesId' | 'seriesSlug' | 'animeTitle' | 'seasonTitle' | 'platformSeasons'> &
  Partial<Pick<EpisodeInfo, 'seasonEpisodeNumber' | 'displayedEpisodeNumber' | 'url'>> & { episodeId?: string | null };

/**
 * Requête au catalogue demandée par la collecte des candidats : recherches d'une même étape (envoyées ensemble) ou fiches
 * par identifiant (suites / préquelles absentes des recherches). Réponse : une liste de fiches par recherche, ou une seule
 * liste pour les identifiants.
 */
export type CatalogRequest = { kind: 'search'; queries: readonly string[] } | { kind: 'ids'; ids: readonly number[] };
export type CatalogAnswer = readonly (readonly AniListMedia[])[];
export type CandidateSteps = Generator<CatalogRequest, CollectedCandidates, CatalogAnswer>;

/** Fiches de la série en cours de collecte : chaque fiche (ordre d'arrivée) et son lien avec la série */
export interface CandidateSet {
  readonly media: ReadonlyMap<number, AniListMedia>;
  readonly links: ReadonlyMap<number, LinkKind>;
}

/** Série et règles de sa plateforme, communes aux étapes */
interface CollectContext {
  episode: SeriesQuery;
  policy: PlatformMatchPolicy;
  query: PolicyQuery;
}

export const EMPTY_SET: CandidateSet = { media: new Map(), links: new Map() };

/** Réponse du catalogue à une requête de la collecte */
export async function answerCatalog(request: CatalogRequest, lane: RequestLane, catalog: Catalog = anilistCatalog): Promise<CatalogAnswer> {
  if (request.kind === 'search') return Promise.all(request.queries.map((query) => catalog.search(query, lane)));
  return [await catalog.byIds(request.ids, lane)];
}

/**
 * Recherche les fiches AniList de la franchise et détermine le lien de chacune avec la série.
 * Les suites/préquelles d'une fiche liée sont ajoutées (et récupérées si besoin) : AniList ne lie
 * pas toujours chaque saison à la plateforme.
 */
export async function collectCandidates(episode: SeriesQuery, lane: RequestLane = 'interactive', catalog: Catalog = anilistCatalog): Promise<CollectedCandidates> {
  const steps = candidateSteps(episode);
  let step = steps.next([]);
  while (!step.done) step = steps.next(await answerCatalog(step.value, lane, catalog));
  return step.value;
}

// ─── Étapes pures ─────────────────────────────────────────────────────────

/** Classement : fiches nouvelles ajoutées avec leur lien (règles de la plateforme), `fallback` si aucun */
export function classify(set: CandidateSet, { policy, query }: CollectContext, list: readonly AniListMedia[], fallback: LinkKind = null): CandidateSet {
  const media = new Map(set.media);
  const links = new Map(set.links);
  for (const entry of list) {
    if (media.has(entry.id)) continue;
    media.set(entry.id, entry);
    links.set(entry.id, policy.linkOf(entry, query) ?? fallback);
  }
  return { media, links };
}

/** Règlement des liens entre fiches (Disney+ : clé de série Disney+ des fiches retenues, voir policies/disney.ts) */
export function settle(set: CandidateSet, { policy }: CollectContext): CandidateSet {
  if (!policy.settleLinks) return set;
  const links = new Map(set.links);
  policy.settleLinks(set.media.values(), links);
  return { media: set.media, links };
}

/** Fiche rattachée à la série parmi les fiches collectées */
export const hasLinkedEntry = (set: CandidateSet): boolean => [...set.links.values()].some((link) => isLinked({ link }));

/**
 * Lien vers une AUTRE plateforme prise en charge, et aucun vers celle de la série (MONSTERS : Netflix seulement).
 * Plateforme dont les liens ne prouvent pas la présence (`countsAsPresence` faux : Prime Video) : n'entre pas en compte, ni
 * d'un côté ni de l'autre ; ses liens AniList sont rares (Vinland Saga, SPY×FAMILY… n'en ont aucun) et souvent vers
 * d'anciennes pages amazon.com, leur absence ne prouve rien.
 */
function linksElsewhereOnly(media: AniListMedia, platform: StreamingPlatform): boolean {
  if (!policyOf(platform).countsAsPresence) return false;
  const hosts = media.externalLinkUrls.flatMap((url) => {
    try {
      return [new URL(url).hostname];
    } catch {
      return [];
    }
  });
  const onPlatform = (id: StreamingPlatform): boolean => hosts.some((host) => PLATFORMS[id].matchesHost(host));
  return !onPlatform(platform) && STREAMING_PLATFORMS.some((other) => other !== platform && policyOf(other).countsAsPresence && onPlatform(other));
}

const sortableStart = (media: AniListMedia): number | null => toSortableDate(media.startDate);

/**
 * Suite / préquelle d'une fiche liée à la série : saison de la série par relation, sauf
 * - préquelle sortie APRÈS la fiche (ou suite sortie avant) : récit annexe daté autrement (MONSTERS, ONA 2024, « préquelle »
 *   de One Piece 1999), jamais la saison 2 ;
 * - fiche présente sur une autre plateforme prise en charge mais pas sur celle de la série (MONSTERS : Netflix seulement,
 *   page Crunchyroll de One Piece).
 */
function isSeasonRelation(from: AniListMedia, relationType: string | null, to: AniListMedia, platform: StreamingPlatform): boolean {
  const start = sortableStart(from);
  const other = sortableStart(to);
  if (start !== null && other !== null && ((relationType === 'PREQUEL' && other > start) || (relationType === 'SEQUEL' && other < start))) return false;
  return !linksElsewhereOnly(to, platform);
}

/**
 * Numérotation absolue : le cumul part de la 1re saison TV. Préquelle série, ou préquelle d'une saison série publiée dans un
 * autre format (Slime saison 2 → PREQUEL l'OVA « Coleus no Yume » → PREQUEL la saison 1) : demandée aussi, sinon la chaîne
 * s'arrête et la saison 1 manque au cumul (Saison 3 E72 comptée sur la saison 4)
 */
const bridgesToEarlierSeason = (media: AniListMedia, rel: AniListMedia['relations'][number]): boolean =>
  rel.relationType === 'PREQUEL' && rel.format !== null && rel.format !== 'MUSIC' && (SERIES_FORMATS.has(rel.format) || (media.format !== null && SERIES_FORMATS.has(media.format)));

/** Un tour de propagation des relations : liens rattachés, fiches séries absentes, préquelles absentes (numérotation absolue) */
interface Propagation {
  set: CandidateSet;
  changed: boolean;
  missing: number[];
  /** Préquelles absentes (saison série, ou autre format qui y mène, voir bridgesToEarlierSeason) : tours en plus, numérotation absolue */
  prequels: number[];
}

/**
 * Propagation : un tour sur les relations SEQUEL / PREQUEL des fiches liées. Une fiche sans aucun lien devient `relation` si
 * la relation tient (isSeasonRelation) ; une fiche `other` / `other-slug` le reste. Un lien vers un épisode précis (spécial,
 * film) ne fait pas de ses suites des saisons de la série, ni une fiche d'une autre série de la plateforme (Naruto ne propage
 * rien vers Boruto sur la page Shippuden). Un lien posé pendant le tour compte pour les fiches suivantes du même tour.
 */
export function propagate(set: CandidateSet, { episode }: CollectContext): Propagation {
  const links = new Map(set.links);
  let changed = false;
  const missing = new Set<number>();
  const prequels = new Set<number>();
  const isAbsolute = isAbsoluteNumbering(episode);
  for (const media of set.media.values()) {
    const link = links.get(media.id);
    if (link === undefined || link === null || link === 'episode' || isOtherSeries({ link })) continue;
    for (const rel of media.relations) {
      if (rel.type !== 'ANIME' || !FRANCHISE_RELATIONS.has(rel.relationType ?? '')) continue;
      const related = set.media.get(rel.id);
      if (related) {
        if (links.get(rel.id) === null && isSeasonRelation(media, rel.relationType, related, episode.platform)) {
          links.set(rel.id, 'relation');
          changed = true;
        }
      } else if (rel.format !== null) {
        if (SERIES_FORMATS.has(rel.format)) missing.add(rel.id);
        if (isAbsolute && bridgesToEarlierSeason(media, rel)) prequels.add(rel.id);
      }
    }
  }
  return { set: { media: set.media, links }, changed, missing: [...missing], prequels: [...prequels] };
}

/**
 * Numérotation absolue (One Piece E1180) déjà couverte par une fiche série liée directement (en cours de diffusion, ou
 * assez d'épisodes) : la saison est trouvée sans les suites / préquelles absentes de la recherche, qui ne sont pas
 * demandées à AniList (budget de requêtes : un début de lecture ne coûte que la recherche)
 */
export function coveredByLinkedEntry(set: CandidateSet, { episode }: CollectContext): boolean {
  const absolute = episode.displayedEpisodeNumber ?? null;
  return (
    isAbsoluteNumbering(episode) &&
    absolute !== null &&
    [...set.media.values()].some((m) => (set.links.get(m.id) === 'id' || set.links.get(m.id) === 'platform') && m.format !== null && SERIES_FORMATS.has(m.format) && (m.episodes === null || m.episodes >= absolute))
  );
}

/** Fiches comparées par les règles et la concordance, dans l'ordre d'arrivée */
export const toCandidates = (set: CandidateSet): MediaCandidate[] => [...set.media.values()].map((m) => asCandidate(m, set.links.get(m.id) ?? null));

/**
 * Alignement : saisons de la plateforme (Netflix : épisodes par saison) rapprochées des fiches de la franchise (voir
 * alignPlatformSeasons) ; une saison liée à un autre titre de la plateforme (`other`) ou sans lien devient une saison de la
 * série (`relation`) si les nombres d'épisodes concordent. Fiches alignées, et l'ensemble mis à jour.
 */
export function align(set: CandidateSet, platformSeasons: readonly number[]): { set: CandidateSet; aligned: number[] } {
  const neighbors = new Map<number, number[]>();
  const relate = (a: number, b: number): void => {
    neighbors.set(a, [...(neighbors.get(a) ?? []), b]);
    neighbors.set(b, [...(neighbors.get(b) ?? []), a]);
  };
  for (const media of set.media.values()) {
    for (const rel of media.relations) if (rel.type === 'ANIME' && FRANCHISE_RELATIONS.has(rel.relationType ?? '')) relate(media.id, rel.id);
  }
  const aligned = alignPlatformSeasons(platformSeasons, toCandidates(set), neighbors) ?? [];
  const links = new Map(set.links);
  for (const id of aligned) {
    const link = links.get(id);
    if (link === null || link === undefined || isOtherSeries({ link })) links.set(id, 'relation');
  }
  return { set: { media: set.media, links }, aligned };
}

// ─── Orchestrateur ────────────────────────────────────────────────────────

/**
 * Règles de collectCandidates, étape par étape : chaque requête au catalogue est cédée (yield) à l'appelant, qui renvoie
 * ses résultats. Une seule source pour les requêtes : la résolution (collectCandidates) et le pré-chargement groupé de
 * l'import (resolver.ts › prefetchCandidates) demandent exactement les mêmes recherches, donc les mêmes clés du cache du
 * catalogue.
 */
export function* candidateSteps(episode: SeriesQuery): CandidateSteps {
  // Lien de chaque fiche avec la série (policies/ : formes d'URL de la plateforme ; Disney+, Prime Video : lien vers la
  // plateforme valable seulement pour une fiche au titre de la série, sauf lien vers la page elle-même)
  const ctx: CollectContext = {
    episode,
    policy: policyOf(episode.platform),
    query: {
      seriesId: episode.seriesId,
      seriesSlug: episode.seriesSlug,
      episodeId: episode.episodeId ?? null,
      ...(episode.url !== undefined ? { url: episode.url } : {}),
      animeTitle: episode.animeTitle,
      seasonTitle: episode.seasonTitle,
    },
  };

  // Titre de saison distinct (ex : saison « HEROINES » de One Piece) : la recherche du seul titre de la série
  // est noyée sous les fiches de la franchise (20 résultats), la fiche de la saison n'y figure pas toujours.
  // Recherche complémentaire « série + saison », fusionnée sans doublon.
  const seasonQuery = seasonSearchQuery(episode.animeTitle, episode.seasonTitle);
  const [main = [], bySeason = []] = yield { kind: 'search', queries: seasonQuery ? [episode.animeTitle, seasonQuery] : [episode.animeTitle] };
  let set = classify(classify(EMPTY_SET, ctx, main), ctx, bySeason);

  // Aucun résultat lié : le titre de saison seul est parfois le titre AniList (ex : "… Season 2")
  if (!hasLinkedEntry(set) && episode.seasonTitle && normalizeTitle(episode.seasonTitle) !== normalizeTitle(episode.animeTitle) && episode.seasonTitle !== seasonQuery) {
    set = classify(set, ctx, (yield { kind: 'search', queries: [episode.seasonTitle] })[0] ?? []);
  }

  // Toujours rien de lié : titre sans accents (AniList ne trouve pas les synonymes accentués, titres localisés de
  // Crunchyroll /fr/), puis slug de l'URL (titre anglais sur Crunchyroll). Mêmes résultats à chaque relecture de la page
  // (requête exacte comparée : normalizeTitle retire déjà les accents)
  const searched = new Set([episode.animeTitle.toLowerCase()]);
  for (const query of [withoutDiacritics(episode.animeTitle), slugSearchTitle(episode.seriesSlug)]) {
    if (!query || searched.has(query.toLowerCase())) continue;
    if (hasLinkedEntry(set)) break;
    searched.add(query.toLowerCase());
    set = classify(set, ctx, (yield { kind: 'search', queries: [query] })[0] ?? []);
  }
  set = settle(set, ctx);

  // Propagation du lien le long des relations SEQUEL/PREQUEL jusqu'à stabilisation, fiches absentes récupérées dans la
  // limite des tours (budget de requêtes)
  let fetchRounds = 0;
  for (;;) {
    const round = propagate(set, ctx);
    set = round.set;
    let { changed } = round;
    if (round.missing.length > 0 && fetchRounds < MAX_FETCH_ROUNDS && !coveredByLinkedEntry(set, ctx)) {
      fetchRounds++;
      // Fiches sans lien : rattachées au tour suivant si la relation tient (isSeasonRelation) ; une fiche liée à une autre
      // série reste 'other' / 'other-slug' (voir policies/policy.ts › linkOfMedia)
      set = settle(classify(set, ctx, (yield { kind: 'ids', ids: round.missing })[0] ?? []), ctx);
      changed = true;
    } else if (round.prequels.length > 0 && fetchRounds < MAX_FETCH_ROUNDS + MAX_PREQUEL_ROUNDS && !coveredByLinkedEntry(set, ctx)) {
      // Tours ordinaires épuisés (suites comprises), numérotation absolue : seule la chaîne des préquelles continue, une
      // saison par tour, jusqu'à la 1re saison (cumul complet)
      fetchRounds++;
      set = settle(classify(set, ctx, (yield { kind: 'ids', ids: round.prequels })[0] ?? []), ctx);
      changed = true;
    }
    if (!changed) break;
  }

  if (episode.platformSeasons && episode.platformSeasons.length > 0) {
    const { set: alignedSet, aligned } = align(set, episode.platformSeasons);
    set = alignedSet;
    if (aligned.length > 0) log.info('Saisons de la plateforme alignées sur les fiches :', aligned);
  }

  return { candidates: toCandidates(set), media: [...set.media.values()] };
}

/** Fiche AniList comparée par les règles et la concordance */
export function asCandidate(m: AniListMedia, link: LinkKind): MediaCandidate {
  return {
    id: m.id,
    format: m.format,
    episodes: m.episodes,
    startDate: toSortableDate(m.startDate),
    titles: m.titles,
    link,
    hasPrequel: m.relations.some((rel) => rel.type === 'ANIME' && rel.relationType === 'PREQUEL' && rel.format !== null && SERIES_FORMATS.has(rel.format)),
    ...candidateSignals(m),
  };
}

/** Signaux AniList d'une fiche, comparés à ceux de la plateforme (concordance.ts) */
export function candidateSignals(media: AniListMedia): Pick<MediaCandidate, 'endYear' | 'status' | 'duration' | 'country' | 'relations'> {
  return {
    endYear: media.endDate?.year ?? null,
    status: media.status ?? null,
    duration: media.duration ?? null,
    country: media.countryOfOrigin ?? null,
    relations: media.relations.flatMap((rel) => (rel.type === 'ANIME' && (rel.relationType === 'SEQUEL' || rel.relationType === 'PREQUEL') ? [{ id: rel.id, type: rel.relationType }] : [])),
  };
}
