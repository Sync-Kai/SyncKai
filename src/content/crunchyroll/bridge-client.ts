// Client du pont Crunchyroll, côté script de contenu isolé : reçoit du script du monde MAIN (page-bridge.iife.ts), sur
// un canal privé (MessageChannel, voir bridge-protocol.ts), la table des signaux de chaque série vue par la page.
// Lecture synchrone du cache (revalidée par crunchyrollTableSignals) : sans pont ou sans donnée, aucun signal
// (comportement d'avant). Volontairement minimal : il est chargé par le script de contenu Crunchyroll / ADN (budget).
import { CRUNCHYROLL_HANDSHAKE_EVENT, CRUNCHYROLL_MAX_SERIES, decodeCrunchyrollPush, encodeCrunchyrollHandshake, encodeCrunchyrollPortOffer } from './bridge-protocol';

export interface CrunchyrollBridgeOptions {
  /** Cible de la demande d'ouverture du canal (document en production) */
  target: EventTarget;
  /** Réception de l'offre de port par `postMessage` (window en production) */
  messages: EventTarget;
  /** Origine attendue de l'offre (location.origin) */
  origin: string;
  /** Défaut : `event.isTrusted` ; remplacé dans les tests (Node : toujours faux) */
  isTrusted?: (event: Event) => boolean;
}

/** Dernière table reçue pour une série (non revalidée), null si le pont ne l'a pas vue */
export type CrunchyrollTables = (seriesId: string) => Record<string, unknown> | null;

/**
 * Ouvre le canal tout de suite (une fois par instance du script de contenu) et retourne la lecture des tables reçues.
 * Pont absent (onglet ouvert avant l'installation ou la mise à jour) : l'écouteur de l'offre reste posé, sans effet.
 * Défaut : la page (document, window, location.origin).
 */
export function connectCrunchyrollBridge(options: CrunchyrollBridgeOptions = { target: document, messages: window, origin: location.origin }): CrunchyrollTables {
  const { messages, origin } = options;
  const isTrusted = options.isTrusted ?? ((event: Event): boolean => event.isTrusted);
  const tables = new Map<string, Record<string, unknown>>();
  const nonce = crypto.randomUUID();
  const offer = encodeCrunchyrollPortOffer(nonce);

  function onPush(event: Event): void {
    if (!(event instanceof MessageEvent) || !isTrusted(event)) return;
    for (const { seriesId, table } of decodeCrunchyrollPush(event.data)) {
      tables.delete(seriesId);
      tables.set(seriesId, table);
    }
    // Plus anciennes d'abord (ordre d'insertion), au plus CRUNCHYROLL_MAX_SERIES
    for (const key of tables.keys()) if (tables.size > CRUNCHYROLL_MAX_SERIES) tables.delete(key);
  }

  // Premier port offert pour ce nonce seulement
  function onOffer(event: Event): void {
    const [port] = event instanceof MessageEvent && isTrusted(event) && event.origin === origin && event.data === offer ? event.ports : [];
    if (!(port instanceof MessagePort)) return;
    messages.removeEventListener('message', onOffer);
    port.addEventListener('message', onPush);
    port.start();
  }

  messages.addEventListener('message', onOffer);
  options.target.dispatchEvent(new CustomEvent(CRUNCHYROLL_HANDSHAKE_EVENT, { detail: encodeCrunchyrollHandshake(nonce) }));
  return (seriesId) => tables.get(seriesId) ?? null;
}
