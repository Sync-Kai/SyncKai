import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { withTimeout } from './with-timeout';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('withTimeout', () => {
  it('renvoie la réponse arrivée à temps et libère le minuteur', async () => {
    const onTimeout = vi.fn(() => 'timeout');
    await expect(withTimeout(Promise.resolve('ok'), 1_000, onTimeout)).resolves.toBe('ok');
    expect(vi.getTimerCount()).toBe(0);
    expect(onTimeout).not.toHaveBeenCalled();
  });

  it('résout avec onTimeout quand la promesse ne répond jamais', async () => {
    const result = withTimeout(new Promise<string>(() => {}), 1_000, () => 'timeout');
    await vi.advanceTimersByTimeAsync(999);
    let settled = false;
    void result.then(() => (settled = true));
    await Promise.resolve();
    expect(settled).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    await expect(result).resolves.toBe('timeout');
  });

  it('ignore une réponse tardive', async () => {
    let answer: (value: string) => void = () => {};
    const late = new Promise<string>((resolve) => (answer = resolve));
    const result = withTimeout(late, 1_000, () => 'timeout');
    await vi.advanceTimersByTimeAsync(1_000);
    answer('late');
    await expect(result).resolves.toBe('timeout');
  });

  it('propage un rejet arrivé avant le délai et libère le minuteur', async () => {
    await expect(withTimeout(Promise.reject(new Error('boom')), 1_000, () => 'timeout')).rejects.toThrow('boom');
    expect(vi.getTimerCount()).toBe(0);
  });
});
