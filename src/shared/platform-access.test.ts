import { afterEach, describe, expect, it, vi } from 'vitest';
import { activePlatforms, grantedOptionalPlatforms, hasPlatformAccess, removePlatformAccess, requestPlatformAccess } from './platform-access';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('accès aux plateformes optionnelles (Netflix, Disney+)', () => {
  it('lit, demande et retire la seule origine de la plateforme', async () => {
    const contains = vi.fn(() => Promise.resolve(true));
    const request = vi.fn(() => Promise.resolve(false));
    const remove = vi.fn(() => Promise.resolve(true));
    vi.stubGlobal('chrome', { permissions: { contains, request, remove } });

    expect(await hasPlatformAccess('netflix')).toBe(true);
    expect(contains).toHaveBeenCalledWith({ origins: ['*://*.netflix.com/*'] });
    expect(await requestPlatformAccess('disney')).toBe(false);
    expect(request).toHaveBeenCalledWith({ origins: ['*://*.disneyplus.com/*'] });
    expect(await removePlatformAccess('disney')).toBe(true);
    expect(remove).toHaveBeenCalledWith({ origins: ['*://*.disneyplus.com/*'] });
  });

  it('plateforme du manifeste : toujours accessible, aucune permission lue', async () => {
    const contains = vi.fn(() => Promise.resolve(false));
    vi.stubGlobal('chrome', { permissions: { contains } });
    expect(await hasPlatformAccess('crunchyroll')).toBe(true);
    expect(contains).not.toHaveBeenCalled();
  });

  it('API absente ou en échec : accès considéré comme non accordé', async () => {
    vi.stubGlobal('chrome', {});
    expect(await hasPlatformAccess('disney')).toBe(false);
    vi.stubGlobal('chrome', { permissions: { contains: () => Promise.reject(new Error('x')) } });
    expect(await hasPlatformAccess('netflix')).toBe(false);
  });

  it('plateformes accordées et plateformes suivies', async () => {
    const contains = vi.fn((query: { origins: string[] }) => Promise.resolve(query.origins.includes('*://*.disneyplus.com/*')));
    vi.stubGlobal('chrome', { permissions: { contains } });
    expect(await grantedOptionalPlatforms()).toEqual(['disney']);
    expect(activePlatforms(['disney'])).toEqual(['crunchyroll', 'adn', 'disney']);
    expect(activePlatforms([])).toEqual(['crunchyroll', 'adn']);
    expect(activePlatforms(['disney', 'netflix'])).toEqual(['crunchyroll', 'adn', 'netflix', 'disney']);
  });
});
