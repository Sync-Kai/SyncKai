import { describe, expect, it } from 'vitest';
import { AIRING_WEEK_PREFIX } from '../../shared/agenda';
import { STORAGE_KEYS } from '../../protocol/storage-keys';
import { TRACKER_IDS } from '../../shared/tracker.types';
import { ACCOUNT_STORES, GLOBAL_STORAGE_KEYS, keysClearedOnLastSession, keysClearedOnSessionEnd, prefixesClearedOnLastSession } from './account-keys';

describe('registre des données du compte', () => {
  const accountKeys = ACCOUNT_STORES.flatMap(({ keys }) => keys);

  it('chaque clé de STORAGE_KEYS est classée : liée au compte ou globale (avec sa raison)', () => {
    for (const key of Object.values(STORAGE_KEYS)) {
      const bound = accountKeys.includes(key);
      const global = key in GLOBAL_STORAGE_KEYS;
      expect(bound || global, `${key} : à déclarer dans ACCOUNT_STORES ou GLOBAL_STORAGE_KEYS`).toBe(true);
      expect(bound && global, `${key} : à la fois liée au compte et globale`).toBe(false);
    }
  });

  it('aucune clé déclarée deux fois ; les clés globales sont de vraies clés de STORAGE_KEYS', () => {
    expect(new Set(accountKeys).size).toBe(accountKeys.length);
    for (const key of Object.keys(GLOBAL_STORAGE_KEYS)) expect(Object.values(STORAGE_KEYS), key).toContain(key);
  });

  it('chaque service de suivi a son jeton, son profil et l’horodatage de son profil dans le registre', () => {
    for (const service of TRACKER_IDS) {
      const stores = ACCOUNT_STORES.filter(({ scope }) => scope.kind === 'service' && scope.service === service);
      expect(stores, service).toHaveLength(1);
      expect(stores[0]?.keys, service).toHaveLength(3);
    }
  });

  it('fin de session d’un service : son jeton et son profil, plus les clés du compte, jamais celles de l’autre service', () => {
    const anilist = keysClearedOnSessionEnd('anilist');
    expect(anilist).toContain(STORAGE_KEYS.anilistToken);
    expect(anilist).toContain(STORAGE_KEYS.compareJob);
    expect(anilist).toContain(STORAGE_KEYS.compareJobItems);
    expect(anilist).toContain(STORAGE_KEYS.crImportJobItems);
    expect(anilist).toContain(STORAGE_KEYS.crImportPlan);
    expect(anilist).not.toContain(STORAGE_KEYS.malToken);
    expect(anilist).not.toContain(STORAGE_KEYS.pendingReviews);
  });

  it('dernier compte : jamais de jeton, de correspondances ni de génération de session', () => {
    const keys = keysClearedOnLastSession();
    for (const key of [STORAGE_KEYS.anilistToken, STORAGE_KEYS.malToken, STORAGE_KEYS.mediaMappings, STORAGE_KEYS.sessionEpoch]) expect(keys, key).not.toContain(key);
    expect(keys).toContain(STORAGE_KEYS.watchingCache);
    expect(prefixesClearedOnLastSession()).toEqual([AIRING_WEEK_PREFIX]);
  });
});
