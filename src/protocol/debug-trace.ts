import { isRecord } from '../shared/guards';
import { isTraceInput, type TraceInput } from '../shared/debug-trace';

// Message de la trace de débogage (builds de dev seulement, voir shared/debug-trace.ts) : scripts de contenu et pages de
// l'extension → service worker, seul à écrire la trace. Hors de MessageMap / MESSAGE_ORIGINS exprès : le type et ses gardes
// y resteraient dans les bundles publiés. Le service worker le traite avant les messages typés, sous `if (__SYNCKAI_DEBUG__)`,
// avec les mêmes contrôles (même extension ; `clear` et `verbose` réservés aux pages, voir background/debug-trace.ts).
// Préfixe `debug:trace` refusé dans les paquets publiés (scripts/build-checks.ts › DEV_ONLY_MARKERS).

export const DEBUG_TRACE_MESSAGE = 'debug:trace:message';

export type DebugTraceCommand = { kind: 'event'; event: TraceInput } | { kind: 'clear' } | { kind: 'verbose'; verbose: boolean };

export interface DebugTraceMessage {
  type: typeof DEBUG_TRACE_MESSAGE;
  payload: DebugTraceCommand;
}

/** Réponse du service worker : mode détaillé actuel (les producteurs n'envoient plus les lignes info / debug sans lui) */
export interface DebugTraceResponse {
  verbose: boolean;
}

function isDebugTraceCommand(value: unknown): value is DebugTraceCommand {
  if (!isRecord(value)) return false;
  switch (value.kind) {
    case 'event':
      return isTraceInput(value.event);
    case 'clear':
      return true;
    case 'verbose':
      return typeof value.verbose === 'boolean';
    default:
      return false;
  }
}

export function isDebugTraceMessage(value: unknown): value is DebugTraceMessage {
  return isRecord(value) && value.type === DEBUG_TRACE_MESSAGE && isDebugTraceCommand(value.payload);
}

export function isDebugTraceResponse(value: unknown): value is DebugTraceResponse {
  return isRecord(value) && typeof value.verbose === 'boolean';
}
