import { afterEach, describe, expect, it, vi } from 'vitest';
import { createWriteBatch, WRITE_BATCH_MS, WRITE_BATCH_SIZE } from './batch-writer';

// Lot d'écritures commun à l'analyse (correspondances de saison) et à l'application (résultats) de l'import.

afterEach(() => vi.useRealTimers());

describe('createWriteBatch', () => {
  it('plein à WRITE_BATCH_SIZE entrées distinctes ; une même clé ne compte qu’une fois (la dernière valeur l’emporte)', () => {
    const batch = createWriteBatch<number>();
    for (let i = 0; i < WRITE_BATCH_SIZE - 1; i++) batch.set(String(i), i);
    batch.set('0', 100);
    expect(batch.full()).toBe(false);
    batch.set('last', 1);
    expect(batch.full()).toBe(true);
    const taken = batch.take();
    expect(taken.size).toBe(WRITE_BATCH_SIZE);
    expect(taken.get('0')).toBe(100);
  });

  it('plein après WRITE_BATCH_MS même presque vide ; take() vide le lot et relance le délai', () => {
    vi.useFakeTimers();
    const batch = createWriteBatch<string>();
    batch.set('a', 'x');
    vi.advanceTimersByTime(WRITE_BATCH_MS - 1);
    expect(batch.full()).toBe(false);
    vi.advanceTimersByTime(1);
    expect(batch.full()).toBe(true);
    expect([...batch.take().keys()]).toEqual(['a']);
    expect(batch.take().size).toBe(0);
    expect(batch.full()).toBe(false);
  });
});
