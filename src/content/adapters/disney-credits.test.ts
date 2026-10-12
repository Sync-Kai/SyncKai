import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { DisneyBridgeClientOptions } from '../disney/bridge-client';
import {
  decodeDisneyHandshake,
  DISNEY_BRIDGE_VERSION,
  DISNEY_HANDSHAKE_EVENT,
  DISNEY_PORT_OFFER,
  encodeDisneyPortOffer,
  encodeDisneyPush,
  reduceDisneyPlayback,
  reduceDisneyPlayerExperience,
  withDisneyPlayback,
  type DisneyPlayerExperience,
} from '../disney/bridge-protocol';
import {
  SEEN_AT,
  SYNDUALITY_S1E1_AVAIL_ID,
  SYNDUALITY_S1E1_PLAY_ID,
  SYNDUALITY_S1E1_RUNTIME_MS,
  syndualityPlayback,
  syndualityS1E1,
  UNDEAD_UNLUCK_S1E1_AVAIL_ID,
  UNDEAD_UNLUCK_S1E1_PLAY_ID,
  undeadUnluckS1E1,
} from '../disney/fixtures';
import { resolveCompletionPoint } from '../lib/completion';
import { disneyAdapter } from './disney';

// Début du générique de fin de Disney+ (StreamingAdapter.getCreditsStart) : client du pont réel, branché sur un faux
// onglet (Node : ni DOM ni postMessage « trusted ») dont le pont MAIN simulé pousse les fiches.

const ORIGIN = 'https://www.disneyplus.com';
const fakeDocument = new EventTarget();
const fakeWindow = new EventTarget();
const channels: MessageChannel[] = [];

// Client du pont de l'adapter : cibles du faux onglet, délais courts
vi.mock('../disney/bridge-client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../disney/bridge-client')>();
  return {
    ...actual,
    createDisneyBridgeClient: (options: DisneyBridgeClientOptions) =>
      actual.createDisneyBridgeClient({ ...options, target: fakeDocument, messages: fakeWindow, isTrusted: () => true, connectTimeoutMs: 100, matchWaitMs: 40, waitMs: 200 }),
  };
});

/** Fiches poussées au client dès l'ouverture du canal */
let seen: DisneyPlayerExperience[] = [];

beforeAll(() => {
  vi.stubGlobal('document', fakeDocument);
  vi.stubGlobal('window', fakeWindow);
  vi.stubGlobal('location', { origin: ORIGIN, pathname: `/fr-fr/play/${SYNDUALITY_S1E1_PLAY_ID}` });
  fakeDocument.addEventListener(DISNEY_HANDSHAKE_EVENT, (event) => {
    const handshake = event instanceof CustomEvent ? decodeDisneyHandshake(event.detail) : null;
    if (!handshake) return;
    const channel = new MessageChannel();
    channels.push(channel);
    const data = encodeDisneyPortOffer({ v: DISNEY_BRIDGE_VERSION, type: DISNEY_PORT_OFFER, nonce: handshake.nonce });
    queueMicrotask(() => fakeWindow.dispatchEvent(new MessageEvent('message', { data, origin: ORIGIN, ports: [channel.port2] })));
    channel.port1.postMessage(encodeDisneyPush({ v: DISNEY_BRIDGE_VERSION, entries: seen }));
  });
});

afterAll(() => {
  for (const { port1, port2 } of channels.splice(0)) {
    port1.close();
    port2.close();
  }
  vi.unstubAllGlobals();
});

function entry(raw: unknown, requestId: string): DisneyPlayerExperience {
  const reduced = reduceDisneyPlayerExperience(raw, requestId, SEEN_AT);
  if (!reduced) throw new Error('fixture invalide');
  return reduced;
}

const signal = (): AbortSignal => new AbortController().signal;

describe('disneyAdapter.getCreditsStart (repère FFEC de la réponse de lecture)', () => {
  it('épisode dont la fiche porte les repères : début du générique en secondes, retenu par resolveCompletionPoint', async () => {
    const playback = reduceDisneyPlayback(syndualityPlayback());
    if (!playback) throw new Error('fixture invalide');
    // Fiche demandée par l'identifiant de l'URL (= qoe.entityId), repères joints par le pont
    seen = [withDisneyPlayback(entry(syndualityS1E1(), SYNDUALITY_S1E1_PLAY_ID), [playback]), entry(undeadUnluckS1E1(), UNDEAD_UNLUCK_S1E1_AVAIL_ID)];
    const debug = vi.spyOn(console, 'debug').mockImplementation(() => undefined);
    const start = await disneyAdapter.getCreditsStart?.(SYNDUALITY_S1E1_PLAY_ID, signal());
    expect(start).toBe(1429.803);
    expect(debug.mock.calls.some((call) => call.includes('Générique de fin annoncé à 1429.803 s'))).toBe(true);
    debug.mockRestore();

    // Durée de la barre de progression (aria-valuemax) = durée de la fiche, même ligne de temps que FFEC
    const duration = SYNDUALITY_S1E1_RUNTIME_MS / 1000;
    expect(resolveCompletionPoint(1460, start ?? null, 0.85)).toEqual({ seconds: 1429.803, source: 'credits' });
    expect(resolveCompletionPoint(duration, start ?? null, 0.85).source).toBe('credits');
    // Sans repère : seuil de repli (85 %)
    expect(resolveCompletionPoint(1460, null, 0.85)).toEqual({ seconds: 1460 * 0.85, source: 'ratio' });
  });

  it('aucune réponse de lecture pour cet épisode dans le délai : null (seuil de repli)', async () => {
    expect(entry(syndualityS1E1(), SYNDUALITY_S1E1_AVAIL_ID).ids).not.toContain(UNDEAD_UNLUCK_S1E1_PLAY_ID);
    const started = Date.now();
    expect(await disneyAdapter.getCreditsStart?.(UNDEAD_UNLUCK_S1E1_PLAY_ID, signal())).toBeNull();
    expect(Date.now() - started).toBeGreaterThanOrEqual(150);
  });
});
