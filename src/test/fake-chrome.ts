import { vi } from 'vitest';

// Fausse API chrome partagée par les tests unitaires (ARCH-25) : stockage local / session en mémoire avec
// onChanged, alarmes, Web Locks (file FIFO par nom, `ifAvailable`) et fetch scriptable.
// Usage : `const fake = installFakeChrome();` AVANT l'import dynamique des modules testés, puis `fake.reset()`
// dans un beforeEach. Fichier de test : jamais importé par le code de l'extension (absent du build).

type Items = Record<string, unknown>;
type StorageChanges = Record<string, chrome.storage.StorageChange>;
type AreaName = 'local' | 'session';

/** Évènement chrome simulé (addListener / removeListener / hasListener) */
export class FakeEvent<A extends unknown[]> {
  private readonly listeners = new Set<(...args: A) => unknown>();
  addListener = (listener: (...args: A) => unknown): void => void this.listeners.add(listener);
  removeListener = (listener: (...args: A) => unknown): void => void this.listeners.delete(listener);
  hasListener = (listener: (...args: A) => unknown): boolean => this.listeners.has(listener);
  hasListeners = (): boolean => this.listeners.size > 0;
  emit(...args: A): void {
    for (const listener of [...this.listeners]) listener(...args);
  }
  clear(): void {
    this.listeners.clear();
  }
}

const sameValue = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);

/** Zone de stockage en mémoire : valeurs copiées (structuredClone) à l'écriture et à la lecture, comme chrome.storage */
export class FakeStorageArea {
  readonly data = new Map<string, unknown>();
  readonly onChanged = new FakeEvent<[StorageChanges]>();
  private readonly area: AreaName;
  private readonly globalOnChanged: FakeEvent<[StorageChanges, string]>;

  constructor(area: AreaName, globalOnChanged: FakeEvent<[StorageChanges, string]>) {
    this.area = area;
    this.globalOnChanged = globalOnChanged;
  }

  /** Valeur stockée (copie), undefined si absente */
  peek(key: string): unknown {
    return this.data.has(key) ? structuredClone(this.data.get(key)) : undefined;
  }

  /** Remplace tout le contenu, sans évènement (préparation d'un test) */
  seed(items: Items = {}): void {
    this.data.clear();
    for (const [key, value] of Object.entries(items)) this.data.set(key, structuredClone(value));
  }

  get = async (keys?: string | string[] | Items | null): Promise<Items> => {
    if (keys === null || keys === undefined) return Object.fromEntries([...this.data].map(([k, v]) => [k, structuredClone(v)]));
    if (typeof keys === 'string' || Array.isArray(keys)) {
      const wanted = typeof keys === 'string' ? [keys] : keys;
      return Object.fromEntries(wanted.filter((k) => this.data.has(k)).map((k) => [k, structuredClone(this.data.get(k))]));
    }
    // Objet : valeurs par défaut des clés absentes
    return Object.fromEntries(Object.entries(keys).map(([k, fallback]) => [k, this.data.has(k) ? structuredClone(this.data.get(k)) : fallback]));
  };

  set = async (items: Items): Promise<void> => {
    const changes: StorageChanges = {};
    for (const [key, value] of Object.entries(items)) {
      const oldValue = this.data.get(key);
      const had = this.data.has(key);
      this.data.set(key, structuredClone(value));
      if (!had || !sameValue(oldValue, value)) changes[key] = { ...(had ? { oldValue } : {}), newValue: structuredClone(value) };
    }
    this.notify(changes);
  };

  remove = async (keys: string | string[]): Promise<void> => {
    const changes: StorageChanges = {};
    for (const key of typeof keys === 'string' ? [keys] : keys) {
      if (!this.data.has(key)) continue;
      changes[key] = { oldValue: this.data.get(key) };
      this.data.delete(key);
    }
    this.notify(changes);
  };

  clear = async (): Promise<void> => this.remove([...this.data.keys()]);

  /** Évènements après l'écriture, comme Chrome (asynchrones, seulement pour les valeurs changées) */
  private notify(changes: StorageChanges): void {
    if (Object.keys(changes).length === 0) return;
    queueMicrotask(() => {
      this.onChanged.emit(changes);
      this.globalOnChanged.emit(changes, this.area);
    });
  }
}

/** Paramètres de chrome.alarms.create (forme aplatie de chrome.alarms.AlarmCreateInfo) */
interface AlarmInfo {
  name?: string;
  when?: number;
  delayInMinutes?: number;
  periodInMinutes?: number;
  persistAcrossSessions?: boolean;
}

/** chrome.alarms en mémoire : `fire(name)` déclenche onAlarm comme le navigateur */
export class FakeAlarms {
  readonly alarms = new Map<string, chrome.alarms.Alarm>();
  readonly onAlarm = new FakeEvent<[chrome.alarms.Alarm]>();

  create = async (nameOrInfo?: string | AlarmInfo, maybeInfo?: AlarmInfo): Promise<void> => {
    const info: AlarmInfo = (typeof nameOrInfo === 'string' ? maybeInfo : nameOrInfo) ?? {};
    const name = typeof nameOrInfo === 'string' ? nameOrInfo : (info.name ?? '');
    const delayMinutes = info.delayInMinutes ?? info.periodInMinutes ?? 0;
    const scheduledTime = info.when ?? Date.now() + delayMinutes * 60_000;
    this.alarms.set(name, {
      name,
      scheduledTime,
      persistAcrossSessions: info.persistAcrossSessions ?? true,
      ...(info.periodInMinutes !== undefined ? { periodInMinutes: info.periodInMinutes } : {}),
    });
  };

  clear = async (name = ''): Promise<boolean> => this.alarms.delete(name);
  clearAll = async (): Promise<boolean> => {
    const had = this.alarms.size > 0;
    this.alarms.clear();
    return had;
  };
  get = async (name = ''): Promise<chrome.alarms.Alarm | undefined> => this.alarms.get(name);
  getAll = async (): Promise<chrome.alarms.Alarm[]> => [...this.alarms.values()];

  /** Déclenche l'alarme (retirée si elle n'est pas périodique) ; false si elle n'existe pas */
  fire(name: string): boolean {
    const alarm = this.alarms.get(name);
    if (!alarm) return false;
    if (alarm.periodInMinutes === undefined) this.alarms.delete(name);
    this.onAlarm.emit(alarm);
    return true;
  }
}

/**
 * navigator.locks avec la sémantique de Web Locks (mode exclusif) : une file FIFO par nom, noms indépendants,
 * non réentrant (une prise imbriquée du même nom bloque : le test échoue par dépassement de délai).
 * `ifAvailable` : verrou détenu ou demandé → la tâche reçoit null tout de suite.
 */
export class FakeLocks {
  private readonly held = new Set<string>();
  private readonly waiting = new Map<string, (() => void)[]>();
  /** Noms des verrous demandés, dans l'ordre (contrôle des tests) */
  readonly requested: string[] = [];

  request = (<T>(name: string, optionsOrTask: LockOptions | LockGrantedCallback<T>, maybeTask?: LockGrantedCallback<T>): Promise<T> => {
    const options: LockOptions = typeof optionsOrTask === 'function' ? {} : optionsOrTask;
    const task = typeof optionsOrTask === 'function' ? optionsOrTask : maybeTask;
    if (!task) return Promise.reject(new TypeError('Tâche du verrou absente'));
    this.requested.push(name);
    const queue = this.waiting.get(name) ?? [];
    if (options.ifAvailable && (this.held.has(name) || queue.length > 0)) return Promise.resolve().then(() => task(null));

    return new Promise<T>((resolve, reject) => {
      const start = (): void => {
        this.held.add(name);
        const lock: Lock = { name, mode: options.mode ?? 'exclusive' };
        Promise.resolve()
          .then(() => task(lock))
          .then(
            (value) => {
              this.release(name);
              resolve(value);
            },
            (error: unknown) => {
              this.release(name);
              reject(error);
            },
          );
      };
      if (this.held.has(name)) this.waiting.set(name, [...queue, start]);
      else start();
    });
  }) as LockManager['request'];

  query = async (): Promise<LockManagerSnapshot> => ({
    held: [...this.held].map((name) => ({ name, mode: 'exclusive', clientId: 'test' })),
    pending: [...this.waiting].flatMap(([name, queue]) => queue.map(() => ({ name, mode: 'exclusive' as const, clientId: 'test' }))),
  });

  isHeld(name: string): boolean {
    return this.held.has(name);
  }

  reset(): void {
    this.held.clear();
    this.waiting.clear();
    this.requested.length = 0;
  }

  private release(name: string): void {
    const queue = this.waiting.get(name) ?? [];
    const next = queue.shift();
    if (queue.length === 0) this.waiting.delete(name);
    if (next) next();
    else this.held.delete(name);
  }
}

/** Réponse JSON (fetch simulé) */
export function jsonResponse(status: number, body: unknown, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...headers } });
}

export interface FetchCall {
  url: string;
  init: RequestInit | undefined;
}

type FetchMatcher = string | RegExp | ((url: string, init: RequestInit | undefined) => boolean);
/** Réponse d'une route : une nouvelle Response à chaque appel (un corps ne se lit qu'une fois) ; lever simule une coupure */
export type FetchResponder = (call: FetchCall) => Response | Promise<Response>;

interface FetchRoute {
  matches: (call: FetchCall) => boolean;
  respond: FetchResponder;
  /** Appels restants (Infinity : permanente) */
  times: number;
}

/**
 * fetch scriptable : routes essayées dans l'ordre d'ajout (une route `times` s'épuise), appel non routé → rejet
 * explicite (une requête imprévue fait échouer le test). `networkError()` : coupure (TypeError, comme fetch).
 */
export class FakeFetch {
  readonly calls: FetchCall[] = [];
  private routes: FetchRoute[] = [];

  readonly fetch = (async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const call: FetchCall = { url, init };
    this.calls.push(call);
    const route = this.routes.find((r) => r.times > 0 && r.matches(call));
    if (!route) throw new Error(`fetch non simulé : ${init?.method ?? 'GET'} ${url}`);
    route.times--;
    return route.respond(call);
  }) as typeof fetch;

  /** Ajoute une route ; `times` : nombre d'appels servis (défaut : illimité) */
  on(matcher: FetchMatcher, respond: FetchResponder, times = Infinity): this {
    const matches =
      typeof matcher === 'string'
        ? (call: FetchCall) => call.url.startsWith(matcher)
        : matcher instanceof RegExp
          ? (call: FetchCall) => matcher.test(call.url)
          : (call: FetchCall) => matcher(call.url, call.init);
    this.routes.push({ matches, respond, times });
    return this;
  }

  /** Ajoute une route servie une seule fois */
  once(matcher: FetchMatcher, respond: FetchResponder): this {
    return this.on(matcher, respond, 1);
  }

  static networkError(): FetchResponder {
    return () => {
      throw new TypeError('Failed to fetch');
    };
  }

  reset(): void {
    this.calls.length = 0;
    this.routes = [];
  }
}

export interface FakeChromeOptions {
  /** navigator.language (défaut 'fr') */
  language?: string;
  /** chrome.runtime.id (défaut 'synckai-test') */
  extensionId?: string;
  /** Espaces de noms chrome supplémentaires (identity, permissions…), fusionnés à la racine */
  extra?: Items;
  /** Remplace globalThis.fetch par le fetch scriptable (défaut true) */
  stubFetch?: boolean;
}

export interface FakeChrome {
  local: FakeStorageArea;
  session: FakeStorageArea;
  /** chrome.storage.onChanged (changements, zone) */
  onStorageChanged: FakeEvent<[StorageChanges, string]>;
  alarms: FakeAlarms;
  locks: FakeLocks;
  fetch: FakeFetch;
  /** Vide le stockage (puis sème `local`), les alarmes, les verrous, les routes fetch et les écouteurs */
  reset(local?: Items): void;
}

/** Installe la fausse API (chrome, navigator, fetch) sur globalThis par vi.stubGlobal */
export function installFakeChrome(options: FakeChromeOptions = {}): FakeChrome {
  const onStorageChanged = new FakeEvent<[StorageChanges, string]>();
  const local = new FakeStorageArea('local', onStorageChanged);
  const session = new FakeStorageArea('session', onStorageChanged);
  const alarms = new FakeAlarms();
  const locks = new FakeLocks();
  const fakeFetch = new FakeFetch();

  vi.stubGlobal('chrome', {
    runtime: { id: options.extensionId ?? 'synckai-test', getURL: (path: string) => `chrome-extension://${options.extensionId ?? 'synckai-test'}/${path.replace(/^\//, '')}` },
    storage: { local, session, onChanged: onStorageChanged },
    alarms,
    ...options.extra,
  });
  vi.stubGlobal('navigator', { language: options.language ?? 'fr', locks });
  if (options.stubFetch !== false) vi.stubGlobal('fetch', fakeFetch.fetch);

  return {
    local,
    session,
    onStorageChanged,
    alarms,
    locks,
    fetch: fakeFetch,
    reset(seed: Items = {}): void {
      local.seed(seed);
      session.seed();
      local.onChanged.clear();
      session.onChanged.clear();
      onStorageChanged.clear();
      void alarms.clearAll();
      alarms.onAlarm.clear();
      locks.reset();
      fakeFetch.reset();
    },
  };
}
