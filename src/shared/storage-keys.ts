import type { TrackerId } from './tracker.types';

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
  /** Import de l'historique Crunchyroll : tâche, historique réduit, correspondances, aperçu (voir cr-import.ts) */
  crImportJob: 'crImport:job',
  crImportInput: 'crImport:input',
  crImportResolutions: 'crImport:resolutions',
  crImportPlan: 'crImport:plan',
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

/** Cartes « À noter » et revisionnages refusés (voir engagement-store.ts) */
export const PENDING_RATINGS_KEY = 'pendingRatings';
export const REWATCH_DECLINED_KEY = 'rewatchDeclined';
