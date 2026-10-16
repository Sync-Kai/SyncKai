/** Vrai si la valeur est un objet non nul (base des type guards sur les données externes). */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/**
 * JSON d'une chaîne d'au plus `maxLength` caractères ; null si ce n'est pas une chaîne, si elle est trop longue ou
 * illisible. Messages des ponts (chaînes JSON) et réponses observées par les ponts du monde MAIN.
 */
export function parseJsonBounded(text: unknown, maxLength: number, parse: (text: string) => unknown = JSON.parse): unknown {
  if (typeof text !== 'string' || text.length === 0 || text.length > maxLength) return null;
  try {
    return parse(text);
  } catch {
    return null;
  }
}

/**
 * Exécute `install` au plus une fois par `flag` sur ce global (garde par version des ponts du monde MAIN : double
 * injection, bfcache, réinjection après une mise à jour). Retourne true si installé.
 */
export function installOnce(global: object, flag: symbol, install: () => void): boolean {
  if (Reflect.get(global, flag)) return false;
  Reflect.defineProperty(global, flag, { value: true });
  install();
  return true;
}
