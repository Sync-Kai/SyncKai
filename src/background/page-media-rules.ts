import type { PageMediaInfo, PageSeason, SeasonSlot, SeasonSource } from '../shared/page-media.types';
import { platformSeriesUrl } from '../shared/platform-links';
import type { CandidateSummary } from '../shared/review.types';
import type { ListStatus, MediaMapping } from '../shared/sync.types';
import type { PlatformLink } from '../shared/watching.types';
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

// ─── Saisons découpées en parties (cours) ─────────────────────────────────

/**
 * Fiches du sélecteur avec leur position (saison · partie) : saisons de la série dans l'ordre des groupes,
 * puis les autres fiches proposées (sans position). `groups` : identifiants regroupés par saison (groupSeasons).
 */
export function toPageSeasons(summaries: readonly CandidateSummary[], groups: readonly (readonly number[])[]): PageSeason[] {
  const slots = new Map<number, SeasonSlot>();
  groups.forEach((group, index) => group.forEach((id, part) => slots.set(id, { season: index + 1, part: part + 1, parts: group.length })));
  const order = (s: CandidateSummary): number => {
    const slot = slots.get(s.id);
    return slot ? slot.season * 100 + slot.part : Number.MAX_SAFE_INTEGER;
  };
  // Tri stable : les fiches sans position gardent leur ordre d'origine
  return summaries.map((s) => ({ ...s, slot: slots.get(s.id) ?? null })).sort((a, b) => order(a) - order(b));
}

/**
 * Partie affichée pour une saison de la page découpée en plusieurs fiches : correspondance mémorisée
 * pour cette saison si elle désigne l'une des parties, sinon première partie non terminée (statuts lus
 * dans l'ordre, éventuellement tronqués), toutes terminées → dernière partie, statuts inconnus → première.
 */
export function pickPartInGroup(groupIds: readonly number[], remembered: { mediaId: number; exact: boolean } | null, statuses: readonly (ListStatus | null)[]): number | null {
  if (groupIds.length === 0) return null;
  if (remembered?.exact && groupIds.includes(remembered.mediaId)) return remembered.mediaId;
  const index = statuses.findIndex((status) => status !== 'COMPLETED');
  if (index !== -1) return groupIds[index] ?? groupIds[0];
  return statuses.length >= groupIds.length ? groupIds[groupIds.length - 1] : (groupIds[statuses.length] ?? groupIds[0]);
}

/** Écart toléré entre la plateforme et AniList (épisode 0, récapitulatif compté à part…) */
const EPISODE_COUNT_TOLERANCE = 2;

/**
 * Vrai si le nombre d'épisodes de la saison affiché sur la page ne correspond pas à celui des fiches
 * AniList retenues (somme des parties). Inconnu d'un côté ou de l'autre (saison en cours) → pas d'alerte.
 */
export function episodeCountMismatch(pageCount: number | null | undefined, episodes: readonly (number | null)[]): boolean {
  if (pageCount === null || pageCount === undefined || episodes.length === 0) return false;
  let total = 0;
  for (const count of episodes) {
    if (count === null) return false;
    total += count;
  }
  return Math.abs(pageCount - total) > EPISODE_COUNT_TOLERANCE;
}

/**
 * Lien de série à mémoriser pour la fiche résolue (« Ouvrir » sur la plateforme préférée) : seulement si
 * la correspondance est certaine (saison lue sur la page, correspondance exacte, choix manuel). Une
 * correspondance à confirmer n'est jamais apprise : un mauvais lien serait proposé sur une autre série.
 */
export function learnableSeriesLink(
  page: Pick<PageMediaInfo, 'platform' | 'seriesId' | 'seriesSlug'>,
  confidence: 'certain' | 'uncertain',
): PlatformLink | null {
  if (confidence !== 'certain') return null;
  const url = platformSeriesUrl(page.platform, page.seriesId, page.seriesSlug);
  return url ? { platform: page.platform, url } : null;
}
