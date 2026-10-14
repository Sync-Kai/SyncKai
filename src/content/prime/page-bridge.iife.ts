// Script Prime Video du monde principal (MAIN), enregistré à `document_start` : observateur PASSIF des réponses JSON que
// le site demande lui-même (fetch et XMLHttpRequest) : page de détail après une navigation SPA (`/detail/{id}`),
// `getDetailWidgets`, `playerChromeResources` (`catalogMetadataV2` seul) et `GetVodPlaybackResources` (début du générique
// de fin et durée seuls). Il n'émet aucune requête, ne lit aucun en-tête, cookie ni jeton, ne touche à aucune URL de flux
// ni licence : seules les formes réduites (bridge-protocol.ts, shared/prime-metadata.ts) sont gardées et transmises.
// Aucun chrome.*. Format IIFE (suffixe .iife.ts) : un chargeur ESM ne fonctionne pas dans le monde MAIN.
//
// Le relevé ne voit que les requêtes émises APRÈS son installation : dans un onglet déjà ouvert à l'activation ou à une
// mise à jour, l'épisode en cours n'est pas identifié ; l'épisode suivant (lecture automatique) l'est.
//
// Indexation par identifiant de la requête, jamais « dernière réponse reçue » : la réponse de lecture de l'épisode
// SUIVANT arrive environ 1 s avant la bascule, pendant que l'épisode précédent est encore à l'écran.
import { reducePrimeDetail, reducePrimeDetailWidgets } from '../../shared/prime-metadata';
import {
  decodePrimeHandshake,
  encodePrimePortOffer,
  encodePrimePush,
  installPrimeBridgeOnce,
  observedPrimeRequest,
  PRIME_BRIDGE_VERSION,
  PRIME_HANDSHAKE_EVENT,
  PRIME_MAX_CATALOG,
  PRIME_MAX_PLAYBACK,
  PRIME_MAX_TITLES,
  PRIME_MAX_WIDGETS,
  PRIME_PORT_OFFER,
  reducePrimeCatalog,
  reducePrimePlayback,
  type PrimeBridgePush,
  type PrimeCatalogEntry,
  type PrimePlaybackEntry,
  type PrimeRequestKind,
  type PrimeTitleEntry,
  type PrimeWidgetsEntry,
} from './bridge-protocol';

/** Clients isolés connectés au plus (réinjections successives) : le plus ancien port est fermé au-delà */
const MAX_PORTS = 4;
/** Réponse texte au-delà de laquelle rien n'est lu (une page de détail fait quelques centaines de Ko) */
const MAX_RESPONSE_LENGTH = 4_000_000;

// Références prises à l'installation : une redéfinition ultérieure par la page ne détourne pas le canal
const Channel = MessageChannel;
const CustomEventType = CustomEvent;
const parseJson = JSON.parse;
const postToWindow = window.postMessage.bind(window);

/** Vues par identifiant de la requête ; ordre d'insertion = ancienneté */
const catalog = new Map<string, PrimeCatalogEntry>();
const playback = new Map<string, PrimePlaybackEntry>();
const titles = new Map<string, PrimeTitleEntry>();
const widgets: PrimeWidgetsEntry[] = [];
const ports: MessagePort[] = [];

type Delta = Omit<PrimeBridgePush, 'v'>;
const EMPTY: Delta = { catalog: [], playback: [], titles: [], widgets: [] };

function push(delta: Partial<Delta>, targets: readonly MessagePort[]): void {
  const full = { ...EMPTY, ...delta };
  if (full.catalog.length + full.playback.length + full.titles.length + full.widgets.length === 0) return;
  const message = encodePrimePush({
    v: PRIME_BRIDGE_VERSION,
    catalog: full.catalog.slice(-PRIME_MAX_CATALOG),
    playback: full.playback.slice(-PRIME_MAX_PLAYBACK),
    titles: full.titles.slice(-PRIME_MAX_TITLES),
    widgets: full.widgets.slice(-PRIME_MAX_WIDGETS),
  });
  for (const port of targets) port.postMessage(message);
}

/** Garde `value` sous `key` (la plus récente en dernier), au plus `max` */
function keep<T>(map: Map<string, T>, key: string, value: T, max: number): void {
  map.delete(key);
  map.set(key, value);
  for (const old of [...map.keys()].slice(0, Math.max(0, map.size - max))) map.delete(old);
}

function onPayload(kind: PrimeRequestKind, id: string, raw: unknown): void {
  const seenAt = Date.now();
  switch (kind) {
    case 'catalog': {
      const entry = reducePrimeCatalog(raw, id, seenAt);
      if (!entry) return;
      keep(catalog, entry.id, entry, PRIME_MAX_CATALOG);
      push({ catalog: [entry] }, ports);
      return;
    }
    case 'playback': {
      const entry = reducePrimePlayback(raw, id, seenAt);
      if (!entry) return;
      keep(playback, entry.id, entry, PRIME_MAX_PLAYBACK);
      push({ playback: [entry] }, ports);
      return;
    }
    case 'detail': {
      const title = reducePrimeDetail(raw);
      if (!title) return;
      const entry: PrimeTitleEntry = { requestId: id, seenAt, title };
      keep(titles, title.seasonGti, entry, PRIME_MAX_TITLES);
      push({ titles: [entry] }, ports);
      return;
    }
    case 'widgets': {
      const reduced = reducePrimeDetailWidgets(raw);
      if (!reduced) return;
      const entry: PrimeWidgetsEntry = { seenAt, widgets: reduced };
      widgets.push(entry);
      if (widgets.length > PRIME_MAX_WIDGETS) widgets.shift();
      push({ widgets: [entry] }, ports);
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

/** URL passée à `open` / `fetch` (chaîne, URL ou Request) → texte, sinon null */
function urlOf(input: unknown): string | null {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.href;
  if (typeof Request !== 'undefined' && input instanceof Request) return input.url;
  return null;
}

type Observed = { kind: PrimeRequestKind; id: string };

function observe(input: unknown): Observed | null {
  const url = urlOf(input);
  return url !== null ? observedPrimeRequest(url, location.href) : null;
}

/** XMLHttpRequest : `open` repère les requêtes lues, `send` attend leur réponse (lecture seule) */
function observeXhr(): void {
  const proto = XMLHttpRequest.prototype;
  const open = proto.open;
  const send = proto.send;
  const observed = new WeakMap<XMLHttpRequest, Observed>();

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
          if (this.status !== 200) return;
          if (this.responseType === '' || this.responseType === 'text') onPayload(request.kind, request.id, parseText(this.responseText));
          else if (this.responseType === 'json') onPayload(request.kind, request.id, this.response as unknown);
        },
        { once: true },
      );
    }
    Reflect.apply(send, this, args);
  };
}

/** fetch : même relevé sur une copie de la réponse (le site reçoit l'originale, intacte) ; une réponse HTML n'est pas du JSON (ignorée) */
function observeFetch(): void {
  const originalFetch = window.fetch;
  window.fetch = function patchedFetch(this: unknown, ...args: Parameters<typeof fetch>): Promise<Response> {
    const result = originalFetch.apply(this, args);
    const request = observe(args[0]);
    if (request) {
      result
        .then((response) => (response.ok ? response.clone().text() : ''))
        .then((body) => onPayload(request.kind, request.id, parseText(body)))
        .catch(() => undefined);
    }
    return result;
  };
}

/** Demande d'ouverture : nouveau canal, port2 transféré au script isolé (même origine), puis tout ce qui a été vu */
function onHandshake(event: Event): void {
  if (!(event instanceof CustomEventType)) return;
  const handshake = decodePrimeHandshake(event.detail);
  if (!handshake) return;
  const { port1, port2 } = new Channel();
  ports.push(port1);
  while (ports.length > MAX_PORTS) ports.shift()?.close();
  postToWindow(encodePrimePortOffer({ v: PRIME_BRIDGE_VERSION, type: PRIME_PORT_OFFER, nonce: handshake.nonce }), location.origin, [port2]);
  push({ catalog: [...catalog.values()], playback: [...playback.values()], titles: [...titles.values()], widgets: [...widgets] }, [port1]);
}

// Garde par version (réenregistrement du script, bfcache, réinjection après une mise à jour). Capture sur window
installPrimeBridgeOnce(window, PRIME_BRIDGE_VERSION, () => {
  observeXhr();
  observeFetch();
  window.addEventListener(PRIME_HANDSHAKE_EVENT, onHandshake, true);
});
