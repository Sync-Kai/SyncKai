import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

// Garde STARTED_FLAG du script de contenu Crunchyroll / ADN : réinjection par le service worker à l'installation
// et à la mise à jour (background/content-reinjection.ts) sans double exécution.

const startContent = vi.hoisted(() => vi.fn());
vi.mock('./start', () => ({ startContent }));
vi.mock('./lib/cr-history-port', () => ({ listenCrHistoryPorts: vi.fn() }));

const STARTED_FLAG = Symbol.for('synckai.content');

/** Exécute le script comme le ferait le navigateur (nouvelle évaluation du module) */
async function runContentScript(runtime: { id?: string }): Promise<void> {
  vi.stubGlobal('chrome', { runtime });
  vi.resetModules();
  await import('./content');
}

beforeEach(() => {
  Reflect.deleteProperty(globalThis, STARTED_FLAG);
  startContent.mockClear();
});

afterAll(() => {
  Reflect.deleteProperty(globalThis, STARTED_FLAG);
  vi.unstubAllGlobals();
});

describe('content.ts — garde de double exécution', () => {
  it('première exécution : démarre', async () => {
    await runContentScript({ id: 'synckai' });
    expect(startContent).toHaveBeenCalledOnce();
  });

  it('réinjecté alors qu’une instance valide tourne déjà : sans effet', async () => {
    await runContentScript({ id: 'synckai' });
    await runContentScript({ id: 'synckai' });
    expect(startContent).toHaveBeenCalledOnce();
  });

  it('instance précédente orpheline (extension rechargée) : la nouvelle démarre', async () => {
    const previous: { id?: string } = { id: 'synckai' };
    await runContentScript(previous);
    // Contexte invalidé : chrome.runtime de l'ancienne instance n'a plus d'id
    delete previous.id;
    await runContentScript({ id: 'synckai' });
    expect(startContent).toHaveBeenCalledTimes(2);
  });
});
