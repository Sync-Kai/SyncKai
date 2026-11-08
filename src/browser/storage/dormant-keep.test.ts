import { beforeEach, describe, expect, it } from 'vitest';
import { STORAGE_KEYS } from '../../protocol/storage-keys';
import { installFakeChrome } from '../../test/fake-chrome';
import { clearAniListSession, clearMalSession } from './account-data';
import { keepDormant, readKeepMarks } from './dormant-keep';

// Marques « Garder » : écrites sous le verrou, liées à la génération de la session, part du service retirée à sa déconnexion

const fake = installFakeChrome();
const FAR = Number.MAX_SAFE_INTEGER;
const BOTH = { anilist: { accessToken: 'a', expiresAt: FAR }, malToken: { accessToken: 'm', refreshToken: 'r', expiresAt: FAR } };

beforeEach(() => fake.reset({ anilistToken: BOTH.anilist, malToken: BOTH.malToken }));

describe('keepDormant / readKeepMarks', () => {
  it('keep then read returns the mark', async () => {
    await keepDormant('anilist', '101', 1000);
    await expect(readKeepMarks('anilist')).resolves.toEqual({ '101': { keptAt: 1000 } });
    await expect(readKeepMarks('mal')).resolves.toEqual({});
  });

  it('a mark of another epoch is not returned', async () => {
    await keepDormant('anilist', '101', 1000);
    await fake.local.set({ [STORAGE_KEYS.sessionEpoch]: { anilist: 1 } });
    await expect(readKeepMarks('anilist')).resolves.toEqual({});
    // Nouvelle session : la marque de l'ancienne n'est pas reprise, la nouvelle repart de zéro
    await keepDormant('anilist', '202', 2000);
    await expect(readKeepMarks('anilist')).resolves.toEqual({ '202': { keptAt: 2000 } });
  });

  it('201st mark drops the oldest', async () => {
    for (let i = 0; i < 201; i++) await keepDormant('anilist', String(i), 1000 + i);
    const marks = await readKeepMarks('anilist');
    expect(Object.keys(marks)).toHaveLength(200);
    expect(marks['0']).toBeUndefined();
    expect(marks['1']).toEqual({ keptAt: 1001 });
    expect(marks['200']).toEqual({ keptAt: 1200 });
  });

  it('sign-out of the service purges its marks', async () => {
    await keepDormant('anilist', '101', 1000);
    await keepDormant('mal', 'mal:7', 1000);
    await clearAniListSession();
    await expect(readKeepMarks('anilist')).resolves.toEqual({});
    await expect(readKeepMarks('mal')).resolves.toEqual({ 'mal:7': { keptAt: 1000 } });
    expect(fake.local.peek(STORAGE_KEYS.watchingKeptDormant)).toEqual({ mal: { epoch: 0, marks: { 'mal:7': { keptAt: 1000 } } } });
    await clearMalSession();
    expect(fake.local.peek(STORAGE_KEYS.watchingKeptDormant)).toBeUndefined();
  });
});
