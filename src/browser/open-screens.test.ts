import { afterEach, describe, expect, it, vi } from 'vitest';
import { installFakeChrome } from '../test/fake-chrome';

installFakeChrome();
const { hasOpenScreen } = await import('./open-screens');

// Écrans ouverts (runtime.getContexts, Chrome 116+) : popup et panneau, y compris leurs pages ouvertes dans un onglet

const runtime = chrome.runtime as unknown as { getContexts?: unknown };
const contexts = (list: { contextType: string; documentUrl?: string }[]): void => {
  runtime.getContexts = vi.fn(() => Promise.resolve(list));
};

afterEach(() => {
  delete runtime.getContexts;
});

describe('hasOpenScreen', () => {
  it('popup ou panneau latéral ouvert : vrai ; demandés avec les onglets de l’extension', async () => {
    contexts([{ contextType: 'POPUP' }]);
    expect(await hasOpenScreen()).toBe(true);
    contexts([{ contextType: 'SIDE_PANEL' }]);
    expect(await hasOpenScreen()).toBe(true);
    expect(runtime.getContexts).toHaveBeenCalledWith({ contextTypes: ['POPUP', 'SIDE_PANEL', 'TAB'] });
  });

  it('page du popup ou du panneau ouverte dans un onglet : vrai ; autre page de l’extension, ou aucun contexte : faux', async () => {
    contexts([{ contextType: 'TAB', documentUrl: 'chrome-extension://x/src/popup/popup.html' }]);
    expect(await hasOpenScreen()).toBe(true);
    contexts([{ contextType: 'TAB', documentUrl: 'chrome-extension://x/src/sidepanel/sidepanel.html' }]);
    expect(await hasOpenScreen()).toBe(true);
    contexts([{ contextType: 'TAB', documentUrl: 'chrome-extension://x/src/import-cr/import-cr.html' }, { contextType: 'TAB' }]);
    expect(await hasOpenScreen()).toBe(false);
    contexts([]);
    expect(await hasOpenScreen()).toBe(false);
  });

  it('API absente (Firefox) ou en échec : inconnu (null)', async () => {
    expect(await hasOpenScreen()).toBeNull();
    runtime.getContexts = vi.fn(() => Promise.reject(new Error('indisponible')));
    expect(await hasOpenScreen()).toBeNull();
  });
});
