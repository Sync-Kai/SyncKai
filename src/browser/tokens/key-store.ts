// Clé de chiffrement des tokens OAuth (SEC-01) : CryptoKey AES-GCM non extractible, conservée dans l'IndexedDB de
// l'origine de l'extension. Les scripts de contenu, qui tournent dans l'origine de la page, ne peuvent pas la lire :
// seules les pages de l'extension et le service worker (event page sous Firefox) y ont accès. Aucune clé n'est créée
// hors de l'origine de l'extension (une IndexedDB de page web serait lisible par le site).
// Remplacée par une clé en mémoire dans les tests unitaires (src/test/memory-key-store.ts, vitest.config.ts).

const DB_NAME = 'synckai-vault';
const DB_VERSION = 1;
const STORE = 'keys';
const TOKEN_KEY_ID = 'oauth-tokens';

/** Clé chargée une fois par vie du contexte (service worker, page) : jamais relue pour chaque token */
let cachedKey: CryptoKey | null = null;

function assertExtensionOrigin(): void {
  const origin = typeof location === 'undefined' ? null : location.origin;
  if (origin === null || origin !== new URL(chrome.runtime.getURL('')).origin) {
    throw new Error('Clé des tokens accessible uniquement depuis l’origine de l’extension');
  }
}

function settle<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = (): void => resolve(request.result);
    request.onerror = (): void => reject(request.error ?? new Error('IndexedDB : requête en échec'));
  });
}

function openVault(): Promise<IDBDatabase> {
  const request = indexedDB.open(DB_NAME, DB_VERSION);
  request.onupgradeneeded = (): void => {
    if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE);
  };
  return settle(request);
}

async function readKey(db: IDBDatabase): Promise<CryptoKey | null> {
  const value: unknown = await settle(db.transaction(STORE, 'readonly').objectStore(STORE).get(TOKEN_KEY_ID));
  return value instanceof CryptoKey ? value : null;
}

/**
 * Enregistre `key` sauf si une clé existe déjà (lecture et écriture dans la même transaction readwrite, sérialisée
 * entre contextes) : deux créations simultanées aboutissent à la même clé. Retourne la clé conservée.
 */
function storeKeyIfAbsent(db: IDBDatabase, key: CryptoKey): Promise<CryptoKey> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    const store = tx.objectStore(STORE);
    let kept = key;
    const existing = store.get(TOKEN_KEY_ID);
    existing.onsuccess = (): void => {
      const value: unknown = existing.result;
      if (value instanceof CryptoKey) kept = value;
      else store.put(key, TOKEN_KEY_ID);
    };
    tx.oncomplete = (): void => resolve(kept);
    tx.onerror = (): void => reject(tx.error ?? new Error('IndexedDB : transaction en échec'));
    tx.onabort = (): void => reject(tx.error ?? new Error('IndexedDB : transaction annulée'));
  });
}

/**
 * Clé des tokens. `create` : générée si absente (chiffrement) ; sinon null si absente (déchiffrement : une clé neuve
 * ne déchiffrerait rien). Lève une erreur si IndexedDB est indisponible (à traiter comme un échec passager).
 */
export async function getTokenKey(create: boolean): Promise<CryptoKey | null> {
  if (cachedKey) return cachedKey;
  assertExtensionOrigin();
  const db = await openVault();
  try {
    let key = await readKey(db);
    if (!key && create) {
      const generated = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
      key = await storeKeyIfAbsent(db, generated);
    }
    if (key) cachedKey = key;
    return key;
  } finally {
    db.close();
  }
}
