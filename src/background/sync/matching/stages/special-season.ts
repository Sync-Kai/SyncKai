import { t } from '../../../../i18n';
import { normalizeTitle } from '../../../../shared/title';
import { fits, SPECIAL_FORMATS, type EpisodeNumbers, type MediaCandidate } from '../model';
import { isSpecialSeason, withoutFirstSeason } from '../season-titles';
import { failure, type Stage } from './context';
import { dedicatedEntry } from './dedicated';

/**
 * Fiche d'une saison spéciale (OVA, spéciaux, film) : fiche unique au titre exact parmi les formats spéciaux.
 * Titres acceptés : celui de la saison, « série + saison » (sans « Season 1 »), ou celui de la série pour une
 * saison sans titre propre (JUJUTSU KAISEN 0 · S0 → film « Jujutsu Kaisen 0 »). null si aucune ou plusieurs.
 */
function specialEntry(episode: EpisodeNumbers, candidates: readonly MediaCandidate[], relative: number): MediaCandidate | null {
  const animeKey = normalizeTitle(episode.animeTitle);
  const seasonKey = episode.seasonTitle ? normalizeTitle(episode.seasonTitle) : '';
  const wanted = new Set<string>();
  if (!seasonKey || seasonKey === animeKey) {
    wanted.add(animeKey);
  } else {
    const compound = seasonKey.startsWith(`${animeKey} `) ? seasonKey : `${animeKey} ${seasonKey}`;
    for (const key of [seasonKey, compound]) {
      wanted.add(key);
      wanted.add(withoutFirstSeason(key));
    }
    // Titre réduit à celui de la série une fois « Season 1 » retiré : ce n'est plus le titre d'un spécial
    wanted.delete(animeKey);
  }
  const matches = candidates.filter((c) => c.format !== null && SPECIAL_FORMATS.has(c.format) && c.titles.some((title) => wanted.has(normalizeTitle(title))));
  const [only] = matches;
  return matches.length === 1 && only && fits(only, relative) ? only : null;
}

/**
 * Saison spéciale (OVA, extras, spéciaux, film) : jamais la N-ième saison de la série. Fiche liée à l'épisode ou dédiée à
 * la saison, sinon fiche spéciale unique au titre exact, sinon à choisir. Décide toujours pour une saison spéciale.
 */
export const specialSeason: Stage = (ctx) => {
  if (!isSpecialSeason(ctx.episode)) return null;
  const { relative } = ctx;
  const own = dedicatedEntry(ctx.episode, ctx.candidates, ctx.pool, relative);
  if (own?.confident) {
    return { candidate: own.candidate, base: relative, progress: own.progress, numbering: 'season', confidence: 'high', reason: own.reason, trustedReason: own.reason, byExactTitle: own.exactTitle };
  }
  const special = specialEntry(ctx.episode, ctx.candidates, relative);
  if (special) return { candidate: special, base: relative, progress: relative, numbering: 'season', confidence: 'high', reason: t('match.specialTitle'), trustedReason: t('match.specialTitle') };
  if (own) return { candidate: own.candidate, base: relative, progress: own.progress, numbering: 'season', confidence: 'low', reason: own.reason };
  return failure(t('match.specialSeason'));
};
