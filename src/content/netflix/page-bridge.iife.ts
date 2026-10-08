// Script Netflix du monde principal (MAIN) : seul endroit où la session Netflix est utilisable.
// Il répond aux demandes du script de contenu isolé en interrogeant l'API de métadonnées de Netflix
// (même origine, cookies de la session) et ne renvoie que la forme réduite (`reduceNetflixMetadata`).
// Aucun chrome.*, aucune donnée de compte (authURL…) lue ni transmise. Format IIFE (suffixe .iife.ts) :
// un chargeur ESM `import(chrome.runtime.getURL(…))` ne fonctionne pas dans le monde MAIN.
import {
  decodeNetflixRequest,
  encodeNetflixResponse,
  NETFLIX_BRIDGE_VERSION,
  NETFLIX_REQUEST_EVENT,
  NETFLIX_RESPONSE_EVENT,
  reduceNetflixMetadata,
  type NetflixBridgeResponse,
} from './bridge-protocol';

const METADATA_URL = '/nq/website/memberapi/release/metadata';
const FETCH_TIMEOUT_MS = 10_000;
/** Garde contre une double injection (réenregistrement du script, navigation bfcache) */
const INSTALLED_FLAG = Symbol.for('synckai.netflix.bridge');

type ResponseBody = Omit<Extract<NetflixBridgeResponse, { ok: true }>, 'v' | 'id'> | Omit<Extract<NetflixBridgeResponse, { ok: false }>, 'v' | 'id'>;

async function fetchMetadata(movieId: string): Promise<ResponseBody> {
  // Titres en anglais (en-US) quelle que soit la langue du profil : meilleure correspondance AniList
  const query = new URLSearchParams({ movieid: movieId, languages: 'en-US' });
  let response: Response;
  try {
    response = await fetch(`${METADATA_URL}?${query.toString()}`, { credentials: 'include', signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
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

function onRequest(event: Event): void {
  if (!(event instanceof CustomEvent)) return;
  const request = decodeNetflixRequest(event.detail);
  if (!request) return;
  void fetchMetadata(request.movieId).then((body) => {
    const response: NetflixBridgeResponse = { v: NETFLIX_BRIDGE_VERSION, id: request.id, ...body };
    document.dispatchEvent(new CustomEvent(NETFLIX_RESPONSE_EVENT, { detail: encodeNetflixResponse(response) }));
  });
}

if (!Reflect.get(window, INSTALLED_FLAG)) {
  Reflect.defineProperty(window, INSTALLED_FLAG, { value: true });
  document.addEventListener(NETFLIX_REQUEST_EVENT, onRequest);
}
