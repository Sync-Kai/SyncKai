// Script Crunchyroll du monde principal (MAIN), déclaré dans le manifeste (`world: "MAIN"`, `document_start`) :
// observateur PASSIF des réponses JSON que l'application web demande elle-même (fetch et XMLHttpRequest) pour une
// série (`cms/series/{id}`, `…/seasons`), une saison (`cms/seasons/{id}/episodes`) et l'épisode suggéré
// (`discover/up_next/{id}`). Il n'émet aucune requête et ne lit ni en-tête (ces requêtes portent le jeton de
// l'utilisateur), ni cookie, ni identifiant de compte ou de profil, ni URL de flux : seules les formes réduites
// (shared/crunchyroll-metadata.ts : années, nombres d'épisodes, durées, langue audio, identifiants de contenu) sont
// gardées, et seule leur table de signaux est transmise au script isolé. Aucun chrome.*. Format IIFE (suffixe .iife.ts) : un chargeur ESM ne
// fonctionne pas dans le monde MAIN.
//
// Le relevé ne voit que les requêtes émises APRÈS son installation : dans un onglet ouvert avant l'installation ou une
// mise à jour, ou si l'application garde sa réponse en cache, aucune donnée → aucun signal (comportement d'avant).
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
} from '../../shared/crunchyroll-metadata';
import {
  CRUNCHYROLL_BRIDGE_VERSION,
  CRUNCHYROLL_HANDSHAKE_EVENT,
  CRUNCHYROLL_MAX_SERIES,
  decodeCrunchyrollHandshake,
  encodeCrunchyrollPortOffer,
  encodeCrunchyrollPush,
  installCrunchyrollBridgeOnce,
  observedCrunchyrollRequest,
  type CrunchyrollRequest,
} from './bridge-protocol';

/** Clients isolés connectés au plus (réinjections successives) : le plus ancien port est fermé au-delà */
const MAX_PORTS = 4;
/** Statistiques d'épisodes gardées (saisons) */
const MAX_SEASON_STATS = 40;
/** Réponse texte au-delà de laquelle rien n'est lu (une liste d'épisodes fait quelques centaines de Ko) */
const MAX_RESPONSE_LENGTH = 4_000_000;

// Références prises à l'installation : une redéfinition ultérieure par la page ne détourne pas le canal
const Channel = MessageChannel;
const CustomEventType = CustomEvent;
const parseJson = JSON.parse;
const postToWindow = window.postMessage.bind(window);

/** Par série : année de lancement et saisons listées ; ordre d'insertion = ancienneté */
const launchYears = new Map<string, number | null>();
const seasonLists = new Map<string, CrunchyrollSeasonRow[]>();
/** Par saison : épisodes vus (liste complète, sinon épisode suggéré) */
const seasonStats = new Map<string, { stats: CrunchyrollEpisodeStats; full: boolean }>();
const ports: MessagePort[] = [];

/** Garde `value` sous `key` (la plus récente en dernier), au plus `max` */
function keep<T>(map: Map<string, T>, key: string, value: T, max: number): void {
  map.delete(key);
  map.set(key, value);
  for (const old of [...map.keys()].slice(0, Math.max(0, map.size - max))) map.delete(old);
}

/** Table des signaux de la série (règles des doublages et de la saison d'origine appliquées ici, voir crunchyroll-metadata.ts) */
function view(seriesId: string): CrunchyrollSignalTable {
  return crunchyrollSignalTable(mergeCrunchyrollSeries(seriesId, launchYears.get(seriesId) ?? null, seasonLists.get(seriesId) ?? [], (id) => seasonStats.get(id)?.stats));
}

function knownSeries(): string[] {
  return [...new Set([...launchYears.keys(), ...seasonLists.keys()])].slice(-CRUNCHYROLL_MAX_SERIES);
}

function push(seriesIds: readonly string[], targets: readonly MessagePort[]): void {
  if (seriesIds.length === 0) return;
  const message = encodeCrunchyrollPush({ v: CRUNCHYROLL_BRIDGE_VERSION, tables: seriesIds.slice(-CRUNCHYROLL_MAX_SERIES).map(view) });
  for (const port of targets) port.postMessage(message);
}

/** Séries qui listent cette saison (statistiques reçues) */
const seriesOfSeason = (seasonId: string): string[] => [...seasonLists].filter(([, rows]) => rows.some((row) => row.id === seasonId)).map(([id]) => id);

function onPayload(request: CrunchyrollRequest, raw: unknown): void {
  switch (request.kind) {
    case 'series': {
      const series = reduceCrunchyrollSeries(raw);
      if (!series) return;
      keep(launchYears, request.seriesId, series.launchYear, CRUNCHYROLL_MAX_SERIES);
      push([request.seriesId], ports);
      return;
    }
    case 'seasons': {
      const rows = reduceCrunchyrollSeasons(raw);
      if (!rows) return;
      keep(seasonLists, request.seriesId, rows, CRUNCHYROLL_MAX_SERIES);
      push([request.seriesId], ports);
      return;
    }
    case 'episodes': {
      const stats = reduceCrunchyrollEpisodes(raw);
      if (!stats) return;
      keep(seasonStats, request.seasonId, { stats, full: true }, MAX_SEASON_STATS);
      push(seriesOfSeason(request.seasonId), ports);
      return;
    }
    case 'upNext': {
      const next = reduceCrunchyrollUpNext(raw);
      // Un épisode isolé ne remplace jamais la liste complète de sa saison
      if (!next || seasonStats.get(next.seasonId)?.full) return;
      keep(seasonStats, next.seasonId, { stats: next.stats, full: false }, MAX_SEASON_STATS);
      push(seriesOfSeason(next.seasonId), ports);
    }
  }
}

function parseText(body: string): unknown {
  if (body.length === 0 || body.length > MAX_RESPONSE_LENGTH) return null;
  try {
    return parseJson(body) as unknown;
  } catch {
    return null;
  }
}

/** URL passée à `open` / `fetch` (chaîne, URL ou Request) → requête lue, sinon null */
function observe(input: unknown): CrunchyrollRequest | null {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : typeof Request !== 'undefined' && input instanceof Request ? input.url : null;
  return url !== null ? observedCrunchyrollRequest(url, location.href) : null;
}

/** XMLHttpRequest : `open` repère les requêtes lues, `send` attend leur réponse (lecture seule, aucun en-tête) */
function observeXhr(): void {
  const proto = XMLHttpRequest.prototype;
  const open = proto.open;
  const send = proto.send;
  const observed = new WeakMap<XMLHttpRequest, CrunchyrollRequest>();

  // Arguments transmis tels quels (même nombre) : `open(m, u, undefined)` rendrait la requête synchrone
  proto.open = function patchedOpen(this: XMLHttpRequest, ...args: unknown[]): void {
    const request = observe(args[1]);
    if (request) observed.set(this, request);
    else observed.delete(this);
    Reflect.apply(open, this, args);
  };

  proto.send = function patchedSend(this: XMLHttpRequest, ...args: unknown[]): void {
    const request = observed.get(this);
    if (request) {
      this.addEventListener(
        'load',
        () => {
          // XHR réutilisé (`abort` puis `open`) : cet écouteur ne s'est jamais déclenché, la réponse est celle du dernier `open`
          if (observed.get(this) !== request || this.status !== 200) return;
          if (this.responseType === '' || this.responseType === 'text') onPayload(request, parseText(this.responseText));
          else if (this.responseType === 'json') onPayload(request, this.response as unknown);
        },
        { once: true },
      );
    }
    Reflect.apply(send, this, args);
  };
}

/** fetch : même relevé sur une copie de la réponse (le site reçoit l'originale, intacte) */
function observeFetch(): void {
  const originalFetch = window.fetch;
  window.fetch = function patchedFetch(this: unknown, ...args: Parameters<typeof fetch>): Promise<Response> {
    const result = originalFetch.apply(this, args);
    const request = observe(args[0]);
    if (request) {
      result
        .then((response) => (response.ok ? response.clone().text() : ''))
        .then((body) => onPayload(request, parseText(body)))
        .catch(() => undefined);
    }
    return result;
  };
}

/** Demande d'ouverture : nouveau canal, port2 transféré au script isolé (même origine), puis tout ce qui a été vu */
function onHandshake(event: Event): void {
  if (!(event instanceof CustomEventType)) return;
  const nonce = decodeCrunchyrollHandshake(event.detail);
  if (nonce === null) return;
  const { port1, port2 } = new Channel();
  ports.push(port1);
  while (ports.length > MAX_PORTS) ports.shift()?.close();
  postToWindow(encodeCrunchyrollPortOffer(nonce), location.origin, [port2]);
  push(knownSeries(), [port1]);
}

// Garde par version (bfcache, réinjection après une mise à jour). Capture sur window
installCrunchyrollBridgeOnce(window, CRUNCHYROLL_BRIDGE_VERSION, () => {
  observeXhr();
  observeFetch();
  window.addEventListener(CRUNCHYROLL_HANDSHAKE_EVENT, onHandshake, true);
});
