import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEBUG_TRACE_MESSAGE } from '../protocol/debug-trace';
import type { TraceInput } from '../shared/debug-trace';
import { messageTransport, noteTraceVerbose, setTraceTransport, trace, traceLog } from './debug-trace-client';
import { createLogger } from './logger';

// Producteurs de la trace (pages, scripts de contenu, service worker) : aucun envoi sans transport, lignes du logger filtrées.

afterEach(() => {
  setTraceTransport(null);
  noteTraceVerbose(null);
  vi.unstubAllGlobals();
});

function capture(): TraceInput[] {
  const sent: TraceInput[] = [];
  setTraceTransport((input) => sent.push(input));
  return sent;
}

describe('trace', () => {
  it('sans transport (tests unitaires par défaut) : rien n’est envoyé', () => {
    expect(() => trace('page', 'video-found', { id: 'v' })).not.toThrow();
  });

  it('transmet catégorie, type, données et contexte', () => {
    const sent = capture();
    trace('page', 'episode-identified', { title: 'One Piece' }, { platform: 'crunchyroll' });
    expect(sent).toEqual([{ at: expect.any(Number) as number, category: 'page', type: 'episode-identified', data: { title: 'One Piece' }, platform: 'crunchyroll' }]);
  });

  it('un transport qui lève ne casse jamais l’appelant', () => {
    setTraceTransport(() => {
      throw new Error('Extension context invalidated');
    });
    expect(() => trace('page', 'x')).not.toThrow();
  });
});

describe('traceLog (lignes du logger)', () => {
  it('warn / error toujours ; info / debug seulement si le mode détaillé est actif ou inconnu', () => {
    const sent = capture();
    traceLog('info', 'sync', ['inconnu : envoyé, le service worker trie']);
    noteTraceVerbose(false);
    traceLog('info', 'sync', ['non']);
    traceLog('debug', 'sync', ['non']);
    traceLog('warn', 'sync', ['attention']);
    noteTraceVerbose(true);
    traceLog('debug', 'sync', ['oui']);
    expect(sent.map((e) => [e.type, e.data?.message])).toEqual([
      ['info', 'inconnu : envoyé, le service worker trie'],
      ['warn', 'attention'],
      ['debug', 'oui'],
    ]);
  });

  it('le logger alimente la trace (warn), sans jeton ni en-tête', () => {
    const sent = capture();
    createLogger('anilist').warn('Requête refusée', { status: 401, headers: { Authorization: 'Bearer abc' }, accessToken: 'abc' });
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({ category: 'log', type: 'warn', data: { scope: 'anilist', message: 'Requête refusée {"status":401}' } });
  });
});

describe('messageTransport', () => {
  it('envoie le message de trace et retient le mode détaillé de la réponse', async () => {
    const sendMessage = vi.fn(() => Promise.resolve({ verbose: false }));
    vi.stubGlobal('chrome', { runtime: { sendMessage } });
    setTraceTransport(messageTransport);
    trace('ui', 'season-picked', { mediaId: 1 });
    expect(sendMessage).toHaveBeenCalledWith({ type: DEBUG_TRACE_MESSAGE, payload: { kind: 'event', event: expect.objectContaining({ type: 'season-picked' }) as unknown } });
    await Promise.resolve();
    await Promise.resolve();
    sendMessage.mockClear();
    traceLog('info', 'x', ['mode détaillé coupé : non envoyé']);
    expect(sendMessage).not.toHaveBeenCalled();
  });

  it('service worker injoignable (rejet ou exception) : silencieux', async () => {
    vi.stubGlobal('chrome', { runtime: { sendMessage: () => Promise.reject(new Error('Receiving end does not exist')) } });
    setTraceTransport(messageTransport);
    expect(() => trace('page', 'x')).not.toThrow();
    vi.stubGlobal('chrome', {
      runtime: {
        sendMessage: () => {
          throw new Error('Extension context invalidated');
        },
      },
    });
    expect(() => trace('page', 'y')).not.toThrow();
    await Promise.resolve();
  });
});
