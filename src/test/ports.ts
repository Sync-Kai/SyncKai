import { vi } from 'vitest';

// Livraison des MessagePort / MessageChannel dans les tests des ponts : événementielle (boucle d'événements de Node),
// jamais d'attente en temps réel. Avec des minuteurs simulés (`toFake` sans setImmediate), `advance` fait avancer le temps
// du test en laissant passer les messages entre chaque pas.

// Fourni par Node (types Node absents du tsconfig du projet)
declare function setImmediate(callback: () => void): unknown;

/** Messages des ports livrés (boucle d'événements réelle, hors minuteurs simulés) */
export async function flushPorts(): Promise<void> {
  for (let i = 0; i < 5; i++) await new Promise<void>((resolve) => setImmediate(resolve));
}

/** Minuteurs simulés de ces tests : setImmediate reste réel, `flushPorts` en dépend */
export function useBridgeFakeTimers(): void {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
}

/** Avance le temps simulé par pas de 100 ms en laissant passer les messages des ports entre chaque pas */
export async function advance(ms: number): Promise<void> {
  await flushPorts();
  for (let elapsed = 0; elapsed < ms; elapsed += 100) {
    await vi.advanceTimersByTimeAsync(Math.min(100, ms - elapsed));
    await flushPorts();
  }
}

/** Attend, en temps simulé, que `check` cesse de lever (équivalent de `vi.waitFor` qui laisse passer les messages des ports) */
export async function waitUntil(check: () => void, timeoutMs = 2000): Promise<void> {
  for (let elapsed = 0; ; elapsed += 100) {
    try {
      check();
      return;
    } catch (error) {
      if (elapsed >= timeoutMs) throw error;
    }
    await advance(100);
  }
}
