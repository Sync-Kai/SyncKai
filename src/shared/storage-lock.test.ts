import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { STORAGE_LOCK } from './storage-lock-core';
import { LOCK_WAIT_WARN_MS, withStorageLock } from './storage-lock';

/** Faux navigator.locks : le verrou n'est accordé qu'à l'appel de `grant` */
function fakeLocks() {
  const waiting: (() => void)[] = [];
  const locks = {
    request: vi.fn(<T>(_name: string, task: () => Promise<T>): Promise<T> => new Promise<void>((resolve) => waiting.push(resolve)).then(task)),
    query: vi.fn(
      async (): Promise<LockManagerSnapshot> => ({
        held: [{ name: STORAGE_LOCK, mode: 'exclusive', clientId: 'holder-1' }],
        pending: [
          { name: STORAGE_LOCK, mode: 'exclusive', clientId: 'popup-2' },
          { name: 'autre', mode: 'exclusive', clientId: 'x' },
        ],
      }),
    ),
  };
  return { locks, grant: () => waiting.shift()?.() };
}

let warn: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  vi.useFakeTimers();
  warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('withStorageLock', () => {
  it('verrou obtenu rapidement : tâche exécutée, aucun avertissement, minuteur libéré', async () => {
    const { locks, grant } = fakeLocks();
    vi.stubGlobal('navigator', { locks });
    const result = withStorageLock(async () => 'ok');
    grant();
    await expect(result).resolves.toBe('ok');
    expect(locks.request).toHaveBeenCalledWith(STORAGE_LOCK, expect.any(Function));
    await vi.advanceTimersByTimeAsync(LOCK_WAIT_WARN_MS * 2);
    expect(warn).not.toHaveBeenCalled();
    expect(locks.query).not.toHaveBeenCalled();
  });

  it('attente > 10 s : un seul avertissement avec l’état du verrou, puis la tâche s’exécute normalement', async () => {
    const { locks, grant } = fakeLocks();
    vi.stubGlobal('navigator', { locks });
    const task = vi.fn(async () => 42);
    const result = withStorageLock(task);

    await vi.advanceTimersByTimeAsync(LOCK_WAIT_WARN_MS - 1);
    expect(warn).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(warn).toHaveBeenCalledTimes(1);
    const line = warn.mock.calls[0].map(String).join(' ');
    expect(line).toContain('[SyncKai:lock]');
    expect(line).toContain('détenu 1 [holder-1], en attente 1 [popup-2]');
    expect(task).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(LOCK_WAIT_WARN_MS * 3);
    expect(warn).toHaveBeenCalledTimes(1);

    grant();
    await expect(result).resolves.toBe(42);
    expect(task).toHaveBeenCalledTimes(1);
  });

  it('navigator.locks.query indisponible : avertissement quand même, sans exception', async () => {
    const { locks, grant } = fakeLocks();
    locks.query.mockRejectedValue(new Error('non pris en charge'));
    vi.stubGlobal('navigator', { locks });
    const result = withStorageLock(async () => 'ok');
    await vi.advanceTimersByTimeAsync(LOCK_WAIT_WARN_MS);
    expect(warn.mock.calls[0].map(String).join(' ')).toContain('état du verrou indisponible');
    grant();
    await expect(result).resolves.toBe('ok');
  });
});
