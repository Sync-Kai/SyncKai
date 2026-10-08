// Client du pont Netflix, côté script de contenu isolé : demande les métadonnées au script du monde MAIN
// (page-bridge.iife.ts) et revalide la réponse. Délai de 5 s, 2 nouvelles tentatives, une seule requête
// en vol par vidéo, cache LRU des 5 dernières séries (la réponse décrit toute la série : l'épisode suivant
// de la lecture automatique est servi sans nouvelle requête).
import {
  decodeNetflixResponse,
  encodeNetflixRequest,
  NETFLIX_BRIDGE_VERSION,
  NETFLIX_MOVIE_ID_REGEX,
  NETFLIX_REQUEST_EVENT,
  NETFLIX_RESPONSE_EVENT,
  type NetflixBridgeResponse,
  type NetflixShowMetadata,
} from './bridge-protocol';

export interface NetflixBridgeClientOptions {
  /** Cible des événements (document en production, faux document dans les tests) */
  target: EventTarget;
  timeoutMs?: number;
  /** Nouvelles tentatives après un délai dépassé ou une erreur passagère */
  retries?: number;
  retryDelayMs?: number;
  cacheSize?: number;
  newId?: () => string;
}

export interface NetflixBridgeClient {
  /** Métadonnées de la série (ou du film) contenant cette vidéo ; null si indisponibles ou annulé */
  load(movieId: string, signal: AbortSignal): Promise<NetflixShowMetadata | null>;
  /** Lecture synchrone du cache, sans requête */
  peek(movieId: string): NetflixShowMetadata | null;
}

const DEFAULTS = { timeoutMs: 5_000, retries: 2, retryDelayMs: 500, cacheSize: 5 } as const;

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
  const { target } = options;
  const timeoutMs = options.timeoutMs ?? DEFAULTS.timeoutMs;
  const retries = options.retries ?? DEFAULTS.retries;
  const retryDelayMs = options.retryDelayMs ?? DEFAULTS.retryDelayMs;
  const cacheSize = options.cacheSize ?? DEFAULTS.cacheSize;
  const newId = options.newId ?? ((): string => crypto.randomUUID());

  /** Clé : vidéo demandée ; ordre d'insertion = ancienneté d'usage (LRU) */
  const cache = new Map<string, NetflixShowMetadata>();
  const inFlight = new Map<string, Promise<NetflixShowMetadata | null>>();

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

  /** Une demande au script MAIN ; l'écouteur est toujours retiré */
  function attempt(movieId: string): Promise<Attempt> {
    const id = newId();
    return new Promise((resolve) => {
      const finish = (result: Attempt): void => {
        clearTimeout(timer);
        target.removeEventListener(NETFLIX_RESPONSE_EVENT, onResponse);
        resolve(result);
      };
      const onResponse = (event: Event): void => {
        if (!(event instanceof CustomEvent)) return;
        const response = decodeNetflixResponse(event.detail);
        if (!response || response.id !== id) return; // Réponse à une autre demande, ou forme invalide
        finish(response.ok ? { ok: true, data: response.data } : { ok: false, retry: retryable(response) });
      };
      const timer = setTimeout(() => finish({ ok: false, retry: true }), timeoutMs);
      target.addEventListener(NETFLIX_RESPONSE_EVENT, onResponse);
      target.dispatchEvent(new CustomEvent(NETFLIX_REQUEST_EVENT, { detail: encodeNetflixRequest({ v: NETFLIX_BRIDGE_VERSION, id, movieId }) }));
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
    let pending = inFlight.get(movieId);
    if (!pending) {
      pending = fetchShow(movieId).finally(() => inFlight.delete(movieId));
      inFlight.set(movieId, pending);
    }
    return untilAborted(pending, signal);
  }

  return { load, peek };
}
