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
import { crunchyrollTableSignals } from '../../shared/crunchyroll-metadata';
import {
  CRUNCHYROLL_BRIDGE_VERSION,
  CRUNCHYROLL_HANDSHAKE_EVENT,
  decodeCrunchyrollPush,
  encodeCrunchyrollHandshake,
  encodeCrunchyrollPortOffer,
  observedCrunchyrollRequest,
  type ReceivedCrunchyrollTable,
} from './bridge-protocol';

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
    queueMicrotask(() => this.dispatchEvent(new Event('load')));
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
    const data: unknown = (event as MessageEvent).data;
    expect(data).not.toContain('SECRET');
    pushes.push(decodeCrunchyrollPush(data));
  });
  port.start();
  return pushes;
}

function siteXhr(url: string, body: unknown, { status = 200, responseType = '' as XMLHttpRequestResponseType } = {}): void {
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

const flush = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 10));
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
  it('quatre chemins lus, paramètres ignorés ; tout le reste ignoré sans être lu', () => {
    expect(observedCrunchyrollRequest(seriesUrl())).toEqual({ kind: 'series', seriesId: FRIEREN_SERIES_ID });
    expect(observedCrunchyrollRequest(seasonsUrl())).toEqual({ kind: 'seasons', seriesId: FRIEREN_SERIES_ID });
    expect(observedCrunchyrollRequest(episodesUrl(FRIEREN_S1))).toEqual({ kind: 'episodes', seasonId: FRIEREN_S1 });
    expect(observedCrunchyrollRequest(upNextUrl())).toEqual({ kind: 'upNext', seriesId: FRIEREN_SERIES_ID });
    for (const url of [
      'https://www.crunchyroll.com/auth/v1/token',
      'https://www.crunchyroll.com/content/v2/0123-account/watch-history',
      `https://www.crunchyroll.com/content/v2/cms/objects/${frierenEpisodeId(1, 1)}`,
      `https://www.crunchyroll.com/content/v2/cms/seasons/${FRIEREN_S1}`,
      'https://www.crunchyroll.com/playback/v2/GFRIER0101/web/chrome/play',
      `https://evil.example/content/v2/cms/series/${FRIEREN_SERIES_ID}`,
      `http://www.crunchyroll.com/content/v2/cms/series/${FRIEREN_SERIES_ID}`,
    ]) {
      expect(observedCrunchyrollRequest(url)).toBeNull();
    }
  });
});

describe('page-bridge.iife.ts (Crunchyroll)', () => {
  it('réponses vues avant l’ouverture du canal : instantané (table des signaux), sans en-tête ni jeton ; requêtes intactes', async () => {
    await runBridge();
    await siteFetchJson(seriesUrl(), frierenSeries());
    siteXhr(seasonsUrl(), frierenSeasons());
    siteXhr(episodesUrl(FRIEREN_S2), frierenEpisodes(2, 10, { firstAirDate: '2026-01-16' }), { responseType: 'json' });
    await flush();
    const pushes = connect();
    await flush();
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
    await flush();
    expect(pushes).toEqual([]);
    siteXhr(seasonsUrl(), frierenSeasons());
    await flush();
    expect(crunchyrollTableSignals(lastTable(pushes), { episodeId: frierenEpisodeId(1, 5, true), seasonNumber: 1 })).toMatchObject({ seasonYear: 2023, seasonEpisodeCount: 28 });
  });

  it('épisode suggéré : complète une saison sans liste, ne remplace jamais une liste complète', async () => {
    await runBridge();
    const pushes = connect();
    siteXhr(seasonsUrl(), frierenSeasons());
    siteXhr(upNextUrl(), frierenUpNext(FRIEREN_S2, 3));
    await flush();
    expect(crunchyrollTableSignals(lastTable(pushes), { episodeId: frierenEpisodeId(2, 3), seasonNumber: 2 })).toEqual({
      seasonEpisodeCount: 10,
      episodeMinutes: 25,
      format: 'series',
      country: 'JP',
    });
    siteXhr(episodesUrl(FRIEREN_S2), frierenEpisodes(2, 10, { firstAirDate: '2026-01-16' }));
    siteXhr(upNextUrl(), frierenUpNext(FRIEREN_S2, 4));
    await flush();
    expect(crunchyrollTableSignals(lastTable(pushes), { seasonNumber: 2 })).toMatchObject({ seasonYear: 2026, episodeMinutes: 26 });
  });

  it('erreurs HTTP, réponses illisibles, autre série : ignorées ou tenues à part', async () => {
    await runBridge();
    const pushes = connect();
    siteXhr(seasonsUrl(), frierenSeasons(), { status: 401 });
    siteXhr(seriesUrl(), '{pas du json');
    siteXhr(episodesUrl(FRIEREN_S1), '<!doctype html>');
    await flush();
    expect(pushes).toEqual([]);
    siteXhr(seasonsUrl('GOTHER1'), frierenSeasons());
    await flush();
    expect(pushes.flat().map((entry) => entry.seriesId)).toEqual(['GOTHER1']);
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
