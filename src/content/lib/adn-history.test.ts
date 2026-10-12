import { afterEach, describe, expect, it, vi } from 'vitest';
import { ADN_HISTORY_VIDEOS } from '../../shared/__fixtures__/adn-history';
import { ADN_HISTORY_PORT_NAME, MAX_ADN_HISTORY_PAGES, type AdnHistoryPortMessage } from '../../shared/adn-history';
import { isAdnHistoryPortMessage } from '../../shared/adn-import';
import { ADN_HISTORY_URL, ADN_RETRY_DELAYS_MS, adnHeaders, listenAdnHistoryPorts, readAdnHistory, type AdnReaderDeps } from './adn-history';
import { CrHistoryError } from './crunchyroll-history';
import type { FetchLike } from './page-fetch';

/** Jeton fictif au format JWT (jamais un vrai) */
const TOKEN = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ0ZXN0In0.c2lnbmF0dXJlLWZpY3RpdmU';

const storage = (values: Record<string, string>): Pick<Storage, 'getItem'> => ({ getItem: (key) => values[key] ?? null });

const json = (status: number, body: unknown): Response => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

interface Call {
  url: string;
  init: RequestInit | undefined;
}

/** API simulée : `total` épisodes servis par pages (offset / limit), statut forcé par appel */
function fakeAdn(total: number, status: (call: number) => number | null = () => null): { fetch: FetchLike; calls: Call[] } {
  const calls: Call[] = [];
  const fetch: FetchLike = (url, init) => {
    calls.push({ url, init });
    const forced = status(calls.length);
    if (forced !== null) return Promise.resolve(json(forced, { message: 'refusé' }));
    const query = new URL(url).searchParams;
    const offset = Number(query.get('offset'));
    const limit = Number(query.get('limit'));
    const videos = Array.from({ length: Math.max(0, Math.min(limit, total - offset)) }, (_, i) => ({ ...ADN_HISTORY_VIDEOS[i % ADN_HISTORY_VIDEOS.length], id: offset + i + 1 }));
    return Promise.resolve(json(200, { videos }));
  };
  return { fetch, calls };
}

function deps(fetch: FetchLike, sleeps: number[] = []): AdnReaderDeps {
  return {
    fetch,
    headers: adnHeaders(storage({ token: TOKEN })) ?? {},
    sleep: async (ms) => void sleeps.push(ms),
    signal: new AbortController().signal,
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('en-têtes de la requête ADN (localStorage du site)', () => {
  it('reprend exactement les en-têtes du site : jeton, profil, distribution', () => {
    expect(adnHeaders(storage({ token: TOKEN, profile: JSON.stringify({ id: 3, name: 'Moi' }), distribution: 'de' }))).toEqual({
      accept: 'application/json',
      authorization: `Bearer ${TOKEN}`,
      'x-profile-id': '3',
      'x-target-distribution': 'de',
      'accept-language': 'de',
      'x-i18n-platform': '1',
      'x-source': 'Web',
    });
  });

  it('valeurs JSON ou brutes ; profil et distribution absents ou illisibles : 1 / fr', () => {
    expect(adnHeaders(storage({ token: JSON.stringify(TOKEN), profile: '2', distribution: '"fr"' }))).toMatchObject({ authorization: `Bearer ${TOKEN}`, 'x-profile-id': '2', 'x-target-distribution': 'fr' });
    expect(adnHeaders(storage({ token: `Bearer ${TOKEN}` }))).toMatchObject({ authorization: `Bearer ${TOKEN}`, 'x-profile-id': '1', 'x-target-distribution': 'fr', 'accept-language': 'fr' });
    expect(adnHeaders(storage({ token: TOKEN, profile: '{"profileId":5}', distribution: 'FRANCE' }))).toMatchObject({ 'x-profile-id': '5', 'x-target-distribution': 'fr' });
    expect(adnHeaders(storage({ token: TOKEN, profile: '{"id":"<b>"}' }))).toMatchObject({ 'x-profile-id': '1' });
  });

  it('sans jeton lisible (déconnecté) : null ; jamais de cookie ni d’en-tête de suivi', () => {
    expect(adnHeaders(storage({}))).toBeNull();
    expect(adnHeaders(storage({ token: 'null' }))).toBeNull();
    expect(adnHeaders(storage({ token: 'pas-un-jwt' }))).toBeNull();
    expect(adnHeaders(storage({ refresh_token: TOKEN }))).toBeNull();
    expect(Object.keys(adnHeaders(storage({ token: TOKEN })) ?? {})).not.toEqual(expect.arrayContaining(['cookie']));
  });
});

describe('lecture paginée de l’historique ADN', () => {
  it('pages de 100 jusqu’à une page incomplète, sans cookies, avec les en-têtes du site', async () => {
    const { fetch, calls } = fakeAdn(230);
    const pages: [number, number][] = [];
    const result = await readAdnHistory(deps(fetch), (page, items) => pages.push([page, items]));
    expect(calls.map((c) => c.url)).toEqual([0, 100, 200].map((offset) => `${ADN_HISTORY_URL}?offset=${offset}&limit=100&onlyNext=false`));
    for (const { init } of calls) {
      expect(init?.credentials).toBe('omit');
      expect(init?.headers).toMatchObject({ authorization: `Bearer ${TOKEN}`, 'x-source': 'Web' });
    }
    expect(pages).toEqual([
      [1, 100],
      [2, 200],
      [3, 230],
    ]);
    expect(result.stats).toEqual({ items: 230, pages: 3, partial: false });
    expect(result.videos).toHaveLength(230);
  });

  it('page vide : fin de l’historique', async () => {
    const { fetch, calls } = fakeAdn(200);
    expect((await readAdnHistory(deps(fetch), () => undefined)).stats).toEqual({ items: 200, pages: 3, partial: false });
    expect(calls).toHaveLength(3);
  });

  it('garde-fou : au plus MAX_ADN_HISTORY_PAGES pages, historique déclaré partiel', async () => {
    const { fetch, calls } = fakeAdn(1_000_000);
    const result = await readAdnHistory(deps(fetch), () => undefined);
    expect(calls).toHaveLength(MAX_ADN_HISTORY_PAGES);
    expect(result.stats).toMatchObject({ pages: MAX_ADN_HISTORY_PAGES, partial: true });
  });

  it('ne garde que les champs utiles (rien du compte : user.id)', async () => {
    const { fetch } = fakeAdn(1);
    const [video] = (await readAdnHistory(deps(fetch), () => undefined)).videos;
    expect(video).toEqual({
      id: 1,
      name: 'Épisode 2',
      shortNumber: '2',
      season: '1',
      duration: 1421,
      urlPath: '/video/1428-even-the-student-council-has-its-holes/30016-episode-2',
      user: { stoptime: 16, watchDate: '2026-10-12T19:40:00.000Z', isFullyWatched: false },
      show: { id: 1428, title: 'Even the Student Council Has Its Holes!', urlPath: '/video/1428-even-the-student-council-has-its-holes' },
    });
  });

  it.each([
    [400, 'unavailable'],
    [401, 'logged-out'],
    [403, 'logged-out'],
    [404, 'unavailable'],
  ] as const)('HTTP %i → %s, sans nouvel essai', async (status, code) => {
    const { fetch, calls } = fakeAdn(10, () => status);
    await expect(readAdnHistory(deps(fetch), () => undefined)).rejects.toMatchObject({ code });
    expect(calls).toHaveLength(1);
  });

  it('429 / 5xx : nouveaux essais espacés, puis « bloqué » si le refus persiste', async () => {
    const sleeps: number[] = [];
    const { fetch, calls } = fakeAdn(10, () => 429);
    await expect(readAdnHistory(deps(fetch, sleeps), () => undefined)).rejects.toMatchObject({ code: 'blocked' });
    expect(calls).toHaveLength(ADN_RETRY_DELAYS_MS.length + 1);
    expect(sleeps).toEqual([300, ...ADN_RETRY_DELAYS_MS]);

    const flaky = fakeAdn(10, (call) => (call === 1 ? 503 : null));
    expect((await readAdnHistory(deps(flaky.fetch), () => undefined)).stats.items).toBe(10);
  });

  it('coupure réseau persistante : « network » ; réponse inattendue : « unavailable »', async () => {
    const offline: FetchLike = () => Promise.reject(new TypeError('Failed to fetch'));
    await expect(readAdnHistory(deps(offline), () => undefined)).rejects.toMatchObject({ code: 'network' });
    const odd: FetchLike = () => Promise.resolve(json(200, { data: [] }));
    await expect(readAdnHistory(deps(odd), () => undefined)).rejects.toBeInstanceOf(CrHistoryError);
    const html: FetchLike = () => Promise.resolve(new Response('<html>', { status: 200 }));
    await expect(readAdnHistory(deps(html), () => undefined)).rejects.toMatchObject({ code: 'unavailable' });
  });
});

describe('port de la page d’import (onglet ADN)', () => {
  /** Script de contenu sur une page ADN simulée ; port ouvert par la page d'import */
  async function read(options: { hostname?: string; localStorage?: Record<string, string>; fetch: FetchLike }): Promise<{ messages: AdnHistoryPortMessage[]; logs: unknown[][] }> {
    let onConnect: ((port: chrome.runtime.Port) => void) | null = null;
    vi.stubGlobal('chrome', {
      runtime: { id: 'synckai', getURL: (path: string) => `chrome-extension://synckai/${path}`, onConnect: { addListener: (fn: (port: chrome.runtime.Port) => void) => (onConnect = fn) } },
    });
    vi.stubGlobal('location', { hostname: options.hostname ?? 'animationdigitalnetwork.com' });
    vi.stubGlobal('localStorage', storage(options.localStorage ?? { token: TOKEN, profile: '{"id":1}', distribution: 'fr' }));
    vi.stubGlobal('window', { fetch: options.fetch });
    const logs: unknown[][] = [];
    for (const level of ['debug', 'info', 'warn', 'error'] as const) vi.spyOn(console, level).mockImplementation((...args: unknown[]) => void logs.push(args));
    listenAdnHistoryPorts();

    const messages: AdnHistoryPortMessage[] = [];
    let onMessage: ((message: unknown) => void) | null = null;
    const finished = new Promise<void>((resolve) => {
      const port = {
        name: ADN_HISTORY_PORT_NAME,
        sender: { id: 'synckai', url: 'chrome-extension://synckai/src/import-cr/import-cr.html' },
        postMessage: (message: unknown) => {
          if (!isAdnHistoryPortMessage(message)) throw new Error('message invalide');
          messages.push(message);
          if (message.type !== 'progress') resolve();
        },
        onMessage: { addListener: (fn: (message: unknown) => void) => (onMessage = fn), removeListener: () => undefined },
        onDisconnect: { addListener: () => undefined },
      };
      if (!onConnect) throw new Error('aucun écouteur');
      (onConnect as (port: chrome.runtime.Port) => void)(port as unknown as chrome.runtime.Port);
    });
    if (!onMessage) throw new Error('aucun écouteur de message');
    (onMessage as (message: unknown) => void)({ type: 'READ_ADN_HISTORY' });
    await finished;
    return { messages, logs };
  }

  it('lit l’historique et renvoie les épisodes ; le jeton ne sort jamais de l’onglet (ni messages ni journal)', async () => {
    const { fetch } = fakeAdn(3);
    const { messages, logs } = await read({ fetch });
    expect(messages.map((m) => m.type)).toEqual(['progress', 'done']);
    expect(JSON.stringify(messages)).not.toContain(TOKEN.split('.')[2]);
    expect(JSON.stringify(logs)).not.toContain(TOKEN.split('.')[2]);
  });

  it('jeton refusé (401) : « logged-out », sans le jeton dans le journal', async () => {
    const { fetch } = fakeAdn(3, () => 401);
    const { messages, logs } = await read({ fetch });
    expect(messages).toEqual([{ type: 'error', code: 'logged-out' }]);
    expect(logs.length).toBeGreaterThan(0);
    expect(JSON.stringify(logs)).not.toContain(TOKEN.split('.')[2]);
  });

  it('sans jeton (déconnecté) : « logged-out », aucune requête', async () => {
    const { fetch, calls } = fakeAdn(3);
    expect((await read({ fetch, localStorage: {} })).messages).toEqual([{ type: 'error', code: 'logged-out' }]);
    expect(calls).toHaveLength(0);
  });

  it('autre site que animationdigitalnetwork.com : « wrong-page »', async () => {
    const { fetch, calls } = fakeAdn(3);
    expect((await read({ fetch, hostname: 'gw.api.animationdigitalnetwork.com' })).messages).toEqual([{ type: 'error', code: 'wrong-page' }]);
    expect(calls).toHaveLength(0);
  });
});
