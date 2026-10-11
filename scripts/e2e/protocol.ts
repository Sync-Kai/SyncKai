// Contrat entre la page de test (popup-frame.ts, dans le navigateur) et les tests (popup.e2e.ts, dans Node).
import type { SentMessage } from '../screenshots/mock-chrome';

/** Traces relevées par la page de test, lues par les tests via `window.__e2e` */
export interface E2EState {
  /** Messages envoyés au service worker simulé, dans l'ordre */
  messages: SentMessage[];
  /** Origines de chaque appel à chrome.permissions.request */
  permissionRequests: string[][];
  /** Origines de chaque appel à chrome.permissions.remove */
  permissionRemovals: string[][];
  /** Textes écrits dans le presse-papiers (navigator.clipboard.writeText) */
  clipboard: string[];
}

declare global {
  interface Window {
    __e2e?: E2EState;
  }
}

/** Clé sessionStorage du stockage simulé : il survit au rechargement provoqué par un changement de langue */
export const E2E_PERSIST_KEY = 'synckai:e2e-storage';

/** Faux secrets semés dans le stockage : le rapport de diagnostic ne doit jamais les contenir */
export const PLANTED_SECRETS = {
  anilistAccess: 'e2e-anilist-access-7d3f9c1b2a',
  malAccess: 'e2e-mal-access-4b8e2d6f0c',
  malRefresh: 'e2e-mal-refresh-9a1c5e7b3d',
} as const;

/** Paramètres d'URL de popup.html */
export interface FrameParams {
  /** Écran de démo (voir scripts/screenshots/demo-data.ts) */
  scenario?: 'watching' | 'page' | 'activity' | 'compare' | 'settings';
  locale?: 'fr' | 'en' | 'de';
  /** Accès aux sites retiré (bandeau « Autoriser l'accès ») */
  hostAccess?: 'missing';
  /** Carte « Sur cette page » : série absente des deux listes */
  pageList?: 'missing';
  /**
   * Liste « En cours » sans cache, délai d'attente raccourci ; premier GET_WATCHING : `hang` sans réponse,
   * `slow` répond après le délai (E2E_WATCHING_SLOW_MS)
   */
  watching?: 'hang' | 'slow';
  /**
   * +1 / −1 : `partial` = MyAnimeList échoue, le nouvel essai (`retry`) n'écrit que MAL à la progression absolue ;
   * `slow` = réponse après E2E_ADJUST_SLOW_MS (état « envoi en cours » observable)
   */
  adjust?: 'partial' | 'slow';
  /** Carte « Sur cette page » : série ignorée (Netflix, pas un anime) */
  pageMedia?: 'untracked';
}

/** Délai d'attente de GET_WATCHING dans la page de test avec `watching=hang|slow` */
export const E2E_WATCHING_TIMEOUT_MS = 300;
/** Réponse tardive au premier GET_WATCHING avec `watching=slow` (après le délai d'attente) */
export const E2E_WATCHING_SLOW_MS = 1_500;
/** Réponse à ADJUST_PROGRESS avec `adjust=slow` */
export const E2E_ADJUST_SLOW_MS = 800;

/** Commandes du panneau latéral de test (sidepanel-frame.ts), appelées par les tests via `window.__e2ePanel` */
export interface E2EPanelControls {
  /** Les messages de ce type restent sans réponse jusqu'à `release` */
  hold: (type: string) => void;
  /** Répond aux messages retenus de ce type (et ne retient plus les suivants) */
  release: (type: string) => void;
  /** Navigation dans l'onglet suivi : la page lue devient l'épisode de démo `series` */
  navigate: (series: 'frieren' | 'dandadan') => void;
  /** chrome.tabs.onUpdated sur l'onglet suivi (fin de chargement, ou nouvelle URL après `navigate`) */
  emitUpdated: (change: 'complete' | 'url') => void;
  /** Lectures de la page par le panneau (GET_PAGE_MEDIA envoyés à l'onglet) */
  pageReads: () => number;
}

/** Paramètres d'URL de sidepanel.html */
export interface PanelFrameParams {
  locale?: 'fr' | 'en' | 'de';
  /** Onglet ouvert au démarrage */
  tab?: 'nowPlaying' | 'agenda';
  /** `none` : fiche de l'onglet absente du cache de session (RESOLVE_PAGE_MEDIA envoyé au démarrage) */
  cache?: 'none';
  /** `error` : GET_AGENDA échoue ; les sorties de la semaine en cache sont expirées */
  agenda?: 'error';
  /** Types de messages retenus dès le démarrage, séparés par des virgules (voir `hold`) */
  hold?: string;
}

declare global {
  interface Window {
    __e2ePanel?: E2EPanelControls;
  }
}
