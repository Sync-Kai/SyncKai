import { isFranchiseGraph, type FranchiseGraph } from '../../shared/franchise';
import { isRecord } from '../../shared/guards';
import { storedKeys } from './stored-keys';

// Caches de `storage.session` (Chrome 102+, Firefox 115+) : en mémoire, jamais écrits sur disque, vidés à la fermeture
// du navigateur. Quota commun d'environ 10 Mo (avec `ignoredSeries`, voir background/sync/ignored-series.ts) :
// - fiche de la page par onglet (`pageMedia:<tabId>`, voir page-media-cache.ts) : contient l'état des listes du compte ;
// - fiche du panneau latéral (`panelMedia:v<n>:<mediaId>`, voir background/anilist/panel-media.ts) : catalogue public ;
// - graphe d'une franchise (`franchise:v1:<mediaId>`, voir background/franchise/load.ts) : catalogue public.
// La TTL ne joue qu'à la lecture : les entrées expirées sont purgées à l'écriture (DATA-04, PERF-05), et les deux
// caches sont effacés à la déconnexion d'un compte (SEC-03, voir storage.ts).

export const PAGE_MEDIA_CACHE_PREFIX = 'pageMedia:';
/** Au-delà, la fiche de la page est recalculée (états de liste modifiés ailleurs) */
export const PAGE_MEDIA_CACHE_TTL_MS = 10 * 60_000;

export const PANEL_MEDIA_CACHE_PREFIX = 'panelMedia:';
/** Versionnée : une fiche d'un format précédent (relations sans liens de plateformes, sans idMal ou sans statut et date de début) n'est jamais relue */
export const PANEL_MEDIA_CACHE_VERSION = 4;
export const PANEL_MEDIA_CACHE_TTL_MS = 6 * 3_600_000;
const PANEL_MEDIA_CURRENT_PREFIX = `${PANEL_MEDIA_CACHE_PREFIX}v${PANEL_MEDIA_CACHE_VERSION}:`;
export const panelMediaCacheKey = (mediaId: number): string => `${PANEL_MEDIA_CURRENT_PREFIX}${mediaId}`;

export const FRANCHISE_CACHE_PREFIX = 'franchise:v1:';
/** Ordre de visionnage d'une franchise (catalogue public) : recalculé au bout de 24 h */
export const FRANCHISE_CACHE_TTL_MS = 24 * 3_600_000;
/** Pointeur d'une entrée de la franchise : `{ at, graphId }` */
export const franchiseCacheKey = (mediaId: number): string => `${FRANCHISE_CACHE_PREFIX}${mediaId}`;
/** Enregistrement unique du graphe : `{ at, value }`, sous l'identifiant de départ du parcours (préfixe `g`, jamais un identifiant) */
export const franchiseRecordKey = (graphId: number): string => `${FRANCHISE_CACHE_PREFIX}g${graphId}`;

/** Une purge au plus par intervalle et par contexte (service worker : en pratique une par réveil) */
const PURGE_INTERVAL_MS = PAGE_MEDIA_CACHE_TTL_MS;
let lastPurgeAt = Number.NEGATIVE_INFINITY;

/** `storage.session`, null si absent (navigateur trop ancien, script de contenu sans accès) */
export function sessionArea(): chrome.storage.StorageArea | null {
  const area: unknown = typeof chrome !== 'undefined' && isRecord(chrome.storage) ? Reflect.get(chrome.storage, 'session') : undefined;
  return isRecord(area) && typeof area.get === 'function' ? chrome.storage.session : null;
}

const isCacheKey = (key: string): boolean => key.startsWith(PAGE_MEDIA_CACHE_PREFIX) || key.startsWith(PANEL_MEDIA_CACHE_PREFIX) || key.startsWith(FRANCHISE_CACHE_PREFIX);

/** Horodatage valable : ni dépassé de `ttl`, ni dans le futur (horloge reculée) */
const fresh = (at: unknown, ttl: number, now: number): boolean => typeof at === 'number' && Number.isFinite(at) && now - at <= ttl && at - now <= 60_000;

/** Clés des caches expirés, illisibles ou d'un format précédent (pur, testable) */
export function staleSessionCacheKeys(items: Record<string, unknown>, now: number): string[] {
  return Object.entries(items)
    .filter(([key, value]) => {
      if (key.startsWith(PAGE_MEDIA_CACHE_PREFIX)) return !isRecord(value) || !fresh(value.resolvedAt, PAGE_MEDIA_CACHE_TTL_MS, now);
      if (key.startsWith(PANEL_MEDIA_CACHE_PREFIX)) return !key.startsWith(PANEL_MEDIA_CURRENT_PREFIX) || !isRecord(value) || !fresh(value.at, PANEL_MEDIA_CACHE_TTL_MS, now);
      // Version dans le préfixe (`franchise:v1:`) : un format précédent change de préfixe et n'est plus jamais lu
      if (key.startsWith(FRANCHISE_CACHE_PREFIX)) return !isRecord(value) || !fresh(value.at, FRANCHISE_CACHE_TTL_MS, now);
      return false;
    })
    .map(([key]) => key);
}

/**
 * Purge opportuniste, appelée après l'écriture d'un cache : retire les fiches expirées (onglets fermés, fiches du
 * panneau consultées il y a plus de 6 h). Au plus une fois par intervalle ; retourne le nombre de clés retirées.
 */
export async function purgeStaleSessionCaches(now: number = Date.now()): Promise<number> {
  const area = sessionArea();
  if (!area || now - lastPurgeAt < PURGE_INTERVAL_MS) return 0;
  lastPurgeAt = now;
  const stale = staleSessionCacheKeys(await area.get(null), now);
  if (stale.length > 0) await area.remove(stale);
  return stale.length;
}

/**
 * Déconnexion d'un compte : fiches de page (états des listes du compte) et du panneau retirées tout de suite, sans
 * attendre la fermeture du navigateur (SEC-03). Les séries Netflix ignorées (catalogue, sans compte) restent.
 */
export async function clearSessionCaches(): Promise<void> {
  const area = sessionArea();
  if (!area) return;
  const keys = (await storedKeys(area)).filter(isCacheKey);
  if (keys.length > 0) await area.remove(keys);
}

// ─── Graphe d'une franchise (24 h) ────────────────────────────────────────

/** Repli quand `storage.session` est absent : mémoire du service worker (perdue à sa mise en veille), un même objet partagé par identifiant */
const franchiseMemory = new Map<number, { at: number; value: FranchiseGraph }>();

const validRecord = (record: unknown, now: number): FranchiseGraph | null =>
  isRecord(record) && fresh(record.at, FRANCHISE_CACHE_TTL_MS, now) && isFranchiseGraph(record.value) ? record.value : null;

/** Graphe en cache pour cet identifiant (pointeur puis enregistrement), null si absent, expiré ou illisible */
export async function readFranchiseCache(mediaId: number, now: number = Date.now()): Promise<FranchiseGraph | null> {
  const area = sessionArea();
  if (!area) return validRecord(franchiseMemory.get(mediaId), now);
  try {
    const pointerKey = franchiseCacheKey(mediaId);
    const pointer = (await area.get(pointerKey))[pointerKey];
    if (!isRecord(pointer) || !fresh(pointer.at, FRANCHISE_CACHE_TTL_MS, now) || typeof pointer.graphId !== 'number') return null;
    const recordKey = franchiseRecordKey(pointer.graphId);
    return validRecord((await area.get(recordKey))[recordKey], now);
  } catch {
    return null;
  }
}

/**
 * Un enregistrement du graphe (sous son identifiant de départ) et un pointeur par identifiant : le départ et, graphe complet,
 * toutes ses entrées principales. Échec d'écriture = accélération perdue.
 */
export async function writeFranchiseCache(mediaIds: readonly number[], graph: FranchiseGraph, now: number = Date.now()): Promise<void> {
  const area = sessionArea();
  const record = { at: now, value: graph };
  if (!area) {
    for (const id of mediaIds) {
      if (franchiseMemory.size >= 30) franchiseMemory.delete(franchiseMemory.keys().next().value as number);
      franchiseMemory.set(id, record);
    }
    return;
  }
  try {
    const items: Record<string, unknown> = { [franchiseRecordKey(graph.startId)]: record };
    for (const id of mediaIds) items[franchiseCacheKey(id)] = { at: now, graphId: graph.startId };
    await area.set(items);
    await purgeStaleSessionCaches(now);
  } catch {
    // Quota de session atteint : le graphe sera relu au prochain affichage
  }
}
