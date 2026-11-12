// Suggestions « Pour toi » (popup, panneau) : un lot reçu du service worker, tiré localement (drawNext) sans jamais
// répéter une fiche de la page. Un contrôleur par page ; aucune écoute du DOM, `dispose()` coupe la minuterie d'« Annuler ».
import { t } from '../i18n';
import { STORAGE_KEYS } from '../protocol/storage-keys';
import { ALL_RECO_FILTER, drawNext, isRecoBatch, matchesRecoFilter, recoGenres, type RecoBatch, type RecoFilter, type RecoItem } from '../shared/recommendations';
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
  | { status: 'ready'; current: RecoItem; previous: RecoItem[]; cold: boolean; malOnly: boolean; added: RecoAdded | null; dismissedTitle: string | null; addError?: string; filter: RecoFilter; genres: readonly string[] }
  /** Le filtre ne laisse aucune fiche à tirer */
  | { status: 'filtered'; filter: RecoFilter; genres: readonly string[] };

/** « + À regarder » réussi : `notOnMal` = AniList écrit, MyAnimeList non ; `inList` = rien d'écrit, déjà dans une liste */
export type RecoAdded = { notOnMal: boolean; inList: boolean };

export interface RecoController {
  readonly store: ReadonlyStore<RecoView>;
  another(): void;
  add(): Promise<void>;
  dismiss(): Promise<void>;
  undo(): Promise<void>;
  retry(): void;
  /** Filtre de genre et de format : la fiche affichée reste si elle correspond, sinon une autre est tirée */
  setFilter(filter: RecoFilter): void;
  /** « Revoir les écartées » : les écartées reviennent, le lot est recalculé */
  restore(): Promise<void>;
  dispose(): void;
}

/** `filter` : filtre de départ (le panneau n'en passe pas : toujours ALL_RECO_FILTER) */
export function createRecoController(options: { filter?: RecoFilter } = {}): RecoController {
  const store = createStore<RecoView>({ status: 'loading' });
  let batch: RecoBatch | null = null;
  let malOnly = false;
  let filter: RecoFilter = options.filter ?? ALL_RECO_FILTER;
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

  /**
   * Tire la suivante dans le filtre, hors des fiches déjà tirées. Plus aucune fiche dans le filtre : état `filtered`
   * (il reste des fiches hors filtre) ; plus aucune du tout : état vide
   */
  function draw(): void {
    if (!batch) {
      store.set({ status: 'empty' });
      return;
    }
    const next = drawNext({ ...batch, items: batch.items.filter((i) => matchesRecoFilter(i.card, filter)) }, drawn, Math.random);
    if (!next) {
      const left = batch.items.some((i) => !drawn.has(i.card.id));
      store.set(left ? { status: 'filtered', filter, genres: recoGenres(batch) } : { status: 'empty' });
      return;
    }
    drawn.add(next.card.id);
    store.set({ status: 'ready', current: next, previous, cold: batch.cold, malOnly, added: null, dismissedTitle: null, filter, genres: recoGenres(batch) });
  }

  async function load(retried: boolean): Promise<void> {
    const run = ++generation;
    const result = await callWorker('GET_RECOMMENDATIONS', {}, (message) => ({ ok: false as const, code: 'FAILED' as const, message }));
    if (run !== generation || disposed) return;
    if (result.ok) {
      batch = result.batch;
      malOnly = result.malOnly;
      // Genre retenu absent du nouveau lot : retiré, jamais un « aucune fiche » permanent
      if (filter.genre !== null && !recoGenres(batch).includes(filter.genre)) filter = { ...filter, genre: null };
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

  /**
   * Lot enregistré modifié (suggestion ajoutée à une liste ailleurs, ou retirée) : les ids absents ne sont plus tirés.
   * Compte ouvert ou fermé (jeton qui apparaît ou disparaît, génération de session) : le lot d'un autre compte est jeté.
   * Un jeton simplement rafraîchi (ancienne et nouvelle valeur) ne change rien.
   */
  const onStorageChanged = (changes: Record<string, chrome.storage.StorageChange>, area: string): void => {
    if (area !== 'local' || disposed) return;
    const tokens = [changes[STORAGE_KEYS.anilistToken], changes[STORAGE_KEYS.malToken]];
    if (STORAGE_KEYS.sessionEpoch in changes || tokens.some((c) => c && (c.oldValue === undefined) !== (c.newValue === undefined))) {
      reset();
      void load(false);
      return;
    }
    const stored: unknown = changes[STORAGE_KEYS.recoBatch]?.newValue;
    if (batch && isRecoBatch(stored)) {
      const kept = new Set(stored.items.map((i) => i.card.id));
      batch = { ...batch, items: batch.items.filter((i) => kept.has(i.card.id)) };
    }
  };
  chrome.storage.onChanged.addListener(onStorageChanged);

  void load(false);

  return {
    store,
    another() {
      const view = ready();
      if (!view) return;
      stopTimer();
      // Écartée pendant « Annuler » : elle ne figure pas dans « Déjà tirées »
      if (view.dismissedTitle === null) previous = [view.current, ...previous].slice(0, PREVIOUS_KEPT);
      draw();
    },
    async add() {
      const view = ready();
      if (!view || view.added) return;
      const { card } = view.current;
      // MyAnimeList seul et fiche sans idMal : aucune entrée où écrire
      if (view.malOnly && card.idMal === null) return;
      const outcome = await addToPlanning({ mediaId: card.id, malId: card.idMal });
      const result = sequelAddResult(outcome, t('reco.error', { error: t('error.unexpectedAdd') }));
      const now = ready();
      if (disposed || !now || now.current.card.id !== card.id) return;
      if (result.kind === 'failed') {
        store.set({ ...now, addError: result.message });
        return;
      }
      await callWorker('UPDATE_RECOMMENDATION', { id: card.id, action: 'added' }, () => false);
      const after = ready();
      if (!disposed && after && after.current.card.id === card.id) store.set({ ...after, added: { notOnMal: result.notOnMal, inList: result.inList }, addError: undefined });
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
          // Écartée : elle ne figure pas dans « Déjà tirées »
          draw();
        }
      }, UNDO_MS);
      const saved = await callWorker('UPDATE_RECOMMENDATION', { id: card.id, action: 'dismissed' }, () => false);
      // Écart non enregistré : la fiche reviendrait au prochain lot, l'erreur reste visible
      const now = ready();
      if (!saved && !disposed && now && now.current.card.id === card.id) store.set({ ...now, addError: t('reco.error', { error: t('popup.swUnreachable') }) });
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
    setFilter(next) {
      filter = next;
      const view = ready();
      if (view && matchesRecoFilter(view.current.card, next)) {
        store.set({ ...view, filter: next });
        return;
      }
      // Pas de lot encore (chargement, erreur, aucun compte) : le filtre s'appliquera au lot reçu
      if (!batch) return;
      stopTimer();
      draw();
    },
    async restore() {
      await callWorker('RESTORE_RECOMMENDATIONS', null, () => false);
      if (disposed) return;
      reset();
      await load(false);
    },
    dispose() {
      disposed = true;
      chrome.storage.onChanged.removeListener(onStorageChanged);
      generation++;
      stopTimer();
    },
  };
}
