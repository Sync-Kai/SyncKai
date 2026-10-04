import { afterEach, describe, expect, it, vi } from 'vitest';
import { createLogger, createLoggerFor } from './logger';

function spyConsole() {
  return {
    debug: vi.spyOn(console, 'debug').mockImplementation(() => {}),
    info: vi.spyOn(console, 'info').mockImplementation(() => {}),
    warn: vi.spyOn(console, 'warn').mockImplementation(() => {}),
    error: vi.spyOn(console, 'error').mockImplementation(() => {}),
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('createLoggerFor', () => {
  it('logue tous les niveaux avec le préfixe quand le debug est actif', () => {
    const spies = spyConsole();
    const log = createLoggerFor('test', true);
    log.debug('a', 1);
    log.info('b');
    log.warn('c');
    log.error('d');
    expect(spies.debug).toHaveBeenCalledWith('[SyncKai:test]', 'a', 1);
    expect(spies.info).toHaveBeenCalledWith('[SyncKai:test]', 'b');
    expect(spies.warn).toHaveBeenCalledWith('[SyncKai:test]', 'c');
    expect(spies.error).toHaveBeenCalledWith('[SyncKai:test]', 'd');
  });

  it('reste muet en debug/info mais garde warn/error quand le debug est inactif', () => {
    const spies = spyConsole();
    const log = createLoggerFor('prod', false);
    log.debug('a');
    log.info('b');
    log.warn('c');
    log.error('d');
    expect(spies.debug).not.toHaveBeenCalled();
    expect(spies.info).not.toHaveBeenCalled();
    expect(spies.warn).toHaveBeenCalledWith('[SyncKai:prod]', 'c');
    expect(spies.error).toHaveBeenCalledWith('[SyncKai:prod]', 'd');
  });
});

describe('createLogger', () => {
  it('suit __SYNCKAI_DEBUG__ (actif dans les tests)', () => {
    const spies = spyConsole();
    createLogger('scope').info('x');
    expect(spies.info).toHaveBeenCalledWith('[SyncKai:scope]', 'x');
  });
});

describe('journal des warn/error', () => {
  it('consigne warn et error, jamais debug ni info', () => {
    spyConsole();
    const record = vi.fn();
    const log = createLoggerFor('sync', true, { record, flush: () => Promise.resolve() });
    log.debug('a');
    log.info('b');
    log.warn('c', 1);
    log.error('d');
    expect(record.mock.calls).toEqual([
      ['warn', 'sync', ['c', 1]],
      ['error', 'sync', ['d']],
    ]);
  });

  it('createLogger ne lève pas sans API chrome (tests)', () => {
    spyConsole();
    expect(() => createLogger('scope').error('x')).not.toThrow();
  });
});
