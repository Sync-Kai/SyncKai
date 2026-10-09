// Script Netflix du monde principal (MAIN) : seul endroit où la session Netflix est utilisable.
// Il répond aux demandes du script de contenu isolé en interrogeant l'API de métadonnées de Netflix
// (même origine, cookies de la session) et ne renvoie que la forme réduite (`reduceNetflixMetadata`).
// Aucun chrome.*, aucune donnée de compte (authURL…) lue ni transmise. Format IIFE (suffixe .iife.ts) :
// un chargeur ESM `import(chrome.runtime.getURL(…))` ne fonctionne pas dans le monde MAIN.
//
// Canal privé (voir bridge-protocol.ts) : à chaque demande d'ouverture, un MessageChannel dont port1 reste dans
// cette fermeture ; les réponses ne partent que sur port1, jamais sur un événement que la page pourrait imiter.
// Ordre garanti au chargement (`document_start`) : cet écouteur en capture sur `window` est posé avant tout
// script de la page, il passe donc avant tout écouteur de la page et son offre de port est postée en premier.
// Onglet déjà ouvert à l'activation (exécuté par executeScript après la page) : un script de la page qui
// écouterait déjà cet événement pourrait poster une offre avant la nôtre ; garantie plus faible, limitée aux
// onglets ouverts au moment de l'activation (le prochain chargement rétablit l'ordre).
// Le monde MAIN appartient à la page (fetch, JSON… redéfinissables) : le client isolé revalide toujours la réponse.
import {
  decodeNetflixHandshake,
  decodeNetflixRequest,
  encodeNetflixPortOffer,
  encodeNetflixResponse,
  NETFLIX_BRIDGE_VERSION,
  NETFLIX_FETCH_TIMEOUT_MS,
  NETFLIX_HANDSHAKE_EVENT,
  NETFLIX_PORT_OFFER,
  reduceNetflixMetadata,
  type NetflixBridgeResponse,
} from './bridge-protocol';

const METADATA_URL = '/nq/website/memberapi/release/metadata';
/** Garde contre une double injection (réenregistrement du script, navigation bfcache) */
const INSTALLED_FLAG = Symbol.for('synckai.netflix.bridge');

// Références prises à l'installation : une redéfinition ultérieure par la page ne détourne pas le canal
const Channel = MessageChannel;
const CustomEventType = CustomEvent;
const MessageEventType = MessageEvent;
const postToWindow = window.postMessage.bind(window);

type ResponseBody = Omit<Extract<NetflixBridgeResponse, { ok: true }>, 'v' | 'id'> | Omit<Extract<NetflixBridgeResponse, { ok: false }>, 'v' | 'id'>;

async function fetchMetadata(movieId: string): Promise<ResponseBody> {
  // Titres en anglais (en-US) quelle que soit la langue du profil : meilleure correspondance AniList
  const query = new URLSearchParams({ movieid: movieId, languages: 'en-US' });
  let response: Response;
  try {
    response = await fetch(`${METADATA_URL}?${query.toString()}`, { credentials: 'include', signal: AbortSignal.timeout(NETFLIX_FETCH_TIMEOUT_MS) });
  } catch {
    return { ok: false, error: 'network' };
  }
  if (!response.ok) return { ok: false, error: 'http', status: response.status };
  let raw: unknown;
  try {
    raw = await response.json();
  } catch {
    return { ok: false, error: 'shape' };
  }
  const data = reduceNetflixMetadata(raw);
  return data ? { ok: true, data } : { ok: false, error: 'shape' };
}

/** Demande reçue sur le port privé : réponse sur ce même port */
function onRequest(port: MessagePort, event: Event): void {
  if (!(event instanceof MessageEventType)) return;
  const request = decodeNetflixRequest(event.data);
  if (!request) return;
  void fetchMetadata(request.movieId).then((body) => {
    const response: NetflixBridgeResponse = { v: NETFLIX_BRIDGE_VERSION, id: request.id, ...body };
    port.postMessage(encodeNetflixResponse(response));
  });
}

/** Demande d'ouverture : nouveau canal, port2 transféré au script isolé (même origine uniquement) */
function onHandshake(event: Event): void {
  if (!(event instanceof CustomEventType)) return;
  const handshake = decodeNetflixHandshake(event.detail);
  if (!handshake) return;
  const { port1, port2 } = new Channel();
  port1.addEventListener('message', (message) => onRequest(port1, message));
  port1.start();
  postToWindow(encodeNetflixPortOffer({ v: NETFLIX_BRIDGE_VERSION, type: NETFLIX_PORT_OFFER, nonce: handshake.nonce }), location.origin, [port2]);
}

if (!Reflect.get(window, INSTALLED_FLAG)) {
  Reflect.defineProperty(window, INSTALLED_FLAG, { value: true });
  // Capture sur window : premier point de la propagation, avant tout écouteur posé ensuite par la page
  window.addEventListener(NETFLIX_HANDSHAKE_EVENT, onHandshake, true);
}
