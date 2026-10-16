import { t } from '../../../i18n';
import type { EpisodeInfo } from '../../../shared/episode.types';
import { PLATFORMS } from '../../../platforms/registry';
import { normalizeTitle } from '../../../shared/title';
import { groupSeasons } from './season-groups';
import { exactTitleKeys } from './concordance';
import { byStartDate, SEASON_COUNT_TOLERANCE, SERIES_FORMATS, totalEpisodes, type MediaCandidate, type ResolveResult } from './model';
import { seasonPool } from './season-pool';
import { isSpecialTitled } from './season-titles';

// Libellé d'une saison, saisons de la plateforme rapprochées des fiches, fiche unique et série entière (doutes du juge).
// Règles de correspondance : rules-engine.ts (étapes : stages/) ; modèle : model.ts ; correspondances en cache :
// mapping.ts ; titres de saison : season-titles.ts ; signaux : signal-groups.ts et concordance.ts ; jugement du
// résultat (doutes nommés, filtre « anime » appliqué) : judge.ts ; liens AniList et filtre « anime » propres à chaque
// plateforme : policies/ (registry.ts).

// ─── Helpers ──────────────────────────────────────────────────────────────

export function toSortableDate(date: { year: number | null; month: number | null; day: number | null } | null): number | null {
  if (!date?.year) return null;
  // Mois/jour inconnus : placés en fin de période pour ne pas passer devant une date précise
  return date.year * 10_000 + (date.month ?? 12) * 100 + (date.day ?? 31);
}

/** Libellé lisible d'une saison : "One Piece · S24 (Elbaph)" */
export function seasonLabel(episode: Pick<EpisodeInfo, 'animeTitle' | 'seasonNumber' | 'seasonTitle'>): string {
  const season = episode.seasonNumber !== null ? ` · S${episode.seasonNumber}` : '';
  const hasDistinctTitle = episode.seasonTitle && normalizeTitle(episode.seasonTitle) !== normalizeTitle(episode.animeTitle);
  return `${episode.animeTitle}${season}${hasDistinctTitle ? ` (${episode.seasonTitle})` : ''}`;
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

/** Verdict « série ignorée » (filtre « anime » : voir judge.ts › syncResult ; ou verdict mémorisé : voir ignored-series.ts) */
export function ignoredResult(episode: Pick<EpisodeInfo, 'animeTitle'>): ResolveResult {
  return { ok: false, reason: t('match.noEntry', { title: episode.animeTitle }), ignored: true };
}
