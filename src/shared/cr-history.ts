import { isRecord } from './guards';

// Historique de visionnage Crunchyroll réduit à une ligne par saison (import Réglages › Importer depuis Crunchyroll).
// Lu par le script de contenu dans l'onglet Crunchyroll de l'utilisateur (src/content/lib/crunchyroll-history.ts),
// transmis à la page d'import par un port, puis au service worker pour l'analyse. Rien d'autre n'est conservé.

/** Saisons transmises au plus (au-delà : historique tronqué, signalé comme partiel) */
export const MAX_HISTORY_SEASONS = 2000;

/** Dernier épisode vu d'une saison Crunchyroll */
export interface HistorySeason {
  seriesId: string;
  seriesTitle: string;
  /** Slug de la série (`series_slug_title`, « one-piece ») : reconnaît les anciens liens AniList crunchyroll.com/{slug} */
  seriesSlug: string | null;
  seasonId: string;
  seasonNumber: number | null;
  /** Peut être générique (Black Butler saison 4 → « Black Butler ») : le résolveur l'ignore alors */
  seasonTitle: string | null;
  /** Épisode vu le plus avancé de la saison */
  episodeId: string;
  episodeTitle: string | null;
  /** Numéro affiché par Crunchyroll (`episode_number`) : parfois absolu (One Piece E1180) */
  episodeNumber: number;
  /** Position de l'épisode dans sa saison (One Piece E1180 → 25) ; null si elle n'a pas pu être établie */
  seasonEpisodeNumber: number | null;
  /** Épisodes de la saison comptés comme vus */
  watchedCount: number;
  /** Dernier visionnage dans la saison (ms), null si inconnu */
  lastPlayedAt: number | null;
}

export interface HistoryStats {
  /** Éléments d'historique lus */
  items: number;
  pages: number;
  /** Limite de pages atteinte ou trop de saisons : l'historique le plus ancien n'a pas été lu */
  partial: boolean;
}

export interface CrHistoryResult {
  seasons: HistorySeason[];
  stats: HistoryStats;
}

/**
 * Échecs de lecture :
 * - logged-out : aucune session Crunchyroll dans ce navigateur ;
 * - unavailable : API modifiée (identifiant client changé, réponse inattendue) ;
 * - blocked : Crunchyroll refuse ou limite les requêtes (403 / 429) ;
 * - network : connexion perdue ;
 * - wrong-page : l'onglet n'est pas www.crunchyroll.com.
 */
export type CrHistoryErrorCode = 'logged-out' | 'unavailable' | 'blocked' | 'network' | 'wrong-page';
export const CR_HISTORY_ERROR_CODES: readonly CrHistoryErrorCode[] = ['logged-out', 'unavailable', 'blocked', 'network', 'wrong-page'];

// ─── Port page d'import ↔ script de contenu ───────────────────────────────

/** Port ouvert par la page d'import vers l'onglet Crunchyroll (chrome.tabs.connect) ; fermé = lecture abandonnée */
export const CR_HISTORY_PORT_NAME = 'synckai:cr-history';

/** Demande de lecture (seul message accepté sur le port, venant d'une page de l'extension) */
export interface CrHistoryRequest {
  type: 'READ_CR_HISTORY';
}

export type CrHistoryPortMessage =
  /** `lookups` : saisons dont la numérotation est vérifiée (après la lecture des pages) */
  | { type: 'progress'; pages: number; items: number; lookups: number; lookupsTotal: number }
  | { type: 'done'; result: CrHistoryResult }
  | { type: 'error'; code: CrHistoryErrorCode };

const isCount = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 0;
const isPositive = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 1;
const isId = (v: unknown): v is string => typeof v === 'string' && /^[A-Za-z0-9_-]{1,40}$/.test(v);
/** Slug d’URL Crunchyroll (minuscules, chiffres, tirets) */
export const isSeriesSlug = (v: unknown): v is string => typeof v === "string" && v.length <= 100 && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(v);
const isText = (v: unknown, max: number): v is string => typeof v === 'string' && v.length > 0 && v.length <= max;

export function isCrHistoryRequest(value: unknown): value is CrHistoryRequest {
  return isRecord(value) && value.type === 'READ_CR_HISTORY';
}

export function isHistorySeason(value: unknown): value is HistorySeason {
  return (
    isRecord(value) &&
    isId(value.seriesId) &&
    isText(value.seriesTitle, 300) &&
    (value.seriesSlug === null || isSeriesSlug(value.seriesSlug)) &&
    isId(value.seasonId) &&
    (value.seasonNumber === null || isCount(value.seasonNumber)) &&
    (value.seasonTitle === null || isText(value.seasonTitle, 300)) &&
    isId(value.episodeId) &&
    (value.episodeTitle === null || isText(value.episodeTitle, 500)) &&
    isPositive(value.episodeNumber) &&
    (value.seasonEpisodeNumber === null || isPositive(value.seasonEpisodeNumber)) &&
    isPositive(value.watchedCount) &&
    (value.lastPlayedAt === null || (typeof value.lastPlayedAt === 'number' && Number.isFinite(value.lastPlayedAt)))
  );
}

export function isHistoryStats(value: unknown): value is HistoryStats {
  return isRecord(value) && isCount(value.items) && isCount(value.pages) && typeof value.partial === 'boolean';
}

export function isCrHistoryResult(value: unknown): value is CrHistoryResult {
  return (
    isRecord(value) &&
    Array.isArray(value.seasons) &&
    value.seasons.length <= MAX_HISTORY_SEASONS &&
    value.seasons.every(isHistorySeason) &&
    isHistoryStats(value.stats)
  );
}

export function isCrHistoryPortMessage(value: unknown): value is CrHistoryPortMessage {
  if (!isRecord(value)) return false;
  switch (value.type) {
    case 'progress':
      return isCount(value.pages) && isCount(value.items) && isCount(value.lookups) && isCount(value.lookupsTotal);
    case 'done':
      return isCrHistoryResult(value.result);
    case 'error':
      return CR_HISTORY_ERROR_CODES.some((c) => c === value.code);
    default:
      return false;
  }
}
