import { t } from '../../../../i18n';
import { fits, walkSeasons } from '../model';
import { level, type Stage } from './context';

/**
 * Numérotation relative : saison identifiée par son titre, prioritaire sur son numéro (la plateforme peut compter un
 * spécial comme saison : Dr. STONE « NEW WORLD » est la saison 4 de Crunchyroll, le 3e groupe de fiches AniList). Titre
 * qui désigne un groupe sans y placer l'épisode : les étapes suivantes en tiennent compte (voir outsideTitle).
 */
export const seasonByTitle: Stage = (ctx) => {
  const { designated } = ctx;
  if (!designated) return null;
  const hit = walkSeasons(designated.from, 0, ctx.relative);
  const entry = hit ? designated.from[hit.index] : undefined;
  if (!hit || !entry || !fits(entry, hit.progress)) return null;
  return { candidate: entry, base: ctx.relative, progress: hit.progress, numbering: 'season', confidence: level(ctx, true), reason: t('match.seasonByTitle', { title: ctx.episode.seasonTitle ?? '' }) };
};
