// Script Disney+ du monde principal (MAIN), enregistré à `document_start` : observateur PASSIF des réponses
// `playerExperience` que le site demande lui-même (XMLHttpRequest ; fetch couvert par précaution). Il n'émet
// aucune requête, ne lit aucun en-tête ni jeton, ne touche à aucune URL de flux : seule la forme réduite
// (`reduceDisneyPlayerExperience`, identifiants compris) des 20 dernières fiches est gardée et transmise au script isolé.
// Aucun chrome.*. Format IIFE (suffixe .iife.ts) : un chargeur ESM ne fonctionne pas dans le monde MAIN.
//
// Le relevé ne voit que les requêtes émises APRÈS son installation : dans un onglet déjà ouvert à l'activation ou à
// une mise à jour (script exécuté après coup), l'épisode en cours n'est pas identifié ; la navigation suivante l'est.
//
// Canal privé (voir bridge-protocol.ts) : à chaque demande d'ouverture, un MessageChannel dont port1 reste dans cette
// fermeture ; les fiches ne partent que sur ces ports, jamais sur un événement que la page pourrait imiter.
// Le monde MAIN appartient à la page (JSON, XHR… redéfinissables) : le client isolé revalide toujours les fiches.
import {
  decodeDisneyHandshake,
  DISNEY_BRIDGE_VERSION,
  DISNEY_HANDSHAKE_EVENT,
  DISNEY_MAX_ENTRIES,
  DISNEY_PORT_OFFER,
  encodeDisneyPortOffer,
  encodeDisneyPush,
  installDisneyBridgeOnce,
  playerExperienceRequestId,
  reduceDisneyPlayerExperience,
  type DisneyPlayerExperience,
} from './bridge-protocol';

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
const ports: MessagePort[] = [];

function push(list: DisneyPlayerExperience[], targets: readonly MessagePort[]): void {
  if (list.length === 0) return;
  const message = encodeDisneyPush({ v: DISNEY_BRIDGE_VERSION, entries: list.slice(-DISNEY_MAX_ENTRIES) });
  for (const port of targets) port.postMessage(message);
}

/** Réponse reçue pour la requête `requestId` : réduite, gardée (remplace une fiche de la même vidéo) et poussée aux clients */
function onPayload(requestId: string, raw: unknown): void {
  const entry = reduceDisneyPlayerExperience(raw, requestId, Date.now());
  if (!entry) return;
  for (const [key, known] of entries) if (known.ids.some((id) => entry.ids.includes(id))) entries.delete(key);
  entries.set(requestId, entry);
  while (entries.size > DISNEY_MAX_ENTRIES) {
    const oldest = entries.keys().next();
    if (oldest.done) break;
    entries.delete(oldest.value);
  }
  push([entry], ports);
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

/** XMLHttpRequest : `open` repère les requêtes playerExperience, `send` attend leur réponse (lecture seule) */
function observeXhr(): void {
  const proto = XMLHttpRequest.prototype;
  const open = proto.open;
  const send = proto.send;
  const observed = new WeakMap<XMLHttpRequest, string>();

  // Arguments transmis tels quels (même nombre) : `open(m, u, undefined)` rendrait la requête synchrone
  proto.open = function patchedOpen(this: XMLHttpRequest, ...args: unknown[]): void {
    const url = urlOf(args[1]);
    const requestId = url !== null ? playerExperienceRequestId(url, location.href) : null;
    if (requestId) observed.set(this, requestId);
    else observed.delete(this);
    Reflect.apply(open, this, args);
  };

  proto.send = function patchedSend(this: XMLHttpRequest, ...args: unknown[]): void {
    const requestId = observed.get(this);
    if (requestId) {
      this.addEventListener(
        'load',
        () => {
          if (this.status !== 200) return;
          if (this.responseType === '' || this.responseType === 'text') onPayload(requestId, parseText(this.responseText));
          else if (this.responseType === 'json') onPayload(requestId, this.response as unknown);
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
    const url = urlOf(args[0]);
    const requestId = url !== null ? playerExperienceRequestId(url, location.href) : null;
    if (requestId) {
      result
        .then((response) => (response.ok ? response.clone().text() : ''))
        .then((body) => onPayload(requestId, parseText(body)))
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
  push([...entries.values()], [port1]);
}

// Garde par version (réenregistrement du script, bfcache, réinjection après une mise à jour : voir
// installDisneyBridgeOnce). Capture sur window : premier point de la propagation, avant tout écouteur de la page
installDisneyBridgeOnce(window, DISNEY_BRIDGE_VERSION, () => {
  observeXhr();
  observeFetch();
  window.addEventListener(DISNEY_HANDSHAKE_EVENT, onHandshake, true);
});
