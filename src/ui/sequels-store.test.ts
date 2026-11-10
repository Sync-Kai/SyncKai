import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SETTINGS_STORAGE_KEY } from '../shared/settings';
import { STORAGE_KEYS } from '../protocol/storage-keys';
import { EMPTY_SEQUEL_STORE, type SequelRecord, type SequelStore } from '../shared/sequels';
import { createSequelsStore } from './sequels-store';

type Listener = (changes: Record<string, { newValue?: unknown }>, area: string) => void;

const record = (id: number, state: SequelRecord['state'], firstSeenAt: number): SequelRecord => ({
  snapshot: { id, idMal: null, title: `S${id}`, format: 'TV', status: 'NOT_YET_RELEASED', coverUrl: null, siteUrl: 'https://anilist.co/anime/1', year: null, month: null, day: null, season: null, seasonYear: null, sourceId: 1, sourceTitle: 'Source' },
  state,
  firstSeenAt,
});
const stored = (records: SequelRecord[]): SequelStore => ({ ...EMPTY_SEQUEL_STORE, records });

let listeners: Set<Listener>;
let data: Record<string, unknown>;
const flush = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

beforeEach(() => {
  listeners = new Set();
  data = {};
  vi.stubGlobal('chrome', {
    storage: {
      local: { get: vi.fn(async (keys: string | string[]) => Object.fromEntries([keys].flat().map((key) => [key, data[key]]))) },
      onChanged: { addListener: (l: Listener) => listeners.add(l), removeListener: (l: Listener) => listeners.delete(l) },
    },
  });
});
afterEach(() => vi.unstubAllGlobals());

describe('createSequelsStore', () => {
  it('lit sequels:state, ne publie que les suites visibles, la plus récente d’abord', async () => {
    data[STORAGE_KEYS.sequelsState] = stored([record(1, 'seen', 10), record(2, 'dismissed', 30), record(3, 'new', 20)]);
    const store = createSequelsStore();
    await flush();
    expect(store.get().map((r) => r.snapshot.id)).toEqual([3, 1]);
    store.dispose();
  });

  it('« Alertes de suites » coupé : aucune suite publiée, et elles reviennent dès que le réglage est rallumé', async () => {
    data[STORAGE_KEYS.sequelsState] = stored([record(1, 'new', 10)]);
    data[SETTINGS_STORAGE_KEY] = { sequelAlerts: false };
    const store = createSequelsStore();
    await flush();
    expect(store.get()).toEqual([]);
    const [listener] = [...listeners];
    listener?.({ [STORAGE_KEYS.sequelsState]: { newValue: stored([record(1, 'new', 10), record(2, 'new', 20)]) } }, 'local');
    expect(store.get()).toEqual([]);
    listener?.({ [SETTINGS_STORAGE_KEY]: { newValue: { sequelAlerts: true } } }, 'local');
    expect(store.get().map((r) => r.snapshot.id)).toEqual([2, 1]);
    listener?.({ [SETTINGS_STORAGE_KEY]: { newValue: { sequelAlerts: false } } }, 'local');
    expect(store.get()).toEqual([]);
    store.dispose();
  });

  it('valeur absente ou invalide : liste vide', async () => {
    data[STORAGE_KEYS.sequelsState] = { records: 'x' };
    const store = createSequelsStore();
    await flush();
    expect(store.get()).toEqual([]);
    store.dispose();
  });

  it('suit storage.onChanged pour cette clé seulement, jusqu’à dispose()', async () => {
    const store = createSequelsStore();
    await flush();
    const [listener] = [...listeners];
    listener?.({ other: { newValue: 1 } }, 'local');
    expect(store.get()).toEqual([]);
    listener?.({ [STORAGE_KEYS.sequelsState]: { newValue: stored([record(7, 'new', 5)]) } }, 'sync');
    expect(store.get()).toEqual([]);
    listener?.({ [STORAGE_KEYS.sequelsState]: { newValue: stored([record(7, 'new', 5)]) } }, 'local');
    expect(store.get().map((r) => r.snapshot.id)).toEqual([7]);
    listener?.({ [STORAGE_KEYS.sequelsState]: { newValue: undefined } }, 'local');
    expect(store.get()).toEqual([]);
    store.dispose();
    expect(listeners.size).toBe(0);
  });

  it('unlisted : les ids de toutes les suites sans liste, écartées comprises (la fiche de la page garde « + À regarder »)', async () => {
    data[STORAGE_KEYS.sequelsState] = stored([record(1, 'seen', 10), record(2, 'dismissed', 30), record(3, 'new', 20)]);
    const store = createSequelsStore();
    await flush();
    expect([...store.unlisted.get()].sort()).toEqual([1, 2, 3]);
    const [listener] = [...listeners];
    listener?.({ [SETTINGS_STORAGE_KEY]: { newValue: { sequelAlerts: false } } }, 'local');
    expect(store.unlisted.get().size).toBe(0);
    store.dispose();
  });
});
