// Kit des ponts du monde MAIN (Template Method) : le canal privé vers le script isolé et, pour les ponts passifs
// (Crunchyroll, Disney+, Prime Video), le relevé des réponses fetch / XMLHttpRequest que le site demande lui-même. Un pont
// ne fournit que ses règles : requêtes lues (`observe`), réduction et message (`onPayload`), instantané (`snapshot`).
// Inclus dans chaque IIFE de pont (aucun chargeur) ; seul module de content/ permis aux ponts hors de leur dossier.
//
// Ce que le kit ne fait jamais : appeler chrome.*, lire un en-tête (requête ou réponse : les requêtes du site portent le
// jeton de l'utilisateur), un cookie ou un stockage de la page, émettre une requête (pont passif), toucher à la réponse
// que reçoit le site (seule une copie est lue). Vérifié sur les ponts construits par scripts/verify-build.ts.
//
// Ce que le kit ne garantit PAS : le monde MAIN appartient à la page. Tout ce qui en sort est une donnée écrite par la
// page (SEC-05) : le client isolé revalide tout, et une donnée du pont seule ne prouve jamais une correspondance. Les
// références (MessageChannel, CustomEvent, postMessage, JSON, Object.setPrototypeOf) sont prises à l'évaluation du
// kit, au début du script du pont : elles ne protègent que d'une redéfinition POSTÉRIEURE, pas d'un script de la page
// déjà exécuté (pont réinjecté après le chargement), et `Map`, `Array.prototype`, `MessagePort.prototype` restent ceux
// de la page. Le JSON lu est reconstruit sans prototype hérité : une pollution de `Object.prototype` par la page ne
// fournit aucune valeur aux réductions (seules les propriétés propres de la réponse sont lues).
import { installOnce, parseJsonBounded } from '../../shared/guards';

/** Clients isolés connectés au plus (réinjections successives) : le plus ancien port est fermé au-delà */
export const MAX_BRIDGE_PORTS = 4;

// Références prises à l'évaluation du kit (début du script du pont, `document_start` pour les scripts déclarés)
const Channel = MessageChannel;
const CustomEventType = CustomEvent;
const MessageEventType = MessageEvent;
const parse = JSON.parse;
const stringify = JSON.stringify;
const setPrototype = Object.setPrototypeOf;
const isArray = Array.isArray;
const Decoder = TextDecoder;

export interface BridgeChannelSpec {
  /** Garde par version (Symbol.for(…v{N}) : voir installOnce) */
  flag: symbol;
  /** Demande d'ouverture du client isolé (CustomEvent sur `document`, écouté en capture sur `window`) */
  handshakeEvent: string;
  /** Nonce d'une demande d'ouverture de CETTE version, null sinon (un pont d'une autre version y répond seul) */
  decodeHandshake(detail: unknown): string | null;
  /** Offre de port pour ce nonce (`window.postMessage`, même origine) */
  encodeOffer(nonce: string): string;
}

/** Pont actif (Netflix) : le client envoie des demandes sur le port privé, le pont y répond */
export interface ActiveBridgeSpec extends BridgeChannelSpec {
  onRequest(port: MessagePort, data: unknown): void;
}

/** Pont passif : relevé des réponses du site, réduites puis poussées aux clients */
export interface PassiveBridgeSpec<R> extends BridgeChannelSpec {
  /** Emplacement de l'observateur, SANS version : les enveloppes fetch / XHR ne sont posées qu'une fois (voir installObserver) */
  observerKey: symbol;
  /** URL d'une requête du site (relative à `base`, l'adresse de la page) → requête lue ; null : jamais lue */
  observe(url: string, base: string): R | null;
  /** Réponse 200 d'une requête lue (JSON sans prototype hérité, null si illisible ou trop longue) → message pour tous les clients, null : rien */
  onPayload(request: R, raw: unknown): string | null;
  /** Message pour un client qui vient de se connecter (ce qui a déjà été vu), null : rien */
  snapshot(): string | null;
  /** Réponse au-delà de laquelle rien n'est lu (caractères ; octets pour fetch, lu en flux) */
  maxResponseLength: number;
}

// ─── JSON de la page ──────────────────────────────────────────────────────

/** Reviver : chaque objet perd son prototype (aucune propriété héritée lue, SEC-05) ; tableaux et valeurs inchangés */
function ownOnly(_key: string, value: unknown): unknown {
  if (typeof value === 'object' && value !== null && !isArray(value)) setPrototype(value, null);
  return value;
}

/**
 * Corps d'une réponse (texte, ou valeur déjà lue par le navigateur pour un XHR `json`) → JSON sans prototype hérité ;
 * null si illisible ou au-delà de `maxLength` caractères. Une valeur du site est copiée (JSON), jamais modifiée.
 */
export function parsePageJson(body: unknown, maxLength: number): unknown {
  let text: unknown = body;
  if (typeof body === 'object' && body !== null) {
    try {
      text = stringify(body);
    } catch {
      return null;
    }
  }
  return parseJsonBounded(text, maxLength, (value) => parse(value, ownOnly) as unknown);
}

// ─── Canal privé ──────────────────────────────────────────────────────────

/**
 * Écoute les demandes d'ouverture : à chacune, un MessageChannel dont port1 reste ici (au plus MAX_BRIDGE_PORTS, le
 * plus ancien fermé) et port2 est offert par `window.postMessage(offre, origine de la page, [port2])`. Garantie réelle :
 * l'ORDRE (écouteur en capture posé à `document_start`, avant tout script de la page, donc offre postée la première) ;
 * le nonce de la demande est lisible par la page, `isTrusted` ne la distingue pas d'un vrai postMessage. Pont réinjecté
 * après le chargement (mise à jour, accès accordé) : un écouteur de la page posé avant pourrait offrir un port en premier.
 * Retourne la diffusion d'un message à tous les ports ouverts.
 */
function listenForClients(spec: BridgeChannelSpec, onPort: (port: MessagePort) => void): (message: string) => void {
  const postToWindow = window.postMessage.bind(window);
  const origin = location.origin;
  const ports: MessagePort[] = [];
  const onHandshake = (event: Event): void => {
    if (!(event instanceof CustomEventType)) return;
    const nonce = spec.decodeHandshake(event.detail);
    if (nonce === null) return;
    const { port1, port2 } = new Channel();
    ports.push(port1);
    while (ports.length > MAX_BRIDGE_PORTS) ports.shift()?.close();
    postToWindow(spec.encodeOffer(nonce), origin, [port2]);
    onPort(port1);
  };
  // Capture sur window : premier point de la propagation, avant tout écouteur posé ensuite par la page
  window.addEventListener(spec.handshakeEvent, onHandshake, true);
  return (message) => {
    for (const port of ports) port.postMessage(message);
  };
}

/** Pont actif (Netflix) : canal privé seul, demandes du client relayées à `onRequest`. Retourne true si installé (garde par version) */
export function installActiveBridge(spec: ActiveBridgeSpec): boolean {
  return installOnce(window, spec.flag, () => {
    listenForClients(spec, (port) => {
      port.addEventListener('message', (event) => {
        if (event instanceof MessageEventType) spec.onRequest(port, event.data);
      });
      port.start(); // Obligatoire avec addEventListener
    });
  });
}

// ─── Relevé des réponses (ponts passifs) ──────────────────────────────────

/** Lecture d'une réponse observée : corps texte (fetch, XHR texte) ou valeur (XHR `json`), au plus `maxLength` */
interface BodyReader {
  /** Corps au-delà duquel rien n'est lu (caractères ; octets pour fetch, dont le corps est lu en flux) */
  maxLength: number;
  read(body: unknown): void;
}

/**
 * Observateur courant d'une plateforme, remplacé par chaque nouvelle version du pont. FORME FIGÉE (contrat entre
 * versions) : les enveloppes fetch / XHR posées par la première version qui l'a installé la lisent pour toutes les
 * suivantes. La changer impose une nouvelle `observerKey` (les enveloppes s'empileraient une fois de plus).
 */
interface ResponseObserver {
  /** URL d'une requête du site → lecture de sa réponse, null si elle n'est jamais lue */
  match(url: string): BodyReader | null;
}

interface ObserverSlot {
  current: ResponseObserver;
}

const isObserverSlot = (value: unknown): value is ObserverSlot =>
  typeof value === 'object' && value !== null && typeof Reflect.get(value, 'current') === 'object';

/** URL passée à `open` / `fetch` (chaîne, URL ou Request, toujours définie dans une page) → texte, sinon null */
function urlOf(input: unknown): string | null {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.href;
  return input instanceof Request ? input.url : null;
}

/** XMLHttpRequest : `open` repère les requêtes lues, `send` attend leur réponse (lecture seule, aucun en-tête) */
function wrapXhr(slot: ObserverSlot): void {
  const proto = XMLHttpRequest.prototype;
  const open = proto.open;
  const send = proto.send;
  const readers = new WeakMap<XMLHttpRequest, BodyReader>();

  // Arguments transmis tels quels (même nombre) : `open(m, u, undefined)` rendrait la requête synchrone
  proto.open = function patchedOpen(this: XMLHttpRequest, ...args: unknown[]): void {
    const url = urlOf(args[1]);
    const read = url !== null ? slot.current.match(url) : null;
    if (read) readers.set(this, read);
    else readers.delete(this);
    Reflect.apply(open, this, args);
  };

  proto.send = function patchedSend(this: XMLHttpRequest, ...args: unknown[]): void {
    const read = readers.get(this);
    if (read) {
      this.addEventListener(
        'load',
        () => {
          // XHR réutilisé (`abort` puis `open`) : cet écouteur ne s'est jamais déclenché, la réponse est celle du dernier `open`
          if (readers.get(this) !== read || this.status !== 200) return;
          try {
            if (this.responseType === '' || this.responseType === 'text') read.read(this.responseText);
            else if (this.responseType === 'json') read.read(this.response);
          } catch {
            // Une réduction en échec n'atteint jamais l'application du site
          }
        },
        { once: true },
      );
    }
    Reflect.apply(send, this, args);
  };
}

/**
 * Corps lu en flux, abandonné dès qu'il dépasse `maxBytes` (2-R13 : une réponse énorme n'est jamais gardée en entier) ;
 * null au-delà ou sans corps. Seule la copie est lue : la réponse du site reste intacte.
 */
async function readBounded(response: Response, maxBytes: number): Promise<string | null> {
  const reader = response.body?.getReader();
  if (!reader) return null;
  const decoder = new Decoder();
  let text = '';
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) return text + decoder.decode();
    size += value.byteLength;
    if (size > maxBytes) {
      reader.cancel().catch(() => undefined);
      return null;
    }
    // Flux : un caractère coupé entre deux morceaux est complété au suivant
    text += decoder.decode(value, { stream: true });
  }
}

/** fetch : même relevé sur une copie de la réponse (le site reçoit l'originale, intacte) */
function wrapFetch(slot: ObserverSlot): void {
  const originalFetch = window.fetch;
  window.fetch = function patchedFetch(this: unknown, ...args: Parameters<typeof fetch>): Promise<Response> {
    const result = originalFetch.apply(this, args);
    const url = urlOf(args[0]);
    const read = url !== null ? slot.current.match(url) : null;
    if (read) {
      // Réponse 200 trop longue ou sans corps : lue comme illisible (null), comme un XHR
      result
        .then(async (response) => {
          if (response.ok) read.read(await readBounded(response.clone(), read.maxLength));
        })
        .catch(() => undefined);
    }
    return result;
  };
}

/**
 * Pose l'observateur de la plateforme (2-R3) : la première fois, enveloppe fetch et XHR une seule fois sous `key` (sans
 * version) ; ensuite (nouvelle version réinjectée après une mise à jour, sans rechargement de la page), remplace
 * seulement l'observateur courant. Les enveloppes ne s'empilent plus et l'ancienne version ne reçoit plus rien.
 * Effectif à partir de la première version qui l'a posé (les enveloppes des versions précédentes restent).
 */
function installObserver(key: symbol, observer: ResponseObserver): void {
  const existing: unknown = Reflect.get(window, key);
  if (isObserverSlot(existing)) {
    existing.current = observer;
    return;
  }
  const slot: ObserverSlot = { current: observer };
  Reflect.defineProperty(window, key, { value: slot });
  wrapXhr(slot);
  wrapFetch(slot);
}

/** Pont passif : relevé des réponses lues et canal privé. Retourne true si installé (garde par version) */
export function installPassiveBridge<R>(spec: PassiveBridgeSpec<R>): boolean {
  return installOnce(window, spec.flag, () => {
    const broadcast = listenForClients(spec, (port) => {
      // Instantané : file du port jusqu'à son démarrage par le client
      const message = spec.snapshot();
      if (message !== null) port.postMessage(message);
    });
    installObserver(spec.observerKey, {
      match(url) {
        const request = spec.observe(url, location.href);
        if (request === null) return null;
        return {
          maxLength: spec.maxResponseLength,
          read(body) {
            const message = spec.onPayload(request, parsePageJson(body, spec.maxResponseLength));
            if (message !== null) broadcast(message);
          },
        };
      },
    });
  });
}
