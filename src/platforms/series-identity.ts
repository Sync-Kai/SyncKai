import { DISNEY_ARC_SEASON, type EpisodeInfo } from '../shared/episode.types';
import type { PlatformSignals } from '../shared/match-signals';
import type { PageMediaInfo } from '../shared/page-media.types';
import { titleKey } from '../shared/title';
import type { StreamingPlatform } from './ids';

// Identité d'une série (audit 1-D1 / I7) : seul endroit qui dit quand la lecture d'un épisode et la page de série désignent
// la même série. Clé de série (exclusions, séries ignorées), clé de correspondance d'une saison, préfixe des correspondances
// d'une série et clé d'exclusion avec l'année. Pur, sans API du navigateur : utilisable par les scripts de contenu.

type SeriesRef = Pick<EpisodeInfo, 'platform' | 'seriesId' | 'animeTitle'>;

/**
 * Plateformes désignées par le titre : la page de lecture n'a aucun identifiant de série (Disney+, Prime Video). L'uuid de
 * l'entité Disney+ ou le GTI compact Prime Video d'une page de série sert à reconnaître un lien AniList, jamais de clé.
 */
const isTitleKeyed = (platform: StreamingPlatform): boolean => platform === 'disney' || platform === 'prime';

/** Identifiant de série retenu dans les clés : aucun sur Disney+ et Prime Video (clés par titre, comme en lecture) */
const keyedSeriesId = (series: Pick<SeriesRef, 'platform' | 'seriesId'>): string | null => (isTitleKeyed(series.platform) ? null : series.seriesId);

/**
 * Clé de série plateforme, toutes saisons : "crunchyroll:GRMG8ZQZR", "adn:1311", "crunchyroll:title:one piece",
 * "disney:title:undead unluck". Même clé pour la page de série et la lecture (exclusions, verdict « série ignorée »).
 */
export function seriesKey(series: SeriesRef): string {
  const seriesId = keyedSeriesId(series);
  return seriesId ? `${series.platform}:${seriesId}` : `${series.platform}:title:${titleKey(series.animeTitle)}`;
}

/**
 * Année de début de la série, si connue : celle de la série, sinon celle de sa saison 1 (Prime Video ne donne que l'année de
 * la saison). Jamais l'année d'une autre saison : la saison 2 d'un remake a une autre année que son début.
 */
function seriesStartYear(series: { seasonNumber?: number | null; signals?: PlatformSignals | undefined }): number | undefined {
  return series.signals?.seriesYear ?? (series.seasonNumber === 1 ? series.signals?.seasonYear : undefined);
}

const YEAR_SUFFIX = /^(.+:title:.+):y(\d{4})$/;

/**
 * Clé d'une exclusion (décision 7) : clé de série, plus l'année de début de la série quand elle est connue et que la série
 * est désignée par son titre ("prime:title:berserk:y2016") : deux remakes au même titre ne s'excluent plus l'un l'autre.
 * Série à identifiant (Crunchyroll, Netflix…) : jamais d'année.
 */
export function exclusionKey(series: SeriesRef & { seasonNumber?: number | null; signals?: PlatformSignals | undefined }): string {
  const key = seriesKey(series);
  const year = keyedSeriesId(series) ? undefined : seriesStartYear(series);
  return year !== undefined ? `${key}:y${year}` : key;
}

/** Année d'une clé d'exclusion par titre ("prime:title:berserk:y2016" → 2016), null sans année */
export function exclusionKeyYear(key: string): number | null {
  const match = YEAR_SUFFIX.exec(key);
  return match ? Number(match[2]) : null;
}

const withoutYear = (key: string): string => YEAR_SUFFIX.exec(key)?.[1] ?? key;

/**
 * Vrai si l'exclusion `excluded` couvre l'épisode ou la page de clé `query` (règle prudente, décision 7) : même série, et
 * années égales ou l'une des deux inconnue. Une ancienne exclusion sans année couvre les deux remakes (pas de migration) ;
 * une série à l'année inconnue n'est jamais synchronisée si l'un de ses homonymes est exclu.
 */
export function exclusionKeyCovers(excluded: string, query: string): boolean {
  if (excluded === query) return true;
  const excludedYear = exclusionKeyYear(excluded);
  const queryYear = exclusionKeyYear(query);
  return withoutYear(excluded) === withoutYear(query) && (excludedYear === null || queryYear === null);
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

/**
 * Préfixe des clés de correspondance d'une série, toutes saisons : "crunchyroll:GRMG8ZQZR:". Disney+ et Prime Video : par
 * titre ("disney:title:undead unluck:", "prime:title:tokyo ghoul:"), comme les clés de la lecture (aucun identifiant de
 * série sur la page de lecture), même si la page de série connaît l'uuid de l'entité ou le GTI compact de la saison. Arc
 * Disney+ affiché (saison 99) : par titre de l'arc ("disney:title:undead unluck winter arc:"), comme sa clé en lecture.
 */
export function seriesMappingPrefix(page: Pick<PageMediaInfo, 'platform' | 'seriesId' | 'seriesTitle'> & Partial<Pick<PageMediaInfo, 'seasonNumber' | 'seasonTitle'>>): string {
  const seriesId = keyedSeriesId(page);
  const season = page.platform === 'disney' && page.seasonNumber === DISNEY_ARC_SEASON ? { seasonNumber: DISNEY_ARC_SEASON, seasonTitle: page.seasonTitle ?? null } : { seasonNumber: 0 };
  return mappingKey({ platform: page.platform, seriesId, animeTitle: page.seriesTitle, ...season }).replace(/s\d+$/, '');
}
