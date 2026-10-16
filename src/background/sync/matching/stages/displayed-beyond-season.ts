import { t } from '../../../../i18n';
import { fits, totalEpisodes, walkSeasons } from '../model';
import { titleSeasonOf } from '../season-titles';
import { level, outsideTitle, type Stage } from './context';

/**
 * Numéro affiché au-delà de la saison N alors que la numérotation n'a pas été reconnue comme absolue (position dans la
 * saison inconnue ou faussée : Attack on Titan S4 E87, Kaiju No. 8 « Season 2 » E23) : cumul depuis la 1re saison,
 * retenu seulement s'il tombe dans la saison N.
 */
export const displayedBeyondSeason: Stage = (ctx) => {
  const { pool, groups, displayed, season, seasonNumber } = ctx;
  if (ctx.isAbsolute || displayed === null || season === null || season < 1) return null;
  const group = groups[season - 1];
  if (!group) return null;
  // Total inconnu (fiche en cours) : jamais dépassé
  const groupTotal = totalEpisodes(group) ?? Number.POSITIVE_INFINITY;
  const hit = displayed > groupTotal ? walkSeasons(pool, 0, displayed) : null;
  const entry = hit ? pool[hit.index] : undefined;
  if (!hit || !entry || !group.includes(entry) || !fits(entry, hit.progress)) return null;
  const agrees = seasonNumber !== null && titleSeasonOf(entry.titles, ctx.animeKey) === seasonNumber;
  return {
    candidate: entry,
    base: displayed,
    progress: hit.progress,
    numbering: 'displayed',
    confidence: outsideTitle(ctx, entry) ? 'low' : agrees ? 'high' : level(ctx, true),
    reason: t('match.absoluteSplit', { count: pool.length }),
    trustedReason: t('match.titleOnlySeason', { season: seasonNumber ?? '?' }),
  };
};
