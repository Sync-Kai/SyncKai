import { t } from '../../../../i18n';
import { normalizeTitle } from '../../../../shared/title';
import { fits, walkSeasons } from '../model';
import { seasonNumberFromTitle } from '../season-titles';
import { failure, levelByNumber, type RulesContext, type Stage } from './context';

/**
 * Placement par le seul rang de la saison (voir SyncTarget.byRank) : numéro brut de la plateforme ≥ 2, saison nommée
 * sans numéro dans son titre, et aucun signal pour confirmer.
 */
function byRankOnly({ episode, animeKey, concordance }: RulesContext): boolean {
  const seasonKey = episode.seasonTitle ? normalizeTitle(episode.seasonTitle) : '';
  const isNamedSeason = seasonKey !== '' && seasonKey !== animeKey;
  return concordance === null && isNamedSeason && seasonNumberFromTitle(episode.seasonTitle) === null && (episode.seasonNumber ?? 0) >= 2;
}

/**
 * Saison identifiée par son numéro. AniList découpe souvent une saison en plusieurs fiches (« Part 2 », « Cour 2 ») que
 * la plateforme réunit : la saison N est le N-ième groupe de fiches (voir groupSeasons), avec report sur la partie
 * suivante quand le numéro dépasse la première. Numéro du titre de saison prioritaire (« Season 2 » rangée en S3 par
 * Crunchyroll) ; sans numéro, une série dont les fiches forment une seule saison est la saison 1.
 */
export const seasonByNumber: Stage = (ctx) => {
  const { pool, groups, season, relative } = ctx;
  if (season === null || season < 1) return null;
  const isGrouped = groups.length < pool.length;
  const group = isGrouped ? groups[season - 1] : undefined;

  if (group) {
    const [head] = group;
    const start = head ? pool.indexOf(head) : -1;
    const hit = walkSeasons(pool, start, relative);
    const entry = hit ? pool[hit.index] : undefined;
    if (!hit || !entry || !fits(entry, hit.progress)) return failure(t('match.undetermined'));
    // Fiable seulement si l'épisode reste dans le groupe de la saison N (sinon il déborde sur la saison suivante)
    const part = group.indexOf(entry);
    // Total affiché dans la raison : épisodes connus seulement (une partie en cours compte 0, voir audit 1-D9)
    const groupTotal = group.reduce((sum, c) => sum + (c.episodes ?? 0), 0);
    const reason =
      part === -1
        ? t('match.beyondSeason', { episode: relative, season, total: groupTotal })
        : group.length > 1
          ? t('match.seasonGroup', { season, part: part + 1, parts: group.length })
          : t('match.seasonExact', { season, index: start + 1 });
    return { candidate: entry, base: relative, progress: hit.progress, numbering: 'season', confidence: levelByNumber(ctx, entry, part !== -1), reason, byRank: byRankOnly(ctx) };
  }

  // Aucune partie regroupée (saison N = N-ième fiche), ou saison au-delà des groupes détectés :
  // repli sur l'index des fiches, toujours à vérifier dans ce dernier cas
  const index = season - 1;
  const hit = walkSeasons(pool, index, relative);
  const entry = hit ? pool[hit.index] : undefined;
  if (!hit || !entry || !fits(entry, hit.progress)) return null;
  const isExact = hit.index === index;
  const reason = isExact ? t('match.seasonExact', { season, index: index + 1 }) : t('match.seasonSplit', { season });
  return { candidate: entry, base: relative, progress: hit.progress, numbering: 'season', confidence: levelByNumber(ctx, entry, isExact && !isGrouped), reason, byRank: byRankOnly(ctx) };
};
