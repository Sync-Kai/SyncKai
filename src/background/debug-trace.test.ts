import { describe, expect, it } from 'vitest';
import { DEBUG_TRACE_MESSAGE } from '../protocol/debug-trace';
import { TRACE_MAX, TRACE_MAX_VERBOSE, type TraceEvent, type TraceRecord } from '../shared/debug-trace';
import { createTraceWriter, messageTraceRecord, receiveTraceMessage, traceSourceOf, type TraceStore } from './debug-trace';

// Trace de débogage (builds de dev) : écriture par le service worker seul, en série, et messages des autres contextes.

function memoryStore(): TraceStore & { events: TraceEvent[]; verbose: boolean; writes: number } {
  const store = {
    events: [] as TraceEvent[],
    verbose: false,
    writes: 0,
    read: () => Promise.resolve<unknown>(store.events),
    write: async (events: TraceEvent[]): Promise<void> => {
      // Écriture lente : des producteurs concurrents arrivent pendant qu'elle est en cours
      await new Promise((resolve) => setTimeout(resolve, 1));
      store.events = events;
      store.writes++;
    },
    readVerbose: () => Promise.resolve(store.verbose),
    writeVerbose: (verbose: boolean): Promise<void> => {
      store.verbose = verbose;
      return Promise.resolve();
    },
    clear: (): Promise<void> => {
      store.events = [];
      return Promise.resolve();
    },
  };
  return store;
}

const record = (type: string, extra: Partial<TraceRecord> = {}): TraceRecord => ({ at: Date.now(), source: 'sw', category: 'sync', type, data: {}, ...extra });

const EXTENSION = { extensionId: 'synckai-test', extensionOrigin: 'chrome-extension://synckai-test/' };
const contentSender = { id: 'synckai-test', url: 'https://www.crunchyroll.com/fr/watch/GE1/x', tab: { id: 7 } };
const panelSender = { id: 'synckai-test', url: 'chrome-extension://synckai-test/src/sidepanel/sidepanel.html', tab: undefined };
const event = (type: string, data: Record<string, unknown> = {}): unknown => ({ type: DEBUG_TRACE_MESSAGE, payload: { kind: 'event', event: { at: 1, category: 'page', type, data } } });

describe('createTraceWriter', () => {
  it('numérote dans l’ordre d’arrivée, même avec plusieurs producteurs concurrents', async () => {
    const store = memoryStore();
    const writer = createTraceWriter(store, true);
    await Promise.all(
      Array.from({ length: 5 }, async (_, producer) => {
        for (let i = 0; i < 20; i++) {
          writer.append(record(`p${producer}-${i}`));
          if (i % 3 === 0) await Promise.resolve();
        }
      }),
    );
    await writer.idle();
    const seqs = store.events.map((e) => e.seq);
    expect(seqs).toHaveLength(100);
    expect(seqs).toEqual(Array.from({ length: 100 }, (_, i) => i + 1));
    // Écritures regroupées : moins d'une par événement
    expect(store.writes).toBeLessThan(100);
  });

  it('borne à 300 événements, 1000 en mode détaillé', async () => {
    const store = memoryStore();
    const writer = createTraceWriter(store, true);
    for (let i = 0; i < TRACE_MAX + 50; i++) writer.append(record(`a${i}`));
    await writer.idle();
    expect(store.events).toHaveLength(TRACE_MAX);
    expect(store.events.at(-1)?.type).toBe(`a${TRACE_MAX + 49}`);

    await writer.setVerbose(true);
    for (let i = 0; i < TRACE_MAX_VERBOSE; i++) writer.append(record(`b${i}`));
    await writer.idle();
    expect(store.events).toHaveLength(TRACE_MAX_VERBOSE);
    expect(store.verbose).toBe(true);

    // Retour au mode normal : les plus récents gardés dans la limite normale
    await writer.setVerbose(false);
    expect(store.events).toHaveLength(TRACE_MAX);
    expect(store.events.at(-1)?.type).toBe(`b${TRACE_MAX_VERBOSE - 1}`);
  });

  it('lignes info / debug du logger gardées seulement en mode détaillé ; warn / error toujours', async () => {
    const store = memoryStore();
    const writer = createTraceWriter(store, true);
    const line = (level: string): TraceRecord => record(level, { category: 'log', data: { scope: 'sync', message: level } });
    writer.append(line('info'));
    writer.append(line('debug'));
    writer.append(line('warn'));
    writer.append(line('error'));
    await writer.idle();
    expect(store.events.map((e) => e.type)).toEqual(['warn', 'error']);
    await writer.setVerbose(true);
    writer.append(line('info'));
    await writer.idle();
    expect(store.events.map((e) => e.type)).toEqual(['warn', 'error', 'info']);
  });

  it('mode détaillé relu du stockage au premier usage (réveil du service worker)', async () => {
    const store = memoryStore();
    store.verbose = true;
    const writer = createTraceWriter(store, true);
    expect(await writer.verbose()).toBe(true);
  });

  it('« Effacer » vide la trace et repart de 1', async () => {
    const store = memoryStore();
    const writer = createTraceWriter(store, true);
    writer.append(record('a'));
    await writer.clear();
    writer.append(record('b'));
    await writer.idle();
    expect(store.events.map((e) => [e.type, e.seq])).toEqual([['b', 1]]);
  });

  it('hors build de développement : rien n’est écrit', async () => {
    const store = memoryStore();
    const writer = createTraceWriter(store, false);
    writer.append(record('a'));
    await writer.setVerbose(true);
    await writer.idle();
    expect(store.events).toEqual([]);
    expect(store.verbose).toBe(false);
    expect(receiveTraceMessage(writer, event('video-found'), contentSender, EXTENSION)).toBeNull();
  });
});

describe('receiveTraceMessage', () => {
  it('script de contenu : source « content », onglet de l’expéditeur, réponse avec le mode détaillé', async () => {
    const store = memoryStore();
    const writer = createTraceWriter(store, true);
    const response = receiveTraceMessage(writer, event('video-found', { id: 'v' }), contentSender, EXTENSION);
    expect(await response).toEqual({ verbose: false });
    await writer.idle();
    expect(store.events[0]).toMatchObject({ source: 'content', tabId: 7, category: 'page', type: 'video-found', data: { id: 'v' } });
  });

  it('page de l’extension : source déclarée (settings) ou déduite de l’URL', async () => {
    const store = memoryStore();
    const writer = createTraceWriter(store, true);
    const claimed = { type: DEBUG_TRACE_MESSAGE, payload: { kind: 'event', event: { at: 1, category: 'account', type: 'sign-out', data: {}, source: 'settings' } } };
    await receiveTraceMessage(writer, claimed, panelSender, EXTENSION);
    await receiveTraceMessage(writer, event('season-picked'), panelSender, EXTENSION);
    await writer.idle();
    expect(store.events.map((e) => e.source)).toEqual(['settings', 'panel']);
  });

  it('un script de contenu ne peut ni se faire passer pour une page, ni effacer, ni changer le mode', async () => {
    const store = memoryStore();
    const writer = createTraceWriter(store, true);
    writer.append(record('kept'));
    const spoof = { type: DEBUG_TRACE_MESSAGE, payload: { kind: 'event', event: { at: 1, category: 'ui', type: 'x', data: {}, source: 'popup' } } };
    await receiveTraceMessage(writer, spoof, contentSender, EXTENSION);
    expect(receiveTraceMessage(writer, { type: DEBUG_TRACE_MESSAGE, payload: { kind: 'clear' } }, contentSender, EXTENSION)).toBeNull();
    expect(receiveTraceMessage(writer, { type: DEBUG_TRACE_MESSAGE, payload: { kind: 'verbose', verbose: true } }, contentSender, EXTENSION)).toBeNull();
    await writer.idle();
    expect(store.events.map((e) => [e.type, e.source])).toEqual([
      ['kept', 'sw'],
      ['x', 'content'],
    ]);
    expect(store.verbose).toBe(false);
  });

  it('refuse un autre expéditeur et les payloads invalides', () => {
    const writer = createTraceWriter(memoryStore(), true);
    expect(receiveTraceMessage(writer, event('x'), { ...contentSender, id: 'autre-extension' }, EXTENSION)).toBeNull();
    expect(receiveTraceMessage(writer, { type: DEBUG_TRACE_MESSAGE, payload: { kind: 'event', event: { category: 'page' } } }, contentSender, EXTENSION)).toBeNull();
    expect(receiveTraceMessage(writer, { type: DEBUG_TRACE_MESSAGE, payload: { kind: 'drop' } }, panelSender, EXTENSION)).toBeNull();
    expect(receiveTraceMessage(writer, { type: 'GET_VIEWER', payload: null }, panelSender, EXTENSION)).toBeNull();
  });

  it('page de l’extension : effacer et changer le mode', async () => {
    const store = memoryStore();
    const writer = createTraceWriter(store, true);
    writer.append(record('a'));
    expect(await receiveTraceMessage(writer, { type: DEBUG_TRACE_MESSAGE, payload: { kind: 'verbose', verbose: true } }, panelSender, EXTENSION)).toEqual({ verbose: true });
    await receiveTraceMessage(writer, { type: DEBUG_TRACE_MESSAGE, payload: { kind: 'clear' } }, panelSender, EXTENSION);
    await writer.idle();
    expect(store.events).toEqual([]);
    expect(store.verbose).toBe(true);
  });
});

describe('traceSourceOf', () => {
  it('écran d’après l’URL de la page', () => {
    const origin = EXTENSION.extensionOrigin;
    expect(traceSourceOf(`${origin}src/popup/popup.html`, origin)).toBe('popup');
    expect(traceSourceOf(`${origin}src/sidepanel/sidepanel.html?x`, origin)).toBe('panel');
    expect(traceSourceOf(`${origin}src/import-cr/import-cr.html?platform=adn`, origin)).toBe('import');
    expect(traceSourceOf(`${origin}src/import/import.html`, origin)).toBe('import');
    expect(traceSourceOf('https://www.crunchyroll.com/', origin)).toBe('content');
    expect(traceSourceOf(undefined, origin)).toBe('content');
  });
});

describe('messageTraceRecord', () => {
  it('action de l’interface : charge utile résumée et résultat par service', () => {
    const r = messageTraceRecord(
      'ADJUST_PROGRESS',
      { mediaId: 21, malId: 52991, delta: -1 },
      { status: 'synced', mediaTitle: 'One Piece', results: [{ service: 'anilist', outcome: { status: 'updated', progress: 1179, completed: false } }] },
      { source: 'panel', ms: 412 },
    );
    expect(r).toMatchObject({ source: 'panel', category: 'ui', type: 'adjust-progress', data: { mediaId: 21, malId: 52991, delta: -1, status: 'synced', anilist: 'updated 1179', ms: 412 } });
  });

  it('connexion : catégorie compte ; autres messages : type et code', () => {
    expect(messageTraceRecord('LOGIN_MAL', null, { ok: false, code: 'CANCELLED', message: 'x' }, { source: 'popup', ms: 3 })).toMatchObject({
      category: 'account',
      type: 'sign-in',
      data: { service: 'mal', ok: false, code: 'CANCELLED' },
    });
    expect(messageTraceRecord('GET_AGENDA', { weekStart: 1 }, { ok: true, data: {} }, { source: 'panel', ms: 9 })).toMatchObject({
      category: 'message',
      type: 'received',
      data: { message: 'GET_AGENDA', ok: true, ms: 9 },
    });
  });

  it('commentaire : longueur seulement, jamais le texte', () => {
    const r = messageTraceRecord('SET_LIST_NOTES', { media: { mediaId: 1, malId: null, title: 'T' }, notes: 'mon avis perso' }, { status: 'not-connected' }, { source: 'popup', ms: 1 });
    expect(JSON.stringify(r)).not.toContain('mon avis');
    expect(r.data).toMatchObject({ mediaId: 1, notesLength: 14 });
  });

  it('épisode terminé : onglet et plateforme, résumé de l’épisode', () => {
    const episode = {
      platform: 'crunchyroll',
      episodeId: 'GE1',
      seriesId: 'GRMG8ZQZR',
      seriesSlug: 'one-piece',
      animeTitle: 'One Piece',
      seasonNumber: 24,
      seasonTitle: null,
      seasonEpisodeNumber: 25,
      displayedEpisodeNumber: 1180,
      episodeTitle: null,
      url: 'https://x',
    };
    const r = messageTraceRecord('EPISODE_COMPLETED', { episode, services: null }, { status: 'ignored' }, { source: 'content', ms: 5, tabId: 3 });
    expect(r).toMatchObject({ tabId: 3, platform: 'crunchyroll', category: 'message', data: { message: 'EPISODE_COMPLETED', episodeId: 'GE1', displayed: 1180, status: 'ignored' } });
    expect(JSON.stringify(r)).not.toContain('https://x');
  });
});
