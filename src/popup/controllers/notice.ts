import { createStore, type InlineFeedback, type Store } from '../../ui/state';

/** Durée d'affichage d'un bandeau de retour (réessai, note envoyée, changement de statut) ; un échec reste le double */
export const NOTICE_MS = 5_000;

/**
 * Bandeau en haut de « En cours » ; `retry` : « Réessayer » (+1 / −1 ou action en sommeil en échec partiel) ; `undo` :
 * « Annuler » d'une action sur les séries en sommeil (rétablit ce qui vient d'être écrit, tant que le bandeau est affiché)
 */
export interface WatchingNotice {
  feedback: InlineFeedback;
  retry: (() => void) | null;
  undo: (() => void) | null;
}

export interface NoticeBanner {
  readonly store: Store<WatchingNotice | null>;
  /** Remplace le bandeau affiché ; masqué au bout du délai (le double pour un échec ou un « Annuler » à cliquer) */
  show(feedback: InlineFeedback, actions?: { retry?: (() => void) | null; undo?: (() => void) | null }): void;
  hide(): void;
  /** Retire « Annuler » du bandeau affiché (texte et délai inchangés) : ce qu'il rétablirait ne vaut plus */
  dropUndo(): void;
  dispose(): void;
}

/** Bandeau unique de l'écran, partagé par la liste et le groupe « En sommeil » (une seule minuterie) */
export function createNoticeBanner(onShown: () => void): NoticeBanner {
  const store = createStore<WatchingNotice | null>(null);
  let timer: ReturnType<typeof setTimeout> | undefined;
  const hide = (): void => {
    clearTimeout(timer);
    store.set(null);
  };
  return {
    store,
    show(feedback, { retry = null, undo = null } = {}) {
      clearTimeout(timer);
      store.set({ feedback, retry, undo });
      onShown();
      timer = setTimeout(hide, feedback.tone === 'success' && undo === null ? NOTICE_MS : NOTICE_MS * 2);
    },
    hide,
    dropUndo() {
      const shown = store.get();
      if (shown?.undo) store.set({ ...shown, undo: null });
    },
    dispose() {
      clearTimeout(timer);
    },
  };
}
