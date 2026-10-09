// Client du pont Netflix, côté script de contenu isolé : demande les métadonnées au script du monde MAIN
// (page-bridge.iife.ts) sur un canal privé (MessageChannel, voir bridge-protocol.ts) et revalide la réponse.
// Délai par tentative de 12 s, supérieur au fetch du pont (10 s) : une réponse lente mais valide est toujours
// reçue par la tentative qui l'a demandée. 2 nouvelles tentatives (pont muet ou pas encore prêt, réseau, 5xx,
// 429), une seule requête en vol par vidéo, cache LRU des 5 dernières séries (la réponse décrit toute la série :
// l'épisode suivant de la lecture automatique est servi sans nouvelle requête).
import {
  decodeNetflixPortOffer,
  decodeNetflixResponse,
  encodeNetflixHandshake,
  encodeNetflixRequest,
  NETFLIX_ATTEMPT_TIMEOUT_MS,
  NETFLIX_BRIDGE_VERSION,
  NETFLIX_HANDSHAKE_EVENT,
  NETFLIX_MOVIE_ID_REGEX,
  type NetflixBridgeResponse,
  type NetflixShowMetadata,
} from './bridge-protocol';

export interface NetflixBridgeClientOptions {
  /** Cible de la demande d'ouverture du canal (document en production, faux document dans les tests) */
  target: EventTarget;
  /** Réception de l'offre de port par `postMessage` (window en production) */
  messages: EventTarget;
  /** Origine attendue de l'offre (location.origin) */
  origin: string;
  /** Délai d'une tentative (ouverture du canal comprise) ; doit rester supérieur à NETFLIX_FETCH_TIMEOUT_MS */
  timeoutMs?: number;
  /** Nouvelles tentatives après un délai dépassé ou une erreur passagère */
  retries?: number;
  retryDelayMs?: number;
  cacheSize?: number;
  /** Identifiants de corrélation et nonces d'ouverture */
  newId?: () => string;
  /**
   * Événement émis par le navigateur (vrai postMessage) et non par `dispatchEvent` d'un script de la page.
   * Défaut : `event.isTrusted` ; remplacé dans les tests (Node : toujours faux).
   */
  isTrusted?: (event: Event) => boolean;
}

export interface NetflixBridgeClient {
  /** Métadonnées de la série (ou du film) contenant cette vidéo ; null si indisponibles ou annulé */
  load(movieId: string, signal: AbortSignal): Promise<NetflixShowMetadata | null>;
  /** Lecture synchrone du cache, sans requête */
  peek(movieId: string): NetflixShowMetadata | null;
}

const DEFAULTS = { timeoutMs: NETFLIX_ATTEMPT_TIMEOUT_MS, retries: 2, retryDelayMs: 500, cacheSize: 5 } as const;

/** Échec d'une tentative : `retry` si une nouvelle tentative a un sens (délai, réseau, erreur serveur) */
type Attempt = { ok: true; data: NetflixShowMetadata } | { ok: false; retry: boolean };

/** Vrai si la série (ou le film) contient la vidéo demandée */
export function containsMovie(show: NetflixShowMetadata, movieId: string): boolean {
  if (show.type === 'movie') return show.showId === movieId;
  return show.seasons.some((season) => season.episodes.some((episode) => episode.id === movieId));
}

function retryable(response: Extract<NetflixBridgeResponse, { ok: false }>): boolean {
  if (response.error === 'network') return true;
  if (response.error === 'http') return response.status === undefined || response.status === 429 || response.status >= 500;
  return false; // Forme inattendue : une nouvelle tentative donnerait la même réponse
}

/** Résout `promise`, ou null dès que `signal` est annulé (la promesse partagée continue pour les autres) */
function untilAborted<T>(promise: Promise<T | null>, signal: AbortSignal): Promise<T | null> {
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

export function createNetflixBridgeClient(options: NetflixBridgeClientOptions): NetflixBridgeClient {
  const { target, messages, origin } = options;
  const timeoutMs = options.timeoutMs ?? DEFAULTS.timeoutMs;
  const retries = options.retries ?? DEFAULTS.retries;
  const retryDelayMs = options.retryDelayMs ?? DEFAULTS.retryDelayMs;
  const cacheSize = options.cacheSize ?? DEFAULTS.cacheSize;
  const newId = options.newId ?? ((): string => crypto.randomUUID());
  const isTrusted = options.isTrusted ?? ((event: Event): boolean => event.isTrusted);

  /** Clé : vidéo demandée ; ordre d'insertion = ancienneté d'usage (LRU) */
  const cache = new Map<string, NetflixShowMetadata>();
  const inFlight = new Map<string, Promise<NetflixShowMetadata | null>>();
  /** Canal privé vers le pont, une fois ouvert ; réponses aiguillées par identifiant de corrélation */
  let port: MessagePort | null = null;
  let opening: Promise<MessagePort | null> | null = null;
  const pending = new Map<string, (response: NetflixBridgeResponse) => void>();

  function remember(movieId: string, show: NetflixShowMetadata): void {
    cache.delete(movieId);
    cache.set(movieId, show);
    while (cache.size > cacheSize) {
      const oldest = cache.keys().next();
      if (oldest.done) break;
      cache.delete(oldest.value);
    }
  }

  function peek(movieId: string): NetflixShowMetadata | null {
    const direct = cache.get(movieId);
    if (direct) {
      remember(movieId, direct);
      return direct;
    }
    // Autre épisode d'une série déjà chargée (lecture automatique)
    for (const show of [...cache.values()].reverse()) {
      if (containsMovie(show, movieId)) {
        remember(movieId, show);
        return show;
      }
    }
    return null;
  }

  // Le port transféré est aussi visible des écouteurs `message` de la page : un MessageEvent synthétique
  // qu'elle déclencherait sur ce port (dispatchEvent) n'est pas « trusted » et reste ignoré
  function onPortMessage(event: Event): void {
    if (!(event instanceof MessageEvent) || !isTrusted(event)) return;
    const response = decodeNetflixResponse(event.data);
    if (response) pending.get(response.id)?.(response);
  }

  /**
   * Ouvre le canal : demande d'ouverture avec un nonce neuf, puis PREMIER port offert pour ce nonce (les offres
   * suivantes ne sont plus écoutées). Pont absent ou pas encore prêt : null après `timeoutMs`, nouvel essai à la
   * tentative suivante (nouveau nonce).
   */
  function openChannel(): Promise<MessagePort | null> {
    const nonce = newId();
    return new Promise((resolve) => {
      const done = (offered: MessagePort | null): void => {
        clearTimeout(timer);
        messages.removeEventListener('message', onOffer);
        resolve(offered);
      };
      const onOffer = (event: Event): void => {
        // Offre synthétique (dispatchEvent) : elle passerait avant le vrai postMessage du pont → refusée
        if (!(event instanceof MessageEvent) || !isTrusted(event) || event.origin !== origin) return;
        if (decodeNetflixPortOffer(event.data)?.nonce !== nonce) return;
        const [offered] = event.ports;
        if (offered instanceof MessagePort) done(offered);
      };
      const timer = setTimeout(() => done(null), timeoutMs);
      messages.addEventListener('message', onOffer);
      target.dispatchEvent(new CustomEvent(NETFLIX_HANDSHAKE_EVENT, { detail: encodeNetflixHandshake({ v: NETFLIX_BRIDGE_VERSION, nonce }) }));
    });
  }

  /** Canal ouvert, ou ouverture en cours partagée entre les demandes simultanées */
  function connect(): Promise<MessagePort | null> {
    if (port) return Promise.resolve(port);
    opening ??= openChannel().then((offered) => {
      opening = null;
      if (offered) {
        port = offered;
        offered.addEventListener('message', onPortMessage);
        offered.start(); // Obligatoire avec addEventListener (onmessage le ferait implicitement)
      }
      return offered;
    });
    return opening;
  }

  /** Une demande au script MAIN ; l'attente de la réponse est toujours retirée */
  function attempt(movieId: string): Promise<Attempt> {
    const id = newId();
    return new Promise((resolve) => {
      let settled = false;
      const finish = (result: Attempt): void => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        pending.delete(id);
        resolve(result);
      };
      const timer = setTimeout(() => finish({ ok: false, retry: true }), timeoutMs);
      pending.set(id, (response) => {
        if (!response.ok) return finish({ ok: false, retry: retryable(response) });
        // Réponse décrivant une autre série ou un autre film (bande-annonce, /watch/{id de série}…) : rejetée
        finish(containsMovie(response.data, movieId) ? { ok: true, data: response.data } : { ok: false, retry: false });
      });
      void connect().then((channel) => {
        if (settled) return;
        if (!channel) return finish({ ok: false, retry: true });
        channel.postMessage(encodeNetflixRequest({ v: NETFLIX_BRIDGE_VERSION, id, movieId }));
      });
    });
  }

  async function fetchShow(movieId: string): Promise<NetflixShowMetadata | null> {
    for (let index = 0; index <= retries; index++) {
      if (index > 0) await new Promise((resolve) => setTimeout(resolve, retryDelayMs * index));
      const result = await attempt(movieId);
      if (result.ok) {
        remember(movieId, result.data);
        return result.data;
      }
      if (!result.retry) return null;
    }
    return null;
  }

  function load(movieId: string, signal: AbortSignal): Promise<NetflixShowMetadata | null> {
    if (!NETFLIX_MOVIE_ID_REGEX.test(movieId)) return Promise.resolve(null);
    const cached = peek(movieId);
    if (cached) return Promise.resolve(cached);
    let pendingShow = inFlight.get(movieId);
    if (!pendingShow) {
      pendingShow = fetchShow(movieId).finally(() => inFlight.delete(movieId));
      inFlight.set(movieId, pendingShow);
    }
    return untilAborted(pendingShow, signal);
  }

  return { load, peek };
}
