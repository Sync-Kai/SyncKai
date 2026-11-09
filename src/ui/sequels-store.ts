import { STORAGE_KEYS } from '../protocol/storage-keys';
import { isSequelStore, visibleSequels, type SequelRecord } from '../shared/sequels';
import { createStore, type ReadonlyStore } from './state';

// Suites annoncées vues par une page (popup, panneau) : lecture de `sequels:state` et suivi de storage.onChanged pour
// cette clé seulement (une page peut écouter ; le service worker, non). Publie les suites visibles, la plus récente d'abord.

export interface SequelsStore extends ReadonlyStore<SequelRecord[]> {
  dispose(): void;
}

export function createSequelsStore(): SequelsStore {
  const store = createStore<SequelRecord[]>([]);
  let disposed = false;

  /** Valeur absente ou invalide : aucune suite */
  const publish = (value: unknown): void => {
    if (!disposed) store.set(isSequelStore(value) ? visibleSequels(value) : []);
  };

  const onChanged = (changes: Record<string, chrome.storage.StorageChange>, area: string): void => {
    const change = area === 'local' ? changes[STORAGE_KEYS.sequelsState] : undefined;
    if (change) publish(change.newValue);
  };
  chrome.storage.onChanged.addListener(onChanged);
  void chrome.storage.local.get(STORAGE_KEYS.sequelsState).then((stored) => publish(stored[STORAGE_KEYS.sequelsState]));

  return {
    get: store.get,
    subscribe: store.subscribe,
    dispose() {
      disposed = true;
      chrome.storage.onChanged.removeListener(onChanged);
    },
  };
}
