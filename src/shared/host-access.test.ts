import { afterEach, describe, expect, it, vi } from 'vitest';
import manifest from '../../manifest.json';
import { hasHostAccess, requiredOrigins } from './host-access';

describe('requiredOrigins', () => {
  it('host_permissions + sites des scripts de contenu, sans doublon', () => {
    expect(requiredOrigins(manifest)).toEqual([
      '*://*.crunchyroll.com/*',
      'https://graphql.anilist.co/*',
      'https://myanimelist.net/*',
      'https://api.myanimelist.net/*',
      '*://animationdigitalnetwork.com/*',
      '*://*.animationdigitalnetwork.com/*',
    ]);
  });

  it('manifeste sans origines', () => {
    expect(requiredOrigins({})).toEqual([]);
  });
});

describe('hasHostAccess', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('interroge chrome.permissions.contains', async () => {
    const contains = vi.fn(() => Promise.resolve(false));
    vi.stubGlobal('chrome', { permissions: { contains } });
    expect(await hasHostAccess(['*://*.crunchyroll.com/*'])).toBe(false);
    expect(contains).toHaveBeenCalledWith({ origins: ['*://*.crunchyroll.com/*'] });
  });

  it('API absente ou en échec : considéré comme accordé', async () => {
    vi.stubGlobal('chrome', {});
    expect(await hasHostAccess(['*://*.crunchyroll.com/*'])).toBe(true);
    vi.stubGlobal('chrome', { permissions: { contains: () => Promise.reject(new Error('x')) } });
    expect(await hasHostAccess(['*://*.crunchyroll.com/*'])).toBe(true);
  });

  it('aucune origine : rien à vérifier', async () => {
    expect(await hasHostAccess([])).toBe(true);
  });
});
