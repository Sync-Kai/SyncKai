import { isDebugTraceMessage, type DebugTraceResponse } from '../protocol/debug-trace';
import type { MessageType } from '../protocol/messages';
import { setTraceTransport } from '../browser/debug-trace-client';
import { sessionArea } from '../browser/storage/session-cache';
import { DEBUG_TRACE_KEY, DEBUG_TRACE_VERBOSE_KEY } from '../protocol/storage-keys';
import { isRecord } from '../shared/guards';
import { isEpisodeInfo } from '../shared/episode.types';
import type { SyncOutcome } from '../shared/sync.types';
import {
  appendTraceEvents,
  episodeTraceData,
  summarizeOutcome,
  TRACE_MAX,
  traceCapacity,
  type TraceData,
  type TraceEvent,
  type TraceRecord,
  type TraceSource,
} from '../shared/debug-trace';

// Trace de débogage, écriture (builds de dev seulement : installée et appelée sous `if (__SYNCKAI_DEBUG__)` par
// background.ts, absente des bundles publiés, vérifié par scripts/build-checks.ts › DEV_ONLY_MARKERS). Le service worker est
// le seul à écrire : ses propres événements directement, ceux des pages et des scripts de contenu par le message de trace.
// Écritures en série sur une seule chaîne de promesses, regroupées (lecture, ajout, écriture de la liste). Règle : ce module
// ne passe jamais par le logger (qui l'alimente : boucle) et ne lève jamais.

/** Accès au stockage de la trace (storage.session ; injectable pour les tests) */
export interface TraceStore {
  read(): Promise<unknown>;
  write(events: TraceEvent[]): Promise<void>;
  readVerbose(): Promise<boolean>;
  writeVerbose(verbose: boolean): Promise<void>;
  clear(): Promise<void>;
}

export interface TraceWriter {
  /** false hors build de développement : rien n'est écrit, aucun message de trace n'est accepté */
  readonly enabled: boolean;
  append(record: TraceRecord): void;
  /** Mode détaillé (relu du stockage au premier usage : le service worker a pu être réveillé entre-temps) */
  verbose(): Promise<boolean>;
  setVerbose(verbose: boolean): Promise<boolean>;
  clear(): Promise<void>;
  /** Résolue quand toutes les écritures demandées sont faites (tests) */
  idle(): Promise<void>;
}

const isVerboseOnly = (record: TraceRecord): boolean => record.category === 'log' && (record.type === 'info' || record.type === 'debug');

export function createTraceWriter(store: TraceStore, enabled: boolean = __SYNCKAI_DEBUG__): TraceWriter {
  let chain: Promise<void> = Promise.resolve();
  /** Lot en attente d'écriture (les événements arrivés pendant une écriture partent ensemble à la suivante) */
  let batch: TraceRecord[] | null = null;
  let verbose: boolean | null = null;

  const run = (task: () => Promise<void>): Promise<void> => {
    // Échec (storage.session plein ou absent) : événements perdus en silence, un log alimenterait la trace (boucle)
    chain = chain.then(task).catch(() => undefined);
    return chain;
  };
  const loadVerbose = async (): Promise<boolean> => (verbose ??= await store.readVerbose().catch(() => false));

  async function flush(records: TraceRecord[]): Promise<void> {
    if (batch === records) batch = null;
    const on = await loadVerbose();
    const kept = on ? records : records.filter((record) => !isVerboseOnly(record));
    if (kept.length === 0) return;
    await store.write(appendTraceEvents(await store.read(), kept, traceCapacity(on)));
  }

  return {
    enabled,
    append(record) {
      if (!enabled) return;
      if (batch === null) {
        const next: TraceRecord[] = [];
        batch = next;
        void run(() => flush(next));
      }
      batch.push(record);
    },
    async verbose() {
      if (!enabled) return false;
      await chain;
      return loadVerbose();
    },
    async setVerbose(next) {
      if (!enabled) return false;
      await run(async () => {
        verbose = next;
        await store.writeVerbose(next);
        // Retour au mode normal : les événements les plus récents dans la limite normale
        const current = await store.read();
        if (!next && Array.isArray(current) && current.length > TRACE_MAX) await store.write(appendTraceEvents(current, [], TRACE_MAX));
      });
      return next;
    },
    async clear() {
      if (!enabled) return;
      // Lot déjà programmé : écrit puis effacé ; les événements suivants partent dans un nouveau lot, après l'effacement
      batch = null;
      await run(() => store.clear());
    },
    idle: () => chain,
  };
}

// ─── Messages de trace (pages de l'extension, scripts de contenu) ─────────

export interface TraceSender {
  id?: string;
  url?: string;
  tab?: { id?: number };
}

export interface TraceExtension {
  extensionId: string;
  /** chrome.runtime.getURL('') */
  extensionOrigin: string;
}

/** Écran d'une page de l'extension d'après son URL ; toute autre URL est un script de contenu */
export function traceSourceOf(url: string | undefined, extensionOrigin: string): TraceSource {
  if (url === undefined || !url.startsWith(extensionOrigin)) return 'content';
  const path = url.slice(extensionOrigin.length);
  if (path.includes('sidepanel')) return 'panel';
  if (path.includes('popup')) return 'popup';
  if (path.includes('import')) return 'import';
  return 'settings';
}

/**
 * Message de trace reçu : événement ajouté (source « content » et onglet de l'expéditeur pour un script de contenu, qui
 * ne peut pas se faire passer pour une page), effacement et mode détaillé réservés aux pages. null : refusé (autre
 * extension, payload invalide, build publié).
 */
export function receiveTraceMessage(writer: TraceWriter, message: unknown, sender: TraceSender, extension: TraceExtension): Promise<DebugTraceResponse> | null {
  if (!writer.enabled || sender.id !== extension.extensionId || !isDebugTraceMessage(message)) return null;
  const fromPage = typeof sender.url === 'string' && sender.url.startsWith(extension.extensionOrigin);
  const command = message.payload;
  const answer = async (): Promise<DebugTraceResponse> => ({ verbose: await writer.verbose() });
  switch (command.kind) {
    case 'event': {
      const { event } = command;
      const tabId = fromPage ? event.tabId : sender.tab?.id;
      writer.append({
        at: event.at,
        source: fromPage ? (event.source ?? traceSourceOf(sender.url, extension.extensionOrigin)) : 'content',
        ...(tabId !== undefined ? { tabId } : {}),
        ...(event.platform !== undefined ? { platform: event.platform } : {}),
        category: event.category,
        type: event.type,
        data: event.data ?? {},
      });
      return answer();
    }
    case 'clear':
      return fromPage ? writer.clear().then(answer) : null;
    case 'verbose':
      return fromPage ? writer.setVerbose(command.verbose).then((verbose) => ({ verbose })) : null;
  }
}

// ─── Messages typés reçus par le service worker ───────────────────────────

/** Actions de l'utilisateur (popup, panneau, invite de fin d'épisode) : catégorie « ui », type en kebab-case */
const UI_ACTIONS: ReadonlySet<MessageType> = new Set<MessageType>([
  'ADJUST_PROGRESS',
  'SET_LIST_STATUS',
  'RATE_MEDIA',
  'REMOVE_FROM_LIST',
  'SET_LIST_NOTES',
  'ADD_TO_LIST',
  'RESOLVE_REVIEW',
  'DISMISS_REVIEW',
  'REOPEN_REVIEW',
  'RETRY_QUEUED',
  'START_REWATCH',
  'DECLINE_REWATCH',
  'DEFER_RATING',
]);

const kebab = (type: string): string => type.toLowerCase().replaceAll('_', '-');

/** Champs utiles d'un payload (identifiants de fiche, numéros, statuts) ; jamais le texte d'un commentaire ni une URL */
function payloadSummary(payload: unknown): TraceData {
  if (!isRecord(payload)) return {};
  const summary: TraceData = {};
  for (const key of ['mediaId', 'malId', 'delta', 'score', 'progress', 'key', 'id', 'service', 'force', 'query', 'locale', 'fromCard'] as const) {
    const value = payload[key];
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' || value === null) summary[key] = value;
  }
  if (typeof payload.status === 'string') summary.newStatus = payload.status;
  if (isRecord(payload.media)) {
    const { mediaId, malId } = payload.media;
    if (typeof mediaId === 'number' || mediaId === null) summary.mediaId = mediaId;
    if (typeof malId === 'number' || malId === null) summary.malId = malId;
  }
  if (typeof payload.notes === 'string') summary.notesLength = payload.notes.length;
  if (payload.retry !== undefined) summary.retry = true;
  if (Array.isArray(payload.services)) summary.services = payload.services.filter((s): s is string => typeof s === 'string');
  if (isEpisodeInfo(payload.episode)) Object.assign(summary, episodeTraceData(payload.episode));
  if (isRecord(payload.page)) {
    const { kind, seriesTitle, seasonNumber } = payload.page;
    if (typeof kind === 'string') summary.pageKind = kind;
    if (typeof seriesTitle === 'string') summary.title = seriesTitle;
    if (typeof seasonNumber === 'number') summary.season = seasonNumber;
  }
  return summary;
}

const OUTCOME_STATUSES = new Set(['synced', 'needs-review', 'not-connected', 'excluded', 'ignored', 'error']);

/** Réponse d'une synchro ou d'une action (SyncOutcome) */
function isSyncOutcome(value: unknown): value is SyncOutcome {
  return isRecord(value) && typeof value.status === 'string' && OUTCOME_STATUSES.has(value.status) && (value.status !== 'synced' || Array.isArray(value.results));
}

/** Réponse résumée : statut par service (SyncOutcome), `ok` et code (Result), résumé des sorties, rien sinon */
function responseSummary(response: unknown): TraceData {
  if (isSyncOutcome(response)) return summarizeOutcome(response);
  if (!isRecord(response)) return { response: response === null ? 'null' : typeof response };
  if (typeof response.ok === 'boolean') return { ok: response.ok, ...(typeof response.code === 'string' ? { code: response.code } : {}) };
  if (typeof response.notified === 'number') return { notified: response.notified, skipped: typeof response.skipped === 'string' ? response.skipped : null, failed: typeof response.error === 'string' };
  return {};
}

export interface MessageTraceContext {
  source: TraceSource;
  ms: number;
  tabId?: number;
}

/** Message typé traité : action de l'interface, connexion à un compte, ou message ordinaire (type et résultat) (pur) */
export function messageTraceRecord(type: MessageType, payload: unknown, response: unknown, { source, ms, tabId }: MessageTraceContext): TraceRecord {
  const episode = isRecord(payload) && isEpisodeInfo(payload.episode) ? payload.episode : null;
  const base = {
    at: Date.now(),
    source,
    ...(tabId !== undefined ? { tabId } : {}),
    ...(episode ? { platform: episode.platform } : {}),
  };
  if (type === 'LOGIN_ANILIST' || type === 'LOGIN_MAL') {
    return { ...base, category: 'account', type: 'sign-in', data: { service: type === 'LOGIN_ANILIST' ? 'anilist' : 'mal', ...responseSummary(response), ms } };
  }
  if (UI_ACTIONS.has(type)) return { ...base, category: 'ui', type: kebab(type), data: { ...payloadSummary(payload), ...responseSummary(response), ms } };
  return { ...base, category: 'message', type: 'received', data: { message: type, ...payloadSummary(payload), ...responseSummary(response), ms } };
}

// ─── Instance du service worker ───────────────────────────────────────────

/** storage.session (contenu relu tel quel, revalidé par shared/debug-trace.ts › appendTraceEvents) ; absent : rien */
const sessionTraceStore: TraceStore = {
  read: async () => (await sessionArea()?.get(DEBUG_TRACE_KEY))?.[DEBUG_TRACE_KEY],
  write: async (events) => {
    await sessionArea()?.set({ [DEBUG_TRACE_KEY]: events });
  },
  readVerbose: async () => (await sessionArea()?.get(DEBUG_TRACE_VERBOSE_KEY))?.[DEBUG_TRACE_VERBOSE_KEY] === true,
  writeVerbose: async (verbose) => {
    await sessionArea()?.set({ [DEBUG_TRACE_VERBOSE_KEY]: verbose });
  },
  clear: async () => {
    await sessionArea()?.remove(DEBUG_TRACE_KEY);
  },
};

let writer: TraceWriter | null = null;

/** Écrivain du service worker (créé au premier usage : aucun appel au chargement du module) */
export function traceWriterInstance(): TraceWriter {
  writer ??= createTraceWriter(sessionTraceStore);
  return writer;
}

/** Service worker : ses propres événements (trace(), lignes du logger) vont directement dans la trace */
export function installTraceWriter(): void {
  const instance = traceWriterInstance();
  setTraceTransport(({ at, tabId, platform, category, type, data }) =>
    instance.append({ at, source: 'sw', ...(tabId !== undefined ? { tabId } : {}), ...(platform !== undefined ? { platform } : {}), category, type, data: data ?? {} }),
  );
}

/** Message de trace reçu par runtime.onMessage ; false s'il est refusé (le canal n'est pas gardé ouvert) */
export function answerTraceMessage(message: unknown, sender: chrome.runtime.MessageSender, sendResponse: (response: DebugTraceResponse) => void): boolean {
  const pending = receiveTraceMessage(traceWriterInstance(), message, sender, { extensionId: chrome.runtime.id, extensionOrigin: chrome.runtime.getURL('') });
  if (pending === null) return false;
  pending.then(sendResponse, () => sendResponse({ verbose: false }));
  return true;
}

/** Message typé traité par le service worker : type, expéditeur, durée et résultat résumé */
export function traceRuntimeMessage(type: MessageType, payload: unknown, response: unknown, sender: chrome.runtime.MessageSender, fromContent: boolean, receivedAt: number): void {
  const source = fromContent ? 'content' : traceSourceOf(sender.url, chrome.runtime.getURL(''));
  const tabId = fromContent ? sender.tab?.id : undefined;
  traceWriterInstance().append(messageTraceRecord(type, payload, response, { source, ms: Date.now() - receivedAt, ...(tabId !== undefined ? { tabId } : {}) }));
}
