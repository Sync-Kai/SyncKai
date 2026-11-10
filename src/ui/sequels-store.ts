import { STORAGE_KEYS } from '../protocol/storage-keys';
import { normalizeSettings, SETTINGS_STORAGE_KEY } from '../shared/settings';
import { isSequelStore, visibleSequels, type SequelRecord } from '../shared/sequels';
import { createStore, type ReadonlyStore } from './state';

// Suites annoncées vues par une page (popup, panneau) : lecture de `sequels:state` et suivi de storage.onChanged pour
// cette clé seulement (une page peut écouter ; le service worker, non). Publie les suites visibles, la plus récente d'abord ;
// rien quand « Alertes de suites » est coupé (réglage suivi aussi : popup, rail, panneau et Agenda se vident ensemble).

export interface SequelsStore extends ReadonlyStore<SequelRecord[]> {
  /** Ids de toutes les suites enregistrées, écartées comprises : une suite écartée n'est elle aussi dans aucune liste */
  readonly unlisted: ReadonlyStore<ReadonlySet<number>>;
  dispose(): void;
}

export function createSequelsStore(): SequelsStore {
  const store = createStore<SequelRecord[]>([]);
  const unlisted = createStore<ReadonlySet<number>>(new Set());
  let disposed = false;
  let raw: unknown;
  let enabled = true;

  /** Valeur absente ou invalide, ou alertes coupées : aucune suite */
  const publish = (): void => {
    if (disposed) return;
    const valid = enabled && isSequelStore(raw) ? raw : null;
    store.set(valid ? visibleSequels(valid) : []);
    unlisted.set(new Set(valid?.records.map((record) => record.snapshot.id)));
  };

  const onChanged = (changes: Record<string, chrome.storage.StorageChange>, area: string): void => {
    if (area !== 'local') return;
    const state = changes[STORAGE_KEYS.sequelsState];
    const settings = changes[SETTINGS_STORAGE_KEY];
    if (state) raw = state.newValue;
    if (settings) enabled = normalizeSettings(settings.newValue).sequelAlerts;
    if (state || settings) publish();
  };
  chrome.storage.onChanged.addListener(onChanged);
  void chrome.storage.local.get([STORAGE_KEYS.sequelsState, SETTINGS_STORAGE_KEY]).then((stored) => {
    raw = stored[STORAGE_KEYS.sequelsState];
    enabled = normalizeSettings(stored[SETTINGS_STORAGE_KEY]).sequelAlerts;
    publish();
  });

  return {
    get: store.get,
    subscribe: store.subscribe,
    unlisted,
    dispose() {
      disposed = true;
      chrome.storage.onChanged.removeListener(onChanged);
    },
  };
}
