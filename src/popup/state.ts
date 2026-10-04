import type { AniListViewer } from '../shared/anilist.types';
import type { PendingRating } from '../shared/engagement.types';
import type { MalViewer } from '../shared/mal.types';
import type { PendingReview, RecentSync } from '../shared/review.types';
import type { ExcludedSeries } from '../shared/exclusions';
import type { SyncQueueItem } from '../shared/queue.types';
import type { SyncSettings } from '../shared/settings';
import type { FeedbackTone } from '../shared/sync-feedback';
import type { ListStatusChange } from '../shared/sync.types';
import type { TrackerId } from '../shared/tracker.types';
import type { WatchingList, WatchingSort } from '../shared/watching.types';

/** État de connexion d'un compte (AniList, MyAnimeList) : chaque vue est une fonction pure de cet état. */
export type AccountState<Viewer> =
  | { status: 'loading' }
  /** expired = la session a été invalidée (token expiré ou refusé) : « Reconnecter » */
  | { status: 'logged-out'; pending: boolean; error: string | null; expired: boolean }
  /** viewer à null = profil pas encore chargé (affichage skeleton) */
  | { status: 'logged-in'; viewer: Viewer | null; error: string | null };

export type AniListState = AccountState<AniListViewer>;
export type MalState = AccountState<MalViewer>;

export const LOGGED_OUT = { status: 'logged-out', pending: false, error: null, expired: false } as const;

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

/** Retour bref affiché sur une ligne après une action (+1, −1, réessai…) */
export interface InlineFeedback {
  tone: FeedbackTone;
  text: string;
  /** Détail complet (infobulle) : le texte affiché est tronqué */
  detail: string;
}

/** Action en cours ou terminée sur une série de « En cours » */
/** `kind` : `status` = changement de statut en cours (pastille « Mise à jour… ») */
export type EntryAction = { phase: 'pending'; kind: 'adjust' | 'status' } | { phase: 'done'; feedback: InlineFeedback };

/** Séries exclues (Réglages › Séries exclues, pastille « Exclue ») */
export type ExclusionsState = { status: 'loading' } | { status: 'ready'; items: ExcludedSeries[] } | { status: 'error' };

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

type Listener<T> = (state: T) => void;

export interface Store<T> {
  get(): T;
  set(next: T): void;
  subscribe(listener: Listener<T>): () => void;
}

export function createStore<T>(initial: T): Store<T> {
  let state = initial;
  const listeners = new Set<Listener<T>>();

  return {
    get: () => state,
    set(next) {
      state = next;
      listeners.forEach((listener) => listener(state));
    },
    subscribe(listener) {
      listeners.add(listener);
      listener(state);
      return () => listeners.delete(listener);
    },
  };
}

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
