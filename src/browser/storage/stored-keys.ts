// Noms des clés d'une zone de stockage, sans en cloner les valeurs (PERF-14).

/**
 * Ce que la liste des clés lit d'une zone : `getKeys` existe depuis Chrome 130 et dans les Firefox récents ; absent,
 * `get(null)` (tout le contenu, valeurs comprises) le remplace. Détecté à l'exécution : l'extension accepte Firefox 142.
 */
export interface KeyListingArea {
  get(keys: null): Promise<Record<string, unknown>>;
  getKeys?: () => Promise<string[]>;
}

/** Clés de la zone (local par défaut) */
export async function storedKeys(area: KeyListingArea = chrome.storage.local): Promise<string[]> {
  if (typeof area.getKeys === 'function') return area.getKeys();
  return Object.keys(await area.get(null));
}

/** Clés de la zone qui commencent par l'un des préfixes */
export async function storedKeysWithPrefix(prefixes: readonly string[], area?: KeyListingArea): Promise<string[]> {
  return (await storedKeys(area)).filter((key) => prefixes.some((prefix) => key.startsWith(prefix)));
}
