import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PrimeBridgeClientOptions } from '../prime/bridge-client';
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
} from '../prime/bridge-protocol';
import {
  BUMPKIN_S1_COMPACT,
  BUMPKIN_TITLE,
  bumpkinCatalog,
  bumpkinDetailBody,
  bumpkinEpisodeGti,
  bumpkinPlayback,
  hydrationDocument,
  SEEN_AT,
} from '../prime/fixtures';
import type { StreamingAdapter } from '../lib/adapter';

// Adapter Prime Video branché sur le vrai client du pont et un faux onglet (Node : ni DOM ni postMessage « trusted ») :
// page de détail lue dans le nœud d'hydratation, épisodes poussés par un pont MAIN simulé, comme lors de la lecture
// automatique relevée le 2026-10-14 (URL inchangée, repères de l'épisode suivant reçus avant la bascule).

const ORIGIN = 'https://www.primevideo.com';
const PAGE = `/region/eu/detail/${BUMPKIN_S1_COMPACT}`;

interface FakeVideo {
  paused: boolean;
  duration: number;
  currentTime: number;
  isConnected: boolean;
}

const fakeWindow = new EventTarget();
const channels: MessageChannel[] = [];
const ports: MessagePort[] = [];
let hydration: string | null = null;
let videos: FakeVideo[] = [];
let adText: string | null = null;

const fakeDocument = Object.assign(new EventTarget(), {
  querySelector: (selector: string): unknown => {
    if (selector.includes('dv-web-page-hydration-data')) return hydration === null ? null : { textContent: hydration };
    if (selector.includes('ad-timer')) return adText === null ? null : { textContent: adText, getClientRects: () => ({ length: 1 }) };
    return null;
  },
  querySelectorAll: (selector: string): unknown[] => (selector === 'video' ? videos : []),
});

vi.mock('../prime/bridge-client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../prime/bridge-client')>();
  return {
    ...actual,
    createPrimeBridgeClient: (options: PrimeBridgeClientOptions) =>
      actual.createPrimeBridgeClient({ ...options, target: fakeDocument, messages: fakeWindow, isTrusted: () => true, connectTimeoutMs: 100, waitMs: 200 }),
  };
});

fakeDocument.addEventListener(PRIME_HANDSHAKE_EVENT, (event) => {
  const handshake = event instanceof CustomEvent ? decodePrimeHandshake(event.detail) : null;
  if (!handshake) return;
  const channel = new MessageChannel();
  channels.push(channel);
  ports.push(channel.port1);
  const data = encodePrimePortOffer({ v: PRIME_BRIDGE_VERSION, type: PRIME_PORT_OFFER, nonce: handshake.nonce });
  queueMicrotask(() => fakeWindow.dispatchEvent(new MessageEvent('message', { data, origin: ORIGIN, ports: [channel.port2] })));
});

function push(delta: Partial<Omit<PrimeBridgePush, 'v'>>): void {
  for (const port of ports) port.postMessage(encodePrimePush({ v: PRIME_BRIDGE_VERSION, catalog: [], playback: [], titles: [], widgets: [], ...delta }));
}

const catalog = (n: number) => {
  const entry = reducePrimeCatalog(bumpkinCatalog(n), bumpkinEpisodeGti(n), SEEN_AT + n * 1_000);
  if (!entry) throw new Error('fixture invalide');
  return entry;
};
const playback = (n: number) => {
  const entry = reducePrimePlayback(bumpkinPlayback(n), bumpkinEpisodeGti(n), SEEN_AT + n * 1_000 - 1);
  if (!entry) throw new Error('fixture invalide');
  return entry;
};

const delay = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));
const signal = (): AbortSignal => new AbortController().signal;
const pageUrl = (): URL => new URL(`${ORIGIN}${PAGE}`);

async function loadAdapter(): Promise<StreamingAdapter> {
  vi.resetModules();
  return (await import('./prime')).primeAdapter;
}

beforeEach(() => {
  hydration = JSON.stringify(hydrationDocument());
  videos = [];
  adText = null;
  vi.stubGlobal('document', fakeDocument);
  vi.stubGlobal('window', fakeWindow);
  vi.stubGlobal('location', { origin: ORIGIN, pathname: PAGE, href: `${ORIGIN}${PAGE}` });
});

afterEach(() => {
  ports.splice(0);
  for (const { port1, port2 } of channels.splice(0)) {
    port1.close();
    port2.close();
  }
  vi.unstubAllGlobals();
});

describe('primeAdapter — lecture automatique sans changement d’URL', () => {
  it('épisode suivi d’après le lecteur ; repères de l’épisode suivant jamais attribués à l’épisode en cours', async () => {
    const adapter = await loadAdapter();
    const changes: (string | null)[] = [];
    const stop = adapter.watchEpisode?.(() => changes.push(adapter.getEpisodeId(pageUrl())));
    await delay(20);
    expect(adapter.getEpisodeId(pageUrl())).toBeNull();

    push({ catalog: [catalog(2)], playback: [playback(2)] });
    await vi.waitFor(() => expect(changes).toEqual([bumpkinEpisodeGti(2)]));
    expect(adapter.extractEpisodeInfo(pageUrl())).toMatchObject({ animeTitle: BUMPKIN_TITLE, seasonNumber: 1, seasonEpisodeNumber: 2, primeAnime: 'animation-ja' });

    // ~1 s avant la bascule : repères de E3 ; l'épisode en cours reste E2, son générique aussi
    push({ playback: [playback(3)] });
    await delay(50);
    expect(adapter.getEpisodeId(pageUrl())).toBe(bumpkinEpisodeGti(2));
    expect(await adapter.getCreditsStart?.(bumpkinEpisodeGti(2), signal())).toBe(1311);
    expect(changes).toHaveLength(1);

    // Bascule : métadonnées de E3
    push({ catalog: [catalog(3)] });
    await vi.waitFor(() => expect(changes).toEqual([bumpkinEpisodeGti(2), bumpkinEpisodeGti(3)]));
    expect(await adapter.loadEpisodeInfo?.(bumpkinEpisodeGti(3), signal())).toMatchObject({ episodeId: bumpkinEpisodeGti(3), seasonEpisodeNumber: 3 });
    expect(await adapter.getCreditsStart?.(bumpkinEpisodeGti(3), signal())).toBe(1312);
    stop?.();
  });

  it('pas un anime (genres hors animation) : épisode jamais envoyé, page de détail non affichée', async () => {
    hydration = JSON.stringify(hydrationDocument(bumpkinDetailBody({ genres: ['av_genre_drama'] })));
    const adapter = await loadAdapter();
    adapter.watchEpisode?.(() => undefined);
    await delay(20);
    push({ catalog: [catalog(1)] });
    await vi.waitFor(() => expect(adapter.getEpisodeId(pageUrl())).toBe(bumpkinEpisodeGti(1)));
    expect(await adapter.loadEpisodeInfo?.(bumpkinEpisodeGti(1), signal())).toBeNull();
    expect(adapter.detectSeries(pageUrl())).toBeNull();
  });

  it('page de série (hydratation) ; lecteur : durée de l’épisode, jamais la bande-annonce ; pas de progression pendant une publicité', async () => {
    const adapter = await loadAdapter();
    expect(adapter.detectSeries(pageUrl())).toMatchObject({ seriesId: BUMPKIN_S1_COMPACT, seriesTitle: BUMPKIN_TITLE, seasonNumber: 1, seasonEpisodeCount: 4 });
    adapter.watchEpisode?.(() => undefined);
    await delay(20);
    push({ catalog: [catalog(2)], playback: [playback(2)] });
    await vi.waitFor(() => expect(adapter.getEpisodeId(pageUrl())).toBe(bumpkinEpisodeGti(2)));
    const trailer: FakeVideo = { paused: true, duration: 63, currentTime: 0, isConnected: true };
    const main: FakeVideo = { paused: true, duration: 1441, currentTime: 600, isConnected: true };
    videos = [trailer, main];
    const found = adapter.findVideo() as unknown as FakeVideo | null;
    expect(found).toBe(main);
    const video = found as unknown as HTMLVideoElement;
    expect(adapter.readPlayback?.(video)).toEqual({ currentTime: 600, duration: 1441 });
    adText = '0:15';
    expect(adapter.readPlayback?.(video)).toBeNull();
  });
});
