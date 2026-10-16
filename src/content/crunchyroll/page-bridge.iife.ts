// Script Crunchyroll du monde principal (MAIN), déclaré dans le manifeste (`world: "MAIN"`, `document_start`) :
// observateur PASSIF des réponses JSON que l'application web demande elle-même (fetch et XMLHttpRequest) pour une
// série (`cms/series/{id}`, `…/seasons`), une saison (`cms/seasons/{id}/episodes`) et l'épisode suggéré
// (`discover/up_next/{id}`). Il n'émet aucune requête et ne lit ni en-tête (ces requêtes portent le jeton de
// l'utilisateur), ni cookie, ni identifiant de compte ou de profil, ni URL de flux : seules les formes réduites
// (platforms/crunchyroll/metadata.ts : années, nombres d'épisodes, durées, langue audio, identifiants de contenu) sont
// gardées, et seule leur table de signaux est transmise au script isolé. Aucun chrome.*. Format IIFE (suffixe .iife.ts) : un chargeur ESM ne
// fonctionne pas dans le monde MAIN. Relevé, canal et garde par version : content/bridge/kit.ts.
//
// Le monde MAIN appartient à la page : ce qui sort de ce pont est une donnée que la page aurait pu écrire (le client
// isolé revalide chaque table, voir le kit). Le relevé ne voit que les requêtes émises APRÈS son installation : dans un
// onglet ouvert avant l'installation ou une mise à jour, ou si l'application garde sa réponse en cache, aucune donnée →
// aucun signal (comportement d'avant).
import {
  crunchyrollSignalTable,
  mergeCrunchyrollSeries,
  reduceCrunchyrollEpisodes,
  reduceCrunchyrollSeasons,
  reduceCrunchyrollSeries,
  reduceCrunchyrollUpNext,
  type CrunchyrollEpisodeStats,
  type CrunchyrollSeasonRow,
  type CrunchyrollSignalTable,
} from '../../platforms/crunchyroll/metadata';
import { keep } from '../../shared/lru';
import { installPassiveBridge } from '../bridge/kit';
import {
  CRUNCHYROLL_BRIDGE_VERSION,
  CRUNCHYROLL_HANDSHAKE_EVENT,
  CRUNCHYROLL_MAX_SERIES,
  crunchyrollBridgeFlag,
  crunchyrollObserverKey,
  decodeCrunchyrollHandshake,
  encodeCrunchyrollPortOffer,
  encodeCrunchyrollPush,
  observedCrunchyrollRequest,
  type CrunchyrollRequest,
} from './bridge-protocol';

/** Statistiques d'épisodes gardées (saisons) */
const MAX_SEASON_STATS = 40;
/** Réponse texte au-delà de laquelle rien n'est lu (une liste d'épisodes fait quelques centaines de Ko) */
const MAX_RESPONSE_LENGTH = 4_000_000;

/** Par série : année de lancement et saisons listées ; ordre d'insertion = ancienneté */
const launchYears = new Map<string, number | null>();
const seasonLists = new Map<string, CrunchyrollSeasonRow[]>();
/** Par saison : épisodes vus (liste complète, sinon épisode suggéré) */
const seasonStats = new Map<string, { stats: CrunchyrollEpisodeStats; full: boolean }>();

/** Table des signaux de la série (règles des doublages et de la saison d'origine appliquées ici, voir platforms/crunchyroll/metadata.ts) */
function view(seriesId: string): CrunchyrollSignalTable {
  return crunchyrollSignalTable(mergeCrunchyrollSeries(seriesId, launchYears.get(seriesId) ?? null, seasonLists.get(seriesId) ?? [], (id) => seasonStats.get(id)?.stats));
}

function knownSeries(): string[] {
  return [...new Set([...launchYears.keys(), ...seasonLists.keys()])].slice(-CRUNCHYROLL_MAX_SERIES);
}

/** Message des tables de ces séries, null sans série */
function push(seriesIds: readonly string[]): string | null {
  if (seriesIds.length === 0) return null;
  return encodeCrunchyrollPush({ v: CRUNCHYROLL_BRIDGE_VERSION, tables: seriesIds.slice(-CRUNCHYROLL_MAX_SERIES).map(view) });
}

/** Séries qui listent cette saison (statistiques reçues) */
const seriesOfSeason = (seasonId: string): string[] => [...seasonLists].filter(([, rows]) => rows.some((row) => row.id === seasonId)).map(([id]) => id);

function onPayload(request: CrunchyrollRequest, raw: unknown): string | null {
  switch (request.kind) {
    case 'series': {
      const series = reduceCrunchyrollSeries(raw);
      if (!series) return null;
      keep(launchYears, request.seriesId, series.launchYear, CRUNCHYROLL_MAX_SERIES);
      return push([request.seriesId]);
    }
    case 'seasons': {
      const rows = reduceCrunchyrollSeasons(raw);
      if (!rows) return null;
      keep(seasonLists, request.seriesId, rows, CRUNCHYROLL_MAX_SERIES);
      return push([request.seriesId]);
    }
    case 'episodes': {
      const stats = reduceCrunchyrollEpisodes(raw);
      if (!stats) return null;
      keep(seasonStats, request.seasonId, { stats, full: true }, MAX_SEASON_STATS);
      return push(seriesOfSeason(request.seasonId));
    }
    case 'upNext': {
      const next = reduceCrunchyrollUpNext(raw);
      // Un épisode isolé ne remplace jamais la liste complète de sa saison
      if (!next || seasonStats.get(next.seasonId)?.full) return null;
      keep(seasonStats, next.seasonId, { stats: next.stats, full: false }, MAX_SEASON_STATS);
      return push(seriesOfSeason(next.seasonId));
    }
  }
}

installPassiveBridge({
  flag: crunchyrollBridgeFlag(CRUNCHYROLL_BRIDGE_VERSION),
  observerKey: crunchyrollObserverKey,
  handshakeEvent: CRUNCHYROLL_HANDSHAKE_EVENT,
  decodeHandshake: decodeCrunchyrollHandshake,
  encodeOffer: encodeCrunchyrollPortOffer,
  observe: observedCrunchyrollRequest,
  onPayload,
  snapshot: () => push(knownSeries()),
  maxResponseLength: MAX_RESPONSE_LENGTH,
});
