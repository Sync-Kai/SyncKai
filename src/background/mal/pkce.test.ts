import { describe, expect, it } from 'vitest';
import { createCodeVerifier, createState, VERIFIER_LENGTH } from './pkce';

describe('createCodeVerifier', () => {
  it('produit 64 caractères "unreserved" (RFC 7636)', () => {
    const verifier = createCodeVerifier();
    expect(verifier).toHaveLength(VERIFIER_LENGTH);
    expect(verifier).toMatch(/^[A-Za-z0-9\-._~]+$/);
  });

  it('est déterministe pour des octets donnés et couvre tout l’alphabet', () => {
    const bytes = Uint8Array.from({ length: VERIFIER_LENGTH }, (_, i) => i);
    expect(createCodeVerifier(bytes).startsWith('ABCDEFGHIJ')).toBe(true);
    expect(createCodeVerifier(Uint8Array.from({ length: VERIFIER_LENGTH }, () => 65))).toBe('~'.repeat(VERIFIER_LENGTH));
  });

  it('génère des valeurs différentes à chaque appel', () => {
    expect(createCodeVerifier()).not.toBe(createCodeVerifier());
    expect(createState()).toHaveLength(32);
  });
});
