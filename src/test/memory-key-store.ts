// Clé des tokens en mémoire pour les tests unitaires (Node n'a pas d'IndexedDB) : remplace src/shared/token-key-store.ts
// dans tous les tests (vi.mock de src/test/setup.ts). Même contrat : `create` génère la clé si elle manque.

let key: CryptoKey | null = null;

export async function getTokenKey(create: boolean): Promise<CryptoKey | null> {
  if (!key && create) key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  return key;
}

/** Simule une IndexedDB vidée (clé perdue) : les tokens chiffrés avant ne se déchiffrent plus */
export function forgetTokenKey(): void {
  key = null;
}
