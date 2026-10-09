// Contrat entre la page de test (popup-frame.ts, dans le navigateur) et les tests (popup.e2e.ts, dans Node).
import type { SentMessage } from '../screenshots/mock-chrome';

/** Traces relevées par la page de test, lues par les tests via `window.__e2e` */
export interface E2EState {
  /** Messages envoyés au service worker simulé, dans l'ordre */
  messages: SentMessage[];
  /** Origines de chaque appel à chrome.permissions.request */
  permissionRequests: string[][];
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
  /** Liste « En cours » sans cache et premier GET_WATCHING sans réponse (délai d'attente raccourci) */
  watching?: 'hang';
}

/** Délai d'attente de GET_WATCHING dans la page de test avec `watching=hang` */
export const E2E_WATCHING_TIMEOUT_MS = 300;
