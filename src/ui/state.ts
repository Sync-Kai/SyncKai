import type { AniListViewer } from '../shared/anilist.types';
import type { ExcludedSeries } from '../shared/exclusions';
import type { MalViewer } from '../shared/mal.types';
import type { FeedbackTone } from '../shared/sync-feedback';
import type { AdjustRetry } from '../shared/sync.types';

// État commun aux interfaces (popup, panneau latéral, réglages) : store minimal et types partagés.

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

/** Retour bref affiché sur une ligne après une action (+1, −1, réessai…) */
export interface InlineFeedback {
  tone: FeedbackTone;
  text: string;
  /** Détail complet (infobulle) : le texte affiché est tronqué */
  detail: string;
  /** +1 / −1 en échec partiel : bouton « Réessayer » (progression absolue sur les seuls services en échec) */
  retry?: AdjustRetry;
}

/** Séries exclues (Réglages › Séries exclues, pastille « Exclue ») */
export type ExclusionsState = { status: 'loading' } | { status: 'ready'; items: ExcludedSeries[] } | { status: 'error' };

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
