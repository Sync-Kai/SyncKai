import { beforeEach, describe, expect, it } from 'vitest';
import { STORAGE_KEYS } from '../../protocol/storage-keys';
import { installFakeChrome } from '../../test/fake-chrome';
import { clearAniListSession, clearMalSession } from './account-data';
import { getWeeklySyncCount, recordWeeklySyncs } from './weekly-syncs';

// Compteur « Synchro cette semaine » dans storage.local : écrit sous le verrou, seulement pour les sessions encore
// ouvertes (même génération), part du service retirée à sa déconnexion

const fake = installFakeChrome();
const THU = new Date(2026, 9, 15, 12).getTime();
const FAR = Number.MAX_SAFE_INTEGER;
// Tokens à l'ancien format (en clair) : présence seule, aucun déchiffrement
const BOTH = { anilistToken: { accessToken: 'a', expiresAt: FAR }, malToken: { accessToken: 'm', refreshToken: 'r', expiresAt: FAR } };

beforeEach(() => fake.reset(BOTH));

describe('recordWeeklySyncs / getWeeklySyncCount', () => {
  it('compte par service pour la session relevée avant l’écriture', async () => {
    await expect(recordWeeklySyncs(['anilist', 'mal'], { anilist: 0, mal: 0 }, THU)).resolves.toBe(true);
    await recordWeeklySyncs(['anilist'], { anilist: 0, mal: 0 }, THU + 1);
    await expect(getWeeklySyncCount('anilist', THU)).resolves.toBe(2);
    await expect(getWeeklySyncCount('mal', THU)).resolves.toBe(1);
  });

  it('session fermée ou remplacée depuis la synchro : rien n’est écrit pour elle', async () => {
    await fake.local.set({ [STORAGE_KEYS.sessionEpoch]: { anilist: 1 } });
    await expect(recordWeeklySyncs(['anilist'], { anilist: 0 }, THU)).resolves.toBe(false);
    expect(fake.local.peek(STORAGE_KEYS.weeklySyncs)).toBeUndefined();
    // MAL encore ouverte : sa part seule
    await recordWeeklySyncs(['anilist', 'mal'], { anilist: 0, mal: 0 }, THU);
    await expect(getWeeklySyncCount('anilist', THU)).resolves.toBe(0);
    await expect(getWeeklySyncCount('mal', THU)).resolves.toBe(1);
  });

  it('déconnexion d’un service : sa part retirée, celle de l’autre gardée ; reconnexion : repart de zéro', async () => {
    await recordWeeklySyncs(['anilist', 'mal'], { anilist: 0, mal: 0 }, THU);
    await clearAniListSession();
    await expect(getWeeklySyncCount('anilist', THU)).resolves.toBe(0);
    await expect(getWeeklySyncCount('mal', THU)).resolves.toBe(1);
    expect(fake.local.peek(STORAGE_KEYS.weeklySyncs)).toEqual({ mal: { weekStart: '2026-10-12', count: 1, epoch: 0 } });
    await clearMalSession();
    expect(fake.local.peek(STORAGE_KEYS.weeklySyncs)).toBeUndefined();
  });
});
