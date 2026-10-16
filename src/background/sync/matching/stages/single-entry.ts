import { t } from '../../../../i18n';
import { fits } from '../model';
import { failure, level, noEntry, type Stage } from './context';

/** Aucune saison de la série (ni fiche dédiée, ni groupe prouvé avant) : introuvable */
export const noSeason: Stage = (ctx) => (ctx.pool.length === 0 ? noEntry(ctx) : null);

/** Fiche unique (ex : One Piece, une seule entrée AniList) : décide toujours quand la série n'a qu'une saison */
export const singleEntry: Stage = (ctx) => {
  const [only] = ctx.pool;
  if (ctx.pool.length !== 1 || !only) return null;
  const { displayed, relative, isAbsolute, seasonNumber } = ctx;
  if (isAbsolute && displayed !== null && fits(only, displayed)) {
    // Numérotation absolue qui tient dans la seule fiche au titre de la série (One Piece E1180) : fiable
    // même sans lien plateforme, quelle que soit la saison
    return { candidate: only, base: displayed, progress: displayed, numbering: 'displayed', confidence: 'high', reason: t('match.singleAbsolute'), trustedReason: t('match.titleOnlyAbsolute') };
  }
  if (fits(only, relative)) {
    // Saison > 1 mais une seule fiche : la suite n'est peut-être pas liée sur AniList
    const isLaterSeason = !isAbsolute && (seasonNumber ?? 1) > 1;
    const reason = isLaterSeason ? t('match.singleLaterSeason', { season: seasonNumber ?? '?' }) : t('match.single');
    return { candidate: only, base: relative, progress: relative, numbering: 'season', confidence: level(ctx, !isLaterSeason), reason };
  }
  return failure(t('match.beyondAniList', { episode: displayed ?? relative, total: only.episodes ?? '?' }));
};
