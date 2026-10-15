import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

// Garde du script isolé Netflix : exécuté de nouveau dans les onglets ouverts après une mise à jour de l'extension
// (background/platform-access.ts) ou un nouvel accord de l'accès, sans double exécution.

const startContent = vi.hoisted(() => vi.fn());
vi.mock('../start', () => ({ startContent }));
vi.mock('./adapter', () => ({ netflixAdapter: { platform: 'netflix' } }));

const STARTED_FLAG = Symbol.for('synckai.netflix.content.runtime');
/** Clé des versions jusqu'à la 2.2.0, posée à `true` non configurable */
const LEGACY_FLAG = Symbol.for('synckai.netflix.content');

/** Exécute le script comme le ferait le navigateur (nouvelle évaluation du module) */
async function runNetflixScript(runtime: { id?: string }): Promise<void> {
  vi.stubGlobal('chrome', { runtime });
  vi.resetModules();
  await import('./content-netflix.iife');
}

beforeEach(() => {
  Reflect.deleteProperty(globalThis, STARTED_FLAG);
  startContent.mockClear();
});

afterAll(() => {
  Reflect.deleteProperty(globalThis, STARTED_FLAG);
  vi.unstubAllGlobals();
});

describe('content-netflix.iife.ts — garde de double exécution', () => {
  it('réexécuté alors qu’une instance valide tourne déjà : sans effet', async () => {
    await runNetflixScript({ id: 'synckai' });
    await runNetflixScript({ id: 'synckai' });
    expect(startContent).toHaveBeenCalledOnce();
  });

  it('instance précédente orpheline (extension mise à jour) : la nouvelle démarre, puis garde la place', async () => {
    const previous: { id?: string } = { id: 'synckai' };
    await runNetflixScript(previous);
    // Contexte invalidé : chrome.runtime de l'ancienne instance n'a plus d'id
    delete previous.id;
    await runNetflixScript({ id: 'synckai' });
    await runNetflixScript({ id: 'synckai' });
    expect(startContent).toHaveBeenCalledTimes(2);
  });

  it('instance orpheline d’une version précédente (garde historique à `true`) : la nouvelle démarre', async () => {
    Reflect.defineProperty(globalThis, LEGACY_FLAG, { value: true });
    await runNetflixScript({ id: 'synckai' });
    expect(startContent).toHaveBeenCalledOnce();
  });
});
