import type { TrackerId } from '../shared/tracker.types';

// Clés de chrome.storage.local : module feuille (aucune dépendance de valeur), importable par les types,
// les gardes et les stores sans tirer le module d'accès au stockage.

/** Clés utilisées dans chrome.storage.local */
export const STORAGE_KEYS = {
  anilistToken: 'anilistToken',
  anilistViewer: 'anilistViewer',
  /** Lecture du profil AniList en cache (ms) : pas de nouvelle requête à chaque ouverture (PERF-04) */
  anilistViewerAt: 'anilistViewerAt',
  mediaMappings: 'mediaMappings',
  pendingReviews: 'pendingReviews',
  recentSyncs: 'recentSyncs',
  malToken: 'malToken',
  malViewer: 'malViewer',
  /** Lecture du profil MAL en cache (ms) */
  malViewerAt: 'malViewerAt',
  watchingCache: 'watchingCache',
  /** Génération de session par service, incrémentée à chaque déconnexion (voir saveCachedWatching et session-epochs.ts) */
  sessionEpoch: 'sessionEpoch',
  /** Dernière comparaison AniList ↔ MAL (Activité › Écarts) */
  compareLast: 'compare:last',
  /** Tâche d'analyse ou d'alignement en cours (progression, reprise) */
  compareJob: 'compare:job',
  /** Éléments de cette tâche, écrits une fois au démarrage (la tâche n'en garde que le curseur, PERF-16) */
  compareJobItems: 'compare:job:items',
  /** Import de l'historique Crunchyroll : tâche, historique réduit, correspondances, aperçu (voir cr-import.ts) */
  crImportJob: 'crImport:job',
  crImportJobItems: 'crImport:job:items',
  crImportInput: 'crImport:input',
  crImportResolutions: 'crImport:resolutions',
  crImportPlan: 'crImport:plan',
  /** Purge des correspondances vers une autre série de la plateforme (SYNC-01) à faire : 'pending', absente sinon */
  otherSeriesPurge: 'migrations:purgeOtherSeries',
  /**
   * Barre d'état : dernière fois (ms) où l'utilisateur a vu « Synchro terminée » / « Import terminé » (× ou clic sur le
   * message), écrites par les pages (ui/status-bar-source.ts). Dans local : le popup se ferme sans perdre la marque
   */
  syncsSeenAt: 'statusBar:syncsSeenAt',
  importSeenAt: 'statusBar:importSeenAt',
  /**
   * « Synchro cette semaine » du menu du compte : `{ [service]: { weekStart, count, epoch } }`, épisodes synchronisés
   * vers chaque service pendant la semaine en cours (shared/weekly-syncs.ts), écrit par le service worker
   */
  weeklySyncs: 'accountMenu:weeklySyncs',
} as const;

/**
 * Session invalidée par le service (token refusé, renouvellement MAL impossible) : « Session expirée » dans
 * l'interface plutôt que « Non connecté » (AUTH-03). Effacé par une déconnexion volontaire et par une connexion réussie.
 */
export const SESSION_EXPIRED_KEYS: Readonly<Record<TrackerId, string>> = {
  anilist: 'sessionExpired:anilist',
  mal: 'sessionExpired:mal',
};

/** File de synchro hors ligne (voir sync-queue-store.ts) */
export const SYNC_QUEUE_KEY = 'syncQueue';

/** Épisodes terminés récents par onglet et par série, dans chrome.storage.session (limite de débit, background/sync/episode-rate.ts) */
export const EPISODE_RATE_KEY = 'episodeRate';

/**
 * « Synchro… » de la barre d'état, dans chrome.storage.session : `{ startedAt }` posé par le service worker pendant les
 * écritures d'une synchro et retiré après (browser/storage/sync-activity.ts) ; les pages l'ignorent passé une minute
 */
export const SYNC_ACTIVITY_KEY = 'syncActivity';

/** Écran demandé au popup ouvert depuis le panneau latéral (Activité), dans chrome.storage.session, lu une fois (browser/popup-screen.ts) */
export const POPUP_SCREEN_KEY = 'popupScreen';

/** Cartes « À noter » et revisionnages refusés (voir engagement-store.ts) */
export const PENDING_RATINGS_KEY = 'pendingRatings';
export const REWATCH_DECLINED_KEY = 'rewatchDeclined';

/**
 * Diagnostic des correspondances (builds de dev seulement, voir background/sync/match-diagnostic.ts) : 50 dernières
 * décisions, dans chrome.storage.session (jamais local). Constante à part (pas dans STORAGE_KEYS) : absente des bundles publiés.
 */
export const MATCH_DIAGNOSTIC_KEY = 'debug:matchDiagnostic';

/**
 * Trace de débogage (builds de dev seulement, voir shared/debug-trace.ts) : événements et mode détaillé, dans
 * chrome.storage.session (jamais local), écrits par le service worker seul. Constantes à part, absentes des bundles publiés.
 */
export const DEBUG_TRACE_KEY = 'debug:trace';
export const DEBUG_TRACE_VERBOSE_KEY = 'debug:trace:verbose';
