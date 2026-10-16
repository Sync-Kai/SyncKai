// Protocole du pont Crunchyroll entre le script de la page (monde MAIN, page-bridge.iife.ts, déclaré dans le manifeste) et
// le script de contenu isolé (content-crunchyroll.iife.ts). Module PUR : aucun accès au DOM ni à chrome.*, importé des deux côtés.
//
// Le pont est PASSIF : il n'émet aucune requête. Il lit le corps JSON de quatre requêtes que l'application Crunchyroll
// envoie elle-même (porteuses du jeton de l'utilisateur dans leurs EN-TÊTES, jamais lus) et n'en garde que la forme
// réduite de platforms/crunchyroll/metadata.ts : jamais d'en-tête, jeton, cookie, identifiant de compte ou de profil,
// URL de flux.
//
// Canal privé (MessageChannel), même ouverture que les ponts Netflix, Disney+ et Prime Video :
// 1. Le client isolé émet CRUNCHYROLL_HANDSHAKE_EVENT (CustomEvent sur `document`) avec un nonce aléatoire.
// 2. Le pont (écouteur en capture sur `window`, posé à `document_start`) crée un MessageChannel, garde port1 et
//    transfère port2 par `window.postMessage(offre, location.origin, [port2])`.
// 3. Le client n'accepte que le PREMIER port reçu pour son nonce (content/bridge/client-kit.ts).
// Ensuite, le pont pousse sur port1 la table des signaux des séries déjà vues (instantané), puis de chaque série
// modifiée. Charges utiles en CHAÎNES JSON (Xray wrappers de Firefox).
// Garantie réelle : l'ordre (pont déclaré à `document_start`, avant tout script de la page), pas le nonce (lisible par
// la page) ni `isTrusted` (vrai aussi pour un postMessage de la page). Les tables reçues sont des données que la page
// aurait pu écrire : revalidées à chaque lecture, jamais seule preuve d'une correspondance (voir content/bridge/kit.ts).
import { isRecord, parseJsonBounded } from '../../shared/guards';
import { domainOrSubdomain } from '../../shared/hosts';
import type { CrunchyrollSignalTable } from '../../platforms/crunchyroll/metadata';

/**
 * Version du protocole, à incrémenter à tout changement des messages ou des formes réduites : le pont MAIN d'une
 * version précédente reste dans les onglets ouverts après une mise à jour. Chaque côté ignore les messages d'une autre version.
 * v3 (2026-10-16) : kit des ponts (content/bridge/kit.ts) : observateur sans version, JSON sans prototype hérité.
 */
export const CRUNCHYROLL_BRIDGE_VERSION = 3;
// Noms courts : chaînes chargées par le script de contenu Crunchyroll (budget de taille)
export const CRUNCHYROLL_HANDSHAKE_EVENT = 'synckai:cr-hello';
export const CRUNCHYROLL_PORT_OFFER = 'synckai:cr-port';
/** Séries gardées et poussées en une fois */
export const CRUNCHYROLL_MAX_SERIES = 10;
const MAX_NONCE_LENGTH = 64;
/** Message poussé au-delà duquel rien n'est lu (même borne que les fiches Disney+ ; une table fait quelques Ko) */
export const CRUNCHYROLL_MAX_PUSH_LENGTH = 400_000;

export interface CrunchyrollBridgePush {
  v: typeof CRUNCHYROLL_BRIDGE_VERSION;
  tables: CrunchyrollSignalTable[];
}

/** Table reçue, non revalidée : chaque lecture l'est (crunchyrollTableSignals) */
export interface ReceivedCrunchyrollTable {
  seriesId: string;
  table: Record<string, unknown>;
}

// ─── Installation du pont (une fois par version de protocole) ─────────────

export function crunchyrollBridgeFlag(version: number): symbol {
  return Symbol.for(`synckai.crunchyroll.bridge.v${version}`);
}

/** Emplacement de l'observateur fetch / XHR, sans version (content/bridge/kit.ts › installObserver, 2-R3) */
export const crunchyrollObserverKey = Symbol.for('synckai.crunchyroll.observer');

// ─── Requêtes observées (monde MAIN) ──────────────────────────────────────

export type CrunchyrollRequest =
  | { kind: 'series' | 'seasons' | 'upNext'; seriesId: string }
  | { kind: 'episodes'; seasonId: string };

const CMS_PATH = /^\/content\/v2\/cms\/(series|seasons)\/([A-Z0-9]{3,32})\/?(seasons|episodes)?\/?$/i;
const UP_NEXT_PATH = /^\/content\/v2\/discover\/up_next\/([A-Z0-9]{3,32})\/?$/i;
const isCrunchyrollHost = domainOrSubdomain('crunchyroll.com');
/** Requête lue selon « collection/sous-ressource » du chemin (minuscules) ; toute autre combinaison n'est pas lue */
const CMS_KINDS: Partial<Record<string, 'series' | 'seasons' | 'episodes'>> = { 'series/': 'series', 'series/seasons': 'seasons', 'seasons/episodes': 'episodes' };

/**
 * URL d'une requête du site lue par le pont (relative à `base`, l'adresse de la page) → nature et identifiant, sinon
 * null. Toute autre requête (lecture, compte, historique, statistiques, images…) est ignorée sans être lue. Paramètres
 * (`locale`, `preferred_audio_language`) ignorés.
 */
export function observedCrunchyrollRequest(url: string, base: string): CrunchyrollRequest | null {
  let parsed: URL;
  try {
    parsed = new URL(url, base);
  } catch {
    return null;
  }
  if (parsed.protocol !== 'https:' || !isCrunchyrollHost(parsed.hostname)) return null;
  const upNext = UP_NEXT_PATH.exec(parsed.pathname)?.[1];
  if (upNext) return { kind: 'upNext', seriesId: upNext };
  const [, collection, id, sub] = CMS_PATH.exec(parsed.pathname) ?? [];
  if (!collection || !id) return null;
  // Clé sans propriété héritée possible (elle contient « / »)
  const kind = CMS_KINDS[`${collection}/${sub ?? ''}`.toLowerCase()];
  if (kind === 'episodes') return { kind, seasonId: id };
  return kind ? { kind, seriesId: id } : null;
}

// ─── Messages (chaînes JSON) ──────────────────────────────────────────────

const isNonce = (v: unknown): v is string => typeof v === 'string' && /^[\w-]+$/.test(v) && v.length <= MAX_NONCE_LENGTH;

/** Demande d'ouverture : « {version}:{nonce} » (chaîne courte, chargée par le script de contenu) */
export function encodeCrunchyrollHandshake(nonce: string): string {
  return `${CRUNCHYROLL_BRIDGE_VERSION}:${nonce}`;
}

/** Nonce de la demande d'ouverture de cette version, null si ce n'en est pas une */
export function decodeCrunchyrollHandshake(detail: unknown): string | null {
  const [version, nonce] = typeof detail === 'string' && detail.length <= MAX_NONCE_LENGTH + 8 ? detail.split(':') : [];
  return version === String(CRUNCHYROLL_BRIDGE_VERSION) && isNonce(nonce) ? nonce : null;
}

/**
 * Offre de port (pont → client) : chaîne fixe pour un nonce, comparée telle quelle par le client (le pont l'émet avec
 * cette même fonction) ; tout autre `window.postMessage` de la page est ignoré.
 */
export function encodeCrunchyrollPortOffer(nonce: string): string {
  return JSON.stringify({ v: CRUNCHYROLL_BRIDGE_VERSION, type: CRUNCHYROLL_PORT_OFFER, nonce });
}

export function encodeCrunchyrollPush(push: CrunchyrollBridgePush): string {
  return JSON.stringify(push);
}

/**
 * Tables poussées par le pont, avec leur série ; leurs valeurs sont revalidées à la lecture (crunchyrollTableSignals).
 * Seule lecture du protocole chargée par le script de contenu (au plus court : budget de taille).
 */
export function decodeCrunchyrollPush(data: unknown): ReceivedCrunchyrollTable[] {
  // Autre chose qu'une chaîne, ou message trop long : rien n'est lu
  const value = parseJsonBounded(data, CRUNCHYROLL_MAX_PUSH_LENGTH);
  const tables: unknown = isRecord(value) && value.v === CRUNCHYROLL_BRIDGE_VERSION ? value.tables : null;
  return Array.isArray(tables) ? tables.flatMap((table: unknown) => (isRecord(table) && typeof table.seriesId === 'string' ? [{ seriesId: table.seriesId, table }] : [])) : [];
}
