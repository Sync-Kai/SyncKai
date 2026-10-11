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
import { isRecord } from '../../shared/guards';

/**
 * Version du protocole, à incrémenter à tout changement des messages ou de la forme réduite : le pont MAIN d'une
 * version précédente reste dans les onglets ouverts après une mise à jour (code de la page, jamais invalidé).
 * Chaque côté ignore les messages d'une autre version.
 */
export const DISNEY_BRIDGE_VERSION = 2;
/** Ouverture du canal (client isolé → pont), detail = DisneyHandshake en chaîne JSON */
export const DISNEY_HANDSHAKE_EVENT = 'synckai:disney:handshake';
/** Type du message `window.postMessage` qui transfère port2 (pont → client isolé) */
export const DISNEY_PORT_OFFER = 'synckai:disney:port';

/** Identifiant Disney+ (épisode de /play/{id}, availId, entité) : UUID */
export const DISNEY_ID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Identifiants gardés par fiche au plus */
export const DISNEY_MAX_IDS = 6;
/** `infoBlock` (protobuf en base64) au-delà duquel rien n'est décodé */
const MAX_INFO_BLOCK_LENGTH = 16_000;
/** Entité de catalogue dans `infoBlock` : « urn:ds:cmp:eva:episode/{uuid} » (episode, program, movie…) */
const ENTITY_URN = /urn:ds:cmp:eva:[a-z]+\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/gi;

/** Bornes de la réduction : textes tronqués, fiches gardées et poussées en une fois */
export const DISNEY_MAX_TEXT = 300;
export const DISNEY_MAX_ENTRIES = 20;
const MAX_ID_LENGTH = 64;
/** Durée maximale plausible d'un programme (ms) : 12 h */
const MAX_RUNTIME_MS = 12 * 3_600_000;

/**
 * Fiche réduite d'une vidéo (réponse `playerExperience`) : seuls ces champs quittent le monde MAIN.
 * `title` et `subtitle` sont localisés (langue du profil) ; `internalTitle` est stable et en anglais
 * (« Undead Unluck - s1e1 - mediaId:… »).
 */
export interface DisneyPlayerExperience {
  /**
   * Identifiants de la vidéo, en minuscules, sans doublon : chemin de la requête, `availId` de la réponse, entités de
   * `infoBlock` (dont l'épisode de l'URL /play/{id}). Jamais vide.
   */
  ids: string[];
  /** Réception de la réponse par le pont (ms depuis l'epoch) : rapproche une fiche d'un changement d'URL */
  seenAt: number;
  title: string;
  subtitle: string | null;
  internalTitle: string | null;
  /** Langue originale (« ja » pour un anime) */
  originalLanguage: string | null;
  /** Durée (ms) */
  runtimeMs: number | null;
  /** « episode », « movie »… */
  programType: string | null;
}

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

/** Pont → client : fiches connues (instantané à l'ouverture du canal, puis chaque nouvelle fiche) */
export interface DisneyBridgePush {
  v: typeof DISNEY_BRIDGE_VERSION;
  entries: DisneyPlayerExperience[];
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

// ─── Requêtes observées (monde MAIN) ──────────────────────────────────────

/** Hôtes de l'API du site (Disney Streaming / BAMTech) */
function isApiHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return ['bamgrid.com', 'disneyplus.com'].some((domain) => host === domain || host.endsWith(`.${domain}`));
}

const PLAYER_EXPERIENCE_PATH = /^\/explore\/v1(?:\.\d{1,3})?\/playerExperience\/([0-9a-f-]{36})\/?$/i;

/**
 * URL d'une requête `GET …/explore/v1.21/playerExperience/{id}` → identifiant du chemin (minuscules), sinon null
 * (availId ou épisode : non garanti). Toute autre requête (flux, upNext, images…) est ignorée sans être lue.
 */
export function playerExperienceRequestId(url: string, base = 'https://www.disneyplus.com/'): string | null {
  let parsed: URL;
  try {
    parsed = new URL(url, base);
  } catch {
    return null;
  }
  if (parsed.protocol !== 'https:' || !isApiHost(parsed.hostname)) return null;
  const id = PLAYER_EXPERIENCE_PATH.exec(parsed.pathname)?.[1];
  return id !== undefined && DISNEY_ID_REGEX.test(id) ? id.toLowerCase() : null;
}

/** Texte nettoyé et tronqué ; null si absent ou vide */
function text(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const cleaned = value.replace(/\s+/g, ' ').trim();
  return cleaned ? cleaned.slice(0, DISNEY_MAX_TEXT) : null;
}

const LANGUAGE = /^[a-z]{2,3}(?:-[a-z0-9]{1,8})*$/i;
const PROGRAM_TYPE = /^[a-z][a-z_-]{0,31}$/i;

function language(value: unknown): string | null {
  return typeof value === 'string' && LANGUAGE.test(value) && value.length <= 16 ? value : null;
}

function programType(value: unknown): string | null {
  return typeof value === 'string' && PROGRAM_TYPE.test(value) ? value.toLowerCase() : null;
}

const isTimestamp = (v: unknown): v is number => typeof v === 'number' && Number.isSafeInteger(v) && v > 0;

function runtime(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 && value <= MAX_RUNTIME_MS ? Math.round(value) : null;
}

/**
 * Entités de catalogue citées par `infoBlock` (protobuf en base64) : seuls les identifiants en sortent, jamais le bloc.
 * Bloc absent, trop long ou illisible : aucun.
 */
export function infoBlockEntityIds(infoBlock: unknown): string[] {
  if (typeof infoBlock !== 'string' || infoBlock.length === 0 || infoBlock.length > MAX_INFO_BLOCK_LENGTH) return [];
  let decoded: string;
  try {
    decoded = atob(infoBlock);
  } catch {
    return [];
  }
  return [...decoded.matchAll(ENTITY_URN)].map((match) => (match[1] ?? '').toLowerCase()).filter((id) => DISNEY_ID_REGEX.test(id));
}

/**
 * Réduit la réponse de `playerExperience` (`{ data: { playerExperience: {…} } }`) à `DisneyPlayerExperience`.
 * `requestId` : identifiant du chemin de la requête (peut différer de l'`availId` de la réponse) ; `seenAt` : réception
 * (ms). Null si la forme est inattendue.
 */
export function reduceDisneyPlayerExperience(raw: unknown, requestId: string, seenAt: number): DisneyPlayerExperience | null {
  const data = isRecord(raw) ? raw.data : null;
  const experience = isRecord(data) ? data.playerExperience : null;
  if (!isRecord(experience)) return null;
  const title = text(experience.title);
  if (!title || !DISNEY_ID_REGEX.test(requestId) || !isTimestamp(seenAt)) return null;
  const availId = typeof experience.availId === 'string' && DISNEY_ID_REGEX.test(experience.availId) ? experience.availId : null;
  const ids = [...new Set([requestId, availId, ...infoBlockEntityIds(experience.infoBlock)].flatMap((id) => (id ? [id.toLowerCase()] : [])))].slice(
    0,
    DISNEY_MAX_IDS,
  );
  const timeline = isRecord(experience.timeline) ? experience.timeline : {};
  const analytics = isRecord(experience.analytics) ? experience.analytics : {};
  return {
    ids,
    seenAt,
    title,
    subtitle: text(experience.subtitle),
    internalTitle: text(experience.internalTitle),
    originalLanguage: language(experience.originalLanguage),
    runtimeMs: runtime(timeline.runtimeMs),
    programType: programType(analytics.programType),
  };
}

/** Vrai si la fiche décrit la vidéo `id` (identifiant de l'URL, de la requête ou de la réponse) */
export function hasDisneyId(entry: Pick<DisneyPlayerExperience, 'ids'>, id: string): boolean {
  return entry.ids.includes(id.toLowerCase());
}

// ─── Revalidation (monde isolé : la page peut émettre n'importe quoi) ─────

const isBoundedText = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && v.length <= DISNEY_MAX_TEXT;
const isNullableText = (v: unknown): v is string | null => v === null || isBoundedText(v);
const isLowerId = (v: unknown): v is string => typeof v === 'string' && DISNEY_ID_REGEX.test(v) && v === v.toLowerCase();
/** 1 à DISNEY_MAX_IDS identifiants en minuscules, sans doublon */
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
    (value.runtimeMs === null || runtime(value.runtimeMs) === value.runtimeMs) &&
    (value.programType === null || programType(value.programType) === value.programType)
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

/** Fiches poussées par le pont, revalidées une à une (une fiche invalide est écartée, pas le message) */
export function decodeDisneyPush(data: unknown): DisneyBridgePush | null {
  const value = parseJson(data, 200_000);
  if (!isRecord(value) || value.v !== DISNEY_BRIDGE_VERSION || !Array.isArray(value.entries) || value.entries.length > DISNEY_MAX_ENTRIES) return null;
  const entries: unknown[] = value.entries;
  return { v: DISNEY_BRIDGE_VERSION, entries: entries.filter(isDisneyPlayerExperience) };
}
