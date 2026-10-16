// Kit des clients isolés des ponts du monde MAIN : ouverture du canal privé (premier port offert pour un nonce),
// connexion mémoïsée, attentes relues à chaque message (délai OBLIGATOIRE, 2-R11), singleton paresseux. Monde isolé :
// aucune règle de plateforme ici, chaque client garde ses caches et ses décodages (bridge-protocol.ts de la plateforme).
//
// Garanties réelles du canal (SEC-05) : un MessageEvent synthétique (`dispatchEvent` d'un script de la page) n'est pas
// `isTrusted` et reste ignoré, mais un vrai `window.postMessage` de la page l'est aussi, et le nonce de la demande est
// lisible par la page. Ce qui protège le canal est l'ORDRE (le pont répond le premier, voir content/bridge/kit.ts) ; ce
// qui arrive par le canal reste une donnée que la page aurait pu écrire, revalidée par chaque client.

export interface ChannelEndpoints {
  /** Cible de la demande d'ouverture (document en production, faux document dans les tests) */
  target: EventTarget;
  /** Réception de l'offre de port par `postMessage` (window en production) */
  messages: EventTarget;
  /** Origine attendue de l'offre (location.origin) */
  origin: string;
  /** Défaut : `event.isTrusted` ; remplacé dans les tests (Node : toujours faux) */
  isTrusted?: (event: Event) => boolean;
}

/** Points d'accès de la page courante (production) */
export const pageEndpoints = (): ChannelEndpoints => ({ target: document, messages: window, origin: location.origin });

const trusted = (endpoints: ChannelEndpoints): ((event: Event) => boolean) => endpoints.isTrusted ?? ((event) => event.isTrusted);

/**
 * Demande d'ouverture (`event`, `detail`), puis PREMIER port offert par un vrai postMessage de l'origine attendue dont les
 * données satisfont `isOffer` ; les offres suivantes ne sont plus écoutées. Null après `timeoutMs` (pont absent : onglet
 * ouvert avant l'activation ou la mise à jour).
 */
export function openBridgeChannel(endpoints: ChannelEndpoints, event: string, detail: string, isOffer: (data: unknown) => boolean, timeoutMs: number): Promise<MessagePort | null> {
  const isTrusted = trusted(endpoints);
  return new Promise((resolve) => {
    const done = (offered: MessagePort | null): void => {
      clearTimeout(timer);
      endpoints.messages.removeEventListener('message', onOffer);
      resolve(offered);
    };
    const onOffer = (message: Event): void => {
      // Offre synthétique (dispatchEvent) : elle passerait avant le vrai postMessage du pont → refusée
      if (!(message instanceof MessageEvent) || !isTrusted(message) || message.origin !== endpoints.origin || !isOffer(message.data)) return;
      const [offered] = message.ports;
      if (offered instanceof MessagePort) done(offered);
    };
    const timer = setTimeout(() => done(null), timeoutMs);
    endpoints.messages.addEventListener('message', onOffer);
    endpoints.target.dispatchEvent(new CustomEvent(event, { detail }));
  });
}

export interface BridgeConnectionOptions {
  endpoints: ChannelEndpoints;
  /** Événement de la demande d'ouverture */
  event: string;
  /** Detail de la demande pour ce nonce */
  handshake(nonce: string): string;
  /** Données d'un `postMessage` : offre de port pour ce nonce */
  isOffer(data: unknown, nonce: string): boolean;
  /** Attente de l'offre de port */
  timeoutMs: number;
  /** Nonces d'ouverture (défaut : crypto.randomUUID) */
  newId?: () => string;
  /** Message du pont reçu sur le port (événements non `isTrusted` déjà écartés) */
  onMessage(data: unknown): void;
  /** Résultat de chaque ouverture (journal de diagnostic) */
  onOpen?(port: MessagePort | null): void;
}

/**
 * Connexion au pont : port ouvert, ou ouverture en cours partagée entre les demandes simultanées ; après un échec, la
 * demande suivante réessaie (nouveau nonce). Le port est démarré avec un écouteur filtré `isTrusted` : le port transféré
 * est aussi visible des écouteurs `message` de la page, un MessageEvent qu'elle y déclencherait reste ignoré.
 */
export function createBridgeConnection(options: BridgeConnectionOptions): () => Promise<MessagePort | null> {
  const isTrusted = trusted(options.endpoints);
  const newId = options.newId ?? ((): string => crypto.randomUUID());
  let port: MessagePort | null = null;
  let opening: Promise<MessagePort | null> | null = null;
  return () => {
    if (port) return Promise.resolve(port);
    opening ??= (() => {
      const nonce = newId();
      return openBridgeChannel(options.endpoints, options.event, options.handshake(nonce), (data) => options.isOffer(data, nonce), options.timeoutMs);
    })().then((offered) => {
      opening = null;
      if (offered) {
        port = offered;
        offered.addEventListener('message', (event) => {
          if (event instanceof MessageEvent && isTrusted(event)) options.onMessage(event.data);
        });
        offered.start(); // Obligatoire avec addEventListener (onmessage le ferait implicitement)
      }
      options.onOpen?.(offered);
      return offered;
    });
    return opening;
  };
}

export interface Waiters {
  /** Relit les attentes en cours et appelle les abonnés (nouveau message du pont, délai interne écoulé) */
  notify(): void;
  /** Appelé à chaque `notify` ; retourne le désabonnement */
  subscribe(listener: () => void): () => void;
  /**
   * Valeur de `get` dès qu'elle est définie (relue à chaque `notify`) : `undefined` = attendre encore, `null` est une
   * réponse. Null aussi si `signal` est annulé ou après `timeoutMs` (OBLIGATOIRE : aucune attente sans fin, 2-R11).
   */
  until<T>(get: () => T | null | undefined, signal: AbortSignal, timeoutMs: number): Promise<T | null>;
}

export function createWaiters(): Waiters {
  const listeners = new Set<() => void>();
  return {
    notify() {
      for (const listener of [...listeners]) listener();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    until<T>(get: () => T | null | undefined, signal: AbortSignal, timeoutMs: number): Promise<T | null> {
      return new Promise((resolve) => {
        const finish = (value: T | null): void => {
          clearTimeout(timer);
          listeners.delete(check);
          signal.removeEventListener('abort', onAbort);
          resolve(value);
        };
        const check = (): void => {
          const value = get();
          if (value !== undefined) finish(value);
        };
        const onAbort = (): void => finish(null);
        const timer = setTimeout(onAbort, timeoutMs);
        signal.addEventListener('abort', onAbort, { once: true });
        listeners.add(check);
        check();
      });
    },
  };
}

/** Résout `promise`, ou null dès que `signal` est annulé (la promesse partagée continue pour les autres) */
export function untilAborted<T>(promise: Promise<T | null>, signal: AbortSignal): Promise<T | null> {
  if (signal.aborted) return Promise.resolve(null);
  return new Promise((resolve) => {
    const onAbort = (): void => resolve(null);
    signal.addEventListener('abort', onAbort, { once: true });
    void promise.then((value) => {
      signal.removeEventListener('abort', onAbort);
      resolve(value);
    });
  });
}

/** Valeur créée au premier appel seulement (client du pont d'un adaptateur) */
export function lazy<T>(create: () => T): () => T {
  let value: { current: T } | null = null;
  return () => (value ??= { current: create() }).current;
}
