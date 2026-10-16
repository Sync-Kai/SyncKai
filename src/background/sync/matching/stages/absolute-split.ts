import { t } from '../../../../i18n';
import { fits, walkSeasons } from '../model';
import { titleSeasonOf } from '../season-titles';
import { level, type Stage } from './context';

/** Plusieurs saisons, numérotation absolue : répartition cumulative du numéro affiché depuis la 1re saison */
export const absoluteSplit: Stage = (ctx) => {
  const { pool, displayed, seasonNumber } = ctx;
  if (!ctx.isAbsolute || displayed === null) return null;
  const hit = walkSeasons(pool, 0, displayed);
  const entry = hit ? pool[hit.index] : undefined;
  if (!hit || !entry || !fits(entry, hit.progress)) return null;
  // Sans lien : sûr si la fiche atteinte porte le numéro de la saison (« Kaiju No. 8 Season 2 » pour « Season 2 ») :
  // la numérotation absolue et le titre concordent
  const titled = titleSeasonOf(entry.titles, ctx.animeKey);
  const agrees = seasonNumber !== null && titled === seasonNumber;
  // Fiche titrée d'une saison numérotée PLUS LOINTAINE que celle de la plateforme (« … Saison 4 » pour la saison 3) : cumul
  // incomplet (1re saison absente des candidats), il déborde toujours vers une saison suivante ; jamais sûr. Numéro de titre
  // plus petit (Kaiju No. 8 « Season 2 » rangée en S3) : la plateforme compte un spécial comme saison, cumul juste. Fiche au
  // titre de la série (1) : peut couvrir toutes les saisons de la plateforme (One Piece E1180, saison 24), non concernée
  const disagrees = seasonNumber !== null && titled !== null && titled >= 2 && titled > seasonNumber;
  return {
    candidate: entry,
    base: displayed,
    progress: hit.progress,
    numbering: 'displayed',
    confidence: disagrees ? 'low' : agrees ? 'high' : level(ctx, true),
    reason: t('match.absoluteSplit', { count: pool.length }),
    trustedReason: t('match.titleOnlySeason', { season: seasonNumber ?? '?' }),
  };
};
