// Script Disney+ du monde principal (MAIN), enregistré à `document_start` : observateur PASSIF des réponses
// `playerExperience`, `page/entity-{uuid}`, `season/{id}` et de lecture (`…/playback/…`) que le site demande lui-même
// (XMLHttpRequest ; fetch couvert par précaution). Il n'émet aucune requête, ne lit aucun en-tête ni jeton, ne touche à
// aucune URL de flux : seules les formes réduites (`reduceDisneyPlayerExperience` des 20 dernières fiches, avec les
// repères de `reduceDisneyPlayback`, `reduceDisneySeriesPage` des 10 dernières pages de série) sont gardées et
// transmises au script isolé.
// Aucun chrome.*. Format IIFE (suffixe .iife.ts) : un chargeur ESM ne fonctionne pas dans le monde MAIN.
//
// Le relevé ne voit que les requêtes émises APRÈS son installation : dans un onglet déjà ouvert à l'activation ou à
// une mise à jour (script exécuté après coup), l'épisode en cours n'est pas identifié ; la navigation suivante l'est.
//
// Canal privé (voir bridge-protocol.ts) : à chaque demande d'ouverture, un MessageChannel dont port1 reste dans cette
// fermeture ; les fiches ne partent que sur ces ports, jamais sur un événement que la page pourrait imiter.
// Le monde MAIN appartient à la page (JSON, XHR… redéfinissables) : le client isolé revalide toujours les fiches.
//
// Générique de fin : la réponse de lecture du lecteur (`…bamgrid.com/…/playback/…`) est réduite ICI à ses identifiants
// et repères éditoriaux (`reduceDisneyPlayback`) ; URL signées et jetons de droits ne quittent jamais ce relevé. Les
// repères rejoignent la fiche de la même vidéo, qu'elle soit arrivée avant (fiche repoussée) ou après (en attente).
import {
  decodeDisneyHandshake,
  DISNEY_BRIDGE_VERSION,
  DISNEY_HANDSHAKE_EVENT,
  DISNEY_PORT_OFFER,
  encodeDisneyPortOffer,
  encodeDisneyPush,
  installDisneyBridgeOnce,
} from './bridge-protocol';
import {
  applyDisneySeason,
  DISNEY_MAX_ENTRIES,
  DISNEY_MAX_PAGES,
  observedRequest,
  reduceDisneyPlayback,
  reduceDisneyPlayerExperience,
  reduceDisneySeriesPage,
  withDisneyPlayback,
  type DisneyPlayback,
  type DisneyPlayerExperience,
  type DisneyRequestKind,
  type DisneySeriesPage,
} from '../../platforms/disney/metadata';

/** Clients isolés connectés au plus (réinjections successives) : le plus ancien port est fermé au-delà */
const MAX_PORTS = 4;
/** Réponse texte au-delà de laquelle rien n'est lu (une fiche fait quelques dizaines de Ko) */
const MAX_RESPONSE_LENGTH = 2_000_000;

// Références prises à l'installation : une redéfinition ultérieure par la page ne détourne pas le canal
const Channel = MessageChannel;
const CustomEventType = CustomEvent;
const parseJson = JSON.parse;
const postToWindow = window.postMessage.bind(window);

/** Fiches vues, par identifiant du chemin de la requête ; ordre d'insertion = ancienneté */
const entries = new Map<string, DisneyPlayerExperience>();
/** Pages de série vues, par uuid de l'entité ; ordre d'insertion = ancienneté */
const pages = new Map<string, DisneySeriesPage>();
/** Réponses de lecture réduites, de la plus ancienne à la plus récente (10 au plus) */
const playbacks: DisneyPlayback[] = [];
const ports: MessagePort[] = [];

function push(list: DisneyPlayerExperience[], targets: readonly MessagePort[], pageList: DisneySeriesPage[] = []): void {
  if (list.length === 0 && pageList.length === 0) return;
  const message = encodeDisneyPush({ v: DISNEY_BRIDGE_VERSION, entries: list.slice(-DISNEY_MAX_ENTRIES), pages: pageList.slice(-DISNEY_MAX_PAGES) });
  for (const port of targets) port.postMessage(message);
}

/** Retire les plus anciennes clés (ordre d'insertion) au-delà de `max` */
function trim(map: Map<string, unknown>, max: number): void {
  for (const key of [...map.keys()].slice(0, Math.max(0, map.size - max))) map.delete(key);
}

/** Garde la page (la plus récente en dernier, 10 au plus) et la pousse aux clients */
function keepPage(page: DisneySeriesPage): void {
  pages.delete(page.entityId);
  pages.set(page.entityId, page);
  trim(pages, DISNEY_MAX_PAGES);
  push([], ports, [page]);
}

/**
 * Réponse reçue pour une requête observée : page de série (réduite), saison (appliquée à la page qui la contient) ou
 * fiche de vidéo (voir onPlayerExperience)
 */
function onPayload(kind: DisneyRequestKind, id: string, raw: unknown): void {
  if (kind === 'playback') {
    onPlayback(raw);
    return;
  }
  if (kind === 'player') {
    onPlayerExperience(id, raw);
    return;
  }
  if (kind === 'page') {
    const page = reduceDisneySeriesPage(raw, id, Date.now());
    if (page) keepPage(page);
    return;
  }
  for (const page of [...pages.values()].reverse()) {
    const updated = applyDisneySeason(page, id, raw);
    if (updated) {
      keepPage(updated);
      return;
    }
  }
}

/** Fiche de vidéo reçue pour la requête `requestId` : réduite, gardée (remplace une fiche de la même vidéo) et poussée aux clients */
function onPlayerExperience(requestId: string, raw: unknown): void {
  const reduced = reduceDisneyPlayerExperience(raw, requestId, Date.now());
  if (!reduced) return;
  // Réponse de lecture déjà reçue (en attente) : repères joints dès maintenant
  const entry = withDisneyPlayback(reduced, playbacks);
  for (const [key, known] of entries) if (known.ids.some((id) => entry.ids.includes(id))) entries.delete(key);
  entries.set(requestId, entry);
  trim(entries, DISNEY_MAX_ENTRIES);
  push([entry], ports);
}

/** Réponse de lecture : réduite, gardée, puis jointe aux fiches de la même vidéo déjà vues (fiches repoussées) */
function onPlayback(raw: unknown): void {
  const playback = reduceDisneyPlayback(raw);
  if (!playback) return;
  playbacks.push(playback);
  if (playbacks.length > 10) playbacks.shift();
  for (const [key, known] of entries) {
    const entry = withDisneyPlayback(known, [playback]);
    if (entry === known) continue;
    entries.set(key, entry);
    push([entry], ports);
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

type Observed = { kind: DisneyRequestKind; id: string };

/** Requête lue par le pont (voir observedRequest), sinon null */
function observe(input: unknown): Observed | null {
  const url = urlOf(input);
  return url !== null ? observedRequest(url, location.href) : null;
}

/** XMLHttpRequest : `open` repère les requêtes lues (voir observedRequest), `send` attend leur réponse (lecture seule) */
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
          // XHR réutilisé (`abort` puis `open`) : cet écouteur ne s'est jamais déclenché, la réponse est celle du dernier `open`
          if (observed.get(this) !== request || this.status !== 200) return;
          if (this.responseType === '' || this.responseType === 'text') onPayload(request.kind, request.id, parseText(this.responseText));
          else if (this.responseType === 'json') onPayload(request.kind, request.id, this.response as unknown);
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
        .then((body) => onPayload(request.kind, request.id, parseText(body)))
        .catch(() => undefined);
    }
    return result;
  };
}

/** Demande d'ouverture : nouveau canal, port2 transféré au script isolé (même origine), puis fiches déjà vues */
function onHandshake(event: Event): void {
  if (!(event instanceof CustomEventType)) return;
  const handshake = decodeDisneyHandshake(event.detail);
  if (!handshake) return;
  const { port1, port2 } = new Channel();
  ports.push(port1);
  while (ports.length > MAX_PORTS) ports.shift()?.close();
  postToWindow(encodeDisneyPortOffer({ v: DISNEY_BRIDGE_VERSION, type: DISNEY_PORT_OFFER, nonce: handshake.nonce }), location.origin, [port2]);
  // Instantané : la requête de l'épisode précède en général l'ouverture du canal (file du port jusqu'à son démarrage)
  push([...entries.values()], [port1], [...pages.values()]);
}

// Garde par version (réenregistrement du script, bfcache, réinjection après une mise à jour : voir
// installDisneyBridgeOnce). Capture sur window : premier point de la propagation, avant tout écouteur de la page
installDisneyBridgeOnce(window, DISNEY_BRIDGE_VERSION, () => {
  observeXhr();
  observeFetch();
  window.addEventListener(DISNEY_HANDSHAKE_EVENT, onHandshake, true);
});
