import { isRecord } from './guards';
import { STREAMING_PLATFORMS } from '../platforms/ids';
import type { EpisodeInfo } from './episode.types';
import type { PageMediaInfo } from './page-media.types';
import type { SyncOutcome } from './sync.types';

// Trace de débogage (builds de dev seulement : chaque producteur est appelé sous `if (__SYNCKAI_DEBUG__)`) : déroulé
// chronologique page → script de contenu → service worker → AniList / MAL → popup / panneau, écrit par le service
// worker seul (background/debug-trace.ts) dans storage.session, copié en JSON depuis Réglages › Aide. Module pur : bornes,
// filtre de confidentialité (jamais de jeton, cookie, en-tête, identifiant de compte ou de profil, URL de flux, corps de
// requête) et anneau d'événements.

/** Événements gardés (les plus anciens retirés d'abord) ; mode détaillé : toutes les lignes du logger, plus d'événements */
export const TRACE_MAX = 300;
export const TRACE_MAX_VERBOSE = 1000;
/** Longueur maximale d'une chaîne (ligne du logger : TRACE_MESSAGE_MAX) */
export const TRACE_STRING_MAX = 200;
export const TRACE_MESSAGE_MAX = 400;
/** Clés gardées par objet de données, éléments par tableau */
export const TRACE_KEYS_MAX = 16;
export const TRACE_ARRAY_MAX = 10;
/** Nom d'un type d'événement : `episode-identified`, `adjust-progress`… */
const TRACE_TYPE = /^[a-z][a-z0-9.-]{0,39}$/;

export const traceCapacity = (verbose: boolean): number => (verbose ? TRACE_MAX_VERBOSE : TRACE_MAX);

export const TRACE_SOURCES = ['content', 'popup', 'panel', 'settings', 'import', 'sw'] as const;
export type TraceSource = (typeof TRACE_SOURCES)[number];
/** Sources qu'une page de l'extension peut déclarer (le service worker fixe `content` et `sw` lui-même) */
export const TRACE_PAGE_SOURCES = ['popup', 'panel', 'settings', 'import'] as const satisfies readonly TraceSource[];
export type TracePageSource = (typeof TRACE_PAGE_SOURCES)[number];

export const TRACE_CATEGORIES = ['page', 'shortcut', 'sync', 'ui', 'account', 'alarm', 'log', 'network', 'message'] as const;
export type TraceCategory = (typeof TRACE_CATEGORIES)[number];

export type TraceScalar = string | number | boolean | null;
export type TraceValue = TraceScalar | TraceScalar[] | { [key: string]: TraceScalar | TraceScalar[] };
export type TraceData = Record<string, TraceValue>;

/** Contexte facultatif d'un événement : onglet, plateforme, écran déclaré par une page */
export interface TraceContext {
  tabId?: number;
  platform?: string;
  source?: TracePageSource;
}

/** Événement envoyé par un producteur (données brutes : bornées et filtrées par le service worker) */
export interface TraceInput extends TraceContext {
  at: number;
  category: TraceCategory;
  type: string;
  data?: Record<string, unknown>;
}

/** Événement prêt à numéroter : source fixée par le service worker */
export interface TraceRecord {
  at: number;
  source: TraceSource;
  tabId?: number;
  platform?: string;
  category: TraceCategory;
  type: string;
  data: unknown;
}

export interface TraceEvent {
  /** Horodatage du producteur (ms) */
  at: number;
  /** Ordre d'arrivée au service worker, croissant (repart de 1 après « Effacer ») */
  seq: number;
  source: TraceSource;
  tabId?: number;
  platform?: string;
  category: TraceCategory;
  type: string;
  data: TraceData;
}

const includes = <T extends string>(list: readonly T[], value: unknown): value is T => typeof value === 'string' && (list as readonly string[]).includes(value);
const isTabId = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;

// ─── Confidentialité ──────────────────────────────────────────────────────

const REDACTED = '[REDACTED]';
/**
 * Clés retirées avec leur valeur : jetons, secrets OAuth, en-têtes, cookies, identifiants de compte ou de profil, URL
 * (flux, redirections OAuth porteuses de jetons) et corps de requête. Liste large : un champ utile perdu vaut mieux
 * qu'une donnée privée dans une trace copiée.
 */
const SENSITIVE_KEY = /token|secret|passw|verifier|challenge|authori[sz]|bearer|cookie|header|credential|jwt|session|signature|licen[cs]e|account|profile|viewer|user|e-?mail|url|uri|href|stream|manifest|body|payload/i;
/** `code` : gardé seulement s'il a la forme d'un code d'erreur (NETWORK, API_ERROR, 404), jamais un code OAuth */
const isErrorCode = (value: unknown): boolean => (typeof value === 'string' && /^[A-Z][A-Z0-9_]{1,31}$/.test(value)) || typeof value === 'number';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Paramètres d'URL ou de formulaire dont la valeur est secrète */
const SECRET_PARAM = /\b(access_token|refresh_token|id_token|code|code_verifier|code_challenge|client_secret|token|password)=[^&#\s"']+/gi;

/** Masque jetons et secrets d'un texte ; une URL est réduite à son origine (chemin, paramètres et fragment retirés) */
export function redactTraceText(text: string): string {
  return (
    text
      .replace(/\bhttps?:\/\/[^\s/"'<>]+(\/[^\s"'<>]*)?/gi, (url: string, path: string | undefined) => {
        const origin = url.slice(0, path === undefined ? url.length : url.length - path.length);
        return path === undefined || path === '' ? origin : `${origin}/…`;
      })
      .replace(/\b(Authorization)(["']?\s*[:=]\s*["']?)(?:Bearer\s+|Basic\s+)?[^\s"',;}]+/gi, `$1$2${REDACTED}`)
      .replace(/\bBearer\s+(?!\[REDACTED\])[A-Za-z0-9\-._~+/]+=*/gi, `Bearer ${REDACTED}`)
      .replace(SECRET_PARAM, `$1=${REDACTED}`)
      // JWT (jetons AniList / MAL), puis chaînes opaques longues de lettres ET de chiffres (jetons, empreintes), hors UUID
      // (épisodes Disney+, Prime Video)
      .replace(/\beyJ[A-Za-z0-9_-]{4,}(?:\.[A-Za-z0-9_-]+)*/g, REDACTED)
      .replace(/[A-Za-z0-9_-]{32,}/g, (run: string) => (UUID.test(run) || !/\d/.test(run) || !/[A-Za-z]/.test(run) ? run : REDACTED))
  );
}

const truncate = (text: string, max: number): string => (text.length > max ? `${text.slice(0, max - 1)}…` : text);

function boundScalar(value: unknown, max: number): TraceScalar | undefined {
  if (value === null || typeof value === 'boolean') return value;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string') return truncate(redactTraceText(value), max);
  return undefined;
}

function boundArray(value: readonly unknown[]): TraceScalar[] {
  return value
    .map((item) => boundScalar(item, TRACE_STRING_MAX))
    .filter((item): item is TraceScalar => item !== undefined)
    .slice(0, TRACE_ARRAY_MAX);
}

/** Entrées gardées d'un objet : clés sensibles retirées, au plus TRACE_KEYS_MAX */
function safeEntries(value: Record<string, unknown>): [string, unknown][] {
  return Object.entries(value)
    .filter(([key, inner]) => !SENSITIVE_KEY.test(key) && (key.toLowerCase() !== 'code' || isErrorCode(inner)) && inner !== undefined && typeof inner !== 'function')
    .slice(0, TRACE_KEYS_MAX);
}

/** Données d'un événement : un niveau d'objet sous la racine, scalaires bornés, clés sensibles retirées (pur) */
export function boundTraceData(data: unknown): TraceData {
  if (!isRecord(data) || Array.isArray(data)) return {};
  const bounded: TraceData = {};
  for (const [key, value] of safeEntries(data)) {
    const max = key === 'message' ? TRACE_MESSAGE_MAX : TRACE_STRING_MAX;
    const scalar = boundScalar(value, max);
    if (scalar !== undefined) bounded[key] = scalar;
    else if (Array.isArray(value)) bounded[key] = boundArray(value);
    else if (isRecord(value)) {
      const inner: Record<string, TraceScalar | TraceScalar[]> = {};
      for (const [innerKey, innerValue] of safeEntries(value)) {
        const innerScalar = boundScalar(innerValue, TRACE_STRING_MAX);
        if (innerScalar !== undefined) inner[innerKey] = innerScalar;
        else if (Array.isArray(innerValue)) inner[innerKey] = boundArray(innerValue);
      }
      bounded[key] = inner;
    }
  }
  return bounded;
}

function formatTraceArg(arg: unknown): string {
  if (typeof arg === 'string') return arg;
  if (arg instanceof Error) return arg.message ? `${arg.name}: ${arg.message}` : arg.name;
  if (isRecord(arg) && !Array.isArray(arg)) return JSON.stringify(boundTraceData(arg));
  if (Array.isArray(arg)) return JSON.stringify(boundArray(arg));
  return String(arg);
}

/** Ligne du logger : arguments joints, objets filtrés comme les données, jetons masqués, tronquée (pur) */
export function formatTraceArgs(args: readonly unknown[]): string {
  return truncate(redactTraceText(args.map(formatTraceArg).join(' ')), TRACE_MESSAGE_MAX);
}

// ─── Événements ───────────────────────────────────────────────────────────

/** Événement reçu d'un script de contenu ou d'une page (message de trace) : forme et contexte valides */
export function isTraceInput(value: unknown): value is TraceInput {
  return (
    isRecord(value) &&
    typeof value.at === 'number' &&
    Number.isFinite(value.at) &&
    includes(TRACE_CATEGORIES, value.category) &&
    typeof value.type === 'string' &&
    TRACE_TYPE.test(value.type) &&
    (value.data === undefined || (isRecord(value.data) && !Array.isArray(value.data))) &&
    (value.tabId === undefined || isTabId(value.tabId)) &&
    (value.platform === undefined || includes(STREAMING_PLATFORMS, value.platform)) &&
    (value.source === undefined || includes(TRACE_PAGE_SOURCES, value.source))
  );
}

export function isTraceEvent(value: unknown): value is TraceEvent {
  return (
    isRecord(value) &&
    typeof value.at === 'number' &&
    typeof value.seq === 'number' &&
    Number.isSafeInteger(value.seq) &&
    includes(TRACE_SOURCES, value.source) &&
    includes(TRACE_CATEGORIES, value.category) &&
    typeof value.type === 'string' &&
    isRecord(value.data)
  );
}

/** Événement numéroté, borné et filtré (pur) */
export function toTraceEvent(record: TraceRecord, seq: number): TraceEvent {
  return {
    at: record.at,
    seq,
    source: record.source,
    ...(isTabId(record.tabId) ? { tabId: record.tabId } : {}),
    ...(includes(STREAMING_PLATFORMS, record.platform) ? { platform: record.platform } : {}),
    category: record.category,
    type: truncate(record.type, 40),
    data: boundTraceData(record.data),
  };
}

/** Ajoute des événements à la trace enregistrée (ordre chronologique d'arrivée), numérotés à la suite, `max` gardés (pur) */
export function appendTraceEvents(current: unknown, added: readonly TraceRecord[], max: number): TraceEvent[] {
  const valid = Array.isArray(current) ? current.filter(isTraceEvent) : [];
  let seq = valid.reduce((last, event) => Math.max(last, event.seq), 0);
  return [...valid, ...added.map((record) => toTraceEvent(record, ++seq))].slice(-max);
}

// ─── Résumés ──────────────────────────────────────────────────────────────

/** Nom de l'opération GraphQL (`query PageMedia(…)` → PageMedia) ; jamais les variables */
export function graphqlOperation(query: string): string {
  return /^\s*(?:query|mutation)\s+(\w+)/.exec(query)?.[1] ?? 'anonymous';
}

/** Chemin REST sans paramètres, nombres remplacés (`/anime/52991/my_list_status` → `/anime/{id}/my_list_status`) */
export function restPathTemplate(path: string): string {
  return (path.split(/[?#]/)[0] ?? '').replace(/\/\d+(?=\/|$)/g, '/{id}');
}

/** Épisode réduit à son identité et ses numéros (jamais son URL) */
export function episodeTraceData(episode: EpisodeInfo): TraceData {
  return {
    episodeId: episode.episodeId,
    seriesId: episode.seriesId,
    title: episode.animeTitle,
    season: episode.seasonNumber,
    seasonTitle: episode.seasonTitle,
    episode: episode.seasonEpisodeNumber,
    displayed: episode.displayedEpisodeNumber,
  };
}

/** Entrée de la liste d'un service avant ou après une écriture ; null : absente de la liste */
export function entryTraceData(entry: { status: string; progress: number; repeat?: number } | null): TraceValue {
  return entry === null ? null : { status: entry.status, progress: entry.progress, ...(entry.repeat !== undefined ? { repeat: entry.repeat } : {}) };
}

/** Décision des règles métier (écrire, à jour, ignorer) et sa progression visée */
export function decisionTraceData(decision: { action: string; progress?: number; status?: string; reason?: string; repeat?: number }): TraceData {
  const data: TraceData = { action: decision.action };
  if (decision.progress !== undefined) data.progress = decision.progress;
  if (decision.status !== undefined) data.status = decision.status;
  if (decision.repeat !== undefined) data.repeat = decision.repeat;
  if (decision.reason !== undefined) data.reason = decision.reason;
  return data;
}

/** Série ou épisode lu sur la page (GET_PAGE_MEDIA) ; null : rien de reconnu */
export function pageMediaTraceData(page: PageMediaInfo | null): TraceData {
  if (page === null) return { kind: null };
  return { kind: page.kind, seriesId: page.seriesId, title: page.seriesTitle, season: page.seasonNumber, seasonTitle: page.seasonTitle };
}

/** Résultat d'une synchro ou d'une action : statut, puis `service: "updated 12"` par service */
export function summarizeOutcome(outcome: SyncOutcome): TraceData {
  switch (outcome.status) {
    case 'synced': {
      const summary: TraceData = { status: 'synced' };
      if (outcome.queued === true) summary.queued = true;
      for (const { service, outcome: result } of outcome.results) {
        summary[service] =
          result.status === 'updated'
            ? `updated ${result.progress}${result.completed ? ' (completed)' : ''}`
            : result.status === 'up-to-date'
              ? `up-to-date ${result.progress}`
              : result.status === 'skipped'
                ? `skipped ${result.code ?? result.reason}`
                : ['error', result.code, result.httpStatus].filter((part) => part !== undefined).join(' ');
      }
      return summary;
    }
    case 'needs-review':
      return { status: outcome.status, reason: outcome.reason };
    case 'error':
      return { status: 'error', ...(outcome.code !== undefined ? { code: outcome.code } : {}), ...(outcome.httpStatus !== undefined ? { httpStatus: outcome.httpStatus } : {}), ...(outcome.queued === true ? { queued: true } : {}) };
    case 'ignored':
      return { status: 'ignored', ...(outcome.noAccess === true ? { noAccess: true } : {}) };
    case 'excluded':
    case 'not-connected':
      return { status: outcome.status };
  }
}
