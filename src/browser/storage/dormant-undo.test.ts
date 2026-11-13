import { beforeEach, describe, expect, it } from 'vitest';
import { DORMANT_UNDO_KEY, STORAGE_KEYS } from '../../protocol/storage-keys';
import type { WatchingEntry } from '../../shared/watching.types';
import { installFakeChrome } from '../../test/fake-chrome';
import { clearSessionCaches } from './session-cache';
import { clearDormantUndo, DORMANT_UNDO_TTL_MS, readDormantUndo, saveDormantUndo, type SavedDormantUndo } from './dormant-undo';

// Jeu d'annulation des séries en sommeil (POP-05) : storage.session, deux minutes, lié aux sessions ouvertes

const fake = installFakeChrome();
const NOW = Date.UTC(2026, 10, 13, 12);
const FAR = Date.UTC(2030, 0, 1);

const ENTRY: WatchingEntry = {
  mediaId: 154587,
  malId: 52991,
  title: 'Frieren',
  coverUrl: null,
  progress: 7,
  totalEpisodes: 28,
  updatedAt: NOW - 40 * 86_400_000,
  nextEpisode: null,
  airingStatus: 'FINISHED',
  episodeMinutes: 24,
  listStatus: 'CURRENT',
  platforms: [],
  lastSync: null,
  siteUrl: 'https://anilist.co/anime/154587',
};
const UNDO: SavedDormantUndo = { service: 'anilist', writes: [{ entry: ENTRY, status: 'PAUSED', services: ['anilist'] }] };

beforeEach(() => fake.reset({ [STORAGE_KEYS.anilistToken]: { accessToken: 'a', expiresAt: FAR } }));

describe('dormant-undo', () => {
  it('gardé dans storage.session (jamais local), relu tel quel dans le délai, retiré ensuite', async () => {
    await saveDormantUndo(UNDO, NOW);
    expect(fake.session.peek(DORMANT_UNDO_KEY)).toMatchObject({ at: NOW, epochs: { anilist: 0 } });
    expect(fake.local.peek(DORMANT_UNDO_KEY)).toBeUndefined();
    await expect(readDormantUndo(NOW + DORMANT_UNDO_TTL_MS)).resolves.toEqual(UNDO);
    await expect(readDormantUndo(NOW + DORMANT_UNDO_TTL_MS + 1)).resolves.toBeNull();
    await clearDormantUndo();
    await expect(readDormantUndo(NOW)).resolves.toBeNull();
  });

  it('autre session (déconnexion puis connexion, autre service connecté) : rien', async () => {
    await saveDormantUndo(UNDO, NOW);
    await chrome.storage.local.set({ [STORAGE_KEYS.sessionEpoch]: { anilist: 1 } });
    await expect(readDormantUndo(NOW)).resolves.toBeNull();
    await chrome.storage.local.set({ [STORAGE_KEYS.sessionEpoch]: { anilist: 0 }, [STORAGE_KEYS.malToken]: { accessToken: 'm', refreshToken: 'r', expiresAt: FAR } });
    await expect(readDormantUndo(NOW)).resolves.toBeNull();
  });

  it('valeur altérée (lien étranger, statut ou service inconnu, date future) : rien', async () => {
    const stored = { ...UNDO, at: NOW, epochs: { anilist: 0 } };
    const altered = [
      { ...stored, writes: [{ ...UNDO.writes[0], entry: { ...ENTRY, siteUrl: 'https://evil.example/anime/1' } }] },
      { ...stored, writes: [{ ...UNDO.writes[0], status: 'COMPLETED' }] },
      { ...stored, writes: [{ ...UNDO.writes[0], services: ['kitsu'] }] },
      { ...stored, writes: [] },
      { ...stored, at: NOW + 1 },
    ];
    for (const value of altered) {
      await chrome.storage.session.set({ [DORMANT_UNDO_KEY]: value });
      await expect(readDormantUndo(NOW), JSON.stringify(value)).resolves.toBeNull();
    }
  });

  it('retiré à la déconnexion avec les caches de session (clearSessionCaches)', async () => {
    await saveDormantUndo(UNDO, NOW);
    await clearSessionCaches();
    expect(fake.session.peek(DORMANT_UNDO_KEY)).toBeUndefined();
  });
});
