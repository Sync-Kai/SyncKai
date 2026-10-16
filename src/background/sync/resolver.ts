import type { EpisodeInfo } from '../../shared/episode.types';
import { hasSignals } from '../../shared/match-signals';
import { seasonPosition } from '../../shared/episode-position';
import type { CandidateSummary } from '../../shared/review.types';
import { mappingKey } from '../../platforms/series-identity';
import { mappingOrigin, type MediaMapping } from '../../shared/sync.types';
import { forgetIfUnchanged, getMediaMapping, saveLearned } from '../../browser/storage/mappings';
import type { AniListMedia } from '../anilist/media';
import { anilistCatalog } from '../anilist/catalog';
import type { Catalog } from '../ports/catalog';
import type { RequestLane } from '../rate-limit';
import { answerCatalog, asCandidate, candidateSignals, candidateSteps, collectCandidates, type CandidateSteps, type CatalogRequest, type CollectedCandidates, type SeriesQuery } from './candidates';
import { ignoredResult, seasonLabel, toSortableDate } from './matching/matching';
import { filtersAnime, policyOf } from './matching/policies/registry';
import {
  applyMapping,
  cachedMappingVerdict,
  cachedTitleVerdict,
  questionsByTitle,
  savedMappingDoubt,
  titleMappingDoubt,
  type CachedMappingVerdict,
} from './matching/mapping';
import { gateByPlatformLink } from './matching/judge';
import { isLinked, type MediaCandidate, type ResolveResult, type SyncTarget } from './matching/model';
import { resolveTarget } from './matching/rules-engine';
import { seasonPool } from './matching/season-pool';
import { carriesSeasonTitle } from './matching/season-titles';
import { provenBySignals } from './matching/signal-groups';
import { isSeriesIgnored, rememberIgnoredSeries } from './ignored-series';
import { groupSeasons } from './matching/season-groups';
import { recordMatchDecision } from './match-diagnostic';
import type { SignalName } from './matching/concordance';
import { createLogger } from '../../browser/logger';

const log = createLogger('sync');

/** Nombre de fiches proposées dans une carte de vérification */
const MAX_REVIEW_CANDIDATES = 8;

interface ResolveOptions {
  /** false : lecture seule (fiche de la page), le cache des correspondances n'est ni écrit ni purgé */
  persist?: boolean;
  /** 'background' : tâche de fond (import Crunchyroll), budget de requêtes limité */
  lane?: RequestLane;
  /**
   * Correspondance en cache confrontée à une nouvelle résolution (analyse d'un import d'historique, audit 1-D10 ; voir
   * revalidatedMapping) : une correspondance apprise fausse n'est plus réappliquée import après import
   */
  revalidateCache?: boolean;
}

/** Analyse d'un import d'historique : lecture seule, file de fond, correspondances en cache revalidées */
export const IMPORT_RESOLVE_OPTIONS: Readonly<ResolveOptions> = { persist: false, lane: 'background', revalidateCache: true };

export interface EpisodeResolution {
  result: ResolveResult;
  /** Fiches à proposer si l'utilisateur doit choisir (vide si la correspondance vient du cache) */
  candidates: CandidateSummary[];
  /** Saisons de la série (formats série, ordre de diffusion), vide si la correspondance vient du cache */
  seasons: CandidateSummary[];
  /** Identifiants des saisons regroupées par saison de la plateforme (parties « Part 2 » réunies, voir groupSeasons) */
  seasonGroups: number[][];
}

/**
 * Correspondance en cache confrontée aux signaux de la plateforme (voir matching.ts › cachedMappingVerdict), puis au titre
 * de saison (cachedTitleVerdict), avec sa fiche (proposée dans la carte « À vérifier » si elle est mise en doute). Hors choix
 * de l'utilisateur (`chosen`) : une requête au catalogue (en cache quelques minutes) avec des signaux ou un titre de saison
 * propre ; les recherches de la série seulement si la fiche ne porte pas ce titre.
 */
async function questionMapping(episode: EpisodeInfo, mapping: MediaMapping, lane: RequestLane, catalog: Catalog): Promise<{ verdict: CachedMappingVerdict; media: AniListMedia | null }> {
  const bySignals = mappingOrigin(mapping) !== 'chosen' && hasSignals(episode.signals);
  const byTitle = questionsByTitle(episode, mapping);
  if (!bySignals && !byTitle) return { verdict: { kind: 'keep' }, media: null };
  const media = (await catalog.byIds([mapping.mediaId], lane)).find((m) => m.id === mapping.mediaId) ?? null;
  if (!media) return { verdict: { kind: 'keep' }, media: null };
  const entry = { id: media.id, format: media.format, episodes: media.episodes, startDate: toSortableDate(media.startDate), titles: media.titles, ...candidateSignals(media) };
  const verdict = cachedMappingVerdict(mapping, entry, episode.signals);
  // Titre de saison (sans signal, comme l'import de l'historique) : fiche qui le porte → tient sans recherche ; sinon les
  // saisons de la série (catalogue en cache quelques minutes) disent si le titre désigne un autre groupe
  if (verdict.kind !== 'keep' || !byTitle || carriesSeasonTitle(media.titles, episode.seasonTitle ?? '')) return { verdict, media };
  const { candidates } = await collectCandidates(episode, lane, catalog);
  return { verdict: cachedTitleVerdict(mapping, episode, candidates), media };
}

export function toCandidateSummary(media: AniListMedia): CandidateSummary {
  return { id: media.id, title: media.displayTitle, format: media.format, episodes: media.episodes, year: media.year, coverUrl: media.coverUrl };
}

/** Fiches à proposer : suggestion d'abord, puis saisons liées (ordre de diffusion), puis autres résultats. */
function summarize({ candidates, media }: CollectedCandidates, suggestedId: number | null): CandidateSummary[] {
  const byId = new Map(media.map((m) => [m.id, m]));
  const linkedIds = candidates
    .filter(isLinked)
    .sort((a, b) => (a.startDate ?? Number.MAX_SAFE_INTEGER) - (b.startDate ?? Number.MAX_SAFE_INTEGER))
    .map((c) => c.id);
  const otherIds = media.filter((m) => m.format !== 'MUSIC').map((m) => m.id);
  const ordered = [...new Set([...(suggestedId !== null ? [suggestedId] : []), ...linkedIds, ...otherIds])];
  return ordered.flatMap((id) => {
    const m = byId.get(id);
    return m ? [toCandidateSummary(m)] : [];
  }).slice(0, MAX_REVIEW_CANDIDATES);
}

export interface SeriesSeasons {
  /** Candidats bruts (pour resolveTarget) */
  candidates: MediaCandidate[];
  /** Saisons de la série dans l'ordre de diffusion (voir seasonPool) */
  seasons: AniListMedia[];
  /** Autres résultats de recherche (hors clips musicaux), si aucune saison n'est identifiée */
  others: AniListMedia[];
  /** Saisons regroupées par saison de la plateforme (identifiants, voir groupSeasons) */
  seasonGroups: number[][];
}

/** Saisons de la série (fiches complètes) et leurs groupes, à partir des candidats */
function poolOf({ candidates, media }: CollectedCandidates, animeTitle: string): { seasons: AniListMedia[]; seasonGroups: number[][] } {
  const byId = new Map(media.map((m) => [m.id, m]));
  const pool = seasonPool(candidates, animeTitle);
  return {
    seasons: pool.flatMap((c) => byId.get(c.id) ?? []),
    seasonGroups: groupSeasons(pool).map((group) => group.map((c) => c.id)),
  };
}

/** Saisons AniList d'une série (page de série) : même recherche que la synchro, sans rien écrire. */
export async function findSeriesSeasons(query: SeriesQuery, catalog: Catalog = anilistCatalog): Promise<SeriesSeasons> {
  const collected = await collectCandidates(query, 'interactive', catalog);
  const others = collected.media.filter((m) => m.format !== 'MUSIC');
  return { candidates: collected.candidates, ...poolOf(collected, query.animeTitle), others };
}

/** Fiches candidates d'un épisode, sans résolution (ex : correction d'une synchro passée). */
export async function findReviewCandidates(episode: EpisodeInfo, suggestedId: number | null, catalog: Catalog = anilistCatalog): Promise<CandidateSummary[]> {
  return summarize(await collectCandidates(episode, 'interactive', catalog), suggestedId);
}

/**
 * Correspondance importée d'une sauvegarde (BAK-02) : jugée sûre seulement si sa fiche existe dans le catalogue AniList
 * et contient la progression qu'elle donne. Confirmée : enregistrée sans l'indicateur, avec le nombre d'épisodes du
 * catalogue (`persist`). Réfutée : null (l'appelant la retire et résout de nouveau). Erreur réseau : propagée, comme
 * celle d'une recherche (la correspondance reste à revérifier).
 */
async function confirmImportedMapping(episode: EpisodeInfo, key: string, mapping: MediaMapping, persist: boolean, lane: RequestLane, catalog: Catalog): Promise<MediaMapping | null> {
  const media = (await catalog.byIds([mapping.mediaId], lane)).find((m) => m.id === mapping.mediaId);
  if (!media) {
    log.warn(`Correspondance importée ${key} : fiche #${mapping.mediaId} introuvable sur AniList, ignorée`);
    return null;
  }
  const { unverified: _unverified, ...rest } = mapping;
  const confirmed: MediaMapping = { ...rest, episodes: media.episodes };
  if (applyMapping(episode, confirmed) === null) {
    log.warn(`Correspondance importée ${key} : épisode hors de la fiche #${mapping.mediaId} (${media.episodes ?? '?'} ép.), ignorée`);
    return null;
  }
  // Écrite seulement si la correspondance n'a pas changé pendant la requête (choix de l'utilisateur entre-temps), origine gardée
  if (persist) await saveLearned(key, mapping, confirmed, mappingOrigin(confirmed));
  return confirmed;
}

/**
 * Correspondance en cache d'origine inconnue (ni `learned` ni `chosen` : enregistrée avant la 2.4.0, importée) que les
 * signaux de la plateforme (ou le titre de saison, voir matching.ts › cachedTitleVerdict) contredisent : peut-être un choix de
 * l'utilisateur, donc jamais supprimée ni réécrite, mais jamais synchronisée d'office. Résultat « À vérifier » : fiche prouvée
 * (nouvelle résolution : groupe de saison unique et confirmé par les signaux, ou dans le groupe désigné par le titre) proposée
 * si elle diffère, sinon la fiche en cache ; celle-ci reste parmi les fiches proposées. Valider la carte enregistre le choix
 * (`chosen`, voir sync-service.ts › resolveReview). `refreshed` : contredite par une nouvelle résolution sûre (import, voir
 * revalidatedMapping), proposée avec sa raison.
 */
async function doubtedMapping(
  episode: EpisodeInfo,
  key: string,
  cached: MediaMapping & { progress: number },
  media: AniListMedia,
  { signals, titleGroup, refreshed }: { signals: readonly SignalName[]; titleGroup?: readonly number[]; refreshed?: true },
  lane: RequestLane,
  catalog: Catalog,
): Promise<EpisodeResolution> {
  const collected = await collectCandidates(episode, lane, catalog);
  const fresh = gateByPlatformLink(episode, collected.candidates, resolveTarget(episode, collected.candidates));
  const isProven = (target: SyncTarget): boolean =>
    refreshed === true || (titleGroup ? titleGroup.includes(target.mediaId) : target.bySignals === true || provenBySignals(episode, collected.candidates, target.mediaId));
  const proven = fresh.ok && fresh.target.confidence === 'high' && fresh.target.mediaId !== cached.mediaId && isProven(fresh.target) ? fresh.target : null;
  const reason = titleGroup ? titleMappingDoubt(episode.seasonTitle) : refreshed && proven ? proven.reason : savedMappingDoubt(signals);
  const target: SyncTarget = proven ? { ...proven, confidence: 'low', reason } : { ...cached, confidence: 'low', reason };
  const contradiction = titleGroup ? 'titre de saison' : refreshed ? 'nouvelle résolution' : signals.join(', ');
  log.info(`Correspondance ${key} (#${cached.mediaId}) contredite par la plateforme (${contradiction}) : à vérifier${proven ? `, #${proven.mediaId} proposée` : ''}`);
  const summaries = summarize(collected, target.mediaId);
  // La fiche en cache reste sélectionnable (choix possible de l'utilisateur), même absente de la recherche
  const candidates = summaries.some((c) => c.id === media.id) ? summaries : [...summaries.slice(0, 1), toCandidateSummary(media), ...summaries.slice(1)].slice(0, MAX_REVIEW_CANDIDATES);
  const { seasons, seasonGroups } = poolOf(collected, episode.animeTitle);
  const result: ResolveResult = { ok: true, target };
  if (__SYNCKAI_DEBUG__) recordMatchDecision({ episode, key, lane, source: 'doubted', candidates: collected.candidates, result, mapping: { mapping: cached, verdict: 'doubt' } });
  return { result, candidates, seasons: seasons.map(toCandidateSummary), seasonGroups };
}

/**
 * Analyse d'un import d'historique (revalidateCache, audit 1-D10) : correspondance en cache applicable, hors choix de
 * l'utilisateur, confrontée à une nouvelle résolution (recherches pré-chargées par lots avec les autres saisons, voir
 * willSearch). Sans signal ni titre de saison propre, rien d'autre ne la remet en cause : une correspondance apprise fausse
 * (Slime « Saison 3 » → 4th Season, écrite le 2026-10-15) serait réappliquée à chaque import. Nouvelle résolution sûre
 * (`high`) vers une autre fiche → contredite : `freshId`, et la fiche en cache (`media`, sélectionnable dans la carte) ;
 * sinon null (résolution incertaine ou introuvable : la correspondance en cache reste, comme avant).
 */
async function revalidatedMapping(episode: EpisodeInfo, mapping: MediaMapping, lane: RequestLane, catalog: Catalog): Promise<{ freshId: number; media: AniListMedia | null } | null> {
  if (mappingOrigin(mapping) === 'chosen' || applyMapping(episode, mapping) === null) return null;
  const collected = await collectCandidates(episode, lane, catalog);
  const fresh = gateByPlatformLink(episode, collected.candidates, resolveTarget(episode, collected.candidates));
  if (!fresh.ok || fresh.target.confidence !== 'high' || fresh.target.mediaId === mapping.mediaId) return null;
  const media = collected.media.find((m) => m.id === mapping.mediaId) ?? (await catalog.byIds([mapping.mediaId], lane)).find((m) => m.id === mapping.mediaId) ?? null;
  return { freshId: fresh.target.mediaId, media };
}

/** Fiches par identifiant au plus par requête (AnimeByIds : Page(perPage: 50)) */
const IDS_PER_REQUEST = 50;

/**
 * La résolution de cet épisode cherchera-t-elle dans le catalogue ? Mêmes conditions que resolveEpisode : correspondance en
 * cache applicable, Prime Video sans verdict « anime », série déjà ignorée → non. Une correspondance en cache remise en
 * cause par les signaux (rare) cherche seule, sans pré-chargement. Analyse d'un import (seule appelante, revalidateCache) :
 * une correspondance applicable non choisie par l'utilisateur est revalidée, ses recherches partent avec les autres.
 */
async function willSearch(episode: EpisodeInfo): Promise<boolean> {
  const stored = await getMediaMapping(mappingKey(episode));
  if (stored && applyMapping(episode, stored) !== null) return mappingOrigin(stored) !== 'chosen';
  if (policyOf(episode.platform).ignoredBeforeSearch(episode)) return false;
  return !(filtersAnime(episode) && !stored && (await isSeriesIgnored(episode)));
}

/**
 * Pré-chargement groupé du catalogue (PERF-10, analyse d'un historique) : déroule les étapes de collectCandidates de
 * plusieurs épisodes ensemble, étape par étape. Les recherches d'une étape partent réunies (searchAnimeBatch : MAX_SEARCH_BATCH
 * par requête, mêmes clés de cache que searchAnime), les fiches par identifiant par IDS_PER_REQUEST ; chaque épisode reçoit
 * ensuite ses réponses du cache, comme collectCandidates. La résolution de chaque saison (resolveEpisode, même file, cache
 * du catalogue de 10 min) ne demande alors plus rien. N'écrit rien ; une erreur est levée (l'appelant l'ignore : la
 * résolution de la saison refait seule ses requêtes, avec ses nouvelles tentatives).
 */
export async function prefetchCandidates(episodes: readonly EpisodeInfo[], lane: RequestLane = 'background', catalog: Catalog = anilistCatalog): Promise<void> {
  const walks: { steps: CandidateSteps; step: IteratorResult<CatalogRequest, CollectedCandidates> }[] = [];
  for (const episode of episodes) {
    if (!(await willSearch(episode))) continue;
    const steps = candidateSteps(episode);
    walks.push({ steps, step: steps.next([]) });
  }
  for (;;) {
    const pending = walks.flatMap((walk) => (walk.step.done ? [] : [{ walk, request: walk.step.value }]));
    if (pending.length === 0) return;
    const queries = pending.flatMap(({ request }) => (request.kind === 'search' ? request.queries : []));
    const ids = [...new Set(pending.flatMap(({ request }) => (request.kind === 'ids' ? request.ids : [])))];
    const idChunks = Array.from({ length: Math.ceil(ids.length / IDS_PER_REQUEST) }, (_, i) => ids.slice(i * IDS_PER_REQUEST, (i + 1) * IDS_PER_REQUEST));
    await Promise.all([catalog.searchBatch(queries, lane), ...idChunks.map((chunk) => catalog.byIds(chunk, lane))]);
    // Réponses de chaque épisode servies par le cache rempli ci-dessus (aucune requête de plus)
    for (const { walk, request } of pending) walk.step = walk.steps.next(await answerCatalog(request, lane, catalog));
  }
}

/** Correspondance en cache lue pour l'épisode : résolution servie par le cache, ou ce qu'il en reste pour une nouvelle résolution */
type CacheOutcome =
  | { kind: 'hit'; resolution: EpisodeResolution }
  /** `unknownPosition` : correspondance retenue, mais position de l'épisode inconnue pour sa numérotation (M6) */
  | { kind: 'miss'; confirmed: MediaMapping | null; verdict: CachedMappingVerdict; unknownPosition: boolean };

/**
 * Cache des correspondances : correspondance importée revérifiée sur le catalogue (BAK-02), confrontée aux signaux de la
 * plateforme ou au titre de saison (apprise et contredite → oubliée ; origine inconnue et contredite → « À vérifier »,
 * doubtedMapping ; choix de l'utilisateur → jamais remis en cause), puis à une nouvelle résolution à l'analyse d'un import
 * (revalidatedMapping). Applicable → servie ; sinon `miss` (correspondance confirmée et verdict, pour la suite). N'écrit
 * que la correspondance importée confirmée (confirmImportedMapping, `persist`).
 */
async function fromCache(
  episode: EpisodeInfo,
  key: string,
  stored: MediaMapping | null,
  { persist, lane, revalidateCache }: Required<ResolveOptions>,
  catalog: Catalog,
): Promise<CacheOutcome> {
  const confirmed = stored?.unverified === true && applyMapping(episode, stored) !== null ? await confirmImportedMapping(episode, key, stored, persist, lane, catalog) : stored;
  const question = confirmed ? await questionMapping(episode, confirmed, lane, catalog) : null;
  const { verdict } = question ?? { verdict: { kind: 'keep' } as const };
  if (verdict.kind === 'drop') {
    log.info(`Correspondance apprise ${key} contredite par la plateforme (${verdict.titleGroup ? 'titre de saison' : verdict.signals.join(', ')}) : nouvelle résolution`);
  }
  // Analyse d'un import : correspondance applicable confrontée à une nouvelle résolution (revalidatedMapping)
  const revalidated = revalidateCache && verdict.kind === 'keep' && confirmed ? await revalidatedMapping(episode, confirmed, lane, catalog) : null;
  const confirmedLearned = confirmed !== null && mappingOrigin(confirmed) === 'learned';
  if (revalidated && confirmedLearned) log.info(`Correspondance apprise ${key} contredite par une nouvelle résolution (#${revalidated.freshId}) : écartée`);
  // Fiche en cache introuvable sur AniList (rien à proposer à côté) : comme écartée, la nouvelle résolution l'emporte
  const cached = verdict.kind === 'drop' || (revalidated && (confirmedLearned || revalidated.media === null)) ? null : confirmed;
  const progress = cached ? applyMapping(episode, cached) : null;
  if (!cached || progress === null) return { kind: 'miss', confirmed, verdict, unknownPosition: cached !== null && seasonPosition(episode, cached.numbering) === null };
  if (verdict.kind === 'doubt' && question?.media) return { kind: 'hit', resolution: await doubtedMapping(episode, key, { ...cached, progress }, question.media, verdict, lane, catalog) };
  if (revalidated?.media) return { kind: 'hit', resolution: await doubtedMapping(episode, key, { ...cached, progress }, revalidated.media, { signals: [], refreshed: true }, lane, catalog) };
  const result: ResolveResult = { ok: true, target: { ...cached, progress, confidence: 'high', reason: 'Correspondance en cache', fromCache: true } };
  if (__SYNCKAI_DEBUG__) {
    const candidates = question?.media ? [asCandidate(question.media, null)] : [];
    recordMatchDecision({ episode, key, lane, source: 'cache', candidates, result, mapping: { mapping: cached, verdict: verdict.kind } });
  }
  return { kind: 'hit', resolution: { result, candidates: [], seasons: [], seasonGroups: [] } };
}

/**
 * Série ignorée sans recherche AniList : Prime Video sans verdict « anime » (jamais envoyé ainsi par le script de contenu),
 * ou plateforme généraliste (Prime Video hors genre anime compris) dont la série est déjà ignorée (moins de 24 h). Une
 * correspondance enregistrée (choix manuel) l'emporte : vérifiée par fromCache, et sa présence montre que la série est un anime.
 */
async function ignoredShortcut(episode: EpisodeInfo, key: string, stored: MediaMapping | null, lane: RequestLane): Promise<EpisodeResolution | null> {
  if (!policyOf(episode.platform).ignoredBeforeSearch(episode)) {
    if (!filtersAnime(episode) || stored || !(await isSeriesIgnored(episode))) return null;
    log.info('Série déjà ignorée (verdict mémorisé) : pas de nouvelle recherche', episode.animeTitle);
  }
  if (__SYNCKAI_DEBUG__) recordMatchDecision({ episode, key, lane, source: 'ignored', candidates: [], result: ignoredResult(episode) });
  return { result: ignoredResult(episode), candidates: [], seasons: [], seasonGroups: [] };
}

/**
 * Nouvelle résolution : candidats du catalogue, règles (resolveTarget) puis juge (judge.ts, filtre « anime » des plateformes
 * généralistes compris) ; verdict « série ignorée » mémorisé ; résultat sûr appris (saveLearned : jamais par-dessus un choix
 * enregistré pendant les requêtes), sauf en lecture seule ou pour un choix de l'utilisateur hors de sa fiche (`keepsChoice`).
 */
async function fresh(
  episode: EpisodeInfo,
  key: string,
  { stored, verdict, keepsChoice, persist, lane }: { stored: MediaMapping | null; verdict: CachedMappingVerdict; keepsChoice: boolean; persist: boolean; lane: RequestLane },
  catalog: Catalog,
): Promise<EpisodeResolution> {
  const collected = await collectCandidates(episode, lane, catalog);
  const { candidates } = collected;
  // Diagnostic : fiches retenues comme appartenant à la série (les autres résultats de recherche sont omis)
  log.info(
    'Fiches liées :',
    candidates
      .filter((c) => c.link !== null)
      .map((c) => `#${c.id} ${c.format ?? '?'} ${c.episodes ?? '?'} ép. ${c.startDate ?? '?'} « ${c.titles[0] ?? '?'} » (${c.link})`),
  );

  // Plateforme généraliste (Netflix) : filtre « anime » avant toute mise en cache (un résultat trouvé par le
  // titre seul n'est jamais fiable, donc jamais enregistré ; un choix manuel en carte enregistre la correspondance)
  const result = gateByPlatformLink(episode, candidates, resolveTarget(episode, candidates));
  // Écrit aussi en lecture seule (persist: false, fiche de la page) : `persist` protège les correspondances
  // de l'utilisateur, alors que ce verdict ne dépend que du catalogue AniList (même calcul, même résultat)
  if (!result.ok && result.ignored) await rememberIgnoredSeries(episode);
  if (persist && !keepsChoice && result.ok && result.target.confidence === 'high') {
    const { mediaId, numbering, offset, episodes } = result.target;
    const mediaTitle = collected.media.find((m) => m.id === mediaId)?.displayTitle;
    await saveLearned(key, null, { mediaId, numbering, offset, episodes, seriesLabel: seasonLabel(episode), ...(mediaTitle ? { mediaTitle } : {}) });
  }
  if (__SYNCKAI_DEBUG__) {
    // Correspondance en cache oubliée (apprise et contredite) ou qui ne s'applique plus : gardée dans la décision
    recordMatchDecision({ episode, key, lane, source: 'resolved', candidates, result, mapping: stored ? { mapping: stored, verdict: verdict.kind } : null });
  }
  const { seasons, seasonGroups } = poolOf(collected, episode.animeTitle);
  return { result, candidates: summarize(collected, result.ok ? result.target.mediaId : null), seasons: seasons.map(toCandidateSummary), seasonGroups };
}

/** Résout la fiche AniList d'un épisode : cache d'abord (fromCache), série ignorée sans recherche, recherche sinon (fresh). */
export async function resolveEpisode(
  episode: EpisodeInfo,
  { persist = true, lane = 'interactive', revalidateCache = false }: ResolveOptions = {},
  catalog: Catalog = anilistCatalog,
): Promise<EpisodeResolution> {
  const key = mappingKey(episode);
  const stored = await getMediaMapping(key);
  const cache = await fromCache(episode, key, stored, { persist, lane, revalidateCache }, catalog);
  if (cache.kind === 'hit') return cache.resolution;
  const { confirmed, verdict, unknownPosition } = cache;
  // Ex : numérotation absolue passée à la fiche suivante, correspondance importée réfutée → nouvelle résolution.
  // Choix de l'utilisateur hors de sa fiche (épisode d'une autre partie de la saison, revisionnage d'un épisode antérieur) :
  // jamais supprimé ni remplacé, nouvelle résolution sans rien enregistrer
  // Position de l'épisode inconnue pour sa numérotation (M6 : numéro dans la saison absent de la page) : rien ne dit que
  // la correspondance est fausse, elle est gardée telle quelle et l'épisode résolu sans mise en cache
  const keepsChoice = (stored !== null && mappingOrigin(stored) === 'chosen' && confirmed !== null) || unknownPosition;
  if (keepsChoice) log.info(`Correspondance ${key} ${unknownPosition ? 'sans position connue pour cet épisode' : 'choisie hors de sa fiche pour cet épisode'} : conservée, résolution sans mise en cache`);
  // Suppression et apprentissage conditionnels : un choix enregistré pendant les requêtes (sélecteur, carte) n'est jamais écrasé
  if (stored && persist && !keepsChoice) await forgetIfUnchanged(key, confirmed ?? stored);
  return (await ignoredShortcut(episode, key, stored, lane)) ?? fresh(episode, key, { stored, verdict, keepsChoice, persist, lane }, catalog);
}

