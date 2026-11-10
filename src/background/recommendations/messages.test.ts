import { beforeEach, describe, expect, it, vi } from 'vitest';
import { installFakeChrome } from '../../test/fake-chrome';
import { STORAGE_KEYS } from '../../protocol/storage-keys';
import { MAX_DISMISSED, type RecoBatch, type RecoItem } from '../../shared/recommendations';
const sessions = vi.hoisted(() => ({ getOpenSessions: vi.fn() }));
vi.mock('../../browser/storage/sessions', () => ({ getOpenSessions: sessions.getOpenSessions }));
import { dropSuggestion, restoreRecommendations, updateRecommendation } from './messages';

const fake = installFakeChrome();

const item = (id: number): RecoItem => ({
  card: { id, idMal: null, title: `T${id}`, format: 'TV', year: 2020, episodes: 12, averageScore: 80, genres: [], tags: [], coverUrl: null, coverLarge: null, color: null, bannerUrl: null, siteUrl: `https://anilist.co/anime/${id}`, platforms: [] },
  score: 10,
  reason: null,
});
const malItem = (id: number): RecoItem => ({ ...item(id), card: { ...item(id).card, idMal: id + 1000 } });
const batch = (...ids: number[]): RecoBatch => ({ items: ids.map(item), computedAt: 1, seedCount: 3, cold: false });
const storedIds = (): number[] => ((fake.local.peek(STORAGE_KEYS.recoBatch) as RecoBatch | undefined)?.items ?? []).map((i) => i.card.id);
const dismissed = (): unknown => fake.local.peek(STORAGE_KEYS.recoDismissed);

beforeEach(() => {
  fake.reset();
  sessions.getOpenSessions.mockReset();
  sessions.getOpenSessions.mockResolvedValue({ anilist: 1 });
});

describe('updateRecommendation', () => {
  it('added : retire la suggestion du lot enregistré, sans l’écarter', async () => {
    fake.local.seed({ [STORAGE_KEYS.recoBatch]: batch(1, 2, 3) });
    expect(await updateRecommendation(2, 'added')).toBe(true);
    expect(storedIds()).toEqual([1, 3]);
    expect(dismissed()).toBeUndefined();
  });

  it('dismissed : retire du lot et ajoute aux écartées', async () => {
    fake.local.seed({ [STORAGE_KEYS.recoBatch]: batch(1, 2, 3), [STORAGE_KEYS.recoDismissed]: [9] });
    expect(await updateRecommendation(3, 'dismissed')).toBe(true);
    expect(storedIds()).toEqual([1, 2]);
    expect(dismissed()).toEqual([9, 3]);
  });

  it('dismissed : sans doublon, plafonné à 500 (les plus anciennes sortent)', async () => {
    fake.local.seed({ [STORAGE_KEYS.recoDismissed]: Array.from({ length: MAX_DISMISSED }, (_, i) => i + 1) });
    await updateRecommendation(100000, 'dismissed');
    const list = dismissed() as number[];
    expect(list).toHaveLength(MAX_DISMISSED);
    expect(list[0]).toBe(2);
    expect(list.at(-1)).toBe(100000);
    await updateRecommendation(100000, 'dismissed');
    expect(dismissed()).toEqual(list);
  });

  it('sans lot enregistré (compte déconnecté entre-temps), aucun lot n’est recréé', async () => {
    expect(await updateRecommendation(2, 'added')).toBe(true);
    expect(fake.local.peek(STORAGE_KEYS.recoBatch)).toBeUndefined();
  });

  it('aucune session ouverte : rien n’est écrit (écartées jamais recréées après la dernière déconnexion)', async () => {
    sessions.getOpenSessions.mockResolvedValue({});
    fake.local.seed({ [STORAGE_KEYS.recoBatch]: batch(1) });
    expect(await updateRecommendation(1, 'dismissed')).toBe(false);
    expect(dismissed()).toBeUndefined();
    expect(storedIds()).toEqual([1]);
  });

  it('lot enregistré illisible : laissé tel quel', async () => {
    fake.local.seed({ [STORAGE_KEYS.recoBatch]: { items: 'x' } });
    await updateRecommendation(1, 'added');
    expect(fake.local.peek(STORAGE_KEYS.recoBatch)).toEqual({ items: 'x' });
  });

  it('undo : reprend l’identifiant des écartées', async () => {
    fake.local.seed({ [STORAGE_KEYS.recoBatch]: batch(1), [STORAGE_KEYS.recoDismissed]: [5, 7] });
    expect(await updateRecommendation(7, 'undo')).toBe(true);
    expect(dismissed()).toEqual([5]);
    expect(storedIds()).toEqual([1]);
  });
});

describe('restoreRecommendations', () => {
  it('aucune session ouverte : rien n’est touché', async () => {
    sessions.getOpenSessions.mockResolvedValue({});
    fake.local.seed({ [STORAGE_KEYS.recoDismissed]: [5] });
    expect(await restoreRecommendations()).toBe(false);
    expect(dismissed()).toEqual([5]);
  });

  it('vide les écartées et le lot (recalculé à la prochaine demande)', async () => {
    fake.local.seed({ [STORAGE_KEYS.recoBatch]: batch(1), [STORAGE_KEYS.recoDismissed]: [5, 7] });
    expect(await restoreRecommendations()).toBe(true);
    expect(dismissed()).toBeUndefined();
    expect(fake.local.peek(STORAGE_KEYS.recoBatch)).toBeUndefined();
  });
});

describe('dropSuggestion (série écrite dans une liste par SyncKai)', () => {
  it('AniList : retire la fiche du lot par son id', async () => {
    fake.local.seed({ [STORAGE_KEYS.recoBatch]: batch(1, 2, 3) });
    await dropSuggestion('anilist', 2);
    expect(storedIds()).toEqual([1, 3]);
  });

  it('MyAnimeList : retire la fiche par son idMal', async () => {
    fake.local.seed({ [STORAGE_KEYS.recoBatch]: { ...batch(1, 2, 3), items: [1, 2, 3].map(malItem) } });
    await dropSuggestion('mal', 1002);
    expect(storedIds()).toEqual([1, 3]);
  });

  it('aucun lot enregistré, ou id absent du lot : aucune écriture', async () => {
    const set = vi.spyOn(fake.local, 'set');
    await dropSuggestion('anilist', 2);
    fake.local.seed({ [STORAGE_KEYS.recoBatch]: batch(1, 3) });
    await dropSuggestion('anilist', 2);
    expect(set).not.toHaveBeenCalled();
    expect(storedIds()).toEqual([1, 3]);
  });
});
