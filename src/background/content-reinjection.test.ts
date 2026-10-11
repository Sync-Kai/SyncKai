import { describe, expect, it, vi } from 'vitest';
import { reinjectContentScripts, type ContentReinjectionApi, type ManifestContentScript } from './content-reinjection';

// Réinjection des scripts de contenu du manifeste dans les onglets ouverts (installation, mise à jour).

const LOADER = 'assets/content.ts-loader-abc123.js';
const MATCHES = ['*://*.crunchyroll.com/*', '*://animationdigitalnetwork.com/*'];

function fakeApi(scripts: ManifestContentScript[], tabs: number[], failing: number[] = []): ContentReinjectionApi & {
  inject: ReturnType<typeof vi.fn>;
  tabIds: ReturnType<typeof vi.fn>;
} {
  return {
    contentScripts: () => scripts,
    tabIds: vi.fn(() => Promise.resolve(tabs)),
    inject: vi.fn((tabId: number) => (failing.includes(tabId) ? Promise.reject(new Error('Cannot access contents of the page')) : Promise.resolve())),
  };
}

describe('reinjectContentScripts', () => {
  it('exécute le chargeur du manifeste dans chaque onglet ouvert correspondant', async () => {
    const api = fakeApi([{ js: [LOADER], matches: MATCHES }], [11, 12]);
    expect(await reinjectContentScripts(api, vi.fn())).toBe(2);
    expect(api.tabIds).toHaveBeenCalledWith(MATCHES);
    expect(api.inject).toHaveBeenCalledWith(11, [LOADER]);
    expect(api.inject).toHaveBeenCalledWith(12, [LOADER]);
  });

  it('un onglet en échec (déchargé, page d’erreur) n’empêche pas les autres, sans exception', async () => {
    const onError = vi.fn();
    const api = fakeApi([{ js: [LOADER], matches: MATCHES }], [21, 22, 23], [22]);
    expect(await reinjectContentScripts(api, onError)).toBe(2);
    expect(onError).toHaveBeenCalledOnce();
    expect(onError).toHaveBeenCalledWith(22, expect.any(Error));
  });

  it('recherche des onglets impossible : signalée, aucune injection', async () => {
    const onError = vi.fn();
    const api = fakeApi([{ js: [LOADER], matches: MATCHES }], []);
    api.tabIds.mockRejectedValueOnce(new Error('tabs.query'));
    expect(await reinjectContentScripts(api, onError)).toBe(0);
    expect(onError).toHaveBeenCalledWith(null, expect.any(Error));
    expect(api.inject).not.toHaveBeenCalled();
  });

  it('script sans fichier ni motif : ignoré', async () => {
    const api = fakeApi([{ js: [], matches: MATCHES }, { js: [LOADER] }], [31]);
    expect(await reinjectContentScripts(api, vi.fn())).toBe(0);
    expect(api.tabIds).not.toHaveBeenCalled();
  });
});
