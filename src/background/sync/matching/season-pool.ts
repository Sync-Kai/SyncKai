import { normalizeTitle } from '../../../shared/title';
import { byStartDate, isLinked, isOtherSeries, SERIES_FORMATS, type EpisodeNumbers, type MediaCandidate } from './model';
import { groupSeasons } from './season-groups';
import { isSpecialTitled, titleSeasonOf } from './season-titles';

/**
 * Saisons de la série, dans l'ordre de diffusion : fiches séries liées à la plateforme,
 * ou à défaut fiches séries au titre identique. Partagé par la synchro et la fiche de la page.
 */
export function seasonPool(candidates: readonly MediaCandidate[], animeTitle: string): MediaCandidate[] {
  // Fiche liée à une autre série de la plateforme (préquelle Naruto de Naruto Shippuden) : jamais une saison
  const formats = candidates.filter((c) => c.format !== null && SERIES_FORMATS.has(c.format) && !isOtherSeries(c));
  const regular = formats.filter((c) => !isSpecialTitled(c));
  const seasons = (regular.length > 0 ? regular : formats).sort(byStartDate);
  const linked = seasons.filter(isLinked);
  if (linked.length > 0) return linked;
  // Sans lien vers la plateforme, repli sur un titre identique, parties (« Moriarty the Patriot Part 2 ») et
  // saisons numérotées (« Kaiju No. 8 Season 2 ») comprises
  const animeKey = normalizeTitle(animeTitle);
  return seasons.filter((c) => titleSeasonOf(c.titles, animeKey) !== null);
}

/**
 * Groupe de saison désigné par le titre de saison de la plateforme (étape seasonByTitle) : titre exact de fiches d'un
 * même groupe, ou contenu dans le titre d'une seule fiche. `from` : fiches où placer l'épisode, depuis la fiche au titre
 * exact (« Dr. STONE NEW WORLD » E22 = « NEW WORLD Part 2 » E11) ou depuis la première partie du groupe pour un titre
 * seulement contenu (« L'Attaque des Titans Saison 3 » dans le synonyme « … Saison 3 Partie 2 »). null : titre absent, celui
 * de la série, ambigu ou retrouvé dans aucune saison.
 */
export function titleSeasonGroup(
  episode: Pick<EpisodeNumbers, 'animeTitle' | 'seasonTitle'>,
  pool: readonly MediaCandidate[],
  groups: readonly MediaCandidate[][] = groupSeasons(pool),
): { group: MediaCandidate[]; from: MediaCandidate[] } | null {
  const seasonKey = episode.seasonTitle ? normalizeTitle(episode.seasonTitle) : '';
  if (!seasonKey || seasonKey === normalizeTitle(episode.animeTitle)) return null;
  const exact = pool.filter((c) => c.titles.some((t) => normalizeTitle(t) === seasonKey));
  const matches = exact.length > 0 ? exact : pool.filter((c) => c.titles.some((t) => normalizeTitle(t).includes(seasonKey)));
  const [first] = matches;
  const group = first === undefined ? undefined : groups.find((g) => g.includes(first));
  if (!group || !(exact.length > 0 ? exact.every((c) => group.includes(c)) : matches.length === 1)) return null;
  const [firstExact] = exact;
  return { group, from: firstExact !== undefined ? group.slice(group.indexOf(firstExact)) : group };
}
