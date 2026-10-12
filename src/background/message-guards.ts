// Contrôle des messages reçus par le service worker (seul importateur) : expéditeurs autorisés et validation des
// payloads. Hors du graphe des scripts de contenu, qui n'ont besoin que de `sendMessage` et des types
// (shared/messages.ts) : les gardes de tous les payloads (import, comparaison, agenda…) n'alourdissent pas les pages.
import { isAgendaPayload } from '../shared/agenda';
import { isApplyDiffsPayload } from '../shared/compare';
import { isCrImportAnalyzePayload, isCrImportApplyPayload, isCrImportReviewsPayload } from '../shared/cr-import';
import { isMediaRef, isScore10, type MediaRef, type Score10 } from '../shared/engagement.types';
import { isEpisodeInfo } from '../shared/episode.types';
import { isListNotesText } from '../shared/list-notes';
import { isNetflixTitlesPayload } from '../shared/netflix-import';
import { isRecord } from '../shared/guards';
import type {
  AddToListPayload,
  AdjustProgressPayload,
  AdjustRetryTarget,
  AnyRuntimeMessage,
  EpisodeCompletedPayload,
  MessagePayload,
  MessageType,
  ResolveReviewPayload,
  SetListStatusPayload,
} from '../shared/messages';
import { isPageMediaInfo, type ResolvePageMediaPayload } from '../shared/page-media.types';
import { isAddListStatus, isListStatusChange } from '../shared/sync.types';
import { isTrackerId, type TrackerId } from '../shared/tracker.types';
import { isSafeImageUrl } from '../shared/url';

/** Expéditeur d'un message : page de l'extension (popup, panneau, réglages, pages d'import) ou script de contenu */
export type MessageOrigin = 'content' | 'extension';

/**
 * Expéditeurs autorisés de chaque message (ARCH-07) : liste d'autorisation exhaustive, imposée par le compilateur comme
 * PAYLOAD_GUARDS. Un nouveau type doit choisir son origine ; le service worker refuse tout message venu d'ailleurs.
 * Les scripts de contenu tournent sur des pages tierces (Crunchyroll, ADN, Netflix) : seuls les messages de lecture
 * et d'engagement leur sont ouverts (types envoyés depuis src/content, vérifiés par message-guards.test.ts).
 */
export const MESSAGE_ORIGINS: { [K in MessageType]: MessageOrigin | 'both' } = {
  LOGIN_ANILIST: 'extension',
  GET_VIEWER: 'extension',
  LOGIN_MAL: 'extension',
  GET_MAL_VIEWER: 'extension',
  EPISODE_COMPLETED: 'content',
  SEARCH_ANIME: 'extension',
  RESOLVE_REVIEW: 'extension',
  REOPEN_REVIEW: 'extension',
  DISMISS_REVIEW: 'extension',
  GET_WATCHING: 'extension',
  ADJUST_PROGRESS: 'extension',
  SET_LIST_STATUS: 'extension',
  RETRY_QUEUED: 'extension',
  // Popup (carte « À noter », « Sur cette page ») et invite de fin d'épisode
  RATE_MEDIA: 'both',
  // Popup (menu « ⋯ » de « En cours ») et panneau (« Ta progression ») uniquement : jamais depuis une page tierce
  REMOVE_FROM_LIST: 'extension',
  GET_LIST_NOTES: 'extension',
  SET_LIST_NOTES: 'extension',
  DEFER_RATING: 'content',
  START_REWATCH: 'content',
  DECLINE_REWATCH: 'content',
  CHECK_AIRING: 'extension',
  RESOLVE_PAGE_MEDIA: 'extension',
  ADD_TO_LIST: 'extension',
  COMPARE_LISTS: 'extension',
  APPLY_DIFFS: 'extension',
  CANCEL_COMPARE_JOB: 'extension',
  PANEL_AVAILABLE: 'content',
  GET_PANEL_MEDIA: 'extension',
  GET_AGENDA: 'extension',
  CR_IMPORT_ANALYZE: 'extension',
  CR_IMPORT_APPLY: 'extension',
  CR_IMPORT_CANCEL: 'extension',
  CR_IMPORT_REVIEWS: 'extension',
  NETFLIX_IMPORT_TITLES: 'extension',
};

/** Le message `type` est accepté depuis cet expéditeur */
export function isAllowedOrigin(type: MessageType, origin: MessageOrigin): boolean {
  const allowed = MESSAGE_ORIGINS[type];
  return allowed === 'both' || allowed === origin;
}

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
const isWatchingPayload = (p: unknown): p is { service: TrackerId; force?: boolean } =>
  isRecord(p) && isTrackerId(p.service) && (p.force === undefined || typeof p.force === 'boolean');
const isAdjustRetryTarget = (r: unknown): r is AdjustRetryTarget =>
  isRecord(r) &&
  Array.isArray(r.services) &&
  r.services.length > 0 &&
  r.services.every(isTrackerId) &&
  new Set(r.services).size === r.services.length &&
  typeof r.progress === 'number' &&
  Number.isInteger(r.progress) &&
  r.progress >= 0 &&
  r.progress <= 100_000;
const isAdjustProgressPayload = (p: unknown): p is AdjustProgressPayload =>
  isRecord(p) &&
  (p.mediaId === null || isPositiveInt(p.mediaId)) &&
  (p.malId === null || isPositiveInt(p.malId)) &&
  (p.mediaId !== null || p.malId !== null) &&
  (p.delta === 1 || p.delta === -1) &&
  (p.retry === undefined || isAdjustRetryTarget(p.retry));
const isSetListStatusPayload = (p: unknown): p is SetListStatusPayload =>
  isRecord(p) &&
  (p.mediaId === null || isPositiveInt(p.mediaId)) &&
  (p.malId === null || isPositiveInt(p.malId)) &&
  (p.mediaId !== null || p.malId !== null) &&
  isListStatusChange(p.status) &&
  (p.coverUrl === null || isSafeImageUrl(p.coverUrl));
const isRetryQueuedPayload =(p: unknown): p is { id: string } => isRecord(p) && isKey(p.id);
const isRatePayload = (p: unknown): p is { media: MediaRef; score: Score10; fromCard?: boolean } =>
  isRecord(p) && isMediaRef(p.media) && isScore10(p.score) && (p.fromCard === undefined || typeof p.fromCard === 'boolean');
const isDeferRatingPayload = (p: unknown): p is { media: MediaRef; coverUrl: string | null } =>
  isRecord(p) && isMediaRef(p.media) && (p.coverUrl === null || isSafeImageUrl(p.coverUrl));
const isRewatchPayload = (p: unknown): p is { media: MediaRef; progress: number } => isRecord(p) && isMediaRef(p.media) && isPositiveInt(p.progress);
const isMediaPayload = (p: unknown): p is { media: MediaRef } => isRecord(p) && isMediaRef(p.media);
const isListNotesPayload = (p: unknown): p is { media: MediaRef; notes: string } => isRecord(p) && isMediaRef(p.media) && isListNotesText(p.notes);
/** Payload { key } d'une carte « À vérifier » (REOPEN_REVIEW, DISMISS_REVIEW) */
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
  DISMISS_REVIEW: isReopenReviewPayload,
  GET_WATCHING: isWatchingPayload,
  ADJUST_PROGRESS: isAdjustProgressPayload,
  SET_LIST_STATUS: isSetListStatusPayload,
  RETRY_QUEUED: isRetryQueuedPayload,
  RATE_MEDIA: isRatePayload,
  REMOVE_FROM_LIST: isMediaPayload,
  GET_LIST_NOTES: isMediaPayload,
  SET_LIST_NOTES: isListNotesPayload,
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
  GET_AGENDA: isAgendaPayload,
  CR_IMPORT_ANALYZE: isCrImportAnalyzePayload,
  CR_IMPORT_APPLY: isCrImportApplyPayload,
  CR_IMPORT_CANCEL: isNull,
  CR_IMPORT_REVIEWS: isCrImportReviewsPayload,
  NETFLIX_IMPORT_TITLES: isNetflixTitlesPayload,
};

/** Valide le type ET le payload d'un message reçu (les content scripts tournent sur des pages tierces). */
export function isRuntimeMessage(value: unknown): value is AnyRuntimeMessage {
  if (!isRecord(value) || typeof value.type !== 'string' || !Object.hasOwn(PAYLOAD_GUARDS, value.type)) {
    return false;
  }
  return PAYLOAD_GUARDS[value.type as MessageType](value.payload);
}

/**
 * Expéditeur = page de l'extension (popup, panneau, pages d'import ouvertes dans un onglet) et non un
 * content script (voir MESSAGE_ORIGINS). `sender.tab` ne suffit pas : une page de l'extension ouverte dans un onglet en a un.
 * `extensionOrigin` : chrome.runtime.getURL('') (chrome-extension://<id>/ ou moz-extension://<uuid>/).
 */
export function isExtensionPageSender(sender: { url?: string }, extensionOrigin: string): boolean {
  return typeof sender.url === 'string' && sender.url.startsWith(extensionOrigin);
}
