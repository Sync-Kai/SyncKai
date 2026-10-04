import type { PageMediaInfo, SeasonSource } from '../shared/page-media.types';
import type { ListStatus, MediaMapping } from '../shared/sync.types';
import { mappingKey } from './sync/matching';

// Règles pures de la fiche de la page (#23) : choix de la saison affichée. Testables sans API.

export interface SeasonChoice {
  mediaId: number;
  source: SeasonSource;
  confidence: 'certain' | 'uncertain';
}

/** Préfixe des clés de correspondance d'une série, toutes saisons : "crunchyroll:GRMG8ZQZR:" */
export function seriesMappingPrefix(page: Pick<PageMediaInfo, 'platform' | 'seriesId' | 'seriesTitle'>): string {
  return mappingKey({ platform: page.platform, seriesId: page.seriesId, animeTitle: page.seriesTitle, seasonNumber: 0 }).replace(/s0$/, '');
}

/**
 * Correspondance mémorisée pour la série (synchro précédente ou choix manuel d'une vérification) :
 * la saison lue sur la page si elle est connue (`exact`), sinon la plus avancée des saisons mémorisées
 * (la dernière regardée, le plus souvent).
 */
export function rememberedSeason(
  mappings: Readonly<Record<string, MediaMapping>>,
  prefix: string,
  seasonNumber: number | null,
): { mediaId: number; exact: boolean } | null {
  if (seasonNumber !== null) {
    const exact = mappings[`${prefix}s${seasonNumber}`];
    if (exact) return { mediaId: exact.mediaId, exact: true };
  }
  let best: { season: number; mediaId: number } | null = null;
  for (const [key, mapping] of Object.entries(mappings)) {
    if (!key.startsWith(prefix)) continue;
    const season = Number.parseInt(key.slice(prefix.length).replace(/^s/, ''), 10);
    if (Number.isInteger(season) && (best === null || season > best.season)) best = { season, mediaId: mapping.mediaId };
  }
  return best ? { mediaId: best.mediaId, exact: false } : null;
}

export interface KnownSeasonInput {
  /** Saisons de la série, dans l'ordre de diffusion */
  seasonIds: readonly number[];
  /** Saison choisie dans le sélecteur de la carte */
  manual: number | null;
  /** Saison déduite de la page (résolution type synchro) ; `confident` = correspondance fiable */
  pageMatch: { mediaId: number; confident: boolean } | null;
  remembered: { mediaId: number; exact: boolean } | null;
}

/**
 * Saison affichée sans consulter la liste de l'utilisateur, par ordre de priorité :
 * choix manuel → saison lue sur la page (fiable) → correspondance mémorisée pour cette saison →
 * saison lue sur la page (incertaine) → dernière saison mémorisée → saison unique.
 * null : il faut consulter la liste (première saison non terminée, voir firstUnfinishedSeason).
 */
export function pickKnownSeason({ seasonIds, manual, pageMatch, remembered }: KnownSeasonInput): SeasonChoice | null {
  const isSingle = seasonIds.length === 1;
  if (manual !== null) return { mediaId: manual, source: 'manual', confidence: 'certain' };
  if (pageMatch?.confident) return { mediaId: pageMatch.mediaId, source: isSingle ? 'single' : 'page', confidence: 'certain' };
  if (remembered?.exact) return { mediaId: remembered.mediaId, source: 'remembered', confidence: 'certain' };
  if (pageMatch) return { mediaId: pageMatch.mediaId, source: 'page', confidence: 'uncertain' };
  if (remembered) return { mediaId: remembered.mediaId, source: 'remembered', confidence: 'uncertain' };
  // Fiche unique sans lien fiable avec la page : homonymie possible
  if (isSingle) return { mediaId: seasonIds[0], source: 'single', confidence: 'uncertain' };
  return null;
}

/**
 * Première saison que l'utilisateur n'a pas terminée (pas dans la liste, en cours, en pause…).
 * `statuses` : statut de chaque saison dans l'ordre (null = hors liste), lus jusqu'à la première
 * non terminée (éventuellement tronqués). Toutes terminées → dernière saison. Choix toujours incertain.
 */
export function firstUnfinishedSeason(seasonIds: readonly number[], statuses: readonly (ListStatus | null)[]): SeasonChoice | null {
  if (seasonIds.length === 0) return null;
  const index = statuses.findIndex((status) => status !== 'COMPLETED');
  // Lectures tronquées (toutes terminées jusque-là) : la saison suivante, ou la dernière
  const pick = index !== -1 ? index : Math.min(statuses.length, seasonIds.length - 1);
  return { mediaId: seasonIds[pick] ?? seasonIds[0], source: 'progress', confidence: 'uncertain' };
}
