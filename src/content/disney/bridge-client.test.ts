import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { advance, useBridgeFakeTimers } from '../../test/ports';
import { createDisneyBridgeClient, type DisneyBridgeClient, type DisneyBridgeClientOptions } from './bridge-client';
import {
  decodeDisneyHandshake,
  DISNEY_BRIDGE_VERSION,
  DISNEY_HANDSHAKE_EVENT,
  DISNEY_PORT_OFFER,
  encodeDisneyPortOffer,
  encodeDisneyPush,
} from './bridge-protocol';
import {
  reduceDisneyPlayerExperience,
  reduceDisneySeriesPage,
  type DisneyPlayerExperience,
  type DisneySeriesPage,
} from '../../platforms/disney/metadata';
import {
  nonAnimeEpisode,
  SEEN_AT,
  UNDEAD_UNLUCK_S1E1_AVAIL_ID,
  UNDEAD_UNLUCK_S1E1_PLAY_ID,
  UNDEAD_UNLUCK_ENTITY_ID,
  undeadUnluckS1E1,
  undeadUnluckSeriesPage,
  WINTER_ARC_E1_AVAIL_ID,
  winterArcE1,
} from './fixtures';

const ORIGIN = 'https://www.disneyplus.com';
const V = DISNEY_BRIDGE_VERSION;
/** Identifiant d'épisode de l'URL de l'arc (absent de sa fiche : pas d'infoBlock) */
const ARC_PLAY_ID = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
const OTHER_ID = '11111111-2222-4333-8444-555555555555';

function entry(raw: unknown, requestId: string, seenAt = SEEN_AT): DisneyPlayerExperience {
  const reduced = reduceDisneyPlayerExperience(raw, requestId, seenAt);
  if (!reduced) throw new Error('fixture invalide');
  return reduced;
}

/** S1E1 demandée par availId : l'épisode de l'URL vient de infoBlock */
const S1E1 = entry(undeadUnluckS1E1(), UNDEAD_UNLUCK_S1E1_AVAIL_ID);
/** Changement d'URL des tests : après SEEN_AT */
const URL_CHANGE = SEEN_AT + 1_000;
const ARC = entry(winterArcE1(), WINTER_ARC_E1_AVAIL_ID, URL_CHANGE + 10);
const OTHER = entry(nonAnimeEpisode(OTHER_ID), OTHER_ID, URL_CHANGE + 20);

/** Ports ouverts pendant le test (fermés ensuite : un MessagePort Node ouvert garde le worker actif) */
const channels: MessageChannel[] = [];
/** Événements déclenchés par un « script de la page » (dispatchEvent) : non « trusted » */
const forged = new WeakSet<Event>();

beforeEach(() => {
  useBridgeFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
  for (const { port1, port2 } of channels.splice(0)) {
    port1.close();
    port2.close();
  }
});

interface FakeBridge {
  /** Fiches poussées à chaque client connecté (et instantané pour les suivants) */
  push(...entries: DisneyPlayerExperience[]): void;
  /** Pages de série poussées à chaque client connecté */
  pushPages(...pages: DisneySeriesPage[]): void;
  handshakes: number;
}

/**
 * Faux onglet avec pont MAIN simulé : répond à la demande d'ouverture par un vrai postMessage (asynchrone), envoie
 * l'instantané des fiches déjà vues, puis chaque nouvelle fiche. `bridge: false` : pont absent.
 */
function setup(options: { bridge?: boolean; seen?: DisneyPlayerExperience[]; forgeFirst?: boolean } & Partial<DisneyBridgeClientOptions> = {}): {
  client: DisneyBridgeClient;
  bridge: FakeBridge;
  logs: string[];
} {
  const document = new EventTarget();
  const window = new EventTarget();
  const seen = [...(options.seen ?? [])];
  const ports: MessagePort[] = [];
  const logs: string[] = [];
  const bridge: FakeBridge = {
    handshakes: 0,
    push(...entries) {
      seen.push(...entries);
      for (const port of ports) port.postMessage(encodeDisneyPush({ v: V, entries }));
    },
    pushPages(...pages) {
      for (const port of ports) port.postMessage(encodeDisneyPush({ v: V, entries: [], pages }));
    },
  };
  if (options.bridge !== false) {
    document.addEventListener(DISNEY_HANDSHAKE_EVENT, (event) => {
      const handshake = event instanceof CustomEvent ? decodeDisneyHandshake(event.detail) : null;
      if (!handshake) return;
      bridge.handshakes++;
      const data = encodeDisneyPortOffer({ v: V, type: DISNEY_PORT_OFFER, nonce: handshake.nonce });
      if (options.forgeFirst) {
        // Script de la page qui imite l'offre (synchrone, donc avant le vrai postMessage)
        const forgedChannel = new MessageChannel();
        channels.push(forgedChannel);
        const fake = new MessageEvent('message', { data, origin: ORIGIN, ports: [forgedChannel.port2] });
        forged.add(fake);
        window.dispatchEvent(fake);
        forgedChannel.port1.postMessage(encodeDisneyPush({ v: V, entries: [{ ...S1E1, title: 'Forged' }] }));
      }
      const channel = new MessageChannel();
      channels.push(channel);
      ports.push(channel.port1);
      queueMicrotask(() => window.dispatchEvent(new MessageEvent('message', { data, origin: ORIGIN, ports: [channel.port2] })));
      if (seen.length > 0) channel.port1.postMessage(encodeDisneyPush({ v: V, entries: seen }));
    });
  }
  const client = createDisneyBridgeClient({
    target: document,
    messages: window,
    origin: ORIGIN,
    connectTimeoutMs: 50,
    matchWaitMs: 40,
    waitMs: 200,
    isTrusted: (event) => !forged.has(event),
    log: (message) => logs.push(message),
    ...options,
  });
  return { client, bridge, logs };
}

const signal = (): AbortSignal => new AbortController().signal;
/** Laisse s'écouler le temps simulé (délais du client) puis rend le résultat de la demande en cours */
async function settle<T>(pending: Promise<T>, ms = 300): Promise<T> {
  await advance(ms);
  return pending;
}
/** Demande en cours : `done` devient vrai à son dénouement (pour vérifier qu'elle attend bien son délai) */
function track<T>(pending: Promise<T>): { result: Promise<T>; done: () => boolean } {
  let settled = false;
  const result = pending.finally(() => {
    settled = true;
  });
  return { result, done: () => settled };
}

describe('createDisneyBridgeClient — fiche portant l’identifiant de l’URL', () => {
  it('épisode de l’URL décodé de infoBlock (différent de l’availId) : fiche servie, puis lue en cache', async () => {
    const { client, bridge, logs } = setup({ seen: [S1E1] });
    expect(await client.load(UNDEAD_UNLUCK_S1E1_PLAY_ID.toUpperCase(), signal(), 0)).toEqual(S1E1);
    expect(client.peek(UNDEAD_UNLUCK_S1E1_PLAY_ID)).toEqual(S1E1);
    expect(client.peek(UNDEAD_UNLUCK_S1E1_AVAIL_ID)).toEqual(S1E1);
    expect(await client.load(UNDEAD_UNLUCK_S1E1_PLAY_ID, signal(), 0)).toEqual(S1E1);
    expect(bridge.handshakes).toBe(1);
    expect(logs).toContain('Pont Disney+ connecté');
  });

  it('fiche arrivée après la demande (navigation, épisode suivant) : attendue puis servie, même avec d’autres fiches', async () => {
    const { client, bridge } = setup();
    const pending = client.load(UNDEAD_UNLUCK_S1E1_PLAY_ID, signal(), URL_CHANGE);
    await advance(10);
    bridge.push(OTHER);
    bridge.push(S1E1);
    expect(await pending).toEqual(S1E1);
    expect(client.peek(OTHER_ID)).toEqual(OTHER);
  });

  it('même vidéo reçue deux fois (requête doublée par le site) : une seule fiche, identifiants réunis', async () => {
    const byPlayId = entry(undeadUnluckS1E1(), UNDEAD_UNLUCK_S1E1_PLAY_ID, URL_CHANGE + 5);
    const { client, bridge } = setup({ seen: [S1E1] });
    await client.load(UNDEAD_UNLUCK_S1E1_PLAY_ID, signal(), 0);
    bridge.push(byPlayId);
    await advance(10);
    expect(client.peek(UNDEAD_UNLUCK_S1E1_AVAIL_ID)?.seenAt).toBe(URL_CHANGE + 5);
  });
});

describe('createDisneyBridgeClient — repli sans identifiant correspondant', () => {
  it('une seule fiche reçue depuis le changement d’URL : retenue après le délai, puis associée à l’URL', async () => {
    const { client, bridge, logs } = setup({ seen: [S1E1] });
    const pending = track(client.load(ARC_PLAY_ID, signal(), URL_CHANGE));
    await advance(5);
    bridge.push(ARC);
    // Retenue seulement après le délai de correspondance (40 ms), pas à l'arrivée de la fiche
    await advance(30);
    expect(pending.done()).toBe(false);
    await advance(20);
    const found = await pending.result;
    expect(found?.title).toBe(ARC.title);
    expect(found?.ids).toEqual([WINTER_ARC_E1_AVAIL_ID, ARC_PLAY_ID]);
    // Relectures (popup, fin de l'épisode) : retrouvée directement par l'identifiant de l'URL
    expect(client.peek(ARC_PLAY_ID)?.title).toBe(ARC.title);
    expect(logs.some((line) => line.includes('seule fiche reçue'))).toBe(true);
  });

  it('fiche arrivée après le délai de correspondance (réseau lent) : retenue à son arrivée', async () => {
    const { client, bridge } = setup();
    const pending = client.load(ARC_PLAY_ID, signal(), URL_CHANGE);
    await advance(80);
    bridge.push(ARC);
    expect((await settle(pending))?.ids).toContain(ARC_PLAY_ID);
  });

  it('plusieurs fiches reçues depuis le changement d’URL (ambiguïté) : vidéo non suivie', async () => {
    const { client, bridge, logs } = setup();
    const pending = client.load(ARC_PLAY_ID, signal(), URL_CHANGE);
    await advance(5);
    bridge.push(ARC, OTHER);
    expect(await settle(pending)).toBeNull();
    expect(client.peek(ARC_PLAY_ID)).toBeNull();
    expect(logs.some((line) => line.includes('2 fiches reçues'))).toBe(true);
  });

  it('seules des fiches antérieures au changement d’URL (épisode précédent) : rien après le délai maximal', async () => {
    const { client } = setup({ seen: [S1E1] });
    const pending = track(client.load(ARC_PLAY_ID, signal(), URL_CHANGE));
    await advance(150);
    expect(pending.done()).toBe(false);
    await advance(100);
    expect(await pending.result).toBeNull();
  });
});

describe('createDisneyBridgeClient — pont et sécurité', () => {
  it('pont absent (accès accordé après le chargement de l’onglet) : null sans attendre la fiche', async () => {
    const { client, logs } = setup({ bridge: false });
    const pending = track(client.load(WINTER_ARC_E1_AVAIL_ID, signal(), 0));
    await advance(100);
    expect(pending.done()).toBe(true);
    expect(await pending.result).toBeNull();
    expect(logs.some((line) => line.startsWith('Pont Disney+ absent'))).toBe(true);
  });

  it('annulation (épisode quitté) : null aussitôt', async () => {
    const { client } = setup();
    const controller = new AbortController();
    const pending = client.load(WINTER_ARC_E1_AVAIL_ID, controller.signal, 0);
    await advance(10);
    controller.abort();
    expect(await pending).toBeNull();
    const aborted = new AbortController();
    aborted.abort();
    expect(await client.load(WINTER_ARC_E1_AVAIL_ID, aborted.signal, 0)).toBeNull();
  });

  it('identifiant invalide : aucune demande au pont', async () => {
    const { client, bridge } = setup();
    expect(await client.load('../x', signal(), 0)).toBeNull();
    expect(bridge.handshakes).toBe(0);
  });

  it('offre de port imitée par la page (dispatchEvent) : refusée, seul le vrai port est écouté', async () => {
    const { client } = setup({ seen: [S1E1], forgeFirst: true });
    expect(await client.load(UNDEAD_UNLUCK_S1E1_PLAY_ID, signal(), 0)).toEqual(S1E1);
    await advance(10);
    expect(client.peek(UNDEAD_UNLUCK_S1E1_PLAY_ID)?.title).toBe('Undead Unluck');
  });

  it('fiche falsifiée ou invalide poussée sur le port : écartée', async () => {
    const { client, bridge } = setup();
    const pending = client.load(UNDEAD_UNLUCK_S1E1_PLAY_ID, signal(), URL_CHANGE);
    await advance(5);
    bridge.push({ ...S1E1, ids: ['pas-un-uuid'] });
    expect(await settle(pending)).toBeNull();
  });
});

describe('createDisneyBridgeClient — pages de série', () => {
  const PAGE = reduceDisneySeriesPage(undeadUnluckSeriesPage(), UNDEAD_UNLUCK_ENTITY_ID, SEEN_AT);
  if (!PAGE) throw new Error('fixture invalide');

  it('page arrivée après la demande : attendue puis servie, puis lue en cache (casse de l’uuid ignorée)', async () => {
    const { client, bridge } = setup();
    const loading = client.loadPage(UNDEAD_UNLUCK_ENTITY_ID.toUpperCase(), signal());
    await advance(10);
    bridge.pushPages(PAGE);
    expect(await loading).toEqual(PAGE);
    expect(client.peekPage(UNDEAD_UNLUCK_ENTITY_ID)).toEqual(PAGE);
    // Saison choisie ensuite : la page mise à jour remplace la précédente
    bridge.pushPages({ ...PAGE, selectedSeasonId: PAGE.focusSeasonId });
    await advance(10);
    expect(client.peekPage(UNDEAD_UNLUCK_ENTITY_ID)?.selectedSeasonId).toBe(PAGE.focusSeasonId);
  });

  it('aucune page (délai de l’appelant) : null à l’annulation ; pont absent : null sans attendre', async () => {
    const controller = new AbortController();
    const loading = setup().client.loadPage(UNDEAD_UNLUCK_ENTITY_ID, controller.signal);
    await advance(20);
    controller.abort();
    expect(await loading).toBeNull();
    expect(await settle(setup({ bridge: false }).client.loadPage(UNDEAD_UNLUCK_ENTITY_ID, signal()))).toBeNull();
    expect(await setup().client.loadPage('x', signal())).toBeNull();
  });
});

describe('createDisneyBridgeClient — repères éditoriaux (générique de fin)', () => {
  const CREDITS = { creditsStartMs: 1_429_803, upNextMs: 1_434_808 };

  it('fiche sans repères puis fiche complétée par le pont (réponse de lecture) : repères servis', async () => {
    const { client, bridge } = setup({ seen: [S1E1] });
    const loading = client.loadEditorial(UNDEAD_UNLUCK_S1E1_PLAY_ID, signal(), 0);
    await advance(10);
    bridge.push({ ...S1E1, editorial: CREDITS });
    expect(await loading).toEqual(CREDITS);
    expect(client.peek(UNDEAD_UNLUCK_S1E1_PLAY_ID)?.editorial).toEqual(CREDITS);
  });

  it('repères déjà joints à la fiche : servis sans attente', async () => {
    const { client } = setup({ seen: [{ ...S1E1, editorial: CREDITS }] });
    expect(await client.loadEditorial(UNDEAD_UNLUCK_S1E1_PLAY_ID, signal(), 0)).toEqual(CREDITS);
  });

  it('aucune réponse de lecture dans le délai, aucune fiche, ou annulation : null', async () => {
    const waiting = track(setup({ seen: [S1E1] }).client.loadEditorial(UNDEAD_UNLUCK_S1E1_PLAY_ID, signal(), 0));
    await advance(150);
    expect(waiting.done()).toBe(false);
    await advance(100);
    expect(await waiting.result).toBeNull();
    expect(await settle(setup({ bridge: false }).client.loadEditorial(UNDEAD_UNLUCK_S1E1_PLAY_ID, signal(), 0))).toBeNull();
    const controller = new AbortController();
    const loading = setup({ seen: [S1E1] }).client.loadEditorial(UNDEAD_UNLUCK_S1E1_PLAY_ID, controller.signal, 0);
    await advance(20);
    controller.abort();
    expect(await loading).toBeNull();
  });
});
