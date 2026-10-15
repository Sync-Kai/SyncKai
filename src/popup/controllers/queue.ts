// Activité › « Synchros en attente » : file de relance (stockage, suivie par storage.onChanged), réessai par le
// service worker et abandon d'un élément.
import { t } from '../../i18n';
import { createLogger } from '../../browser/logger';
import { sendMessage } from '../../protocol/messages';
import { SYNC_QUEUE_KEY } from '../../protocol/storage-keys';
import { getSyncQueue, removeQueueItem } from '../../browser/storage/sync-queue-store';
import type { SyncOutcome } from '../../shared/sync.types';
import { retryFeedback } from '../../ui/feedback';
import { createStore, patchStore, withMember, type Store } from '../../ui/state';
import type { QueueState } from '../state';
import { NOTICE_MS } from './notice';

const log = createLogger('popup');

export interface QueueCounts {
  /** Synchros abandonnées après les relances automatiques (à traiter par l'utilisateur) */
  failed: number;
  /** Synchros en attente d'une relance automatique */
  pending: number;
}

export interface QueueController {
  readonly store: Store<QueueState>;
  counts(): QueueCounts;
  load(): Promise<void>;
  /** « Réessayer » : relance immédiate par le service worker, résultat dans le bandeau */
  retry(id: string): Promise<void>;
  /** « Abandonner » : l'élément quitte la file */
  abandon(id: string): Promise<void>;
  dispose(): void;
}

export function createQueueController(): QueueController {
  const store = createStore<QueueState>({ items: [], busyIds: new Set(), notice: null, error: null });
  const patch = (next: Partial<QueueState>): void => patchStore(store, next);
  const setBusy = (id: string, busy: boolean): void => patch({ busyIds: withMember(store.get().busyIds, id, busy) });
  let noticeTimer: ReturnType<typeof setTimeout> | undefined;

  async function load(): Promise<void> {
    try {
      patch({ items: await getSyncQueue(), error: null });
    } catch (error: unknown) {
      log.error('Lecture de la file de synchro impossible :', error);
      patch({ error: t('popup.queueReadFailed') });
    }
  }

  const onStorageChanged = (changes: Record<string, chrome.storage.StorageChange>, areaName: string): void => {
    if (areaName === 'local' && changes[SYNC_QUEUE_KEY]) void load();
  };
  chrome.storage.onChanged.addListener(onStorageChanged);

  return {
    store,
    load,

    counts() {
      const { items } = store.get();
      const failed = items.filter((item) => item.status === 'failed').length;
      return { failed, pending: items.length - failed };
    },

    async retry(id) {
      if (store.get().busyIds.has(id)) return;
      setBusy(id, true);
      let outcome: SyncOutcome;
      try {
        outcome = await sendMessage('RETRY_QUEUED', { id });
      } catch (error: unknown) {
        log.error('Service worker injoignable :', error);
        outcome = { status: 'error', message: t('popup.swUnreachable') };
      }
      setBusy(id, false);
      // Résultat affiché quelques secondes (l'élément a pu quitter la file entre-temps)
      clearTimeout(noticeTimer);
      patch({ notice: retryFeedback(outcome) });
      noticeTimer = setTimeout(() => patch({ notice: null }), NOTICE_MS);
      await load();
    },

    async abandon(id) {
      if (store.get().busyIds.has(id)) return;
      setBusy(id, true);
      let error: string | null = null;
      try {
        await removeQueueItem(id);
      } catch (e: unknown) {
        log.error('Suppression de la synchro en attente impossible :', e);
        error = t('popup.abandonFailed');
      }
      setBusy(id, false);
      await load();
      if (error) patch({ error });
    },

    dispose() {
      chrome.storage.onChanged.removeListener(onStorageChanged);
      clearTimeout(noticeTimer);
    },
  };
}
