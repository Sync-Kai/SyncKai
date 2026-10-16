import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPorts } from '../../test/ports';
import { installPassiveBridge, MAX_BRIDGE_PORTS, parsePageJson, type PassiveBridgeSpec } from './kit';

// Kit des ponts du monde MAIN, exécuté sur une fausse page (Node : ni DOM ni XHR).

class FakeXhr extends EventTarget {
  status = 200;
  responseType: XMLHttpRequestResponseType = '';
  responseText = '';
  response: unknown = null;

  open(..._args: unknown[]): void {
    // Requête réelle sans objet ici
  }

  send(): void {
    queueMicrotask(() => this.dispatchEvent(new Event('load')));
  }
}

type PostMessage = (message: string, origin: string, transfer: MessagePort[]) => void;
let page: EventTarget & { postMessage: ReturnType<typeof vi.fn<PostMessage>>; fetch: typeof fetch };
const originalOpen = FakeXhr.prototype.open;
const originalSend = FakeXhr.prototype.send;
const opened: MessagePort[] = [];
const OBSERVER = Symbol.for('synckai.test.observer');

beforeEach(() => {
  FakeXhr.prototype.open = originalOpen;
  FakeXhr.prototype.send = originalSend;
  page = Object.assign(new EventTarget(), {
    postMessage: vi.fn<PostMessage>(),
    fetch: vi.fn<typeof fetch>(() => Promise.resolve(new Response('{"a":1}'))),
  });
  vi.stubGlobal('window', page);
  vi.stubGlobal('XMLHttpRequest', FakeXhr);
  vi.stubGlobal('location', { origin: 'https://site.example', href: 'https://site.example/page' });
});

afterEach(() => {
  for (const port of opened.splice(0)) port.close();
  vi.unstubAllGlobals();
});

/** Pont de test : lit les requêtes `/lu/{id}`, pousse « {version}:{id}:{json} » */
function spec(version: number, onPayload = vi.fn((request: string, raw: unknown): string | null => `${version}:${request}:${JSON.stringify(raw)}`)): PassiveBridgeSpec<string> {
  return {
    flag: Symbol.for(`synckai.test.v${version}`),
    observerKey: OBSERVER,
    handshakeEvent: 'test:hello',
    decodeHandshake: (detail) => (typeof detail === 'string' && detail.startsWith(`${version}:`) ? detail.slice(2) : null),
    encodeOffer: (nonce) => `offre:${version}:${nonce}`,
    observe: (url, base) => /\/lu\/(\w+)$/.exec(new URL(url, base).pathname)?.[1] ?? null,
    onPayload,
    snapshot: () => null,
    maxResponseLength: 100,
  };
}

/** Demande d'ouverture ; messages reçus sur le port offert en dernier */
function connect(detail: string): string[] {
  const messages: string[] = [];
  page.dispatchEvent(new CustomEvent('test:hello', { detail }));
  const port = page.postMessage.mock.calls.at(-1)?.[2][0];
  if (!port) throw new Error('aucun port');
  opened.push(port);
  port.onmessage = (event: MessageEvent<string>) => messages.push(event.data);
  return messages;
}

function siteXhr(url: string, body: string | object, responseType: XMLHttpRequestResponseType = ''): void {
  const xhr = new XMLHttpRequest() as unknown as FakeXhr;
  xhr.responseType = responseType;
  if (typeof body === 'string') xhr.responseText = body;
  else xhr.response = body;
  xhr.open('GET', url);
  xhr.send();
}

/** Valeur sous un chemin de clés (objets sans prototype : aucune méthode à appeler) */
const at = (value: unknown, ...keys: (string | number)[]): unknown => keys.reduce<unknown>((current, key) => (typeof current === 'object' && current !== null ? Reflect.get(current, key) : undefined), value);

describe('parsePageJson', () => {
  it('objets sans prototype : une propriété héritée polluée par la page n’est jamais lue (SEC-05)', () => {
    Reflect.defineProperty(Object.prototype, 'pollue', { value: 'page', configurable: true });
    try {
      const value = parsePageJson('{"data":[{"id":"a"}],"meta":{}}', 1_000);
      expect(at(value, 'pollue')).toBeUndefined();
      expect(at(value, 'data', 0, 'pollue')).toBeUndefined();
      expect(at(value, 'data', 0, 'id')).toBe('a');
      expect(at(value, 'meta', 'pollue')).toBeUndefined();
      // Témoin : un objet ordinaire lit la valeur polluée
      expect(at({}, 'pollue')).toBe('page');
    } finally {
      Reflect.deleteProperty(Object.prototype, 'pollue');
    }
  });

  it('valeur déjà lue par le navigateur (XHR json) : copiée, l’objet du site garde son prototype', () => {
    const site = { a: { b: 1 } };
    expect(JSON.stringify(parsePageJson(site, 1_000))).toBe('{"a":{"b":1}}');
    expect(Object.getPrototypeOf(site.a)).toBe(Object.prototype);
  });

  it('borne, texte vide, JSON illisible ou cyclique : null', () => {
    expect(parsePageJson(`"${'x'.repeat(98)}"`, 100)).toBe('x'.repeat(98));
    expect(parsePageJson(`"${'x'.repeat(99)}"`, 100)).toBeNull();
    expect(parsePageJson('', 100)).toBeNull();
    expect(parsePageJson('{pas du json', 100)).toBeNull();
    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;
    expect(parsePageJson(cyclic, 100)).toBeNull();
  });
});

describe('installPassiveBridge', () => {
  it('une version par garde ; une nouvelle version remplace l’observateur sans envelopper fetch / XHR une fois de plus (2-R3)', async () => {
    const first = spec(1);
    expect(installPassiveBridge(first)).toBe(true);
    expect(installPassiveBridge(first)).toBe(false);
    const wrapped = { open: FakeXhr.prototype.open, send: FakeXhr.prototype.send, fetch: window.fetch };
    const oldMessages = connect('1:ancien');
    const second = spec(2);
    expect(installPassiveBridge(second)).toBe(true);
    expect({ open: FakeXhr.prototype.open, send: FakeXhr.prototype.send, fetch: window.fetch }).toEqual(wrapped);
    const newMessages = connect('2:nouveau');
    siteXhr('/lu/x1', '{"a":1}');
    await window.fetch('/lu/x2');
    await flushPorts();
    expect(first.onPayload).not.toHaveBeenCalled();
    expect(oldMessages).toEqual([]);
    expect(newMessages).toEqual(['2:x1:{"a":1}', '2:x2:{"a":1}']);
  });

  it('requêtes non lues, réponses non 200, XHR json, corps trop long ; réduction en échec sans effet sur le site', async () => {
    const onPayload = vi.fn((request: string, raw: unknown): string | null => {
      if (request === 'boum') throw new Error('réduction');
      return `${request}:${JSON.stringify(raw)}`;
    });
    installPassiveBridge(spec(1, onPayload));
    const messages = connect('1:n');
    siteXhr('/autre/x', '{"a":1}');
    const failed = new XMLHttpRequest() as unknown as FakeXhr;
    failed.status = 404;
    failed.open('GET', '/lu/echec');
    failed.send();
    siteXhr('/lu/json', { b: 2 }, 'json');
    siteXhr('/lu/long', `"${'x'.repeat(200)}"`);
    siteXhr('/lu/boum', '{}');
    await flushPorts();
    expect(messages).toEqual(['json:{"b":2}', 'long:null']);
  });

  it('fetch : corps au-delà de la borne jamais lu en entier, le site reçoit sa réponse intacte (2-R13)', async () => {
    let pulled = 0;
    const chunk = new TextEncoder().encode('x'.repeat(50));
    // Corps de 500 octets en 10 morceaux, tirés à la demande
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        pulled++;
        if (pulled > 10) controller.close();
        else controller.enqueue(chunk);
      },
    });
    page.fetch = vi.fn<typeof fetch>(() => Promise.resolve(new Response(body)));
    const onPayload = vi.fn((request: string, raw: unknown): string | null => `${request}:${JSON.stringify(raw)}`);
    installPassiveBridge(spec(1, onPayload));
    const response = await window.fetch('/lu/gros');
    await flushPorts();
    expect(onPayload).toHaveBeenCalledWith('gros', null);
    expect(pulled).toBeLessThan(10);
    expect(await response.text()).toBe('x'.repeat(500));
  });

  it('fetch : corps sous la borne lu en morceaux, caractères multioctets intacts', async () => {
    const encoded = new TextEncoder().encode('{"titre":"進撃の巨人"}');
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        // Coupé au milieu d'un caractère
        controller.enqueue(encoded.slice(0, 12));
        controller.enqueue(encoded.slice(12));
        controller.close();
      },
    });
    page.fetch = vi.fn<typeof fetch>(() => Promise.resolve(new Response(body)));
    const onPayload = vi.fn((request: string, raw: unknown): string | null => `${request}:${JSON.stringify(raw)}`);
    installPassiveBridge(spec(1, onPayload));
    await window.fetch('/lu/titre');
    await flushPorts();
    expect(onPayload).toHaveBeenCalledWith('titre', { titre: '進撃の巨人' });
  });

  it('fetch : adresse en URL ou en Request lue comme une chaîne ; XHR ouvert sans adresse lisible : jamais lu', async () => {
    const onPayload = vi.fn((request: string, raw: unknown): string | null => `${request}:${JSON.stringify(raw)}`);
    installPassiveBridge(spec(1, onPayload));
    await window.fetch(new URL('https://site.example/lu/url'));
    await window.fetch(new Request('https://site.example/lu/requete'));
    const xhr = new XMLHttpRequest() as unknown as FakeXhr;
    xhr.responseText = '{}';
    xhr.open('GET', 42);
    xhr.send();
    await flushPorts();
    expect(onPayload.mock.calls.map(([request]) => request)).toEqual(['url', 'requete']);
  });

  it('fetch : réponse 200 sans corps lue comme illisible (null)', async () => {
    page.fetch = vi.fn<typeof fetch>(() => Promise.resolve(new Response(null, { status: 200 })));
    const onPayload = vi.fn((request: string, raw: unknown): string | null => `${request}:${JSON.stringify(raw)}`);
    installPassiveBridge(spec(1, onPayload));
    await window.fetch('/lu/vide');
    await flushPorts();
    expect(onPayload).toHaveBeenCalledWith('vide', null);
  });

  it('fetch : réponse en échec (500) jamais lue', async () => {
    page.fetch = vi.fn<typeof fetch>(() => Promise.resolve(new Response('{"a":1}', { status: 500 })));
    const onPayload = vi.fn((request: string, raw: unknown): string | null => `${request}:${JSON.stringify(raw)}`);
    installPassiveBridge(spec(1, onPayload));
    const response = await window.fetch('/lu/echec');
    await flushPorts();
    expect(response.status).toBe(500);
    expect(onPayload).not.toHaveBeenCalled();
  });

  it('fetch : requête rejetée (réseau coupé) : le site reçoit son erreur, rien n’est lu ni levé par le pont', async () => {
    page.fetch = vi.fn<typeof fetch>(() => Promise.reject(new TypeError('Failed to fetch')));
    const onPayload = vi.fn((request: string, raw: unknown): string | null => `${request}:${JSON.stringify(raw)}`);
    installPassiveBridge(spec(1, onPayload));
    await expect(window.fetch('/lu/rejet')).rejects.toBeInstanceOf(TypeError);
    await flushPorts();
    expect(onPayload).not.toHaveBeenCalled();
  });

  it(`demande d’ouverture qui n’est pas un CustomEvent : ignorée, aucun port offert`, () => {
    installPassiveBridge(spec(1));
    page.dispatchEvent(new Event('test:hello'));
    expect(page.postMessage).not.toHaveBeenCalled();
  });

  it(`demandes d’ouverture : ${MAX_BRIDGE_PORTS} canaux au plus, offre postée à l’origine de la page, instantané à l’ouverture`, async () => {
    installPassiveBridge({ ...spec(1), snapshot: () => 'instantané' });
    const all = Array.from({ length: MAX_BRIDGE_PORTS + 2 }, (_, i) => connect(`1:n${i}`));
    page.dispatchEvent(new CustomEvent('test:hello', { detail: '9:autre' }));
    expect(page.postMessage).toHaveBeenCalledTimes(MAX_BRIDGE_PORTS + 2);
    expect(page.postMessage.mock.calls[0]?.slice(0, 2)).toEqual(['offre:1:n0', 'https://site.example']);
    siteXhr('/lu/x', '{}');
    await flushPorts();
    // Les deux plus anciens canaux sont fermés : plus rien ne leur parvient
    expect(all.map((messages) => messages.includes('1:x:{}'))).toEqual([false, false, true, true, true, true]);
    expect(all.at(-1)).toEqual(['instantané', '1:x:{}']);
  });
});
