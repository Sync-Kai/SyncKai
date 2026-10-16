import { isRecord } from '../../shared/guards';
import { normalizeTitle } from '../../shared/title';
import { exclusionKeyCovers } from '../../platforms/series-identity';

// Séries exclues, lecture seule : ce qu'utilise le script de contenu avant tout envoi (lecture du stockage,
// correspondance ; clés : platforms/series-identity.ts › exclusionKey). Écritures et rapprochement avec les liens
// « En cours » : exclusions.ts, hors des pages de streaming.

export const EXCLUDED_SERIES_KEY = 'excludedSeries';

export interface ExcludedSeries {
  /** Identifiant stable de l'exclusion */
  id: string;
  /**
   * Série sur la plateforme (`${platform}:${seriesId ou "title:" + titre normalisé}`, suivie de `:y{année}` pour une série
   * par titre dont l'année de début était connue, voir exclusionKey), si connue
   */
  platformKey: string | null;
  /** Fiche AniList, si connue (exclusion depuis « En cours » ou après résolution) */
  mediaId: number | null;
  /** Libellé affiché dans Réglages › Séries exclues */
  label: string;
  excludedAt: number;
}

export function isExcludedSeries(value: unknown): value is ExcludedSeries {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    (value.platformKey === null || typeof value.platformKey === 'string') &&
    (value.mediaId === null || typeof value.mediaId === 'number') &&
    typeof value.label === 'string' &&
    typeof value.excludedAt === 'number'
  );
}

/** Titre comparable : minuscules, sans accents, ponctuation → espaces (voir title.ts) */
export const normalizeSeriesTitle = normalizeTitle;

/**
 * Vrai si l'exclusion couvre la clé plateforme (exclusionKey : années égales, ou l'une inconnue, voir exclusionKeyCovers)
 * ou la fiche AniList demandée.
 */
export function matchesExclusion(entry: ExcludedSeries, query: { platformKey?: string | null; mediaId?: number | null }): boolean {
  return (
    (query.platformKey != null && entry.platformKey !== null && exclusionKeyCovers(entry.platformKey, query.platformKey)) ||
    (query.mediaId != null && entry.mediaId === query.mediaId)
  );
}

export async function readExcludedSeries(): Promise<ExcludedSeries[]> {
  const stored = await chrome.storage.local.get(EXCLUDED_SERIES_KEY);
  const value: unknown = stored[EXCLUDED_SERIES_KEY];
  return Array.isArray(value) ? value.filter(isExcludedSeries) : [];
}

export async function getExcludedSeries(): Promise<ExcludedSeries[]> {
  return readExcludedSeries();
}

/** Vrai si l'épisode (côté page) ou la fiche AniList (côté service worker) est exclu. */
export async function isExcluded(query: { platformKey?: string | null; mediaId?: number | null }): Promise<boolean> {
  if (query.platformKey == null && query.mediaId == null) return false;
  return (await readExcludedSeries()).some((e) => matchesExclusion(e, query));
}
