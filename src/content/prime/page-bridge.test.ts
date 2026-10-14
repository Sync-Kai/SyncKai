import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { decodePrimePush, encodePrimeHandshake, PRIME_BRIDGE_VERSION, PRIME_HANDSHAKE_EVENT, type PrimeBridgePush } from './bridge-protocol';
import {
  BUMPKIN_S1_COMPACT,
  BUMPKIN_S1_GTI,
  bumpkinCatalog,
  bumpkinDetailWidgets,
  bumpkinEpisodeGti,
  bumpkinNextUp,
  bumpkinPlayback,
  catalogUrl,
  detailUrl,
  playbackUrl,
  spaDetailResponse,
  widgetsUrl,
} from './fixtures';

// Pont MAIN de Prime Video : observateur passif des réponses du site (fetch, XMLHttpRequest), exécuté sur une fausse
// page (Node : ni DOM ni XHR).

class FakeXhr extends EventTarget {
  static opened: unknown[][] = [];
  status = 0;
  responseType: XMLHttpRequestResponseType = '';
  responseText = '';
  response: unknown = null;
  reply: { status: number; body: unknown } = { status: 200, body: null };

  open(...args: unknown[]): void {
    FakeXhr.opened.push(args);
  }

  send(): void {
    this.status = this.reply.status;
    if (this.responseType === 'json') this.response = this.reply.body;
    else this.responseText = typeof this.reply.body === 'string' ? this.reply.body : JSON.stringify(this.reply.body);
    queueMicrotask(() => this.dispatchEvent(new Event('load')));
  }
}

type PostMessage = (message: string, origin: string, transfer: MessagePort[]) => void;
type FakeWindow = EventTarget & { postMessage: ReturnType<typeof vi.fn<PostMessage>>; fetch: typeof fetch };

let page: FakeWindow;
const originalOpen = FakeXhr.prototype.open;
const originalSend = FakeXhr.prototype.send;
const received: MessagePort[] = [];
/** Réponses servies par le faux fetch, par URL */
let fetchReplies = new Map<string, unknown>();
/** fetch d'origine de la page (avant le pont), dont les appels sont relevés */
let siteFetch: ReturnType<typeof vi.fn<typeof fetch>>;

async function runBridge(): Promise<void> {
  vi.resetModules();
  await import('./page-bridge.iife');
}

/** Ouvre le canal comme le client isolé ; messages reçus sur le port, dans l'ordre */
function connect(nonce = 'n1'): PrimeBridgePush[] {
  const pushes: PrimeBridgePush[] = [];
  page.dispatchEvent(new CustomEvent(PRIME_HANDSHAKE_EVENT, { detail: encodePrimeHandshake({ v: PRIME_BRIDGE_VERSION, nonce }) }));
  const port = page.postMessage.mock.calls.at(-1)?.[2][0];
  if (!port) throw new Error('aucune offre de port');
  received.push(port);
  port.addEventListener('message', (event) => {
    const push = decodePrimePush((event as MessageEvent).data);
    if (push) pushes.push(push);
  });
  port.start();
  return pushes;
}

function siteXhr(url: string, body: unknown, { status = 200, responseType = '' as XMLHttpRequestResponseType, method = 'GET' } = {}): void {
  const xhr = new XMLHttpRequest() as unknown as FakeXhr;
  xhr.reply = { status, body };
  xhr.responseType = responseType;
  xhr.open(method, url);
  xhr.send();
}

const flush = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 10));

beforeEach(() => {
  FakeXhr.prototype.open = originalOpen;
  FakeXhr.prototype.send = originalSend;
  FakeXhr.opened = [];
  fetchReplies = new Map();
  siteFetch = vi.fn<typeof fetch>((input) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    return Promise.resolve(new Response(JSON.stringify(fetchReplies.get(url) ?? {}), { status: 200 }));
  });
  page = Object.assign(new EventTarget(), { postMessage: vi.fn<PostMessage>(), fetch: siteFetch });
  Reflect.deleteProperty(globalThis, Symbol.for(`synckai.prime.bridge.v${PRIME_BRIDGE_VERSION}`));
  vi.stubGlobal('window', page);
  vi.stubGlobal('XMLHttpRequest', FakeXhr);
  vi.stubGlobal('location', { origin: 'https://www.primevideo.com', href: `https://www.primevideo.com/region/eu/detail/${BUMPKIN_S1_COMPACT}` });
});

afterEach(() => {
  for (const port of received.splice(0)) port.close();
  vi.unstubAllGlobals();
});

describe('page-bridge.iife.ts (Prime Video)', () => {
  it('réponses vues avant l’ouverture du canal : instantané réduit, rien de sensible', async () => {
    await runBridge();
    fetchReplies.set(detailUrl(), spaDetailResponse());
    await window.fetch(detailUrl());
    siteXhr(catalogUrl(bumpkinEpisodeGti(1)), bumpkinCatalog(1));
    siteXhr(playbackUrl(bumpkinEpisodeGti(1)), bumpkinPlayback(1), { method: 'POST' });
    await flush();
    const pushes = connect();
    await flush();
    expect(pushes).toHaveLength(1);
    const [snapshot] = pushes;
    expect(snapshot?.catalog.map((entry) => [entry.id, entry.episodeNumber])).toEqual([[bumpkinEpisodeGti(1), 1]]);
    expect(snapshot?.playback.map((entry) => entry.id)).toEqual([bumpkinEpisodeGti(1)]);
    expect(snapshot?.titles.map((entry) => [entry.requestId, entry.title.seasonGti])).toEqual([[BUMPKIN_S1_COMPACT, BUMPKIN_S1_GTI]]);
    expect(JSON.stringify(pushes)).not.toMatch(/SECRET|https?:/);
    // Requêtes du site transmises telles quelles, aucune ajoutée
    expect(FakeXhr.opened).toEqual([
      ['GET', catalogUrl(bumpkinEpisodeGti(1))],
      ['POST', playbackUrl(bumpkinEpisodeGti(1))],
    ]);
    expect(siteFetch).toHaveBeenCalledOnce();
  });

  it('lecture automatique : repères de l’épisode suivant reçus AVANT la bascule, rattachés à son seul identifiant', async () => {
    await runBridge();
    const pushes = connect();
    siteXhr(catalogUrl(bumpkinEpisodeGti(3)), bumpkinCatalog(3));
    siteXhr(playbackUrl(bumpkinEpisodeGti(3)), bumpkinPlayback(3));
    await flush();
    // ~1 s avant la fin de E3 : réponse de lecture de E4 ; la carte « À suivre » (nextUpV3) ne donne aucune identité
    siteXhr(playbackUrl(bumpkinEpisodeGti(4)), bumpkinPlayback(4));
    siteXhr(catalogUrl(bumpkinEpisodeGti(3), 'nextUpV3'), bumpkinNextUp(4));
    await flush();
    // Bascule : métadonnées et widgets de E4
    siteXhr(catalogUrl(bumpkinEpisodeGti(4)), bumpkinCatalog(4), { responseType: 'json' });
    siteXhr(widgetsUrl(), bumpkinDetailWidgets(4));
    await flush();
    const catalog = pushes.flatMap((push) => push.catalog);
    const playback = pushes.flatMap((push) => push.playback);
    expect(catalog.map((entry) => [entry.id, entry.episodeNumber])).toEqual([
      [bumpkinEpisodeGti(3), 3],
      [bumpkinEpisodeGti(4), 4],
    ]);
    expect(playback.map((entry) => [entry.id, entry.creditsStartMs])).toEqual([
      [bumpkinEpisodeGti(3), 1_312_000],
      [bumpkinEpisodeGti(4), 1_312_000],
    ]);
    expect(pushes.flatMap((push) => push.widgets).map((entry) => entry.widgets.bestSelf?.gti)).toEqual([bumpkinEpisodeGti(4)]);
  });

  it('erreurs HTTP, réponses illisibles, HTML de la page : ignorés', async () => {
    await runBridge();
    const pushes = connect();
    siteXhr(catalogUrl(bumpkinEpisodeGti(1)), bumpkinCatalog(1), { status: 403 });
    siteXhr(playbackUrl(bumpkinEpisodeGti(1)), '{pas du json');
    siteXhr(detailUrl(), '<!doctype html><html></html>');
    await flush();
    expect(pushes).toEqual([]);
  });

  it('réexécuté dans la page (même version) : une seule observation', async () => {
    await runBridge();
    const patchedOpen = FakeXhr.prototype.open;
    await runBridge();
    expect(FakeXhr.prototype.open).toBe(patchedOpen);
    connect();
    expect(page.postMessage).toHaveBeenCalledOnce();
  });
});
