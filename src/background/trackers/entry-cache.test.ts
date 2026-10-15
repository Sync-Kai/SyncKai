import { beforeEach, describe, expect, it } from 'vitest';
import { clearEntryCache, ENTRY_CACHE_TTL_MS, entryGeneration, forgetCachedEntries, readCachedEntry, storeCachedEntry } from './entry-cache';

const ENTRY = { title: 'Frieren', episodes: 28, entry: { status: 'CURRENT' as const, progress: 3 }, notes: null };

beforeEach(() => clearEntryCache());

describe('entrées de liste gardées pour l’affichage', () => {
  it('servies au même compte seulement, pendant ENTRY_CACHE_TTL_MS', () => {
    storeCachedEntry('anilist', 'compte-a', 1, ENTRY, entryGeneration('anilist'));
    expect(readCachedEntry('anilist', 'compte-a', 1)).toEqual(ENTRY);
    expect(readCachedEntry('anilist', 'compte-b', 1)).toBeUndefined();
    expect(readCachedEntry('mal', 'compte-a', 1)).toBeUndefined();
    storeCachedEntry('anilist', 'compte-a', 2, ENTRY, entryGeneration('anilist'));
    expect(readCachedEntry('anilist', 'compte-a', 2, Date.now() + ENTRY_CACHE_TTL_MS + 1)).toBeUndefined();
  });

  it('écriture sur le service : entrées oubliées, et une lecture partie avant l’écriture n’est pas rangée', () => {
    storeCachedEntry('anilist', 'compte-a', 1, ENTRY, entryGeneration('anilist'));
    storeCachedEntry('mal', 'compte-m', 1, ENTRY, entryGeneration('mal'));
    const before = entryGeneration('anilist');
    forgetCachedEntries('anilist');
    expect(readCachedEntry('anilist', 'compte-a', 1)).toBeUndefined();
    expect(readCachedEntry('mal', 'compte-m', 1)).toEqual(ENTRY);
    storeCachedEntry('anilist', 'compte-a', 1, ENTRY, before);
    expect(readCachedEntry('anilist', 'compte-a', 1)).toBeUndefined();
  });
});
