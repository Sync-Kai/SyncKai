// Protocole du pont Disney+ entre le script de la page (monde MAIN, page-bridge.iife.ts) et le script de contenu
// isolé (content-disney.iife.ts). Module PUR : aucun accès au DOM ni à chrome.*, importé des deux côtés.
//
// Le pont est PASSIF : il n'émet aucune requête. Il lit la réponse des requêtes `playerExperience` que le site envoie
// lui-même (XMLHttpRequest) et n'en garde que la forme réduite (`DisneyPlayerExperience`), jamais les en-têtes, jetons,
// URL de flux ni données de compte.
//
// Identifiants : l'URL de lecture (/play/{id}) porte l'identifiant de l'ÉPISODE (deeplinkId), pas l'`availId` de la
// réponse. Chaque fiche porte donc tous les identifiants connus de la vidéo : celui du chemin de la requête, l'`availId`
// de la réponse et l'épisode décodé de `infoBlock` (« urn:ds:cmp:eva:episode/{id} ») ; l'URL est rapprochée de l'un d'eux.
//
// Canal privé (MessageChannel), même ouverture que le pont Netflix :
// 1. Le client isolé émet DISNEY_HANDSHAKE_EVENT (CustomEvent sur `document`) avec un nonce aléatoire.
// 2. Le pont (écouteur en capture sur `window`, posé à `document_start`) crée un MessageChannel, garde port1 et
//    transfère port2 par `window.postMessage(offre, location.origin, [port2])`.
// 3. Le client n'accepte que le PREMIER port reçu pour son nonce, par un vrai postMessage (`isTrusted`).
// Ensuite, le pont pousse sur port1 les fiches déjà vues (instantané), puis chaque nouvelle fiche (lecture
// automatique de l'épisode suivant, navigation dans le site). Charges utiles en CHAÎNES JSON (Xray wrappers de Firefox).
//
// Pages de série (/browse/entity-{uuid}) : le pont observe aussi les réponses `page/entity-{uuid}` (série, genres,
// saisons) et `season/{id}` (saison choisie dans le menu, pagination des épisodes), réduites à `DisneySeriesPage` et
// poussées dans le même message (`pages`), indexées par l'uuid de l'entité.
//
// Générique de fin (protocole v4) : le pont lit aussi la réponse de lecture du site (`…bamgrid.com/…/playback/…`,
// requête POST du lecteur) et n'en garde que les identifiants de la vidéo et les repères éditoriaux
// (`stream.editorial` : FFEC, up_next), réunis à la fiche de la même vidéo (`DisneyPlayerExperience.editorial`). Les
// URL signées des flux et les jetons de droits (`playbackRightsContext`…) de cette réponse ne sont jamais lus.
import { isRecord } from '../../shared/guards';
import { isSignalYear } from '../../shared/match-signals';
import {
  DISNEY_ID_REGEX,
  DISNEY_MAX_ENTRIES,
  DISNEY_MAX_GENRES,
  DISNEY_MAX_IDS,
  DISNEY_MAX_PAGES,
  DISNEY_MAX_SEASONS,
  DISNEY_MAX_TEXT,
  isTimestamp,
  language,
  MAX_EPISODE_COUNT,
  MAX_GENRE_LENGTH,
  positiveInt,
  programType,
  runtime,
  type DisneyPlayerExperience,
  type DisneySeason,
  type DisneySeriesPage,
} from '../../platforms/disney/metadata';

/**
 * Version du protocole, à incrémenter à tout changement des messages ou de la forme réduite : le pont MAIN d'une
 * version précédente reste dans les onglets ouverts après une mise à jour (code de la page, jamais invalidé).
 * Chaque côté ignore les messages d'une autre version.
 * v5 (2026-10-14) : année de début de la série (`startYear`) et durée médiane des épisodes de chaque saison
 * (`episodeMinutes`), signaux de correspondance.
 */
export const DISNEY_BRIDGE_VERSION = 5;
/** Ouverture du canal (client isolé → pont), detail = DisneyHandshake en chaîne JSON */
export const DISNEY_HANDSHAKE_EVENT = 'synckai:disney:handshake';
/** Type du message `window.postMessage` qui transfère port2 (pont → client isolé) */
export const DISNEY_PORT_OFFER = 'synckai:disney:port';

const MAX_ID_LENGTH = 64;

export interface DisneyHandshake {
  v: typeof DISNEY_BRIDGE_VERSION;
  /** Aléatoire (crypto.randomUUID) : relie l'offre de port à cette demande d'ouverture */
  nonce: string;
}

export interface DisneyPortOffer {
  v: typeof DISNEY_BRIDGE_VERSION;
  type: typeof DISNEY_PORT_OFFER;
  nonce: string;
}

/** Pont → client : fiches et pages de série connues (instantané à l'ouverture du canal, puis chaque nouveauté) */
export interface DisneyBridgePush {
  v: typeof DISNEY_BRIDGE_VERSION;
  entries: DisneyPlayerExperience[];
  pages?: DisneySeriesPage[];
}

// ─── Installation du pont (une fois par version de protocole) ─────────────

export function disneyBridgeFlag(version: number): symbol {
  return Symbol.for(`synckai.disney.bridge.v${version}`);
}

/**
 * Installe le pont (`install`) au plus une fois par version sur ce global : double injection (script enregistré puis
 * exécuté dans l'onglet, bfcache) sans observateur en double. Après une mise à jour, un pont d'une autre version déjà
 * présent n'empêche pas l'installation du nouveau ; l'ancien ignore les demandes de la nouvelle version. Retourne true
 * si installé.
 */
export function installDisneyBridgeOnce(global: object, version: number, install: () => void): boolean {
  const flag = disneyBridgeFlag(version);
  if (Reflect.get(global, flag)) return false;
  Reflect.defineProperty(global, flag, { value: true });
  install();
  return true;
}

// ─── Revalidation (monde isolé : la page peut émettre n'importe quoi) ─────

const isBoundedText = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && v.length <= DISNEY_MAX_TEXT;
const isNullableText = (v: unknown): v is string | null => v === null || isBoundedText(v);
const isLowerId = (v: unknown): v is string => typeof v === 'string' && DISNEY_ID_REGEX.test(v) && v === v.toLowerCase();
/** 1 à DISNEY_MAX_IDS identifiants en minuscules, sans doublon */
/** Durée (ms) entière, positive et plausible, ou null */
const isNullableMs = (v: unknown): boolean => v === null || runtime(v) === v;
const isIdList = (v: unknown): v is string[] => Array.isArray(v) && v.length >= 1 && v.length <= DISNEY_MAX_IDS && v.every(isLowerId) && new Set(v).size === v.length;

export function isDisneyPlayerExperience(value: unknown): value is DisneyPlayerExperience {
  return (
    isRecord(value) &&
    isIdList(value.ids) &&
    isTimestamp(value.seenAt) &&
    isBoundedText(value.title) &&
    isNullableText(value.subtitle) &&
    isNullableText(value.internalTitle) &&
    (value.originalLanguage === null || language(value.originalLanguage) !== null) &&
    isNullableMs(value.runtimeMs) &&
    (value.programType === null || programType(value.programType) === value.programType) &&
    (value.editorial === null || (isRecord(value.editorial) && isNullableMs(value.editorial.creditsStartMs) && isNullableMs(value.editorial.upNextMs)))
  );
}

const isNullableLowerId = (v: unknown): v is string | null => v === null || isLowerId(v);
const isNullableCount = (v: unknown, max: number): v is number | null => v === null || positiveInt(v, max) === v;

function isDisneySeason(value: unknown): value is DisneySeason {
  return (
    isRecord(value) &&
    isLowerId(value.id) &&
    isNullableText(value.name) &&
    isNullableCount(value.seasonNumber, 999) &&
    isNullableCount(value.episodeCount, MAX_EPISODE_COUNT) &&
    (value.episodeMinutes === null || (typeof value.episodeMinutes === 'number' && value.episodeMinutes > 0 && value.episodeMinutes <= 720))
  );
}

export function isDisneySeriesPage(value: unknown): value is DisneySeriesPage {
  return (
    isRecord(value) &&
    isLowerId(value.entityId) &&
    isTimestamp(value.seenAt) &&
    isBoundedText(value.title) &&
    isNullableText(value.internalTitle) &&
    Array.isArray(value.genres) &&
    value.genres.length <= DISNEY_MAX_GENRES &&
    value.genres.every((genre) => isBoundedText(genre) && genre.length <= MAX_GENRE_LENGTH) &&
    (value.startYear === null || isSignalYear(value.startYear)) &&
    isNullableLowerId(value.focusSeasonId) &&
    isNullableLowerId(value.selectedSeasonId) &&
    Array.isArray(value.seasons) &&
    value.seasons.length <= DISNEY_MAX_SEASONS &&
    value.seasons.every(isDisneySeason)
  );
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

export function encodeDisneyHandshake(handshake: DisneyHandshake): string {
  return JSON.stringify(handshake);
}

export function decodeDisneyHandshake(detail: unknown): DisneyHandshake | null {
  const value = parseJson(detail, 1_000);
  if (!isRecord(value) || value.v !== DISNEY_BRIDGE_VERSION || !isCorrelationId(value.nonce)) return null;
  return { v: DISNEY_BRIDGE_VERSION, nonce: value.nonce };
}

export function encodeDisneyPortOffer(offer: DisneyPortOffer): string {
  return JSON.stringify(offer);
}

/** Message `window.postMessage` quelconque (la page en émet d'autres) → offre de port, ou null */
export function decodeDisneyPortOffer(data: unknown): DisneyPortOffer | null {
  // Filtre bon marché avant JSON.parse : la plupart des messages de la page ne sont pas des chaînes
  if (typeof data !== 'string' || !data.includes(DISNEY_PORT_OFFER) || data.length > 1_000) return null;
  const value = parseJson(data, 1_000);
  if (!isRecord(value) || value.v !== DISNEY_BRIDGE_VERSION || value.type !== DISNEY_PORT_OFFER || !isCorrelationId(value.nonce)) return null;
  return { v: DISNEY_BRIDGE_VERSION, type: DISNEY_PORT_OFFER, nonce: value.nonce };
}

export function encodeDisneyPush(push: DisneyBridgePush): string {
  return JSON.stringify(push);
}

/** Fiches et pages poussées par le pont, revalidées une à une (une fiche invalide est écartée, pas le message) */
export function decodeDisneyPush(data: unknown): DisneyBridgePush | null {
  const value = parseJson(data, 400_000);
  if (!isRecord(value) || value.v !== DISNEY_BRIDGE_VERSION || !Array.isArray(value.entries) || value.entries.length > DISNEY_MAX_ENTRIES) return null;
  const entries: unknown[] = value.entries;
  const push: DisneyBridgePush = { v: DISNEY_BRIDGE_VERSION, entries: entries.filter(isDisneyPlayerExperience) };
  if (value.pages === undefined) return push;
  if (!Array.isArray(value.pages) || value.pages.length > DISNEY_MAX_PAGES) return null;
  const pages: unknown[] = value.pages;
  return { ...push, pages: pages.filter(isDisneySeriesPage) };
}
