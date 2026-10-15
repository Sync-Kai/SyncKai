import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { StreamingAdapter } from './lib/adapter';
import type { StartContentOptions } from './start';

// Garde STARTED_FLAG des scripts de contenu du manifeste (Crunchyroll, ADN) : réinjection par le service worker à
// l'installation et à la mise à jour (background/content-reinjection.ts) sans double exécution.

const startContent = vi.hoisted(() => vi.fn<(adapters: readonly StreamingAdapter[], options?: StartContentOptions) => void>());
vi.mock('./start', () => ({ startContent }));

const STARTED_FLAG = Symbol.for('synckai.content');

/** Scripts du manifeste, chacun avec le seul adapter de sa plateforme */
const ENTRIES = [
  { name: 'crunchyroll/content-crunchyroll.iife.ts', platform: 'crunchyroll', load: () => import('./crunchyroll/content-crunchyroll.iife') },
  { name: 'adn/content-adn.iife.ts', platform: 'adn', load: () => import('./adn/content-adn.iife') },
] as const;

type Entry = (typeof ENTRIES)[number];

/** Exécute le script comme le ferait le navigateur (nouvelle évaluation du module) */
async function runContentScript(entry: Entry, runtime: { id?: string }): Promise<void> {
  vi.stubGlobal('chrome', { runtime });
  vi.resetModules();
  await entry.load();
}

beforeEach(() => {
  Reflect.deleteProperty(globalThis, STARTED_FLAG);
  startContent.mockClear();
});

afterAll(() => {
  Reflect.deleteProperty(globalThis, STARTED_FLAG);
  vi.unstubAllGlobals();
});

describe.each(ENTRIES)('$name — garde de double exécution', (entry) => {
  it('première exécution : démarre avec le seul adapter de sa plateforme', async () => {
    await runContentScript(entry, { id: 'synckai' });
    expect(startContent).toHaveBeenCalledOnce();
    expect(startContent.mock.calls[0]?.[0].map((adapter) => adapter.platform)).toEqual([entry.platform]);
    // Pont MAIN de Crunchyroll relié une fois l'adapter choisi ; rien de tel sur ADN
    expect(typeof startContent.mock.calls[0]?.[1]?.onAdapter).toBe(entry.platform === 'crunchyroll' ? 'function' : 'undefined');
  });

  it('réinjecté alors qu’une instance valide tourne déjà : sans effet', async () => {
    await runContentScript(entry, { id: 'synckai' });
    await runContentScript(entry, { id: 'synckai' });
    expect(startContent).toHaveBeenCalledOnce();
  });

  it('instance précédente orpheline (extension rechargée) : la nouvelle démarre', async () => {
    const previous: { id?: string } = { id: 'synckai' };
    await runContentScript(entry, previous);
    // Contexte invalidé : chrome.runtime de l'ancienne instance n'a plus d'id
    delete previous.id;
    await runContentScript(entry, { id: 'synckai' });
    expect(startContent).toHaveBeenCalledTimes(2);
  });
});
