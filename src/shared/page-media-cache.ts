import { isRecord } from './guards';
import type { PageMediaInfo, PageMediaView } from './page-media.types';
import { PAGE_MEDIA_CACHE_PREFIX, PAGE_MEDIA_CACHE_TTL_MS, purgeStaleSessionCaches, sessionArea } from './session-cache';
import { isSessionEpochs, sameSessions, type SessionEpochs } from './session-epochs';
import { getOpenSessions } from './storage';
import { withStorageLock } from './storage-lock';

// Fiche de la page par onglet : source de vérité unique pour le popup (carte « Sur cette page ») et le panneau.
// Écrite après chaque RESOLVE_PAGE_MEDIA (popup, panneau) et après la synchro d'un épisode de l'onglet
// (service worker, fiche certaine). `storage.session` : en mémoire, vidée à la fermeture du navigateur et à la
// déconnexion d'un compte, entrées expirées purgées à l'écriture (voir session-cache.ts).
// Liée aux sessions ouvertes avant la résolution (états des listes de ces comptes) : jamais écrite si elles ont changé
// entre-temps (résolution en vol pendant une déconnexion), jamais relue sous d'autres sessions (DATA-04, SEC-03).

export { PAGE_MEDIA_CACHE_PREFIX, PAGE_MEDIA_CACHE_TTL_MS };

export type PageMediaSource = 'sync' | 'resolve';

export interface CachedPageMedia {
  pageKey: string;
  /** Épisode de la page de lecture (null : page de série) */
  episodeId: string | null;
  /** Page lue sans ses données structurées (saison devinée sur le titre) */
  partial: boolean;
  view: PageMediaView;
  resolvedAt: number;
  source: PageMediaSource;
  /** Sessions ouvertes avant la résolution (getOpenSessions) : la fiche ne vaut que pour elles */
  epochs: SessionEpochs;
}

export const pageMediaCacheKey = (tabId: number): string => `${PAGE_MEDIA_CACHE_PREFIX}${tabId}`;

/** Clé d'identité d'une page (série/saison + épisode) : même clé = même fiche */
export function pageKey(page: PageMediaInfo): string {
  return JSON.stringify([page.platform, page.kind, page.seriesId, page.seriesSlug, page.seriesTitle, page.seasonNumber, page.seasonTitle, page.episode?.episodeId ?? null]);
}

/**
 * Page de lecture lue avant ses données structurées (JSON-LD) : repli sur le DOM, sans saison ni numéro
 * relatif. Résolue telle quelle, elle ne donne qu'une saison devinée sur le titre (Black Butler -Public School
 * Arc- : « Kuroshitsuji » 2008 au lieu de « Kishuku Gakkou-hen ») : elle ne doit jamais remplacer une lecture complète.
 */
export function isPartialEpisodePage(page: PageMediaInfo): boolean {
  const { episode } = page;
  return page.kind === 'episode' && episode !== null && episode.seasonNumber === null && episode.seasonTitle === null && episode.seasonEpisodeNumber === null;
}

export function toCachedPageMedia(page: PageMediaInfo, view: PageMediaView, source: PageMediaSource, now: number, epochs: SessionEpochs): CachedPageMedia {
  return { pageKey: pageKey(page), episodeId: page.episode?.episodeId ?? null, partial: isPartialEpisodePage(page), view, resolvedAt: now, source, epochs };
}

/**
 * Fiche en cache valable pour cette page : même clé, ou même épisode lu en entier alors que la page
 * demandée est partielle (le panneau a lu la page trop tôt : la fiche complète l'emporte).
 */
export function matchCachedPageMedia(entry: CachedPageMedia | null, page: PageMediaInfo, now: number): CachedPageMedia | null {
  if (!entry || now - entry.resolvedAt > PAGE_MEDIA_CACHE_TTL_MS || now < entry.resolvedAt - 60_000) return null;
  if (entry.pageKey === pageKey(page)) return entry;
  const episodeId = page.episode?.episodeId ?? null;
  return episodeId !== null && entry.episodeId === episodeId && !entry.partial && isPartialEpisodePage(page) ? entry : null;
}

/** Une lecture partielle n'écrase jamais la fiche complète du même épisode */
export function shouldReplaceCachedPageMedia(existing: CachedPageMedia | null, next: CachedPageMedia): boolean {
  return !(existing && next.partial && !existing.partial && existing.episodeId !== null && existing.episodeId === next.episodeId);
}

export function isCachedPageMedia(value: unknown): value is CachedPageMedia {
  return (
    isRecord(value) &&
    typeof value.pageKey === 'string' &&
    (value.episodeId === null || typeof value.episodeId === 'string') &&
    typeof value.partial === 'boolean' &&
    typeof value.resolvedAt === 'number' &&
    (value.source === 'sync' || value.source === 'resolve') &&
    isSessionEpochs(value.epochs) &&
    isRecord(value.view) &&
    isRecord(value.view.media) &&
    typeof value.view.media.mediaId === 'number' &&
    Array.isArray(value.view.lists)
  );
}

// `storage.session` absent : pas de cache, tout passe par RESOLVE_PAGE_MEDIA

/** Fiche de l'onglet ; null si elle a été écrite sous d'autres sessions (compte déconnecté, ou connecté depuis) */
export async function readCachedPageMedia(tabId: number): Promise<CachedPageMedia | null> {
  const area = sessionArea();
  if (!area) return null;
  const key = pageMediaCacheKey(tabId);
  const stored = await area.get(key);
  const value: unknown = stored[key];
  return isCachedPageMedia(value) && sameSessions(value.epochs, await getOpenSessions()) ? value : null;
}

/**
 * Écrit la fiche de l'onglet (sauf lecture partielle face à une fiche complète) ; retourne l'entrée écrite.
 * `epochs` : sessions relevées AVANT la résolution. Vérifiées et écrites sous le verrou du stockage, celui de la
 * déconnexion (qui efface ce cache) : une résolution en vol pendant une déconnexion ne recrée jamais la fiche.
 */
export async function storeCachedPageMedia(
  tabId: number,
  page: PageMediaInfo,
  view: PageMediaView,
  source: PageMediaSource,
  epochs: SessionEpochs,
  /**
   * Horodatage de l'entrée (`resolvedAt`). Fourni par l'écran qui écrit, connu AVANT l'écriture : storage.onChanged est
   * émis pendant l'écriture, avant que cette fonction ne rende la main, et l'écran doit y reconnaître son propre écho.
   */
  now: number = Date.now(),
): Promise<CachedPageMedia | null> {
  const area = sessionArea();
  if (!area) return null;
  const next = toCachedPageMedia(page, view, source, now, epochs);
  const written = await withStorageLock(async () => {
    if (!sameSessions(epochs, await getOpenSessions())) return null;
    if (!shouldReplaceCachedPageMedia(await readCachedPageMedia(tabId), next)) return null;
    await area.set({ [pageMediaCacheKey(tabId)]: next });
    return next;
  });
  // Fiches des onglets fermés ou expirées : retirées en passant, hors verrou (jamais d'échec de l'écriture pour autant)
  if (written) await purgeStaleSessionCaches().catch(() => 0);
  return written;
}
