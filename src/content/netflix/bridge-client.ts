// Client du pont Netflix, côté script de contenu isolé : demande les métadonnées au script du monde MAIN
// (page-bridge.iife.ts) sur un canal privé (MessageChannel, voir bridge-protocol.ts) et revalide la réponse.
// Délai par tentative de 12 s, supérieur au fetch du pont (10 s) : une réponse lente mais valide est toujours
// reçue par la tentative qui l'a demandée. 2 nouvelles tentatives (pont muet ou pas encore prêt, réseau, 5xx,
// 429), une seule requête en vol par vidéo, cache LRU des 5 dernières séries (la réponse décrit toute la série :
// l'épisode suivant de la lecture automatique est servi sans nouvelle requête).
// Page de série (/title/{id}, fenêtre de détail ?jbv={id}) : même requête avec l'identifiant de la série (`loadShow`),
// réponse acceptée seulement si elle décrit cette série ; même cache et même requête en vol.
import { keep } from '../../shared/lru';
import { createBridgeConnection, untilAborted, type ChannelEndpoints } from '../bridge/client-kit';
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

export interface NetflixBridgeClientOptions extends ChannelEndpoints {
  /** Délai d'une tentative (ouverture du canal comprise) ; doit rester supérieur à NETFLIX_FETCH_TIMEOUT_MS */
  timeoutMs?: number;
  /** Nouvelles tentatives après un délai dépassé ou une erreur passagère */
  retries?: number;
  retryDelayMs?: number;
  cacheSize?: number;
  /** Identifiants de corrélation et nonces d'ouverture */
  newId?: () => string;
}

export interface NetflixBridgeClient {
  /** Métadonnées de la série (ou du film) contenant cette vidéo ; null si indisponibles ou annulé */
  load(movieId: string, signal: AbortSignal): Promise<NetflixShowMetadata | null>;
  /** Lecture synchrone du cache, sans requête */
  peek(movieId: string): NetflixShowMetadata | null;
  /** Métadonnées de la série (ou du film) `showId` elle-même (page de série) ; null si indisponibles ou annulé */
  loadShow(showId: string, signal: AbortSignal): Promise<NetflixShowMetadata | null>;
  /** Lecture synchrone du cache pour une page de série, sans requête */
  peekShow(showId: string): NetflixShowMetadata | null;
  /**
   * Import de l'historique : série (ou film) contenant cette vidéo AVEC les points de lecture du profil (`bookmark`).
   * Jamais mise en cache ni partagée avec la synchro en direct ; null si indisponible ou annulé.
   */
  loadHistory(movieId: string, signal: AbortSignal): Promise<NetflixShowMetadata | null>;
}

const DEFAULTS = { timeoutMs: NETFLIX_ATTEMPT_TIMEOUT_MS, retries: 2, retryDelayMs: 500, cacheSize: 5 } as const;

/** Échec d'une tentative : `retry` si une nouvelle tentative a un sens (délai, réseau, erreur serveur) */
type Attempt = { ok: true; data: NetflixShowMetadata } | { ok: false; retry: boolean };

/** Vrai si la série (ou le film) contient la vidéo demandée */
export function containsMovie(show: NetflixShowMetadata, movieId: string): boolean {
  if (show.type === 'movie') return show.showId === movieId;
  return show.seasons.some((season) => season.episodes.some((episode) => episode.id === movieId));
}

/** Réponse attendue : la série contenant la vidéo (lecture), ou la série elle-même (page de série) */
type Wanted = 'movie' | 'show';

const accepts = (show: NetflixShowMetadata, id: string, wanted: Wanted): boolean => (wanted === 'show' ? show.showId === id : containsMovie(show, id));

function retryable(response: Extract<NetflixBridgeResponse, { ok: false }>): boolean {
  if (response.error === 'network') return true;
  if (response.error === 'http') return response.status === undefined || response.status === 429 || response.status >= 500;
  return false; // Forme inattendue : une nouvelle tentative donnerait la même réponse
}

export function createNetflixBridgeClient(options: NetflixBridgeClientOptions): NetflixBridgeClient {
  const timeoutMs = options.timeoutMs ?? DEFAULTS.timeoutMs;
  const retries = options.retries ?? DEFAULTS.retries;
  const retryDelayMs = options.retryDelayMs ?? DEFAULTS.retryDelayMs;
  const cacheSize = options.cacheSize ?? DEFAULTS.cacheSize;
  const newId = options.newId ?? ((): string => crypto.randomUUID());

  /** Clé : vidéo demandée ; ordre d'insertion = ancienneté d'usage (LRU) */
  const cache = new Map<string, NetflixShowMetadata>();
  const inFlight = new Map<string, Promise<NetflixShowMetadata | null>>();
  /** Réponses aiguillées par identifiant de corrélation */
  const pending = new Map<string, (response: NetflixBridgeResponse) => void>();

  const remember = (movieId: string, show: NetflixShowMetadata): void => keep(cache, movieId, show, cacheSize);

  function peek(movieId: string): NetflixShowMetadata | null {
    const direct = cache.get(movieId);
    // Entrée d'une page de série (clé = identifiant de la série) : ne vaut pas pour la lecture de /watch/{id de série}
    if (direct && containsMovie(direct, movieId)) {
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

  function peekShow(showId: string): NetflixShowMetadata | null {
    const show = [...cache.values()].findLast((known) => known.showId === showId) ?? null;
    if (show) remember(showId, show);
    return show;
  }

  /**
   * Canal privé vers le pont (content/bridge/client-kit.ts) : PREMIER port offert pour un nonce neuf. Pont absent ou pas
   * encore prêt : null après `timeoutMs`, nouvel essai à la tentative suivante (nouveau nonce).
   */
  const connect = createBridgeConnection({
    endpoints: options,
    event: NETFLIX_HANDSHAKE_EVENT,
    handshake: (nonce) => encodeNetflixHandshake({ v: NETFLIX_BRIDGE_VERSION, nonce }),
    isOffer: (data, nonce) => decodeNetflixPortOffer(data)?.nonce === nonce,
    timeoutMs,
    newId,
    onMessage: (data) => {
      const response = decodeNetflixResponse(data);
      if (response) pending.get(response.id)?.(response);
    },
  });

  /** Une demande au script MAIN ; l'attente de la réponse est toujours retirée */
  function attempt(movieId: string, wanted: Wanted, bookmarks: boolean): Promise<Attempt> {
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
        finish(accepts(response.data, movieId, wanted) ? { ok: true, data: response.data } : { ok: false, retry: false });
      });
      void connect().then((channel) => {
        if (settled) return;
        if (!channel) return finish({ ok: false, retry: true });
        channel.postMessage(encodeNetflixRequest({ v: NETFLIX_BRIDGE_VERSION, id, movieId, ...(bookmarks ? { bookmarks: true } : {}) }));
      });
    });
  }

  async function fetchShow(movieId: string, wanted: Wanted, bookmarks = false): Promise<NetflixShowMetadata | null> {
    for (let index = 0; index <= retries; index++) {
      if (index > 0) await new Promise((resolve) => setTimeout(resolve, retryDelayMs * index));
      const result = await attempt(movieId, wanted, bookmarks);
      if (result.ok) {
        // Points de lecture (import) : jamais dans le cache de la synchro en direct
        if (!bookmarks) remember(movieId, result.data);
        return result.data;
      }
      if (!result.retry) return null;
    }
    return null;
  }

  function request(id: string, wanted: Wanted, signal: AbortSignal): Promise<NetflixShowMetadata | null> {
    if (!NETFLIX_MOVIE_ID_REGEX.test(id)) return Promise.resolve(null);
    const cached = wanted === 'show' ? peekShow(id) : peek(id);
    if (cached) return Promise.resolve(cached);
    const key = `${wanted}:${id}`;
    let pendingShow = inFlight.get(key);
    if (!pendingShow) {
      pendingShow = fetchShow(id, wanted).finally(() => inFlight.delete(key));
      inFlight.set(key, pendingShow);
    }
    return untilAborted(pendingShow, signal);
  }

  return {
    load: (movieId, signal) => request(movieId, 'movie', signal),
    peek,
    loadShow: (showId, signal) => request(showId, 'show', signal),
    peekShow,
    loadHistory: (movieId, signal) => (NETFLIX_MOVIE_ID_REGEX.test(movieId) ? untilAborted(fetchShow(movieId, 'movie', true), signal) : Promise.resolve(null)),
  };
}
