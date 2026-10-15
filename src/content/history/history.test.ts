import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

// Lecteurs de l'historique injectés par la page d'import à chaque tentative de lecture (import-cr/history-reader.ts) :
// écouteur du site de l'onglet seulement, jamais deux fois tant que l'instance précédente est valide.

const listenCrHistoryPorts = vi.hoisted(() => vi.fn());
const listenAdnHistoryPorts = vi.hoisted(() => vi.fn());
vi.mock('../crunchyroll/history-port', () => ({ listenCrHistoryPorts }));
vi.mock('../adn/history', () => ({ listenAdnHistoryPorts }));

const STARTED_FLAG = Symbol.for('synckai.history');

/** Injecte le script comme le ferait scripting.executeScript (nouvelle évaluation du module) */
async function inject(hostname: string, runtime: { id?: string } = { id: 'synckai' }): Promise<void> {
  vi.stubGlobal('chrome', { runtime });
  vi.stubGlobal('location', { hostname });
  vi.resetModules();
  await import('./history.iife');
}

beforeEach(() => {
  Reflect.deleteProperty(globalThis, STARTED_FLAG);
  listenCrHistoryPorts.mockClear();
  listenAdnHistoryPorts.mockClear();
});

afterAll(() => {
  Reflect.deleteProperty(globalThis, STARTED_FLAG);
  vi.unstubAllGlobals();
});

describe('history.iife.ts — lecteurs injectés à la demande', () => {
  it('onglet Crunchyroll : écouteur Crunchyroll seul', async () => {
    await inject('www.crunchyroll.com');
    expect(listenCrHistoryPorts).toHaveBeenCalledOnce();
    expect(listenAdnHistoryPorts).not.toHaveBeenCalled();
  });

  it('onglet ADN (avec ou sans www) : écouteur ADN seul', async () => {
    await inject('animationdigitalnetwork.com');
    Reflect.deleteProperty(globalThis, STARTED_FLAG);
    await inject('www.animationdigitalnetwork.com');
    expect(listenAdnHistoryPorts).toHaveBeenCalledTimes(2);
    expect(listenCrHistoryPorts).not.toHaveBeenCalled();
  });

  it('autre site : aucun écouteur', async () => {
    await inject('notcrunchyroll.com');
    expect(listenCrHistoryPorts).not.toHaveBeenCalled();
    expect(listenAdnHistoryPorts).not.toHaveBeenCalled();
  });

  it('injecté de nouveau (nouvelle tentative) alors qu’une instance valide tourne : sans effet', async () => {
    await inject('www.crunchyroll.com');
    await inject('www.crunchyroll.com');
    expect(listenCrHistoryPorts).toHaveBeenCalledOnce();
  });

  it('instance précédente orpheline (extension mise à jour) : la nouvelle écoute', async () => {
    const previous: { id?: string } = { id: 'synckai' };
    await inject('www.crunchyroll.com', previous);
    delete previous.id;
    await inject('www.crunchyroll.com');
    expect(listenCrHistoryPorts).toHaveBeenCalledTimes(2);
  });
});
