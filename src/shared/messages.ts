import type { AiringCheckResult } from './airing.types';
import type { AniListErrorCode, ViewerResult } from './anilist.types';
import type { AuthResult } from './auth.types';
import { isEpisodeInfo, type EpisodeInfo } from './episode.types';
import { isRecord } from './guards';
import type { Result } from './result';
import type { CandidateSummary } from './review.types';
import type { MalViewerResult } from './mal.types';
import { isAddListStatus, isListStatusChange, type AddListStatus, type ListStatusChange, type SyncOutcome } from './sync.types';
import { isPageMediaInfo, type PageMediaResult, type ResolvePageMediaPayload } from './page-media.types';
import type { PanelMediaResult } from './panel-media.types';
import { isTrackerId, type TrackerId } from './tracker.types';
import type { WatchingResult } from './watching.types';
import { isApplyDiffsPayload, type ApplyDiffsPayload, type ApplyResult, type CancelJobResult, type CompareResult } from './compare';
import { isMediaRef, isScore10, type MediaRef, type Score10 } from './engagement.types';

export interface AdjustProgressPayload {
  /** Fiche AniList (catalogue) ; null pour une entrée MAL sans équivalent AniList */
  mediaId: number | null;
  malId: number | null;
  delta: 1 | -1;
}

export interface SetListStatusPayload {
  /** Fiche AniList (catalogue) ; null pour une entrée MAL sans équivalent AniList */
  mediaId: number | null;
  malId: number | null;
  status: ListStatusChange;
  /** Affiche de la carte « À noter » créée après « Terminé » (https uniquement) */
  coverUrl: string | null;
}

export interface AddToListPayload {
  /** Fiche AniList (catalogue) affichée dans la carte « Sur cette page » */
  mediaId: number;
  malId: number | null;
  status: AddListStatus;
}

export interface EpisodeCompletedPayload {
  episode: EpisodeInfo;
  /** null = tous les services connectés ; sinon nouvelle tentative ciblée après un échec partiel */
  services: TrackerId[] | null;
}

export interface ResolveReviewPayload {
  key: string;
  mediaId: number;
  progress: number;
}

/** Type de message → payload envoyé et réponse renvoyée par le service worker. */
export interface MessageMap {
  LOGIN_ANILIST: { payload: null; response: AuthResult };
  GET_VIEWER: { payload: null; response: ViewerResult };
  LOGIN_MAL: { payload: null; response: AuthResult };
  GET_MAL_VIEWER: { payload: null; response: MalViewerResult };
  EPISODE_COMPLETED: { payload: EpisodeCompletedPayload; response: SyncOutcome };
  SEARCH_ANIME: { payload: { query: string }; response: Result<CandidateSummary[], AniListErrorCode> };
  RESOLVE_REVIEW: { payload: ResolveReviewPayload; response: SyncOutcome };
  REOPEN_REVIEW: { payload: { key: string }; response: Result<null, AniListErrorCode | 'NOT_FOUND'> };
  /** Liste "en cours" d'un service (réponse fraîche ; le popup affiche d'abord le cache du stockage) */
  GET_WATCHING: { payload: { service: TrackerId }; response: WatchingResult };
  /** +1 / −1 manuel depuis le popup, écrit sur tous les services connectés où la série existe */
  ADJUST_PROGRESS: { payload: AdjustProgressPayload; response: SyncOutcome };
  /** En pause / Abandonné / Terminé depuis le popup, écrit sur tous les services connectés où la série est dans la liste */
  SET_LIST_STATUS: { payload: SetListStatusPayload; response: SyncOutcome };
  /** « Réessayer » sur une synchro en échec de la file (Activité) */
  RETRY_QUEUED: { payload: { id: string }; response: SyncOutcome };
  /** Note sur 10 (pas 0,5), convertie et écrite sur chaque service connecté ; retire la carte « À noter » */
  RATE_MEDIA: { payload: { media: MediaRef; score: Score10 }; response: SyncOutcome };
  /** « Plus tard » : crée la carte « À noter » */
  DEFER_RATING: { payload: { media: MediaRef; coverUrl: string | null }; response: Result<null, AniListErrorCode> };
  /** « Oui » au revisionnage : REPEATING + progression sur chaque service */
  START_REWATCH: { payload: { media: MediaRef; progress: number }; response: SyncOutcome };
  /** « Non » au revisionnage : ne plus demander pendant 30 jours */
  DECLINE_REWATCH: { payload: { media: MediaRef }; response: Result<null, AniListErrorCode> };
  /** « Vérifier maintenant » : vérification manuelle des sorties (même fenêtre / dédoublonnage que l'alarme) */
  CHECK_AIRING: { payload: null; response: AiringCheckResult };
  /** Fiche AniList de la série affichée dans l'onglet actif + état dans chaque liste (lecture seule) */
  RESOLVE_PAGE_MEDIA: { payload: ResolvePageMediaPayload; response: PageMediaResult };
  /** « À regarder » / « En cours » depuis la fiche de la page : seulement là où la série n'est pas déjà dans la liste */
  ADD_TO_LIST: { payload: AddToListPayload; response: SyncOutcome };
  /** Activité › Écarts : lit les listes complètes AniList et MAL et calcule les écarts (rien n'est écrit) */
  COMPARE_LISTS: { payload: null; response: CompareResult };
  /** Lance l'alignement des séries choisies sur `source` (tâche en arrière-plan, progression dans compare:job) */
  APPLY_DIFFS: { payload: ApplyDiffsPayload; response: ApplyResult };
  /** « Arrêter » l'alignement en cours (la série en cours se termine) */
  CANCEL_COMPARE_JOB: { payload: null; response: CancelJobResult };
  /** Chrome : script de contenu chargé sur Crunchyroll / ADN → panneau latéral activé pour cet onglet seulement */
  PANEL_AVAILABLE: { payload: null; response: null };
  /** Panneau latéral › « En lecture » : fiche AniList complète (synopsis, genres, studio, relations), cache de session */
  GET_PANEL_MEDIA: { payload: { mediaId: number }; response: PanelMediaResult };
}

/** Messages réservés aux pages de l'extension (popup) : refusés s'ils viennent d'un content script */
export const EXTENSION_PAGE_ONLY: ReadonlySet<MessageType> = new Set([
  'LOGIN_ANILIST',
  'LOGIN_MAL',
  'SEARCH_ANIME',
  'RESOLVE_REVIEW',
  'REOPEN_REVIEW',
  'GET_WATCHING',
  'ADJUST_PROGRESS',
  'SET_LIST_STATUS',
  'RETRY_QUEUED',
  'CHECK_AIRING',
  'RESOLVE_PAGE_MEDIA',
  'ADD_TO_LIST',
  'COMPARE_LISTS',
  'APPLY_DIFFS',
  'CANCEL_COMPARE_JOB',
  'GET_PANEL_MEDIA',
]);

export type MessageType = keyof MessageMap;
export type MessagePayload<K extends MessageType> = MessageMap[K]['payload'];
export type MessageResponse<K extends MessageType> = MessageMap[K]['response'];

export interface RuntimeMessage<K extends MessageType = MessageType> {
  type: K;
  payload: MessagePayload<K>;
}

/** Union discriminée de tous les messages possibles */
export type AnyRuntimeMessage = { [K in MessageType]: RuntimeMessage<K> }[MessageType];

const isNull = (value: unknown): value is null => value === null;
const isPositiveInt = (value: unknown): value is number => typeof value === 'number' && Number.isInteger(value) && value >= 1;
const isKey = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && value.length <= 200;

const isEpisodeCompletedPayload = (p: unknown): p is EpisodeCompletedPayload =>
  isRecord(p) &&
  isEpisodeInfo(p.episode) &&
  (p.services === null || (Array.isArray(p.services) && p.services.length > 0 && p.services.every(isTrackerId)));

const isSearchPayload = (p: unknown): p is { query: string } =>
  isRecord(p) && typeof p.query === 'string' && p.query.trim().length > 0 && p.query.length <= 100;
const isResolveReviewPayload = (p: unknown): p is ResolveReviewPayload =>
  isRecord(p) && isKey(p.key) && isPositiveInt(p.mediaId) && isPositiveInt(p.progress);
const isWatchingPayload = (p: unknown): p is { service: TrackerId } => isRecord(p) && isTrackerId(p.service);
const isAdjustProgressPayload = (p: unknown): p is AdjustProgressPayload =>
  isRecord(p) &&
  (p.mediaId === null || isPositiveInt(p.mediaId)) &&
  (p.malId === null || isPositiveInt(p.malId)) &&
  (p.mediaId !== null || p.malId !== null) &&
  (p.delta === 1 || p.delta === -1);
const isSetListStatusPayload = (p: unknown): p is SetListStatusPayload =>
  isRecord(p) &&
  (p.mediaId === null || isPositiveInt(p.mediaId)) &&
  (p.malId === null || isPositiveInt(p.malId)) &&
  (p.mediaId !== null || p.malId !== null) &&
  isListStatusChange(p.status) &&
  (p.coverUrl === null || (typeof p.coverUrl === 'string' && p.coverUrl.length <= 2000 && p.coverUrl.startsWith('https://')));
const isRetryQueuedPayload =(p: unknown): p is { id: string } => isRecord(p) && isKey(p.id);
const isRatePayload = (p: unknown): p is { media: MediaRef; score: Score10 } => isRecord(p) && isMediaRef(p.media) && isScore10(p.score);
const isDeferRatingPayload = (p: unknown): p is { media: MediaRef; coverUrl: string | null } =>
  isRecord(p) && isMediaRef(p.media) && (p.coverUrl === null || (typeof p.coverUrl === 'string' && p.coverUrl.length <= 2000));
const isRewatchPayload = (p: unknown): p is { media: MediaRef; progress: number } => isRecord(p) && isMediaRef(p.media) && isPositiveInt(p.progress);
const isMediaPayload = (p: unknown): p is { media: MediaRef } => isRecord(p) && isMediaRef(p.media);
const isReopenReviewPayload = (p: unknown): p is { key: string } => isRecord(p) && isKey(p.key);
const isResolvePageMediaPayload = (p: unknown): p is ResolvePageMediaPayload =>
  isRecord(p) && isPageMediaInfo(p.page) && (p.mediaId === null || isPositiveInt(p.mediaId));
const isAddToListPayload = (p: unknown): p is AddToListPayload =>
  isRecord(p) && isPositiveInt(p.mediaId) && (p.malId === null || isPositiveInt(p.malId)) && isAddListStatus(p.status);

const isPanelMediaPayload = (p: unknown): p is { mediaId: number } => isRecord(p) && isPositiveInt(p.mediaId);

// Record exhaustif : TypeScript impose un validateur de payload pour chaque MessageType
const PAYLOAD_GUARDS: { [K in MessageType]: (payload: unknown) => payload is MessagePayload<K> } = {
  LOGIN_ANILIST: isNull,
  GET_VIEWER: isNull,
  LOGIN_MAL: isNull,
  GET_MAL_VIEWER: isNull,
  EPISODE_COMPLETED: isEpisodeCompletedPayload,
  SEARCH_ANIME: isSearchPayload,
  RESOLVE_REVIEW: isResolveReviewPayload,
  REOPEN_REVIEW: isReopenReviewPayload,
  GET_WATCHING: isWatchingPayload,
  ADJUST_PROGRESS: isAdjustProgressPayload,
  SET_LIST_STATUS: isSetListStatusPayload,
  RETRY_QUEUED: isRetryQueuedPayload,
  RATE_MEDIA: isRatePayload,
  DEFER_RATING: isDeferRatingPayload,
  START_REWATCH: isRewatchPayload,
  DECLINE_REWATCH: isMediaPayload,
  CHECK_AIRING: isNull,
  RESOLVE_PAGE_MEDIA: isResolvePageMediaPayload,
  ADD_TO_LIST: isAddToListPayload,
  COMPARE_LISTS: isNull,
  APPLY_DIFFS: isApplyDiffsPayload,
  CANCEL_COMPARE_JOB: isNull,
  PANEL_AVAILABLE: isNull,
  GET_PANEL_MEDIA: isPanelMediaPayload,
};

/** Valide le type ET le payload d'un message reçu (les content scripts tournent sur des pages tierces). */
export function isRuntimeMessage(value: unknown): value is AnyRuntimeMessage {
  if (!isRecord(value) || typeof value.type !== 'string' || !Object.hasOwn(PAYLOAD_GUARDS, value.type)) {
    return false;
  }
  return PAYLOAD_GUARDS[value.type as MessageType](value.payload);
}

/** Envoie un message typé au service worker et retourne sa réponse typée. */
export function sendMessage<K extends MessageType>(type: K, payload: MessagePayload<K>): Promise<MessageResponse<K>> {
  const message: RuntimeMessage<K> = { type, payload };
  return chrome.runtime.sendMessage<RuntimeMessage<K>, MessageResponse<K>>(message);
}
