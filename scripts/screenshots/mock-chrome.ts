// API `chrome` simulée pour rendre les vraies vues (popup, bulles) hors extension.
// Stockage en mémoire semé avec les données de démo, messages servis par des gestionnaires locaux.

type StorageItems = Record<string, unknown>;
type StorageChanges = Record<string, chrome.storage.StorageChange>;
type ChangeListener = (changes: StorageChanges, areaName: string) => void;
type MessageHandler = (payload: unknown) => unknown;

export interface ChromeMockOptions {
  locale: string;
  version: string;
  storage: StorageItems;
  /** Réponses du « service worker » par type de message */
  handlers: Record<string, MessageHandler>;
  /** Réponse du content script de l'onglet actif (chrome.tabs.sendMessage) ; absente = aucun script */
  tabMessage?: MessageHandler;
}

const clone = <T>(value: T): T => (value === undefined ? value : structuredClone(value));

function pick(store: Map<string, unknown>, keys: unknown): StorageItems {
  if (keys === null || keys === undefined) return Object.fromEntries([...store].map(([k, v]) => [k, clone(v)]));
  if (typeof keys === 'string') return store.has(keys) ? { [keys]: clone(store.get(keys)) } : {};
  if (Array.isArray(keys)) return Object.assign({}, ...keys.map((k: unknown) => (typeof k === 'string' ? pick(store, k) : {})));
  if (typeof keys === 'object') {
    // Objet de valeurs par défaut
    const defaults = keys as StorageItems;
    return Object.fromEntries(Object.entries(defaults).map(([k, fallback]) => [k, store.has(k) ? clone(store.get(k)) : fallback]));
  }
  return {};
}

export function installChromeMock(options: ChromeMockOptions): void {
  const store = new Map<string, unknown>(Object.entries(clone(options.storage)));
  const listeners = new Set<ChangeListener>();
  const noop = (): void => undefined;
  const event = { addListener: noop, removeListener: noop, hasListener: () => false };

  const emit = (changes: StorageChanges): void => {
    if (Object.keys(changes).length === 0) return;
    // Asynchrone, comme dans Chrome
    queueMicrotask(() => listeners.forEach((listener) => listener(changes, 'local')));
  };

  const local = {
    get: (keys?: unknown) => Promise.resolve(pick(store, keys)),
    set: (items: StorageItems) => {
      const changes: StorageChanges = {};
      for (const [key, value] of Object.entries(items)) {
        changes[key] = { oldValue: clone(store.get(key)), newValue: clone(value) };
        store.set(key, clone(value));
      }
      emit(changes);
      return Promise.resolve();
    },
    remove: (keys: string | string[]) => {
      const changes: StorageChanges = {};
      for (const key of Array.isArray(keys) ? keys : [keys]) {
        if (!store.has(key)) continue;
        changes[key] = { oldValue: clone(store.get(key)) };
        store.delete(key);
      }
      emit(changes);
      return Promise.resolve();
    },
  };

  const mock = {
    storage: {
      local,
      onChanged: {
        addListener: (listener: ChangeListener) => void listeners.add(listener),
        removeListener: (listener: ChangeListener) => void listeners.delete(listener),
        hasListener: (listener: ChangeListener) => listeners.has(listener),
      },
    },
    runtime: {
      id: 'synckai-screenshots',
      getManifest: () => ({ manifest_version: 3, name: 'SyncKai', version: options.version }),
      getURL: (path: string) => new URL(path, location.origin).href,
      sendMessage: (message: { type: string; payload: unknown }) => {
        const handler = options.handlers[message.type];
        if (!handler) return Promise.reject(new Error(`Message non simulé : ${message.type}`));
        return Promise.resolve(clone(handler(message.payload)));
      },
      onMessage: event,
    },
    i18n: { getUILanguage: () => options.locale },
    commands: { getAll: () => Promise.resolve([{ name: 'complete-episode', shortcut: 'Alt+Shift+S', description: '' }]) },
    tabs: {
      create: () => Promise.resolve({}),
      // Onglet actif fictif : sa page (Crunchyroll / ADN) est décrite par `tabMessage`
      query: () => Promise.resolve([{ id: 1, active: true }]),
      sendMessage: (_tabId: number, message: unknown) => Promise.resolve(clone(options.tabMessage?.(message))),
    },
    action: {
      setBadgeText: () => Promise.resolve(),
      setBadgeBackgroundColor: () => Promise.resolve(),
      setBadgeTextColor: () => Promise.resolve(),
    },
  };

  // Seules les méthodes réellement appelées par les vues sont simulées
  (globalThis as { chrome?: unknown }).chrome = mock;
}
