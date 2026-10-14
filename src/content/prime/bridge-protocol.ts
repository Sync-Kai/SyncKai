// Protocole du pont Prime Video entre le script de la page (monde MAIN, page-bridge.iife.ts) et le script de contenu
// isolé (content-prime.iife.ts). Module PUR : aucun accès au DOM ni à chrome.*, importé des deux côtés.
//
// Le pont est PASSIF : il n'émet aucune requête. Il lit la réponse JSON de quatre requêtes que le site envoie lui-même
// et n'en garde que la forme réduite, jamais les en-têtes, jetons, cookies, URL de flux, licences ni données de compte :
// - `…primevideo.com/…/detail/{id}` (navigation SPA, JSON de la page de détail) → PrimeTitle (shared/prime-metadata.ts) ;
// - `…primevideo.com/…/api/getDetailWidgets?titleID=…` (à chaque changement d'épisode) → PrimeDetailWidgets ;
// - `atv-ps-*.primevideo.com/cdp/lumina/playerChromeResources/v1?entityId=…` : `resources.catalogMetadataV2.catalog`
//   SEUL (série, saison, épisode de la vidéo en lecture), indexé par `entityId` de la requête (l'épisode : supposé) ;
// - `atv-ps-*.primevideo.com/playback/prs/GetVodPlaybackResources?titleId=…` : début de `END_CREDITS` et
//   `fullTitleDurationMs` SEULS, indexés par `titleId` de la requête. Cette réponse arrive pour l'épisode SUIVANT environ
//   1 s avant la bascule : elle n'est jamais attribuée à « l'épisode en cours », seulement à son identifiant.
//
// Canal privé (MessageChannel), même ouverture que les ponts Netflix et Disney+ :
// 1. Le client isolé émet PRIME_HANDSHAKE_EVENT (CustomEvent sur `document`) avec un nonce aléatoire.
// 2. Le pont (écouteur en capture sur `window`, posé à `document_start`) crée un MessageChannel, garde port1 et
//    transfère port2 par `window.postMessage(offre, location.origin, [port2])`.
// 3. Le client n'accepte que le PREMIER port reçu pour son nonce, par un vrai postMessage (`isTrusted`).
// Ensuite, le pont pousse sur port1 tout ce qu'il a déjà vu (instantané), puis chaque nouveauté. Charges utiles en
// CHAÎNES JSON (Xray wrappers de Firefox).
import { isRecord } from '../../shared/guards';
import {
  isPrimeDetailWidgets,
  isPrimeTitle,
  primeId,
  primeText,
  type PrimeDetailWidgets,
  type PrimeTitle,
} from '../../shared/prime-metadata';
import { stripVersionTags } from '../../shared/title';

/**
 * Version du protocole, à incrémenter à tout changement des messages ou des formes réduites : le pont MAIN d'une
 * version précédente reste dans les onglets ouverts après une mise à jour. Chaque côté ignore les messages d'une autre version.
 */
export const PRIME_BRIDGE_VERSION = 1;
/** Ouverture du canal (client isolé → pont), detail = PrimeHandshake en chaîne JSON */
export const PRIME_HANDSHAKE_EVENT = 'synckai:prime:handshake';
/** Type du message `window.postMessage` qui transfère port2 (pont → client isolé) */
export const PRIME_PORT_OFFER = 'synckai:prime:port';

/** Bornes : fiches gardées et poussées en une fois */
export const PRIME_MAX_CATALOG = 20;
export const PRIME_MAX_PLAYBACK = 20;
export const PRIME_MAX_TITLES = 10;
export const PRIME_MAX_WIDGETS = 5;
const MAX_ID_LENGTH = 64;
/** Durée maximale plausible d'un programme (ms) : 12 h */
const MAX_RUNTIME_MS = 12 * 3_600_000;

/** Métadonnées du lecteur pour une vidéo (`catalogMetadataV2.catalog`), indexées par l'`entityId` de la requête */
export interface PrimeCatalogEntry {
  /** `entityId` de la requête (GTI de l'épisode, supposé ; forme canonique de primeId) */
  id: string;
  /** Réception de la réponse par le pont (ms depuis l'epoch) */
  seenAt: number;
  /** « episode », « movie »… (minuscules) */
  type: string;
  /** Titre de l'épisode (localisé) */
  title: string | null;
  /** Titre de la série, sans mention de version */
  seriesTitle: string | null;
  seasonNumber: number | null;
  episodeNumber: number | null;
}

/** Repères de lecture (`GetVodPlaybackResources`), indexés par le `titleId` de la requête */
export interface PrimePlaybackEntry {
  id: string;
  seenAt: number;
  /** Début de `END_CREDITS` (ms, position du programme), null s'il manque (l'histoire continue après le générique) */
  creditsStartMs: number | null;
  /** `fullTitleDurationMs` */
  durationMs: number | null;
}

/** Titre de détail reçu (réponse `/detail/{id}`) : identifiant du chemin de la requête en plus */
export interface PrimeTitleEntry {
  /** Identifiant du chemin `/detail/{id}` de la requête */
  requestId: string;
  seenAt: number;
  title: PrimeTitle;
}

/** Réponse `getDetailWidgets` reçue */
export interface PrimeWidgetsEntry {
  seenAt: number;
  widgets: PrimeDetailWidgets;
}

export interface PrimeHandshake {
  v: typeof PRIME_BRIDGE_VERSION;
  nonce: string;
}

export interface PrimePortOffer {
  v: typeof PRIME_BRIDGE_VERSION;
  type: typeof PRIME_PORT_OFFER;
  nonce: string;
}

/** Pont → client : nouveautés (instantané à l'ouverture du canal, puis chaque réponse lue) */
export interface PrimeBridgePush {
  v: typeof PRIME_BRIDGE_VERSION;
  catalog: PrimeCatalogEntry[];
  playback: PrimePlaybackEntry[];
  titles: PrimeTitleEntry[];
  widgets: PrimeWidgetsEntry[];
}

// ─── Installation du pont (une fois par version de protocole) ─────────────

export function primeBridgeFlag(version: number): symbol {
  return Symbol.for(`synckai.prime.bridge.v${version}`);
}

/** Installe le pont au plus une fois par version sur ce global (voir installDisneyBridgeOnce). Retourne true si installé. */
export function installPrimeBridgeOnce(global: object, version: number, install: () => void): boolean {
  const flag = primeBridgeFlag(version);
  if (Reflect.get(global, flag)) return false;
  Reflect.defineProperty(global, flag, { value: true });
  install();
  return true;
}

// ─── Requêtes observées (monde MAIN) ──────────────────────────────────────

export type PrimeRequestKind = 'detail' | 'widgets' | 'catalog' | 'playback';

const isPrimeHost = (host: string): boolean => host === 'primevideo.com' || host.endsWith('.primevideo.com');
/** Page de détail (même chemin que la page : la réponse n'est lue que si elle est du JSON) */
const DETAIL_PATH = /^\/(?:region\/[a-z]{2}\/)?(?:-\/[a-z]{2}(?:[-_][a-z]{2})?\/)?detail\/([^/?#]+)\/?$/i;
const WIDGETS_PATH = /^\/(?:region\/[a-z]{2}\/)?(?:-\/[a-z]{2}(?:[-_][a-z]{2})?\/)?api\/getDetailWidgets\/?$/i;
const CATALOG_PATH = /^\/cdp\/lumina\/playerChromeResources\/v\d{1,2}\/?$/i;
const PLAYBACK_PATH = /^\/playback\/prs\/GetVodPlaybackResources\/?$/i;

/**
 * URL d'une requête du site lue par le pont → nature et identifiant (forme canonique de primeId), sinon null. Toute autre
 * requête (licences, sessions de lecture, statistiques, images…) est ignorée sans être lue.
 */
export function observedPrimeRequest(url: string, base = 'https://www.primevideo.com/'): { kind: PrimeRequestKind; id: string } | null {
  let parsed: URL;
  try {
    parsed = new URL(url, base);
  } catch {
    return null;
  }
  const host = parsed.hostname.toLowerCase();
  if (parsed.protocol !== 'https:' || !isPrimeHost(host)) return null;
  const path = parsed.pathname;
  const query = (name: string): string | null => primeId(parsed.searchParams.get(name));
  // Lecteur : hôtes de l'API (atv-ps-eu.primevideo.com…), jamais le site lui-même
  if (host.startsWith('atv-')) {
    const kind: PrimeRequestKind | null = CATALOG_PATH.test(path) ? 'catalog' : PLAYBACK_PATH.test(path) ? 'playback' : null;
    const id = kind === 'catalog' ? query('entityId') : kind === 'playback' ? query('titleId') : null;
    return kind && id ? { kind, id } : null;
  }
  if (WIDGETS_PATH.test(path)) {
    const id = query('titleID');
    return id ? { kind: 'widgets', id } : null;
  }
  const raw = DETAIL_PATH.exec(path)?.[1];
  const id = raw !== undefined ? primeId(raw) : null;
  return id ? { kind: 'detail', id } : null;
}

// ─── Réductions (monde MAIN) ──────────────────────────────────────────────

const record = (value: unknown): Record<string, unknown> => (isRecord(value) && !Array.isArray(value) ? value : {});
const list = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);
const isTimestamp = (v: unknown): v is number => typeof v === 'number' && Number.isSafeInteger(v) && v > 0;

function integer(value: unknown, max: number): number | null {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 && value <= max ? value : null;
}

function runtime(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 && value <= MAX_RUNTIME_MS ? Math.round(value) : null;
}

const CATALOG_TYPE = /^[a-z_]{1,32}$/;

/**
 * Réduit la réponse `playerChromeResources` à son `catalogMetadataV2.catalog` (`{ resources: { catalogMetadataV2 } }`) ;
 * null sans ce bloc (autres ressources demandées : `nextUpV3` décrit l'épisode SUIVANT, jamais lu).
 */
export function reducePrimeCatalog(raw: unknown, id: string, seenAt: number): PrimeCatalogEntry | null {
  const root = record(raw);
  const metadata = record(record(root.resources).catalogMetadataV2 ?? root.catalogMetadataV2);
  const catalog = record(metadata.catalog);
  const type = primeText(catalog.type)?.toLowerCase();
  const canonical = primeId(id);
  if (!type || !CATALOG_TYPE.test(type) || !canonical || !isTimestamp(seenAt)) return null;
  const seriesTitle = primeText(catalog.seriesTitle);
  return {
    id: canonical,
    seenAt,
    type,
    title: primeText(catalog.title),
    seriesTitle: seriesTitle ? stripVersionTags(seriesTitle) : null,
    seasonNumber: integer(catalog.seasonNumber, 999),
    episodeNumber: integer(catalog.episodeNumber, 99_999),
  };
}

/**
 * Réduit la réponse `GetVodPlaybackResources` au début de `END_CREDITS` (`transitionTimecodes.result.events[]`) et à
 * `vodPlaylistedPlaybackUrls.result.playbackUrls.fullTitleDurationMs`. Seuls ces deux chemins sont lus : jamais les
 * URL de `playbackUrls`, `intraTitlePlaylist`, `timedTextUrls`, ni rien qui touche aux licences. Null si aucun des deux.
 */
export function reducePrimePlayback(raw: unknown, id: string, seenAt: number): PrimePlaybackEntry | null {
  const root = record(raw);
  const timecodes = record(root.transitionTimecodes);
  const events = list(record(timecodes.result).events ?? timecodes.events).map(record);
  const credits = events.find((event) => typeof event.eventType === 'string' && event.eventType.toUpperCase() === 'END_CREDITS');
  const creditsStartMs = credits ? (runtime(credits.startTimeMs) ?? runtime(record(list(credits.intervals)[0]).startTimeMs)) : null;
  const durationMs = runtime(record(record(record(root.vodPlaylistedPlaybackUrls).result).playbackUrls).fullTitleDurationMs);
  const canonical = primeId(id);
  if (!canonical || !isTimestamp(seenAt) || (creditsStartMs === null && durationMs === null)) return null;
  return { id: canonical, seenAt, creditsStartMs, durationMs };
}

// ─── Revalidation (monde isolé : la page peut émettre n'importe quoi) ─────

const isId = (v: unknown): v is string => typeof v === 'string' && primeId(v) === v;
const isNullableText = (v: unknown): v is string | null => v === null || (typeof v === 'string' && primeText(v) === v);
const isNullableInt = (v: unknown, max: number): boolean => v === null || integer(v, max) === v;
const isNullableMs = (v: unknown): boolean => v === null || runtime(v) === v;

export function isPrimeCatalogEntry(value: unknown): value is PrimeCatalogEntry {
  return (
    isRecord(value) &&
    isId(value.id) &&
    isTimestamp(value.seenAt) &&
    typeof value.type === 'string' &&
    CATALOG_TYPE.test(value.type) &&
    isNullableText(value.title) &&
    isNullableText(value.seriesTitle) &&
    isNullableInt(value.seasonNumber, 999) &&
    isNullableInt(value.episodeNumber, 99_999)
  );
}

export function isPrimePlaybackEntry(value: unknown): value is PrimePlaybackEntry {
  return isRecord(value) && isId(value.id) && isTimestamp(value.seenAt) && isNullableMs(value.creditsStartMs) && isNullableMs(value.durationMs);
}

function isPrimeTitleEntry(value: unknown): value is PrimeTitleEntry {
  return isRecord(value) && isId(value.requestId) && isTimestamp(value.seenAt) && isPrimeTitle(value.title);
}

function isPrimeWidgetsEntry(value: unknown): value is PrimeWidgetsEntry {
  return isRecord(value) && isTimestamp(value.seenAt) && isPrimeDetailWidgets(value.widgets);
}

// ─── Messages (chaînes JSON) ──────────────────────────────────────────────

function parseJson(detail: unknown, maxLength: number): unknown {
  if (typeof detail !== 'string' || detail.length > maxLength) return null;
  try {
    return JSON.parse(detail);
  } catch {
    return null;
  }
}

const isCorrelationId = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && v.length <= MAX_ID_LENGTH;

export function encodePrimeHandshake(handshake: PrimeHandshake): string {
  return JSON.stringify(handshake);
}

export function decodePrimeHandshake(detail: unknown): PrimeHandshake | null {
  const value = parseJson(detail, 1_000);
  if (!isRecord(value) || value.v !== PRIME_BRIDGE_VERSION || !isCorrelationId(value.nonce)) return null;
  return { v: PRIME_BRIDGE_VERSION, nonce: value.nonce };
}

export function encodePrimePortOffer(offer: PrimePortOffer): string {
  return JSON.stringify(offer);
}

/** Message `window.postMessage` quelconque (la page en émet d'autres) → offre de port, ou null */
export function decodePrimePortOffer(data: unknown): PrimePortOffer | null {
  if (typeof data !== 'string' || !data.includes(PRIME_PORT_OFFER) || data.length > 1_000) return null;
  const value = parseJson(data, 1_000);
  if (!isRecord(value) || value.v !== PRIME_BRIDGE_VERSION || value.type !== PRIME_PORT_OFFER || !isCorrelationId(value.nonce)) return null;
  return { v: PRIME_BRIDGE_VERSION, type: PRIME_PORT_OFFER, nonce: value.nonce };
}

export function encodePrimePush(push: PrimeBridgePush): string {
  return JSON.stringify(push);
}

/** Liste bornée, éléments revalidés un à un (un élément invalide est écarté, pas le message) ; null si ce n'est pas une liste */
function validList<T>(value: unknown, max: number, guard: (item: unknown) => item is T): T[] | null {
  if (!Array.isArray(value) || value.length > max) return null;
  const items: unknown[] = value;
  return items.filter(guard);
}

/** Nouveautés poussées par le pont, revalidées une à une */
export function decodePrimePush(data: unknown): PrimeBridgePush | null {
  const value = parseJson(data, 1_000_000);
  if (!isRecord(value) || value.v !== PRIME_BRIDGE_VERSION) return null;
  const catalog = validList(value.catalog, PRIME_MAX_CATALOG, isPrimeCatalogEntry);
  const playback = validList(value.playback, PRIME_MAX_PLAYBACK, isPrimePlaybackEntry);
  const titles = validList(value.titles, PRIME_MAX_TITLES, isPrimeTitleEntry);
  const widgets = validList(value.widgets, PRIME_MAX_WIDGETS, isPrimeWidgetsEntry);
  if (!catalog || !playback || !titles || !widgets) return null;
  return { v: PRIME_BRIDGE_VERSION, catalog, playback, titles, widgets };
}
