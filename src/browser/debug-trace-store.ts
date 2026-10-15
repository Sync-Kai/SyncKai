import { DEBUG_TRACE_MESSAGE, isDebugTraceResponse, type DebugTraceMessage } from '../protocol/debug-trace';
import { DEBUG_TRACE_KEY, DEBUG_TRACE_VERBOSE_KEY } from '../protocol/storage-keys';
import { isTraceEvent, type TraceEvent } from '../shared/debug-trace';
import { sessionArea } from './storage/session-cache';

// Trace de débogage (builds de dev seulement) dans storage.session, côté pages : lecture par Réglages › Aide. Le service
// worker est seul à écrire (background/debug-trace.ts, qui n'importe pas ce module : il n'entre dans aucun chunk partagé
// avec lui) ; « Effacer » et le mode détaillé passent par lui : une écriture en cours de la trace ne fait pas réapparaître
// les événements effacés. Sans `storage.session` : trace vide.

/** Événements enregistrés, dans l'ordre d'arrivée */
export async function readTraceEvents(): Promise<TraceEvent[]> {
  const area = sessionArea();
  if (!area) return [];
  const stored: unknown = (await area.get(DEBUG_TRACE_KEY))[DEBUG_TRACE_KEY];
  return Array.isArray(stored) ? stored.filter(isTraceEvent) : [];
}

export async function readTraceVerbose(): Promise<boolean> {
  const area = sessionArea();
  if (!area) return false;
  return (await area.get(DEBUG_TRACE_VERBOSE_KEY))[DEBUG_TRACE_VERBOSE_KEY] === true;
}

/** Page de l'extension : efface la trace (service worker) */
export async function clearTrace(): Promise<void> {
  const message: DebugTraceMessage = { type: DEBUG_TRACE_MESSAGE, payload: { kind: 'clear' } };
  await chrome.runtime.sendMessage(message);
}

/** Page de l'extension : mode détaillé (1000 événements, toutes les lignes du logger) ; renvoie l'état retenu */
export async function setTraceVerbose(verbose: boolean): Promise<boolean> {
  const message: DebugTraceMessage = { type: DEBUG_TRACE_MESSAGE, payload: { kind: 'verbose', verbose } };
  const response: unknown = await chrome.runtime.sendMessage(message);
  return isDebugTraceResponse(response) ? response.verbose : verbose;
}
