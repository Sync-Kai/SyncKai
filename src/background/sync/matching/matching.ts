import { t } from '../../../i18n';
import { DISNEY_ARC_SEASON, isSentPrimeAnimeVerdict, type EpisodeInfo } from '../../../shared/episode.types';
import type { PlatformSignals } from '../../../shared/match-signals';
import { PLATFORMS, type StreamingPlatform } from '../../../platforms/registry';
import { parsePrimeDetailId, primeId, primeIdInLink } from '../../../platforms/prime/metadata';
import { normalizeTitle, titleKey } from '../../../shared/title';
import { groupSeasons } from './season-groups';
import { exactTitleKeys } from './concordance';
import { byStartDate, isDirectlyLinked, isLinked, SEASON_COUNT_TOLERANCE, SERIES_FORMATS, totalEpisodes, type LinkKind, type MediaCandidate, type ResolveResult } from './model';
import { seasonPool } from './season-pool';
import { isSpecialTitled } from './season-titles';
import { inLinkedFranchise } from './signal-groups';

// Liens AniList vers les plateformes, clé et libellé d'une saison, et filtre « anime » des plateformes généralistes.
// Règles de correspondance : rules-engine.ts (étapes : stages/) ; modèle : model.ts ; correspondances en cache :
// mapping.ts ; titres de saison : season-titles.ts ; signaux : signal-groups.ts et concordance.ts.

// ─── Helpers ──────────────────────────────────────────────────────────────

export function toSortableDate(date: { year: number | null; month: number | null; day: number | null } | null): number | null {
  if (!date?.year) return null;
  // Mois/jour inconnus : placés en fin de période pour ne pas passer devant une date précise
  return date.year * 10_000 + (date.month ?? 12) * 100 + (date.day ?? 31);
}

export function matchCrunchyrollLink(url: string, seriesId: string | null, seriesSlug: string | null): LinkKind {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (!PLATFORMS.crunchyroll.matchesHost(parsed.hostname)) return null;

  const segments = parsed.pathname.toLowerCase().split('/').filter(Boolean);
  const seriesIndex = segments.indexOf('series');
  if (seriesIndex !== -1) {
    return seriesId && segments[seriesIndex + 1] === seriesId.toLowerCase() ? 'id' : null;
  }
  // Ancien format : /{slug} ou /{langue}/{slug}
  return seriesSlug && segments.length <= 2 && segments.at(-1) === seriesSlug ? 'slug' : null;
}

/** Libellé lisible d'une saison : "One Piece · S24 (Elbaph)" */
export function seasonLabel(episode: Pick<EpisodeInfo, 'animeTitle' | 'seasonNumber' | 'seasonTitle'>): string {
  const season = episode.seasonNumber !== null ? ` · S${episode.seasonNumber}` : '';
  const hasDistinctTitle = episode.seasonTitle && normalizeTitle(episode.seasonTitle) !== normalizeTitle(episode.animeTitle);
  return `${episode.animeTitle}${season}${hasDistinctTitle ? ` (${episode.seasonTitle})` : ''}`;
}

/**
 * Lien ADN : /video/{seriesId}-{slug} (actuel) ou /video/{slug} (ancien format),
 * sur animationdigitalnetwork.com / .fr / .de.
 */
export function matchAdnLink(url: string, seriesId: string | null, seriesSlug: string | null): LinkKind {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (!PLATFORMS.adn.matchesHost(parsed.hostname)) return null;

  const segments = parsed.pathname.toLowerCase().split('/').filter(Boolean);
  const series = segments[segments.indexOf('video') + 1];
  if (!segments.includes('video') || !series) return null;
  const [, linkedId, linkedSlug] = /^(?:(\d+)-)?(.+)$/.exec(series) ?? [];
  if (linkedId !== undefined) {
    // Identifiant explicite : il fait foi (un slug identique avec un autre identifiant est une autre série)
    return seriesId !== null && linkedId === seriesId ? 'id' : null;
  }
  // Ancien format sans identifiant : comparaison du slug
  return seriesSlug && linkedSlug === seriesSlug ? 'slug' : null;
}

/**
 * Lien Netflix vers la fiche de la série : /title/{seriesId}, éventuellement précédé du pays
 * (/be-fr/title/{id}, /us/title/{id}). Les pages de lecture (/watch/{id}) ne désignent pas la série.
 */
export function matchNetflixLink(url: string, seriesId: string | null): LinkKind {
  if (!seriesId) return null;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (!PLATFORMS.netflix.matchesHost(parsed.hostname)) return null;
  const match = /^\/(?:[a-z]{2}(?:-[a-z]{2})?\/)?title\/(\d+)\/?$/i.exec(parsed.pathname);
  return match?.[1] === seriesId ? 'id' : null;
}

/** Lien Disney+ vers une page de série : /browse/entity-{uuid}, éventuellement précédé de la langue */
const DISNEY_ENTITY_PATH = /^\/(?:[a-z]{2,3}(?:-[a-z0-9]{2,4})?\/)?browse\/entity-([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\/?$/i;

/** uuid de l'entité d'un lien Disney+ /browse/entity-{uuid} (minuscules), null pour une autre forme ou un autre site */
export function disneyEntityInLink(url: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (!PLATFORMS.disney.matchesHost(parsed.hostname)) return null;
  return DISNEY_ENTITY_PATH.exec(parsed.pathname)?.[1]?.toLowerCase() ?? null;
}

/** Ancien lien Disney+ vers une série : /series/{slug}/{id}, éventuellement précédé de la langue */
const DISNEY_LEGACY_SERIES_PATH = /^\/(?:[a-z]{2,3}(?:-[a-z0-9]{2,4})?\/)?series\/[^/]+\/([a-z0-9]{6,20})\/?$/i;

/**
 * Série Disney+ désignée par un lien AniList : « series:{id} » (ancien lien /series/{slug}/{id}) ou « entity:{uuid} »
 * (/browse/entity-{uuid}). Deux liens de même forme et de clés différentes désignent deux séries Disney+ distinctes ;
 * deux formes différentes ne se comparent pas. null pour une autre forme ou un autre site.
 */
export function disneySeriesKey(url: string): string | null {
  const entity = disneyEntityInLink(url);
  if (entity) return `entity:${entity}`;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (!PLATFORMS.disney.matchesHost(parsed.hostname)) return null;
  const id = DISNEY_LEGACY_SERIES_PATH.exec(parsed.pathname)?.[1];
  return id ? `series:${id.toLowerCase()}` : null;
}

/**
 * Lien de la fiche vers la série Disney+ elle-même (page de série : `seriesId` = uuid de l'entité) : correspondance
 * certaine, sans condition de titre. Faux sur une page de lecture (aucun identifiant de série).
 */
export function isDisneyEntityLink(url: string, seriesId: string | null): boolean {
  return seriesId !== null && disneyEntityInLink(url) === seriesId.toLowerCase();
}

/**
 * Lien Disney+ (source « Disney Plus » d'AniList, toutes formes : /series/{slug}/{id}, /browse/entity-{uuid}…) :
 * la page de lecture ne donne aucun identifiant de série, le lien prouve seulement que la fiche est sur Disney+.
 * Retenu comme lien de la série uniquement si un titre de la fiche est celui de la série (voir isTitleBoundLink), ou
 * s'il désigne l'entité de la page de série (isDisneyEntityLink). Page de série : un lien vers une AUTRE entité ne
 * rattache pas la fiche (sans l'exclure pour autant : une saison peut être publiée comme série à part).
 */
export function matchDisneyLink(url: string, seriesId: string | null = null): LinkKind {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (!PLATFORMS.disney.matchesHost(parsed.hostname)) return null;
  const entity = seriesId !== null ? disneyEntityInLink(url) : null;
  return entity !== null && entity !== seriesId?.toLowerCase() ? null : 'id';
}

/**
 * Plateforme sans identifiant de série sur la page de lecture (Disney+, Prime Video) : un lien vers la plateforme ne
 * rattache une fiche à la série que si l'un de ses titres est celui de la série (titre exact, partie « Part 2 » ou
 * « Season N »), sauf lien vers la page elle-même (isDisneyEntityLink, isPrimeOwnLink). Sans cette condition, toute
 * fiche Disney+ ou Prime Video des résultats de recherche deviendrait une saison de la série.
 */
export function isTitleBoundLink(platform: StreamingPlatform): boolean {
  return platform === 'disney' || platform === 'prime';
}

/**
 * Lien Prime Video d'une fiche AniList (primevideo.com ou amazon.<tld> : /detail/{id}, /dp/{ASIN}, /gp/video/detail/{id},
 * `?gti=`) : prouve seulement que la fiche est sur Prime Video (identifiants régionaux, une saison par lien). Retenu comme
 * lien de la série si un titre de la fiche est celui de la série (isTitleBoundLink) ou s'il désigne la page elle-même
 * (isPrimeOwnLink). null pour un autre site ou une autre page.
 */
export function matchPrimeLink(url: string): LinkKind {
  return primeIdInLink(url) !== null ? 'id' : null;
}

/**
 * Identifiants Prime Video de la page (forme canonique de primeId) : GTI compact de la saison (`seriesId` d'une page de
 * détail), épisode en lecture (`episodeId`, GTI de l'épisode) et identifiant du chemin /detail/{id} de l'URL de l'épisode
 * (GTI compact de sa saison).
 */
export function primeOwnIds(query: { seriesId: string | null; episodeId?: string | null; url?: string }): string[] {
  let fromUrl: string | null = null;
  try {
    fromUrl = query.url ? parsePrimeDetailId(new URL(query.url).pathname) : null;
  } catch {
    fromUrl = null;
  }
  return [...new Set([query.seriesId, query.episodeId ?? null, fromUrl].flatMap((id) => primeId(id) ?? []))];
}

/** Lien Prime Video vers la page elle-même (saison ou épisode, voir primeOwnIds) : correspondance certaine, sans condition de titre */
export function isPrimeOwnLink(url: string, ownIds: readonly string[]): boolean {
  const id = primeIdInLink(url);
  return id !== null && ownIds.includes(id);
}

/** Lien Crunchyroll vers la page de lecture d'un épisode précis : /watch/{episodeId}[/slug] */
export function matchCrunchyrollEpisodeLink(url: string, episodeId: string | null): boolean {
  if (!episodeId) return false;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (!PLATFORMS.crunchyroll.matchesHost(parsed.hostname)) return false;
  const segments = parsed.pathname.toLowerCase().split('/').filter(Boolean);
  const watchIndex = segments.indexOf('watch');
  return watchIndex !== -1 && segments[watchIndex + 1] === episodeId.toLowerCase();
}

type LinkMatcher = (url: string, seriesId: string | null, seriesSlug: string | null, episodeId: string | null) => LinkKind;

/** Lecture des liens AniList propre à chaque plateforme (formes d'URL), hôtes vérifiés par le registre PLATFORMS */
const LINK_MATCHERS: Record<StreamingPlatform, LinkMatcher> = {
  crunchyroll: (url, seriesId, seriesSlug, episodeId) =>
    matchCrunchyrollEpisodeLink(url, episodeId) ? 'episode' : matchCrunchyrollLink(url, seriesId, seriesSlug),
  adn: (url, seriesId, seriesSlug) => matchAdnLink(url, seriesId, seriesSlug),
  netflix: (url, seriesId) => matchNetflixLink(url, seriesId),
  disney: (url, seriesId) => matchDisneyLink(url, seriesId),
  // Prime Video : tout lien vers la plateforme ; condition de titre ou lien vers la page appliqués par l'appelant (resolver.ts › linkOf)
  prime: (url) => matchPrimeLink(url),
};

/**
 * Lien d'une fiche AniList vers la série de la plateforme de l'épisode, ou vers l'épisode lui-même
 * (`episodeId` : page de lecture uniquement).
 */
export function matchPlatformLink(
  url: string,
  platform: StreamingPlatform,
  seriesId: string | null,
  seriesSlug: string | null,
  episodeId: string | null = null,
): LinkKind {
  return LINK_MATCHERS[platform](url, seriesId, seriesSlug, episodeId);
}

/**
 * Série Netflix d'un lien AniList : /title/{id}, éventuellement précédé du pays (/be-fr/title/{id}) ; null pour un autre
 * site ou une autre page (filtre « anime » de l'import de l'historique Netflix, liens des fiches)
 */
export function netflixShowIdInLink(url: string | URL): string | null {
  let parsed: URL;
  try {
    parsed = typeof url === 'string' ? new URL(url) : url;
  } catch {
    return null;
  }
  if (!PLATFORMS.netflix.matchesHost(parsed.hostname)) return null;
  return /^\/(?:[a-z]{2}(?:-[a-z]{2})?\/)?title\/(\d+)\/?$/i.exec(parsed.pathname)?.[1] ?? null;
}

/**
 * Identifiant de série explicite d'un lien de la plateforme : /series/{id} (Crunchyroll), /video/{id}-{slug} (ADN),
 * /title/{id} (Netflix). null pour un autre site, une page de lecture ou l'ancien format Crunchyroll par slug.
 */
function seriesIdInLink(url: string, platform: StreamingPlatform): string | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  const segments = parsed.pathname.toLowerCase().split('/').filter(Boolean);
  switch (platform) {
    case 'crunchyroll': {
      if (!PLATFORMS.crunchyroll.matchesHost(parsed.hostname)) return null;
      const index = segments.indexOf('series');
      return index === -1 ? null : (segments[index + 1] ?? null);
    }
    case 'adn': {
      if (!PLATFORMS.adn.matchesHost(parsed.hostname)) return null;
      const index = segments.indexOf('video');
      return index === -1 ? null : (/^(\d+)-/.exec(segments[index + 1] ?? '')?.[1] ?? null);
    }
    case 'netflix':
      return netflixShowIdInLink(parsed);
    // Aucun identifiant de série côté lecture : une autre série Disney+ (ou Prime Video) n'est pas reconnaissable à son lien
    case 'disney':
    case 'prime':
      return null;
  }
}

/**
 * Lien vers une AUTRE série de la même plateforme, désignée par son identifiant (Naruto → /series/{id de Naruto}
 * sur la page Naruto Shippuden). Un slug seul (ancien format Crunchyroll) ne suffit pas : les slugs ont pu être
 * renommés ou fusionnés, et exclure à tort une saison décalerait toutes les suivantes.
 */
export function linksToOtherSeries(url: string, platform: StreamingPlatform, seriesId: string | null): boolean {
  if (!seriesId) return false;
  const linkedId = seriesIdInLink(url, platform);
  return linkedId !== null && linkedId !== seriesId.toLowerCase();
}

/**
 * Même série sur l'ancien site Crunchyroll : même slug, ou sa page de version doublée
 * (« attack-on-titan-dubs », fréquente dans les liens AniList à côté de la page principale).
 */
function isSameCrunchyrollSlug(linkedSlug: string, slug: string): boolean {
  return linkedSlug === slug || linkedSlug === `${slug}-dubs` || linkedSlug === `${slug}-dub`;
}

/**
 * Slug de série d'un ancien lien sans identifiant : crunchyroll.com/{slug} ou /{langue}/{slug} (page de série de
 * l'ancien site uniquement, pas /{slug}/episode-…, /series/…, /watch/…), animationdigitalnetwork.fr/video/{slug}.
 * null pour un autre site, un lien avec identifiant ou une page d'épisode.
 */
export function legacySeriesSlugInLink(url: string, platform: StreamingPlatform): string | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  const segments = parsed.pathname.toLowerCase().split('/').filter(Boolean);
  switch (platform) {
    case 'crunchyroll': {
      if (!PLATFORMS.crunchyroll.matchesHost(parsed.hostname)) return null;
      const isSeriesPage = segments.length === 1 || (segments.length === 2 && /^[a-z]{2}(?:-[a-z]{2})?$/.test(segments[0] ?? ''));
      const linkedSlug = segments.at(-1);
      return isSeriesPage && linkedSlug !== undefined && !['series', 'watch'].includes(linkedSlug) ? linkedSlug : null;
    }
    case 'adn': {
      if (!PLATFORMS.adn.matchesHost(parsed.hostname)) return null;
      const index = segments.indexOf('video');
      const linkedSlug = index === -1 ? undefined : segments[index + 1];
      // Avec identifiant (/video/{id}-{slug}) : signal fort, traité par linksToOtherSeries
      return linkedSlug !== undefined && !/^\d+-/.test(linkedSlug) ? linkedSlug : null;
    }
    case 'netflix':
    case 'disney':
    case 'prime':
      return null;
  }
}

/**
 * Ancien lien sans identifiant vers une AUTRE série de la plateforme : crunchyroll.com/{slug} (ou /{langue}/{slug}),
 * animationdigitalnetwork.fr/video/{slug}, slug différent de celui de la série. Signal faible (slug renommé ou
 * ancienne page par saison possible) : la fiche est écartée, mais la confiance du résultat est plafonnée
 * (voir resolveTarget).
 */
export function linksToOtherSeriesBySlug(url: string, platform: StreamingPlatform, seriesSlug: string | null): boolean {
  if (!seriesSlug) return false;
  const linkedSlug = legacySeriesSlugInLink(url, platform);
  if (linkedSlug === null) return false;
  const slug = seriesSlug.toLowerCase();
  return platform === 'crunchyroll' ? !isSameCrunchyrollSlug(linkedSlug, slug) : linkedSlug !== slug;
}

/**
 * Clé de cache d'une saison : "crunchyroll:GRMG8ZQZR:s24", "disney:title:undead unluck:s1". Arc Disney+ (saison 99,
 * plusieurs par série) : clé par titre de l'arc, "disney:title:undead unluck winter arc:s99". Plateforme sans identifiant de
 * série (clé par titre : Disney+, Prime Video) dont la saison donne son année : année dans la clé
 * ("prime:title:berserk:y2016:s1"), deux remakes au même titre ne partagent pas leur correspondance ; sans année : inchangée.
 */
export function mappingKey(
  episode: Pick<EpisodeInfo, 'platform' | 'seriesId' | 'animeTitle' | 'seasonNumber'> & { seasonTitle?: string | null; signals?: PlatformSignals | undefined },
): string {
  const arcTitle = episode.platform === 'disney' && episode.seasonNumber === DISNEY_ARC_SEASON ? episode.seasonTitle : null;
  const series = episode.seriesId ?? `title:${titleKey(arcTitle ?? episode.animeTitle)}`;
  const year = episode.seriesId === null && episode.signals?.seasonYear !== undefined ? `:y${episode.signals.seasonYear}` : '';
  return `${episode.platform}:${series}${year}:s${episode.seasonNumber ?? 0}`;
}

// ─── Plateformes généralistes ─────────────────────────────────────────────

/**
 * Verdict du filtre « anime » d'une plateforme généraliste : `open` (plateforme spécialisée, rien à filtrer), `linked`
 * (fiche liée à la série), `title` (fiches au titre de la série seulement : jamais fiable), `none` (série ignorée).
 */
export type PlatformLinkVerdict = 'open' | 'linked' | 'title' | 'none';

// ─── Saisons de la plateforme ↔ fiches AniList de la franchise ────────────

/**
 * Saisons de la série sur la plateforme (épisodes par saison, Netflix) rapprochées des fiches AniList de la franchise,
 * quand AniList lie certaines saisons à un AUTRE titre de la plateforme (Ranma1/2 : saisons 1 et 2 liées à
 * /title/81301833, saison 3 à /title/81171925, la série affichée) : ces fiches sont marquées `other` et la saison 3
 * resterait seule (« Fiche unique », épisodes de la saison 1 envoyés sur la saison 3).
 * Franchise : fiches séries (TV, TV court, ONA, hors spéciaux) reliées par suite / préquelle aux fiches liées
 * directement (`id`), dans l'ordre de diffusion, regroupées par saison (parties « Part 2 », voir groupSeasons).
 * Alignement retenu si les saisons 1..S de la plateforme correspondent à S groupes consécutifs, à ±2 épisodes près
 * (dernière saison : en cours de diffusion, moins d'épisodes ou total AniList inconnu), qui contiennent toutes les fiches
 * liées directement, et qu'un seul départ convient. Retourne les fiches des saisons alignées, null sinon (rien ne change :
 * une suite publiée à part, Naruto pour Naruto Shippuden, ne s'aligne pas sur les épisodes de la plateforme).
 */
export function alignPlatformSeasons(
  platformSeasons: readonly number[],
  candidates: readonly MediaCandidate[],
  neighbors: ReadonlyMap<number, readonly number[]>,
): number[] | null {
  const count = platformSeasons.length;
  const byId = new Map(candidates.filter((c) => c.format !== null && SERIES_FORMATS.has(c.format) && !isSpecialTitled(c)).map((c) => [c.id, c]));
  const directIds = new Set([...byId.values()].filter((c) => c.link === 'id').map((c) => c.id));
  if (count === 0 || directIds.size === 0) return null;

  const chain = new Map<number, MediaCandidate>();
  const queue = [...directIds];
  for (let id = queue.shift(); id !== undefined; id = queue.shift()) {
    const candidate = byId.get(id);
    if (!candidate || chain.has(id)) continue;
    chain.set(id, candidate);
    queue.push(...(neighbors.get(id) ?? []));
  }
  const groups = groupSeasons([...chain.values()].sort(byStartDate));
  const fitsFrom = (start: number): boolean =>
    platformSeasons.every((episodes, i) => {
      const group = groups[start + i];
      const anilist = group ? totalEpisodes(group) : null;
      if (!group) return false;
      if (i === count - 1) return anilist === null || episodes <= anilist + SEASON_COUNT_TOLERANCE;
      return anilist !== null && Math.abs(anilist - episodes) <= SEASON_COUNT_TOLERANCE;
    });
  const coversLinked = (start: number): boolean => groups.every((group, index) => (index >= start && index < start + count) || !group.some((c) => directIds.has(c.id)));
  const starts = Array.from({ length: Math.max(0, groups.length - count + 1) }, (_, start) => start).filter((start) => fitsFrom(start) && coversLinked(start));
  const [start] = starts;
  if (starts.length !== 1 || start === undefined) return null;
  return groups.slice(start, start + count).flatMap((group) => group.map((c) => c.id));
}

/**
 * Plateforme généraliste : fiche retenue seule saison de la série (« Fiche unique ») alors qu'elle est la suite d'une
 * autre fiche série et que rien ne montre qu'elle couvre toutes les saisons de la plateforme. Le choix devient à
 * vérifier : une saison 1 pourrait sinon être envoyée sur la saison 3 (voir alignPlatformSeasons).
 * - Nombre d'épisodes connu : doute s'il est inférieur au total des saisons de la plateforme (ou total inconnu) ; une
 *   fiche qui les couvre toutes (Naruto Shippuden, 500 épisodes) reste certaine.
 * - Fiche en cours de diffusion (épisodes inconnus) : doute seulement si une autre fiche série de la recherche est
 *   sortie avant elle (saison précédente possible : Ranma1/2 2024 et sa 2e saison avant la 3e). One Piece (1999), dont
 *   la « préquelle » MONSTERS (ONA, 2024) est sortie après, reste certaine.
 */
export function singleEntryDoubt(
  episode: Pick<EpisodeInfo, 'platform' | 'animeTitle' | 'platformSeasons'>,
  candidates: readonly MediaCandidate[],
  mediaId: number,
): boolean {
  if (!PLATFORMS[episode.platform].linkRequired) return false;
  const pool = seasonPool(candidates, episode.animeTitle);
  const [only] = pool;
  if (pool.length !== 1 || only?.id !== mediaId || only.hasPrequel !== true) return false;
  const seasons = episode.platformSeasons;
  if (seasons !== undefined && seasons.length <= 1) return false;
  return !spansPlatformSeasons(only, candidates, seasons);
}

/**
 * La fiche couvre-t-elle toutes les saisons de la plateforme ? Épisodes connus : au moins leur total (±2) ; total
 * inconnu : non. En cours de diffusion (épisodes inconnus) : oui, sauf si une autre fiche série de la recherche est
 * sortie avant elle (saison précédente possible).
 */
function spansPlatformSeasons(only: MediaCandidate, candidates: readonly MediaCandidate[], seasons: readonly number[] | undefined): boolean {
  if (only.episodes === null) {
    const start = only.startDate;
    return start !== null && !candidates.some((c) => c.id !== only.id && c.format !== null && SERIES_FORMATS.has(c.format) && !isSpecialTitled(c) && c.startDate !== null && c.startDate < start);
  }
  if (seasons === undefined) return false;
  return only.episodes + SEASON_COUNT_TOLERANCE >= seasons.reduce((sum, value) => sum + value, 0);
}

/**
 * Page de série d'une plateforme dont la série compte plusieurs saisons (Netflix : arcs de One Piece) rattachée à UNE
 * fiche AniList liée directement à la série, qui couvre toutes ces saisons (voir spansPlatformSeasons) : la fiche est
 * la série entière, certaine quelle que soit la saison affichée (« Saison 40 mais une seule fiche » n'est pas un doute ici).
 */
export function representsWholeShow(
  page: { animeTitle: string; platformSeasons?: readonly number[] | undefined },
  candidates: readonly MediaCandidate[],
  mediaId: number,
): boolean {
  const seasons = page.platformSeasons;
  if (seasons === undefined || seasons.length < 2) return false;
  const pool = seasonPool(candidates, page.animeTitle);
  const [only] = pool;
  return pool.length === 1 && only?.id === mediaId && only.link === 'id' && spansPlatformSeasons(only, candidates, seasons);
}

/** Fiche dont un titre (romaji, anglais, natif ou synonyme) est exactement celui de la série, après normalisation */
export function hasExactTitle(candidate: Pick<MediaCandidate, 'titles'>, animeTitle: string): boolean {
  const wanted = new Set(exactTitleKeys(animeTitle));
  return wanted.size > 0 && candidate.titles.some((title) => exactTitleKeys(title).some((key) => wanted.has(key)));
}

/**
 * Verdict « anime » de Prime Video (script de contenu, genres de la page de détail : voir EpisodeInfo.primeAnime) :
 * - `anime`, `animation-ja` : résolution normale (`open`), comme Crunchyroll / ADN ;
 * - `animation-exact-only` (animation sans piste japonaise : animation occidentale possible) : suivie seulement si une
 *   fiche porte exactement le titre de la série, ou est liée à Prime Video (lien vers la page, ou lien au titre de la
 *   série : voir isTitleBoundLink) ; sinon `none` (ignorée en silence, comme une série Netflix sans fiche liée) ;
 * - verdict absent ou inconnu (ne devrait jamais arriver : `ignored` ne quitte pas le script de contenu) : `none`.
 * Autres plateformes : `open` (rien à filtrer ici).
 */
export function primeAnimeGate(episode: Pick<EpisodeInfo, 'platform' | 'animeTitle' | 'primeAnime'>, candidates: readonly MediaCandidate[]): 'open' | 'none' {
  if (episode.platform !== 'prime') return 'open';
  const verdict: unknown = episode.primeAnime;
  if (!isSentPrimeAnimeVerdict(verdict)) return 'none';
  if (verdict !== 'animation-exact-only') return 'open';
  return candidates.some((c) => isDirectlyLinked(c) || hasExactTitle(c, episode.animeTitle)) ? 'open' : 'none';
}

/**
 * Série soumise à un filtre « anime » (verdict « série ignorée » possible, mémorisé : voir ignored-series.ts) : plateforme
 * généraliste (`linkRequired`), ou Prime Video hors genre anime (`animation-exact-only`, verdict absent).
 */
export function filtersAnime(episode: Pick<EpisodeInfo, 'platform' | 'primeAnime'>): boolean {
  if (PLATFORMS[episode.platform].linkRequired) return true;
  return episode.platform === 'prime' && episode.primeAnime !== 'anime' && episode.primeAnime !== 'animation-ja';
}

export function platformLinkVerdict(episode: Pick<EpisodeInfo, 'platform' | 'animeTitle' | 'primeAnime'>, candidates: readonly MediaCandidate[]): PlatformLinkVerdict {
  if (primeAnimeGate(episode, candidates) === 'none') return 'none';
  if (!PLATFORMS[episode.platform].linkRequired) return 'open';
  if (candidates.some(isLinked)) return 'linked';
  const animeKey = normalizeTitle(episode.animeTitle);
  const isTitleMatch = seasonPool(candidates, episode.animeTitle).length > 0 || candidates.some((c) => c.titles.some((title) => normalizeTitle(title) === animeKey));
  return isTitleMatch ? 'title' : 'none';
}

/**
 * Filtre « anime » d'une plateforme généraliste (PLATFORMS[…].linkRequired : Netflix, Disney+ ; Prime Video selon son
 * verdict de genre, voir primeAnimeGate), appliqué au résultat de resolveTarget :
 * 1. une fiche liée à la série (lien plateforme ou suite/préquelle d'une fiche liée) → résultat inchangé, mais
 *    confiance basse si la fiche choisie n'est pas elle-même liée (série TV homonyme d'un film lié) ;
 * 2. sinon, des fiches au titre de la série → correspondance jamais fiable (carte « à vérifier »), échec inchangé ;
 * 3. sinon → série ignorée (probablement pas un anime : ni carte de vérification ni toast).
 */
export function gateByPlatformLink(
  episode: Pick<EpisodeInfo, 'platform' | 'animeTitle' | 'platformSeasons' | 'primeAnime'>,
  candidates: readonly MediaCandidate[],
  result: ResolveResult,
): ResolveResult {
  const verdict = platformLinkVerdict(episode, candidates);
  if (verdict === 'open') return result;
  if (verdict === 'linked') {
    if (!result.ok || result.target.confidence !== 'high') return result;
    const { mediaId } = result.target;
    const platform = PLATFORMS[episode.platform].label;
    if (singleEntryDoubt(episode, candidates, mediaId)) return { ok: true, target: { ...result.target, confidence: 'low', reason: t('match.platformSeasonsSingle', { platform }) } };
    // Fiche prouvée par les signaux dans la franchise liée (« II Part 2 », liée seulement à Crunchyroll) : comme liée.
    // Prouvée hors de la franchise liée (homonyme sans lien ni relation avec la fiche liée) : titre seul, à vérifier
    const provenInLinkedFranchise = result.target.bySignals === true && inLinkedFranchise(candidates, episode.animeTitle, mediaId);
    if (provenInLinkedFranchise || candidates.some((c) => c.id === mediaId && isLinked(c))) return result;
    return { ok: true, target: { ...result.target, confidence: 'low', reason: t('match.platformUnlinkedEntry', { platform: PLATFORMS[episode.platform].label }) } };
  }
  if (verdict === 'title') {
    return result.ok ? { ok: true, target: { ...result.target, confidence: 'low', reason: t('match.platformTitleOnly', { platform: PLATFORMS[episode.platform].label }) } } : result;
  }
  return ignoredResult(episode);
}

/** Verdict « série ignorée » (filtre ci-dessus, ou verdict mémorisé : voir ignored-series.ts) */
export function ignoredResult(episode: Pick<EpisodeInfo, 'animeTitle'>): ResolveResult {
  return { ok: false, reason: t('match.noEntry', { title: episode.animeTitle }), ignored: true };
}
