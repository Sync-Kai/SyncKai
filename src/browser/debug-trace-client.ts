import { DEBUG_TRACE_MESSAGE, isDebugTraceResponse, type DebugTraceMessage } from '../protocol/debug-trace';
import { formatTraceArgs, type TraceCategory, type TraceContext, type TraceInput } from '../shared/debug-trace';

// Producteur de la trace de débogage (builds de dev seulement : chaque appel est placé sous `if (__SYNCKAI_DEBUG__)`, absent
// des bundles publiés). Même module dans tous les contextes : pages et scripts de contenu envoient l'événement au service
// worker (message `debug:trace:message`), le service worker l'ajoute directement (background/debug-trace.ts remplace le
// transport). Règle : ce module ne logue jamais (le logger l'appelle) et ne lève jamais.

export type TraceTransport = (input: TraceInput) => void;

/** Mode détaillé connu par la dernière réponse du service worker ; null tant qu'inconnu (les lignes partent, il trie) */
let verbose: boolean | null = null;

export function noteTraceVerbose(next: boolean | null): void {
  verbose = next;
}

/** Envoi au service worker ; injoignable (endormi sans écouteur, script orphelin) : événement perdu, sans bruit */
export const messageTransport: TraceTransport = (input) => {
  const message: DebugTraceMessage = { type: DEBUG_TRACE_MESSAGE, payload: { kind: 'event', event: input } };
  chrome.runtime.sendMessage(message).then(
    (response: unknown) => {
      if (isDebugTraceResponse(response)) verbose = response.verbose;
    },
    () => undefined,
  );
};

/** Tests unitaires : aucun envoi par défaut (les fausses API comptent les messages) ; extension : envoi au service worker */
let transport: TraceTransport | null = import.meta.env.MODE === 'test' ? null : messageTransport;

export function setTraceTransport(next: TraceTransport | null): void {
  transport = next;
}

/** Ajoute un événement à la trace (données brutes : bornées et filtrées par le service worker, shared/debug-trace.ts) */
export function trace(category: TraceCategory, type: string, data: Record<string, unknown> = {}, context: TraceContext = {}): void {
  if (!__SYNCKAI_DEBUG__ || transport === null) return;
  try {
    transport({ at: Date.now(), category, type, data, ...context });
  } catch {
    // Contexte d'extension invalidé (script orphelin) : rien à faire
  }
}

/** Ligne du logger : warn / error toujours, info / debug seulement en mode détaillé (ou tant qu'il est inconnu) */
export function traceLog(level: 'debug' | 'info' | 'warn' | 'error', scope: string, args: readonly unknown[]): void {
  if (!__SYNCKAI_DEBUG__ || transport === null) return;
  if ((level === 'info' || level === 'debug') && verbose === false) return;
  trace('log', level, { scope, message: formatTraceArgs(args) });
}
