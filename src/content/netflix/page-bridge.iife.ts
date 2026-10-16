// Script Netflix du monde principal (MAIN) : seul endroit où la session Netflix est utilisable.
// Il répond aux demandes du script de contenu isolé en interrogeant l'API de métadonnées de Netflix
// (même origine, cookies de la session) et ne renvoie que la forme réduite (`reduceNetflixMetadata`).
// Aucun chrome.*, aucune donnée de compte (authURL…) lue ni transmise. Points de lecture du profil (`bookmark`)
// seulement pour une demande `bookmarks` de l'import de l'historique (Réglages › Importer un historique › Netflix).
// Format IIFE (suffixe .iife.ts) : un chargeur ESM `import(chrome.runtime.getURL(…))` ne fonctionne pas dans le monde MAIN.
//
// Canal privé (content/bridge/kit.ts › installActiveBridge) : à chaque demande d'ouverture, un MessageChannel dont port1
// reste dans cette fermeture (4 au plus) ; les réponses ne partent que sur port1. Ordre garanti au chargement
// (`document_start`) : l'écouteur en capture sur `window` est posé avant tout script de la page, son offre de port est
// postée en premier. Onglet déjà ouvert à l'activation ou à une mise à jour (exécuté par executeScript après la page) :
// un script de la page qui écouterait déjà cet événement pourrait poster une offre avant la nôtre ; garantie plus
// faible, limitée à ces onglets (le prochain chargement rétablit l'ordre). Un pont de même version déjà présent (resté
// dans la page après une mise à jour) sert le nouveau client tel quel.
// Le monde MAIN appartient à la page (fetch, JSON… redéfinissables) : la réponse est une donnée que la page aurait pu
// écrire, revalidée par le client isolé ; le JSON est relu sans prototype hérité (voir le kit).
import { installActiveBridge, parsePageJson } from '../bridge/kit';
import {
  decodeNetflixHandshake,
  decodeNetflixRequest,
  encodeNetflixPortOffer,
  encodeNetflixResponse,
  NETFLIX_BRIDGE_VERSION,
  NETFLIX_FETCH_TIMEOUT_MS,
  NETFLIX_HANDSHAKE_EVENT,
  NETFLIX_PORT_OFFER,
  netflixBridgeFlag,
  reduceNetflixMetadata,
  type NetflixBridgeResponse,
} from './bridge-protocol';

const METADATA_URL = '/nq/website/memberapi/release/metadata';
/** Réponse au-delà de laquelle rien n'est lu (caractères ; une longue série comme One Piece fait quelques Mo) */
const MAX_METADATA_LENGTH = 16_000_000;

type ResponseBody = Omit<Extract<NetflixBridgeResponse, { ok: true }>, 'v' | 'id'> | Omit<Extract<NetflixBridgeResponse, { ok: false }>, 'v' | 'id'>;

async function fetchMetadata(movieId: string, bookmarks: boolean): Promise<ResponseBody> {
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
    raw = parsePageJson(await response.text(), MAX_METADATA_LENGTH);
  } catch {
    return { ok: false, error: 'shape' };
  }
  // Points de lecture joints seulement à la demande de l'import de l'historique (jamais en synchro en direct)
  const data = reduceNetflixMetadata(raw, bookmarks);
  return data ? { ok: true, data } : { ok: false, error: 'shape' };
}

/** Demande reçue sur le port privé : réponse sur ce même port */
function onRequest(port: MessagePort, data: unknown): void {
  const request = decodeNetflixRequest(data);
  if (!request) return;
  void fetchMetadata(request.movieId, request.bookmarks === true).then((body) => {
    const response: NetflixBridgeResponse = { v: NETFLIX_BRIDGE_VERSION, id: request.id, ...body };
    port.postMessage(encodeNetflixResponse(response));
  });
}

// Garde par version (réenregistrement du script, bfcache, réinjection après une mise à jour : voir netflixBridgeFlag)
installActiveBridge({
  flag: netflixBridgeFlag(NETFLIX_BRIDGE_VERSION),
  handshakeEvent: NETFLIX_HANDSHAKE_EVENT,
  decodeHandshake: (detail) => decodeNetflixHandshake(detail)?.nonce ?? null,
  encodeOffer: (nonce) => encodeNetflixPortOffer({ v: NETFLIX_BRIDGE_VERSION, type: NETFLIX_PORT_OFFER, nonce }),
  onRequest,
});
