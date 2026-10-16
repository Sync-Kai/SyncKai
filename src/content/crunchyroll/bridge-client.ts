// Client du pont Crunchyroll, côté script de contenu isolé : reçoit du script du monde MAIN (page-bridge.iife.ts), sur
// un canal privé (MessageChannel, voir bridge-protocol.ts et content/bridge/client-kit.ts), la table des signaux de
// chaque série vue par la page. Lecture synchrone du cache (revalidée par crunchyrollTableSignals) : sans pont ou sans
// donnée, aucun signal (comportement d'avant). Volontairement minimal : il est chargé par le script de contenu Crunchyroll (budget).
import { keep } from '../../shared/lru';
import { createBridgeConnection, pageEndpoints, type ChannelEndpoints } from '../bridge/client-kit';
import { CRUNCHYROLL_HANDSHAKE_EVENT, CRUNCHYROLL_MAX_SERIES, decodeCrunchyrollPush, encodeCrunchyrollHandshake, encodeCrunchyrollPortOffer } from './bridge-protocol';

/** Attente de l'offre de port : pont absent au-delà (onglet ouvert avant l'installation), nouvel essai à la lecture suivante */
const CONNECT_TIMEOUT_MS = 10_000;

/** Dernière table reçue pour une série (non revalidée), null si le pont ne l'a pas vue */
export type CrunchyrollTables = (seriesId: string) => Record<string, unknown> | null;

/**
 * Ouvre le canal tout de suite (une fois par instance du script de contenu) et retourne la lecture des tables reçues.
 * Pont absent (onglet ouvert avant l'installation ou la mise à jour) : chaque lecture réessaie, sans effet.
 * Défaut : la page (document, window, location.origin).
 */
export function connectCrunchyrollBridge(endpoints: ChannelEndpoints = pageEndpoints()): CrunchyrollTables {
  const tables = new Map<string, Record<string, unknown>>();
  const connect = createBridgeConnection({
    endpoints,
    event: CRUNCHYROLL_HANDSHAKE_EVENT,
    handshake: encodeCrunchyrollHandshake,
    // Chaîne fixe pour ce nonce (le pont l'émet avec la même fonction) : tout autre `postMessage` de la page est ignoré
    isOffer: (data, nonce) => data === encodeCrunchyrollPortOffer(nonce),
    timeoutMs: CONNECT_TIMEOUT_MS,
    // Plus anciennes d'abord (ordre d'insertion), au plus CRUNCHYROLL_MAX_SERIES
    onMessage: (data) => {
      for (const { seriesId, table } of decodeCrunchyrollPush(data)) keep(tables, seriesId, table, CRUNCHYROLL_MAX_SERIES);
    },
  });
  void connect();
  return (seriesId) => {
    void connect();
    return tables.get(seriesId) ?? null;
  };
}
