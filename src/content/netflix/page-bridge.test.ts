import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { encodeNetflixHandshake, installNetflixBridgeOnce, NETFLIX_BRIDGE_VERSION, NETFLIX_HANDSHAKE_EVENT, netflixBridgeFlag } from './bridge-protocol';

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
});

describe('installNetflixBridgeOnce', () => {
  it('installe une fois par version, la v1 garde la clé historique', () => {
    const global = {};
    const install = vi.fn();
    expect(installNetflixBridgeOnce(global, 1, install)).toBe(true);
    expect(installNetflixBridgeOnce(global, 1, install)).toBe(false);
    expect(installNetflixBridgeOnce(global, 2, install)).toBe(true);
    expect(install).toHaveBeenCalledTimes(2);
    expect(netflixBridgeFlag(1)).toBe(Symbol.for('synckai.netflix.bridge'));
    expect(netflixBridgeFlag(2)).not.toBe(netflixBridgeFlag(1));
  });
});
