import type { EpisodeInfo } from '../../shared/episode.types';
import { isRecord } from '../../shared/guards';
import { normalizeTitle, titleKey } from '../../shared/title';

// Séries exclues, lecture seule : ce qu'utilise le script de contenu avant tout envoi (clé de série, lecture du
// stockage, correspondance). Écritures et rapprochement avec les liens « En cours » : exclusions.ts, hors des pages
// de streaming.

export const EXCLUDED_SERIES_KEY = 'excludedSeries';

export interface ExcludedSeries {
  /** Identifiant stable de l'exclusion */
  id: string;
  /** Série sur la plateforme (`${platform}:${seriesId ou "title:" + titre normalisé}`), si connue */
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

/** Clé de série plateforme, toutes saisons : "crunchyroll:GRMG8ZQZR", "adn:1311" ou "crunchyroll:title:one piece". */
export function platformSeriesKey(episode: Pick<EpisodeInfo, 'platform' | 'seriesId' | 'animeTitle'>): string {
  return episode.seriesId
    ? `${episode.platform}:${episode.seriesId}`
    : `${episode.platform}:title:${titleKey(episode.animeTitle)}`;
}

/** Vrai si l'exclusion couvre la clé plateforme ou la fiche AniList demandée. */
export function matchesExclusion(entry: ExcludedSeries, query: { platformKey?: string | null; mediaId?: number | null }): boolean {
  return (
    (query.platformKey != null && entry.platformKey === query.platformKey) ||
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
