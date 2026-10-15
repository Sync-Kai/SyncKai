import { describe, expect, it, vi } from 'vitest';
import { reinjectContentScripts, reinjectionPlan, type ContentReinjectionApi, type ManifestContentScript } from './content-reinjection';

// Réinjection des scripts de contenu du manifeste dans les onglets ouverts (installation, mise à jour).

const SCRIPT = 'src/content/crunchyroll/content-crunchyroll.iife.js';
const MATCHES = ['*://*.crunchyroll.com/*'];
const ADN_SCRIPT = 'src/content/adn/content-adn.iife.js';
const ADN_MATCHES = ['*://animationdigitalnetwork.com/*', '*://*.animationdigitalnetwork.com/*'];

/** `tabs` : onglets ouverts, les mêmes pour tous les motifs ou selon les motifs demandés */
function fakeApi(scripts: ManifestContentScript[], tabs: number[] | ((matches: string[]) => number[]), failing: number[] = []): ContentReinjectionApi & {
  inject: ReturnType<typeof vi.fn>;
  tabIds: ReturnType<typeof vi.fn>;
} {
  return {
    contentScripts: () => scripts,
    tabIds: vi.fn((matches: string[]) => Promise.resolve(typeof tabs === 'function' ? tabs(matches) : tabs)),
    inject: vi.fn((tabId: number) => (failing.includes(tabId) ? Promise.reject(new Error('Cannot access contents of the page')) : Promise.resolve())),
  };
}

describe('reinjectContentScripts', () => {
  it('exécute le script du manifeste dans chaque onglet ouvert correspondant', async () => {
    const api = fakeApi([{ js: [SCRIPT], matches: MATCHES }], [11, 12]);
    expect(await reinjectContentScripts(api, vi.fn())).toBe(2);
    expect(api.tabIds).toHaveBeenCalledWith(MATCHES);
    expect(api.inject).toHaveBeenCalledWith(11, [SCRIPT], 'ISOLATED');
    expect(api.inject).toHaveBeenCalledWith(12, [SCRIPT], 'ISOLATED');
  });

  it('manifeste réel : pont Crunchyroll du monde MAIN avant le script isolé qui lui demande son canal, script ADN dans ses seuls onglets', async () => {
    const bridge = 'src/content/crunchyroll/page-bridge.iife.js';
    // Onglet 11 sur Crunchyroll, onglet 21 sur ADN
    const scripts = [{ js: [bridge], matches: MATCHES, world: 'MAIN' }, { js: [SCRIPT], matches: MATCHES }, { js: [ADN_SCRIPT], matches: ADN_MATCHES }];
    const api = fakeApi(scripts, (matches) => (matches === ADN_MATCHES ? [21] : [11]));
    expect(await reinjectContentScripts(api, vi.fn())).toBe(3);
    expect(api.inject.mock.calls).toEqual([
      [11, [bridge], 'MAIN'],
      [11, [SCRIPT], 'ISOLATED'],
      [21, [ADN_SCRIPT], 'ISOLATED'],
    ]);
  });

  it('un onglet en échec (déchargé, page d’erreur) n’empêche pas les autres, sans exception', async () => {
    const onError = vi.fn();
    const api = fakeApi([{ js: [SCRIPT], matches: MATCHES }], [21, 22, 23], [22]);
    expect(await reinjectContentScripts(api, onError)).toBe(2);
    expect(onError).toHaveBeenCalledOnce();
    expect(onError).toHaveBeenCalledWith(22, expect.any(Error));
  });

  it('recherche des onglets impossible : signalée, aucune injection', async () => {
    const onError = vi.fn();
    const api = fakeApi([{ js: [SCRIPT], matches: MATCHES }], []);
    api.tabIds.mockRejectedValueOnce(new Error('tabs.query'));
    expect(await reinjectContentScripts(api, onError)).toBe(0);
    expect(onError).toHaveBeenCalledWith(null, expect.any(Error));
    expect(api.inject).not.toHaveBeenCalled();
  });

  it('script sans fichier ni motif : ignoré', async () => {
    const api = fakeApi([{ js: [], matches: MATCHES }, { js: [SCRIPT] }], [31]);
    expect(await reinjectContentScripts(api, vi.fn())).toBe(0);
    expect(api.tabIds).not.toHaveBeenCalled();
  });
});

describe('reinjectionPlan', () => {
  it('Chrome, installation ou mise à jour : Crunchyroll / ADN et Netflix', () => {
    expect(reinjectionPlan('update', 'chrome')).toEqual({ manifest: true, registered: true });
    expect(reinjectionPlan('install', 'chrome')).toEqual({ manifest: true, registered: true });
  });

  it('Firefox : scripts du manifeste exécutés par le navigateur, Netflix (scripts enregistrés effacés) repris', () => {
    expect(reinjectionPlan('update', 'firefox')).toEqual({ manifest: false, registered: true });
    expect(reinjectionPlan('install', 'firefox')).toEqual({ manifest: false, registered: true });
  });

  it('mise à jour du navigateur ou d’un module partagé : rien', () => {
    for (const target of ['chrome', 'firefox'] as const) {
      expect(reinjectionPlan('chrome_update', target)).toEqual({ manifest: false, registered: false });
      expect(reinjectionPlan('browser_update', target)).toEqual({ manifest: false, registered: false });
      expect(reinjectionPlan('shared_module_update', target)).toEqual({ manifest: false, registered: false });
    }
  });
});