import { beforeEach, describe, expect, it, vi } from 'vitest';
import { STORAGE_KEYS } from '../../protocol/storage-keys';
import type { MalListEntry } from '../../shared/compare';
import { isSequelStore, type SequelRecord, type SequelState, type SequelStore } from '../../shared/sequels';
import { ApiError } from '../errors';
import { installFakeChrome } from '../../test/fake-chrome';

// Suites affichées revérifiées contre les listes à l'ouverture d'« Annoncées » / d'Activité : vrai stockage (fausse API
// chrome), requête AniList et liste MAL simulées.

const fakes = vi.hoisted(() => ({
  /** Ids AniList présents dans la liste (statut quelconque) */
  listed: new Set<number>(),
  calls: [] as number[][],
  fail: false,
  /** Appelé pendant la requête : permet de changer de compte entre la lecture des sessions et l'écriture */
  during: null as null | (() => Promise<void>),
  mal: [] as MalListEntry[],
  malCalls: 0,
}));

vi.mock('../anilist/client', () => ({
  anilistQuery: async (_query: string, _guard: unknown, variables: { ids: number[] }) => {
    fakes.calls.push(variables.ids);
    await fakes.during?.();
    if (fakes.fail) throw new ApiError('API_ERROR', 'Échec');
    return { Page: { media: variables.ids.map((id) => ({ id, mediaListEntry: fakes.listed.has(id) ? { status: 'CURRENT', progress: 0 } : null })) } };
  },
}));
vi.mock('../mal/full-list', () => ({
  fetchMalFullList: async () => {
    fakes.malCalls++;
    return fakes.mal;
  },
}));

const fake = installFakeChrome();
const { checkShownSequels, SHOWN_SEQUELS_CHECK_INTERVAL_MS } = await import('./listed');

const NOW = Date.UTC(2026, 10, 11, 12);
const ANILIST = { [STORAGE_KEYS.anilistToken]: { accessToken: 'a', expiresAt: Number.MAX_SAFE_INTEGER } };
const MAL = { [STORAGE_KEYS.malToken]: { accessToken: 'm', refreshToken: 'r', expiresAt: Number.MAX_SAFE_INTEGER } };

const record = (id: number, state: SequelState = 'seen'): SequelRecord => ({
  snapshot: { id, idMal: id + 1000, title: `Suite ${id}`, format: 'TV', status: 'NOT_YET_RELEASED', coverUrl: null, siteUrl: `https://anilist.co/anime/${id}`, year: 2027, month: 1, day: 10, season: null, seasonYear: null, sourceId: 9, sourceTitle: 'Source' },
  state,
  firstSeenAt: 100 + id,
});
const seed = (account: Record<string, unknown>, ...records: SequelRecord[]): void => {
  fake.reset({ ...account, [STORAGE_KEYS.sequelsState]: { records, known: records.map((r) => r.snapshot.id), seeded: ['anilist'], lastCheck: 1 } satisfies SequelStore });
};
const ids = (): number[] => {
  const value: unknown = fake.local.peek(STORAGE_KEYS.sequelsState);
  if (!isSequelStore(value)) throw new Error('store absent');
  return value.records.map((r) => r.snapshot.id);
};

beforeEach(() => {
  fakes.listed = new Set();
  fakes.calls = [];
  fakes.fail = false;
  fakes.during = null;
  fakes.mal = [];
  fakes.malCalls = 0;
});

describe('checkShownSequels', () => {
  it('AniList : 1 et 2 affichées, 2 en cours dans la liste → 2 retirée du store, 1 gardée', async () => {
    seed(ANILIST, record(1, 'new'), record(2));
    fakes.listed = new Set([2]);
    await checkShownSequels(NOW);
    expect(fakes.calls.map((chunk) => [...chunk].sort())).toEqual([[1, 2]]);
    expect(ids()).toEqual([1]);
  });

  it('suites écartées : ni demandées ni retirées', async () => {
    seed(ANILIST, record(1), record(3, 'dismissed'));
    fakes.listed = new Set([3]);
    await checkShownSequels(NOW);
    expect(fakes.calls).toEqual([[1]]);
    expect(ids()).toEqual([1, 3]);
  });

  it('plus de 50 suites affichées : lots de 50', async () => {
    seed(ANILIST, ...Array.from({ length: 51 }, (_, i) => record(i + 1)));
    await checkShownSequels(NOW);
    expect(fakes.calls.map((chunk) => chunk.length)).toEqual([50, 1]);
  });

  it('un deuxième appel dans les 10 min ne fait aucune requête ; après, une nouvelle', async () => {
    seed(ANILIST, record(1));
    await checkShownSequels(NOW);
    await checkShownSequels(NOW + SHOWN_SEQUELS_CHECK_INTERVAL_MS - 1);
    expect(fakes.calls).toHaveLength(1);
    await checkShownSequels(NOW + SHOWN_SEQUELS_CHECK_INTERVAL_MS);
    expect(fakes.calls).toHaveLength(2);
  });

  it('appels simultanés : une seule requête', async () => {
    seed(ANILIST, record(1));
    await Promise.all([checkShownSequels(NOW), checkShownSequels(NOW)]);
    expect(fakes.calls).toHaveLength(1);
  });

  it('autre compte après une vérification : pas freiné par celle de l’ancien compte', async () => {
    seed(ANILIST, record(1));
    await checkShownSequels(NOW);
    await chrome.storage.local.set({ [STORAGE_KEYS.sessionEpoch]: { anilist: 1 } });
    await checkShownSequels(NOW + 1);
    expect(fakes.calls).toHaveLength(2);
  });

  it('compte changé pendant la vérification : rien écrit', async () => {
    seed(ANILIST, record(1), record(2));
    fakes.listed = new Set([2]);
    fakes.during = async () => {
      await chrome.storage.local.set({ [STORAGE_KEYS.sessionEpoch]: { anilist: 1 } });
    };
    await checkShownSequels(NOW);
    expect(ids()).toEqual([1, 2]);
  });

  it('requête en échec : rien ne change, ne lève pas', async () => {
    seed(ANILIST, record(1), record(2));
    fakes.listed = new Set([2]);
    fakes.fail = true;
    await expect(checkShownSequels(NOW)).resolves.toBeNull();
    expect(ids()).toEqual([1, 2]);
  });

  it('sans compte connecté : aucune requête', async () => {
    seed({}, record(1));
    await checkShownSequels(NOW);
    expect(fakes.calls).toHaveLength(0);
    expect(fakes.malCalls).toBe(0);
  });

  it('MAL seul : la liste MAL de l’utilisateur, rapprochée par idMal ; aucune requête AniList', async () => {
    seed(MAL, record(1), record(2));
    fakes.mal = [{ malId: 1002, mediaId: null, title: 'Suite 2', coverUrl: null, status: 'PLANNING', progress: 0, score: null, repeat: 0 }];
    await checkShownSequels(NOW);
    expect(fakes.calls).toHaveLength(0);
    expect(fakes.malCalls).toBe(1);
    expect(ids()).toEqual([1]);
  });
});
