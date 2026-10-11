import type { AniListErrorCode } from './anilist.types';
import type { Score10 } from './engagement.types';
import { isEpisodeInfo, isStreamingPlatform, type EpisodeInfo, type StreamingPlatform } from './episode.types';
import { isRecord } from './guards';
import type { Result } from './result';
import type { CandidateSummary } from './review.types';
import type { ListStatus } from './sync.types';
import type { TrackerId } from './tracker.types';
import type { AiringStatus, NextEpisode } from './watching.types';

// Fiche de la page (#23) : série ou épisode Crunchyroll / ADN ouvert dans l'onglet actif.

/**
 * Série détectée par le content script sur la page de l'onglet actif.
 * `episode` n'est renseigné que sur une page de lecture (mêmes données que la synchro).
 */
export interface PageMediaInfo {
  platform: StreamingPlatform;
  kind: 'series' | 'episode';
  /** Identifiant de la série propre à la plateforme (ex : "GRMG8ZQZR", "1311") */
  seriesId: string | null;
  seriesSlug: string | null;
  seriesTitle: string;
  /** Saison sélectionnée sur la page, si lisible */
  seasonNumber: number | null;
  seasonTitle: string | null;
  /**
   * Nombre d'épisodes de la saison sélectionnée, si la page l'affiche (menu des saisons Crunchyroll :
   * "Season 2 · 25 Episodes"). Sert uniquement à signaler une saison AniList douteuse.
   */
  seasonEpisodeCount?: number | null;
  episode: EpisodeInfo | null;
}

/** Limite de longueur des textes venant d'une page tierce (validation du message) */
const MAX_TEXT = 300;

const isShortString = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && v.length <= MAX_TEXT;
const isNullableShortString = (v: unknown): v is string | null => v === null || isShortString(v);
const isNullableSeason = (v: unknown): v is number | null => v === null || (typeof v === 'number' && Number.isInteger(v) && v >= 0 && v < 1000);
/** Nombre d'épisodes d'une saison : facultatif (absent sur ADN), entier positif raisonnable */
const isOptionalCount = (v: unknown): v is number | null | undefined =>
  v === undefined || v === null || (typeof v === 'number' && Number.isInteger(v) && v >= 1 && v < 10_000);

export function isPageMediaInfo(value: unknown): value is PageMediaInfo {
  if (!isRecord(value)) return false;
  const { platform, kind, seriesId, seriesSlug, seriesTitle, seasonNumber, seasonTitle, seasonEpisodeCount, episode } = value;
  return (
    isStreamingPlatform(platform) &&
    (kind === 'series' || kind === 'episode') &&
    isNullableShortString(seriesId) &&
    isNullableShortString(seriesSlug) &&
    isShortString(seriesTitle) &&
    isNullableSeason(seasonNumber) &&
    isNullableShortString(seasonTitle) &&
    isOptionalCount(seasonEpisodeCount) &&
    // Une page d'épisode porte toujours son épisode, une page de série jamais
    (kind === 'episode' ? isEpisodeInfo(episode) && episode.platform === platform : episode === null)
  );
}

/** Origine du choix de la saison affichée */
export type SeasonSource =
  /** Saison lue sur la page (sélecteur de saison, épisode en cours) */
  | 'page'
  /** Une seule saison connue */
  | 'single'
  /** Correspondance mémorisée lors d'une synchro précédente */
  | 'remembered'
  /** Première saison non terminée par l'utilisateur */
  | 'progress'
  /** Choix dans le sélecteur de la carte */
  | 'manual';

/** Fiche AniList affichée dans la carte « Sur cette page » */
export interface PageMediaDetails {
  mediaId: number;
  idMal: number | null;
  title: string;
  coverUrl: string | null;
  episodes: number | null;
  format: string | null;
  year: number | null;
  airingStatus: AiringStatus | null;
  nextEpisode: NextEpisode | null;
  siteUrl: string;
}

/** État de la série dans la liste d'un service connecté */
export type PageListState =
  | { service: TrackerId; state: 'in-list'; status: ListStatus; progress: number; score: Score10 | null; siteUrl: string }
  | { service: TrackerId; state: 'not-in-list'; siteUrl: string }
  /** Pas d'équivalent sur ce service (ex : fiche AniList sans idMal) */
  | { service: TrackerId; state: 'unavailable' }
  | { service: TrackerId; state: 'error'; message: string };

/** Position d'une fiche dans les saisons de la série : saison (parties « Part 2 » regroupées) et partie */
export interface SeasonSlot {
  season: number;
  /** Partie dans la saison (1 si la saison tient en une fiche) */
  part: number;
  parts: number;
}

/** Fiche proposée dans le sélecteur de saison ; `slot` null hors des saisons de la série (spécial, autre résultat) */
export interface PageSeason extends CandidateSummary {
  slot: SeasonSlot | null;
}

export interface PageMediaView {
  media: PageMediaDetails;
  /** Un état par service connecté (AniList d'abord) */
  lists: PageListState[];
  confidence: 'certain' | 'uncertain';
  source: SeasonSource;
  /** Saisons proposées dans le sélecteur (ordre de diffusion) ; vide ou une seule = pas de sélecteur */
  seasons: PageSeason[];
  /**
   * Page de lecture : épisode de la page rapporté à la fiche AniList affichée (progression que la synchro
   * écrirait, jamais le numéro relatif à la saison Crunchyroll). null sur une page de série ou si inconnu.
   */
  episodeProgress: number | null;
}

/**
 * - `NOT_FOUND` : aucune fiche AniList (la synchro demandera la fiche à la fin de l'épisode, carte « À vérifier ») ;
 * - `NOT_TRACKED` : série ignorée sur une plateforme généraliste (Netflix, probablement pas un anime), ou accès Netflix
 *   retiré : rien à suivre.
 */
export type PageMediaErrorCode = AniListErrorCode | 'NOT_FOUND' | 'NOT_TRACKED';

export type PageMediaResult = Result<PageMediaView, PageMediaErrorCode>;

export interface ResolvePageMediaPayload {
  page: PageMediaInfo;
  /** Saison choisie dans le sélecteur de la carte, sinon null (choix automatique) */
  mediaId: number | null;
}
