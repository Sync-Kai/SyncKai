import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { advance, useBridgeFakeTimers } from '../../test/ports';
import { encodeNetflixHandshake, encodeNetflixRequest, NETFLIX_BRIDGE_VERSION, NETFLIX_HANDSHAKE_EVENT, netflixBridgeFlag } from './bridge-protocol';
import { installOnce } from '../../shared/guards';

// Garde d'installation du pont MAIN : le pont reste dans la page après une mise à jour de l'extension (code de la
// page, jamais invalidé) et le service worker le réexécute dans les onglets Netflix ouverts.

type PostMessage = (message: string, origin: string, transfer: MessagePort[]) => void;
type FakeWindow = EventTarget & { postMessage: ReturnType<typeof vi.fn<PostMessage>> };

let page: FakeWindow;

/** Exécute le pont comme le ferait executeScript (nouvelle évaluation du module), version de protocole choisie */
async function runBridge(version: number): Promise<void> {
  vi.resetModules();
  vi.doMock('./bridge-protocol', async (importOriginal) => ({ ...(await importOriginal<typeof import('./bridge-protocol')>()), NETFLIX_BRIDGE_VERSION: version }));
  await import('./page-bridge.iife');
  vi.doUnmock('./bridge-protocol');
}

let addListener: { mock: { calls: unknown[][] } };

/** Écouteurs de demande d'ouverture posés sur la page */
function handshakeListeners(): number {
  return addListener.mock.calls.filter(([type]) => type === NETFLIX_HANDSHAKE_EVENT).length;
}

beforeEach(() => {
  page = Object.assign(new EventTarget(), { postMessage: vi.fn<PostMessage>() });
  addListener = vi.spyOn(page, 'addEventListener');
  vi.stubGlobal('window', page);
  vi.stubGlobal('location', { origin: 'https://www.netflix.com' });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('page-bridge.iife.ts — une installation par version de protocole', () => {
  it('réexécuté dans la page (même version) : un seul écouteur, une seule offre de port par demande', async () => {
    await runBridge(1);
    await runBridge(1);
    expect(handshakeListeners()).toBe(1);
    page.dispatchEvent(new CustomEvent(NETFLIX_HANDSHAKE_EVENT, { detail: encodeNetflixHandshake({ v: NETFLIX_BRIDGE_VERSION, nonce: 'n1' }) }));
    expect(page.postMessage).toHaveBeenCalledOnce();
    for (const port of page.postMessage.mock.calls[0]?.[2] ?? []) port.close();
  });

  it('pont v1 resté dans la page (clé historique) : un pont d’une nouvelle version s’installe quand même', async () => {
    Reflect.defineProperty(page, Symbol.for('synckai.netflix.bridge'), { value: true });
    await runBridge(1);
    expect(handshakeListeners()).toBe(0);
    await runBridge(2);
    expect(handshakeListeners()).toBe(1);
  });

  it('demandes d’ouverture répétées : 4 canaux au plus, le plus ancien fermé (comme les ponts passifs)', async () => {
    // Requête du site en échec : la réponse « network » suffit à prouver que le canal répond encore
    vi.stubGlobal('fetch', vi.fn<typeof fetch>(() => Promise.reject(new TypeError('hors ligne'))));
    useBridgeFakeTimers();
    await runBridge(NETFLIX_BRIDGE_VERSION);
    const ports = Array.from({ length: 6 }, (_, i) => {
      page.dispatchEvent(new CustomEvent(NETFLIX_HANDSHAKE_EVENT, { detail: encodeNetflixHandshake({ v: NETFLIX_BRIDGE_VERSION, nonce: `n${i}` }) }));
      const port = page.postMessage.mock.calls.at(-1)?.[2][0];
      if (!port) throw new Error('aucun port');
      return port;
    });
    const answering = Promise.all(
      ports.map(
        (port, i) =>
          new Promise<boolean>((resolve) => {
            port.onmessage = () => resolve(true);
            setTimeout(() => resolve(false), 100);
            port.postMessage(encodeNetflixRequest({ v: NETFLIX_BRIDGE_VERSION, id: `r${i}`, movieId: '81301833' }));
          }),
      ),
    );
    // Délai de 100 ms en temps simulé : un canal fermé ne répond jamais
    await advance(200);
    const answered = await answering;
    expect(answered).toEqual([false, false, true, true, true, true]);
    for (const port of ports) port.close();
  });
});

describe('netflixBridgeFlag', () => {
  it('installe une fois par version, la v1 garde la clé historique', () => {
    const global = {};
    const install = vi.fn();
    expect(installOnce(global, netflixBridgeFlag(1), install)).toBe(true);
    expect(installOnce(global, netflixBridgeFlag(1), install)).toBe(false);
    expect(installOnce(global, netflixBridgeFlag(2), install)).toBe(true);
    expect(install).toHaveBeenCalledTimes(2);
    expect(netflixBridgeFlag(1)).toBe(Symbol.for('synckai.netflix.bridge'));
    expect(netflixBridgeFlag(2)).not.toBe(netflixBridgeFlag(1));
  });
});
