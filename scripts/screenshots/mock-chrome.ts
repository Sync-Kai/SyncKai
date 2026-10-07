// API `chrome` simulée pour rendre les vraies vues (popup, bulles) hors extension.
// Stockage en mémoire semé avec les données de démo, messages servis par des gestionnaires locaux.
// Les tests de bout en bout (scripts/e2e) s'en servent aussi : messages enregistrés, accès aux sites,
// stockage conservé au rechargement de la page.

type StorageItems = Record<string, unknown>;
type StorageChanges = Record<string, chrome.storage.StorageChange>;
type ChangeListener = (changes: StorageChanges, areaName: string) => void;
type MessageHandler = (payload: unknown) => unknown;

/** Message envoyé au « service worker » (chrome.runtime.sendMessage) */
export interface SentMessage {
  type: string;
  payload: unknown;
}

/** Champs du manifest lus par les vues en plus de la version (origines requises : host-access.ts) */
export interface ManifestExtras {
  host_permissions?: string[];
  content_scripts?: { matches?: string[] }[];
}

/** Accès aux sites simulé (chrome.permissions) */
export interface PermissionsMock {
  /** Réponse de permissions.contains */
  granted: boolean;
  /** permissions.request : renvoie l'accord de l'utilisateur ; accordé, `contains` répond ensuite true */
  onRequest: (origins: string[]) => boolean;
}

export interface ChromeMockOptions {
  locale: string;
  version: string;
  storage: StorageItems;
  /** Réponses du « service worker » par type de message */
  handlers: Record<string, MessageHandler>;
  /** Réponse du content script de l'onglet actif (chrome.tabs.sendMessage) ; absente = aucun script */
  tabMessage?: MessageHandler;
  /** Appelé à chaque chrome.runtime.sendMessage, avant la réponse (tests : messages envoyés) */
  onSendMessage?: (message: SentMessage) => void;
  /** chrome.permissions simulé ; absent = API absente (accès considéré comme accordé par le popup) */
  permissions?: PermissionsMock;
  manifest?: ManifestExtras;
  /**
   * Clé sessionStorage : le stockage y est recopié à chaque écriture et relu à l'installation.
   * Il survit ainsi au rechargement du popup (changement de langue) ; l'appelant efface la clé pour repartir des données de démo.
   */
  persistKey?: string;
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

/** Stockage conservé par un chargement précédent de la page, null s'il n'y en a pas (ou s'il est illisible) */
function restoreStorage(key: string): StorageItems | null {
  try {
    const raw = sessionStorage.getItem(key);
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed) ? (parsed as StorageItems) : null;
  } catch {
    return null;
  }
}

export function installChromeMock(options: ChromeMockOptions): void {
  const { persistKey } = options;
  const initial = (persistKey ? restoreStorage(persistKey) : null) ?? clone(options.storage);
  const store = new Map<string, unknown>(Object.entries(initial));
  const listeners = new Set<ChangeListener>();
  const noop = (): void => undefined;
  const event = { addListener: noop, removeListener: noop, hasListener: () => false };

  const persist = (): void => {
    if (persistKey) sessionStorage.setItem(persistKey, JSON.stringify(Object.fromEntries(store)));
  };
  persist();

  const emit = (changes: StorageChanges): void => {
    if (Object.keys(changes).length === 0) return;
    persist();
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

  const access = options.permissions;
  const permissions = access && {
    contains: () => Promise.resolve(access.granted),
    request: ({ origins }: { origins?: string[] }) => {
      const granted = access.onRequest([...(origins ?? [])]);
      if (granted) access.granted = true;
      return Promise.resolve(granted);
    },
    onAdded: event,
    onRemoved: event,
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
      getManifest: () => ({ manifest_version: 3, name: 'SyncKai', version: options.version, ...clone(options.manifest) }),
      getURL: (path: string) => new URL(path, location.origin).href,
      sendMessage: (message: SentMessage) => {
        options.onSendMessage?.(clone(message));
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
    ...(permissions ? { permissions } : {}),
  };

  // Seules les méthodes réellement appelées par les vues sont simulées
  (globalThis as { chrome?: unknown }).chrome = mock;
}
