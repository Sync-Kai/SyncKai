import { beforeEach, describe, expect, it, vi } from 'vitest';
import { setLocale } from '../../i18n';
import { STORAGE_KEYS } from '../../protocol/storage-keys';
import { isSequelStore, type SequelRecord, type SequelState, type SequelStore } from '../../shared/sequels';
import type { SyncOutcome } from '../../shared/sync.types';
import { installFakeChrome } from '../../test/fake-chrome';

// Actions des notifications de suites (clic, boutons) et mise à jour du store : vrai stockage (fausse API chrome),
// ajout à la liste, popup, onglets et notifications simulés.

const fakes = vi.hoisted(() => ({
  addToList: vi.fn<(payload: { mediaId: number; malId: number | null; status: string }) => Promise<unknown>>(),
  openPopupOn: vi.fn<(screen: string) => Promise<boolean>>(),
  tabsCreate: vi.fn<(options: { url: string }) => Promise<unknown>>(),
  clear: vi.fn<(id: string) => Promise<boolean>>(),
  update: vi.fn<(id: string, options: { message: string }) => Promise<boolean>>(),
}));

vi.mock('../controls', () => ({ addToList: fakes.addToList }));
vi.mock('../../browser/popup-screen', () => ({ openPopupOn: fakes.openPopupOn }));

const fake = installFakeChrome({ extra: { notifications: { clear: fakes.clear, update: fakes.update }, tabs: { create: fakes.tabsCreate } } });
const { handleSequelButton, handleSequelClick, updateSequels } = await import('./actions');

setLocale('fr');

const SEED = { [STORAGE_KEYS.anilistToken]: { accessToken: 'a', expiresAt: Number.MAX_SAFE_INTEGER } };
const record = (id: number, state: SequelState, firstSeenAt: number): SequelRecord => ({
  snapshot: { id, idMal: id === 10 ? 1010 : null, title: `Suite ${id}`, format: 'TV', status: 'NOT_YET_RELEASED', coverUrl: null, siteUrl: `https://anilist.co/anime/${id}`, year: 2027, month: 1, day: 10, season: null, seasonYear: null, sourceId: 1, sourceTitle: 'Série 1' },
  state,
  firstSeenAt,
});
const seedStore = (...records: SequelRecord[]): void => {
  fake.local.seed({ ...SEED, [STORAGE_KEYS.sequelsState]: { records, known: records.map((r) => r.snapshot.id), seeded: ['anilist'], lastCheck: 1 } satisfies SequelStore });
};
const stored = (): SequelRecord[] => {
  const value: unknown = fake.local.peek(STORAGE_KEYS.sequelsState);
  if (!isSequelStore(value)) throw new Error('store absent');
  return value.records;
};
const states = (): Record<number, SequelState> => Object.fromEntries(stored().map((r) => [r.snapshot.id, r.state]));
const synced = (...statuses: ('updated' | 'skipped' | 'error')[]): SyncOutcome => ({
  status: 'synced',
  mediaTitle: 'Suite 10',
  results: statuses.map((status) => ({
    service: 'anilist',
    outcome: status === 'updated' ? { status, progress: 0, completed: false } : status === 'skipped' ? { status, reason: 'Déjà dans ta liste' } : { status, message: 'Échec' },
  })),
});

beforeEach(() => {
  fake.reset();
  Object.values(fakes).forEach((mock) => mock.mockReset());
  fakes.openPopupOn.mockResolvedValue(true);
  fakes.tabsCreate.mockResolvedValue({});
  fakes.clear.mockResolvedValue(true);
  fakes.update.mockResolvedValue(true);
  seedStore(record(10, 'new', 100), record(11, 'seen', 200), record(12, 'dismissed', 300));
});

describe('clic sur la notification', () => {
  it('suite seule : ouvre la fiche et ferme la notification', async () => {
    await handleSequelClick('synckai-sequel:10');
    expect(fakes.tabsCreate).toHaveBeenCalledWith({ url: 'https://anilist.co/anime/10' });
    expect(fakes.clear).toHaveBeenCalledWith('synckai-sequel:10');
  });

  it('groupée : ouvre Activité', async () => {
    await handleSequelClick('synckai-sequel:group:5');
    expect(fakes.openPopupOn).toHaveBeenCalledWith('activity');
    expect(fakes.tabsCreate).not.toHaveBeenCalled();
    expect(fakes.clear).toHaveBeenCalledWith('synckai-sequel:group:5');
  });

  it('groupée, popup refusé : ouvre la fiche de la première suite visible (la plus récente)', async () => {
    fakes.openPopupOn.mockResolvedValue(false);
    await handleSequelClick('synckai-sequel:group:5');
    expect(fakes.tabsCreate).toHaveBeenCalledWith({ url: 'https://anilist.co/anime/11' });
  });
});

describe('boutons', () => {
  it('bouton 0 : ajoute à Planning, retire la suite du store et met la notification à jour', async () => {
    fakes.addToList.mockResolvedValue(synced('updated'));
    await handleSequelButton('synckai-sequel:10', 0);
    expect(fakes.addToList).toHaveBeenCalledWith({ mediaId: 10, malId: 1010, status: 'PLANNING' });
    expect(states()).toEqual({ 11: 'seen', 12: 'dismissed' });
    expect(fakes.update).toHaveBeenCalledWith('synckai-sequel:10', { message: 'Ajoutée à À regarder' });
  });

  it('bouton 0 : déjà dans la liste → message dédié, suite conservée', async () => {
    fakes.addToList.mockResolvedValue(synced('skipped'));
    await handleSequelButton('synckai-sequel:10', 0);
    expect(states()[10]).toBe('new');
    expect(fakes.update).toHaveBeenCalledWith('synckai-sequel:10', { message: 'Déjà dans ta liste' });
  });

  it('bouton 0 : succès partiel (un service en échec) → retirée, ajoutée', async () => {
    fakes.addToList.mockResolvedValue(synced('updated', 'error'));
    await handleSequelButton('synckai-sequel:10', 0);
    expect(states()[10]).toBeUndefined();
  });

  it('bouton 0 : échec → message d\'erreur, suite conservée', async () => {
    fakes.addToList.mockResolvedValue({ status: 'error', message: 'Limite atteinte' } satisfies SyncOutcome);
    await handleSequelButton('synckai-sequel:10', 0);
    expect(states()[10]).toBe('new');
    expect(fakes.update).toHaveBeenCalledWith('synckai-sequel:10', { message: 'Limite atteinte' });
  });

  it('bouton 1 : ouvre la fiche', async () => {
    await handleSequelButton('synckai-sequel:10', 1);
    expect(fakes.tabsCreate).toHaveBeenCalledWith({ url: 'https://anilist.co/anime/10' });
    expect(fakes.addToList).not.toHaveBeenCalled();
  });

  it('notification groupée, bouton 0 : comme le clic', async () => {
    await handleSequelButton('synckai-sequel:group:5', 0);
    expect(fakes.openPopupOn).toHaveBeenCalledWith('activity');
  });
});

describe('updateSequels', () => {
  it('seen / dismissed / removed', async () => {
    expect(await updateSequels([10], 'seen')).toBe(true);
    expect(await updateSequels([11], 'dismissed')).toBe(true);
    expect(await updateSequels([12], 'removed')).toBe(true);
    expect(states()).toEqual({ 10: 'seen', 11: 'dismissed' });
  });

  it('restore avec ids : dismissed → seen, les autres états inchangés', async () => {
    expect(await updateSequels([10, 12], 'restore')).toBe(true);
    expect(states()).toEqual({ 10: 'new', 11: 'seen', 12: 'seen' });
  });

  it('restore sans id : rétablit toutes les suites masquées', async () => {
    seedStore(record(10, 'dismissed', 100), record(11, 'new', 200), record(12, 'dismissed', 300));
    expect(await updateSequels([], 'restore')).toBe(true);
    expect(states()).toEqual({ 10: 'seen', 11: 'new', 12: 'seen' });
  });

  it('aucune session ouverte : false, store inchangé', async () => {
    fake.local.seed({ [STORAGE_KEYS.sequelsState]: { records: [record(10, 'new', 100)], known: [10], seeded: ['anilist'], lastCheck: 1 } satisfies SequelStore });
    expect(await updateSequels([10], 'dismissed')).toBe(false);
    expect(states()).toEqual({ 10: 'new' });
  });
});
