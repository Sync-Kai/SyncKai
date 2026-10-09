import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createNetflixBridgeClient } from './bridge-client';
import {
  decodeNetflixRequest,
  encodeNetflixResponse,
  NETFLIX_ATTEMPT_TIMEOUT_MS,
  NETFLIX_FETCH_TIMEOUT_MS,
  NETFLIX_REQUEST_EVENT,
  NETFLIX_RESPONSE_EVENT,
  reduceNetflixMetadata,
  type NetflixBridgeRequest,
  type NetflixBridgeResponse,
  type NetflixShowMetadata,
} from './bridge-protocol';
import { mushokuEpisodeId, mushokuRawResponse } from './fixtures';

const reduced = reduceNetflixMetadata(mushokuRawResponse());
if (!reduced) throw new Error('fixture invalide');
const SHOW: NetflixShowMetadata = reduced;

type Reply = (request: NetflixBridgeRequest) => Omit<Extract<NetflixBridgeResponse, { ok: true }>, 'v' | 'id'> | Omit<Extract<NetflixBridgeResponse, { ok: false }>, 'v' | 'id'> | null;

/**
 * Faux document : un script « MAIN » simulé répond (de façon asynchrone, après `delayMs` si fourni) selon
 * `reply` ; null = pas de réponse
 */
function fakeDocument(reply: Reply, delayMs?: number): { target: EventTarget; requests: NetflixBridgeRequest[] } {
  const target = new EventTarget();
  const requests: NetflixBridgeRequest[] = [];
  target.addEventListener(NETFLIX_REQUEST_EVENT, (event) => {
    if (!(event instanceof CustomEvent)) return;
    const request = decodeNetflixRequest(event.detail);
    if (!request) return;
    requests.push(request);
    const body = reply(request);
    if (!body) return;
    const respond = delayMs === undefined ? queueMicrotask : (callback: () => void): void => void setTimeout(callback, delayMs);
    respond(() => {
      // Bruit : réponse d'une autre demande, puis détail illisible
      target.dispatchEvent(new CustomEvent(NETFLIX_RESPONSE_EVENT, { detail: encodeNetflixResponse({ v: 1, id: 'autre', ok: false, error: 'shape' }) }));
      target.dispatchEvent(new CustomEvent(NETFLIX_RESPONSE_EVENT, { detail: '{oops' }));
      target.dispatchEvent(new CustomEvent(NETFLIX_RESPONSE_EVENT, { detail: encodeNetflixResponse({ v: 1, id: request.id, ...body }) }));
    });
  });
  return { target, requests };
}

let counter = 0;
const newId = (): string => `req-${++counter}`;
const signal = (): AbortSignal => new AbortController().signal;

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe('createNetflixBridgeClient', () => {
  it('charge les métadonnées puis sert la série depuis le cache (épisode suivant compris)', async () => {
    const { target, requests } = fakeDocument(() => ({ ok: true, data: SHOW }));
    const client = createNetflixBridgeClient({ target, newId });
    const episode = mushokuEpisodeId(1, 15);

    expect(client.peek(episode)).toBeNull();
    expect(await client.load(episode, signal())).toEqual(SHOW);
    expect(requests.map((r) => r.movieId)).toEqual([episode]);
    expect(client.peek(episode)).toEqual(SHOW);
    // Lecture automatique : épisode suivant de la même série, aucune nouvelle requête
    expect(await client.load(mushokuEpisodeId(2, 1), signal())).toEqual(SHOW);
    expect(requests).toHaveLength(1);
  });

  it('une seule requête en vol par vidéo', async () => {
    const { target, requests } = fakeDocument(() => ({ ok: true, data: SHOW }));
    const client = createNetflixBridgeClient({ target, newId });
    const id = mushokuEpisodeId(1, 1);
    const [a, b] = await Promise.all([client.load(id, signal()), client.load(id, signal())]);
    expect(a).toEqual(SHOW);
    expect(b).toEqual(SHOW);
    expect(requests).toHaveLength(1);
  });

  it('le délai d’une tentative dépasse celui du fetch côté MAIN', () => {
    expect(NETFLIX_ATTEMPT_TIMEOUT_MS).toBeGreaterThan(NETFLIX_FETCH_TIMEOUT_MS);
  });

  it('réponse lente (6 s) mais valide : acceptée dès la première tentative', async () => {
    const { target, requests } = fakeDocument(() => ({ ok: true, data: SHOW }), 6_000);
    const client = createNetflixBridgeClient({ target, newId });
    const result = client.load('81402901', signal());
    await vi.advanceTimersByTimeAsync(6_000);
    expect(await result).toEqual(SHOW);
    expect(requests).toHaveLength(1);
  });

  it('pont muet : 2 nouvelles tentatives (12 s chacune), puis null', async () => {
    const { target, requests } = fakeDocument(() => null);
    const client = createNetflixBridgeClient({ target, newId });
    const result = client.load('81402901', signal());
    await vi.advanceTimersByTimeAsync(NETFLIX_ATTEMPT_TIMEOUT_MS - 1);
    expect(requests).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(await result).toBeNull();
    expect(requests).toHaveLength(3);
    expect(client.peek('81402901')).toBeNull();
  });

  it('erreur passagère puis succès : la nouvelle tentative aboutit', async () => {
    let calls = 0;
    const { target, requests } = fakeDocument(() => (++calls === 1 ? { ok: false, error: 'http', status: 503 } : { ok: true, data: SHOW }));
    const client = createNetflixBridgeClient({ target, newId });
    const result = client.load('81402901', signal());
    await vi.advanceTimersByTimeAsync(2_000);
    expect(await result).toEqual(SHOW);
    expect(requests).toHaveLength(2);
  });

  it('erreur définitive (404, forme inattendue) : pas de nouvelle tentative', async () => {
    for (const body of [{ ok: false, error: 'http', status: 404 }, { ok: false, error: 'shape' }] as const) {
      const { target, requests } = fakeDocument(() => body);
      const client = createNetflixBridgeClient({ target, newId });
      const result = client.load('81402901', signal());
      await vi.advanceTimersByTimeAsync(20_000);
      expect(await result).toBeNull();
      expect(requests).toHaveLength(1);
    }
  });

  it('annulation : null immédiat pour l’appelant, la requête partagée continue pour les autres', async () => {
    const { target, requests } = fakeDocument(() => ({ ok: true, data: SHOW }));
    const client = createNetflixBridgeClient({ target, newId });
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
    const { target, requests } = fakeDocument(() => ({ ok: true, data: SHOW }));
    const client = createNetflixBridgeClient({ target, newId });
    expect(await client.load('../evil', signal())).toBeNull();
    expect(requests).toHaveLength(0);
  });

  it('cache LRU limité à 5 séries', async () => {
    const shows = Array.from({ length: 6 }, (_, i): NetflixShowMetadata => ({ ...SHOW, showId: String(i), seasons: [] }));
    const { target, requests } = fakeDocument((request) => ({ ok: true, data: shows[Number(request.movieId)] }));
    const client = createNetflixBridgeClient({ target, newId });
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
