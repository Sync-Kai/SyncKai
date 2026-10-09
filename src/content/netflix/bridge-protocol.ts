// Protocole du pont Netflix entre le script de la page (monde MAIN, page-bridge.iife.ts) et le script de
// contenu isolé (content-netflix.iife.ts). Module PUR : aucun accès au DOM ni à chrome.*, importé des deux côtés.
//
// Canal privé (MessageChannel) : les demandes et réponses ne passent jamais par un événement visible de la page.
// 1. Le client isolé émet NETFLIX_HANDSHAKE_EVENT (CustomEvent sur `document`) avec un nonce aléatoire.
// 2. Le pont (écouteur en capture sur `window`, posé à `document_start` avant tout script de la page : il passe
//    en premier) crée un MessageChannel, garde port1 et transfère port2 par
//    `window.postMessage(offre, location.origin, [port2])`.
// 3. Le client n'accepte que le PREMIER port reçu pour son nonce, par un vrai postMessage (`isTrusted`) : une
//    offre forgée par la page arrive forcément après, un événement synthétique (dispatchEvent) est refusé.
// Toutes les charges utiles sont des CHAÎNES JSON (Firefox : un objet créé dans un monde n'est pas lisible tel
// quel dans l'autre, à cause des Xray wrappers ; une chaîne est copiée).
import { isRecord } from '../../shared/guards';

export const NETFLIX_BRIDGE_VERSION = 1;
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

/** Identifiant de vidéo Netflix (/watch/{id}) */
export const NETFLIX_MOVIE_ID_REGEX = /^\d{1,12}$/;

/** Bornes de la réduction : textes tronqués, nombre total d'épisodes et de saisons limité */
export const NETFLIX_MAX_TEXT = 300;
export const NETFLIX_MAX_EPISODES = 2000;
export const NETFLIX_MAX_SEASONS = 200;
const MAX_ID_LENGTH = 64;

export interface NetflixEpisodeMetadata {
  /** Identifiant de lecture (/watch/{id}) */
  id: string;
  /** Numéro dans la saison */
  seq: number;
  title: string | null;
  /** Durée (s) */
  runtime: number | null;
  /** Début du générique de fin (s) */
  creditsOffset: number | null;
}

export interface NetflixSeasonMetadata {
  seq: number;
  title: string | null;
  episodes: NetflixEpisodeMetadata[];
}

/**
 * Métadonnées réduites d'une série ou d'un film : seuls ces champs quittent le monde MAIN.
 * Jamais d'authURL, d'artwork, de synopsis, de skipMarkers ni de donnée de compte.
 */
export interface NetflixShowMetadata {
  showId: string;
  type: 'show' | 'movie';
  title: string;
  /** Film : durée (s) ; série : null */
  runtime: number | null;
  /** Film : début du générique (s) ; série : null */
  creditsOffset: number | null;
  /** Film : [] */
  seasons: NetflixSeasonMetadata[];
}

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
}

export type NetflixBridgeError = 'http' | 'network' | 'shape';

export type NetflixBridgeResponse =
  | { v: typeof NETFLIX_BRIDGE_VERSION; id: string; ok: true; data: NetflixShowMetadata }
  | { v: typeof NETFLIX_BRIDGE_VERSION; id: string; ok: false; error: NetflixBridgeError; status?: number };

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

/** Durée en secondes (> 0), sinon null */
function seconds(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null;
}

/** Numéro d'ordre (entier ≥ 0), sinon null */
function sequence(value: unknown): number | null {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : null;
}

/**
 * Réduit la réponse de `/nq/website/memberapi/release/metadata` (`{ video: {…} }`) à `NetflixShowMetadata`.
 * Null si la forme est inattendue. Les épisodes au-delà de NETFLIX_MAX_EPISODES (au total) sont ignorés.
 */
export function reduceNetflixMetadata(raw: unknown): NetflixShowMetadata | null {
  const video = isRecord(raw) ? raw.video : null;
  if (!isRecord(video)) return null;
  const showId = numericId(video.id);
  const title = text(video.title);
  const type = video.type === 'show' || video.type === 'movie' ? video.type : null;
  if (!showId || !title || !type) return null;

  if (type === 'movie') {
    return { showId, type, title, runtime: seconds(video.runtime), creditsOffset: seconds(video.creditsOffset), seasons: [] };
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
      });
      episodeCount++;
    }
    seasons.push({ seq: sequence(rawSeason.seq) ?? seasonIndex + 1, title: text(rawSeason.title) ?? text(rawSeason.longName), episodes });
  }
  return { showId, type, title, runtime: null, creditsOffset: null, seasons };
}

// ─── Revalidation (monde isolé : la page peut émettre n'importe quoi) ─────

const isBoundedText = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && v.length <= NETFLIX_MAX_TEXT;
const isNullableText = (v: unknown): v is string | null => v === null || isBoundedText(v);
const isNullableSeconds = (v: unknown): v is number | null => v === null || seconds(v) !== null;
const isId = (v: unknown): v is string => typeof v === 'string' && NETFLIX_MOVIE_ID_REGEX.test(v);

function isEpisodeMetadata(value: unknown): value is NetflixEpisodeMetadata {
  return (
    isRecord(value) &&
    isId(value.id) &&
    sequence(value.seq) !== null &&
    isNullableText(value.title) &&
    isNullableSeconds(value.runtime) &&
    isNullableSeconds(value.creditsOffset)
  );
}

function isSeasonMetadata(value: unknown): value is NetflixSeasonMetadata {
  return isRecord(value) && sequence(value.seq) !== null && isNullableText(value.title) && Array.isArray(value.episodes) && value.episodes.every(isEpisodeMetadata);
}

export function isNetflixShowMetadata(value: unknown): value is NetflixShowMetadata {
  if (
    !isRecord(value) ||
    !isId(value.showId) ||
    (value.type !== 'show' && value.type !== 'movie') ||
    !isBoundedText(value.title) ||
    !isNullableSeconds(value.runtime) ||
    !isNullableSeconds(value.creditsOffset) ||
    !Array.isArray(value.seasons) ||
    value.seasons.length > NETFLIX_MAX_SEASONS ||
    !value.seasons.every(isSeasonMetadata)
  ) {
    return false;
  }
  const seasons: NetflixSeasonMetadata[] = value.seasons;
  return seasons.reduce((total, season) => total + season.episodes.length, 0) <= NETFLIX_MAX_EPISODES;
}

// ─── Messages (chaînes JSON) ──────────────────────────────────────────────

function parseJson(detail: unknown): unknown {
  if (typeof detail !== 'string' || detail.length > 2_000_000) return null;
  try {
    return JSON.parse(detail);
  } catch {
    return null;
  }
}

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
  return { v: NETFLIX_BRIDGE_VERSION, id: value.id, movieId: value.movieId };
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
