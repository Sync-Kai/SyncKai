// Suggestions « Pour toi » (popup, panneau) : un lot reçu du service worker, tiré localement (drawNext) sans jamais
// répéter une fiche de la page. Un contrôleur par page ; aucune écoute du DOM, `dispose()` coupe la minuterie d'« Annuler ».
import { drawNext, type RecoItem, type RecoBatch } from '../shared/recommendations';
import { createStore, type ReadonlyStore } from './state';
import { addToPlanning, sequelAddResult } from './sequel-actions';
import { callWorker } from './worker-call';

/** Tirages précédents gardés (« Déjà tirées ») */
export const PREVIOUS_KEPT = 8;
/** Durée du bouton « Annuler » après « Pas intéressé » */
export const UNDO_MS = 5000;

export type RecoView =
  /** `none` : aucun compte connecté */
  | { status: 'loading' | 'error' | 'empty' | 'none'; message?: string }
  | { status: 'ready'; current: RecoItem; previous: RecoItem[]; cold: boolean; malOnly: boolean; added: boolean; dismissedTitle: string | null; addError?: string };

export interface RecoController {
  readonly store: ReadonlyStore<RecoView>;
  another(): void;
  add(): Promise<void>;
  dismiss(): Promise<void>;
  undo(): Promise<void>;
  retry(): void;
  /** « Revoir les écartées » : les écartées reviennent, le lot est recalculé */
  restore(): Promise<void>;
  dispose(): void;
}

export function createRecoController(): RecoController {
  const store = createStore<RecoView>({ status: 'loading' });
  let batch: RecoBatch | null = null;
  let malOnly = false;
  /** Fiches déjà tirées sur cette page (jamais retirées deux fois) */
  let drawn = new Set<number>();
  let previous: RecoItem[] = [];
  let timer: ReturnType<typeof setTimeout> | null = null;
  /** Incrémenté à chaque chargement et à la fin : une réponse d'un chargement dépassé est ignorée */
  let generation = 0;
  let disposed = false;

  const stopTimer = (): void => {
    if (timer !== null) clearTimeout(timer);
    timer = null;
  };

  const ready = (): Extract<RecoView, { status: 'ready' }> | null => {
    const view = store.get();
    return view.status === 'ready' ? view : null;
  };

  /** Tire la suivante hors des fiches déjà tirées ; plus aucune : état vide */
  function draw(): void {
    const next = batch ? drawNext(batch, drawn, Math.random) : null;
    if (!batch || !next) {
      store.set({ status: 'empty' });
      return;
    }
    drawn.add(next.card.id);
    store.set({ status: 'ready', current: next, previous, cold: batch.cold, malOnly, added: false, dismissedTitle: null });
  }

  async function load(retried: boolean): Promise<void> {
    const run = ++generation;
    const result = await callWorker('GET_RECOMMENDATIONS', {}, (message) => ({ ok: false as const, code: 'FAILED' as const, message }));
    if (run !== generation || disposed) return;
    if (result.ok) {
      batch = result.batch;
      malOnly = result.malOnly;
      draw();
    } else if (result.code === 'NO_ACCOUNT') {
      store.set({ status: 'none' });
    } else if (result.code === 'SESSION_CHANGED' && !retried) {
      // Compte changé pendant le calcul : une seule relance, sans rien afficher
      await load(true);
    } else {
      store.set({ status: 'error', message: result.message });
    }
  }

  function reset(): void {
    stopTimer();
    batch = null;
    drawn = new Set();
    previous = [];
    store.set({ status: 'loading' });
  }

  void load(false);

  return {
    store,
    another() {
      const view = ready();
      if (!view) return;
      stopTimer();
      previous = [view.current, ...previous].slice(0, PREVIOUS_KEPT);
      draw();
    },
    async add() {
      const view = ready();
      if (!view || view.added) return;
      const { card } = view.current;
      const outcome = await addToPlanning({ mediaId: card.id, malId: card.idMal });
      const result = sequelAddResult(outcome, '');
      const now = ready();
      if (disposed || !now || now.current.card.id !== card.id) return;
      if (result.kind === 'failed') {
        store.set({ ...now, addError: result.message });
        return;
      }
      await callWorker('UPDATE_RECOMMENDATION', { id: card.id, action: 'added' }, () => false);
      const after = ready();
      if (!disposed && after && after.current.card.id === card.id) store.set({ ...after, added: true, addError: undefined });
    },
    async dismiss() {
      const view = ready();
      if (!view || view.dismissedTitle !== null) return;
      const { card } = view.current;
      stopTimer();
      store.set({ ...view, dismissedTitle: card.title });
      timer = setTimeout(() => {
        timer = null;
        const now = ready();
        if (now?.dismissedTitle !== null && now?.current.card.id === card.id) {
          previous = [now.current, ...previous].slice(0, PREVIOUS_KEPT);
          draw();
        }
      }, UNDO_MS);
      await callWorker('UPDATE_RECOMMENDATION', { id: card.id, action: 'dismissed' }, () => false);
    },
    async undo() {
      const view = ready();
      if (!view || view.dismissedTitle === null) return;
      stopTimer();
      store.set({ ...view, dismissedTitle: null });
      await callWorker('UPDATE_RECOMMENDATION', { id: view.current.card.id, action: 'undo' }, () => false);
    },
    retry() {
      reset();
      void load(false);
    },
    async restore() {
      await callWorker('RESTORE_RECOMMENDATIONS', null, () => false);
      if (disposed) return;
      reset();
      await load(false);
    },
    dispose() {
      disposed = true;
      generation++;
      stopTimer();
    },
  };
}
