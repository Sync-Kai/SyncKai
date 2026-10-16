import { afterEach, describe, expect, it, vi } from 'vitest';
import { activePlatforms, grantedOptionalPlatforms, hasPlatformAccess, removePlatformAccess, requestPlatformAccess } from './platform-access';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('accès aux plateformes optionnelles (Netflix, Disney+)', () => {
  it('lit, demande et retire la seule origine de la plateforme', async () => {
    let granted = true;
    const contains = vi.fn(() => Promise.resolve(granted));
    const request = vi.fn(() => Promise.resolve(false));
    const remove = vi.fn(() => {
      granted = false;
      return Promise.resolve(true);
    });
    vi.stubGlobal('chrome', { permissions: { contains, request, remove } });

    expect(await hasPlatformAccess('netflix')).toBe(true);
    expect(contains).toHaveBeenCalledWith({ origins: ['https://*.netflix.com/*'] });
    expect(await requestPlatformAccess('disney')).toBe(false);
    expect(request).toHaveBeenCalledWith({ origins: ['https://*.disneyplus.com/*'] });
    // Chrome (et Firefox avec un accès accordé en https://) : un seul retrait, l'accès a disparu
    expect(await removePlatformAccess('disney')).toBe(true);
    expect(remove.mock.calls).toEqual([[{ origins: ['https://*.disneyplus.com/*'] }]]);
  });

  it('SEC-02, Firefox : un accès accordé en *:// avant la mise à jour est aussi retiré (retrait par chaîne exacte)', async () => {
    // Firefox garde le motif accordé tel quel (ExtensionPermissions) : contains(https://) vrai car *:// l'englobe, mais
    // remove(https://) ne retire rien (indexOf sur les chaînes stockées)
    let stored = ['*://*.netflix.com/*'];
    const contains = vi.fn(() => Promise.resolve(stored.length > 0));
    const remove = vi.fn((query: { origins: string[] }) => {
      stored = stored.filter((origin) => !query.origins.includes(origin));
      return Promise.resolve(true);
    });
    vi.stubGlobal('chrome', { permissions: { contains, remove } });

    expect(await hasPlatformAccess('netflix')).toBe(true);
    expect(await removePlatformAccess('netflix')).toBe(true);
    expect(remove.mock.calls).toEqual([[{ origins: ['https://*.netflix.com/*'] }], [{ origins: ['*://*.netflix.com/*'] }]]);
    expect(await hasPlatformAccess('netflix')).toBe(false);
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
    const contains = vi.fn((query: { origins: string[] }) => Promise.resolve(query.origins.includes('https://*.disneyplus.com/*')));
    vi.stubGlobal('chrome', { permissions: { contains } });
    expect(await grantedOptionalPlatforms()).toEqual(['disney']);
    expect(activePlatforms(['disney'])).toEqual(['crunchyroll', 'adn', 'disney']);
    expect(activePlatforms([])).toEqual(['crunchyroll', 'adn']);
    expect(activePlatforms(['disney', 'netflix'])).toEqual(['crunchyroll', 'adn', 'netflix', 'disney']);
  });
});
