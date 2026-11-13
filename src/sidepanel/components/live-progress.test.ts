import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Progression en direct : port vers le script de contenu, nouvelles tentatives, page injoignable puis relancée
// (F5 sur un épisode, script de contenu prêt après les trois tentatives : PNL-01)

type Listener = (...args: unknown[]) => void;

interface FakePort {
  onMessage: { addListener: (l: Listener) => void };
  onDisconnect: { addListener: (l: Listener) => void };
  disconnect: () => void;
  postMessage: () => void;
  /** Ferme le port côté page (aucun script de contenu à l'écoute) */
  drop: () => void;
}

const ports: FakePort[] = [];

function makePort(): FakePort {
  const disconnects: Listener[] = [];
  return {
    onMessage: { addListener: () => undefined },
    onDisconnect: { addListener: (l) => void disconnects.push(l) },
    disconnect: () => undefined,
    postMessage: () => undefined,
    drop: () => {
      for (const l of disconnects) l();
    },
  };
}

vi.stubGlobal('window', { addEventListener: () => undefined });
vi.stubGlobal('chrome', {
  runtime: { lastError: undefined },
  tabs: {
    connect: () => {
      const port = makePort();
      ports.push(port);
      return port;
    },
  },
});

const { createLiveProgress } = await import('./live-progress');

beforeEach(() => {
  vi.useFakeTimers();
  ports.length = 0;
});
afterEach(() => vi.useRealTimers());

describe('createLiveProgress', () => {
  it('3 connexions refusées (page en chargement) puis follow du même onglet : nouvelle connexion', async () => {
    const live = createLiveProgress(() => undefined);
    const target = { tabId: 4, episodeId: 'E1' };
    live.follow(target);
    ports[0].drop();
    await vi.advanceTimersByTimeAsync(800);
    ports[1].drop();
    await vi.advanceTimersByTimeAsync(2_000);
    ports[2].drop();
    expect(live.store.get().unreachable).toBe(true);
    await vi.advanceTimersByTimeAsync(10_000);
    expect(ports).toHaveLength(3);
    // Page rechargée (F5) puis prête : le panneau suit de nouveau le même épisode
    live.follow({ ...target });
    expect(ports).toHaveLength(4);
    expect(live.store.get().unreachable).toBe(false);
  });
});
