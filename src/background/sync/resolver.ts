import { isSentPrimeAnimeVerdict, type EpisodeInfo } from '../../shared/episode.types';
import { hasSignals } from '../../shared/match-signals';
import type { CandidateSummary } from '../../shared/review.types';
import { PLATFORMS, type StreamingPlatform } from '../../platforms/registry';
import { STREAMING_PLATFORMS } from '../../platforms/ids';
import type { MediaMapping } from '../../shared/sync.types';
import { deleteMediaMappingIf, getMediaMapping, saveMediaMappingIf } from '../../browser/storage/mappings';
import { getAnimeByIds, searchAnime, type AniListMedia } from '../anilist/media';
import type { RequestLane } from '../rate-limit';
import {
  alignPlatformSeasons,
  applyMapping,
  cachedMappingVerdict,
  disneySeriesKey,
  filtersAnime,
  gateByPlatformLink,
  hasSeriesTitle,
  ignoredResult,
  isDisneyEntityLink,
  isLinked,
  isPrimeOwnLink,
  isTitleBoundLink,
  isOtherSeries,
  linksToOtherSeries,
  linksToOtherSeriesBySlug,
  mappingKey,
  seasonLabel,
  matchPlatformLink,
  primeOwnIds,
  provenBySignals,
  seasonSearchQuery,
  resolveTarget,
  savedMappingDoubt,
  seasonPool,
  SERIES_FORMATS,
  toSortableDate,
  type CachedMappingVerdict,
  type LinkKind,
  type MediaCandidate,
  type ResolveResult,
  type SyncTarget,
} from './matching';
import { normalizeTitle, slugSearchTitle, withoutDiacritics } from '../../shared/title';
import { isSeriesIgnored, rememberIgnoredSeries } from './ignored-series';
import { groupSeasons } from './season-groups';
import { recordMatchDecision } from './match-diagnostic';
import type { SignalName } from './concordance';
import { createLogger } from '../../browser/logger';

const log = createLogger('sync');

const FRANCHISE_RELATIONS: ReadonlySet<string> = new Set(['SEQUEL', 'PREQUEL']);
/** Limite les requêtes supplémentaires pour récupérer les saisons absentes de la recherche */
const MAX_FETCH_ROUNDS = 2;
/** Nombre de fiches proposées dans une carte de vérification */
const MAX_REVIEW_CANDIDATES = 8;

interface CollectedCandidates {
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

interface ResolveOptions {
  /** false : lecture seule (fiche de la page), le cache des correspondances n'est ni écrit ni purgé */
  persist?: boolean;
  /** 'background' : tâche de fond (import Crunchyroll), budget de requêtes limité */
  lane?: RequestLane;
}

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
 * Recherche les fiches AniList de la franchise et détermine le lien de chacune avec la série.
 * Les suites/préquelles d'une fiche liée sont ajoutées (et récupérées si besoin) : AniList ne lie
 * pas toujours chaque saison à la plateforme.
 */
async function collectCandidates(episode: SeriesQuery, lane: RequestLane = 'interactive'): Promise<CollectedCandidates> {
  const mediaById = new Map<number, AniListMedia>();
  const links = new Map<number, LinkKind>();

  const episodeId = episode.episodeId ?? null;
  // Disney+, Prime Video : lien vers la plateforme sans identifiant de série, valable seulement pour une fiche au titre de
  // la série, sauf lien vers la page elle-même (Disney+ /browse/entity-{uuid} ; Prime Video : GTI compact de la saison,
  // GTI de l'épisode) : certain, quel que soit le titre
  const titleBound = isTitleBoundLink(episode.platform);
  const ownPrimeIds = episode.platform === 'prime' ? primeOwnIds({ seriesId: episode.seriesId, episodeId, ...(episode.url !== undefined ? { url: episode.url } : {}) }) : [];
  const isOwnLink = (url: string): boolean => (episode.platform === 'prime' ? isPrimeOwnLink(url, ownPrimeIds) : isDisneyEntityLink(url, episode.seriesId));
  const linkOf = (media: AniListMedia): LinkKind => {
    const isOwnEntity = titleBound && media.externalLinkUrls.some(isOwnLink);
    if (titleBound && !isOwnEntity && !hasSeriesTitle(media.titles, episode.animeTitle) && !(episode.seasonTitle && hasSeriesTitle(media.titles, episode.seasonTitle))) return null;
    const kinds = media.externalLinkUrls.map((url) => matchPlatformLink(url, episode.platform, episode.seriesId, episode.seriesSlug, episodeId));
    // Le lien vers l'épisode lui-même prime sur le lien vers la série
    if (kinds.includes('episode')) return 'episode';
    const own = kinds.find((k) => k !== null);
    // Disney+, Prime Video : lien vers la plateforme sans désigner la page elle-même → présence seule (voir hasTrustedLinks)
    if (own) return titleBound && !isOwnEntity ? 'platform' : own;
    // Liée seulement à une autre série de la plateforme : marquée pour ne jamais devenir une saison par relation
    // (identifiant différent : signal fort ; ancien slug différent : signal faible, voir resolveTarget)
    if (media.externalLinkUrls.some((url) => linksToOtherSeries(url, episode.platform, episode.seriesId))) return 'other';
    return media.externalLinkUrls.some((url) => linksToOtherSeriesBySlug(url, episode.platform, episode.seriesSlug)) ? 'other-slug' : null;
  };
  const add = (list: AniListMedia[], fallback: LinkKind = null): void => {
    for (const media of list) {
      if (mediaById.has(media.id)) continue;
      mediaById.set(media.id, media);
      links.set(media.id, linkOf(media) ?? fallback);
    }
  };

  // Titre de saison distinct (ex : saison « HEROINES » de One Piece) : la recherche du seul titre de la série
  // est noyée sous les fiches de la franchise (20 résultats), la fiche de la saison n'y figure pas toujours.
  // Recherche complémentaire « série + saison », fusionnée sans doublon.
  const seasonQuery = seasonSearchQuery(episode.animeTitle, episode.seasonTitle);
  const [main, bySeason] = await Promise.all([searchAnime(episode.animeTitle, lane), seasonQuery ? searchAnime(seasonQuery, lane) : Promise.resolve([])]);
  add(main);
  add(bySeason);

  // Aucun résultat lié : le titre de saison seul est parfois le titre AniList (ex : "… Season 2")
  const hasLinked = [...links.values()].some((link) => isLinked({ link }));
  if (!hasLinked && episode.seasonTitle && normalizeTitle(episode.seasonTitle) !== normalizeTitle(episode.animeTitle) && episode.seasonTitle !== seasonQuery) {
    add(await searchAnime(episode.seasonTitle, lane));
  }

  // Toujours rien de lié : titre sans accents (AniList ne trouve pas les synonymes accentués, titres localisés de
  // Crunchyroll /fr/), puis slug de l'URL (titre anglais sur Crunchyroll). Mêmes résultats à chaque relecture de la page
  // (requête exacte comparée : normalizeTitle retire déjà les accents)
  const searched = new Set([episode.animeTitle.toLowerCase()]);
  for (const query of [withoutDiacritics(episode.animeTitle), slugSearchTitle(episode.seriesSlug)]) {
    if (!query || searched.has(query.toLowerCase())) continue;
    if ([...links.values()].some((link) => isLinked({ link }))) break;
    searched.add(query.toLowerCase());
    add(await searchAnime(query, lane));
  }

  /**
   * Disney+ (lien sans identifiant de série en lecture) : fiche liée à Disney+ mais refusée par la règle du titre, dont
   * le lien désigne une AUTRE série Disney+ que celle des fiches retenues (BLEACH, /series/bleach/…, pour BLEACH:
   * Thousand-Year Blood War, /series/bleach-thousand-year-blood-war/…) : autre série de la plateforme, jamais une saison
   * par relation (sinon BLEACH, préquelle, deviendrait la saison 1). Même lien qu'une fiche retenue (« The Separation »,
   * suite publiée dans la même série Disney+) : fiche de la série.
   */
  // Prime Video exclu : un lien par saison (identifiants différents d'une saison à l'autre de la même série)
  const settleTitleBoundLinks = (): void => {
    if (episode.platform !== 'disney') return;
    const ownKeys = new Set([...mediaById.values()].filter((m) => links.get(m.id) === 'id' || links.get(m.id) === 'platform').flatMap((m) => m.externalLinkUrls.flatMap((url) => disneySeriesKey(url) ?? [])));
    if (ownKeys.size === 0) return;
    const ownForms = new Set([...ownKeys].map((key) => key.split(':')[0]));
    for (const media of mediaById.values()) {
      const link = links.get(media.id);
      if (link !== null && link !== 'relation') continue;
      const keys = media.externalLinkUrls.flatMap((url) => disneySeriesKey(url) ?? []);
      if (keys.some((key) => ownKeys.has(key))) links.set(media.id, 'platform');
      else if (keys.some((key) => ownForms.has(key.split(':')[0]))) links.set(media.id, 'other');
    }
  };
  settleTitleBoundLinks();

  // Numérotation absolue (One Piece E1180) déjà couverte par une fiche série liée directement (en cours de diffusion, ou
  // assez d'épisodes) : la saison est trouvée sans les suites / préquelles absentes de la recherche, qui ne sont pas
  // demandées à AniList (budget de requêtes : un début de lecture ne coûte que la recherche)
  const absolute = episode.displayedEpisodeNumber ?? null;
  const isAbsolute = absolute !== null && episode.seasonEpisodeNumber !== undefined && episode.seasonEpisodeNumber !== null && absolute > episode.seasonEpisodeNumber;
  const coveredByLinkedEntry = (): boolean =>
    isAbsolute &&
    [...mediaById.values()].some((m) => (links.get(m.id) === 'id' || links.get(m.id) === 'platform') && m.format !== null && SERIES_FORMATS.has(m.format) && (m.episodes === null || m.episodes >= absolute));

  // Propagation du lien le long des relations SEQUEL/PREQUEL jusqu'à stabilisation
  let fetchRounds = 0;
  for (;;) {
    let changed = false;
    const missing = new Set<number>();

    for (const media of mediaById.values()) {
      // Un lien vers un épisode précis (spécial, film) ne fait pas de ses suites des saisons de la série, ni une
      // fiche d'une autre série de la plateforme (Naruto ne propage rien vers Boruto sur la page Shippuden)
      const link = links.get(media.id);
      if (link === undefined || link === null || link === 'episode' || isOtherSeries({ link })) continue;
      for (const rel of media.relations) {
        if (rel.type !== 'ANIME' || !FRANCHISE_RELATIONS.has(rel.relationType ?? '')) continue;
        const related = mediaById.get(rel.id);
        if (related) {
          // Seule une fiche sans aucun lien devient 'relation' : une fiche 'other' / 'other-slug' le reste
          if (links.get(rel.id) === null && isSeasonRelation(media, rel.relationType, related, episode.platform)) {
            links.set(rel.id, 'relation');
            changed = true;
          }
        } else if (rel.format !== null && SERIES_FORMATS.has(rel.format)) {
          missing.add(rel.id);
        }
      }
    }

    if (missing.size > 0 && fetchRounds < MAX_FETCH_ROUNDS && !coveredByLinkedEntry()) {
      fetchRounds++;
      // Fiches sans lien : rattachées au tour suivant si la relation tient (isSeasonRelation) ; une fiche liée à une autre
      // série reste 'other' / 'other-slug' (voir linkOf)
      add(await getAnimeByIds([...missing], lane));
      settleTitleBoundLinks();
      changed = true;
    }
    if (!changed) break;
  }

  const toCandidates = (): MediaCandidate[] => [...mediaById.values()].map((m) => asCandidate(m, links.get(m.id) ?? null));

  // Saisons de la plateforme (Netflix : épisodes par saison) rapprochées des fiches de la franchise : une saison liée à
  // un autre titre de la plateforme (`other`) devient une saison de la série si les nombres d'épisodes concordent
  if (episode.platformSeasons && episode.platformSeasons.length > 0) {
    const neighbors = new Map<number, number[]>();
    const relate = (a: number, b: number): void => {
      neighbors.set(a, [...(neighbors.get(a) ?? []), b]);
      neighbors.set(b, [...(neighbors.get(b) ?? []), a]);
    };
    for (const media of mediaById.values()) {
      for (const rel of media.relations) if (rel.type === 'ANIME' && FRANCHISE_RELATIONS.has(rel.relationType ?? '')) relate(media.id, rel.id);
    }
    const aligned = alignPlatformSeasons(episode.platformSeasons, toCandidates(), neighbors) ?? [];
    for (const id of aligned) {
      const link = links.get(id);
      if (link === null || link === undefined || isOtherSeries({ link })) links.set(id, 'relation');
    }
    if (aligned.length > 0) log.info('Saisons de la plateforme alignées sur les fiches :', aligned);
  }

  return { candidates: toCandidates(), media: [...mediaById.values()] };
}

const sortableStart = (media: AniListMedia): number | null => toSortableDate(media.startDate);

/** Fiche AniList comparée par les règles et la concordance */
function asCandidate(m: AniListMedia, link: LinkKind): MediaCandidate {
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
function candidateSignals(media: AniListMedia): Pick<MediaCandidate, 'endYear' | 'status' | 'duration' | 'country' | 'relations'> {
  return {
    endYear: media.endDate?.year ?? null,
    status: media.status ?? null,
    duration: media.duration ?? null,
    country: media.countryOfOrigin ?? null,
    relations: media.relations.flatMap((rel) => (rel.type === 'ANIME' && (rel.relationType === 'SEQUEL' || rel.relationType === 'PREQUEL') ? [{ id: rel.id, type: rel.relationType }] : [])),
  };
}

/**
 * Correspondance en cache confrontée aux signaux de la plateforme (voir matching.ts › cachedMappingVerdict), avec sa
 * fiche (proposée dans la carte « À vérifier » si elle est mise en doute). Une requête au catalogue (en cache quelques
 * minutes), seulement avec des signaux et hors choix de l'utilisateur (`chosen`).
 */
async function questionMapping(episode: EpisodeInfo, mapping: MediaMapping, lane: RequestLane): Promise<{ verdict: CachedMappingVerdict; media: AniListMedia | null }> {
  if (mapping.chosen === true || !hasSignals(episode.signals)) return { verdict: { kind: 'keep' }, media: null };
  const media = (await getAnimeByIds([mapping.mediaId], lane)).find((m) => m.id === mapping.mediaId) ?? null;
  if (!media) return { verdict: { kind: 'keep' }, media: null };
  const entry = { id: media.id, format: media.format, episodes: media.episodes, startDate: sortableStart(media), titles: media.titles, ...candidateSignals(media) };
  return { verdict: cachedMappingVerdict(mapping, entry, episode.signals), media };
}

/**
 * Lien vers une AUTRE plateforme prise en charge, et aucun vers celle de la série (MONSTERS : Netflix seulement).
 * Prime Video n'entre pas en compte, ni d'un côté ni de l'autre : ses liens AniList sont rares (Vinland Saga, SPY×FAMILY…
 * n'en ont aucun) et souvent vers d'anciennes pages amazon.com, leur absence ne prouve rien.
 */
function linksElsewhereOnly(media: AniListMedia, platform: StreamingPlatform): boolean {
  if (platform === 'prime') return false;
  const hosts = media.externalLinkUrls.flatMap((url) => {
    try {
      return [new URL(url).hostname];
    } catch {
      return [];
    }
  });
  const onPlatform = (id: StreamingPlatform): boolean => hosts.some((host) => PLATFORMS[id].matchesHost(host));
  return !onPlatform(platform) && STREAMING_PLATFORMS.some((other) => other !== platform && other !== 'prime' && onPlatform(other));
}

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
export async function findSeriesSeasons(query: SeriesQuery): Promise<SeriesSeasons> {
  const collected = await collectCandidates(query);
  const others = collected.media.filter((m) => m.format !== 'MUSIC');
  return { candidates: collected.candidates, ...poolOf(collected, query.animeTitle), others };
}

/** Fiches candidates d'un épisode, sans résolution (ex : correction d'une synchro passée). */
export async function findReviewCandidates(episode: EpisodeInfo, suggestedId: number | null): Promise<CandidateSummary[]> {
  return summarize(await collectCandidates(episode), suggestedId);
}

/**
 * Correspondance importée d'une sauvegarde (BAK-02) : jugée sûre seulement si sa fiche existe dans le catalogue AniList
 * et contient la progression qu'elle donne. Confirmée : enregistrée sans l'indicateur, avec le nombre d'épisodes du
 * catalogue (`persist`). Réfutée : null (l'appelant la retire et résout de nouveau). Erreur réseau : propagée, comme
 * celle d'une recherche (la correspondance reste à revérifier).
 */
async function confirmImportedMapping(episode: EpisodeInfo, key: string, mapping: MediaMapping, persist: boolean, lane: RequestLane): Promise<MediaMapping | null> {
  const media = (await getAnimeByIds([mapping.mediaId], lane)).find((m) => m.id === mapping.mediaId);
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
  // Écrite seulement si la correspondance n'a pas changé pendant la requête (choix de l'utilisateur entre-temps)
  if (persist) await saveMediaMappingIf(key, mapping, confirmed);
  return confirmed;
}

/**
 * Correspondance en cache d'origine inconnue (ni `learned` ni `chosen` : enregistrée avant la 2.4.0, importée) que les
 * signaux de la plateforme contredisent : peut-être un choix de l'utilisateur, donc jamais supprimée ni réécrite, mais
 * jamais synchronisée d'office. Résultat « À vérifier » : fiche prouvée par les signaux (nouvelle résolution, groupe de
 * saison unique et confirmé) proposée si elle diffère, sinon la fiche en cache ; celle-ci reste parmi les fiches
 * proposées. Valider la carte enregistre le choix (`chosen`, voir sync-service.ts › resolveReview).
 */
async function doubtedMapping(
  episode: EpisodeInfo,
  key: string,
  cached: MediaMapping & { progress: number },
  media: AniListMedia,
  signals: readonly SignalName[],
  lane: RequestLane,
): Promise<EpisodeResolution> {
  const collected = await collectCandidates(episode, lane);
  const fresh = gateByPlatformLink(episode, collected.candidates, resolveTarget(episode, collected.candidates));
  const reason = savedMappingDoubt(signals);
  const isProven = (target: SyncTarget): boolean => target.bySignals === true || provenBySignals(episode, collected.candidates, target.mediaId);
  const proven = fresh.ok && fresh.target.confidence === 'high' && fresh.target.mediaId !== cached.mediaId && isProven(fresh.target) ? fresh.target : null;
  const target: SyncTarget = proven ? { ...proven, confidence: 'low', reason } : { ...cached, confidence: 'low', reason };
  log.info(`Correspondance ${key} (#${cached.mediaId}) contredite par la plateforme (${signals.join(', ')}) : à vérifier${proven ? `, #${proven.mediaId} proposée` : ''}`);
  const summaries = summarize(collected, target.mediaId);
  // La fiche en cache reste sélectionnable (choix possible de l'utilisateur), même absente de la recherche
  const candidates = summaries.some((c) => c.id === media.id) ? summaries : [...summaries.slice(0, 1), toCandidateSummary(media), ...summaries.slice(1)].slice(0, MAX_REVIEW_CANDIDATES);
  const { seasons, seasonGroups } = poolOf(collected, episode.animeTitle);
  const result: ResolveResult = { ok: true, target };
  if (__SYNCKAI_DEBUG__) recordMatchDecision({ episode, key, lane, source: 'doubted', candidates: collected.candidates, result, mapping: { mapping: cached, verdict: 'doubt' } });
  return { result, candidates, seasons: seasons.map(toCandidateSummary), seasonGroups };
}

/** Résout la fiche AniList d'un épisode : cache d'abord, recherche sinon (et mise en cache si fiable). */
export async function resolveEpisode(episode: EpisodeInfo, { persist = true, lane = 'interactive' }: ResolveOptions = {}): Promise<EpisodeResolution> {
  const key = mappingKey(episode);

  const stored = await getMediaMapping(key);
  // Correspondance importée : revérifiée sur le catalogue avant d'être jugée sûre (BAK-02)
  const confirmed = stored?.unverified === true && applyMapping(episode, stored) !== null ? await confirmImportedMapping(episode, key, stored, persist, lane) : stored;
  // Signaux de la plateforme contre la correspondance : apprise et contredite → oubliée, nouvelle résolution ; origine
  // inconnue et contredite → « À vérifier » (doubtedMapping) ; choix de l'utilisateur → jamais remis en cause
  const question = confirmed ? await questionMapping(episode, confirmed, lane) : null;
  const { verdict } = question ?? { verdict: { kind: 'keep' } as const };
  if (verdict.kind === 'drop') log.info(`Correspondance apprise ${key} contredite par la plateforme (${verdict.signals.join(', ')}) : nouvelle résolution`);
  const cached = verdict.kind === 'drop' ? null : confirmed;
  if (cached) {
    const progress = applyMapping(episode, cached);
    if (progress !== null) {
      if (verdict.kind === 'doubt' && question?.media) return doubtedMapping(episode, key, { ...cached, progress }, question.media, verdict.signals, lane);
      const result: ResolveResult = { ok: true, target: { ...cached, progress, confidence: 'high', reason: 'Correspondance en cache', fromCache: true } };
      if (__SYNCKAI_DEBUG__) {
        const candidates = question?.media ? [asCandidate(question.media, null)] : [];
        recordMatchDecision({ episode, key, lane, source: 'cache', candidates, result, mapping: { mapping: cached, verdict: verdict.kind } });
      }
      return {
        result,
        candidates: [],
        seasons: [],
        seasonGroups: [],
      };
    }
  }
  // Ex : numérotation absolue passée à la fiche suivante, correspondance importée réfutée → nouvelle résolution.
  // Choix de l'utilisateur hors de sa fiche (épisode d'une autre partie de la saison, revisionnage d'un épisode antérieur) :
  // jamais supprimé ni remplacé, nouvelle résolution sans rien enregistrer
  const keepsChoice = stored?.chosen === true && confirmed !== null;
  if (keepsChoice) log.info(`Correspondance choisie ${key} hors de sa fiche pour cet épisode : conservée, résolution sans mise en cache`);
  // Suppression et apprentissage conditionnels : un choix enregistré pendant les requêtes (sélecteur, carte) n'est jamais écrasé
  if (stored && persist && !keepsChoice) await deleteMediaMappingIf(key, confirmed ?? stored);

  // Prime Video sans verdict « anime » (jamais envoyé ainsi par le script de contenu) : ignoré sans recherche
  if (episode.platform === 'prime' && !isSentPrimeAnimeVerdict(episode.primeAnime)) {
    if (__SYNCKAI_DEBUG__) recordMatchDecision({ episode, key, lane, source: 'ignored', candidates: [], result: ignoredResult(episode) });
    return { result: ignoredResult(episode), candidates: [], seasons: [], seasonGroups: [] };
  }
  // Plateforme généraliste (ou Prime Video hors genre anime) : série déjà ignorée (moins de 24 h) → aucune recherche
  // AniList. Une correspondance enregistrée (choix manuel) l'emporte : vérifiée ci-dessus, et sa présence montre que la
  // série est un anime.
  if (filtersAnime(episode) && !stored && (await isSeriesIgnored(episode))) {
    log.info('Série déjà ignorée (verdict mémorisé) : pas de nouvelle recherche', episode.animeTitle);
    if (__SYNCKAI_DEBUG__) recordMatchDecision({ episode, key, lane, source: 'ignored', candidates: [], result: ignoredResult(episode) });
    return { result: ignoredResult(episode), candidates: [], seasons: [], seasonGroups: [] };
  }

  const collected = await collectCandidates(episode, lane);
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
    await saveMediaMappingIf(key, null, { mediaId, numbering, offset, episodes, seriesLabel: seasonLabel(episode), ...(mediaTitle ? { mediaTitle } : {}), learned: true });
  }
  if (__SYNCKAI_DEBUG__) {
    // Correspondance en cache oubliée (apprise et contredite) ou qui ne s'applique plus : gardée dans la décision
    recordMatchDecision({ episode, key, lane, source: 'resolved', candidates, result, mapping: stored ? { mapping: stored, verdict: verdict.kind } : null });
  }
  const { seasons, seasonGroups } = poolOf(collected, episode.animeTitle);
  return { result, candidates: summarize(collected, result.ok ? result.target.mediaId : null), seasons: seasons.map(toCandidateSummary), seasonGroups };
}
