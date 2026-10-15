import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { STORAGE_KEYS } from '../../protocol/storage-keys';
import type { AiringWeekCache } from '../../shared/agenda';
import { installFakeChrome } from '../../test/fake-chrome';

// Liste des clés du stockage sans en cloner les valeurs (PERF-14) : getKeys quand le navigateur l'a (Chrome 130+,
// Firefox récent), sinon get(null). Semaines de l'agenda élaguées à chaque vérification horaire, effacées à la
// déconnexion du dernier compte.

vi.mock('../badge', () => ({ refreshReviewBadge: async () => undefined }));

const fake = installFakeChrome();
const { storedKeys, storedKeysWithPrefix } = await import('./stored-keys');
const { writeWeekCache } = await import('./agenda-store');
const { clearUserSyncData } = await import('./account-data');

const DAY_MS = 86_400_000;
const NOW = Date.UTC(2026, 9, 15, 12);
/** Gros contenu sans rapport (plan d'import, correspondances…) : jamais relu pour lister les semaines */
const BULK = { crImportPlan: { items: Array.from({ length: 50 }, (_, i) => ({ id: i })) }, mediaMappings: { a: 1 } };

const week = (weekStart: string): AiringWeekCache => ({ weekStart, fetchedAt: NOW, mediaIds: [1], schedules: [] });

/** Appels de chrome.storage.local.get(null) (lecture de tout le stockage) */
function fullReads(spy: { mock: { calls: unknown[][] } }): number {
  return spy.mock.calls.filter((args) => args[0] === null || args[0] === undefined).length;
}

beforeEach(() => {
  fake.reset({
    ...BULK,
    [STORAGE_KEYS.anilistToken]: { accessToken: 'anilist', expiresAt: Number.MAX_SAFE_INTEGER },
    'airingWeek:2026-01-05': week('2026-01-05'),
    'airingWeek:2026-10-12': week('2026-10-12'),
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('storedKeys (PERF-14)', () => {
  it('getKeys disponible : les noms seuls, aucune lecture de tout le stockage', async () => {
    const get = vi.spyOn(fake.local, 'get');
    expect((await storedKeys()).sort()).toEqual(['airingWeek:2026-01-05', 'airingWeek:2026-10-12', 'anilistToken', 'crImportPlan', 'mediaMappings']);
    expect(fullReads(get)).toBe(0);
  });

  it('navigateur sans getKeys : repli sur get(null), même résultat', async () => {
    fake.local.supportGetKeys(false);
    const get = vi.spyOn(fake.local, 'get');
    expect(await storedKeysWithPrefix(['airingWeek:'])).toEqual(['airingWeek:2026-01-05', 'airingWeek:2026-10-12']);
    expect(fullReads(get)).toBe(1);
  });

  it('autre zone (session) : ses propres clés', async () => {
    await fake.session.set({ 'pageMedia:1': 1 });
    expect(await storedKeys(chrome.storage.session)).toEqual(['pageMedia:1']);
  });
});

describe('writeWeekCache : élagage des semaines sans lire tout le stockage (PERF-14)', () => {
  it('getKeys : semaine écrite, semaine lointaine retirée, aucun get(null)', async () => {
    const get = vi.spyOn(fake.local, 'get');
    expect(await writeWeekCache(week('2026-10-19'), { anilist: 0 }, NOW)).toBe(true);
    expect(fake.local.peek('airingWeek:2026-10-19')).toEqual(week('2026-10-19'));
    expect(fake.local.peek('airingWeek:2026-01-05')).toBeUndefined();
    expect(fake.local.peek('airingWeek:2026-10-12')).toEqual(week('2026-10-12'));
    expect(fake.local.peek('crImportPlan')).toEqual(BULK.crImportPlan);
    expect(fullReads(get)).toBe(0);
  });

  it('sans getKeys : même élagage par get(null)', async () => {
    fake.local.supportGetKeys(false);
    expect(await writeWeekCache(week('2026-10-19'), { anilist: 0 }, NOW + DAY_MS)).toBe(true);
    expect(fake.local.peek('airingWeek:2026-01-05')).toBeUndefined();
    expect(fake.local.peek('airingWeek:2026-10-19')).toEqual(week('2026-10-19'));
  });
});

describe('déconnexion du dernier compte : semaines de l’agenda effacées (PERF-14)', () => {
  it('getKeys : toutes les semaines retirées, aucun get(null), correspondances gardées', async () => {
    const get = vi.spyOn(fake.local, 'get');
    await clearUserSyncData();
    expect(fake.local.peek('airingWeek:2026-01-05')).toBeUndefined();
    expect(fake.local.peek('airingWeek:2026-10-12')).toBeUndefined();
    expect(fake.local.peek('mediaMappings')).toEqual(BULK.mediaMappings);
    expect(fullReads(get)).toBe(0);
  });

  it('sans getKeys : mêmes semaines retirées', async () => {
    fake.local.supportGetKeys(false);
    fake.session.supportGetKeys(false);
    await clearUserSyncData();
    expect(await storedKeysWithPrefix(['airingWeek:'])).toEqual([]);
  });
});
