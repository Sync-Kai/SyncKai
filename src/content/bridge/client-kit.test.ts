import { afterEach, describe, expect, it, vi } from 'vitest';
import { advance, flushPorts, useBridgeFakeTimers } from '../../test/ports';
import { createBridgeConnection, createWaiters, lazy, openBridgeChannel, untilAborted, type ChannelEndpoints } from './client-kit';

// Kit des clients isolés : ouverture du canal (premier port d'une offre reconnue), connexion, attentes bornées.

const ORIGIN = 'https://site.example';
const ports: MessagePort[] = [];

afterEach(() => {
  for (const port of ports.splice(0)) port.close();
  vi.useRealTimers();
});

function endpoints(trusted = true): ChannelEndpoints & { handshakes: string[] } {
  const target = new EventTarget();
  const handshakes: string[] = [];
  target.addEventListener('hello', (event) => handshakes.push(String((event as CustomEvent<unknown>).detail)));
  return { target, messages: new EventTarget(), origin: ORIGIN, isTrusted: () => trusted, handshakes };
}

/** Offre un port comme le pont ; retourne le côté du pont */
function offer(ep: ChannelEndpoints, data: unknown, origin = ORIGIN): MessagePort {
  const { port1, port2 } = new MessageChannel();
  ports.push(port1, port2);
  ep.messages.dispatchEvent(new MessageEvent('message', { data, origin, ports: [port2] }));
  return port1;
}

describe('openBridgeChannel', () => {
  it('premier port d’une offre reconnue, de l’origine attendue ; offres suivantes ignorées', async () => {
    const ep = endpoints();
    const opened = openBridgeChannel(ep, 'hello', 'h1', (data) => data === 'offre', 1_000);
    expect(ep.handshakes).toEqual(['h1']);
    offer(ep, 'autre');
    offer(ep, 'offre', 'https://evil.example');
    const first = offer(ep, 'offre');
    offer(ep, 'offre');
    const port = await opened;
    if (!port) throw new Error('aucun port');
    ports.push(port);
    const received = new Promise<unknown>((resolve) => (port.onmessage = (event) => resolve(event.data)));
    first.postMessage('du pont');
    expect(await received).toBe('du pont');
  });

  it('offre synthétique (non isTrusted) refusée ; pont absent : null après le délai', async () => {
    useBridgeFakeTimers();
    const ep = endpoints(false);
    const opened = openBridgeChannel(ep, 'hello', 'h1', () => true, 1_000);
    offer(ep, 'offre');
    await advance(1_000);
    expect(await opened).toBeNull();
  });
});

describe('createBridgeConnection', () => {
  it('ouverture partagée, port mémorisé ; échec : nouvel essai avec un nouveau nonce ; messages non isTrusted ignorés', async () => {
    useBridgeFakeTimers();
    const ep = endpoints();
    let trusted = true;
    ep.isTrusted = () => trusted;
    const ids = ['a', 'b'];
    const onMessage = vi.fn<(data: unknown) => void>();
    const onOpen = vi.fn<(port: MessagePort | null) => void>();
    const connect = createBridgeConnection({ endpoints: ep, event: 'hello', handshake: (nonce) => `h:${nonce}`, isOffer: (data, nonce) => data === `o:${nonce}`, timeoutMs: 500, newId: () => ids.shift() ?? 'z', onMessage, onOpen });
    const [first, second] = [connect(), connect()];
    expect(first).toBe(second);
    await advance(500);
    expect(await first).toBeNull();
    const retry = connect();
    expect(ep.handshakes).toEqual(['h:a', 'h:b']);
    const bridge = offer(ep, 'o:b');
    const port = await retry;
    expect(port).not.toBeNull();
    expect(await connect()).toBe(port);
    expect(ep.handshakes).toHaveLength(2);
    expect(onOpen.mock.calls.map(([opened]) => opened !== null)).toEqual([false, true]);
    bridge.postMessage('un');
    await flushPorts();
    trusted = false;
    bridge.postMessage('deux');
    await flushPorts();
    expect(onMessage.mock.calls).toEqual([['un']]);
  });
});

describe('createWaiters', () => {
  it('valeur dès qu’elle est définie (null est une réponse), relue à chaque notify ; abonnés appelés', async () => {
    const { notify, subscribe, until } = createWaiters();
    let value: string | null | undefined;
    const listener = vi.fn();
    const unsubscribe = subscribe(listener);
    const waiting = until(() => value, new AbortController().signal, 1_000);
    value = 'prêt';
    notify();
    expect(await waiting).toBe('prêt');
    value = null;
    expect(await until(() => value, new AbortController().signal, 1_000)).toBeNull();
    unsubscribe();
    notify();
    expect(listener).toHaveBeenCalledOnce();
  });

  it('délai obligatoire (2-R11) et annulation : null, attente retirée', async () => {
    useBridgeFakeTimers();
    const { notify, until } = createWaiters();
    const get = vi.fn((): string | undefined => undefined);
    const timedOut = until(get, new AbortController().signal, 1_000);
    await advance(1_000);
    expect(await timedOut).toBeNull();
    const controller = new AbortController();
    const aborted = until(get, controller.signal, 60_000);
    controller.abort();
    expect(await aborted).toBeNull();
    get.mockClear();
    notify();
    expect(get).not.toHaveBeenCalled();
  });
});

describe('untilAborted et lazy', () => {
  it('promesse partagée : null pour l’appelant annulé seulement ; valeur créée une fois', async () => {
    let resolve: (value: string) => void = () => undefined;
    const shared = new Promise<string | null>((done) => (resolve = done));
    const controller = new AbortController();
    const cancelled = untilAborted(shared, controller.signal);
    const kept = untilAborted(shared, new AbortController().signal);
    controller.abort();
    resolve('valeur');
    expect([await cancelled, await kept]).toEqual([null, 'valeur']);
    const create = vi.fn(() => ({}));
    const get = lazy(create);
    expect(get()).toBe(get());
    expect(create).toHaveBeenCalledOnce();
  });
});
