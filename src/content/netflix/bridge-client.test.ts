import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createNetflixBridgeClient, type NetflixBridgeClientOptions } from './bridge-client';
import {
  decodeNetflixHandshake,
  decodeNetflixRequest,
  encodeNetflixPortOffer,
  encodeNetflixResponse,
  NETFLIX_ATTEMPT_TIMEOUT_MS,
  NETFLIX_FETCH_TIMEOUT_MS,
  NETFLIX_HANDSHAKE_EVENT,
  NETFLIX_PORT_OFFER,
  reduceNetflixMetadata,
  type NetflixBridgeRequest,
  type NetflixBridgeResponse,
  type NetflixShowMetadata,
} from './bridge-protocol';
import { mushokuEpisodeId, mushokuRawResponse } from './fixtures';

const reduced = reduceNetflixMetadata(mushokuRawResponse());
if (!reduced) throw new Error('fixture invalide');
const SHOW: NetflixShowMetadata = reduced;
/** Même série, titre falsifié : reconnaissable si une réponse forgée était acceptée */
const FORGED: NetflixShowMetadata = { ...SHOW, title: 'Forged' };
const ORIGIN = 'https://www.netflix.com';

type ResponseBody = Omit<Extract<NetflixBridgeResponse, { ok: true }>, 'v' | 'id'> | Omit<Extract<NetflixBridgeResponse, { ok: false }>, 'v' | 'id'>;
type Reply = (request: NetflixBridgeRequest) => ResponseBody | null;

/** Ports ouverts pendant le test (fermés ensuite : un MessagePort Node ouvert garde le worker actif) */
const channels: MessageChannel[] = [];
/** Événements déclenchés par un « script de la page » (dispatchEvent) : non « trusted » */
const forged = new WeakSet<Event>();

/** Faux onglet : `document` (demande d'ouverture), `window` (offre de port) et origine */
function fakePage(): Pick<NetflixBridgeClientOptions, 'target' | 'messages' | 'origin' | 'isTrusted'> & { document: EventTarget; window: EventTarget } {
  const document = new EventTarget();
  const window = new EventTarget();
  return { document, window, target: document, messages: window, origin: ORIGIN, isTrusted: (event) => !forged.has(event) };
}

/** Offre de port telle que postMessage la livre (asynchrone) ; `synthetic` : dispatchEvent d'un script de la page */
function offerPort(window: EventTarget, nonce: string, port: MessagePort, { synthetic = false, origin = ORIGIN } = {}): void {
  const event = new MessageEvent('message', { data: encodeNetflixPortOffer({ v: 1, type: NETFLIX_PORT_OFFER, nonce }), origin, ports: [port] });
  if (synthetic) {
    forged.add(event);
    window.dispatchEvent(event);
  } else {
    queueMicrotask(() => window.dispatchEvent(event));
  }
}

/** Canal dont le côté « pont » répond selon `reply` (null = pas de réponse), après `delayMs` si fourni */
function serve(reply: Reply, requests: NetflixBridgeRequest[], delayMs?: number): MessagePort {
  const channel = new MessageChannel();
  channels.push(channel);
  const { port1 } = channel;
  port1.addEventListener('message', (event) => {
    const request = decodeNetflixRequest(event.data);
    if (!request) return;
    requests.push(request);
    const body = reply(request);
    if (!body) return;
    const respond = delayMs === undefined ? queueMicrotask : (callback: () => void): void => void setTimeout(callback, delayMs);
    respond(() => {
      // Bruit : réponse d'une autre demande, puis message illisible
      port1.postMessage(encodeNetflixResponse({ v: 1, id: 'autre', ok: false, error: 'shape' }));
      port1.postMessage('{oops');
      port1.postMessage(encodeNetflixResponse({ v: 1, id: request.id, ...body }));
    });
  });
  port1.start();
  return channel.port2;
}

/** Pont MAIN simulé : premier écouteur de la demande d'ouverture, un canal par demande */
function installBridge(page: { document: EventTarget; window: EventTarget }, reply: Reply, delayMs?: number): { requests: NetflixBridgeRequest[] } {
  const requests: NetflixBridgeRequest[] = [];
  page.document.addEventListener(NETFLIX_HANDSHAKE_EVENT, (event) => {
    if (!(event instanceof CustomEvent)) return;
    const handshake = decodeNetflixHandshake(event.detail);
    if (handshake) offerPort(page.window, handshake.nonce, serve(reply, requests, delayMs));
  });
  return { requests };
}

function setup(reply: Reply, delayMs?: number): ReturnType<typeof fakePage> & { requests: NetflixBridgeRequest[] } {
  const page = fakePage();
  return { ...page, ...installBridge(page, reply, delayMs) };
}

let counter = 0;
const newId = (): string => `req-${++counter}`;
const signal = (): AbortSignal => new AbortController().signal;

// Fourni par Node (types Node absents du tsconfig du projet)
declare function setImmediate(callback: () => void): unknown;

/** Livraison réelle des messages des MessagePort Node (boucle d'événements, hors minuteurs simulés) */
async function flushPorts(): Promise<void> {
  for (let i = 0; i < 5; i++) await new Promise<void>((resolve) => setImmediate(resolve));
}

/** Avance le temps simulé par pas de 100 ms en laissant passer les messages des ports entre chaque pas */
async function advance(ms: number): Promise<void> {
  await flushPorts();
  for (let elapsed = 0; elapsed < ms; elapsed += 100) {
    await vi.advanceTimersByTimeAsync(Math.min(100, ms - elapsed));
    await flushPorts();
  }
}

beforeEach(() => {
  // setImmediate réel : flushPorts en dépend
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
});
afterEach(() => {
  vi.useRealTimers();
  for (const channel of channels.splice(0)) channel.port1.close();
});

describe('createNetflixBridgeClient', () => {
  it('charge les métadonnées puis sert la série depuis le cache (épisode suivant compris)', async () => {
    const { requests, ...page } = setup(() => ({ ok: true, data: SHOW }));
    const client = createNetflixBridgeClient({ ...page, newId });
    const episode = mushokuEpisodeId(1, 15);

    expect(client.peek(episode)).toBeNull();
    expect(await client.load(episode, signal())).toEqual(SHOW);
    expect(requests.map((r) => r.movieId)).toEqual([episode]);
    expect(client.peek(episode)).toEqual(SHOW);
    // Lecture automatique : épisode suivant de la même série, aucune nouvelle requête
    expect(await client.load(mushokuEpisodeId(2, 1), signal())).toEqual(SHOW);
    expect(requests).toHaveLength(1);
  });

  it('une seule requête en vol par vidéo, un seul canal pour toutes les demandes', async () => {
    const { requests, ...page } = setup(() => ({ ok: true, data: SHOW }));
    const handshakes = vi.fn();
    page.document.addEventListener(NETFLIX_HANDSHAKE_EVENT, handshakes);
    const client = createNetflixBridgeClient({ ...page, newId });
    const [a, b, c] = await Promise.all([
      client.load(mushokuEpisodeId(1, 1), signal()),
      client.load(mushokuEpisodeId(1, 1), signal()),
      client.load(mushokuEpisodeId(1, 2), signal()),
    ]);
    expect([a, b, c]).toEqual([SHOW, SHOW, SHOW]);
    expect(requests).toHaveLength(2);
    expect(handshakes).toHaveBeenCalledOnce();
  });

  it('le délai d’une tentative dépasse celui du fetch côté MAIN', () => {
    expect(NETFLIX_ATTEMPT_TIMEOUT_MS).toBeGreaterThan(NETFLIX_FETCH_TIMEOUT_MS);
  });

  it('réponse lente (6 s) mais valide : acceptée dès la première tentative', async () => {
    const { requests, ...page } = setup(() => ({ ok: true, data: SHOW }), 6_000);
    const client = createNetflixBridgeClient({ ...page, newId });
    const result = client.load('81402901', signal());
    await advance(6_000);
    expect(await result).toEqual(SHOW);
    expect(requests).toHaveLength(1);
  });

  it('pont muet : 2 nouvelles tentatives (12 s chacune), puis null', async () => {
    const { requests, ...page } = setup(() => null);
    const client = createNetflixBridgeClient({ ...page, newId });
    const result = client.load('81402901', signal());
    await advance(NETFLIX_ATTEMPT_TIMEOUT_MS - 1);
    expect(requests).toHaveLength(1);
    await advance(60_000);
    expect(await result).toBeNull();
    expect(requests).toHaveLength(3);
    expect(client.peek('81402901')).toBeNull();
  });

  it('pont pas encore prêt : nouvelle demande d’ouverture à la tentative suivante', async () => {
    const page = fakePage();
    const client = createNetflixBridgeClient({ ...page, newId });
    const result = client.load('81402901', signal());
    await advance(1_000);
    const { requests } = installBridge(page, () => ({ ok: true, data: SHOW }));
    await advance(NETFLIX_ATTEMPT_TIMEOUT_MS + 1_000);
    expect(await result).toEqual(SHOW);
    expect(requests).toHaveLength(1);
  });

  it('erreur passagère puis succès : la nouvelle tentative aboutit', async () => {
    let calls = 0;
    const { requests, ...page } = setup(() => (++calls === 1 ? { ok: false, error: 'http', status: 503 } : { ok: true, data: SHOW }));
    const client = createNetflixBridgeClient({ ...page, newId });
    const result = client.load('81402901', signal());
    await advance(2_000);
    expect(await result).toEqual(SHOW);
    expect(requests).toHaveLength(2);
  });

  it('erreur définitive (404, forme inattendue) : pas de nouvelle tentative', async () => {
    for (const body of [{ ok: false, error: 'http', status: 404 }, { ok: false, error: 'shape' }] as const) {
      const { requests, ...page } = setup(() => body);
      const client = createNetflixBridgeClient({ ...page, newId });
      const result = client.load('81402901', signal());
      await advance(20_000);
      expect(await result).toBeNull();
      expect(requests).toHaveLength(1);
    }
  });

  it('réponse décrivant une autre série : rejetée, sans nouvelle tentative ni mise en cache', async () => {
    const { requests, ...page } = setup(() => ({ ok: true, data: SHOW }));
    const client = createNetflixBridgeClient({ ...page, newId });
    const result = client.load('99999999', signal());
    await advance(20_000);
    expect(await result).toBeNull();
    expect(requests).toHaveLength(1);
    expect(client.peek(mushokuEpisodeId(1, 1))).toBeNull();
  });

  it('annulation : null immédiat pour l’appelant, la requête partagée continue pour les autres', async () => {
    const { requests, ...page } = setup(() => ({ ok: true, data: SHOW }));
    const client = createNetflixBridgeClient({ ...page, newId });
    const controller = new AbortController();
    const aborted = client.load('81402901', controller.signal);
    const other = client.load('81402901', signal());
    controller.abort();
    expect(await aborted).toBeNull();
    expect(await other).toEqual(SHOW);
    expect(requests).toHaveLength(1);
    // Signal déjà annulé : aucune requête
    const done = new AbortController();
    done.abort();
    expect(await client.load('99', done.signal)).toBeNull();
  });

  it('identifiant invalide : aucune requête', async () => {
    const { requests, ...page } = setup(() => ({ ok: true, data: SHOW }));
    const client = createNetflixBridgeClient({ ...page, newId });
    expect(await client.load('../evil', signal())).toBeNull();
    expect(requests).toHaveLength(0);
  });

  it('cache LRU limité à 5 séries', async () => {
    const movies = Array.from({ length: 6 }, (_, i): NetflixShowMetadata => ({ ...SHOW, type: 'movie', showId: String(i), seasons: [] }));
    const { requests, ...page } = setup((request) => ({ ok: true, data: movies[Number(request.movieId)] }));
    const client = createNetflixBridgeClient({ ...page, newId });
    for (const index of [0, 1, 2, 3, 4]) await client.load(String(index), signal());
    // 0 relu (récent), puis 5 chargé : 1, le plus ancien, est évincé
    expect(client.peek('0')).not.toBeNull();
    await client.load('5', signal());
    expect(client.peek('1')).toBeNull();
    expect(client.peek('0')).not.toBeNull();
    expect(client.peek('5')).not.toBeNull();
    expect(requests).toHaveLength(6);
  });
});

describe('createNetflixBridgeClient — canal privé face à un script de la page', () => {
  it('réponse forgée sur un événement du document ou injectée sur le port : ignorée', async () => {
    const { requests, ...page } = setup(() => ({ ok: true, data: SHOW }), 6_000);
    // La page voit l'offre de port (écouteur `message` sur window) et l'ancien événement de réponse
    const snooped: { port: MessagePort | null } = { port: null };
    page.window.addEventListener('message', (event) => {
      if (event instanceof MessageEvent) snooped.port = event.ports[0] ?? null;
    });
    const client = createNetflixBridgeClient({ ...page, newId });
    const result = client.load('81402901', signal());
    await advance(0);
    const [request] = requests;
    expect(request).toBeDefined();
    const forgedBody = encodeNetflixResponse({ v: 1, id: request.id, ok: true, data: FORGED });
    page.document.dispatchEvent(new CustomEvent('synckai:netflix:response', { detail: forgedBody }));
    expect(snooped.port).not.toBeNull();
    const injected = new MessageEvent('message', { data: forgedBody });
    forged.add(injected);
    snooped.port?.dispatchEvent(injected);

    await advance(6_000);
    expect(await result).toEqual(SHOW);
  });

  it('deuxième port offert pour le même nonce (après celui du pont) : ignoré', async () => {
    const { requests, ...page } = setup(() => ({ ok: true, data: SHOW }), 6_000);
    // Script de la page : écouteur posé après le pont, offre un port qui répond aussitôt avec des données forgées
    const pageRequests: NetflixBridgeRequest[] = [];
    page.document.addEventListener(NETFLIX_HANDSHAKE_EVENT, (event) => {
      const handshake = event instanceof CustomEvent ? decodeNetflixHandshake(event.detail) : null;
      if (handshake) offerPort(page.window, handshake.nonce, serve(() => ({ ok: true, data: FORGED }), pageRequests));
    });
    const client = createNetflixBridgeClient({ ...page, newId });
    const result = client.load('81402901', signal());
    await advance(6_000);
    expect(await result).toEqual(SHOW);
    expect(requests).toHaveLength(1);
    expect(pageRequests).toHaveLength(0);
  });

  it('offre synthétique (dispatchEvent, avant le vrai postMessage du pont) ou d’une autre origine : refusée', async () => {
    const { requests, ...page } = setup(() => ({ ok: true, data: SHOW }));
    const pageRequests: NetflixBridgeRequest[] = [];
    page.document.addEventListener(NETFLIX_HANDSHAKE_EVENT, (event) => {
      const handshake = event instanceof CustomEvent ? decodeNetflixHandshake(event.detail) : null;
      if (!handshake) return;
      offerPort(page.window, handshake.nonce, serve(() => ({ ok: true, data: FORGED }), pageRequests), { synthetic: true });
      offerPort(page.window, handshake.nonce, serve(() => ({ ok: true, data: FORGED }), pageRequests), { origin: 'https://evil.example' });
    });
    const client = createNetflixBridgeClient({ ...page, newId });
    expect(await client.load('81402901', signal())).toEqual(SHOW);
    expect(requests).toHaveLength(1);
    expect(pageRequests).toHaveLength(0);
  });

  it('par défaut, seuls les événements « trusted » sont acceptés', async () => {
    const { requests, ...page } = setup(() => ({ ok: true, data: SHOW }));
    // Sans `isTrusted` injecté : les événements de test (Node) ne sont jamais « trusted »
    const client = createNetflixBridgeClient({ target: page.target, messages: page.messages, origin: page.origin, newId });
    const result = client.load('81402901', signal());
    await advance(60_000);
    expect(await result).toBeNull();
    expect(requests).toHaveLength(0);
  });
});
