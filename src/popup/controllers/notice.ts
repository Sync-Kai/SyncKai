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
  /**
   * Pointeur ou focus dans le bandeau : délai suspendu (« Annuler » ne disparaît pas sous le doigt), le temps restant
   * reprend à la sortie (comme les toasts de la page, content/ui/toast.ts › createToastTimer)
   */
  hold(reason: NoticeHold, held: boolean): void;
  dispose(): void;
}

export type NoticeHold = 'pointer' | 'focus';

/** Bandeau unique de l'écran, partagé par la liste et le groupe « En sommeil » (une seule minuterie) */
export function createNoticeBanner(onShown: () => void): NoticeBanner {
  const store = createStore<WatchingNotice | null>(null);
  let timer: ReturnType<typeof setTimeout> | undefined;
  /** Délai restant du bandeau affiché (undefined : aucun bandeau) ; décompté seulement hors pause */
  let remaining: number | undefined;
  let startedAt = 0;
  let running = false;
  const holds = new Set<NoticeHold>();
  const sync = (): void => {
    const run = remaining !== undefined && holds.size === 0;
    if (run === running) return;
    running = run;
    if (run) {
      startedAt = Date.now();
      timer = setTimeout(hide, remaining);
    } else {
      clearTimeout(timer);
      if (remaining !== undefined) remaining = Math.max(0, remaining - (Date.now() - startedAt));
    }
  };
  function hide(): void {
    clearTimeout(timer);
    running = false;
    remaining = undefined;
    // Bandeau retiré du DOM : ni pointerleave ni focusout ne viendront
    holds.clear();
    store.set(null);
  }
  return {
    store,
    show(feedback, { retry = null, undo = null } = {}) {
      clearTimeout(timer);
      running = false;
      store.set({ feedback, retry, undo });
      onShown();
      remaining = feedback.tone === 'success' && undo === null ? NOTICE_MS : NOTICE_MS * 2;
      sync();
    },
    hide,
    dropUndo() {
      const shown = store.get();
      if (shown?.undo) store.set({ ...shown, undo: null });
    },
    hold(reason, held) {
      if (held) holds.add(reason);
      else holds.delete(reason);
      sync();
    },
    dispose() {
      clearTimeout(timer);
    },
  };
}
