import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  FRIEREN_S1,
  FRIEREN_S2,
  FRIEREN_SERIES_ID,
  episodesUrl,
  frierenEpisodeId,
  frierenEpisodes,
  frierenSeasons,
  frierenSeries,
  frierenUpNext,
  seasonsUrl,
  seriesUrl,
  upNextUrl,
} from '../../shared/__fixtures__/crunchyroll-cms';
import { crunchyrollTableSignals } from '../../platforms/crunchyroll/metadata';
import {
  CRUNCHYROLL_BRIDGE_VERSION,
  CRUNCHYROLL_HANDSHAKE_EVENT,
  CRUNCHYROLL_MAX_PUSH_LENGTH,
  decodeCrunchyrollPush,
  encodeCrunchyrollHandshake,
  encodeCrunchyrollPortOffer,
  observedCrunchyrollRequest,
  type ReceivedCrunchyrollTable,
} from './bridge-protocol';
import { flushPorts } from '../../test/ports';

// Pont MAIN de Crunchyroll : observateur passif des réponses du site (fetch, XMLHttpRequest), exécuté sur une fausse
// page (Node : ni DOM ni XHR).

/** Jeton fictif porté par les requêtes du site (en-tête), qui ne doit jamais apparaître dans ce que le pont transmet */
const TOKEN = 'Bearer SECRET-TOKEN';

class FakeXhr extends EventTarget {
  static opened: unknown[][] = [];
  static headers: string[][] = [];
  status = 0;
  responseType: XMLHttpRequestResponseType = '';
  responseText = '';
  response: unknown = null;
  reply: { status: number; body: unknown } = { status: 200, body: null };

  open(...args: unknown[]): void {
    FakeXhr.opened.push(args);
  }

  setRequestHeader(name: string, value: string): void {
    FakeXhr.headers.push([name, value]);
  }

  send(): void {
    this.status = this.reply.status;
    if (this.responseType === 'json') this.response = this.reply.body;
    else this.responseText = typeof this.reply.body === 'string' ? this.reply.body : JSON.stringify(this.reply.body);
    // Réponse annulée par `abort` avant son arrivée : jamais livrée (comme un vrai XMLHttpRequest)
    const sent = this.aborts;
    queueMicrotask(() => {
      if (sent === this.aborts) this.dispatchEvent(new Event('load'));
    });
  }

  aborts = 0;

  abort(): void {
    this.aborts++;
  }
}

type PostMessage = (message: string, origin: string, transfer: MessagePort[]) => void;
type FakeWindow = EventTarget & { postMessage: ReturnType<typeof vi.fn<PostMessage>>; fetch: typeof fetch };

let page: FakeWindow;
const originalOpen = FakeXhr.prototype.open;
const originalSend = FakeXhr.prototype.send;
const received: MessagePort[] = [];
let fetchReplies = new Map<string, unknown>();
let siteFetch: ReturnType<typeof vi.fn<typeof fetch>>;

async function runBridge(): Promise<void> {
  vi.resetModules();
  await import('./page-bridge.iife');
}

/** Ouvre le canal comme le client isolé ; tables reçues sur le port, dans l'ordre */
function connect(nonce = 'n1'): ReceivedCrunchyrollTable[][] {
  const pushes: ReceivedCrunchyrollTable[][] = [];
  page.dispatchEvent(new CustomEvent(CRUNCHYROLL_HANDSHAKE_EVENT, { detail: encodeCrunchyrollHandshake(nonce) }));
  const call = page.postMessage.mock.calls.at(-1);
  if (!call) throw new Error('aucune offre de port');
  expect(call[0]).toBe(encodeCrunchyrollPortOffer(nonce));
  const [port] = call[2];
  if (!port) throw new Error('aucun port');
  received.push(port);
  port.addEventListener('message', (event) => {
    const data: unknown = event.data;
    expect(data).not.toContain('SECRET');
    pushes.push(decodeCrunchyrollPush(data));
  });
  port.start();
  return pushes;
}

/** Ouvre le canal (demande de la version courante) ; messages bruts reçus sur le dernier port offert */
function connectRaw(nonce: string): unknown[] {
  const messages: unknown[] = [];
  page.dispatchEvent(new CustomEvent(CRUNCHYROLL_HANDSHAKE_EVENT, { detail: encodeCrunchyrollHandshake(nonce) }));
  const port = page.postMessage.mock.calls.at(-1)?.[2][0];
  if (!port) throw new Error('aucun port');
  received.push(port);
  port.addEventListener('message', (event) => messages.push(event.data));
  port.start();
  return messages;
}

function siteXhr(url: string, body: unknown, { status = 200, responseType = '' }: { status?: number; responseType?: XMLHttpRequestResponseType } = {}): void {
  const xhr = new XMLHttpRequest() as unknown as FakeXhr;
  xhr.reply = { status, body };
  xhr.responseType = responseType;
  xhr.open('GET', url);
  xhr.setRequestHeader('authorization', TOKEN);
  xhr.send();
}

async function siteFetchJson(url: string, body: unknown): Promise<void> {
  fetchReplies.set(url, body);
  await window.fetch(url, { headers: { authorization: TOKEN } });
}

const lastTable = (pushes: ReceivedCrunchyrollTable[][], seriesId = FRIEREN_SERIES_ID): unknown =>
  pushes.flat().filter((entry) => entry.seriesId === seriesId).at(-1)?.table ?? null;

beforeEach(() => {
  FakeXhr.prototype.open = originalOpen;
  FakeXhr.prototype.send = originalSend;
  FakeXhr.opened = [];
  FakeXhr.headers = [];
  fetchReplies = new Map();
  siteFetch = vi.fn<typeof fetch>((input) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    return Promise.resolve(new Response(JSON.stringify(fetchReplies.get(url) ?? {}), { status: 200 }));
  });
  page = Object.assign(new EventTarget(), { postMessage: vi.fn<PostMessage>(), fetch: siteFetch });
  Reflect.deleteProperty(globalThis, Symbol.for(`synckai.crunchyroll.bridge.v${CRUNCHYROLL_BRIDGE_VERSION}`));
  vi.stubGlobal('window', page);
  vi.stubGlobal('XMLHttpRequest', FakeXhr);
  vi.stubGlobal('location', { origin: 'https://www.crunchyroll.com', href: `https://www.crunchyroll.com/fr/series/${FRIEREN_SERIES_ID}/frieren` });
});

afterEach(() => {
  for (const port of received.splice(0)) port.close();
  vi.unstubAllGlobals();
});

describe('observedCrunchyrollRequest', () => {
  /** Adresse de la page (base des URL relatives, passée par le kit) */
  const PAGE = 'https://www.crunchyroll.com/fr/series/GG5H5XQ7D/frieren';

  it('quatre chemins lus, paramètres ignorés ; tout le reste ignoré sans être lu', () => {
    expect(observedCrunchyrollRequest(seriesUrl(), PAGE)).toEqual({ kind: 'series', seriesId: FRIEREN_SERIES_ID });
    expect(observedCrunchyrollRequest(seasonsUrl(), PAGE)).toEqual({ kind: 'seasons', seriesId: FRIEREN_SERIES_ID });
    expect(observedCrunchyrollRequest(episodesUrl(FRIEREN_S1), PAGE)).toEqual({ kind: 'episodes', seasonId: FRIEREN_S1 });
    expect(observedCrunchyrollRequest(upNextUrl(), PAGE)).toEqual({ kind: 'upNext', seriesId: FRIEREN_SERIES_ID });
    for (const url of [
      'https://www.crunchyroll.com/auth/v1/token',
      'https://www.crunchyroll.com/content/v2/0123-account/watch-history',
      `https://www.crunchyroll.com/content/v2/cms/objects/${frierenEpisodeId(1, 1)}`,
      `https://www.crunchyroll.com/content/v2/cms/seasons/${FRIEREN_S1}`,
      'https://www.crunchyroll.com/playback/v2/GFRIER0101/web/chrome/play',
      `https://evil.example/content/v2/cms/series/${FRIEREN_SERIES_ID}`,
      `http://www.crunchyroll.com/content/v2/cms/series/${FRIEREN_SERIES_ID}`,
    ]) {
      expect(observedCrunchyrollRequest(url, PAGE)).toBeNull();
    }
  });

  it('chemin relatif lu par rapport à la page ; casse ignorée ; autres combinaisons de la collection et de la sous-ressource ignorées', () => {
    expect(observedCrunchyrollRequest(`/content/v2/cms/series/${FRIEREN_SERIES_ID}/seasons?locale=fr-FR`, PAGE)).toEqual({ kind: 'seasons', seriesId: FRIEREN_SERIES_ID });
    expect(observedCrunchyrollRequest(`/content/v2/cms/series/${FRIEREN_SERIES_ID}`, 'https://evil.example/')).toBeNull();
    expect(observedCrunchyrollRequest(`https://www.crunchyroll.com/Content/V2/CMS/Series/${FRIEREN_SERIES_ID}/`, PAGE)).toEqual({ kind: 'series', seriesId: FRIEREN_SERIES_ID });
    expect(observedCrunchyrollRequest(`https://www.crunchyroll.com/content/v2/cms/Seasons/${FRIEREN_S1}/Episodes`, PAGE)).toEqual({ kind: 'episodes', seasonId: FRIEREN_S1 });
    for (const path of [`series/${FRIEREN_SERIES_ID}/episodes`, `seasons/${FRIEREN_S1}/seasons`, `seasons/${FRIEREN_S1}`]) {
      expect(observedCrunchyrollRequest(`https://www.crunchyroll.com/content/v2/cms/${path}`, PAGE)).toBeNull();
    }
    expect(observedCrunchyrollRequest('https://[invalide', PAGE)).toBeNull();
  });
});

describe('decodeCrunchyrollPush', () => {
  it('message borné comme ceux des autres ponts : au-delà de la borne, rien n’est lu ; autre chose qu’une chaîne ignoré', () => {
    const message = JSON.stringify({ v: CRUNCHYROLL_BRIDGE_VERSION, tables: [{ seriesId: 'GOTHER1' }] });
    const padded = (length: number): string => message + ' '.repeat(length - message.length);
    expect(decodeCrunchyrollPush(padded(CRUNCHYROLL_MAX_PUSH_LENGTH)).map((entry) => entry.seriesId)).toEqual(['GOTHER1']);
    expect(decodeCrunchyrollPush(padded(CRUNCHYROLL_MAX_PUSH_LENGTH + 1))).toEqual([]);
    expect(decodeCrunchyrollPush({ v: CRUNCHYROLL_BRIDGE_VERSION, tables: [{ seriesId: 'GOTHER1' }] })).toEqual([]);
    expect(decodeCrunchyrollPush('{pas du json')).toEqual([]);
  });
});

describe('page-bridge.iife.ts (Crunchyroll)', () => {
  it('réponses vues avant l’ouverture du canal : instantané (table des signaux), sans en-tête ni jeton ; requêtes intactes', async () => {
    await runBridge();
    await siteFetchJson(seriesUrl(), frierenSeries());
    siteXhr(seasonsUrl(), frierenSeasons());
    siteXhr(episodesUrl(FRIEREN_S2), frierenEpisodes(2, 10, { firstAirDate: '2026-01-16' }), { responseType: 'json' });
    await flushPorts();
    const pushes = connect();
    await flushPorts();
    expect(pushes).toHaveLength(1);
    const table = lastTable(pushes);
    expect(crunchyrollTableSignals(table, { episodeId: frierenEpisodeId(2, 3), seasonNumber: 2 })).toEqual({
      seasonYear: 2026,
      seasonEpisodeCount: 10,
      episodeMinutes: 26,
      format: 'series',
      country: 'JP',
    });
    // Saison 1 sans épisodes vus : année de la série
    expect(crunchyrollTableSignals(table, { seasonNumber: 1 })).toMatchObject({ seriesYear: 2023, seasonEpisodeCount: 28 });
    // Requêtes du site transmises telles quelles, en-têtes compris, aucune ajoutée
    expect(FakeXhr.opened).toEqual([
      ['GET', seasonsUrl()],
      ['GET', episodesUrl(FRIEREN_S2)],
    ]);
    expect(FakeXhr.headers).toEqual([
      ['authorization', TOKEN],
      ['authorization', TOKEN],
    ]);
    expect(siteFetch).toHaveBeenCalledOnce();
  });

  it('épisodes reçus avant la liste des saisons : rattachés à leur saison dès que la série la liste', async () => {
    await runBridge();
    const pushes = connect();
    siteXhr(episodesUrl(FRIEREN_S1), frierenEpisodes(1, 28));
    await flushPorts();
    expect(pushes).toEqual([]);
    siteXhr(seasonsUrl(), frierenSeasons());
    await flushPorts();
    expect(crunchyrollTableSignals(lastTable(pushes), { episodeId: frierenEpisodeId(1, 5, true), seasonNumber: 1 })).toMatchObject({ seasonYear: 2023, seasonEpisodeCount: 28 });
  });

  it('épisode suggéré : complète une saison sans liste, ne remplace jamais une liste complète', async () => {
    await runBridge();
    const pushes = connect();
    siteXhr(seasonsUrl(), frierenSeasons());
    siteXhr(upNextUrl(), frierenUpNext(FRIEREN_S2, 3));
    await flushPorts();
    expect(crunchyrollTableSignals(lastTable(pushes), { episodeId: frierenEpisodeId(2, 3), seasonNumber: 2 })).toEqual({
      seasonEpisodeCount: 10,
      episodeMinutes: 25,
      format: 'series',
      country: 'JP',
    });
    siteXhr(episodesUrl(FRIEREN_S2), frierenEpisodes(2, 10, { firstAirDate: '2026-01-16' }));
    siteXhr(upNextUrl(), frierenUpNext(FRIEREN_S2, 4));
    await flushPorts();
    expect(crunchyrollTableSignals(lastTable(pushes), { seasonNumber: 2 })).toMatchObject({ seasonYear: 2026, episodeMinutes: 26 });
  });

  it('erreurs HTTP, réponses illisibles, autre série : ignorées ou tenues à part', async () => {
    await runBridge();
    const pushes = connect();
    siteXhr(seasonsUrl(), frierenSeasons(), { status: 401 });
    siteXhr(seriesUrl(), '{pas du json');
    siteXhr(episodesUrl(FRIEREN_S1), '<!doctype html>');
    await flushPorts();
    expect(pushes).toEqual([]);
    siteXhr(seasonsUrl('GOTHER1'), frierenSeasons());
    await flushPorts();
    expect(pushes.flat().map((entry) => entry.seriesId)).toEqual(['GOTHER1']);
  });

  it('XHR réutilisé (abort puis open) : la réponse est attribuée à la dernière requête ouverte, jamais à l’annulée', async () => {
    await runBridge();
    const pushes = connect();
    const xhr = new XMLHttpRequest() as unknown as FakeXhr;
    xhr.reply = { status: 200, body: frierenSeries() };
    xhr.open('GET', seriesUrl());
    xhr.send();
    xhr.abort();
    xhr.open('GET', seriesUrl('GOTHER1'));
    xhr.send();
    await flushPorts();
    expect(pushes.flat().map((entry) => entry.seriesId)).toEqual(['GOTHER1']);
    // Réutilisé pour une requête non lue : rien
    xhr.open('GET', seriesUrl('GOTHER2'));
    xhr.send();
    xhr.abort();
    xhr.open('GET', 'https://www.crunchyroll.com/auth/v1/token');
    xhr.send();
    await flushPorts();
    expect(pushes.flat().map((entry) => entry.seriesId)).toEqual(['GOTHER1']);
  });

  it('nouvelle version réexécutée sans rechargement (mise à jour) : fetch / XHR enveloppés une seule fois, l’ancienne version ne reçoit plus rien (2-R3)', async () => {
    await runBridge();
    const before = connectRaw('ancien');
    const wrapped = { open: FakeXhr.prototype.open, send: FakeXhr.prototype.send, fetch: window.fetch };
    // Version suivante (autre garde), réinjectée dans la même page comme après une mise à jour
    vi.doMock('./bridge-protocol', async (importOriginal) => ({ ...(await importOriginal<typeof import('./bridge-protocol')>()), CRUNCHYROLL_BRIDGE_VERSION: CRUNCHYROLL_BRIDGE_VERSION + 1 }));
    await runBridge();
    vi.doUnmock('./bridge-protocol');
    expect(FakeXhr.prototype.open).toBe(wrapped.open);
    expect(FakeXhr.prototype.send).toBe(wrapped.send);
    expect(window.fetch).toBe(wrapped.fetch);
    // Dernière offre : celle du pont le plus récent (écouteurs en capture, dans l'ordre d'installation)
    const after = connectRaw('nouveau');
    siteXhr(seasonsUrl(), frierenSeasons());
    await siteFetchJson(seriesUrl(), frierenSeries());
    await flushPorts();
    expect(before).toEqual([]);
    expect(after).toHaveLength(2);
    expect(siteFetch).toHaveBeenCalledOnce();
  });

  it('propriétés héritées polluées par la page (Object.prototype) : jamais lues par les réductions (SEC-05)', async () => {
    await runBridge();
    const pushes = connect();
    Reflect.defineProperty(Object.prototype, 'series_launch_year', { value: 1999, configurable: true });
    try {
      siteXhr(seriesUrl(), frierenSeries({ series_launch_year: undefined }));
      siteXhr(seasonsUrl(), frierenSeasons(), { responseType: 'json' });
      await flushPorts();
    } finally {
      Reflect.deleteProperty(Object.prototype, 'series_launch_year');
    }
    expect(crunchyrollTableSignals(lastTable(pushes), { seasonNumber: 1 })).not.toHaveProperty('seriesYear');
  });

  it('réexécuté dans la page (même version) : une seule observation ; demande d’une autre version ignorée', async () => {
    await runBridge();
    const patchedOpen = FakeXhr.prototype.open;
    await runBridge();
    expect(FakeXhr.prototype.open).toBe(patchedOpen);
    page.dispatchEvent(new CustomEvent(CRUNCHYROLL_HANDSHAKE_EVENT, { detail: `${CRUNCHYROLL_BRIDGE_VERSION + 1}:n0` }));
    expect(page.postMessage).not.toHaveBeenCalled();
    connect();
    expect(page.postMessage).toHaveBeenCalledOnce();
  });
});
