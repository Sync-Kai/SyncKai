import { beforeEach, describe, expect, it } from 'vitest';
import { STORAGE_KEYS } from '../../protocol/storage-keys';
import { installFakeChrome } from '../../test/fake-chrome';
import { dropOtherAccountActivity, getActivityHistory, recordActivity } from './activity-history';

// Historique d'activité dans storage.local : écrit sous le verrou, seulement pour les sessions encore ouvertes (même
// génération), avec l'identifiant du compte lu dans le profil en cache (identifiants de test fictifs)

const fake = installFakeChrome();
const THU = new Date(2026, 9, 15, 12).getTime();
const FAR = Number.MAX_SAFE_INTEGER;
// Tokens à l'ancien format (en clair) : présence seule, aucun déchiffrement
const BOTH = { anilistToken: { accessToken: 'a', expiresAt: FAR }, malToken: { accessToken: 'm', refreshToken: 'r', expiresAt: FAR } };
const VIEWERS = {
  [STORAGE_KEYS.anilistViewer]: { id: 7, name: 'A', siteUrl: 'https://anilist.co/user/7', avatarUrl: null },
  [STORAGE_KEYS.malViewer]: { id: 9, name: 'M', pictureUrl: null },
};

beforeEach(() => fake.reset({ ...BOTH, ...VIEWERS }));

describe('recordActivity / getActivityHistory', () => {
  it('écrit seulement pour les sessions relevées et toujours ouvertes', async () => {
    await expect(recordActivity(['anilist', 'mal'], { anilist: 0, mal: 0 }, 24, THU)).resolves.toBe(true);
    await expect(getActivityHistory()).resolves.toEqual({
      anilist: { accountId: 7, days: { '2026-10-15': [1, 24] } },
      mal: { accountId: 9, days: { '2026-10-15': [1, 24] } },
    });
    // Session AniList remplacée depuis la synchro : rien pour elle, MAL compté
    await fake.local.set({ [STORAGE_KEYS.sessionEpoch]: { anilist: 1, mal: 0 } });
    await recordActivity(['anilist', 'mal'], { anilist: 0, mal: 0 }, 24, THU);
    await expect(getActivityHistory()).resolves.toMatchObject({ anilist: { days: { '2026-10-15': [1, 24] } }, mal: { days: { '2026-10-15': [2, 48] } } });
    await expect(recordActivity(['anilist'], { anilist: 0 }, 24, THU)).resolves.toBe(false);
  });

  it('profil absent du cache : service ignoré', async () => {
    fake.reset({ ...BOTH, [STORAGE_KEYS.malViewer]: VIEWERS[STORAGE_KEYS.malViewer] });
    await expect(recordActivity(['anilist'], { anilist: 0, mal: 0 }, 24, THU)).resolves.toBe(false);
    expect(fake.local.peek(STORAGE_KEYS.activityHistory)).toBeUndefined();
    await recordActivity(['anilist', 'mal'], { anilist: 0, mal: 0 }, 24, THU);
    expect(fake.local.peek(STORAGE_KEYS.activityHistory)).toEqual({ mal: { accountId: 9, days: { '2026-10-15': [1, 24] } } });
  });

  it('dropOtherAccountActivity : part d’un autre compte retirée, même compte gardé', async () => {
    await recordActivity(['anilist', 'mal'], { anilist: 0, mal: 0 }, 24, THU);
    await dropOtherAccountActivity('anilist', 7);
    await expect(getActivityHistory()).resolves.toHaveProperty('anilist');
    await dropOtherAccountActivity('anilist', 8);
    await expect(getActivityHistory()).resolves.toEqual({ mal: { accountId: 9, days: { '2026-10-15': [1, 24] } } });
    // Dernière part retirée : clé retirée
    await dropOtherAccountActivity('mal', 10);
    expect(fake.local.peek(STORAGE_KEYS.activityHistory)).toBeUndefined();
  });
});
