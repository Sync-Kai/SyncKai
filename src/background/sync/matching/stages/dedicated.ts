import { t } from '../../../../i18n';
import { normalizeTitle } from '../../../../shared/title';
import { fits, isLinked, SERIES_FORMATS, type EpisodeNumbers, type MediaCandidate } from '../model';
import { containsWords, titleWords } from '../season-titles';
import type { Stage } from './context';

/** Fiche dédiée à l'épisode ou à sa saison, hors des saisons de la série (spécial, film, fiche non liée…) */
export interface DedicatedEntry {
  candidate: MediaCandidate;
  progress: number;
  confident: boolean;
  /** Fiche désignée par le titre « série + saison » exact : indépendante du rang des saisons (voir finalize) */
  exactTitle: boolean;
  reason: string;
}

/**
 * Fiche hors des saisons de la série désignant précisément l'épisode (numérotation relative uniquement) :
 * a) fiche liée à la page de lecture de l'épisode (/watch/{episodeId}) ;
 * b) fiche dont le titre est celui de la saison ("HEROINES" → « ONE PIECE HEROINES », spécial rangé
 *    en saison 30 de One Piece sur Crunchyroll) : titre exact, « série + saison », ou titre commençant par
 *    la série et contenant le titre de saison ; une seule fiche doit correspondre ;
 * c) aucune saison série : fiche unique au titre exact de la série (ex : spécial publié comme série à part).
 */
export function dedicatedEntry(
  episode: EpisodeNumbers,
  candidates: readonly MediaCandidate[],
  pool: readonly MediaCandidate[],
  relative: number,
): DedicatedEntry | null {
  const poolIds = new Set(pool.map((c) => c.id));
  const outside = candidates.filter((c) => c.format !== 'MUSIC' && !poolIds.has(c.id));
  if (outside.length === 0) return null;

  // a) Lien vers l'épisode : une fiche à épisode unique (spécial, film) absorbe l'épisode quel que soit son numéro
  const byEpisode = outside.filter((c) => c.link === 'episode');
  const [onlyByEpisode] = byEpisode;
  if (byEpisode.length === 1 && onlyByEpisode) {
    const progress = fits(onlyByEpisode, relative) ? relative : onlyByEpisode.episodes === 1 ? 1 : null;
    if (progress !== null) return { candidate: onlyByEpisode, progress, confident: true, exactTitle: false, reason: t('match.episodeLink') };
  }

  // a') Épisode sans saison (film Netflix) et aucune saison série liée : fiche film / spécial liée à la série
  //     elle-même. Elle prime sur une série TV homonyme non liée (« Bubble » TV contre le film « Bubble »).
  const hasLinkedSeries = candidates.some((c) => isLinked(c) && c.format !== null && SERIES_FORMATS.has(c.format));
  if (episode.seasonNumber === null && !hasLinkedSeries) {
    const direct = outside.filter((c) => (c.link === 'id' || c.link === 'slug' || c.link === 'platform') && c.format !== null && !SERIES_FORMATS.has(c.format));
    const [onlyDirect] = direct;
    if (direct.length === 1 && onlyDirect && fits(onlyDirect, relative)) {
      return { candidate: onlyDirect, progress: relative, confident: true, exactTitle: false, reason: t('match.linkedEntry') };
    }
  }

  // Titres comparés sans l'article « the » (« Last Attack » ↔ « THE LAST ATTACK », voir titleWords)
  const animeKey = titleWords(episode.animeTitle);
  const seasonKey = episode.seasonTitle ? titleWords(episode.seasonTitle) : '';
  const keysOf = (c: MediaCandidate): string[] => c.titles.map(titleWords);
  // Une saison de la série porte déjà ce titre (« Attack on Titan Season 2 ») : l'étape seasonByTitle s'en charge,
  // un OVA « … Season 2 OVA » ne doit pas lui voler l'épisode
  const isPoolSeason = pool.some((c) => keysOf(c).some((k) => containsWords(k, seasonKey)));
  if (seasonKey.length >= 3 && seasonKey !== animeKey && !isPoolSeason) {
    const compound = seasonKey.startsWith(`${animeKey} `) ? seasonKey : `${animeKey} ${seasonKey}`;
    const exact = outside.filter((c) => keysOf(c).some((k) => k === compound || k === seasonKey));
    const loose = outside.filter((c) => keysOf(c).some((k) => k.startsWith(`${animeKey} `) && containsWords(k, seasonKey)));
    const matches = exact.length > 0 ? exact : loose;
    const [only] = matches;
    if (matches.length === 1 && only && fits(only, relative)) {
      // Titre « série + saison » ou fiche liée : fiable ; titre de saison seul ou simplement inclus : à vérifier
      const exactTitle = keysOf(only).includes(compound);
      const confident = isLinked(only) || exactTitle;
      return { candidate: only, progress: relative, confident, exactTitle, reason: t('match.dedicatedSeason', { title: episode.seasonTitle ?? '' }) };
    }
  }

  if (pool.length === 0) {
    const seriesKey = normalizeTitle(episode.animeTitle);
    const sameTitle = outside.filter((c) => c.titles.some((title) => normalizeTitle(title) === seriesKey));
    const [only] = sameTitle;
    if (sameTitle.length === 1 && only && fits(only, relative)) {
      return { candidate: only, progress: relative, confident: isLinked(only), exactTitle: false, reason: t('match.dedicatedSeries') };
    }
  }
  return null;
}

/**
 * Fiche dédiée à l'épisode ou à sa saison (spécial rangé dans une saison de la série) : prime sur la fiche unique, qui
 * avalerait sinon l'épisode 1 de « saison 30 » comme épisode 1 de One Piece. Jamais en numérotation absolue (One Piece
 * E1180 reste sur la fiche principale). Groupe prouvé par les signaux de la saison : prime sur le rang des saisons, pas
 * sur une fiche dédiée fiable.
 */
export const dedicated: Stage = (ctx) => {
  if (ctx.isAbsolute) return null;
  const own = dedicatedEntry(ctx.episode, ctx.candidates, ctx.pool, ctx.relative);
  if (!own || (!own.confident && ctx.proven)) return null;
  return { candidate: own.candidate, base: ctx.relative, progress: own.progress, numbering: 'season', confidence: own.confident ? 'high' : 'low', reason: own.reason, byExactTitle: own.exactTitle };
};
