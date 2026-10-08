import { afterEach, describe, expect, it, vi } from 'vitest';
import { hasNetflixAccess, removeNetflixAccess, requestNetflixAccess } from './netflix-access';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('accès Netflix (permission optionnelle)', () => {
  it('lit, demande et retire la seule origine netflix.com', async () => {
    const contains = vi.fn(() => Promise.resolve(true));
    const request = vi.fn(() => Promise.resolve(false));
    const remove = vi.fn(() => Promise.resolve(true));
    vi.stubGlobal('chrome', { permissions: { contains, request, remove } });
    const origins = { origins: ['*://*.netflix.com/*'] };

    expect(await hasNetflixAccess()).toBe(true);
    expect(contains).toHaveBeenCalledWith(origins);
    expect(await requestNetflixAccess()).toBe(false);
    expect(request).toHaveBeenCalledWith(origins);
    expect(await removeNetflixAccess()).toBe(true);
    expect(remove).toHaveBeenCalledWith(origins);
  });

  it('API absente ou en échec : accès considéré comme non accordé', async () => {
    vi.stubGlobal('chrome', {});
    expect(await hasNetflixAccess()).toBe(false);
    vi.stubGlobal('chrome', { permissions: { contains: () => Promise.reject(new Error('x')) } });
    expect(await hasNetflixAccess()).toBe(false);
  });
});
