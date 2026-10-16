// Messages envoyés au service worker : types et `sendMessage`. Importé par les scripts de contenu : uniquement des
// imports de types ici. Expéditeurs autorisés et validation des payloads : background/message-guards.ts.
import type { AgendaPayload, AgendaResult } from '../shared/agenda';
import type { AiringCheckResult } from '../shared/airing.types';
import type { AniListErrorCode, ViewerResult } from '../shared/anilist.types';
import type { AuthResult } from '../shared/auth.types';
import type { EpisodeInfo } from '../shared/episode.types';
import type { Result } from '../shared/result';
import type { CandidateSummary } from '../shared/review.types';
import type { MalViewerResult } from '../shared/mal.types';
import type { AddListStatus, ListStatusChange, SyncOutcome } from '../shared/sync.types';
import type { PageMediaResult, ResolvePageMediaPayload } from '../shared/page-media.types';
import type { PanelMediaResult } from '../shared/panel-media.types';
import type { TrackerId } from '../shared/tracker.types';
import type { WatchingResult } from '../shared/watching.types';
import type { ApplyDiffsPayload, ApplyResult, CancelJobResult, CompareResult } from '../shared/compare';
import type { MediaRef, Score10 } from '../shared/engagement.types';
import type { ListNotesResult } from '../shared/list-notes';
import type {
  CrImportAnalyzePayload,
  CrImportApplyPayload,
  CrImportJobResult,
  CrImportReviewsPayload,
  CrImportReviewsResult,
} from '../shared/cr-import';
import type { NetflixTitlesPayload, NetflixTitlesResult } from '../platforms/netflix/history';
import type { ContentCatalog } from '../i18n/content-keys';
import type { Locale } from '../i18n/locale-codes';

export interface AdjustProgressPayload {
  /** Fiche AniList (catalogue) ; null pour une entrée MAL sans équivalent AniList */
  mediaId: number | null;
  malId: number | null;
  delta: 1 | -1;
  /** Nouvel essai après un échec partiel : progression absolue écrite sur ces seuls services (sans delta) */
  retry?: AdjustRetryTarget;
}

/** Cible d'un nouvel essai de +1 / −1 (voir AdjustRetry) */
export interface AdjustRetryTarget {
  services: TrackerId[];
  progress: number;
}

export interface SetListStatusPayload {
  /** Fiche AniList (catalogue) ; null pour une entrée MAL sans équivalent AniList */
  mediaId: number | null;
  malId: number | null;
  status: ListStatusChange;
  /** Affiche de la carte « À noter » créée après « Terminé » (hôte d'images autorisé, url.ts › IMAGE_HOSTS) */
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
  /** « Ignorer » une carte « À vérifier » : retirée, puis l'épisode mis de côté pendant une correction est rejoué */
  DISMISS_REVIEW: { payload: { key: string }; response: Result<null, AniListErrorCode> };
  /**
   * Liste "en cours" d'un service (le popup affiche d'abord le cache du stockage). Sans `force`, le cache de moins de
   * 90 s est renvoyé sans requête ; `force` (« Réessayer », synchro, import) relit toujours la liste.
   */
  GET_WATCHING: { payload: { service: TrackerId; force?: boolean }; response: WatchingResult };
  /** +1 / −1 manuel depuis le popup, écrit sur tous les services connectés où la série existe */
  ADJUST_PROGRESS: { payload: AdjustProgressPayload; response: SyncOutcome };
  /** En pause / Abandonné / Terminé depuis le popup, écrit sur tous les services connectés où la série est dans la liste */
  SET_LIST_STATUS: { payload: SetListStatusPayload; response: SyncOutcome };
  /** « Réessayer » sur une synchro en échec de la file (Activité) */
  RETRY_QUEUED: { payload: { id: string }; response: SyncOutcome };
  /**
   * Note sur 10 (pas 0,5), convertie et écrite sur chaque service connecté ; retire la carte « À noter ».
   * `fromCard` : depuis la carte, écrite seulement sur les sessions où elle a été créée.
   */
  RATE_MEDIA: { payload: { media: MediaRef; score: Score10; fromCard?: boolean }; response: SyncOutcome };
  /** « Retirer de la liste » (popup, panneau) : retire la série de chaque service connecté où elle est */
  REMOVE_FROM_LIST: { payload: { media: MediaRef }; response: SyncOutcome };
  /** Éditeur de commentaire du popup : commentaire d'AniList si la série y est, sinon de MyAnimeList */
  GET_LIST_NOTES: { payload: { media: MediaRef }; response: ListNotesResult };
  /** Commentaire écrit sur chaque service connecté où la série est dans la liste ("" l'efface ; absente : jamais ajoutée) */
  SET_LIST_NOTES: { payload: { media: MediaRef; notes: string }; response: SyncOutcome };
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
  /** Correspondances modifiées par une page (« Oublier », restauration d'une sauvegarde) : résolutions de page en mémoire oubliées */
  MAPPINGS_CHANGED: { payload: null; response: null };
  /** « À regarder » / « En cours » depuis la fiche de la page : seulement là où la série n'est pas déjà dans la liste */
  ADD_TO_LIST: { payload: AddToListPayload; response: SyncOutcome };
  /** Activité › Écarts : lit les listes complètes AniList et MAL et calcule les écarts (rien n'est écrit) */
  COMPARE_LISTS: { payload: null; response: CompareResult };
  /** Lance l'alignement des séries choisies sur `source` (tâche en arrière-plan, progression dans compare:job) */
  APPLY_DIFFS: { payload: ApplyDiffsPayload; response: ApplyResult };
  /** « Arrêter » l'alignement en cours (la série en cours se termine) */
  CANCEL_COMPARE_JOB: { payload: null; response: CancelJobResult };
  /** Panneau latéral › « En lecture » : fiche AniList complète (synopsis, genres, studio, relations), cache de session */
  GET_PANEL_MEDIA: { payload: { mediaId: number }; response: PanelMediaResult };
  /** Agenda (panneau latéral) : sorties d'une semaine, lues sur AniList quand le cache du panneau manque ou a expiré */
  GET_AGENDA: { payload: AgendaPayload; response: AgendaResult };
  /** Import Crunchyroll : historique lu dans l'onglet Crunchyroll → analyse en tâche de fond (rien n'est écrit) */
  CR_IMPORT_ANALYZE: { payload: CrImportAnalyzePayload; response: CrImportJobResult };
  /** Import Crunchyroll : applique les éléments cochés de l'aperçu (tâche de fond) */
  CR_IMPORT_APPLY: { payload: CrImportApplyPayload; response: CrImportJobResult };
  /** « Arrêter » l'analyse ou l'application en cours */
  CR_IMPORT_CANCEL: { payload: null; response: Result<null, 'NOT_FOUND'> };
  /** Crée les cartes « À vérifier » des saisons incertaines choisies */
  CR_IMPORT_REVIEWS: { payload: CrImportReviewsPayload; response: CrImportReviewsResult };
  /** Import Netflix : filtre « anime » de titres de l'historique (recherches AniList, rien n'est écrit) */
  NETFLIX_IMPORT_TITLES: { payload: NetflixTitlesPayload; response: NetflixTitlesResult };
  /**
   * Script de contenu (anglais seul embarqué) : textes de ses clés (CONTENT_KEYS) dans `locale`, tirés du catalogue chargé
   * par le service worker ; null si le catalogue est introuvable (le script reste en anglais)
   */
  GET_CONTENT_CATALOG: { payload: { locale: Locale }; response: ContentCatalog | null };
}

export type MessageType = keyof MessageMap;
export type MessagePayload<K extends MessageType> = MessageMap[K]['payload'];
export type MessageResponse<K extends MessageType> = MessageMap[K]['response'];

export interface RuntimeMessage<K extends MessageType = MessageType> {
  type: K;
  payload: MessagePayload<K>;
}

/** Union discriminée de tous les messages possibles */
export type AnyRuntimeMessage = { [K in MessageType]: RuntimeMessage<K> }[MessageType];

/** Envoie un message typé au service worker et retourne sa réponse typée. */
export async function sendMessage<K extends MessageType>(type: K, payload: MessagePayload<K>): Promise<MessageResponse<K>> {
  const message: RuntimeMessage<K> = { type, payload };
  const response: MessageResponse<K> | undefined = await chrome.runtime.sendMessage<RuntimeMessage<K>, MessageResponse<K>>(message);
  // Message refusé ou resté sans réponse : erreur explicite plutôt qu'un `undefined` qui ferait planter l'appelant
  if (response === undefined) throw new Error(`Aucune réponse du service worker (${type})`);
  return response;
}
