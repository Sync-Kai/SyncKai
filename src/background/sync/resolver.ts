import type { EpisodeInfo } from '../../shared/episode.types';
import type { CandidateSummary } from '../../shared/review.types';
import { deleteMediaMapping, getMediaMapping, saveMediaMapping } from '../../shared/storage';
import { getAnimeByIds, searchAnime, type AniListMedia } from '../api/media';
import type { RequestLane } from '../api/rate-limit';
import {
  applyMapping,
  gateByPlatformLink,
  ignoredResult,
  isLinked,
  isOtherSeries,
  LINK_REQUIRED_PLATFORMS,
  linksToOtherSeries,
  linksToOtherSeriesBySlug,
  mappingKey,
  seasonLabel,
  matchPlatformLink,
  normalizeTitle,
  seasonSearchQuery,
  resolveTarget,
  seasonPool,
  SERIES_FORMATS,
  toSortableDate,
  type LinkKind,
  type MediaCandidate,
  type ResolveResult,
} from './matching';
import { isSeriesIgnored, rememberIgnoredSeries } from './ignored-series';
import { groupSeasons } from './season-groups';
import { createLogger } from '../../shared/logger';

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
 */
export type SeriesQuery = Pick<EpisodeInfo, 'platform' | 'seriesId' | 'seriesSlug' | 'animeTitle' | 'seasonTitle'> & { episodeId?: string | null };

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
  const linkOf = (media: AniListMedia): LinkKind => {
    const kinds = media.externalLinkUrls.map((url) => matchPlatformLink(url, episode.platform, episode.seriesId, episode.seriesSlug, episodeId));
    // Le lien vers l'épisode lui-même prime sur le lien vers la série
    if (kinds.includes('episode')) return 'episode';
    const own = kinds.find((k) => k !== null);
    if (own) return own;
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
        if (mediaById.has(rel.id)) {
          // Seule une fiche sans aucun lien devient 'relation' : une fiche 'other' / 'other-slug' le reste
          if (links.get(rel.id) === null) {
            links.set(rel.id, 'relation');
            changed = true;
          }
        } else if (rel.format !== null && SERIES_FORMATS.has(rel.format)) {
          missing.add(rel.id);
        }
      }
    }

    if (missing.size > 0 && fetchRounds < MAX_FETCH_ROUNDS) {
      fetchRounds++;
      // Repli 'relation' pour une fiche sans lien ; une fiche liée à une autre série reste 'other' / 'other-slug' (voir linkOf)
      add(await getAnimeByIds([...missing], lane), 'relation');
      changed = true;
    }
    if (!changed) break;
  }

  const media = [...mediaById.values()];
  const candidates = media.map((m) => ({
    id: m.id,
    format: m.format,
    episodes: m.episodes,
    startDate: toSortableDate(m.startDate),
    titles: m.titles,
    link: links.get(m.id) ?? null,
  }));
  return { candidates, media };
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

/** Résout la fiche AniList d'un épisode : cache d'abord, recherche sinon (et mise en cache si fiable). */
export async function resolveEpisode(episode: EpisodeInfo, { persist = true, lane = 'interactive' }: ResolveOptions = {}): Promise<EpisodeResolution> {
  const key = mappingKey(episode);

  const cached = await getMediaMapping(key);
  if (cached) {
    const progress = applyMapping(episode, cached);
    if (progress !== null) {
      return { result: { ok: true, target: { ...cached, progress, confidence: 'high', reason: 'Correspondance en cache' } }, candidates: [], seasons: [], seasonGroups: [] };
    }
    // Ex : numérotation absolue passée à la fiche suivante → nouvelle résolution
    if (persist) await deleteMediaMapping(key);
  }

  // Plateforme généraliste : série déjà ignorée (moins de 24 h) → aucune recherche AniList. Une correspondance
  // enregistrée (choix manuel) l'emporte : vérifiée ci-dessus, et sa présence montre que la série est un anime.
  if (LINK_REQUIRED_PLATFORMS.has(episode.platform) && !cached && (await isSeriesIgnored(episode))) {
    log.info('Série déjà ignorée (verdict mémorisé) : pas de nouvelle recherche', episode.animeTitle);
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
  if (persist && result.ok && result.target.confidence === 'high') {
    const { mediaId, numbering, offset, episodes } = result.target;
    const mediaTitle = collected.media.find((m) => m.id === mediaId)?.displayTitle;
    await saveMediaMapping(key, { mediaId, numbering, offset, episodes, seriesLabel: seasonLabel(episode), ...(mediaTitle ? { mediaTitle } : {}) });
  }
  const { seasons, seasonGroups } = poolOf(collected, episode.animeTitle);
  return { result, candidates: summarize(collected, result.ok ? result.target.mediaId : null), seasons: seasons.map(toCandidateSummary), seasonGroups };
}
