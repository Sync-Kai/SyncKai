// Activité › « À noter » : notes de fin de série reportées (stockage, suivi par storage.onChanged), envoi d'une
// note au service worker et retrait d'une carte.
import { t } from '../../i18n';
import { getPendingRatings, removePendingRating } from '../../browser/storage/engagement-store';
import type { PendingRating } from '../../shared/engagement.types';
import { createLogger } from '../../browser/logger';
import { sendMessage } from '../../protocol/messages';
import { PENDING_RATINGS_KEY } from '../../protocol/storage-keys';
import type { SyncOutcome } from '../../shared/sync.types';
import { ratingFeedback } from '../../ui/feedback';
import { formatStarValue } from '../../ui/rating';
import { createStore, patchStore, withEntry, withMember, type Store } from '../../ui/state';
import type { RatingsState } from '../state';
import { NOTICE_MS } from './notice';

const log = createLogger('popup');

export interface RatingsController {
  readonly store: Store<RatingsState>;
  load(): Promise<void>;
  /** Note envoyée : la carte quitte la liste seulement une fois la note écrite (échec : erreur sur la carte) */
  rate(item: PendingRating, value: number): Promise<void>;
  /** « Ignorer » : la carte est retirée du stockage */
  ignore(item: PendingRating): Promise<void>;
  dispose(): void;
}

export function createRatingsController(): RatingsController {
  const store = createStore<RatingsState>({ items: [], busyIds: new Set(), errors: new Map(), notice: null, error: null });
  const patch = (next: Partial<RatingsState>): void => patchStore(store, next);
  let noticeTimer: ReturnType<typeof setTimeout> | undefined;

  async function load(): Promise<void> {
    try {
      const items = await getPendingRatings();
      const current = store.get();
      // Cartes en cours d'envoi conservées : le service worker les retire seulement après l'écriture
      const busy = current.items.filter((i) => current.busyIds.has(i.id) && !items.some((n) => n.id === i.id));
      patch({ items: [...busy, ...items], error: null });
    } catch (error: unknown) {
      log.error('Lecture des notes en attente impossible :', error);
      patch({ error: t('popup.ratingsReadFailed') });
    }
  }

  const onStorageChanged = (changes: Record<string, chrome.storage.StorageChange>, areaName: string): void => {
    if (areaName === 'local' && changes[PENDING_RATINGS_KEY]) void load();
  };
  chrome.storage.onChanged.addListener(onStorageChanged);

  return {
    store,
    load,

    async rate(item, value) {
      if (store.get().busyIds.has(item.id)) return;
      patch({ busyIds: withMember(store.get().busyIds, item.id, true), errors: withEntry(store.get().errors, item.id, null) });
      let outcome: SyncOutcome;
      try {
        outcome = await sendMessage('RATE_MEDIA', { media: { mediaId: item.mediaId, malId: item.malId, title: item.title }, score: value, fromCard: true });
      } catch (error: unknown) {
        log.error('Service worker injoignable :', error);
        outcome = { status: 'error', message: t('popup.swUnreachable') };
      }
      const feedback = ratingFeedback(outcome, formatStarValue(value), item.title);
      const current = store.get();
      if (!feedback.ok) {
        patch({ busyIds: withMember(current.busyIds, item.id, false), errors: withEntry(current.errors, item.id, feedback.text) });
        return;
      }
      // Le service worker retire la carte du stockage ; elle disparaît tout de suite de l'affichage
      clearTimeout(noticeTimer);
      patch({ items: current.items.filter((i) => i.id !== item.id), busyIds: withMember(current.busyIds, item.id, false), notice: feedback });
      noticeTimer = setTimeout(() => patch({ notice: null }), NOTICE_MS);
    },

    async ignore(item) {
      try {
        await removePendingRating(item.id);
        patch({ error: null });
      } catch (error: unknown) {
        log.error('Suppression de la note en attente impossible :', error);
        patch({ error: t('popup.ignoreFailed') });
      }
    },

    dispose() {
      chrome.storage.onChanged.removeListener(onStorageChanged);
      clearTimeout(noticeTimer);
    },
  };
}
