import type { EpisodeInfo } from './episode.types';
import { isRecord } from './guards';
import { seriesKeyFromLink } from './platform-links';
import { withStorageLock } from './storage-lock';
import { normalizeTitle } from './title';
import type { PlatformLink } from './watching.types';

// Séries exclues de la synchronisation (toutes saisons) — lues par le content script
// (avant tout envoi), le service worker (après résolution) et le popup (gestion).
// Écritures sous `withStorageLock` (src/shared/storage.ts), clé de stockage `excludedSeries`.

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
    : `${episode.platform}:title:${normalizeSeriesTitle(episode.animeTitle)}`;
}

/** Identifiant stable : la clé plateforme si connue, sinon la fiche AniList. */
function exclusionId(platformKey: string | null, mediaId: number | null): string | null {
  return platformKey ?? (mediaId !== null ? `anilist:${mediaId}` : null);
}

/** Vrai si l'exclusion couvre la clé plateforme ou la fiche AniList demandée. */
export function matchesExclusion(entry: ExcludedSeries, query: { platformKey?: string | null; mediaId?: number | null }): boolean {
  return (
    (query.platformKey != null && entry.platformKey === query.platformKey) ||
    (query.mediaId != null && entry.mediaId === query.mediaId)
  );
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

/** Fusionne une nouvelle exclusion dans la liste (pur, testable) : complète l'entrée existante qui partage une clé. */
export function mergeExclusion(
  list: readonly ExcludedSeries[],
  input: { platformKey: string | null; mediaId: number | null; label: string },
  now: number,
): ExcludedSeries[] {
  const id = exclusionId(input.platformKey, input.mediaId);
  if (id === null) return [...list];
  const index = list.findIndex((e) => matchesExclusion(e, input));
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

async function readExcludedSeries(): Promise<ExcludedSeries[]> {
  const stored = await chrome.storage.local.get(EXCLUDED_SERIES_KEY);
  const value: unknown = stored[EXCLUDED_SERIES_KEY];
  return Array.isArray(value) ? value.filter(isExcludedSeries) : [];
}

export async function getExcludedSeries(): Promise<ExcludedSeries[]> {
  return readExcludedSeries();
}

/** Exclut une série ; fusionne avec une exclusion existante qui partage la même platformKey ou le même mediaId. */
export async function excludeSeries(input: { platformKey: string | null; mediaId: number | null; label: string }): Promise<void> {
  await withStorageLock(async () => {
    const list = mergeExclusion(await readExcludedSeries(), input, Date.now());
    await chrome.storage.local.set({ [EXCLUDED_SERIES_KEY]: list });
  });
}

export async function includeSeries(id: string): Promise<void> {
  await withStorageLock(async () => {
    const list = (await readExcludedSeries()).filter((e) => e.id !== id);
    await chrome.storage.local.set({ [EXCLUDED_SERIES_KEY]: list });
  });
}

/** Vrai si l'épisode (côté page) ou la fiche AniList (côté service worker) est exclu. */
export async function isExcluded(query: { platformKey?: string | null; mediaId?: number | null }): Promise<boolean> {
  if (query.platformKey == null && query.mediaId == null) return false;
  return (await readExcludedSeries()).some((e) => matchesExclusion(e, query));
}
