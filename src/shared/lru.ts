// Petites tables bornées (ponts du monde MAIN, clients isolés) : la plus récente en dernier (ordre d'insertion), les plus
// anciennes retirées au-delà de la borne. Module pur, sûr pour le monde MAIN (aucune API du navigateur).

/** Garde `value` sous `key` (la plus récente en dernier), au plus `max` entrées */
export function keep<K, V>(map: Map<K, V>, key: K, value: V, max: number): void {
  map.delete(key);
  map.set(key, value);
  trim(map, max);
}

/** Ajoute `key` à l'ensemble (la plus récente en dernier), au plus `max` clés */
export function keepKey<K>(set: Set<K>, key: K, max: number): void {
  set.delete(key);
  set.add(key);
  trim(set, max);
}

/** Retire les plus anciennes entrées (ordre d'insertion) au-delà de `max` */
export function trim<K, V>(map: Map<K, V> | Set<K>, max: number): void {
  for (const key of [...map.keys()].slice(0, Math.max(0, map.size - max))) map.delete(key);
}
