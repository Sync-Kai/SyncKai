/**
 * Résout avec `onTimeout()` si `promise` n'a pas abouti après `ms` millisecondes (service worker bloqué…).
 * Le premier qui aboutit l'emporte : une réponse tardive est ignorée. Le minuteur est toujours libéré.
 */
export function withTimeout<T>(promise: Promise<T>, ms: number, onTimeout: () => T): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<T>((resolve) => {
    timer = setTimeout(() => resolve(onTimeout()), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}
