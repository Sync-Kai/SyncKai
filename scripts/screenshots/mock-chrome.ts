// API `chrome` simulée pour rendre les vraies vues (popup, bulles) hors extension.
// Stockage en mémoire semé avec les données de démo, messages servis par des gestionnaires locaux.
// Les tests de bout en bout (scripts/e2e) s'en servent aussi : messages enregistrés, accès aux sites,
// stockage conservé au rechargement de la page.

type StorageItems = Record<string, unknown>;
type StorageChanges = Record<string, chrome.storage.StorageChange>;
type ChangeListener = (changes: StorageChanges, areaName: string) => void;
/** Réponse du « service worker » ; une promesse simule une réponse lente (ou absente) */
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
  /** Réponse de permissions.contains pour les origines requises */
  granted: boolean;
  /** permissions.request : renvoie l'accord de l'utilisateur ; accordé, `contains` répond ensuite true */
  onRequest: (origins: string[]) => boolean;
  /** Origines optionnelles (Netflix) : non accordées au départ, suivies une à une (request / remove) */
  optional?: readonly string[];
  /** Appelé à chaque permissions.remove (tests : retraits relevés) */
  onRemove?: (origins: string[]) => void;
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
  /** Contenu initial de chrome.storage.session (absent = zone vide) */
  session?: StorageItems;
  /** Port ouvert par chrome.tabs.connect (script de contenu simulé) ; absent = connexion refusée */
  connect?: (tabId: number, name: string) => chrome.runtime.Port;
  /** Onglet actif renvoyé par chrome.tabs.query / chrome.tabs.get (URL, titre) */
  tab?: { url: string; title?: string };
  /** Expose chrome.sidePanel (le panneau latéral se croit sur Chrome) */
  sidePanel?: boolean;
}

/** Événements d'onglet déclenchés par les tests (navigation, fin de chargement) */
export interface ChromeMockControls {
  /** chrome.tabs.onUpdated (ex. `{ status: 'complete' }` ou `{ url }`) */
  emitTabUpdated: (tabId: number, changeInfo: chrome.tabs.OnUpdatedInfo) => void;
}

/** Port simulé : `emit` pousse un message vers l'extension (script de contenu → page) */
export interface MockPort {
  port: chrome.runtime.Port;
  emit: (message: unknown) => void;
}

export function createMockPort(name: string, onPost: (message: unknown) => void = () => undefined): MockPort {
  const messageListeners = new Set<(message: unknown) => void>();
  const disconnectListeners = new Set<() => void>();
  let open = true;
  const event = <T>(set: Set<T>) => ({ addListener: (l: T) => void set.add(l), removeListener: (l: T) => void set.delete(l), hasListener: (l: T) => set.has(l) });
  const port = {
    name,
    postMessage: (message: unknown) => onPost(message),
    disconnect: () => {
      open = false;
    },
    onMessage: event(messageListeners),
    onDisconnect: event(disconnectListeners),
  };
  return {
    port: port as unknown as chrome.runtime.Port,
    emit: (message) => {
      if (open) messageListeners.forEach((listener) => listener(clone(message)));
    },
  };
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

export function installChromeMock(options: ChromeMockOptions): ChromeMockControls {
  const { persistKey } = options;
  const initial = (persistKey ? restoreStorage(persistKey) : null) ?? clone(options.storage);
  const store = new Map<string, unknown>(Object.entries(initial));
  const listeners = new Set<ChangeListener>();
  const noop = (): void => undefined;
  const event = { addListener: noop, removeListener: noop, hasListener: () => false };
  type TabUpdatedListener = (tabId: number, changeInfo: chrome.tabs.OnUpdatedInfo, tab: chrome.tabs.Tab) => void;
  const tabUpdatedListeners = new Set<TabUpdatedListener>();

  const persist = (): void => {
    if (persistKey) sessionStorage.setItem(persistKey, JSON.stringify(Object.fromEntries(store)));
  };
  persist();

  /** Écouteurs propres à une zone (chrome.storage.local.onChanged / session.onChanged) */
  type AreaListener = (changes: StorageChanges) => void;
  const areaListeners = { local: new Set<AreaListener>(), session: new Set<AreaListener>() };

  const emitFor =
    (area: 'local' | 'session', save: boolean) =>
    (changes: StorageChanges): void => {
      if (Object.keys(changes).length === 0) return;
      if (save) persist();
      // Asynchrone, comme dans Chrome
      queueMicrotask(() => {
        areaListeners[area].forEach((listener) => listener(changes));
        listeners.forEach((listener) => listener(changes, area));
      });
    };

  /** Zone de stockage en mémoire (chrome.storage.local / session) */
  const storageArea = (data: Map<string, unknown>, emit: (changes: StorageChanges) => void, own: Set<AreaListener>) => ({
    onChanged: {
      addListener: (listener: AreaListener) => void own.add(listener),
      removeListener: (listener: AreaListener) => void own.delete(listener),
      hasListener: (listener: AreaListener) => own.has(listener),
    },
    get: (keys?: unknown) => Promise.resolve(pick(data, keys)),
    set: (items: StorageItems) => {
      const changes: StorageChanges = {};
      for (const [key, value] of Object.entries(items)) {
        changes[key] = { oldValue: clone(data.get(key)), newValue: clone(value) };
        data.set(key, clone(value));
      }
      emit(changes);
      return Promise.resolve();
    },
    remove: (keys: string | string[]) => {
      const changes: StorageChanges = {};
      for (const key of Array.isArray(keys) ? keys : [keys]) {
        if (!data.has(key)) continue;
        changes[key] = { oldValue: clone(data.get(key)) };
        data.delete(key);
      }
      emit(changes);
      return Promise.resolve();
    },
  });

  const local = storageArea(store, emitFor('local', true), areaListeners.local);
  const session = storageArea(new Map<string, unknown>(Object.entries(clone(options.session ?? {}))), emitFor('session', false), areaListeners.session);

  const access = options.permissions;
  const optional = new Set(access?.optional ?? []);
  /** Origines optionnelles accordées */
  const grantedOptional = new Set<string>();
  const permissions = access && {
    contains: ({ origins }: { origins?: string[] }) =>
      Promise.resolve((origins ?? []).every((origin) => (optional.has(origin) ? grantedOptional.has(origin) : access.granted))),
    request: ({ origins }: { origins?: string[] }) => {
      const requested = [...(origins ?? [])];
      const granted = access.onRequest(requested);
      if (granted) {
        for (const origin of requested) {
          if (optional.has(origin)) grantedOptional.add(origin);
          else access.granted = true;
        }
      }
      return Promise.resolve(granted);
    },
    remove: ({ origins }: { origins?: string[] }) => {
      const removed = [...(origins ?? [])];
      access.onRemove?.(removed);
      for (const origin of removed) grantedOptional.delete(origin);
      return Promise.resolve(true);
    },
    onAdded: event,
    onRemoved: event,
  };

  const mock = {
    storage: {
      local,
      session,
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
        // Réponse asynchrone acceptée (tests : service worker lent ou qui ne répond jamais)
        const response = handler(message.payload);
        return response instanceof Promise ? response.then(clone) : Promise.resolve(clone(response));
      },
      onMessage: event,
    },
    i18n: { getUILanguage: () => options.locale },
    commands: { getAll: () => Promise.resolve([{ name: 'complete-episode', shortcut: 'Alt+Shift+S', description: '' }]) },
    tabs: {
      create: () => Promise.resolve({}),
      // Onglet actif fictif : sa page (Crunchyroll / ADN) est décrite par `tabMessage`
      query: () => Promise.resolve([{ id: 1, active: true, status: 'complete', ...options.tab }]),
      get: (id: number) => Promise.resolve({ id, active: true, status: 'complete', ...options.tab }),
      update: () => Promise.resolve({}),
      sendMessage: (_tabId: number, message: unknown) => Promise.resolve(clone(options.tabMessage?.(message))),
      connect: (tabId: number, info?: { name?: string }) => {
        if (!options.connect) throw new Error('Aucun script de contenu');
        return options.connect(tabId, info?.name ?? '');
      },
      onUpdated: {
        addListener: (listener: TabUpdatedListener) => void tabUpdatedListeners.add(listener),
        removeListener: (listener: TabUpdatedListener) => void tabUpdatedListeners.delete(listener),
        hasListener: (listener: TabUpdatedListener) => tabUpdatedListeners.has(listener),
      },
      onActivated: event,
    },
    windows: { getCurrent: () => Promise.resolve({ id: 1 }) },
    action: {
      setBadgeText: () => Promise.resolve(),
      setBadgeBackgroundColor: () => Promise.resolve(),
      setBadgeTextColor: () => Promise.resolve(),
    },
    ...(permissions ? { permissions } : {}),
    ...(options.sidePanel ? { sidePanel: { open: () => Promise.resolve(), setOptions: () => Promise.resolve() } } : {}),
  };

  // Seules les méthodes réellement appelées par les vues sont simulées
  (globalThis as { chrome?: unknown }).chrome = mock;

  return {
    emitTabUpdated: (tabId, changeInfo) => {
      const tab = { id: tabId, active: true, status: changeInfo.status ?? 'complete', ...options.tab } as chrome.tabs.Tab;
      tabUpdatedListeners.forEach((listener) => listener(tabId, clone(changeInfo), tab));
    },
  };
}
