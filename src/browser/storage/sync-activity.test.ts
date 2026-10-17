import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SYNC_ACTIVITY_KEY } from '../../protocol/storage-keys';
import { installFakeChrome } from '../../test/fake-chrome';
import { isSyncActivity, syncStartedAt, withSyncActivity } from './sync-activity';

// « Synchro… » de la barre d'état : signal posé par le service worker dans chrome.storage.session pendant les écritures
// d'une synchro, retiré après, jamais bloquant

const fake = installFakeChrome();

beforeEach(() => {
  fake.reset();
  vi.spyOn(console, 'debug').mockImplementation(() => {});
});

afterEach(() => vi.restoreAllMocks());

describe('withSyncActivity', () => {
  it('signal posé dans storage.session pendant le travail (jamais local), retiré après', async () => {
    let during: unknown;
    const result = await withSyncActivity(async () => {
      during = fake.session.peek(SYNC_ACTIVITY_KEY);
      return 42;
    }, 1_000);
    expect(result).toBe(42);
    expect(during).toEqual({ startedAt: 1_000 });
    expect(fake.session.peek(SYNC_ACTIVITY_KEY)).toBeUndefined();
    expect(fake.local.data.size).toBe(0);
  });

  it('retiré aussi après une erreur, qui est relancée', async () => {
    await expect(withSyncActivity(() => Promise.reject(new Error('boom')), 1_000)).rejects.toThrow('boom');
    expect(fake.session.peek(SYNC_ACTIVITY_KEY)).toBeUndefined();
  });

  it('synchro plus récente lancée entre-temps : son signal n’est pas retiré par la première', async () => {
    await withSyncActivity(async () => {
      await fake.session.set({ [SYNC_ACTIVITY_KEY]: { startedAt: 2_000 } });
    }, 1_000);
    expect(fake.session.peek(SYNC_ACTIVITY_KEY)).toEqual({ startedAt: 2_000 });
  });

  it('stockage indisponible : le travail se fait quand même', async () => {
    vi.spyOn(fake.session, 'set').mockRejectedValue(new Error('quota'));
    vi.spyOn(fake.session, 'get').mockRejectedValue(new Error('quota'));
    await expect(withSyncActivity(async () => 'ok', 1_000)).resolves.toBe('ok');
  });
});

describe('lecture du signal', () => {
  it('forme validée ; début lu, null sinon', async () => {
    expect(isSyncActivity({ startedAt: 5 })).toBe(true);
    expect(isSyncActivity({ startedAt: '5' })).toBe(false);
    expect(isSyncActivity(null)).toBe(false);
    expect(await syncStartedAt()).toBeNull();
    await fake.session.set({ [SYNC_ACTIVITY_KEY]: { startedAt: 7 } });
    expect(await syncStartedAt()).toBe(7);
    await fake.session.set({ [SYNC_ACTIVITY_KEY]: 'x' });
    expect(await syncStartedAt()).toBeNull();
  });
});
