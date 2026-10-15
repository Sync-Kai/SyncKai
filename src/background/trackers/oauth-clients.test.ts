import { describe, expect, it } from 'vitest';
import { CHROME_EXTENSION_ID, classifyAuthFlowError, FIREFOX_ADDON_ID, getOAuthClients } from './oauth-clients';

describe('getOAuthClients', () => {
  it('renvoie les clients du Chrome Web Store pour son ID', () => {
    expect(getOAuthClients(CHROME_EXTENSION_ID)).toEqual({
      anilistClientId: '52346',
      malClientId: '84d05521c007a529cc458421bd0940c5',
    });
  });

  it('associe l’ID Firefox à ses propres clients', () => {
    expect(FIREFOX_ADDON_ID).toBe('synckai@sync-kai.github.io');
    expect(getOAuthClients(FIREFOX_ADDON_ID)).toEqual({ anilistClientId: '52509', malClientId: '1846238e6ea67a5109899f5311a51d15' });
  });

  it('renvoie null pour un ID inconnu (build non empaqueté sans clé)', () => {
    expect(getOAuthClients('abcdefghijklmnopabcdefghijklmnop')).toBeNull();
    expect(getOAuthClients('')).toBeNull();
    expect(getOAuthClients('toString')).toBeNull();
    expect(getOAuthClients('__proto__')).toBeNull();
  });
});

describe('classifyAuthFlowError', () => {
  it.each([
    ['The user did not approve access.', 'cancelled'],
    ['User cancelled or denied access.', 'cancelled'],
    ['User canceled the sign-in', 'cancelled'],
    ['Access DENIED', 'cancelled'],
    ['Authorization page could not be loaded.', 'rejected'],
    // Configuration avant annulation : un message qui mélangerait les deux reste « rejected »
    ['Authorization page could not be loaded (request cancelled)', 'rejected'],
    ['Requested interaction not supported', 'failed'],
    ['Invalid redirect URL', 'failed'],
    ['', 'failed'],
  ] as const)('« %s » → %s', (message, expected) => {
    expect(classifyAuthFlowError(message)).toBe(expected);
  });
});
