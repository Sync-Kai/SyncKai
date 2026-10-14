import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

// Garde du script isolé Prime Video : exécuté de nouveau dans les onglets ouverts après une mise à jour de l'extension
// (background/platform-access.ts) ou un nouvel accord de l'accès, sans double exécution.

const startContent = vi.hoisted(() => vi.fn());
vi.mock('../start', () => ({ startContent }));
vi.mock('../adapters/prime', () => ({ primeAdapter: { platform: 'prime' } }));

const STARTED_FLAG = Symbol.for('synckai.prime.content.runtime');

/** Exécute le script comme le ferait le navigateur (nouvelle évaluation du module) */
async function runDisneyScript(runtime: { id?: string }): Promise<void> {
  vi.stubGlobal('chrome', { runtime });
  vi.resetModules();
  await import('./content-prime.iife');
}

beforeEach(() => {
  Reflect.deleteProperty(globalThis, STARTED_FLAG);
  startContent.mockClear();
});

afterAll(() => {
  Reflect.deleteProperty(globalThis, STARTED_FLAG);
  vi.unstubAllGlobals();
});

describe('content-prime.iife.ts — garde de double exécution', () => {
  it('réexécuté alors qu’une instance valide tourne déjà : sans effet', async () => {
    await runDisneyScript({ id: 'synckai' });
    await runDisneyScript({ id: 'synckai' });
    expect(startContent).toHaveBeenCalledOnce();
    expect(startContent).toHaveBeenCalledWith([{ platform: 'prime' }]);
  });

  it('instance précédente orpheline (extension mise à jour) : la nouvelle démarre, puis garde la place', async () => {
    const previous: { id?: string } = { id: 'synckai' };
    await runDisneyScript(previous);
    delete previous.id;
    await runDisneyScript({ id: 'synckai' });
    await runDisneyScript({ id: 'synckai' });
    expect(startContent).toHaveBeenCalledTimes(2);
  });
});
