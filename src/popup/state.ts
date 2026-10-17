import type { PendingRating } from '../shared/engagement.types';
import type { PendingReview, RecentSync } from '../shared/review.types';
import type { SyncQueueItem } from '../shared/queue.types';
import type { SyncSettings } from '../shared/settings';
import type { TrackerId } from '../shared/tracker.types';
import type { WatchingList, WatchingSort } from '../shared/watching.types';
import type { MediaActionsState } from '../ui/media-actions';
import type { PageMediaContent } from '../ui/page-media-controller';
import type { InlineFeedback } from '../ui/state';

/** Données de synchronisation lues depuis le stockage (vérifications, dernières synchros). */
export interface SyncData {
  reviews: PendingReview[];
  recentSyncs: RecentSync[];
  /** Clé de la synchro dont la correction est en cours de chargement */
  busyKey: string | null;
  recentError: string | null;
}

export type Screen = 'watching' | 'activity' | 'settings';

export interface UiState {
  screen: Screen;
  /** Écran à retrouver en quittant les réglages */
  previous: Exclude<Screen, 'settings'>;
}

/**
 * Préférences de « En cours », enregistrées dans le stockage (`popupPrefs`). La source (sélecteur AniList / MAL retiré)
 * suit désormais le réglage « Fiche ouverte par défaut » ; un ancien `source` enregistré est ignoré
 */
export interface WatchingPrefs {
  /** Tri de « Mes séries » */
  sort: WatchingSort;
}

/** Action en cours ou terminée sur une série de « En cours » */
/** `kind` : `status` = changement de statut en cours (pastille « Mise à jour… ») */
export type EntryAction = { phase: 'pending'; kind: 'adjust' | 'status' } | { phase: 'done'; feedback: InlineFeedback };

/** File de synchro (Activité › Synchros en attente) */
export interface QueueState {
  items: SyncQueueItem[];
  /** Éléments dont le réessai ou l'abandon est en cours */
  busyIds: ReadonlySet<string>;
  /** Résultat du dernier réessai (l'élément a pu quitter la file entre-temps) */
  notice: InlineFeedback | null;
  error: string | null;
}

/** Liste « En cours » : cache affiché immédiatement puis revalidé (stale-while-revalidate). */
export type WatchingState =
  | { status: 'idle' }
  /** Aucun cache : skeleton */
  | { status: 'loading'; service: TrackerId }
  | { status: 'ready'; service: TrackerId; list: WatchingList; refreshing: boolean; error: string | null }
  | { status: 'error'; service: TrackerId; message: string };

export type SettingsState = { status: 'loading' } | { status: 'ready'; settings: SyncSettings } | { status: 'error' };

/** Activité › « À noter » (notes de fin de série reportées) */
export interface RatingsState {
  items: PendingRating[];
  /** Cartes dont la note est en cours d'envoi */
  busyIds: ReadonlySet<string>;
  /** Échec du dernier envoi, par carte */
  errors: ReadonlyMap<string, string>;
  /** Confirmation de la dernière note (la carte a quitté la liste) */
  notice: InlineFeedback | null;
  error: string | null;
}

/** Carte « Sur cette page » : fiche de l'onglet actif (contrôleur partagé avec le panneau) et actions en cours */
export interface PageCardState {
  content: PageMediaContent<never>;
  actions: MediaActionsState;
}

/** Accès aux sites (Firefox : retirables par l'utilisateur) ; `denied` = dernière demande refusée */
export type HostAccessState = { status: 'unknown' } | { status: 'granted' } | { status: 'missing'; denied: boolean };
