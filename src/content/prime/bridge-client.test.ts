import { afterEach, describe, expect, it, vi } from 'vitest';
import { reducePrimeDetail, reducePrimeDetailWidgets } from '../../shared/prime-metadata';
import { createPrimeBridgeClient, type PrimeBridgeClient } from './bridge-client';
import {
  decodePrimeHandshake,
  encodePrimePortOffer,
  encodePrimePush,
  PRIME_BRIDGE_VERSION,
  PRIME_HANDSHAKE_EVENT,
  PRIME_PORT_OFFER,
  reducePrimeCatalog,
  reducePrimePlayback,
  type PrimeBridgePush,
  type PrimeCatalogEntry,
  type PrimePlaybackEntry,
} from './bridge-protocol';
import {
  BUMPKIN_S1_COMPACT,
  BUMPKIN_S1_GTI,
  bumpkinCatalog,
  bumpkinDetailWidgets,
  bumpkinEpisodeGti,
  bumpkinPlayback,
  hydrationDocument,
  SEEN_AT,
} from './fixtures';

const ORIGIN = 'https://www.primevideo.com';
const V = PRIME_BRIDGE_VERSION;
const PAGE = `/region/eu/detail/${BUMPKIN_S1_COMPACT}`;

function catalog(n: number, seenAt = SEEN_AT + n): PrimeCatalogEntry {
  const entry = reducePrimeCatalog(bumpkinCatalog(n), bumpkinEpisodeGti(n), seenAt);
  if (!entry) throw new Error('fixture invalide');
  return entry;
}

function playback(n: number, seenAt = SEEN_AT + n): PrimePlaybackEntry {
  const entry = reducePrimePlayback(bumpkinPlayback(n), bumpkinEpisodeGti(n), seenAt);
  if (!entry) throw new Error('fixture invalide');
  return entry;
}

const channels: MessageChannel[] = [];
const forged = new WeakSet<Event>();

afterEach(() => {
  for (const { port1, port2 } of channels.splice(0)) {
    port1.close();
    port2.close();
  }
});

type Delta = Partial<Omit<PrimeBridgePush, 'v'>>;

/** Faux onglet avec pont MAIN simulé (vrai postMessage asynchrone, instantané puis nouveautés) ; `bridge: false` : absent */
function setup(options: { bridge?: boolean; seen?: Delta; path?: () => string } = {}): { client: PrimeBridgeClient; push: (delta: Delta) => void; handshakes: () => number } {
  const document = new EventTarget();
  const window = new EventTarget();
  const ports: MessagePort[] = [];
  let handshakes = 0;
  const encode = (delta: Delta): string => encodePrimePush({ v: V, catalog: [], playback: [], titles: [], widgets: [], ...delta });
  if (options.bridge !== false) {
    document.addEventListener(PRIME_HANDSHAKE_EVENT, (event) => {
      const handshake = event instanceof CustomEvent ? decodePrimeHandshake(event.detail) : null;
      if (!handshake) return;
      handshakes++;
      const data = encodePrimePortOffer({ v: V, type: PRIME_PORT_OFFER, nonce: handshake.nonce });
      const channel = new MessageChannel();
      channels.push(channel);
      ports.push(channel.port1);
      queueMicrotask(() => window.dispatchEvent(new MessageEvent('message', { data, origin: ORIGIN, ports: [channel.port2] })));
      if (options.seen) channel.port1.postMessage(encode(options.seen));
    });
  }
  const client = createPrimeBridgeClient({
    target: document,
    messages: window,
    origin: ORIGIN,
    connectTimeoutMs: 50,
    waitMs: 200,
    currentPath: options.path ?? ((): string => PAGE),
    isTrusted: (event) => !forged.has(event),
  });
  return {
    client,
    push: (delta) => {
      for (const port of ports) port.postMessage(encode(delta));
    },
    handshakes: () => handshakes,
  };
}

const signal = (): AbortSignal => new AbortController().signal;
const delay = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

describe('createPrimeBridgeClient', () => {
  it('canal ouvert au démarrage, instantané reçu, abonnés prévenus ; chemin de réception retenu', async () => {
    const { client, handshakes } = setup({ seen: { catalog: [catalog(1)] } });
    let notified = 0;
    client.subscribe(() => notified++);
    client.start();
    client.start();
    await vi.waitFor(() => expect(notified).toBe(1));
    expect(handshakes()).toBe(1);
    expect(client.latestCatalog()).toMatchObject({ id: bumpkinEpisodeGti(1), path: PAGE });
    expect(client.peekCatalog(bumpkinEpisodeGti(1).toUpperCase())?.episodeNumber).toBe(1);
  });

  it('lecture automatique : la dernière fiche du lecteur fait foi, les repères restent indexés par épisode', async () => {
    const { client, push } = setup();
    client.start();
    await delay(20);
    push({ catalog: [catalog(3)], playback: [playback(3)] });
    // Repères de E4 reçus avant la bascule : jamais ceux de l'épisode en cours
    push({ playback: [playback(4)] });
    await vi.waitFor(() => expect(client.peekPlayback(bumpkinEpisodeGti(4))).not.toBeNull());
    expect(client.latestCatalog()?.id).toBe(bumpkinEpisodeGti(3));
    expect(client.peekPlayback(bumpkinEpisodeGti(3))?.seenAt).toBe(SEEN_AT + 3);
    push({ catalog: [catalog(4)] });
    await vi.waitFor(() => expect(client.latestCatalog()?.id).toBe(bumpkinEpisodeGti(4)));
    expect(client.peekPlayback(bumpkinEpisodeGti(4))?.creditsStartMs).toBe(1_312_000);
  });

  it('fiche reçue sur une autre page : chemin de la première réception conservé', async () => {
    let path = PAGE;
    const { client, push } = setup({ path: () => path });
    client.start();
    await delay(20);
    push({ catalog: [catalog(1)] });
    await vi.waitFor(() => expect(client.latestCatalog()).not.toBeNull());
    path = '/region/eu/detail/0OTHERPAGE0000000000000000';
    push({ catalog: [catalog(1)], playback: [playback(1)] });
    await vi.waitFor(() => expect(client.peekPlayback(bumpkinEpisodeGti(1))).not.toBeNull());
    expect(client.latestCatalog()?.path).toBe(PAGE);
  });

  it('repères attendus jusqu’à leur arrivée, null après le délai ou sans pont', async () => {
    const { client, push } = setup();
    const pending = client.loadPlayback(bumpkinEpisodeGti(2), signal());
    await delay(20);
    push({ playback: [playback(2)] });
    expect((await pending)?.creditsStartMs).toBe(1_311_000);
    expect(await client.loadPlayback(bumpkinEpisodeGti(9), signal())).toBeNull();
    expect(await setup({ bridge: false }).client.loadPlayback(bumpkinEpisodeGti(2), signal())).toBeNull();
    const aborted = new AbortController();
    aborted.abort();
    expect(await client.loadPlayback(bumpkinEpisodeGti(2), aborted.signal)).toBeNull();
  });

  it('pages de détail : par identifiant du chemin, GTI de saison ou GTI compact ; widgets gardés', async () => {
    const title = reducePrimeDetail(hydrationDocument());
    const widgets = reducePrimeDetailWidgets(bumpkinDetailWidgets(2));
    if (!title || !widgets) throw new Error('fixtures');
    const { client, push } = setup();
    const pending = client.loadTitle(BUMPKIN_S1_COMPACT, signal());
    await delay(20);
    push({ titles: [{ requestId: 'B0ABCDEF12', seenAt: SEEN_AT, title }], widgets: [{ seenAt: SEEN_AT, widgets }] });
    expect((await pending)?.seasonGti).toBe(BUMPKIN_S1_GTI);
    expect(client.peekTitle('B0ABCDEF12')?.seasonGti).toBe(BUMPKIN_S1_GTI);
    expect(client.peekTitle(BUMPKIN_S1_GTI)).not.toBeNull();
    expect(client.peekTitle('0OTHERPAGE0000000000000000')).toBeNull();
    expect(client.widgets().map((entry) => entry.widgets.bestSelf?.gti)).toEqual([bumpkinEpisodeGti(2)]);
  });

});
