import { afterEach, describe, expect, it } from 'vitest';
import { connectCrunchyrollBridge } from './bridge-client';
import { CRUNCHYROLL_BRIDGE_VERSION, CRUNCHYROLL_HANDSHAKE_EVENT, encodeCrunchyrollPortOffer, encodeCrunchyrollPush } from './bridge-protocol';

// Client isolé du pont Crunchyroll : ouverture du canal (nonce, premier port seulement) et tables reçues.

const ORIGIN = 'https://www.crunchyroll.com';
const ports: MessagePort[] = [];

afterEach(() => {
  for (const port of ports.splice(0)) port.close();
});

function setup(): { target: EventTarget; messages: EventTarget; nonce: () => string; tables: ReturnType<typeof connectCrunchyrollBridge> } {
  const target = new EventTarget();
  const messages = new EventTarget();
  let nonce = '';
  target.addEventListener(CRUNCHYROLL_HANDSHAKE_EVENT, (event) => {
    nonce = String((event as CustomEvent<unknown>).detail).split(':')[1] ?? '';
  });
  const tables = connectCrunchyrollBridge({ target, messages, origin: ORIGIN, isTrusted: () => true });
  return { target, messages, nonce: () => nonce, tables };
}

/** Offre un port comme le pont ; retourne le côté du pont */
function offer(messages: EventTarget, data: string, origin = ORIGIN): MessagePort {
  const { port1, port2 } = new MessageChannel();
  ports.push(port1, port2);
  messages.dispatchEvent(new MessageEvent('message', { data, origin, ports: [port2] }));
  return port1;
}

const table = (seriesId: string, year: number): Record<string, unknown> => ({ seriesId, signals: [{ seriesYear: year }], keys: {} });
const flush = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 10));

describe('connectCrunchyrollBridge', () => {
  it('demande d’ouverture versionnée, puis tables reçues sur le port offert pour ce nonce', async () => {
    const { messages, nonce, tables } = setup();
    expect(nonce()).toMatch(/^[\w-]{8,}$/);
    const bridge = offer(messages, encodeCrunchyrollPortOffer(nonce()));
    bridge.postMessage(encodeCrunchyrollPush({ v: CRUNCHYROLL_BRIDGE_VERSION, tables: [{ seriesId: 'GA1', signals: [{ seriesYear: 2023 }], keys: {} }] }));
    await flush();
    expect(tables('GA1')).toEqual(table('GA1', 2023));
    expect(tables('GB2')).toBeNull();
  });

  it('offre d’un autre nonce ou d’une autre origine, port suivant : ignorés', async () => {
    const { messages, nonce, tables } = setup();
    offer(messages, encodeCrunchyrollPortOffer('autre')).postMessage(encodeCrunchyrollPush({ v: CRUNCHYROLL_BRIDGE_VERSION, tables: [] }));
    offer(messages, encodeCrunchyrollPortOffer(nonce()), 'https://evil.example').postMessage(JSON.stringify({ v: CRUNCHYROLL_BRIDGE_VERSION, tables: [table('GX', 1999)] }));
    const first = offer(messages, encodeCrunchyrollPortOffer(nonce()));
    const second = offer(messages, encodeCrunchyrollPortOffer(nonce()));
    second.postMessage(JSON.stringify({ v: CRUNCHYROLL_BRIDGE_VERSION, tables: [table('GX', 1999)] }));
    first.postMessage(JSON.stringify({ v: CRUNCHYROLL_BRIDGE_VERSION + 1, tables: [table('GX', 2000)] }));
    first.postMessage('{pas du json');
    await flush();
    expect(tables('GX')).toBeNull();
  });

  it('au plus 10 séries gardées, les plus anciennes retirées ; une série reçue à nouveau remplace la précédente', async () => {
    const { messages, nonce, tables } = setup();
    const bridge = offer(messages, encodeCrunchyrollPortOffer(nonce()));
    const ids = Array.from({ length: 12 }, (_, i) => `GS${i}`);
    bridge.postMessage(JSON.stringify({ v: CRUNCHYROLL_BRIDGE_VERSION, tables: ids.slice(0, 6).map((id) => table(id, 2000)) }));
    bridge.postMessage(JSON.stringify({ v: CRUNCHYROLL_BRIDGE_VERSION, tables: [...ids.slice(6).map((id) => table(id, 2001)), table('GS5', 2002)] }));
    await flush();
    expect(tables('GS0')).toBeNull();
    expect(tables('GS1')).toBeNull();
    expect(tables('GS2')).toEqual(table('GS2', 2000));
    expect(tables('GS5')).toEqual(table('GS5', 2002));
    expect(tables('GS11')).toEqual(table('GS11', 2001));
  });
});
