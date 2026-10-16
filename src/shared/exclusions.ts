import { seriesKeyFromLink } from '../platforms/links';
import { matchesExclusion, type ExcludedSeries } from '../browser/storage/exclusions-read';
import { exclusionKeyCovers, exclusionKeyYear } from '../platforms/series-identity';
import type { PlatformLink } from './watching.types';

// Séries exclues de la synchronisation (toutes saisons) — lues par le content script
// (avant tout envoi, via exclusions-core.ts), le service worker (après résolution) et le popup (gestion).
// Écritures sous `withStorageLock` : browser/storage/exclusions-store.ts ; clé de stockage `excludedSeries`.

export {
  EXCLUDED_SERIES_KEY,
  getExcludedSeries,
  isExcluded,
  isExcludedSeries,
  matchesExclusion,
  normalizeSeriesTitle,
  type ExcludedSeries,
} from '../browser/storage/exclusions-read';

/** Identifiant stable : la clé plateforme si connue, sinon la fiche AniList. */
function exclusionId(platformKey: string | null, mediaId: number | null): string | null {
  return platformKey ?? (mediaId !== null ? `anilist:${mediaId}` : null);
}

/**
 * Série « En cours » exclue : par sa fiche AniList, ou par la série d'un de ses liens de plateforme. Une exclusion
 * créée depuis une page de lecture avant la résolution de la fiche n'a que sa platformKey (ALRT-03). Identifiants
 * comparés sans la casse (Crunchyroll).
 */
export function isEntryExcluded(list: readonly ExcludedSeries[], entry: { mediaId: number | null; platforms: readonly PlatformLink[] }): boolean {
  const keys = new Set(entry.platforms.flatMap((link) => seriesKeyFromLink(link)?.toLowerCase() ?? []));
  return list.some((ex) => matchesExclusion(ex, { mediaId: entry.mediaId }) || (ex.platformKey !== null && keys.has(ex.platformKey.toLowerCase())));
}

/**
 * L'exclusion existante `entry` inclut déjà la nouvelle : même fiche AniList, ou même série et année égale ou absente de
 * l'existante (« Berserk » sans année inclut « Berserk » 2016, l'inverse non : l'exclusion sans année, plus large, est ajoutée).
 */
function includesExclusion(entry: ExcludedSeries, input: { platformKey: string | null; mediaId: number | null }): boolean {
  if (input.mediaId !== null && entry.mediaId === input.mediaId) return true;
  if (input.platformKey === null || entry.platformKey === null) return false;
  const year = exclusionKeyYear(entry.platformKey);
  return exclusionKeyCovers(entry.platformKey, input.platformKey) && (year === null || year === exclusionKeyYear(input.platformKey));
}

/** Fusionne une nouvelle exclusion dans la liste (pur, testable) : complète l'entrée existante qui l'inclut déjà. */
export function mergeExclusion(
  list: readonly ExcludedSeries[],
  input: { platformKey: string | null; mediaId: number | null; label: string },
  now: number,
): ExcludedSeries[] {
  const id = exclusionId(input.platformKey, input.mediaId);
  if (id === null) return [...list];
  const index = list.findIndex((e) => includesExclusion(e, input));
  if (index === -1) {
    return [...list, { id, platformKey: input.platformKey, mediaId: input.mediaId, label: input.label, excludedAt: now }];
  }
  const existing = list[index];
  // L'id existant est conservé (référencé par le popup) ; les clés manquantes sont complétées
  const merged: ExcludedSeries = {
    ...existing,
    platformKey: existing.platformKey ?? input.platformKey,
    mediaId: existing.mediaId ?? input.mediaId,
  };
  return list.map((e, i) => (i === index ? merged : e));
}
