import type { PendingRating } from '../shared/engagement.types';
import type { PendingReview, RecentSync } from '../shared/review.types';
import type { SyncQueueItem } from '../shared/queue.types';
import type { SyncSettings } from '../shared/settings';
import type { PageMediaInfo, PageMediaView } from '../shared/page-media.types';
import type { ListStatusChange } from '../shared/sync.types';
import type { TrackerId } from '../shared/tracker.types';
import type { WatchingList, WatchingSort } from '../shared/watching.types';
import type { ComparisonResult, DiffFilter } from '../shared/compare';
import type { CompareJob } from '../shared/compare-job';
import type { MediaAction } from '../ui/media-actions';
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
  /** Source préférée de la liste « En cours » (utilisée seulement si les deux services sont connectés) */
  source: TrackerId;
  /** Tri de « Mes séries » (persisté avec la source) */
  sort: WatchingSort;
  /** Menu de tri ouvert : conservé dans l'état pour survivre aux nouveaux rendus */
  sortMenuOpen: boolean;
  /** Menu « … » ouvert sur une série de « En cours » (clé d'entrée) : un seul à la fois */
  rowMenu: string | null;
  /** Confirmation affichée dans le menu « … » ouvert (Abandonner, Terminé), null sinon */
  rowConfirm: ListStatusChange | null;
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

/** Fiche de la page de l'onglet actif (carte « Sur cette page ») */
export type PageMediaState =
  /** Onglet hors page de série / d'épisode reconnue : carte « Reprendre » habituelle */
  | { status: 'none' }
  | { status: 'loading'; page: PageMediaInfo }
  /** `refreshing` : relecture après une action (la fiche reste affichée) */
  | { status: 'ready'; page: PageMediaInfo; view: PageMediaView; refreshing: boolean }
  | { status: 'error'; page: PageMediaInfo; message: string }
  /** Série ignorée (Netflix, pas un anime) : mention neutre, sans « Réessayer » */
  | { status: 'untracked'; page: PageMediaInfo; message: string };

/** Action en cours sur la carte « Sur cette page » (une seule à la fois) */
export type PageCardAction = MediaAction;

export interface PageCardState {
  media: PageMediaState;
  busy: PageCardAction | null;
  /** Confirmation affichée (Abandonner, Terminé), null sinon */
  confirm: ListStatusChange | null;
  /** Retour de la dernière action (affiché quelques secondes) */
  feedback: InlineFeedback | null;
}

/** Activité › « Écarts AniList ↔ MAL » (dernière analyse et tâche en cours, lues du stockage) */
export interface CompareState {
  result: ComparisonResult | null;
  /** Analyse ou alignement en cours / dernier alignement terminé (bilan) */
  job: CompareJob | null;
  /** Demande envoyée au service worker, réponse pas encore reçue */
  requesting: 'analyze' | 'apply' | null;
  /** Erreur de l'analyse ou du lancement d'un alignement (affichée en alerte) */
  error: string | null;
  /** Confirmation « Tout aligner sur … » affichée */
  confirm: TrackerId | null;
  filter: DiffFilter;
  /** Nombre de lignes affichées (« Afficher plus ») */
  shown: number;
}

/** Accès aux sites (Firefox : retirables par l'utilisateur) ; `denied` = dernière demande refusée */
export type HostAccessState = { status: 'unknown' } | { status: 'granted' } | { status: 'missing'; denied: boolean };
