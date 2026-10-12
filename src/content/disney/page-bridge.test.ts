import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { decodeDisneyPush, DISNEY_BRIDGE_VERSION, DISNEY_HANDSHAKE_EVENT, encodeDisneyHandshake, type DisneyPlayerExperience, type DisneySeriesPage } from './bridge-protocol';
import {
  nonAnimeEpisode,
  PLAYBACK_URL,
  playerExperienceUrl,
  seasonUrl,
  seriesPageUrl,
  SYNDUALITY_S1E1_AVAIL_ID,
  SYNDUALITY_S1E1_FFEC_MS,
  SYNDUALITY_S1E1_PLAY_ID,
  syndualityPlayback,
  syndualityS1E1,
  UNDEAD_UNLUCK_ENTITY_ID,
  UNDEAD_UNLUCK_S1_ID,
  undeadUnluckSeriesPage,
  UNDEAD_UNLUCK_S1E1_AVAIL_ID,
  UNDEAD_UNLUCK_S1E1_PLAY_ID,
  undeadUnluckS1E1,
  WINTER_ARC_E1_AVAIL_ID,
  WINTER_ARC_SEASON_ID,
  winterArcE1,
  winterArcSeasonResponse,
} from './fixtures';

// Pont MAIN de Disney+ : observateur passif des réponses `playerExperience` du site (XMLHttpRequest, fetch),
// exécuté sur une fausse page (Node : ni DOM ni XHR).

/** XMLHttpRequest minimal : relève les appels, la réponse est fixée par le test avant `send` */
class FakeXhr extends EventTarget {
  static opened: unknown[][] = [];
  static sent = 0;
  status = 0;
  responseType: XMLHttpRequestResponseType = '';
  responseText = '';
  response: unknown = null;
  /** Réponse livrée à `send` */
  reply: { status: number; body: unknown } = { status: 200, body: null };

  open(...args: unknown[]): void {
    FakeXhr.opened.push(args);
  }

  send(): void {
    FakeXhr.sent++;
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
/** Ports reçus par le « client » (fermés après chaque test) */
const received: MessagePort[] = [];

/** Exécute le pont comme le ferait le navigateur (nouvelle évaluation du module) */
async function runBridge(): Promise<void> {
  vi.resetModules();
  await import('./page-bridge.iife');
}

/** Pages de série reçues par le dernier client connecté, dans l'ordre */
let receivedPages: DisneySeriesPage[] = [];

/** Ouvre le canal comme le client isolé ; fiches reçues sur le port, dans l'ordre */
function connect(nonce = 'n1'): DisneyPlayerExperience[] {
  const entries: DisneyPlayerExperience[] = [];
  const pages: DisneySeriesPage[] = [];
  receivedPages = pages;
  page.dispatchEvent(new CustomEvent(DISNEY_HANDSHAKE_EVENT, { detail: encodeDisneyHandshake({ v: DISNEY_BRIDGE_VERSION, nonce }) }));
  const port = page.postMessage.mock.calls.at(-1)?.[2][0];
  if (!port) throw new Error('aucune offre de port');
  received.push(port);
  port.addEventListener('message', (event) => {
    const push = decodeDisneyPush((event as MessageEvent).data);
    entries.push(...(push?.entries ?? []));
    pages.push(...(push?.pages ?? []));
  });
  port.start();
  return entries;
}

/** Requête du site : XHR vers `url`, réponse `body` */
function siteXhr(url: string, body: unknown, { status = 200, responseType = '' as XMLHttpRequestResponseType, method = 'GET' } = {}): void {
  const xhr = new XMLHttpRequest() as unknown as FakeXhr;
  xhr.reply = { status, body };
  xhr.responseType = responseType;
  xhr.open(method, url);
  xhr.send();
}

const flush = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 10));

beforeEach(() => {
  FakeXhr.prototype.open = originalOpen;
  FakeXhr.prototype.send = originalSend;
  FakeXhr.opened = [];
  FakeXhr.sent = 0;
  page = Object.assign(new EventTarget(), {
    postMessage: vi.fn<PostMessage>(),
    fetch: vi.fn<typeof fetch>(() => Promise.resolve(new Response(JSON.stringify(winterArcE1()), { status: 200 }))),
  });
  Reflect.deleteProperty(globalThis, Symbol.for(`synckai.disney.bridge.v${DISNEY_BRIDGE_VERSION}`));
  vi.stubGlobal('window', page);
  vi.stubGlobal('XMLHttpRequest', FakeXhr);
  vi.stubGlobal('location', { origin: 'https://www.disneyplus.com', href: 'https://www.disneyplus.com/fr-fr/play/x' });
});

afterEach(() => {
  for (const port of received.splice(0)) port.close();
  vi.unstubAllGlobals();
});

describe('page-bridge.iife.ts (Disney+)', () => {
  it('réponse playerExperience observée avant l’ouverture du canal : envoyée en instantané, réduite, avec l’épisode de l’URL', async () => {
    await runBridge();
    const before = Date.now();
    siteXhr(playerExperienceUrl(UNDEAD_UNLUCK_S1E1_AVAIL_ID), undeadUnluckS1E1());
    await flush();
    const entries = connect();
    await flush();
    expect(entries.map((entry) => entry.ids)).toEqual([[UNDEAD_UNLUCK_S1E1_AVAIL_ID, UNDEAD_UNLUCK_S1E1_PLAY_ID]]);
    expect(entries[0]?.seenAt).toBeGreaterThanOrEqual(before);
    expect(JSON.stringify(entries)).not.toMatch(/playback|ripcut|EiJ1/);
    // La requête du site part telle quelle (mêmes arguments, aucune requête ajoutée)
    expect(FakeXhr.opened).toEqual([['GET', playerExperienceUrl(UNDEAD_UNLUCK_S1E1_AVAIL_ID)]]);
    expect(FakeXhr.sent).toBe(1);
  });

  it('réponse observée après l’ouverture (épisode suivant) : poussée aussitôt', async () => {
    await runBridge();
    const entries = connect();
    siteXhr(playerExperienceUrl(WINTER_ARC_E1_AVAIL_ID), winterArcE1(), { responseType: 'json' });
    await flush();
    expect(entries.map((entry) => entry.ids)).toEqual([[WINTER_ARC_E1_AVAIL_ID]]);
    // Requête par l'identifiant de l'épisode, availId différent dans la réponse : fiche gardée avec les deux
    siteXhr(playerExperienceUrl(UNDEAD_UNLUCK_S1E1_PLAY_ID), undeadUnluckS1E1());
    await flush();
    expect(entries.at(-1)?.ids).toEqual([UNDEAD_UNLUCK_S1E1_PLAY_ID, UNDEAD_UNLUCK_S1E1_AVAIL_ID]);
  });

  it('autres requêtes, erreurs HTTP ou réponses illisibles : ignorées', async () => {
    await runBridge();
    const entries = connect();
    siteXhr('https://disney.api.edge.bamgrid.com/explore/v1.21/upNext?x=1', undeadUnluckS1E1());
    siteXhr(playerExperienceUrl(UNDEAD_UNLUCK_S1E1_AVAIL_ID), undeadUnluckS1E1(), { status: 401 });
    siteXhr(playerExperienceUrl(UNDEAD_UNLUCK_S1E1_AVAIL_ID), '{pas du json');
    await flush();
    expect(entries).toEqual([]);
  });

  it('fiche non japonaise aussi transmise : le filtre « anime » est fait côté isolé', async () => {
    await runBridge();
    const entries = connect();
    const availId = '11111111-2222-4333-8444-555555555555';
    siteXhr(playerExperienceUrl(availId), nonAnimeEpisode(availId));
    await flush();
    expect(entries.map((entry) => entry.originalLanguage)).toEqual(['en']);
  });

  it('fetch (précaution) : la page reçoit la réponse originale, le pont en lit une copie', async () => {
    await runBridge();
    const entries = connect();
    const response = await window.fetch(playerExperienceUrl(WINTER_ARC_E1_AVAIL_ID));
    expect(await response.json()).toEqual(winterArcE1());
    await flush();
    expect(entries.map((entry) => entry.ids)).toEqual([[WINTER_ARC_E1_AVAIL_ID]]);
  });

  it('réexécuté dans la page (même version) : une seule observation, une seule offre par demande', async () => {
    await runBridge();
    const patchedOpen = FakeXhr.prototype.open;
    await runBridge();
    expect(FakeXhr.prototype.open).toBe(patchedOpen);
    connect();
    expect(page.postMessage).toHaveBeenCalledOnce();
  });

  it('page de série observée avant l’ouverture : instantané ; saison choisie ensuite (season/{id}) : page mise à jour poussée', async () => {
    await runBridge();
    siteXhr(seriesPageUrl(UNDEAD_UNLUCK_ENTITY_ID), undeadUnluckSeriesPage());
    await flush();
    const entries = connect();
    await flush();
    expect(entries).toEqual([]);
    expect(receivedPages.map((p) => [p.entityId, p.title, p.focusSeasonId, p.selectedSeasonId])).toEqual([[UNDEAD_UNLUCK_ENTITY_ID, 'Undead Unluck', UNDEAD_UNLUCK_S1_ID, null]]);
    expect(JSON.stringify(receivedPages)).not.toMatch(/Description|imageId|jeton|Summer Time/);

    siteXhr(seasonUrl(WINTER_ARC_SEASON_ID), winterArcSeasonResponse(), { responseType: 'json' });
    await flush();
    expect(receivedPages).toHaveLength(2);
    expect(receivedPages[1]?.selectedSeasonId).toBe(WINTER_ARC_SEASON_ID);
    expect(receivedPages[1]?.seasons[1]?.seasonNumber).toBe(99);
    // Saison d'une page jamais vue : ignorée ; aucune requête ajoutée par le pont
    siteXhr(seasonUrl('00000000-0000-4000-8000-000000000000'), winterArcSeasonResponse());
    await flush();
    expect(receivedPages).toHaveLength(2);
    expect(FakeXhr.sent).toBe(3);
  });

  describe('réponse de lecture (générique de fin)', () => {
    /** Réponse de lecture avec des URL signées et un jeton (faux) : jamais transmis */
    function playbackWithSecrets(): Record<string, unknown> {
      const raw = syndualityPlayback();
      const stream = raw.stream as Record<string, unknown>;
      return {
        ...raw,
        stream: {
          ...stream,
          sources: [{ complete: { url: 'https://vod.example.invalid/master.m3u8?sig=FAKE-SIGNATURE' } }],
          playbackRights: { ...(stream.playbackRights as Record<string, unknown>), playbackRightsContext: 'eyJGAKE.FAKE-TOKEN.FAKE' },
        },
      };
    }
    const credits = { creditsStartMs: SYNDUALITY_S1E1_FFEC_MS, upNextMs: 1434808 };

    it('fiche puis réponse de lecture (POST) : fiche repoussée avec les repères, sans URL ni jeton', async () => {
      await runBridge();
      const entries = connect();
      siteXhr(playerExperienceUrl(SYNDUALITY_S1E1_PLAY_ID), syndualityS1E1());
      await flush();
      expect(entries.map((entry) => entry.editorial)).toEqual([null]);
      siteXhr(PLAYBACK_URL, playbackWithSecrets(), { method: 'POST' });
      await flush();
      expect(entries).toHaveLength(2);
      expect(entries[1]?.ids).toEqual([SYNDUALITY_S1E1_PLAY_ID, SYNDUALITY_S1E1_AVAIL_ID]);
      expect(entries[1]?.editorial).toEqual(credits);
      expect(JSON.stringify(entries)).not.toMatch(/FAKE|sig=|eyJ|m3u8/);
      // La requête du site part telle quelle (même méthode, mêmes arguments)
      expect(FakeXhr.opened.at(-1)).toEqual(['POST', PLAYBACK_URL]);
      expect(FakeXhr.sent).toBe(2);
    });

    it('réponse de lecture avant la fiche : gardée en attente, repères joints à la fiche dès son arrivée', async () => {
      await runBridge();
      siteXhr(PLAYBACK_URL, playbackWithSecrets(), { method: 'POST', responseType: 'json' });
      await flush();
      const entries = connect();
      await flush();
      // Rien à pousser tant que la fiche manque (la réponse de lecture seule n'est jamais transmise)
      expect(entries).toEqual([]);
      siteXhr(playerExperienceUrl(SYNDUALITY_S1E1_AVAIL_ID), syndualityS1E1());
      await flush();
      expect(entries.map((entry) => entry.editorial)).toEqual([credits]);
      expect(JSON.stringify(entries)).not.toMatch(/FAKE|sig=|eyJ|m3u8/);
    });

    it('fetch (précaution) : réponse de lecture lue sur une copie ; autre vidéo : fiche inchangée', async () => {
      page.fetch = vi.fn<typeof fetch>(() => Promise.resolve(new Response(JSON.stringify(syndualityPlayback()), { status: 200 })));
      await runBridge();
      const entries = connect();
      siteXhr(playerExperienceUrl(UNDEAD_UNLUCK_S1E1_AVAIL_ID), undeadUnluckS1E1());
      await flush();
      const response = await window.fetch(PLAYBACK_URL, { method: 'POST' });
      expect(await response.json()).toEqual(syndualityPlayback());
      await flush();
      expect(entries.map((entry) => entry.editorial)).toEqual([null]);
      siteXhr(playerExperienceUrl(SYNDUALITY_S1E1_AVAIL_ID), syndualityS1E1());
      await flush();
      expect(entries.at(-1)?.editorial).toEqual(credits);
    });
  });
});
