import { beforeEach, describe, expect, it, vi } from 'vitest';
import { setLocale } from '../../i18n';
import { STORAGE_KEYS } from '../../protocol/storage-keys';
import type { AniListListEntry, MalListEntry } from '../../shared/compare';
import { isSequelStore, type SequelStore } from '../../shared/sequels';
import { ApiError } from '../errors';
import { installFakeChrome } from '../../test/fake-chrome';

// Vérification quotidienne des suites : vrai stockage (fausse API chrome), listes, relations et notifications simulées.

const fakes = vi.hoisted(() => ({
  /** Séries sources → suites (id de la source → arêtes SEQUEL) */
  sequels: new Map<number, { id: number; idMal: number | null }[]>(),
  relationCalls: 0,
  /** Numéro (1 = premier) de la requête de relations qui échoue */
  failRelationsAt: 0,
  anilist: [] as unknown[],
  mal: [] as unknown[],
  /** idMal → fiche AniList (requête idMal_in) */
  catalog: new Map<number, number>(),
  /** Appelé au premier appel de relations : permet de changer le stockage entre la lecture des sessions et l'écriture */
  onRelations: null as null | (() => Promise<void>),
  create: vi.fn<(id: string, options: { buttons?: { title: string }[]; title: string; message: string }) => Promise<string>>(),
  permission: vi.fn<() => Promise<'granted' | 'denied'>>(),
}));

vi.mock('../anilist/client', () => ({
  anilistPublicQuery: async (query: string, _guard: unknown, variables: { ids: number[] }) => {
    if (query.includes('idMal_in')) return { Page: { media: variables.ids.flatMap((idMal) => (fakes.catalog.has(idMal) ? [{ id: fakes.catalog.get(idMal), idMal }] : [])) } };
    fakes.relationCalls++;
    if (fakes.relationCalls === fakes.failRelationsAt) throw new ApiError('RATE_LIMITED', 'Limite');
    await fakes.onRelations?.();
    return {
      Page: {
        media: variables.ids.map((id) => ({
          id,
          title: { userPreferred: `Série ${id}` },
          relations: {
            edges: (fakes.sequels.get(id) ?? []).map((node) => ({
              relationType: 'SEQUEL',
              node: { ...node, type: 'ANIME', format: 'TV', status: 'NOT_YET_RELEASED', title: { userPreferred: `Suite ${node.id}` }, coverImage: null, siteUrl: `https://anilist.co/anime/${node.id}`, startDate: { year: 2027, month: 1, day: 10 }, season: null, seasonYear: null },
            })),
          },
        })),
      },
    };
  },
}));
vi.mock('../anilist/full-list', () => ({ fetchAniListFullList: async () => fakes.anilist }));
vi.mock('../mal/full-list', () => ({ fetchMalFullList: async () => fakes.mal }));

const fake = installFakeChrome({ extra: { notifications: { create: fakes.create, getPermissionLevel: fakes.permission } } });
const { checkSequels, SEQUEL_CHECK_INTERVAL_MS } = await import('./check');

setLocale('fr');

const HOUR_MS = 3_600_000;
const NOW = Date.UTC(2026, 10, 9, 12);
const SEED = { [STORAGE_KEYS.anilistToken]: { accessToken: 'a', expiresAt: Number.MAX_SAFE_INTEGER }, settings: { sequelAlerts: true, sequelNotifications: true } };

const ani = (mediaId: number): AniListListEntry => ({ mediaId, malId: null, title: `Série ${mediaId}`, coverUrl: null, status: 'COMPLETED', progress: 12, score: null, repeat: 0 });
const store = (): SequelStore => {
  const value: unknown = fake.local.peek(STORAGE_KEYS.sequelsState);
  if (!isSequelStore(value)) throw new Error('store absent');
  return value;
};
const sequelIds = (): number[] => store().records.map((record) => record.snapshot.id);

/** Première passe (amorçage) avec la série 1 sans suite, puis une suite par id de `sequelOf1` annoncée 25 h plus tard */
async function seed(): Promise<void> {
  fakes.anilist = [ani(1)];
  await checkSequels(NOW);
  expect(fakes.create).not.toHaveBeenCalled();
}

beforeEach(() => {
  fake.reset(SEED);
  fakes.sequels.clear();
  fakes.relationCalls = 0;
  fakes.failRelationsAt = 0;
  fakes.onRelations = null;
  fakes.anilist = [ani(1)];
  fakes.mal = [];
  fakes.catalog.clear();
  fakes.create.mockReset();
  fakes.create.mockImplementation(async (id) => id);
  fakes.permission.mockReset();
  fakes.permission.mockResolvedValue('granted');
});

describe('checkSequels', () => {
  it('première passe : suites enregistrées comme nouvelles, aucune notification, lastCheck posé', async () => {
    fakes.sequels.set(1, [{ id: 10, idMal: null }]);
    const result = await checkSequels(NOW);
    expect(fakes.create).not.toHaveBeenCalled();
    expect(sequelIds()).toEqual([10]);
    expect(store()).toMatchObject({ lastCheck: NOW, seeded: ['anilist'] });
    expect(result).toEqual({ checkedAt: NOW, found: 1, notified: 0, skipped: null, error: null });
    expect(fake.local.peek(STORAGE_KEYS.sequelsLastResult)).toEqual(result);
  });

  it('25 h plus tard : une suite → une notification avec boutons ; trois → une notification groupée', async () => {
    await seed();
    fakes.sequels.set(1, [{ id: 10, idMal: null }]);
    const later = NOW + 25 * HOUR_MS;
    expect(await checkSequels(later)).toMatchObject({ found: 1, notified: 1, skipped: null });
    expect(fakes.create).toHaveBeenCalledTimes(1);
    const [id, options] = fakes.create.mock.calls[0] ?? [];
    expect(id).toBe('synckai-sequel:10');
    expect(options?.title).toBe('Suite annoncée : Suite 10');
    expect(options?.message).toContain('Série 1');
    expect(options?.buttons?.map((button) => button.title)).toEqual(['+ À regarder', 'Ouvrir la fiche']);

    fakes.create.mockClear();
    fakes.sequels.set(1, [{ id: 10, idMal: null }, { id: 11, idMal: null }, { id: 12, idMal: null }, { id: 13, idMal: null }]);
    const result = await checkSequels(later + 25 * HOUR_MS);
    expect(result).toMatchObject({ found: 3, notified: 3 });
    expect(fakes.create).toHaveBeenCalledTimes(1);
    expect(fakes.create.mock.calls[0]?.[0]).toBe(`synckai-sequel:group:${later + 25 * HOUR_MS}`);
    expect(fakes.create.mock.calls[0]?.[1].title).toBe('3 suites annoncées');
  });

  it('moins de 24 h après lastCheck : not-due sans requête ; force la relance', async () => {
    await seed();
    fakes.relationCalls = 0;
    const result = await checkSequels(NOW + SEQUEL_CHECK_INTERVAL_MS - 1);
    expect(result).toMatchObject({ skipped: 'not-due', error: null });
    expect(fakes.relationCalls).toBe(0);
    await checkSequels(NOW + HOUR_MS, true);
    expect(fakes.relationCalls).toBe(1);
    expect(store().lastCheck).toBe(NOW + HOUR_MS);
  });

  it('not-due n’est jamais enregistré : le dernier résumé réel (suites trouvées, erreur) reste affiché', async () => {
    fakes.sequels.set(1, [{ id: 10, idMal: null }]);
    const first = await checkSequels(NOW);
    expect(first.found).toBe(1);
    const skipped = await checkSequels(NOW + HOUR_MS);
    expect(skipped.skipped).toBe('not-due');
    expect(fake.local.peek(STORAGE_KEYS.sequelsLastResult)).toEqual(first);
  });

  it('deux appels simultanés partagent une seule passe (une même promesse)', async () => {
    fakes.sequels.set(1, [{ id: 10, idMal: null }]);
    const a = checkSequels(NOW, true);
    const b = checkSequels(NOW, true);
    expect(b).toBe(a);
    await a;
    expect(fakes.relationCalls).toBe(1);
  });

  it('passe forcée moins de 60 s après la précédente : dernier résultat enregistré, aucune requête', async () => {
    const first = await checkSequels(NOW, true);
    fakes.relationCalls = 0;
    expect(await checkSequels(NOW + 59_000, true)).toEqual(first);
    expect(fakes.relationCalls).toBe(0);
    await checkSequels(NOW + 61_000, true);
    expect(fakes.relationCalls).toBe(1);
  });

  it('sequelAlerts coupé : disabled sans requête', async () => {
    fake.reset({ ...SEED, settings: { sequelAlerts: false } });
    expect(await checkSequels(NOW)).toMatchObject({ skipped: 'disabled' });
    expect(fakes.relationCalls).toBe(0);
    expect(fake.local.peek(STORAGE_KEYS.sequelsState)).toBeUndefined();
  });

  it('sans service connecté : not-connected', async () => {
    fake.reset({ settings: SEED.settings });
    expect(await checkSequels(NOW)).toMatchObject({ skipped: 'not-connected' });
  });

  it('sequelNotifications coupé : enregistrées comme nouvelles, aucune notification', async () => {
    await seed();
    await chrome.storage.local.set({ settings: { sequelAlerts: true, sequelNotifications: false } });
    fakes.sequels.set(1, [{ id: 10, idMal: null }]);
    const result = await checkSequels(NOW + 25 * HOUR_MS);
    expect(fakes.create).not.toHaveBeenCalled();
    expect(result).toMatchObject({ found: 1, notified: 0, skipped: null });
    expect(store().records[0]?.state).toBe('new');
  });

  it('une requête de relations échoue (RATE_LIMITED) : stockage et lastCheck intacts, rien de notifié, erreur remontée', async () => {
    await seed();
    const before = store();
    fakes.anilist = Array.from({ length: 120 }, (_, i) => ani(i + 1));
    fakes.sequels.set(1, [{ id: 10, idMal: null }]);
    fakes.relationCalls = 0;
    fakes.failRelationsAt = 2;
    const result = await checkSequels(NOW + 25 * HOUR_MS);
    expect(store()).toEqual(before);
    expect(fakes.create).not.toHaveBeenCalled();
    expect(result.error).toBe('Limite');
    expect(result.skipped).toBeNull();
    expect(fake.local.peek(STORAGE_KEYS.sequelsLastResult)).toEqual(result);
  });

  it('déconnexion entre la lecture des sessions et l’écriture : rien d’écrit, rien de notifié', async () => {
    await seed();
    const before = store();
    fakes.sequels.set(1, [{ id: 10, idMal: null }]);
    fakes.onRelations = async () => {
      await chrome.storage.local.set({ [STORAGE_KEYS.sessionEpoch]: { anilist: 1 } });
    };
    const result = await checkSequels(NOW + 25 * HOUR_MS);
    expect(store()).toEqual(before);
    expect(fakes.create).not.toHaveBeenCalled();
    expect(result).toMatchObject({ notified: 0, skipped: 'not-connected' });
  });

  it('notifications bloquées : enregistrées comme nouvelles, skipped blocked, jamais notifiées ensuite', async () => {
    await seed();
    fakes.permission.mockResolvedValue('denied');
    fakes.sequels.set(1, [{ id: 10, idMal: null }]);
    const result = await checkSequels(NOW + 25 * HOUR_MS);
    expect(fakes.create).not.toHaveBeenCalled();
    expect(result).toMatchObject({ found: 1, notified: 0, skipped: 'blocked' });
    expect(sequelIds()).toEqual([10]);

    fakes.permission.mockResolvedValue('granted');
    expect(await checkSequels(NOW + 50 * HOUR_MS)).toMatchObject({ found: 0, notified: 0 });
    expect(fakes.create).not.toHaveBeenCalled();
  });

  it('création de notification refusée : l’enregistrement reste, l’erreur est remontée', async () => {
    await seed();
    fakes.create.mockRejectedValue(new Error('refusée'));
    fakes.sequels.set(1, [{ id: 10, idMal: null }]);
    const result = await checkSequels(NOW + 25 * HOUR_MS);
    expect(result).toMatchObject({ notified: 0, error: 'refusée' });
    expect(sequelIds()).toEqual([10]);
  });

  it('déconnexion pendant les requêtes : ni le store ni le résumé ne sont recréés', async () => {
    fakes.sequels.set(1, [{ id: 10, idMal: null }]);
    fakes.onRelations = async () => {
      await chrome.storage.local.set({ [STORAGE_KEYS.sessionEpoch]: { anilist: 1 } });
    };
    await checkSequels(NOW);
    expect(fake.local.peek(STORAGE_KEYS.sequelsState)).toBeUndefined();
    expect(fake.local.peek(STORAGE_KEYS.sequelsLastResult)).toBeUndefined();
  });

  it('série source MAL seule : sourceTitle vient d’AniList, pas du titre MAL', async () => {
    fake.reset({ ...SEED, [STORAGE_KEYS.malToken]: { accessToken: 'm', refreshToken: 'r', expiresAt: Number.MAX_SAFE_INTEGER } });
    fakes.anilist = [];
    fakes.catalog.set(500, 900);
    fakes.mal = [{ malId: 500, mediaId: null, title: 'Titre MAL', coverUrl: null, status: 'COMPLETED', progress: 12, score: null, repeat: 0 } satisfies MalListEntry];
    fakes.sequels.set(900, [{ id: 10, idMal: null }]);
    await checkSequels(NOW);
    expect(store().records[0]?.snapshot).toMatchObject({ sourceId: 900, sourceTitle: 'Série 900' });
  });
});
