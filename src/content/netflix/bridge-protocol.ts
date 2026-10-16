// Protocole du pont Netflix entre le script de la page (monde MAIN, page-bridge.iife.ts) et le script de
// contenu isolé (content-netflix.iife.ts). Module PUR : aucun accès au DOM ni à chrome.*, importé des deux côtés.
//
// Canal privé (MessageChannel) : les demandes et réponses ne passent jamais par un événement visible de la page.
// 1. Le client isolé émet NETFLIX_HANDSHAKE_EVENT (CustomEvent sur `document`) avec un nonce aléatoire.
// 2. Le pont (écouteur en capture sur `window`, posé à `document_start` avant tout script de la page : il passe
//    en premier) crée un MessageChannel, garde port1 et transfère port2 par
//    `window.postMessage(offre, location.origin, [port2])`.
// 3. Le client n'accepte que le PREMIER port reçu pour son nonce, par un vrai postMessage (`isTrusted`) : un
//    événement synthétique (dispatchEvent) est refusé ; une offre postée par la page n'arrive après la nôtre que si le
//    pont a été posé avant ses scripts (`document_start`), le nonce étant lisible par la page.
// Toutes les charges utiles sont des CHAÎNES JSON (Firefox : un objet créé dans un monde n'est pas lisible tel
// quel dans l'autre, à cause des Xray wrappers ; une chaîne est copiée). Ce qui arrive du monde MAIN est une donnée que
// la page aurait pu écrire : revalidée ici, jamais seule preuve d'une correspondance (content/bridge/kit.ts).
import { isRecord, parseJsonBounded } from '../../shared/guards';
import { isSignalYear } from '../../shared/match-signals';
import {
  isNetflixShowMetadata,
  NETFLIX_MAX_EPISODES,
  NETFLIX_MAX_SEASONS,
  NETFLIX_MAX_TEXT,
  NETFLIX_MOVIE_ID_REGEX,
  seconds,
  sequence,
  type NetflixBookmark,
  type NetflixEpisodeMetadata,
  type NetflixSeasonMetadata,
  type NetflixShowMetadata,
} from '../../platforms/netflix/metadata';

// Types et revalidation de la forme réduite : platforms/netflix/metadata.ts (la page d'import les relit aussi)
export {
  isNetflixShowMetadata,
  NETFLIX_MAX_EPISODES,
  NETFLIX_MAX_SEASONS,
  NETFLIX_MAX_TEXT,
  NETFLIX_MOVIE_ID_REGEX,
  type NetflixBookmark,
  type NetflixEpisodeMetadata,
  type NetflixSeasonMetadata,
  type NetflixShowMetadata,
} from '../../platforms/netflix/metadata';

/**
 * Version du protocole, à incrémenter à tout changement des messages ou de la forme réduite : le pont MAIN d'une
 * version précédente reste dans les onglets ouverts après une mise à jour (code de la page, jamais invalidé) et
 * répondrait au nouveau client. Chaque côté ignore les messages d'une autre version.
 * v2 (2026-10-12) : demande `bookmarks` et points de lecture `bookmark` (import de l'historique).
 * v3 (2026-10-14) : année de début d'origine de chaque saison (`year`, signaux de correspondance).
 * v4 (2026-10-16) : kit des ponts (content/bridge/kit.ts), réponse relue sans prototype hérité.
 */
export const NETFLIX_BRIDGE_VERSION = 4;
/** Ouverture du canal (client isolé → pont), detail = NetflixHandshake en chaîne JSON */
export const NETFLIX_HANDSHAKE_EVENT = 'synckai:netflix:handshake';
/** Type du message `window.postMessage` qui transfère port2 (pont → client isolé) */
export const NETFLIX_PORT_OFFER = 'synckai:netflix:port';

/** Délai du fetch des métadonnées côté MAIN (page-bridge.iife.ts) */
export const NETFLIX_FETCH_TIMEOUT_MS = 10_000;
/**
 * Délai d'une tentative côté client isolé : strictement supérieur au fetch, pour qu'une réponse lente mais
 * valide arrive avant l'abandon (sinon elle porterait l'identifiant d'une tentative close et serait perdue).
 */
export const NETFLIX_ATTEMPT_TIMEOUT_MS = NETFLIX_FETCH_TIMEOUT_MS + 2_000;

const MAX_ID_LENGTH = 64;

export interface NetflixHandshake {
  v: typeof NETFLIX_BRIDGE_VERSION;
  /** Aléatoire (crypto.randomUUID) : relie l'offre de port à cette demande d'ouverture */
  nonce: string;
}

export interface NetflixPortOffer {
  v: typeof NETFLIX_BRIDGE_VERSION;
  type: typeof NETFLIX_PORT_OFFER;
  nonce: string;
}

export interface NetflixBridgeRequest {
  v: typeof NETFLIX_BRIDGE_VERSION;
  /** Corrélation requête ↔ réponse (crypto.randomUUID) */
  id: string;
  movieId: string;
  /**
   * Import de l'historique seulement (v2) : points de lecture du profil joints à chaque épisode (`bookmark`).
   * Jamais envoyé par la synchro en direct.
   */
  bookmarks?: true;
}

export type NetflixBridgeError = 'http' | 'network' | 'shape';

export type NetflixBridgeResponse =
  | { v: typeof NETFLIX_BRIDGE_VERSION; id: string; ok: true; data: NetflixShowMetadata }
  | { v: typeof NETFLIX_BRIDGE_VERSION; id: string; ok: false; error: NetflixBridgeError; status?: number };

// ─── Installation du pont (une fois par version de protocole) ─────────────

/**
 * Garde d'installation du pont pour une version du protocole. La version 1 garde la clé historique
 * (`synckai.netflix.bridge`) : un pont v1 déjà présent dans la page n'est pas installé une seconde fois.
 */
export function netflixBridgeFlag(version: number): symbol {
  return Symbol.for(version === 1 ? 'synckai.netflix.bridge' : `synckai.netflix.bridge.v${version}`);
}

// ─── Réduction de la réponse brute (exécutée dans le monde MAIN) ──────────

/** Texte nettoyé et tronqué ; null si absent ou vide */
function text(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const cleaned = value.replace(/\s+/g, ' ').trim();
  return cleaned ? cleaned.slice(0, NETFLIX_MAX_TEXT) : null;
}

/** Identifiant numérique Netflix (nombre ou chaîne) → chaîne, sinon null */
function numericId(value: unknown): string | null {
  const id = typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? String(value) : value;
  return typeof id === 'string' && NETFLIX_MOVIE_ID_REGEX.test(id) ? id : null;
}

/**
 * Point de lecture brut (`bookmark: { offset, watchedDate }`, `watchedToEndOffset` à côté) → NetflixBookmark ;
 * null si jamais regardé (`offset` -1 ou absent). La date du visionnage n'est pas gardée.
 */
function bookmarkOf(owner: Record<string, unknown>): NetflixBookmark | null {
  const offset = isRecord(owner.bookmark) ? owner.bookmark.offset : null;
  return typeof offset === 'number' && Number.isFinite(offset) && offset >= 0 ? { offset, watchedToEndOffset: seconds(owner.watchedToEndOffset) } : null;
}

/**
 * Réduit la réponse de `/nq/website/memberapi/release/metadata` (`{ video: {…} }`) à `NetflixShowMetadata`.
 * Null si la forme est inattendue. Les épisodes au-delà de NETFLIX_MAX_EPISODES (au total) sont ignorés.
 * `bookmarks` (import de l'historique seulement) : point de lecture joint à chaque épisode (au film).
 */
export function reduceNetflixMetadata(raw: unknown, bookmarks = false): NetflixShowMetadata | null {
  const video = isRecord(raw) ? raw.video : null;
  if (!isRecord(video)) return null;
  const showId = numericId(video.id);
  const title = text(video.title);
  const type = video.type === 'show' || video.type === 'movie' ? video.type : null;
  if (!showId || !title || !type) return null;

  if (type === 'movie') {
    return { showId, type, title, runtime: seconds(video.runtime), creditsOffset: seconds(video.creditsOffset), seasons: [], ...(bookmarks ? { bookmark: bookmarkOf(video) } : {}) };
  }

  if (!Array.isArray(video.seasons)) return null;
  const seasons: NetflixSeasonMetadata[] = [];
  let episodeCount = 0;
  for (const [seasonIndex, rawSeason] of video.seasons.slice(0, NETFLIX_MAX_SEASONS).entries()) {
    if (!isRecord(rawSeason)) continue;
    const episodes: NetflixEpisodeMetadata[] = [];
    const rawEpisodes: unknown[] = Array.isArray(rawSeason.episodes) ? rawSeason.episodes : [];
    for (const [episodeIndex, rawEpisode] of rawEpisodes.entries()) {
      if (episodeCount >= NETFLIX_MAX_EPISODES) break;
      if (!isRecord(rawEpisode)) continue;
      const id = numericId(rawEpisode.id);
      if (!id) continue;
      episodes.push({
        id,
        seq: sequence(rawEpisode.seq) ?? episodeIndex + 1,
        title: text(rawEpisode.title),
        runtime: seconds(rawEpisode.runtime),
        creditsOffset: seconds(rawEpisode.creditsOffset),
        ...(bookmarks ? { bookmark: bookmarkOf(rawEpisode) } : {}),
      });
      episodeCount++;
    }
    const year = isSignalYear(rawSeason.year) ? rawSeason.year : undefined;
    seasons.push({ seq: sequence(rawSeason.seq) ?? seasonIndex + 1, title: text(rawSeason.title) ?? text(rawSeason.longName), ...(year !== undefined ? { year } : {}), episodes });
  }
  return { showId, type, title, runtime: null, creditsOffset: null, seasons };
}

// ─── Messages (chaînes JSON) ──────────────────────────────────────────────

const parseJson = (detail: unknown): unknown => parseJsonBounded(detail, 2_000_000);

const isId = (v: unknown): v is string => typeof v === 'string' && NETFLIX_MOVIE_ID_REGEX.test(v);
const isCorrelationId = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && v.length <= MAX_ID_LENGTH;

export function encodeNetflixHandshake(handshake: NetflixHandshake): string {
  return JSON.stringify(handshake);
}

export function decodeNetflixHandshake(detail: unknown): NetflixHandshake | null {
  const value = parseJson(detail);
  if (!isRecord(value) || value.v !== NETFLIX_BRIDGE_VERSION || !isCorrelationId(value.nonce)) return null;
  return { v: NETFLIX_BRIDGE_VERSION, nonce: value.nonce };
}

export function encodeNetflixPortOffer(offer: NetflixPortOffer): string {
  return JSON.stringify(offer);
}

/** Message `window.postMessage` quelconque (la page en émet d'autres) → offre de port, ou null */
export function decodeNetflixPortOffer(data: unknown): NetflixPortOffer | null {
  // Filtre bon marché avant JSON.parse : la plupart des messages de la page ne sont pas des chaînes
  if (typeof data !== 'string' || !data.includes(NETFLIX_PORT_OFFER) || data.length > 1_000) return null;
  const value = parseJson(data);
  if (!isRecord(value) || value.v !== NETFLIX_BRIDGE_VERSION || value.type !== NETFLIX_PORT_OFFER || !isCorrelationId(value.nonce)) return null;
  return { v: NETFLIX_BRIDGE_VERSION, type: NETFLIX_PORT_OFFER, nonce: value.nonce };
}

export function encodeNetflixRequest(request: NetflixBridgeRequest): string {
  return JSON.stringify(request);
}

export function decodeNetflixRequest(detail: unknown): NetflixBridgeRequest | null {
  const value = parseJson(detail);
  if (!isRecord(value) || value.v !== NETFLIX_BRIDGE_VERSION || !isCorrelationId(value.id) || !isId(value.movieId)) return null;
  return { v: NETFLIX_BRIDGE_VERSION, id: value.id, movieId: value.movieId, ...(value.bookmarks === true ? { bookmarks: true } : {}) };
}

export function encodeNetflixResponse(response: NetflixBridgeResponse): string {
  return JSON.stringify(response);
}

export function decodeNetflixResponse(detail: unknown): NetflixBridgeResponse | null {
  const value = parseJson(detail);
  if (!isRecord(value) || value.v !== NETFLIX_BRIDGE_VERSION || !isCorrelationId(value.id)) return null;
  if (value.ok === true) {
    return isNetflixShowMetadata(value.data) ? { v: NETFLIX_BRIDGE_VERSION, id: value.id, ok: true, data: value.data } : null;
  }
  if (value.ok !== false || (value.error !== 'http' && value.error !== 'network' && value.error !== 'shape')) return null;
  const status = typeof value.status === 'number' && Number.isInteger(value.status) ? value.status : undefined;
  return { v: NETFLIX_BRIDGE_VERSION, id: value.id, ok: false, error: value.error, ...(status !== undefined ? { status } : {}) };
}
